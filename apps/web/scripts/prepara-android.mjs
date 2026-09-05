#!/usr/bin/env node
/*
 * Prepara `dist` per la copia dentro l'APK, e rifiuta se non e adatta.
 *
 * Gira DOPO `vite build` e PRIMA di `cap sync`, che e l'unico momento in cui
 * si puo ancora fermare un APK sbagliato: dopo la copia, il difetto e dentro
 * il pacchetto e si scopre solo aprendolo su un telefono.
 */

import { rmSync, existsSync, readdirSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const web = join(dirname(fileURLToPath(import.meta.url)), "..");
const dist = join(web, "dist");

if (!existsSync(dist)) {
  console.error("Manca apps/web/dist: costruisci prima il sito (npm run build).");
  process.exit(1);
}

/*
 * 1. L'indirizzo dell'API.
 *
 * **Questo controllo esiste perche l'errore e stato commesso davvero**, ed e
 * stato commesso da chi aveva scritto l'avvertimento in `docs/21`. Vite
 * scrive `VITE_API_URL` DENTRO il JavaScript al momento della costruzione;
 * senza, resta il ripiego `http://localhost:3001`, che su un telefono e il
 * telefono stesso. L'applicazione si apre, sembra sana, e ogni schermata e
 * vuota con "il server non risponde".
 *
 * Una nota in un documento non ferma nessuno: si ricorda di leggerla chi gia
 * conosce il problema. Il posto giusto per una regola e dove si viola.
 *
 * Si guarda il **risultato**, non la variabile d'ambiente: e cio che conta
 * davvero, e coglie anche il caso in cui la variabile c'era ma il `build` era
 * vecchio e non l'aveva vista.
 */
const assets = join(dist, "assets");
const bundle = readdirSync(assets).filter((f) => f.endsWith(".js"))
  .map((f) => readFileSync(join(assets, f), "utf8")).join("");

if (bundle.includes("localhost:3001")) {
  console.error([
    "Il sito costruito punta ancora a http://localhost:3001.",
    "Dentro l'APK quell'indirizzo e il telefono stesso: ogni schermata"
      + " risulterebbe vuota con \"il server non risponde\".",
    "",
    "Ricostruisci passando l'indirizzo vero dell'API:",
    "  VITE_API_URL=\"https://...\" npm run android:sync",
  ].join("\n"));
  process.exit(1);
}

/*
 * 2. Gli APK dentro l'APK.
 *
 * `cap sync` copia **tutta** `dist` negli asset Android, e li dentro c'e
 * `scarica/`, dove sta l'APK da scaricare. Il risultato e che ogni versione
 * si porta dentro la precedente: la 1.1 conteneva i 6 MB di quella prima, la
 * 1.2 gli 11 MB della 1.1. Cresce a valanga e non se ne accorge nessuno,
 * perche l'applicazione funziona lo stesso — e solo grossa.
 *
 * Capacitor copia `webDir` per intero e non offre esclusioni; servire l'APK
 * da fuori `public/` significherebbe perdere il collegamento per scaricarlo,
 * che e il motivo per cui sta li.
 */
const scarica = join(dist, "scarica");
if (existsSync(scarica)) {
  rmSync(scarica, { recursive: true, force: true });
  console.log("Tolto dist/scarica: dentro un APK non ci va un altro APK.");
}

console.log("dist pronta per cap sync.");
