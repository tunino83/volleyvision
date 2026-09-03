import { z } from "zod";
import {
  Email, Id, JerseyNumber, LIMITS, MatchStatus, Password, PersonName,
  PlayerRole, Role, Season, Tag, TeamSide, UserStatus, VideoStatus,
} from "./common";

// --------------------------------------------------------------- utenti
export const RegisterInput = z.object({
  nome: PersonName,
  cognome: PersonName,
  email: Email,
  password: Password,
  privacyAccettata: z.literal(true, {
    errorMap: () => ({ message: "L'informativa deve essere accettata" }),
  }),
});
export type RegisterInput = z.infer<typeof RegisterInput>;

export const LoginInput = z.object({ email: Email, password: z.string().min(1) });
export type LoginInput = z.infer<typeof LoginInput>;

export const UserDto = z.object({
  id: Id, email: z.string(), nome: z.string(), cognome: z.string(),
  ruolo: Role, stato: UserStatus,
  emailVerificataIl: z.string().nullable(),
  creatoIl: z.string(),
  ultimoAccesso: z.string().nullable(),
});
export type UserDto = z.infer<typeof UserDto>;

// --------------------------------------------------------------- persone
export const PersonInput = z.object({
  cognome: PersonName,
  nome: PersonName,
  dataNascita: z.string().nullable().optional(),
});
export type PersonInput = z.infer<typeof PersonInput>;

// --------------------------------------------------------------- squadre
/**
 * Creazione di un'utenza da parte dell'amministratore. **Nessuna password**:
 * la sceglie l'interessato aprendo il collegamento che riceve. Chi crea
 * l'utenza non deve mai conoscere la password di nessuno.
 */
export const InvitoUtenteInput = z.object({
  nome: PersonName,
  cognome: PersonName,
  email: Email,
  ruolo: Role.default("utente"),
});
export type InvitoUtenteInput = z.infer<typeof InvitoUtenteInput>;

/** Modifica dell'anagrafica di un'utenza da parte dell'amministratore. */
export const ModificaUtenteInput = z.object({
  nome: PersonName.optional(),
  cognome: PersonName.optional(),
  email: Email.optional(),
});
export type ModificaUtenteInput = z.infer<typeof ModificaUtenteInput>;

/** Il proprio profilo. L'email non si cambia da qui: cambierebbe l'identita. */
export const ProfiloInput = z.object({
  nome: PersonName,
  cognome: PersonName,
});
export type ProfiloInput = z.infer<typeof ProfiloInput>;

export const CambioPasswordInput = z.object({
  attuale: z.string().min(1, "Indica la password attuale"),
  nuova: Password,
});
export type CambioPasswordInput = z.infer<typeof CambioPasswordInput>;

/** Correzione di un giocatore nel roster di una squadra. */
export const ModificaGiocatoreSquadraInput = z.object({
  numeroMaglia: JerseyNumber.optional(),
  cognome: PersonName.optional(),
  nome: PersonName.optional(),
  ruolo: PlayerRole.nullable().optional(),
  libero: z.boolean().optional(),
  personId: Id.nullable().optional(),
});
export type ModificaGiocatoreSquadraInput = z.infer<typeof ModificaGiocatoreSquadraInput>;

/**
 * Gli stili di avatar offerti. Sono un sottoinsieme scelto della libreria:
 * quelli che reggono a 64 px e che non stonano accanto a un tabellino.
 */
export const AVATAR_STILI = [
  "adventurer", "personas", "notionists", "open-peeps",
  "micah", "avataaars", "big-smile", "lorelei",
] as const;
export const AvatarStile = z.enum(AVATAR_STILI);
export type AvatarStile = z.infer<typeof AvatarStile>;

/** L'avatar di una persona: stile e seme. Nessun file, nessun caricamento. */
export const AvatarInput = z.object({
  avatarStile: AvatarStile.nullable(),
  avatarSeme: z.string().trim().min(1).max(64).nullable(),
});
export type AvatarInput = z.infer<typeof AvatarInput>;

/**
 * FUNZIONI ATTIVABILI
 *
 * Cose che esistono nel codice ma non sono in esercizio. **Il valore lo
 * decide il server** e i client lo chiedono a `/api/version`: due bandiere
 * indipendenti, una per lato, prima o poi divergono — e si finisce con un
 * pulsante che c'e e una rotta che rifiuta.
 *
 * `fotoPersone` — le fotografie al posto degli avatar disegnati. Spenta:
 * sono dati personali, spesso di minori nella pallavolo giovanile, e prima
 * servono informativa e consenso. Il codice resta, funzionante e provato.
 */
export interface Funzioni { fotoPersone: boolean }
export const FUNZIONI_PREDEFINITE: Funzioni = { fotoPersone: false };

/**
 * La fotografia di una persona, gia ritagliata dal client.
 *
 * Arriva come `data:` URI perche a questa dimensione (~20 KB) non vale la
 * pena di un caricamento a blocchi: quello serve ai video da gigabyte.
 *
 * **Il ritaglio e il ridimensionamento li fa il client**, non il server. Non
 * per pigrizia: mandare al server 8 MB di foto da telefono per poi ridurli a
 * 20 KB significherebbe far pagare all'utente il trasferimento di 8 MB. Il
 * limite qui sotto e la rete di sicurezza, non il meccanismo.
 */
export const FOTO_PERSONA_MAX_BYTE = 300 * 1024;
export const FOTO_TIPI = ["image/jpeg", "image/png", "image/webp"] as const;

export const FotoPersonaInput = z.object({
  /** `data:image/jpeg;base64,...` */
  dataUri: z.string()
    .regex(/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/,
           "Formato non riconosciuto: sono ammessi JPEG, PNG e WebP")
    // base64 cresce di un terzo: si confronta sul peso vero dei byte.
    .refine((v) => (v.length - v.indexOf(",") - 1) * 3 / 4 <= FOTO_PERSONA_MAX_BYTE,
            `L'immagine supera ${Math.round(FOTO_PERSONA_MAX_BYTE / 1024)} KB`),
});
export type FotoPersonaInput = z.infer<typeof FotoPersonaInput>;

export const TeamInput = z.object({
  nome: z.string().trim().min(2).max(80),
  stagione: Season,
});
export type TeamInput = z.infer<typeof TeamInput>;

export const TeamPlayerInput = z.object({
  numeroMaglia: JerseyNumber,
  cognome: PersonName,
  nome: PersonName,
  ruolo: PlayerRole.nullable().optional(),
  libero: z.boolean().default(false),
  /** Collegamento alla persona: senza, niente statistiche cross-partita. */
  personId: Id.nullable().optional(),
});
export type TeamPlayerInput = z.infer<typeof TeamPlayerInput>;

export const TeamRosterInput = z.object({
  giocatori: z.array(TeamPlayerInput).max(LIMITS.maxTeamPlayers),
}).superRefine((v, ctx) => {
  const nums = v.giocatori.map((g) => g.numeroMaglia);
  const dup = nums.filter((n, i) => nums.indexOf(n) !== i);
  if (dup.length) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["giocatori"],
      message: `Numero di maglia duplicato: ${[...new Set(dup)].join(", ")}` });
  }
  if (v.giocatori.filter((g) => g.libero).length > 2) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["giocatori"],
      message: "Al massimo due liberi per squadra" });
  }
});
export type TeamRosterInput = z.infer<typeof TeamRosterInput>;

// ----------------------------------------------------------- campionati
export const CompetitionInput = z.object({
  nome: z.string().trim().min(2).max(80),
  stagione: Season,
  descrizione: z.string().max(500).nullable().optional(),
  dataInizio: z.string().nullable().optional(),
  dataFine: z.string().nullable().optional(),
}).superRefine((v, ctx) => {
  if (v.dataInizio && v.dataFine && new Date(v.dataFine) < new Date(v.dataInizio)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["dataFine"],
      message: "La data di fine deve seguire quella di inizio" });
  }
});
export type CompetitionInput = z.infer<typeof CompetitionInput>;

export const ShareInput = z.object({ email: Email });
export type ShareInput = z.infer<typeof ShareInput>;

// -------------------------------------------------------------- partite
export const MatchInput = z.object({
  competitionId: Id,
  homeTeamId: Id,
  awayTeamId: Id,
  data: z.string(),
  citta: z.string().max(80).nullable().optional(),
  campo: z.string().max(80).nullable().optional(),
  arbitri: z.string().max(160).nullable().optional(),
  tag: z.array(Tag).max(LIMITS.maxTags).default([]),
}).superRefine((v, ctx) => {
  if (v.homeTeamId === v.awayTeamId) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["awayTeamId"],
      message: "Le due squadre devono essere diverse" });
  }
});
export type MatchInput = z.infer<typeof MatchInput>;

export const MatchPlayerInput = z.object({
  lato: TeamSide,
  numeroMaglia: JerseyNumber,
  cognome: PersonName,
  nome: PersonName,
  ruolo: PlayerRole.nullable().optional(),
  libero: z.boolean().default(false),
  capitano: z.boolean().default(false),
  personId: Id.nullable().optional(),
});
export type MatchPlayerInput = z.infer<typeof MatchPlayerInput>;

/** Quanti set ha avuto la partita: da tre a cinque. */
export const NumeroSetInput = z.object({
  numeroSet: z.number().int().min(3).max(LIMITS.maxSets),
});
export type NumeroSetInput = z.infer<typeof NumeroSetInput>;

/**
 * Aggiunta di un singolo giocatore al roster della partita, dal selettore
 * delle formazioni. Se `salvaInSquadra` e vero il giocatore entra anche nel
 * roster della squadra, cosi la volta dopo c'e gia.
 */
export const AggiungiGiocatoreInput = MatchPlayerInput.extend({
  salvaInSquadra: z.boolean().default(true),
});
export type AggiungiGiocatoreInput = z.infer<typeof AggiungiGiocatoreInput>;

/**
 * Correzione di un giocatore gia inserito. `lato` non c'e: spostare un
 * giocatore da una squadra all'altra non e una correzione, e un altro
 * giocatore. Tutti i campi sono facoltativi: si manda solo cio che cambia.
 */
export const ModificaGiocatoreInput = z.object({
  numeroMaglia: JerseyNumber.optional(),
  cognome: PersonName.optional(),
  nome: PersonName.optional(),
  ruolo: PlayerRole.nullable().optional(),
  libero: z.boolean().optional(),
  capitano: z.boolean().optional(),
  personId: Id.nullable().optional(),
}).refine((v) => Object.keys(v).length > 0, { message: "Nessuna modifica indicata" });
export type ModificaGiocatoreInput = z.infer<typeof ModificaGiocatoreInput>;

export const MatchRosterInput = z.object({
  giocatori: z.array(MatchPlayerInput),
}).superRefine((v, ctx) => {
  for (const lato of ["h", "a"] as const) {
    const g = v.giocatori.filter((x) => x.lato === lato);
    if (g.length > LIMITS.maxMatchPlayers) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["giocatori"],
        message: `Massimo ${LIMITS.maxMatchPlayers} giocatori per squadra` });
    }
    const nums = g.map((x) => x.numeroMaglia);
    const dup = nums.filter((n, i) => nums.indexOf(n) !== i);
    if (dup.length) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["giocatori"],
        message: `Numero duplicato nella squadra ${lato}: ${[...new Set(dup)].join(", ")}` });
    }
    if (g.filter((x) => x.capitano).length > 1) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["giocatori"],
        message: `Un solo capitano per squadra` });
    }
  }
});
export type MatchRosterInput = z.infer<typeof MatchRosterInput>;

/**
 * Formazione di un set: sei posizioni piu i liberi.
 * Obbligatoria per il set 1 prima del caricamento: e un dato di ingresso
 * per l'analisi automatica, non una comodita dell'interfaccia.
 */
export const LineupInput = z.object({
  lato: TeamSide,
  pos1: JerseyNumber.nullable(), pos2: JerseyNumber.nullable(),
  pos3: JerseyNumber.nullable(), pos4: JerseyNumber.nullable(),
  pos5: JerseyNumber.nullable(), pos6: JerseyNumber.nullable(),
  libero1: JerseyNumber.nullable().optional(),
  libero2: JerseyNumber.nullable().optional(),
  primoServizio: z.boolean().default(false),
}).superRefine((v, ctx) => {
  const pos = [v.pos1, v.pos2, v.pos3, v.pos4, v.pos5, v.pos6].filter((n): n is number => n !== null);
  const dup = pos.filter((n, i) => pos.indexOf(n) !== i);
  if (dup.length) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["pos1"],
      message: `Lo stesso giocatore occupa piu posizioni: ${[...new Set(dup)].join(", ")}` });
  }
});
export type LineupInput = z.infer<typeof LineupInput>;

export function lineupCompleta(l: { pos1: number | null; pos2: number | null; pos3: number | null;
                                    pos4: number | null; pos5: number | null; pos6: number | null }) {
  return [l.pos1, l.pos2, l.pos3, l.pos4, l.pos5, l.pos6].every((p) => p !== null);
}

export const SubstitutionInput = z.object({
  set: z.number().int().min(1).max(LIMITS.maxSets),
  lato: TeamSide,
  esce: JerseyNumber,
  entra: JerseyNumber,
  /** Riferimento al fotogramma; su web si inserisce il minuto e si converte. */
  frame: z.number().int().min(0).nullable().optional(),
  minuto: z.number().int().min(0).nullable().optional(),
}).superRefine((v, ctx) => {
  if (v.esce === v.entra) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["entra"],
      message: "Il giocatore entrante deve essere diverso da quello uscente" });
  }
  if (v.frame == null && v.minuto == null) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["minuto"],
      message: "Indicare il momento del cambio" });
  }
});
export type SubstitutionInput = z.infer<typeof SubstitutionInput>;

// ----------------------------------------------------------- caricamento
export const UploadSessionInput = z.object({
  nomeFile: z.string().min(1).max(255),
  dimensione: z.number().int().positive().max(LIMITS.maxVideoBytes),
  mime: z.string().min(1),
});
export type UploadSessionInput = z.infer<typeof UploadSessionInput>;

export const UploadCompleteInput = z.object({
  uploadId: Id,
  dimensione: z.number().int().positive(),
  checksum: z.string().nullable().optional(),
});
export type UploadCompleteInput = z.infer<typeof UploadCompleteInput>;

export const VideoDto = z.object({
  lato: z.number(),
  stato: VideoStatus,
  nomeFile: z.string().nullable(),
  dimensione: z.number().nullable(),
  caricatoIl: z.string().nullable(),
});
export type VideoDto = z.infer<typeof VideoDto>;

export const MatchDto = z.object({
  id: Id,
  data: z.string(),
  stato: MatchStatus,
  competition: z.object({ id: Id, nome: z.string(), stagione: z.string() }),
  home: z.object({ id: Id, nome: z.string() }),
  away: z.object({ id: Id, nome: z.string() }),
  tag: z.array(z.string()),
  video: z.array(VideoDto),
  revisioneAnalisi: z.number().nullable(),
});
export type MatchDto = z.infer<typeof MatchDto>;
