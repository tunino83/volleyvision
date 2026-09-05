import { useEffect, useMemo, useState } from "react";
import { createAvatar } from "@dicebear/core";
import * as stili from "@dicebear/collection";

/**
 * Lo stemma di una squadra.
 *
 * Stesso impianto dell'avatar delle persone — disegnato da due stringhe,
 * sostituito da un'immagine se ce n'e una — ma con **stili diversi**: qui non
 * servono facce. Uno stemma con la faccia di qualcuno verrebbe letto come
 * "il giocatore", non "la squadra".
 *
 * `initials` e il predefinito perche funziona senza che nessuno scelga
 * niente: due lettere del nome sono gia un segno riconoscibile, e restano
 * leggibili a diciotto pixel dove un disegno diventa una macchia. Il seme,
 * quando non e stato scelto, e il nome della squadra — cosi lo stemma **c'e
 * comunque** ed e sempre lo stesso.
 *
 * **Quadrato, non tondo.** Gli avatar delle persone sono tondi; se lo fosse
 * anche questo, in una riga dove compaiono entrambi non si distinguerebbe
 * una squadra da una persona.
 */

export const STILI_LOGO = [
  "initials", "shapes", "rings", "identicon", "glass", "icons", "bottts",
] as const;
export type StileLogo = (typeof STILI_LOGO)[number];

export const NOMI_STILE: Record<StileLogo, string> = {
  initials: "Iniziali", shapes: "Forme", rings: "Anelli", identicon: "Trama",
  glass: "Vetro", icons: "Simbolo", bottts: "Mascotte",
};

const PREDEFINITO: StileLogo = "initials";

export function LogoSquadra({ nome, stile, seme, opzioni, teamId, logo, d = 28, className }: {
  /** Il nome della squadra: e anche il seme quando non ne e stato scelto uno. */
  nome: string;
  stile?: string | null;
  seme?: string | null;
  opzioni?: Record<string, string[]> | null;
  /** Serve solo a comporre l'indirizzo dell'immagine caricata. */
  teamId?: string;
  /** La versione dell'immagine (millisecondi), oppure `null`. Mai i byte. */
  logo?: number | null;
  d?: number;
  className?: string;
}) {
  const dataUri = useMemo(() => disegna(nome, stile, seme, opzioni, d), [nome, stile, seme, opzioni, d]);

  const [srcFile, setSrcFile] = useState<string | null>(null);
  useEffect(() => {
    if (!teamId || !logo) { setSrcFile(null); return; }
    let vivo = true;
    void indirizzoLogo(teamId, logo).then((u) => { if (vivo) setSrcFile(u); });
    return () => { vivo = false; };
  }, [teamId, logo]);

  return (
    <img src={srcFile ?? dataUri} width={d} height={d} alt="" aria-hidden
         className={`stemma ${className ?? ""}`}
         style={{ width: d, height: d, flex: `0 0 ${d}px` }} />
  );
}

/** Il solo disegno, senza l'immagine caricata: serve all'anteprima mentre si sceglie. */
export function disegna(nome: string, stile?: string | null, seme?: string | null,
                        opzioni?: Record<string, string[]> | null, d = 64) {
  const scelto = (stile && (STILI_LOGO as readonly string[]).includes(stile)
                  ? stile : PREDEFINITO) as StileLogo;
  const collezione = (stili as any)[scelto] ?? stili.initials;
  /*
   * Con `initials` il seme **sono le lettere**.
   *
   * Non e un dettaglio: la manopola "variante" serve a ottenere un disegno
   * diverso, e su ogni altro stile fa esattamente quello. Qui cambierebbe la
   * sigla — "Volley Modena" diventerebbe "XA" — cioe l'unica cosa che in uno
   * stemma a iniziali deve restare ferma. Misurato, non supposto.
   *
   * Quindi per questo stile il seme e sempre il nome, e la varieta si prende
   * dal colore di fondo, che sta fra le caratteristiche componibili.
   */
  const semeVero = scelto === "initials" ? (nome || "squadra") : (seme || nome || "squadra");

  return createAvatar(collezione, {
    seed: semeVero,
    size: d,
    // Le scelte a mano vanno dopo, o verrebbero sovrascritte da cio che sta
    // sotto. Un valore che questo stile non conosce viene ignorato: cambiando
    // stile le scelte vecchie non fanno danno, semplicemente non si applicano.
    ...(opzioni ?? {}),
    // A differenza degli avatar, **lo sfondo resta**: uno stemma senza fondo
    // e un disegno che galleggia. Solo `initials` ne ha uno di suo; per gli
    // altri lo decide lo stile.
    radius: 12,
  }).toDataUri();
}

/**
 * L'indirizzo utilizzabile di uno stemma caricato.
 *
 * Non e l'indirizzo dell'API: **un `<img src>` non manda l'intestazione
 * `Authorization`**, e la rotta e protetta. Lo si scarica con `fetch`, che
 * l'intestazione la manda, e si trasforma in un indirizzo locale.
 *
 * Mettere il gettone nell'indirizzo finirebbe nei registri del server, nella
 * cronologia e nelle intestazioni di provenienza. Non si fa.
 *
 * Le promesse si conservano per `squadra:versione`: lo stesso stemma compare
 * dieci volte in un elenco di partite e si scarica una volta sola. Cambiando
 * lo stemma cambia la versione, quindi la chiave, quindi si riparte — senza
 * svuotare nulla a mano.
 */
const cache = new Map<string, Promise<string | null>>();

export function indirizzoLogo(teamId: string, versione: number): Promise<string | null> {
  const chiave = `${teamId}:${versione}`;
  const gia = cache.get(chiave);
  if (gia) return gia;

  const base = (import.meta as any).env?.VITE_API_URL ?? "http://localhost:3001";
  const p = fetch(`${base}/api/teams/${teamId}/logo?v=${versione}`, {
    headers: { Authorization: `Bearer ${localStorage.getItem("vv.access") ?? ""}` },
  })
    .then((r) => (r.ok ? r.blob() : null))
    .then((b) => (b ? URL.createObjectURL(b) : null))
    // Senza rete e senza copia non si ottiene nulla: si resta sullo stemma
    // disegnato, che non ha bisogno di nessuno. Non e un errore da mostrare.
    .catch(() => null);

  cache.set(chiave, p);
  return p;
}

/** Da dimenticare quando si sostituisce lo stemma, altrimenti resta il vecchio. */
export function scordaLogo(teamId: string) {
  for (const k of [...cache.keys()]) if (k.startsWith(`${teamId}:`)) cache.delete(k);
}
