import type { PlatformCapabilities } from "./index";
import { creaTrasferimento } from "./trasferimento";
import * as inst from "./installazione";

/**
 * Implementazione per browser, desktop e mobile.
 *
 * `media` e `file` non sono supportati: nel web non si riproduce video e non
 * esistono pacchetti locali. Le viste corrispondenti non vengono registrate.
 *
 * Il caso mobile non e una piattaforma diversa: e lo stesso browser con
 * parametri diversi. Blocchi piu piccoli, e il trasferimento si ferma quando
 * l'applicazione esce dal primo piano. Quando arrivera la shell Capacitor
 * (Fase 2) erediterà questi stessi parametri: `docs/02b`.
 */

const MOBILE = typeof navigator !== "undefined"
  && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

/**
 * Dentro l'applicazione Android il caricamento lo fa un servizio nativo, e
 * continua a schermo spento (decisione 9b, rivista il 2026-09-04). Nel
 * browser no, e non e una dimenticanza: un browser non ha un servizio a cui
 * consegnare il lavoro.
 *
 * Si guarda il ponte Capacitor e non l'`userAgent`: dentro il guscio
 * l'`userAgent` e comunque quello di Android, e non distinguerebbe l'app dal
 * browser del telefono.
 */
const CON_SERVIZIO = typeof (globalThis as any).Capacitor !== "undefined"
  && (globalThis as any).Capacitor?.isNativePlatform?.() === true;

/** Il browser non espone sempre il tipo di connessione. Se tace, non si inventa. */
const conn = (): any =>
  typeof navigator !== "undefined" ? (navigator as any).connection ?? null : null;

export const browser: PlatformCapabilities = {
  nome: "browser",
  mobile: MOBILE,

  spazio: {
    async disponibile() {
      if (!navigator.storage?.estimate) return null;
      const s = await navigator.storage.estimate();
      return s.quota && s.usage ? s.quota - s.usage : null;
    },
  },

  file: { supportato: false },

  media: { supportato: false },

  rete: {
    aConsumo() {
      const c = conn();
      if (!c) return null;
      if (typeof c.saveData === "boolean" && c.saveData) return true;
      if (typeof c.type === "string") return c.type === "cellular";
      // `effectiveType` descrive la velocita, non il costo: non basta a
      // decidere. Meglio dichiarare di non sapere che sbagliare.
      return null;
    },
    tipo() {
      const c = conn();
      return c && typeof c.type === "string" ? c.type : null;
    },
  },

  installazione: {
    giaInstallata: inst.giaInstallata,
    installabile: inst.installabile,
    installazioneEsistente: inst.installazioneEsistente,
    installa: inst.installa,
    registraGuscio: inst.registraGuscio,
    dimenticaDati: inst.dimenticaDati,
    chiediSpazioPersistente: inst.chiediSpazioPersistente,
    inRete: inst.inRete,
    statoRete: inst.statoRete,
    segnalaEsito: inst.segnalaEsito,
    osserva: inst.osserva,
  },

  // Nel browser, su desktop, la scheda in secondo piano continua a lavorare.
  // Su telefono il sistema congela il processo: il caricamento e in primo
  // piano e basta, e la schermata lo dice.
  trasferimentoInSecondoPiano: !MOBILE || CON_SERVIZIO,

  trasferimento: creaTrasferimento({
    chunkMax: MOBILE ? 2 * 1024 * 1024 : 8 * 1024 * 1024,
    soloPrimoPiano: MOBILE && !CON_SERVIZIO,
  }),

  credenziali: {
    leggi: (k) => localStorage.getItem(k),
    scrivi: (k, v) => localStorage.setItem(k, v),
    rimuovi: (k) => localStorage.removeItem(k),
  },
};
