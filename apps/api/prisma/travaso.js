/**
 * TRAVASO DEI DATI FRA DUE DATABASE.
 *
 * Serve al passaggio da SQLite a MySQL, e a qualunque altro trasloco.
 * Si usa in due tempi, e **l'ordine non e negoziabile**:
 *
 *   1. con lo schema ancora su `sqlite`:   node prisma/travaso.js esporta
 *   2. si cambia provider, si migra, poi:  node prisma/travaso.js importa
 *
 * Fra i due passaggi il client Prisma va rigenerato: e per questo che sono
 * due comandi separati e non uno solo. Un unico script non potrebbe parlare
 * con due provider diversi nello stesso processo.
 *
 * ## Cosa richiede attenzione
 *
 * **L'ordine delle tabelle.** Si scrive prima cio da cui gli altri dipendono:
 * un `Match` prima del suo `MatchPlayer`, altrimenti la chiave esterna
 * rifiuta la riga. L'elenco qui sotto e gia in quell'ordine.
 *
 * **I tipi che JSON non sa scrivere.** `BigInt` (le dimensioni dei video, che
 * superano i 2 GB) e `Bytes` (le fotografie) non hanno una rappresentazione
 * JSON: si marcano e si ricostruiscono al ritorno. Senza, l'esportazione
 * fallisce con "Do not know how to serialize a BigInt" — oppure, peggio,
 * riesce e restituisce dati sbagliati.
 */
const { PrismaClient } = require("@prisma/client");
const fs = require("fs");
const path = require("path");

const p = new PrismaClient();
const FILE = path.join(__dirname, "travaso.json");

/** In ordine di dipendenza: chi e citato viene prima di chi cita. */
const TABELLE = [
  "user", "authIdentity", "token", "tentativoAccesso",
  "person", "personaFoto",
  "team", "teamPlayer", "teamShare",
  "competition", "competitionShare",
  "match", "matchPlayer", "lineup", "substitution",
  "video", "uploadSession", "lavorazione", "analysis",
  "notification", "auditLog",
];

/* JSON non ha ne interi grandi ne byte: si avvolgono in un oggetto
   riconoscibile, e si srotolano all'importazione. */
const impacchetta = (_k, v) => {
  if (typeof v === "bigint") return { __tipo: "BigInt", v: v.toString() };
  if (v && v.type === "Buffer" && Array.isArray(v.data)) {
    return { __tipo: "Bytes", v: Buffer.from(v.data).toString("base64") };
  }
  return v;
};

const spacchetta = (_k, v) => {
  if (v && typeof v === "object" && v.__tipo === "BigInt") return BigInt(v.v);
  if (v && typeof v === "object" && v.__tipo === "Bytes") return Buffer.from(v.v, "base64");
  return v;
};

async function esporta() {
  const fuori = {};
  for (const t of TABELLE) {
    fuori[t] = await p[t].findMany();
    console.log(`  ${t.padEnd(18)} ${fuori[t].length}`);
  }
  fs.writeFileSync(FILE, JSON.stringify(fuori, impacchetta));
  const mb = (fs.statSync(FILE).size / 1024 / 1024).toFixed(1);
  console.log(`\nScritto ${FILE} (${mb} MB)`);
  console.log("Adesso: cambia provider, `npx prisma migrate deploy`, poi `importa`.");
}

async function importa() {
  if (!fs.existsSync(FILE)) {
    console.error(`Manca ${FILE}. Va eseguito prima "esporta", con il vecchio database.`);
    process.exit(1);
  }
  const dentro = JSON.parse(fs.readFileSync(FILE, "utf-8"), spacchetta);

  for (const t of TABELLE) {
    const righe = dentro[t] ?? [];
    if (!righe.length) { console.log(`  ${t.padEnd(18)} 0`); continue; }
    // Una alla volta e non `createMany`: cosi si sa **quale** riga rifiuta,
    // e un singolo dato malformato non fa perdere tutta la tabella.
    let ok = 0;
    for (const r of righe) {
      try { await p[t].create({ data: r }); ok++; }
      catch (e) {
        console.error(`  ! ${t}: riga ${r.id ?? "?"} rifiutata — ${e.message.split("\n")[0]}`);
      }
    }
    console.log(`  ${t.padEnd(18)} ${ok}/${righe.length}`);
  }
  console.log("\nFatto. Confronta i conteggi con quelli dell'esportazione.");
}

(async () => {
  const cosa = process.argv[2];
  if (cosa === "esporta") await esporta();
  else if (cosa === "importa") await importa();
  else {
    console.log("uso: node prisma/travaso.js esporta | importa");
    process.exit(1);
  }
  await p.$disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
