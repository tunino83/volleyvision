import { z } from "zod";

/**
 * FORMATO DEL FORNITORE — cosi come arriva davvero.
 *
 * Ricavato dai file reali `events.json`, `frames.json`, `videos.json`
 * (VNL 2021, BUL-CHN). NON coincide con il PDF "Modello dati - VV":
 * le differenze sono elencate in `docs/07-dati-fornitore.md`.
 *
 * Questo file descrive l'INGRESSO. Il formato canonico verso i client sta
 * in `analysis.ts`: e l'adattatore del backend a convertire, cosi i client
 * non conoscono mai il formato del fornitore. Se il fornitore cambia, si
 * tocca solo questo file e l'adattatore.
 *
 * Tutto e permissivo per costruzione: quasi ogni campo puo essere nullo,
 * perche nei dati reali lo e.
 */

const n = z.number().nullable().optional();
const s = z.string().nullable().optional();

// --------------------------------------------------------------- videos
export const FornVideoLato = z.object({
  path: s,
  fps: z.number(),
  /** Matrici omografiche 3x3 per la proiezione pixel -> metri. */
  court: z.array(z.array(z.array(z.number()))).nullable().optional(),
  homography: z.array(z.array(z.number())).nullable().optional(),
});

export const FornVideos = z.object({
  version: z.literal("videos-1.0.0"),
  data: z.object({
    videos: z.object({
      id: s,
      side1: z.array(FornVideoLato),
      side2: z.array(FornVideoLato),
      /** Scarto in fotogrammi per allineare i due lati. Nei dati reali: 0. */
      frameDelta: z.number().nullable().optional(),
    }),
  }),
});
export type FornVideos = z.infer<typeof FornVideos>;

// --------------------------------------------------------------- events
export const FornEvento = z.object({
  id: s,
  t: z.enum(["h", "a"]),
  /** Numero di maglia. Puo essere nullo o un segnaposto (100, 1000, -6). */
  p: n,
  pId: s,
  s: z.string(),          // S R E A D B C F 0 X
  st: s,                  // sempre nullo nei dati reali
  v: s,                   // Point | Error | Blocked | null
  c: s,
  posS: z.any().nullable().optional(),
  posE: z.any().nullable().optional(),
  f: z.number(),          // fotogramma sul video 1
  speed: n,
  custom: z.any().nullable().optional(),
  prev: z.any().nullable().optional(),
  isAtk: z.any().nullable().optional(),
  isCtk: z.any().nullable().optional(),
  atkRec: z.any().nullable().optional(),
  atkSet: z.any().nullable().optional(),
  j: z.boolean().nullable().optional(),   // in salto
});
export type FornEvento = z.infer<typeof FornEvento>;

export const FornAzione = z.object({
  id: s,
  type: z.string(),       // "play" nei dati reali
  fS: z.number(),
  fE: z.number(),
  /** Contesto dell'azione: punteggio precedente, liberi, giocatori in campo. */
  data: z.object({
    hPt: z.number(), aPt: z.number(),
    hS: n, aS: n, hSP: n, aSP: n,
    hL1: n, hL2: n, aL1: n, aL2: n,
    hP: z.array(z.number()).nullable().optional(),
    /** Attenzione: si chiama `oP`, non `aP`. Incoerenza del fornitore. */
    oP: z.array(z.number()).nullable().optional(),
    w: s, s0: s,
    ptMax: n, ptMin: n,
  }).passthrough(),
  /**
   * ATTENZIONE: gli eventi stanno QUI, sull'azione.
   * Il PDF li collocava dentro `data`. I dati reali dicono altro.
   */
  events: z.array(FornEvento),
});
export type FornAzione = z.infer<typeof FornAzione>;

export const FornSet = z.object({
  id: s,
  n: z.number(),
  hP: z.array(z.number()).nullable().optional(),
  aP: z.array(z.number()).nullable().optional(),
  hSide: s, aSide: s,     // "left" | "right"
  hPt: z.number(), aPt: z.number(),
  w: s, s0: s,
  /** Attenzione: minuscola. A livello di partita e `fS`. */
  fs: z.number().nullable().optional(),
  fS: z.number().nullable().optional(),
  fE: z.number().nullable().optional(),
  actions: z.array(FornAzione),
});
export type FornSet = z.infer<typeof FornSet>;

export const FornEvents = z.object({
  version: z.literal("events-1.0.0"),
  data: z.object({
    match: z.object({
      id: s, vId: s, cId: s,
      hRef: s, aRef: s,     // "left" | "right", non riferimenti a squadre
      hT: s, aT: s,         // sigle: "BUL", "CHN"
      d: s,
      hWS: n, aWS: n,
      referee: s, city: s, court: s, scoutman: s,
      competition: s, season: s,
      /** Elenchi di numeri di maglia, non oggetti giocatore. */
      hP: z.array(z.number()).nullable().optional(),
      aP: z.array(z.number()).nullable().optional(),
      hCoach: s, aCoach: s,
      fS: n, fE: n,
      wT: s, wTref: s,
      hPartials: z.array(z.number()).nullable().optional(),
      aPartials: z.array(z.number()).nullable().optional(),
      hPt: n, aPt: n,
      sets: z.array(FornSet),
    }).passthrough(),
  }),
});
export type FornEvents = z.infer<typeof FornEvents>;

// --------------------------------------------------------------- frames
/**
 * Posizione di un giocatore in un fotogramma.
 * Nei dati reali `n` puo essere nullo e le coordinate possono contenere
 * valori nulli: rilevamenti senza numero riconosciuto o senza posizione.
 * L'adattatore li scarta contandoli.
 */
export const FornPosizione = z.object({
  n: z.number().nullable(),
  g1: z.array(z.number().nullable()).nullable().optional(),
  g2: z.array(z.number().nullable()).nullable().optional(),
});

export const FornFrame = z.object({
  f1: z.number(),
  /** Palla: mai valorizzata nei dati reali. */
  b: z.any().nullable().optional(),
  hP: z.array(FornPosizione).nullable().optional(),
  aP: z.array(FornPosizione).nullable().optional(),
});

export const FornFrames = z.object({
  version: z.literal("frames-1.0.0"),
  data: z.object({
    mId: z.any().nullable().optional(),
    frames: z.array(FornFrame),
  }),
});
export type FornFrames = z.infer<typeof FornFrames>;

/** Numeri di maglia che non identificano una persona reale. */
export const NUMERI_SEGNAPOSTO = new Set([100, 1000, 1001, 1002]);
export function maglieValida(p: number | null | undefined): p is number {
  return p != null && p >= 0 && p <= 99 && !NUMERI_SEGNAPOSTO.has(p);
}
