import type { AnalysisEvent, AnalysisPackage, Skill, EventValue } from "@vv/schema";

/**
 * REGOLA NON NEGOZIABILE (docs/01-architettura.md):
 * ogni numero nasce da un INSIEME DI EVENTI, mai da un contatore.
 * Filtri, explainability, playlist e montaggi sono innesti su questa base.
 */

export interface EventFilter {
  set?: number;
  team?: "h" | "a";
  skill?: Skill | Skill[];
  value?: EventValue | EventValue[] | null;
  jersey?: number;
  /** Progressione: solo eventi fino a questo fotogramma incluso. */
  untilFrame?: number;
  /** Esclude gli eventi il cui giocatore il fornitore non ha riconosciuto. */
  soloGiocatoriNoti?: boolean;
}

export type IndexedEvent = AnalysisEvent;

export function eventiDi(pkg: AnalysisPackage): IndexedEvent[] {
  return pkg.events;
}

const arr = <T,>(v: T | T[] | undefined | null): T[] | undefined =>
  v === undefined ? undefined : v === null ? undefined : Array.isArray(v) ? v : [v];

export function select(events: IndexedEvent[], f: EventFilter = {}): IndexedEvent[] {
  const skills = arr(f.skill);
  const values = arr(f.value);
  return events.filter((e) =>
    (f.set === undefined || e.set === f.set) &&
    (f.team === undefined || e.team === f.team) &&
    (skills === undefined || skills.includes(e.skill)) &&
    (f.value === undefined || (values ? (e.value !== null && values.includes(e.value)) : true)) &&
    (f.jersey === undefined || e.jersey === f.jersey) &&
    (f.untilFrame === undefined || e.frame <= f.untilFrame) &&
    (!f.soloGiocatoriNoti || !e.jerseyIgnoto)
  );
}
