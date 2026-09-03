/**
 * PLATFORM CAPABILITY LAYER
 *
 * Sei sole responsabilita: spazio, file, trasferimenti, rete, video,
 * credenziali. Ogni contenitore (browser, Electron, Capacitor) la implementa
 * a modo suo. NESSUN componente dell'interfaccia deve accedere direttamente
 * al filesystem o alle interfacce native: tutto passa da qui. Vedi docs/02.
 *
 * Fase 1: esiste solo l'implementazione browser, che pero distingue gia il
 * caso mobile — il caricamento da telefono passa da qui, non da un plugin.
 */

export interface AperturaSessione {
  uploadId: string;
  url: string;
  chunkBytes: number;
  /** Byte gia sul server: diverso da zero quando si riprende. */
  bytesRicevuti?: number;
  ripresa?: boolean;
}

export interface OpzioniInvio {
  apriSessione: () => Promise<AperturaSessione>;
  onProgresso?: (inviati: number, totale: number) => void;
  /** Chiamato una sola volta, se il caricamento riparte da un punto avanzato. */
  onRipresa?: (inviati: number, totale: number) => void;
  segnale?: AbortSignal;
}

export interface Trasferimento {
  invia(file: File, opts: OpzioniInvio): Promise<{ uploadId: string }>;
}

/**
 * Stato della connessione. Serve a non bruciare gigabyte di traffico a
 * consumo senza che l'utente lo abbia deciso.
 */
export interface Rete {
  /** Vero se la connessione si paga a consumo. `null` quando non e conoscibile. */
  aConsumo(): boolean | null;
  /** `wifi`, `cellular`, `ethernet`… oppure `null` se il browser non lo dice. */
  tipo(): string | null;
}

/**
 * Mettere l'applicazione sul computer, e farla funzionare senza rete.
 * Nel browser lo fanno manifesto e service worker; dentro Electron o
 * Capacitor l'applicazione e gia installata e `installabile` resta falso.
 */
export interface Installazione {
  /** Il contenitore e gia un'applicazione a se? */
  giaInstallata(): boolean;
  /** Il browser ha offerto di installarla? Safari non lo fa: si spiega a mano. */
  installabile(): boolean;
  /** Esiste un'installazione, pur stando in una scheda? `null` = non si sa. */
  installazioneEsistente(): Promise<boolean | null>;
  installa(): Promise<"accettata" | "rifiutata" | "non-disponibile">;
  /**
   * Registra il guscio senza rete. Non fa nulla in sviluppo.
   * `onNuovaVersione` scatta se ne viene pubblicata una mentre l'app e aperta.
   */
  registraGuscio(onNuovaVersione?: () => void): void;
  /** All'uscita: dimentica le risposte depositate dell'utente. */
  dimenticaDati(): void;
  /** Chiede che i dati locali non vengano rimossi per far spazio. */
  chiediSpazioPersistente(): Promise<boolean | null>;
  inRete(): boolean;
  /** Tre casi, non due: il terzo e la rete che c'e ma non risponde. */
  statoRete(): "in-rete" | "senza-rete" | "non-risponde";
  /** Lo chiama solo il client dell'API, a ogni richiesta. */
  segnalaEsito(riuscita: boolean): void;
  /** Si iscrive ai cambiamenti di rete e di stato dell'installazione. */
  osserva(f: () => void): () => void;
}

export interface PlatformCapabilities {
  nome: "browser" | "desktop" | "mobile";
  /** Vero su telefono o tablet: cambia i limiti, non le funzioni. */
  mobile: boolean;
  /** Spazio disponibile: nel browser non e conoscibile. */
  spazio: { disponibile(): Promise<number | null> };
  /** Pacchetti partita in locale: assenti nel browser. */
  file: { supportato: boolean };
  trasferimento: Trasferimento;
  /**
   * Il trasferimento sopravvive all'uscita dall'applicazione?
   * Browser e Capacitor: no (opzione A, nessun servizio in secondo piano).
   * Electron: si. L'interfaccia lo dice all'utente invece di far finta.
   */
  trasferimentoInSecondoPiano: boolean;
  rete: Rete;
  installazione: Installazione;
  /** Riproduzione video: NON implementata dal browser ne da mobile. */
  media: { supportato: boolean; urlVideo?(matchId: string, lato: number): string };
  credenziali: {
    leggi(chiave: string): string | null;
    scrivi(chiave: string, valore: string): void;
    rimuovi(chiave: string): void;
  };
}

import { browser } from "./browser";
export const piattaforma: PlatformCapabilities = browser;
export { SOSPESO } from "./trasferimento";
