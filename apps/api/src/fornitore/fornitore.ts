/**
 * IL FORNITORE DELL'ANALISI VIDEO, DIETRO UN'INTERFACCIA
 *
 * Il sistema non sa chi analizza i video. Conosce solo questo contratto, e
 * due sole cose lo attraversano: si chiede di analizzare una partita, e prima
 * o poi arrivano i dati.
 *
 * Oggi risponde un simulatore (`simulato.ts`) perche il fornitore non e
 * ingaggiato. Quando lo sara, si scrive `esterno.ts` e si cambia una variabile
 * d'ambiente: FORNITORE_ANALISI=esterno. Nient'altro va toccato.
 */

export interface RichiestaAnalisi {
  matchId: string;
  /** Chiavi dei video sullo spazio di archiviazione, per lato. */
  video: Array<{ lato: number; storageKey: string | null; nomeFile: string | null }>;
  /** Chi ha chiesto l'analisi: serve per la notifica a lavoro concluso. */
  richiedenteId: string;
}

export interface EsitoAvvio {
  /** Riferimento dell'elaborazione presso il fornitore. */
  riferimento: string;
  /** Quando ci si aspetta il risultato. Null se il fornitore non lo dichiara. */
  attesoPer: Date | null;
}

export interface FornitoreAnalisi {
  readonly nome: string;
  /** Vero se il fornitore ci richiama da se a lavoro finito. */
  readonly notificaSpontanea: boolean;

  /** Mette in lavorazione una partita. */
  avvia(r: RichiestaAnalisi): Promise<EsitoAvvio>;

  /**
   * Chiede se un'elaborazione e conclusa e, in tal caso, restituisce i file
   * nel formato del fornitore. Usato quando `notificaSpontanea` e falso.
   */
  ritira(riferimento: string): Promise<
    | { pronto: false }
    | { pronto: true; events: unknown; videos: unknown; frames: unknown | null }
    | { pronto: true; errore: string }
  >;
}

export const FORNITORE = Symbol("FornitoreAnalisi");
