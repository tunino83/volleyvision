/**
 * IL DEPOSITO LOCALE — IndexedDB, senza librerie.
 *
 * Tiene due cose e nient'altro:
 *
 *   anagrafiche  squadre, campionati, persone, elenco partite. ~56 KB.
 *                Si **sostituisce l'insieme intero** a ogni aggiornamento: e
 *                cio che rende questa una copia e non una sincronizzazione —
 *                le cancellazioni si risolvono da sole, perche la riga
 *                sparita semplicemente non c'e nell'insieme nuovo.
 *
 *   partite      il pacchetto di analisi, 120-180 KB l'uno, con la revisione
 *                accanto per sapere quando e invecchiato.
 *
 * **Mai i video**: sono gigabyte e stanno gia sul disco dell'utente.
 *
 * Niente librerie perche servono cinque operazioni: leggi, scrivi, elenca,
 * cancella, misura. Una libreria porterebbe migrazioni, osservabili e query
 * che qui non si pongono.
 */

const DB = "volley-vision";
const VERSIONE = 1;
const ANAGRAFICHE = "anagrafiche";
const PARTITE = "partite";

/** Le collezioni che si tengono sempre, con la rotta da cui vengono. */
export const COLLEZIONI = {
  squadre: "/teams",
  campionati: "/competitions",
  persone: "/persons",
  partite: "/matches?perPagina=100",
} as const;
export type Collezione = keyof typeof COLLEZIONI;

export interface PartitaLocale {
  matchId: string;
  revisione: number;
  pacchetto: unknown;
  /** Quando e stata presa: e la data che la schermata mostra sulla copia. */
  presaIl: number;
  /** Per la riga "occupano N MB" senza dover rileggere tutto. */
  byte: number;
}

let apertura: Promise<IDBDatabase> | null = null;

function apri(): Promise<IDBDatabase> {
  if (apertura) return apertura;
  apertura = new Promise((risolvi, rifiuta) => {
    const r = indexedDB.open(DB, VERSIONE);
    r.onupgradeneeded = () => {
      const db = r.result;
      if (!db.objectStoreNames.contains(ANAGRAFICHE)) db.createObjectStore(ANAGRAFICHE);
      if (!db.objectStoreNames.contains(PARTITE)) db.createObjectStore(PARTITE, { keyPath: "matchId" });
    };
    r.onsuccess = () => risolvi(r.result);
    r.onerror = () => rifiuta(r.error);
  });
  return apertura;
}

/** Una transazione, avvolta in una promessa. `richiesta` gira dentro. */
async function tx<T>(deposito: string, modo: IDBTransactionMode,
                     richiesta: (s: IDBObjectStore) => IDBRequest): Promise<T> {
  const db = await apri();
  return new Promise((risolvi, rifiuta) => {
    const t = db.transaction(deposito, modo);
    const q = richiesta(t.objectStore(deposito));
    q.onsuccess = () => risolvi(q.result as T);
    q.onerror = () => rifiuta(q.error);
  });
}

/** Il browser puo negare del tutto IndexedDB (finestra privata, impostazioni). */
export const disponibile = () => typeof indexedDB !== "undefined";

// ---- anagrafiche: si sostituiscono intere ----------------------------------

export const scriviAnagrafica = (c: Collezione, dati: unknown) =>
  tx<void>(ANAGRAFICHE, "readwrite", (s) => s.put({ dati, presaIl: Date.now() }, c));

export const leggiAnagrafica = <T,>(c: Collezione) =>
  tx<{ dati: T; presaIl: number } | undefined>(ANAGRAFICHE, "readonly", (s) => s.get(c));

// ---- partite ---------------------------------------------------------------

export const scriviPartita = (p: PartitaLocale) =>
  tx<void>(PARTITE, "readwrite", (s) => s.put(p));

export const leggiPartita = (matchId: string) =>
  tx<PartitaLocale | undefined>(PARTITE, "readonly", (s) => s.get(matchId));

export const partiteLocali = () =>
  tx<PartitaLocale[]>(PARTITE, "readonly", (s) => s.getAll());

/** Solo le chiavi e le revisioni: basta a decidere cosa scaricare. */
export async function revisioniLocali(): Promise<Map<string, number>> {
  const tutte = await partiteLocali();
  return new Map(tutte.map((p) => [p.matchId, p.revisione]));
}

export const dimenticaPartita = (matchId: string) =>
  tx<void>(PARTITE, "readwrite", (s) => s.delete(matchId));

/**
 * Via tutto. Si chiama all'uscita: **il deposito e di un utente solo**, e su
 * un computer condiviso non deve sopravvivere a chi l'ha riempito.
 */
export async function svuota(): Promise<void> {
  if (!disponibile()) return;
  await tx<void>(ANAGRAFICHE, "readwrite", (s) => s.clear());
  await tx<void>(PARTITE, "readwrite", (s) => s.clear());
}

/** Quanto occupa, per la riga nel profilo. */
export async function occupazione(): Promise<{ partite: number; byte: number }> {
  const p = await partiteLocali();
  return { partite: p.length, byte: p.reduce((s, x) => s + x.byte, 0) };
}
