import { z } from "zod";

/** Ruoli applicativi. Vedi docs/08, cap. 3. */
export const Role = z.enum(["admin", "segreteria", "utente"]);
export type Role = z.infer<typeof Role>;

export const UserStatus = z.enum(["attivo", "sospeso"]);
export type UserStatus = z.infer<typeof UserStatus>;

/**
 * Ciclo di vita della partita. Macchina a stati unica: la versione a tre
 * stati (EMPTY/PROCESSING/READY) e solo una vista aggregata per l'interfaccia.
 */
export const MatchStatus = z.enum([
  "WAITING",       // mancano uno o entrambi i video
  "PENDING",       // video completi, analisi in coda
  "RUNNING",       // analisi in corso presso il fornitore
  "READY_FOR_PP",  // visione conclusa, dati in preparazione
  "READY",         // dati disponibili
  "ERROR",         // analisi fallita
]);
export type MatchStatus = z.infer<typeof MatchStatus>;

/** Vista aggregata mostrata all'utente. */
export function aggregateStatus(s: MatchStatus): "EMPTY" | "PROCESSING" | "READY" | "ERROR" {
  if (s === "WAITING") return "EMPTY";
  if (s === "READY") return "READY";
  if (s === "ERROR") return "ERROR";
  return "PROCESSING";
}

export const TeamSide = z.enum(["h", "a"]);
export type TeamSide = z.infer<typeof TeamSide>;

export const VideoSide = z.union([z.literal(1), z.literal(2)]);
export type VideoSide = z.infer<typeof VideoSide>;

export const VideoStatus = z.enum(["ASSENTE", "IN_CARICAMENTO", "CARICATO", "NORMALIZZATO", "ERRORE"]);
export type VideoStatus = z.infer<typeof VideoStatus>;

export const PlayerRole = z.enum(["palleggiatore", "opposto", "schiacciatore", "centrale", "libero"]);
export type PlayerRole = z.infer<typeof PlayerRole>;

/** Limiti dichiarati. Vedi docs/08, cap. 10. */
export const LIMITS = {
  maxVideoBytes: 5 * 1024 * 1024 * 1024,   // ~5 GB — stima indicativa
  maxVideoDurationHours: 4,
  videosPerMatch: 2,
  maxTeamPlayers: 40,
  maxMatchPlayers: 20,
  maxSets: 5,
  maxTags: 20,
  maxTagLength: 40,
  uploadSessionTtlDays: 7,
  acceptedMime: ["video/mp4", "video/quicktime", "video/x-matroska", "video/x-msvideo"],
} as const;

export const Id = z.string().min(1);
export const Email = z.string().email().max(254).transform((v) => v.toLowerCase());
export const Password = z.string().min(10, "Almeno 10 caratteri");
export const PersonName = z.string().trim().min(2).max(60);
export const JerseyNumber = z.number().int().min(0).max(99);
export const Season = z.string().regex(/^\d{4}(\/\d{4})?$/, "Formato atteso: 2026 oppure 2026/2027");
export const Tag = z.string().trim().min(1).max(LIMITS.maxTagLength).transform((v) => v.toLowerCase());

/**
 * Paginazione, uguale su tutti gli elenchi.
 *
 * `perPagina` ha un tetto: senza, una richiesta con `perPagina=1000000`
 * scarica l'intero archivio e mette in ginocchio il server.
 */
export const PAGINAZIONE = { perPaginaPredefinito: 25, perPaginaMassimo: 100 } as const;

export interface Pagina<T> {
  elementi: T[];
  totale: number;
  pagina: number;
  perPagina: number;
  /** Calcolato dal server: il client non deve rifare la divisione. */
  pagine: number;
}

/**
 * COSA SI PUO FARE, DATO LO STATO.
 *
 * Una sola dichiarazione per tutto il sistema: il server la usa per rifiutare,
 * il client per non mostrare. Prima non esisteva e ogni schermata decideva per
 * conto suo — cosi una partita gia analizzata continuava a chiedere quanti set
 * avesse avuto e a offrire il caricamento dei video.
 *
 * Il principio: **cio che e stato mandato all'analisi non si tocca piu.** Da
 * `PENDING` in avanti roster, formazioni e video sono i dati di ingresso di un
 * calcolo gia partito; cambiarli renderebbe i risultati non spiegabili.
 *
 * L'eccezione sono le SOSTITUZIONI, che per progetto si registrano dopo,
 * leggendo il referto (docs/08, S-21): non entrano nell'analisi, servono a
 * sapere chi era in campo.
 */
export interface CapacitaPartita {
  modificaDatiPartita: boolean;
  modificaRoster: boolean;
  modificaFormazioni: boolean;
  /** Include il numero di set dichiarato. */
  modificaNumeroSet: boolean;
  registraCambi: boolean;
  caricaVideo: boolean;
  vediStatistiche: boolean;
  eliminaPartita: boolean;
  /** Perche non si puo piu modificare: da mostrare all'utente. */
  motivoBlocco: string | null;
}

/**
 * Cosa si puo fare su una partita.
 *
 * Due vincoli distinti, sovrapposti: lo **stato** (cio che e stato mandato
 * all'analisi non si tocca piu) e la **proprieta** (le condivisioni sono in
 * sola lettura). Stanno insieme qui perche l'interfaccia deve fare una
 * domanda sola: chi li tenesse separati finirebbe per controllarne uno e
 * dimenticare l'altro in qualche schermata.
 *
 * `proprietario` non passato significa "non lo so": si assume di si, che e
 * il comportamento di prima e non rompe chi non lo fornisce ancora.
 */
export function capacitaPartita(stato: MatchStatus,
                                proprietario: boolean = true): CapacitaPartita {
  const inLavorazione = stato === "PENDING" || stato === "RUNNING" || stato === "READY_FOR_PP";
  const conclusa = stato === "READY";

  // Aperta: prima dell'invio, o dopo un errore (che si corregge e si riprova).
  const aperta = stato === "WAITING" || stato === "ERROR";

  // Su una partita altrui si guarda e basta: `AccessService` rifiuta ogni
  // scrittura prima ancora di controllare le condivisioni.
  const p = proprietario;

  return {
    modificaDatiPartita: p && !inLavorazione,
    modificaRoster: p && aperta,
    modificaFormazioni: p && aperta,
    modificaNumeroSet: p && aperta,
    // I cambi si registrano sempre: non sono un dato di ingresso. Ma su una
    // partita altrui nemmeno quelli.
    registraCambi: p,
    caricaVideo: p && aperta,
    // Le statistiche sono lettura: si vedono anche se la partita non e tua.
    vediStatistiche: conclusa,
    eliminaPartita: p && !inLavorazione,
    motivoBlocco:
      !p ? "Questa partita e condivisa con te: puoi consultarla, non modificarla."
      : inLavorazione ? "L'analisi e in corso su questi dati: non si modificano finche non finisce."
      : conclusa ? "L'analisi e stata fatta su questi dati: modificarli renderebbe i risultati non spiegabili."
      : null,
  };
}

/** Errore uniforme. Vedi docs/09, 2.6. */
export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, string[]>;
  correlationId?: string;
}
