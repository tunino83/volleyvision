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

  /**
   * Le partite che rientrano nel filtro, con quel che serve a contare.
   *
   * Estratta perche i due metodi pubblici partono dallo stesso insieme: uno
   * lo somma per persona, l'altro lo tiene diviso per partita. Duplicare la
   * query significherebbe due filtri che col tempo divergono, e due schermate
   * che dicono di guardare le stesse partite guardandone di diverse.
   */
  private partiteDelFiltro(userId: string, f: FiltroStagione, ids: string[]) {
    return this.prisma.match.findMany({
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
  }

  async perGiocatore(userId: string, f: FiltroStagione) {
    const ids = await this.access.competitionIdsVisibili(userId);
    const partite = await this.partiteDelFiltro(userId, f, ids);

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

  /**
   * GLI STESSI NUMERI, TENUTI DIVISI PER PARTITA.
   *
   * <h3>Perche non bastava `perGiocatore`</h3>
   *
   * Quello somma tutto in un totale di stagione, e un totale non risponde alla
   * domanda che ci si fa piu spesso: **sta migliorando?**. Per rispondere
   * serve la stessa misura ripetuta nel tempo, e una somma la perde per
   * costruzione. Non e un dettaglio di comodo: senza questa rotta la home non
   * poteva mostrare nessun andamento, perche l'elenco delle partite non porta
   * con se alcun valore per partita.
   *
   * <h3>Di chi sono i numeri</h3>
   *
   * Lo decide il filtro, e i tre casi sono tre domande diverse:
   *
   * <ul>
   * <li>`personId` — come e andato **quel giocatore**, partita per partita</li>
   * <li>`teamId` — come e andata **quella squadra**, dal suo lato del campo</li>
   * <li>nessuno dei due — la partita intera, entrambe le squadre insieme</li>
   * </ul>
   *
   * <h3>Ordine</h3>
   *
   * Dalla piu vecchia alla piu recente, al contrario dell'elenco partite. Un
   * andamento si legge da sinistra a destra nel verso del tempo, e girarlo
   * nel client sarebbe un dettaglio che prima o poi qualcuno dimentica.
   */
  async perPartita(userId: string, f: FiltroStagione & { personId?: string }) {
    const ids = await this.access.competitionIdsVisibili(userId);
    const partite = await this.partiteDelFiltro(userId, f, ids);

    const voci = [];
    let senzaAnalisi = 0;

    for (const m of partite) {
      if (!m.analisi) { senzaAnalisi++; continue; }
      let pkg: AnalysisPackage;
      try { pkg = JSON.parse(m.analisi.pacchettoJson); } catch { senzaAnalisi++; continue; }

      const r = statisticheGiocatori(pkg.events);
      const perLatoMaglia = new Map<string, (typeof m.giocatori)[number]>();
      for (const g of m.giocatori) perLatoMaglia.set(`${g.lato}-${g.numeroMaglia}`, g);

      // Il lato della squadra filtrata. Puo essere entrambi, se una squadra
      // gioca contro se stessa in amichevole: caso strano ma legittimo, e
      // sommare due volte darebbe il doppio dei punti veri.
      const lato = f.teamId
        ? (m.homeTeamId === f.teamId ? "h" : m.awayTeamId === f.teamId ? "a" : null)
        : null;

      const scelte = r.voci.filter((v) => {
        if (f.personId) return perLatoMaglia.get(`${v.team}-${v.jersey}`)?.personId === f.personId;
        if (lato) return v.team === lato;
        return true;
      });

      // Una persona che non ha giocato quella partita non produce un punto a
      // zero: produce **niente**. Zero direbbe "ha giocato e non ha fatto
      // punti", che e un'altra cosa, e falserebbe ogni media.
      if (f.personId && scelte.length === 0) continue;

      const somma = (k: keyof (typeof scelte)[number]) =>
        scelte.reduce((s, v) => s + (Number(v[k]) || 0), 0);

      const attacchi = somma("attacchi");
      voci.push({
        matchId: m.id,
        data: m.data.toISOString(),
        casa: m.homeTeam.nome,
        ospite: m.awayTeam.nome,
        // Gli identificativi e non solo i nomi: una pagina di squadra deve
        // poter dire "contro chi" senza confrontare stringhe, e due squadre
        // possono chiamarsi uguale in campionati diversi.
        casaId: m.homeTeamId,
        ospiteId: m.awayTeamId,
        campionato: m.competition.nome,
        stagione: m.competition.stagione,
        punti: somma("punti"),
        attacchi,
        attacchiPunto: somma("attacchiPunto"),
        attacchiErrore: somma("attacchiErrore"),
        attacchiMurati: somma("attacchiMurati"),
        battute: somma("battute"),
        ace: somma("ace"),
        erroriServizio: somma("erroriServizio"),
        muriPunto: somma("muriPunto"),
        ricezioni: somma("ricezioni"),
        erroriRicezione: somma("erroriRicezione"),
        difese: somma("difese"),
        alzate: somma("alzate"),
        tocchi: somma("tocchi"),
        // `null` e non zero quando non ha mai attaccato: sono due cose
        // diverse, e un grafico che disegna zero racconta una brutta partita
        // al posto di una partita senza attacchi.
        efficienzaAttacco: attacchi
          ? Math.round(((somma("attacchiPunto") - somma("attacchiErrore")
                         - somma("attacchiMurati")) / attacchi) * 100)
          : null,
      });
    }

    voci.reverse();

    return {
      voci,
      insieme: {
        partiteConsiderate: voci.length,
        partiteTrovate: partite.length,
        senzaAnalisi,
        /** Di chi sono i numeri: la schermata deve poterlo dire, non dedurlo. */
        soggetto: f.personId ? "persona" : f.teamId ? "squadra" : "partita",
      },
    };
  }
}
