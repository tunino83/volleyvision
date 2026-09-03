import { useEffect, useState } from "react";
import * as I from "./Icone";

/**
 * AVVISI DI PASSAGGIO.
 *
 * Compaiono in un angolo, dicono una cosa, se ne vanno. Servono per i fatti
 * che l'utente **deve sapere ma non deve decidere**: tre partite in piu
 * disponibili offline, l'applicazione riconosciuta, il deposito aggiornato.
 *
 * Due regole, e sono quelle che separano un avviso utile da una molestia:
 *
 *  - **niente avvisi per le non-notizie.** "Sincronizzazione completata: 0
 *    nuove partite" e rumore. Si parla solo quando e cambiato qualcosa.
 *  - **niente avvisi che chiedono.** Se serve una decisione, non e un avviso:
 *    e una finestra, e si mette altrove.
 *
 * Non e un contesto React: e un piccolo canale con un ascoltatore. Gli avvisi
 * arrivano da fuori l'albero dei componenti — dalla sincronizzazione, dal
 * livello di piattaforma — e passare un contesto fin la significherebbe
 * legare quel codice a React senza motivo.
 */

export interface Avviso {
  id: number;
  testo: string;
  /** `notizia` per i fatti, `attenzione` per cio che l'utente potrebbe voler correggere. */
  tono?: "notizia" | "attenzione";
  /** Millisecondi prima di sparire. Zero: resta finche non lo si chiude. */
  durata?: number;
}

let prossimoId = 1;
const ascoltatori = new Set<(a: Avviso[]) => void>();
let correnti: Avviso[] = [];

function pubblica() { ascoltatori.forEach((f) => f(correnti)); }

/** Mostra un avviso. Chiamabile da qualunque punto, anche fuori da React. */
export function avvisa(testo: string, opt: Omit<Avviso, "id" | "testo"> = {}) {
  const a: Avviso = { id: prossimoId++, testo, tono: "notizia", durata: 7000, ...opt };
  correnti = [...correnti, a];
  pubblica();
  if (a.durata) setTimeout(() => chiudi(a.id), a.durata);
  return a.id;
}

export function chiudi(id: number) {
  correnti = correnti.filter((a) => a.id !== id);
  pubblica();
}

export function Avvisi() {
  const [lista, setLista] = useState<Avviso[]>(correnti);
  useEffect(() => {
    ascoltatori.add(setLista);
    return () => { ascoltatori.delete(setLista); };
  }, []);

  if (!lista.length) return null;
  return (
    // `polite`: si annuncia quando lo schermo ha finito di dire il resto.
    // `assertive` interromperebbe la lettura in corso per una non-urgenza.
    <div className="avvisi" role="status" aria-live="polite">
      {lista.map((a) => (
        <div key={a.id} className={`avviso ${a.tono}`}>
          {a.tono === "attenzione" ? <I.Nuvola d={16} /> : <I.Pallone d={16} />}
          <span>{a.testo}</span>
          <button className="icona-solo chiudi" onClick={() => chiudi(a.id)}
                  title="Chiudi" aria-label="Chiudi">×</button>
        </div>
      ))}
    </div>
  );
}
