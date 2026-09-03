import { useEffect, useState } from "react";
import { API } from "./api/client";
import type { Funzioni } from "@vv/schema";

/**
 * Il ripiego finche il server non risponde: **tutto spento**.
 *
 * Il valore e locale e non importato da `@vv/schema` per due motivi. Il primo
 * e di sostanza: "spento finche non so" e una politica del client, non una
 * costante condivisa — il valore vero lo dice sempre il server. Il secondo e
 * pratico: `@vv/schema` viene compilato in CommonJS per l'API, e il
 * raggruppatore del web non riesce a seguire i valori attraverso un
 * `export *` di quel formato. I **tipi** invece si importano senza problemi,
 * ed e cio che conta: se qualcuno aggiunge una funzione all'interfaccia e
 * dimentica questa riga, la compilazione si ferma qui.
 */
const SPENTE: Funzioni = { fotoPersone: false };

/**
 * Quali funzioni sono accese.
 *
 * **Lo dice il server**, a `/version`, e non una variabile di costruzione del
 * client: due bandiere indipendenti prima o poi divergono, e si finisce con un
 * pulsante che c'e e una rotta che risponde "non esiste".
 *
 * Finche la risposta non arriva valgono i valori predefiniti, che sono tutti
 * **spenti**: meglio un comando che compare un istante dopo che uno che
 * compare e poi sparisce.
 */

let promessa: Promise<Funzioni> | null = null;

function carica(): Promise<Funzioni> {
  if (promessa) return promessa;
  promessa = API.get<{ funzioni?: Partial<Funzioni> }>("/version")
    .then((v) => ({ ...SPENTE, ...(v.funzioni ?? {}) }))
    // Senza rete non si sa: si resta sui predefiniti invece di indovinare.
    .catch(() => SPENTE);
  return promessa;
}

export function useFunzioni(): Funzioni {
  const [f, setF] = useState<Funzioni>(SPENTE);
  useEffect(() => {
    let vivo = true;
    void carica().then((x) => { if (vivo) setF(x); });
    return () => { vivo = false; };
  }, []);
  return f;
}
