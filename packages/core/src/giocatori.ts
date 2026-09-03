import { select, type EventFilter, type IndexedEvent } from "./select";

/**
 * STATISTICHE PER GIOCATORE.
 *
 * Stessa regola del resto del motore: ogni numero e un **insieme di eventi**,
 * mai un contatore. Chi tocca il "12" degli attacchi punto vede quei dodici
 * attacchi, e vale qui esattamente come per le statistiche di squadra.
 *
 * Un chiarimento che vale piu di ogni formula: **il fornitore non riconosce
 * tutti i giocatori.** Sui dati reali circa il 5% dei tocchi non ha un numero
 * di maglia. Quei tocchi finiscono nel totale di squadra ma non possono
 * finire in nessuna riga individuale — quindi la somma delle righe qui NON
 * fa il totale di squadra, e l'interfaccia deve dirlo invece di lasciare
 * credere a un errore di calcolo.
 */

export interface VoceGiocatore {
  team: "h" | "a";
  jersey: number;

  /** Punti = attacchi punto + ace + muri punto. E il "quanto pesa". */
  punti: number;

  attacchi: number;
  attacchiPunto: number;
  attacchiErrore: number;
  attacchiMurati: number;
  /** (punto - errore - murato) / totale. E l'efficienza vera della pallavolo. */
  efficienzaAttacco: number | null;

  battute: number;
  ace: number;
  erroriServizio: number;

  muriPunto: number;

  ricezioni: number;
  erroriRicezione: number;

  difese: number;
  erroriDifesa: number;

  /** Alzate: il volume dice chi ha giocato da palleggiatore. */
  alzate: number;

  /** Tocchi totali attribuiti: la base su cui pesare tutto il resto. */
  tocchi: number;
}

/** Gli indici degli eventi dietro una voce: servono all'explainability. */
export type IndiciPerVoce = Record<string, number[]>;

export interface StatisticheGiocatori {
  voci: VoceGiocatore[];
  /** Tocchi che nessuna riga puo contenere, perche senza giocatore. */
  tocchiSenzaGiocatore: number;
  tocchiTotali: number;
}

const pct = (num: number, den: number) => (den ? Math.round((num / den) * 100) : null);

/**
 * Costruisce una riga per ogni giocatore riconosciuto.
 *
 * Si passa una volta sola sugli eventi: con qualche migliaio di tocchi la
 * differenza non si vede, ma la stessa funzione girera nel client sulle
 * statistiche di stagione, dove gli eventi sono centinaia di migliaia.
 */
export function statisticheGiocatori(
  ev: IndexedEvent[], f: EventFilter = {},
): StatisticheGiocatori {
  const base = select(ev, f);
  const per = new Map<string, { v: VoceGiocatore; idx: IndiciPerVoce }>();

  let senzaGiocatore = 0;

  for (const e of base) {
    if (e.jersey === null || e.jerseyIgnoto) { senzaGiocatore++; continue; }

    const k = `${e.team}-${e.jersey}`;
    let riga = per.get(k);
    if (!riga) {
      riga = {
        v: {
          team: e.team, jersey: e.jersey, punti: 0,
          attacchi: 0, attacchiPunto: 0, attacchiErrore: 0, attacchiMurati: 0,
          efficienzaAttacco: null,
          battute: 0, ace: 0, erroriServizio: 0,
          muriPunto: 0, ricezioni: 0, erroriRicezione: 0,
          difese: 0, erroriDifesa: 0, alzate: 0, tocchi: 0,
        },
        idx: {},
      };
      per.set(k, riga);
    }
    const { v, idx } = riga;
    const segna = (chiave: string) => (idx[chiave] ??= []).push(e.idx);

    v.tocchi++;
    segna("tocchi");

    switch (e.skill) {
      case "A":
        v.attacchi++; segna("attacchi");
        if (e.value === "Point") { v.attacchiPunto++; v.punti++; segna("attacchiPunto"); segna("punti"); }
        else if (e.value === "Error") { v.attacchiErrore++; segna("attacchiErrore"); }
        else if (e.value === "Blocked") { v.attacchiMurati++; segna("attacchiMurati"); }
        break;
      case "S":
        v.battute++; segna("battute");
        if (e.value === "Point") { v.ace++; v.punti++; segna("ace"); segna("punti"); }
        else if (e.value === "Error") { v.erroriServizio++; segna("erroriServizio"); }
        break;
      case "B":
        if (e.value === "Point") { v.muriPunto++; v.punti++; segna("muriPunto"); segna("punti"); }
        break;
      case "R":
        v.ricezioni++; segna("ricezioni");
        if (e.value === "Error") { v.erroriRicezione++; segna("erroriRicezione"); }
        break;
      case "D":
        v.difese++; segna("difese");
        if (e.value === "Error") { v.erroriDifesa++; segna("erroriDifesa"); }
        break;
      case "E":
        v.alzate++; segna("alzate");
        break;
    }
  }

  const voci = [...per.values()].map(({ v }) => {
    v.efficienzaAttacco = pct(v.attacchiPunto - v.attacchiErrore - v.attacchiMurati, v.attacchi);
    return v;
  });

  // Chi ha inciso di piu, non chi ha toccato di piu.
  voci.sort((a, b) => b.punti - a.punti || b.tocchi - a.tocchi);

  return { voci, tocchiSenzaGiocatore: senzaGiocatore, tocchiTotali: base.length };
}

/** Gli indici degli eventi dietro una singola voce, per l'explainability. */
export function indiciGiocatore(
  ev: IndexedEvent[], team: "h" | "a", jersey: number, chiave: string, f: EventFilter = {},
): number[] {
  const base = select(ev, { ...f, team, jersey, soloGiocatoriNoti: true });
  const per: Record<string, (e: IndexedEvent) => boolean> = {
    tocchi: () => true,
    punti: (e) => e.value === "Point" && ["A", "S", "B"].includes(e.skill),
    attacchi: (e) => e.skill === "A",
    attacchiPunto: (e) => e.skill === "A" && e.value === "Point",
    attacchiErrore: (e) => e.skill === "A" && e.value === "Error",
    attacchiMurati: (e) => e.skill === "A" && e.value === "Blocked",
    battute: (e) => e.skill === "S",
    ace: (e) => e.skill === "S" && e.value === "Point",
    erroriServizio: (e) => e.skill === "S" && e.value === "Error",
    muriPunto: (e) => e.skill === "B" && e.value === "Point",
    ricezioni: (e) => e.skill === "R",
    erroriRicezione: (e) => e.skill === "R" && e.value === "Error",
    difese: (e) => e.skill === "D",
    erroriDifesa: (e) => e.skill === "D" && e.value === "Error",
    alzate: (e) => e.skill === "E",
  };
  const p = per[chiave] ?? (() => false);
  return base.filter(p).map((e) => e.idx);
}
