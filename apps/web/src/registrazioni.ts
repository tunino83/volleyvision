/**
 * Le registrazioni fatte e non ancora caricate.
 *
 * ## Perche serve un registro
 *
 * Registrare e caricare sono due gesti separati, e devono restarlo: si
 * registra in palestra, spesso senza rete, e si carica dopo. Ma il
 * caricamento **richiede una partita gia creata** — la sessione si apre su
 * `matches/:id/videos/:lato`, e il server pretende la formazione del set 1
 * prima di accettare byte. Fra i due momenti puo passare un'ora o un giorno,
 * e l'applicazione puo essere stata chiusa.
 *
 * Quindi il file non si perde: resta nella cartella privata
 * dell'applicazione, e qui si tiene traccia di **dov'e**. Senza questo
 * elenco, una registrazione finita bene diventerebbe un file che nessuno sa
 * piu di avere.
 *
 * ## Perche in `localStorage` e non sul server
 *
 * E un indirizzo valido solo su questo telefono: mandarlo al server
 * significherebbe conservare un dato che altrove non vuol dire niente. Vive e
 * muore con l'apparecchio, come il file che descrive.
 */

const CHIAVE = "vv.registrazioni";

export interface Registrazione {
  /** L'indirizzo del file sul dispositivo (`file://...`). */
  uri: string;
  nome: string;
  byte: number;
  durataMs: number;
  /** Quando e stata fatta, in millisecondi. */
  quando: number;
  /** La partita a cui e stata collegata, se e gia successo. */
  matchId?: string;
}

export function elenco(): Registrazione[] {
  try {
    const g = JSON.parse(localStorage.getItem(CHIAVE) ?? "[]");
    return Array.isArray(g) ? g : [];
  } catch {
    // Dato illeggibile: si riparte da un elenco vuoto invece di far cadere
    // la schermata. Il file resta sul disco, e questa e la cosa che conta.
    return [];
  }
}

function salva(r: Registrazione[]) {
  try { localStorage.setItem(CHIAVE, JSON.stringify(r.slice(0, 20))); }
  catch { /* spazio esaurito o archiviazione negata: si prosegue senza */ }
}

export function aggiungi(r: Omit<Registrazione, "quando">): Registrazione {
  const nuova = { ...r, quando: Date.now() };
  // In cima: la piu recente e quasi sempre quella che si vuole caricare.
  salva([nuova, ...elenco().filter((x) => x.uri !== r.uri)]);
  return nuova;
}

/** Quelle non ancora collegate a una partita: sono le sole da proporre. */
export const daCaricare = () => elenco().filter((r) => !r.matchId);

export function collega(uri: string, matchId: string) {
  salva(elenco().map((r) => (r.uri === uri ? { ...r, matchId } : r)));
}

/**
 * Toglie una registrazione dall'elenco. **Non cancella il file**: quello sta
 * nella cartella privata dell'applicazione e sparisce con la disinstallazione.
 * Cancellarlo da qui vorrebbe dire buttare una partita per un tocco sbagliato.
 */
export function dimentica(uri: string) {
  salva(elenco().filter((r) => r.uri !== uri));
}

/** "1h 47m", per dire quanto dura senza far contare i secondi a nessuno. */
export function durata(ms: number): string {
  const min = Math.round(ms / 60000);
  return min < 60 ? `${min}m` : `${Math.floor(min / 60)}h ${min % 60}m`;
}
