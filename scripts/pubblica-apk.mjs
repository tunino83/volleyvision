#!/usr/bin/env node
/*
 * Pubblica l'APK appena costruito, con la versione nel nome.
 *
 * ## Perche uno script e non due copie a mano
 *
 * La versione deve comparire in tre posti: nel manifesto Android, nel nome
 * del file scaricato, e nel testo che il sito mostra accanto al pulsante.
 * Tenerli allineati a mano funziona finche non funziona — e il giorno che
 * divergono, il sito annuncia una versione e ne consegna un'altra, senza che
 * niente segnali l'errore.
 *
 * Qui la versione ha **una sola fonte**, `android/app/build.gradle`. Da li si
 * ricavano il nome del file e il modulo `src/apk.ts` che il sito importa: se
 * la versione cambia e lo script non gira, il sito continua a puntare
 * all'APK vecchio — che c'e ancora ed e coerente. Non si arriva mai al caso
 * in cui il collegamento e rotto.
 *
 * ## Perche il nome versionato e non `volley-vision.apk`
 *
 * Chi ha scaricato la settimana scorsa, guardando il file nella cartella
 * Download, non ha modo di sapere se e l'ultimo. Con la versione nel nome lo
 * legge senza installarlo. E le versioni precedenti restano raggiungibili:
 * se una si rivela guasta su un modello di telefono, si torna indietro.
 *
 * Uso:
 *   node scripts/pubblica-apk.mjs
 * dopo aver costruito l'APK (`gradlew assembleDebug`).
 */

import { readFileSync, writeFileSync, copyFileSync, existsSync, mkdirSync, readdirSync, statSync }
  from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const radice = join(dirname(fileURLToPath(import.meta.url)), "..");
const gradle = join(radice, "apps/web/android/app/build.gradle");
const costruito = join(radice, "apps/web/android/app/build/outputs/apk/debug/app-debug.apk");
const cartella = join(radice, "apps/web/public/scarica");

const testo = readFileSync(gradle, "utf8");
const nome = testo.match(/versionName\s+"([^"]+)"/)?.[1];
const codice = testo.match(/versionCode\s+(\d+)/)?.[1];
if (!nome || !codice) {
  console.error("Versione non trovata in build.gradle: lo script non indovina.");
  process.exit(1);
}

if (!existsSync(costruito)) {
  console.error(`APK non trovato in ${costruito}.\nCostruiscilo prima:`
    + "\n  cd apps/web/android && gradlew.bat assembleDebug");
  process.exit(1);
}

/*
 * L'APK e piu vecchio del sito?
 *
 * `cap sync` fa una **copia** dei file web dentro il progetto Android: da
 * quel momento l'APK e fermo a quella versione, e ricostruire il sito non lo
 * tocca. E successo davvero — un APK pubblicato senza due funzionalita
 * aggiunte dopo, senza che niente lo segnalasse — ed e un errore che non si
 * vede: l'applicazione si apre, funziona, e semplicemente le manca qualcosa.
 *
 * Il confronto e sulle date, che e grossolano ma coglie l'unico caso che
 * conta: si e costruito il sito e ci si e dimenticati dell'APK.
 */
const web = join(radice, "apps/web/dist");
if (existsSync(web)) {
  const piuRecente = Math.max(...readdirSync(join(web, "assets"), { withFileTypes: true })
    .filter((d) => d.isFile())
    .map((d) => statSync(join(web, "assets", d.name)).mtimeMs));
  if (piuRecente > statSync(costruito).mtimeMs) {
    console.error([
      "L'APK e piu vecchio della build del sito: conterrebbe una versione superata.",
      "Ricostruiscilo prima:",
      "  cd apps/web && npm run build && npx cap sync android",
      "  cd android && gradlew.bat assembleDebug",
    ].join("\n"));
    process.exit(1);
  }
}

const file = `volley-vision-${nome}.apk`;
mkdirSync(cartella, { recursive: true });
copyFileSync(costruito, join(cartella, file));

/*
 * Il modulo che il sito importa.
 *
 * Generato e non scritto a mano, ma **versionato**: il sito si costruisce
 * anche su una macchina senza Android SDK, dove questo script non puo
 * girare. Un file generato e ignorato spezzerebbe la costruzione del sito.
 */
writeFileSync(join(radice, "apps/web/src/apk.ts"),
`/*
 * GENERATO da scripts/pubblica-apk.mjs — non modificare a mano.
 *
 * E versionato di proposito: il sito si costruisce anche dove l'SDK Android
 * non c'e, e li lo script non puo girare.
 */
export const APK = {
  /** Percorso servito. La versione e nel nome perche chi lo trova nei
   *  Download, mesi dopo, sappia cosa ha senza installarlo. */
  percorso: "/scarica/${file}",
  versione: "${nome}",
  /** Quello che Android confronta per decidere se e un aggiornamento. */
  codice: ${codice},
  megabyte: ${(statSync(costruito).size / 1048576).toFixed(1)},
};
`);

console.log(`Pubblicato ${file} (versionCode ${codice}).`);

// Le versioni vecchie restano, ma vanno sapute: ognuna pesa una decina di
// megabyte nella cronologia di git, per sempre. La casa giusta e una release
// su GitHub, e questo elenco e il promemoria che il conto sta salendo.
const altre = readdirSync(cartella).filter((f) => f.endsWith(".apk") && f !== file);
if (altre.length) {
  console.log(`Versioni precedenti ancora presenti: ${altre.join(", ")}`);
}
