export const CONFIG = {
  jwtSecret: process.env.JWT_SECRET ?? "sviluppo-non-sicuro",
  accessTtl: process.env.JWT_ACCESS_TTL ?? "15m",
  refreshTtlDays: 30,
  storageDriver: process.env.STORAGE_DRIVER ?? "local",
  storageLocalDir: process.env.STORAGE_LOCAL_DIR ?? "./storage-dev",
  maxVideoBytes: Number(process.env.MAX_VIDEO_BYTES ?? 5 * 1024 * 1024 * 1024),
  chunkBytes: Number(process.env.UPLOAD_CHUNK_BYTES ?? 8 * 1024 * 1024),
  uploadTtlDays: Number(process.env.UPLOAD_SESSION_TTL_DAYS ?? 7),
  mailDriver: process.env.MAIL_DRIVER ?? "console",
  /**
   * `aperta`  chiunque puo registrarsi e riceve l'email di verifica
   * `invito`  ci si registra solo se un amministratore ha creato l'utenza
   * Risolve il punto aperto 7 di ../docs/01 senza scegliere per il cliente:
   * la modalita si cambia con una variabile, non con del codice.
   */
  registrazione: (process.env.REGISTRAZIONE ?? "aperta") as "aperta" | "invito",
  webUrl: process.env.WEB_URL ?? "http://localhost:5173",

  /**
   * Chi analizza i video: "simulato" finche il fornitore non e ingaggiato,
   * "esterno" quando lo sara. E l'unico interruttore da toccare.
   */
  fornitoreAnalisi: process.env.FORNITORE_ANALISI ?? "simulato",
  fornitoreUrl: process.env.FORNITORE_URL ?? "",
  fornitoreToken: process.env.FORNITORE_TOKEN ?? "",
  /** Quanto ci mette il simulatore a "elaborare". */
  simulaRitardoMs: Number(process.env.SIMULA_RITARDO_MINUTI ?? 5) * 60_000,
  /** Ogni quanto si chiede al fornitore se ha finito. */
  lavorazioneIntervalloMs: Number(process.env.LAVORAZIONE_INTERVALLO_SEC ?? 20) * 1000,
  /**
   * Ogni quanto si ripuliscono i caricamenti abbandonati. Un'ora e abbondante:
   * le sessioni vivono sette giorni, quindi non c'e nulla di urgente. A zero
   * si disattiva, per chi preferisce uno scheduler esterno.
   */
  /**
   * Funzioni presenti nel codice ma non in esercizio. Si accendono con una
   * variabile, non con una modifica: `FOTO_PERSONE=1`.
   */
  funzioni: {
    fotoPersone: process.env.FOTO_PERSONE === "1",
  },

  riconciliazioneIntervalloMs: Number(process.env.RICONCILIAZIONE_INTERVALLO_MIN ?? 60) * 60_000,
};
