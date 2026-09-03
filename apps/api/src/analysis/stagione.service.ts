import { Injectable } from "@nestjs/common";
import { PrismaService } from "../common/prisma.service";
import { AccessService } from "../common/access.service";
import { statisticheGiocatori, type VoceGiocatore } from "@vv/core";
import type { AnalysisPackage } from "@vv/schema";

/**
 * STATISTICHE SU PIU PARTITE.
 *
 * Due avvertenze che non sono dettagli.
 *
 * **1. Si aggrega sulla PERSONA, non sul numero di maglia.** Il numero cambia
 * fra squadre e fra stagioni; senza un'identita stabile, "42 attacchi in
 * stagione" non e calcolabile. E il motivo per cui `Person` esiste
 * (`docs/04-dati.md`). Chi non ha una persona collegata resta fuori, e il
 * conteggio di quanti sono viene restituito perche la schermata lo dichiari.
 *
 * **2. L'insieme va sempre dichiarato.** Le statistiche valgono sulle partite
 * comprese nel filtro, non "in generale": si restituisce sempre quante partite
 * sono state considerate e quali. Un numero senza il suo insieme e un numero
 * che qualcuno leggera come se valesse per tutto.
 *
 * Qui gira sul server perche i dati stanno qui. In Fase 3, sul client, girera
 * **la stessa funzione** di `@vv/core` sulle partite scaricate: una sola
 * definizione delle metriche, altrimenti i numeri divergono.
 */

export interface FiltroStagione {
  competitionId?: string;
  teamId?: string;
  stagione?: string;
  dal?: string;
  al?: string;
}

export interface VoceStagione extends Omit<VoceGiocatore, "team" | "jersey"> {
  personId: string;
  cognome: string;
  nome: string;
  /** Numeri di maglia con cui ha giocato: cambiano, ed e giusto vederlo. */
  maglie: number[];
  squadre: string[];
  partite: number;
}

@Injectable()
export class StagioneService {
  constructor(private prisma: PrismaService, private access: AccessService) {}

  async perGiocatore(userId: string, f: FiltroStagione) {
    const ids = await this.access.competitionIdsVisibili(userId);

    const partite = await this.prisma.match.findMany({
      where: {
        competitionId: f.competitionId ? f.competitionId : { in: ids },
        stato: "READY",
        ...(f.teamId ? { OR: [{ homeTeamId: f.teamId }, { awayTeamId: f.teamId }] } : {}),
        ...(f.stagione ? { competition: { stagione: f.stagione } } : {}),
        ...(f.dal || f.al ? { data: {
          ...(f.dal ? { gte: new Date(f.dal) } : {}),
          ...(f.al ? { lte: new Date(f.al) } : {}),
        } } : {}),
      },
      include: {
        competition: { select: { nome: true, stagione: true } },
        homeTeam: { select: { nome: true } }, awayTeam: { select: { nome: true } },
        analisi: { select: { pacchettoJson: true } },
        giocatori: true,
      },
      orderBy: { data: "desc" },
    });

    const per = new Map<string, VoceStagione>();
    const squadrePer = new Map<string, Set<string>>();
    const magliePer = new Map<string, Set<number>>();
    const partitePer = new Map<string, Set<string>>();

    let conAnalisi = 0;
    let senzaPersona = 0;
    let tocchiSenzaGiocatore = 0;
    let tocchiTotali = 0;

    for (const m of partite) {
      if (!m.analisi) continue;
      let pkg: AnalysisPackage;
      try { pkg = JSON.parse(m.analisi.pacchettoJson); } catch { continue; }
      conAnalisi++;

      const r = statisticheGiocatori(pkg.events);
      tocchiSenzaGiocatore += r.tocchiSenzaGiocatore;
      tocchiTotali += r.tocchiTotali;

      // Dal numero di maglia alla persona: e il passaggio che rende possibile
      // l'aggregazione. Senza roster collegato, la riga non e attribuibile.
      const perLatoMaglia = new Map<string, (typeof m.giocatori)[number]>();
      for (const g of m.giocatori) perLatoMaglia.set(`${g.lato}-${g.numeroMaglia}`, g);

      for (const v of r.voci) {
        const g = perLatoMaglia.get(`${v.team}-${v.jersey}`);
        if (!g?.personId) { senzaPersona++; continue; }

        const chiave = g.personId;
        let riga = per.get(chiave);
        if (!riga) {
          riga = {
            personId: chiave, cognome: g.cognome, nome: g.nome,
            maglie: [], squadre: [], partite: 0,
            punti: 0, attacchi: 0, attacchiPunto: 0, attacchiErrore: 0, attacchiMurati: 0,
            efficienzaAttacco: null, battute: 0, ace: 0, erroriServizio: 0, muriPunto: 0,
            ricezioni: 0, erroriRicezione: 0, difese: 0, erroriDifesa: 0, alzate: 0, tocchi: 0,
          };
          per.set(chiave, riga);
          squadrePer.set(chiave, new Set());
          magliePer.set(chiave, new Set());
          partitePer.set(chiave, new Set());
        }

        for (const k of ["punti", "attacchi", "attacchiPunto", "attacchiErrore", "attacchiMurati",
                         "battute", "ace", "erroriServizio", "muriPunto", "ricezioni",
                         "erroriRicezione", "difese", "erroriDifesa", "alzate", "tocchi"] as const) {
          (riga as any)[k] += v[k];
        }
        magliePer.get(chiave)!.add(v.jersey);
        squadrePer.get(chiave)!.add(v.team === "h" ? m.homeTeam.nome : m.awayTeam.nome);
        partitePer.get(chiave)!.add(m.id);
      }
    }

    const voci = [...per.values()].map((v) => {
      v.maglie = [...magliePer.get(v.personId)!].sort((a, b) => a - b);
      v.squadre = [...squadrePer.get(v.personId)!].sort();
      v.partite = partitePer.get(v.personId)!.size;
      v.efficienzaAttacco = v.attacchi
        ? Math.round(((v.attacchiPunto - v.attacchiErrore - v.attacchiMurati) / v.attacchi) * 100)
        : null;
      return v;
    }).sort((a, b) => b.punti - a.punti || b.tocchi - a.tocchi);

    return {
      voci,
      /** L'ampiezza dell'insieme: va sempre dichiarata a schermo. */
      insieme: {
        partiteConsiderate: conAnalisi,
        partiteTrovate: partite.length,
        senzaAnalisi: partite.length - conAnalisi,
        elenco: partite.filter((m) => m.analisi).map((m) => ({
          id: m.id, data: m.data.toISOString(),
          casa: m.homeTeam.nome, ospite: m.awayTeam.nome,
          campionato: m.competition.nome, stagione: m.competition.stagione,
        })),
      },
      limiti: {
        vociSenzaPersona: senzaPersona,
        tocchiSenzaGiocatore,
        quotaSenzaGiocatore: tocchiTotali
          ? Math.round((tocchiSenzaGiocatore / tocchiTotali) * 1000) / 10 : 0,
      },
    };
  }
}
