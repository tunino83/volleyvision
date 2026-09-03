import { z } from "zod";

/**
 * FORMATO CANONICO verso i client.
 *
 * E l'unico che le applicazioni conoscono. Il backend converte qui dentro
 * qualunque cosa arrivi dal fornitore (`fornitore.ts`), cosi un cambio di
 * formato tocca un modulo solo.
 *
 * Differenze volute rispetto all'ingresso:
 *  - gli eventi sono appiattiti e indicizzati, non annidati in tre livelli
 *  - i numeri di maglia segnaposto sono marcati, non nascosti
 *  - i confini dei set sono ricalcolati: quelli del fornitore sono inaffidabili
 *  - ogni pacchetto porta con se un giudizio sulla propria qualita
 */

export const Skill = z.enum(["S", "R", "E", "A", "D", "B", "C", "F", "0", "X"]);
export type Skill = z.infer<typeof Skill>;

export const SkillLabel: Record<Skill, string> = {
  S: "Battuta", R: "Ricezione", E: "Alzata", A: "Attacco", D: "Difesa",
  B: "Muro", C: "Copertura", F: "Free ball", "0": "Palla a terra", X: "Altro",
};

export const EventValue = z.enum(["Point", "Error", "Blocked"]);
export type EventValue = z.infer<typeof EventValue>;

export const AnalysisEvent = z.object({
  /** Progressivo assegnato da noi: il fornitore non fornisce identificativi. */
  idx: z.number().int(),
  set: z.number().int(),
  actionIdx: z.number().int(),
  team: z.enum(["h", "a"]),
  /** Numero di maglia, oppure null se ignoto o segnaposto. */
  jersey: z.number().int().nullable(),
  /** Vero se il fornitore ha indicato un segnaposto invece di un giocatore. */
  jerseyIgnoto: z.boolean(),
  skill: Skill,
  value: EventValue.nullable(),
  frame: z.number().int(),
  jumping: z.boolean().nullable(),
});
export type AnalysisEvent = z.infer<typeof AnalysisEvent>;

export const AnalysisAction = z.object({
  idx: z.number().int(),
  set: z.number().int(),
  frameStart: z.number().int(),
  frameEnd: z.number().int(),
  /** Punteggio prima dell'azione. */
  hPt: z.number().int(),
  aPt: z.number().int(),
  winner: z.enum(["h", "a"]).nullable(),
  eventi: z.array(z.number().int()),   // indici in `events`
});
export type AnalysisAction = z.infer<typeof AnalysisAction>;

export const AnalysisSet = z.object({
  n: z.number().int(),
  hPt: z.number().int(),
  aPt: z.number().int(),
  frameStart: z.number().int(),
  frameEnd: z.number().int(),
  /** Vero se il confine e stato ricalcolato perche quello ricevuto era errato. */
  ricalcolato: z.boolean(),
});
export type AnalysisSet = z.infer<typeof AnalysisSet>;

/** Posizioni di un fotogramma, gia proiettate in metri. */
export const AnalysisFrame = z.object({
  f: z.number().int(),
  h: z.array(z.object({ n: z.number().int(), x: z.number(), y: z.number() })),
  a: z.array(z.object({ n: z.number().int(), x: z.number(), y: z.number() })),
});
export type AnalysisFrame = z.infer<typeof AnalysisFrame>;

/**
 * Giudizio sulla qualita del pacchetto.
 * Va mostrato all'utente: dichiarare i limiti del dato e parte del prodotto,
 * non un dettaglio tecnico. Vedi il confine di responsabilita in ../docs/08.
 */
export const QualitaAnalisi = z.object({
  eventiTotali: z.number().int(),
  eventiSenzaGiocatore: z.number().int(),
  percentualeSenzaGiocatore: z.number(),
  azioni: z.number().int(),
  puntiAttribuiti: z.number().int(),
  puntiDichiarati: z.number().int(),
  /** Punti dichiarati che nessun evento spiega. */
  puntiNonSpiegati: z.number().int(),
  confiniSetRicalcolati: z.number().int(),
  posizioniDisponibili: z.boolean(),
  pallaTracciata: z.boolean(),
  coperturaFotogrammi: z.number(),   // 0..1
  avvisi: z.array(z.string()),
});
export type QualitaAnalisi = z.infer<typeof QualitaAnalisi>;

export const AnalysisPackage = z.object({
  version: z.literal("vv-analysis-1.0.0"),
  matchId: z.string(),
  revision: z.number().int(),
  squadre: z.object({ h: z.string(), a: z.string() }),
  video: z.object({
    fps: z.number(),
    frameDelta: z.number().int(),
    /** Omografie per lato, se disponibili. */
    homography: z.object({
      side1: z.array(z.array(z.number())).nullable(),
      side2: z.array(z.array(z.number())).nullable(),
    }),
  }),
  sets: z.array(AnalysisSet),
  actions: z.array(AnalysisAction),
  events: z.array(AnalysisEvent),
  qualita: QualitaAnalisi,
});
export type AnalysisPackage = z.infer<typeof AnalysisPackage>;
