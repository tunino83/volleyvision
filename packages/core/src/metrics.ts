import { select, type EventFilter, type IndexedEvent } from "./select";

/**
 * I sette indicatori della versione 1.
 * Ogni metrica restituisce il valore E l'insieme di eventi che lo compone:
 * e cio che rendera gratuita l'explainability.
 */

export interface Metric {
  chiave: string;
  etichetta: string;
  casa: number;
  ospite: number;
  eventiCasa: IndexedEvent[];
  eventiOspite: IndexedEvent[];
  formato: "intero" | "percentuale";
}

function conta(ev: IndexedEvent[], f: EventFilter, chiave: string, etichetta: string): Metric {
  const c = select(ev, { ...f, team: "h" });
  const o = select(ev, { ...f, team: "a" });
  return { chiave, etichetta, casa: c.length, ospite: o.length,
           eventiCasa: c, eventiOspite: o, formato: "intero" };
}

export function kills(ev: IndexedEvent[], f: EventFilter = {}) {
  return conta(ev, { ...f, skill: "A", value: "Point" }, "kills", "Attacchi punto");
}
export function erroriAttacco(ev: IndexedEvent[], f: EventFilter = {}) {
  return conta(ev, { ...f, skill: "A", value: "Error" }, "erroriAttacco", "Errori di attacco");
}
export function ace(ev: IndexedEvent[], f: EventFilter = {}) {
  return conta(ev, { ...f, skill: "S", value: "Point" }, "ace", "Ace");
}
export function erroriServizio(ev: IndexedEvent[], f: EventFilter = {}) {
  return conta(ev, { ...f, skill: "S", value: "Error" }, "erroriServizio", "Errori al servizio");
}
export function muri(ev: IndexedEvent[], f: EventFilter = {}) {
  return conta(ev, { ...f, skill: "B", value: "Point" }, "muri", "Muri punto");
}

/** (attacchi punto - errori) / totale attacchi. */
export function percentualeAttacco(ev: IndexedEvent[], f: EventFilter = {}): Metric {
  const calc = (t: "h" | "a") => {
    const tutti = select(ev, { ...f, team: t, skill: "A" });
    const k = select(ev, { ...f, team: t, skill: "A", value: "Point" }).length;
    const e = select(ev, { ...f, team: t, skill: "A", value: "Error" }).length;
    return { pct: tutti.length ? Math.round(((k - e) / tutti.length) * 100) : 0, tutti };
  };
  const c = calc("h"), o = calc("a");
  return { chiave: "percentualeAttacco", etichetta: "Percentuale di attacco",
           casa: c.pct, ospite: o.pct, eventiCasa: c.tutti, eventiOspite: o.tutti,
           formato: "percentuale" };
}

/**
 * Attacchi murati: NON sono errori.
 *
 * Il fornitore distingue `Blocked` da `Error`, e la distinzione conta: un
 * attacco murato e merito del muro avversario, un errore e demerito di chi
 * attacca. Metterli insieme cancella l'informazione piu utile del fondamentale.
 */
export function attacchiMurati(ev: IndexedEvent[], f: EventFilter = {}) {
  return conta(ev, { ...f, skill: "A", value: "Blocked" }, "attacchiMurati", "Attacchi murati");
}

/**
 * Efficienza in attacco: (punto - errore - murato) / totale.
 *
 * E la formula usata nella pallavolo, e differisce da `percentualeAttacco`
 * perche **sottrae anche i murati**. Le due convivono di proposito: la prima
 * dice quanto rende l'attacco, la seconda quanto e pulito.
 */
export function efficienzaAttacco(ev: IndexedEvent[], f: EventFilter = {}): Metric {
  const calc = (t: "h" | "a") => {
    const tutti = select(ev, { ...f, team: t, skill: "A" });
    const p = select(ev, { ...f, team: t, skill: "A", value: "Point" }).length;
    const e = select(ev, { ...f, team: t, skill: "A", value: "Error" }).length;
    const m = select(ev, { ...f, team: t, skill: "A", value: "Blocked" }).length;
    return { pct: tutti.length ? Math.round(((p - e - m) / tutti.length) * 100) : 0, tutti };
  };
  const c = calc("h"), o = calc("a");
  return { chiave: "efficienzaAttacco", etichetta: "Efficienza in attacco",
           casa: c.pct, ospite: o.pct, eventiCasa: c.tutti, eventiOspite: o.tutti,
           formato: "percentuale" };
}

/** Punti realizzati: attacchi punto + ace + muri. Il totale che decide la partita. */
export function puntiRealizzati(ev: IndexedEvent[], f: EventFilter = {}): Metric {
  const calc = (t: "h" | "a") =>
    select(ev, { ...f, team: t, value: "Point" }).filter((e) => ["A", "S", "B"].includes(e.skill));
  const c = calc("h"), o = calc("a");
  return { chiave: "puntiRealizzati", etichetta: "Punti realizzati",
           casa: c.length, ospite: o.length, eventiCasa: c, eventiOspite: o,
           formato: "intero" };
}

export function ricezioni(ev: IndexedEvent[], f: EventFilter = {}) {
  return conta(ev, { ...f, skill: "R" }, "ricezioni", "Ricezioni");
}
export function erroriRicezione(ev: IndexedEvent[], f: EventFilter = {}) {
  return conta(ev, { ...f, skill: "R", value: "Error" }, "erroriRicezione", "Errori in ricezione");
}
export function difese(ev: IndexedEvent[], f: EventFilter = {}) {
  return conta(ev, { ...f, skill: "D" }, "difese", "Difese");
}
export function erroriDifesa(ev: IndexedEvent[], f: EventFilter = {}) {
  return conta(ev, { ...f, skill: "D", value: "Error" }, "erroriDifesa", "Errori in difesa");
}

/**
 * Gli indicatori, raggruppati per fondamentale.
 *
 * Il raggruppamento non e ornamento: sedici numeri in fila non si leggono,
 * gli stessi sedici divisi per attacco, servizio, muro e ricezione si.
 */
export interface GruppoMetriche { chiave: string; titolo: string; metriche: Metric[] }

export const METRICHE = [kills, erroriAttacco, percentualeAttacco, ace, erroriServizio, muri];

export function riepilogoPerGruppi(ev: IndexedEvent[], f: EventFilter = {}): GruppoMetriche[] {
  return [
    { chiave: "sintesi", titolo: "Sintesi",
      metriche: [puntiRealizzati(ev, f)] },
    { chiave: "attacco", titolo: "Attacco",
      metriche: [kills(ev, f), erroriAttacco(ev, f), attacchiMurati(ev, f),
                 efficienzaAttacco(ev, f), percentualeAttacco(ev, f)] },
    { chiave: "servizio", titolo: "Servizio",
      metriche: [ace(ev, f), erroriServizio(ev, f)] },
    { chiave: "muro", titolo: "Muro",
      metriche: [muri(ev, f)] },
    { chiave: "ricezioneDifesa", titolo: "Ricezione e difesa",
      metriche: [ricezioni(ev, f), erroriRicezione(ev, f), difese(ev, f), erroriDifesa(ev, f)] },
  ];
}

export function riepilogo(ev: IndexedEvent[], f: EventFilter = {}): Metric[] {
  return METRICHE.map((fn) => fn(ev, f));
}

export interface Realizzatore { team: "h" | "a"; jersey: number; punti: number; eventi: IndexedEvent[] }

/** Punti = attacchi punto + ace + muri punto, per giocatore riconosciuto. */
export function miglioriRealizzatori(ev: IndexedEvent[], f: EventFilter = {}, limite = 3): Realizzatore[] {
  const punti = select(ev, { ...f, value: "Point", soloGiocatoriNoti: true })
    .filter((e) => ["A", "S", "B"].includes(e.skill));
  const per = new Map<string, Realizzatore>();
  for (const e of punti) {
    if (e.jersey === null) continue;
    const k = `${e.team}-${e.jersey}`;
    const cur = per.get(k) ?? { team: e.team, jersey: e.jersey, punti: 0, eventi: [] };
    cur.punti += 1; cur.eventi.push(e);
    per.set(k, cur);
  }
  return [...per.values()].sort((a, b) => b.punti - a.punti).slice(0, limite);
}
