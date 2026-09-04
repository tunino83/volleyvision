import { useEffect, useMemo, useState } from "react";
import { createAvatar } from "@dicebear/core";
import * as stili from "@dicebear/collection";

/**
 * L'avatar di un giocatore.
 *
 * **Generato, non caricato.** Nessun file, nessuna archiviazione, nessun
 * ritaglio, nessuna moderazione di immagini: due stringhe — stile e seme — da
 * cui la libreria disegna un SVG. Per una prima versione e il compromesso
 * giusto, e resta possibile aggiungere le fotografie in seguito senza
 * disfare nulla, perche il resto del sistema chiede "l'avatar di questa
 * persona" e non "il file di questa persona".
 *
 * Il seme, quando non e stato scelto, e il nome: cosi la faccia c'e comunque
 * ed e **sempre la stessa** per quella persona, anche prima che qualcuno si
 * prenda la briga di sceglierla.
 *
 * **La fotografia, se c'e, ha la precedenza** — ma non cancella l'avatar:
 * chi la toglie ritrova la faccia di prima invece di un segnaposto grigio.
 * Il resto del sistema continua a chiedere "l'avatar di questa persona" e
 * non "il file di questa persona": e per questo che aggiungere le foto non
 * ha richiesto di toccare nessuna delle schermate che li mostrano.
 */

export const STILI = [
  "adventurer", "personas", "notionists", "openPeeps",
  "micah", "avataaars", "bigSmile", "lorelei",
] as const;
export type Stile = (typeof STILI)[number];

/** Dal nome dello stile nell'API a quello del pacchetto: `open-peeps` vs `openPeeps`. */
const MAPPA: Record<string, Stile> = {
  "adventurer": "adventurer", "personas": "personas", "notionists": "notionists",
  "open-peeps": "openPeeps", "micah": "micah", "avataaars": "avataaars",
  "big-smile": "bigSmile", "lorelei": "lorelei",
};
export const NOME_API: Record<Stile, string> = {
  adventurer: "adventurer", personas: "personas", notionists: "notionists",
  openPeeps: "open-peeps", micah: "micah", avataaars: "avataaars",
  bigSmile: "big-smile", lorelei: "lorelei",
};

const PREDEFINITO: Stile = "personas";

export function Avatar({ seme, stile, d = 64, className, personId, foto, opzioni }: {
  /** Di norma il nome della persona. */
  seme: string;
  stile?: string | null;
  d?: number;
  className?: string;
  /** Serve solo per comporre l'indirizzo della fotografia. */
  personId?: string;
  /**
   * La versione della fotografia (data in millisecondi), oppure `null`.
   * Non l'immagine: **i byte non viaggiano mai con l'anagrafica.**
   */
  foto?: number | null;
  /**
   * Le scelte fatte a mano: `{ hair: ["long"], skinColor: ["eeb4a4"] }`.
   * Un elenco di un solo valore fissa quella caratteristica; senza, la
   * libreria la pesca col seme come prima.
   */
  opzioni?: Record<string, string[]> | null;
}) {
  const dataUri = useMemo(() => {
    const scelto = (stile && MAPPA[stile]) || PREDEFINITO;
    const collezione = (stili as any)[scelto] ?? stili.personas;
    return createAvatar(collezione, {
      seed: seme || "volley",
      size: d,
      /*
       * Le scelte a mano si sovrappongono al sorteggio.
       *
       * Vanno DOPO le altre opzioni, altrimenti verrebbero sovrascritte da
       * cio che sta sotto. Un valore che questo stile non conosce viene
       * ignorato dalla libreria — utile, perche cambiando stile le scelte
       * vecchie non fanno danno: semplicemente non si applicano.
       */
      ...(opzioni ?? {}),
      // Sfondo trasparente: la scheda dietro cambia colore col tema, e un
      // fondo cotto dentro l'immagine stonerebbe in uno dei due.
      backgroundColor: [],
      radius: 50,
    }).toDataUri();
  }, [seme, stile, d, opzioni]);

  const [srcFoto, setSrcFoto] = useState<string | null>(null);
  useEffect(() => {
    if (!personId || !foto) { setSrcFoto(null); return; }
    let vivo = true;
    void indirizzoFoto(personId, foto).then((u) => { if (vivo) setSrcFoto(u); });
    return () => { vivo = false; };
  }, [personId, foto]);

  return (
    <img src={srcFoto ?? dataUri} width={d} height={d} alt="" aria-hidden
         className={className}
         style={{ display: "block", borderRadius: "50%", objectFit: "cover" }} />
  );
}

/**
 * L'indirizzo utilizzabile di una fotografia.
 *
 * Non e l'indirizzo dell'API: **un `<img src>` non manda l'intestazione
 * `Authorization`**, e la rotta e protetta. Quindi la si scarica con `fetch`,
 * che l'intestazione la manda, e si trasforma il risultato in un indirizzo
 * locale.
 *
 * L'alternativa sarebbe mettere il gettone nell'indirizzo: finirebbe nei
 * registri del server, nella cronologia e nelle intestazioni di provenienza.
 * Non si fa.
 *
 * Le promesse si conservano per `persona:versione`: la stessa faccia compare
 * dieci volte in un album e va scaricata una volta sola. Cambiando la foto
 * cambia la versione, quindi la chiave, quindi si riparte — senza svuotare
 * nulla a mano.
 */
const cache = new Map<string, Promise<string | null>>();

export function indirizzoFoto(personId: string, versione: number): Promise<string | null> {
  const chiave = `${personId}:${versione}`;
  const gia = cache.get(chiave);
  if (gia) return gia;

  const base = (import.meta as any).env?.VITE_API_URL ?? "http://localhost:3001";
  const p = fetch(`${base}/api/persons/${personId}/foto?v=${versione}`, {
    headers: { Authorization: `Bearer ${localStorage.getItem("vv.access") ?? ""}` },
  })
    .then((r) => (r.ok ? r.blob() : null))
    .then((b) => (b ? URL.createObjectURL(b) : null))
    // Senza rete e senza copia non si ottiene nulla: si resta sull'avatar
    // disegnato, che non ha bisogno di nessuno. Non e un errore da mostrare.
    .catch(() => null);

  cache.set(chiave, p);
  return p;
}

/** All'uscita: le fotografie in memoria sono di quell'utente. */
export function dimenticaFoto() {
  cache.forEach((p) => void p.then((u) => u && URL.revokeObjectURL(u)));
  cache.clear();
}
