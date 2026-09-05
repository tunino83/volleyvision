import { Injectable, NotFoundException } from "@nestjs/common";
import { CONFIG } from "../common/config";
import { PrismaService } from "../common/prisma.service";
import { AccessService } from "../common/access.service";
import { statisticheGiocatori, type VoceGiocatore } from "@vv/core";
import type { AnalysisPackage } from "@vv/schema";

/**
 * La scheda di una persona: cosa ha fatto, partita per partita.
 *
 * Si aggrega sulla **persona**, non sul numero di maglia: il numero cambia fra
 * squadre e stagioni, ed e il motivo per cui `Person` esiste
 * (`docs/04-dati.md`). Le maglie con cui ha giocato vengono restituite, perche
 * vederle e utile e nasconderle sarebbe una perdita di informazione.
 *
 * Due cose che questa scheda deve dire, e che nessun totale dice da solo:
 * **su quante partite** vale un numero, e **quanto se ne e persa per strada**
 * perche il fornitore non ha riconosciuto il giocatore.
 */

const VOCE_VUOTA = (): Omit<VoceGiocatore, "team" | "jersey"> => ({
  punti: 0, attacchi: 0, attacchiPunto: 0, attacchiErrore: 0, attacchiMurati: 0,
  efficienzaAttacco: null, battute: 0, ace: 0, erroriServizio: 0, muriPunto: 0,
  ricezioni: 0, erroriRicezione: 0, difese: 0, erroriDifesa: 0, alzate: 0, tocchi: 0,
});

const SOMMABILI = [
  "punti", "attacchi", "attacchiPunto", "attacchiErrore", "attacchiMurati",
  "battute", "ace", "erroriServizio", "muriPunto", "ricezioni",
  "erroriRicezione", "difese", "erroriDifesa", "alzate", "tocchi",
] as const;

@Injectable()
export class SchedaService {
  constructor(private prisma: PrismaService, private access: AccessService) {}

  async scheda(userId: string, personId: string) {
    const persona = await this.prisma.person.findFirst({
      where: { id: personId, ownerId: userId },
      // Solo la data della foto: i byte si prendono dalla rotta dedicata.
      include: { foto: { select: { aggiornataIl: true } } } });
    if (!persona) {
      throw new NotFoundException({ code: "NON_TROVATO", message: "Persona non trovata" });
    }

    const ids = await this.access.competitionIdsVisibili(userId);

    // Le partite in cui compare, con l'analisi: senza analisi non c'e nulla
    // da contare, e dirlo e meglio che mostrare uno zero.
    const presenze = await this.prisma.matchPlayer.findMany({
      where: { personId, match: { competitionId: { in: ids } } },
      include: {
        match: {
          include: {
            competition: { select: { nome: true, stagione: true } },
            homeTeam: { select: { nome: true } }, awayTeam: { select: { nome: true } },
            analisi: { select: { pacchettoJson: true } },
          },
        },
      },
      orderBy: { match: { data: "desc" } },
    });

    const totali = VOCE_VUOTA();
    const perPartita: any[] = [];
    const maglie = new Set<number>();
    const squadre = new Set<string>();
    let senzaAnalisi = 0;
    let tocchiSenzaGiocatore = 0;
    let tocchiTotaliPartite = 0;

    for (const p of presenze) {
      const m = p.match;
      maglie.add(p.numeroMaglia);
      squadre.add(p.lato === "h" ? m.homeTeam.nome : m.awayTeam.nome);

      if (!m.analisi) { senzaAnalisi++; continue; }
      let pkg: AnalysisPackage;
      try { pkg = JSON.parse(m.analisi.pacchettoJson); } catch { senzaAnalisi++; continue; }

      const r = statisticheGiocatori(pkg.events);
      tocchiSenzaGiocatore += r.tocchiSenzaGiocatore;
      tocchiTotaliPartite += r.tocchiTotali;

      const voce = r.voci.find((v) => v.team === p.lato && v.jersey === p.numeroMaglia);
      if (!voce) continue;   // in campo non e mai stato riconosciuto

      for (const k of SOMMABILI) (totali as any)[k] += voce[k];

      perPartita.push({
        matchId: m.id,
        data: m.data.toISOString(),
        campionato: m.competition.nome,
        stagione: m.competition.stagione,
        squadra: p.lato === "h" ? m.homeTeam.nome : m.awayTeam.nome,
        avversario: p.lato === "h" ? m.awayTeam.nome : m.homeTeam.nome,
        inCasa: p.lato === "h",
        maglia: p.numeroMaglia,
        set: pkg.sets.length,
        voce,
      });
    }

    totali.efficienzaAttacco = totali.attacchi
      ? Math.round(((totali.attacchiPunto - totali.attacchiErrore - totali.attacchiMurati)
                    / totali.attacchi) * 100)
      : null;

    return {
      persona: {
        id: persona.id, cognome: persona.cognome, nome: persona.nome,
        avatarStile: persona.avatarStile, avatarSeme: persona.avatarSeme,
        avatarOpzioni: persona.avatarOpzioniJson
          ? (() => { try { return JSON.parse(persona.avatarOpzioniJson!); } catch { return null; } })() : null,
        foto: CONFIG.funzioni.fotoPersone && persona.foto
              ? persona.foto.aggiornataIl.getTime() : null,
        // Perche la stella sulla scheda parta gia nello stato giusto invece
        // di accendersi dopo il primo clic.
        preferita: !!(await this.prisma.personaPreferita.findUnique({
          where: { userId_personId: { userId, personId: persona.id } },
          select: { personId: true } })),
      },
      maglie: [...maglie].sort((a, b) => a - b),
      squadre: [...squadre].sort(),
      totali,
      /** Quante partite stanno dietro i totali: senza, un numero non si legge. */
      insieme: {
        partiteConteggiate: perPartita.length,
        presenze: presenze.length,
        senzaAnalisi,
      },
      limiti: {
        quotaSenzaGiocatore: tocchiTotaliPartite
          ? Math.round((tocchiSenzaGiocatore / tocchiTotaliPartite) * 1000) / 10 : 0,
      },
      // Dalla piu recente alla piu vecchia per l'elenco; i grafici la girano.
      perPartita,
    };
  }
}
