#!/usr/bin/env node
/*
 * Toglie da `dist` cio che non deve finire dentro l'APK.
 *
 * ## Il problema che risolve
 *
 * `cap sync` copia **tutta** la cartella `dist` negli asset Android, e in
 * `dist` finisce anche `public/scarica/`, dove sta l'APK da scaricare. Il
 * risultato e che ogni APK si porta dentro quello precedente: la 1.1 conteneva
 * i 6 MB della versione prima, la 1.2 gli 11 MB della 1.1, e la successiva ne
 * avrebbe contenuti 16. Cresce a valanga, e non se ne accorge nessuno perche
 * l'applicazione funziona lo stesso — e solo grossa.
 *
 * Misurato, non supposto: 13,7 MB di asset in un APK il cui codice web pesa
 * 2,5 MB.
 *
 * ## Perche uno script e non una configurazione
 *
 * Capacitor copia `webDir` per intero e non offre esclusioni. L'alternativa
 * sarebbe servire l'APK da fuori `public/`, ma allora non lo servirebbe piu
 * ne il server di sviluppo ne il sito statico: si perderebbe il collegamento
 * per scaricarlo, che e il motivo per cui sta li.
 */

import { rmSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const dist = join(dirname(fileURLToPath(import.meta.url)), "..", "dist");

// Gli APK: dentro un APK non ci va un APK.
const scarica = join(dist, "scarica");
if (existsSync(scarica)) {
  rmSync(scarica, { recursive: true, force: true });
  console.log("Tolto dist/scarica: dentro un APK non ci va un altro APK.");
}
