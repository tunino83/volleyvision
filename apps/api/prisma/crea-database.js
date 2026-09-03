#!/usr/bin/env node
/**
 * CREA IL DATABASE — l'involucro attorno a `crea-database.sql`.
 *
 * Fa tre cose che l'SQL da solo non fa: trova il client `mysql` anche quando
 * non e nel PATH (su Windows non lo e quasi mai), **non scrive mai la
 * password in chiaro sulla riga di comando**, e stampa alla fine l'indirizzo
 * da mettere nel `.env`.
 *
 *   node prisma/crea-database.js --porta 3308 --utente root
 *
 * La password viene chiesta a schermo. Opzioni:
 *   --host      127.0.0.1
 *   --porta     3306
 *   --utente    root                utenza amministrativa, non quella dell'app
 *   --db        volleyvision
 *   --app-pass  password dell'utenza applicativa (altrimenti chiesta)
 *   --client    percorso di mysql.exe, se non viene trovato da solo
 */
const { execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const readline = require("readline");

function args() {
  const a = process.argv.slice(2), o = {};
  for (let i = 0; i < a.length; i++) {
    if (a[i].startsWith("--")) o[a[i].slice(2)] = a[i + 1]?.startsWith("--") ? true : a[++i];
  }
  return o;
}

/** I posti dove Windows nasconde il client. Su Linux e macOS sta nel PATH. */
function trovaClient(indicato) {
  if (indicato) return indicato;
  const candidati = [
    "mysql",
    ...["MySQL Server 8.4", "MySQL Server 8.0", "MySQL Server 5.7"]
      // Barre normali anche su Windows: Node le accetta, e cosi non c'e
      // da ricordarsi di raddoppiarle dentro le stringhe.
      .map((v) => `C:/Program Files/MySQL/${v}/bin/mysql.exe`),
    ...["12.3", "11.4", "10.11", "10.6"]
      .map((v) => `C:/Program Files/MariaDB ${v}/bin/mysql.exe`),
  ];
  for (const c of candidati) {
    try {
      execFileSync(c, ["--version"], { stdio: "ignore" });
      return c;
    } catch { /* il prossimo */ }
  }
  return null;
}

/** Chiede una password senza mostrarla mentre si scrive. */
function chiedi(domanda) {
  return new Promise((ok) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const out = process.stdout;
    // Si intercetta la scrittura dell'eco: altrimenti la password resta nel
    // terminale, e da li nella cronologia di chi guarda sopra la spalla.
    const scriviOrig = out.write.bind(out);
    let mascherando = false;
    out.write = (c, ...r) => (mascherando ? true : scriviOrig(c, ...r));
    scriviOrig(domanda);
    mascherando = true;
    rl.question("", (risposta) => {
      mascherando = false;
      out.write = scriviOrig;
      scriviOrig("\n");
      rl.close();
      ok(risposta);
    });
  });
}

(async () => {
  const o = args();
  const host = o.host ?? "127.0.0.1";
  const porta = o.porta ?? "3306";
  const utente = o.utente ?? "root";
  const db = o.db ?? "volleyvision";

  const client = trovaClient(o.client);
  if (!client) {
    console.error("Non trovo il client `mysql`. Indicalo con --client <percorso di mysql.exe>.");
    process.exit(1);
  }
  console.log(`client   : ${client}`);
  console.log(`server   : ${host}:${porta} come ${utente}`);
  console.log(`database : ${db}\n`);

  const passAdmin = await chiedi(`password di ${utente}: `);
  const passApp = o["app-pass"] ?? await chiedi("password da dare all'utenza applicativa: ");
  if (!passApp) { console.error("La password dell'applicazione non puo essere vuota."); process.exit(1); }

  let sql = fs.readFileSync(path.join(__dirname, "crea-database.sql"), "utf-8");
  sql = sql.replace(/volleyvision(?=[.'`@])/g, db)
           .replace(/IF NOT EXISTS volleyvision/g, `IF NOT EXISTS ${db}`)
           .replace(/SCHEMA_NAME = 'volleyvision'/, `SCHEMA_NAME = '${db}'`)
           .replaceAll("cambiami_in_sviluppo", passApp.replace(/'/g, "''"));

  try {
    // La password passa dall'ambiente e non da `--password`: gli argomenti di
    // un processo sono leggibili da chiunque sulla macchina.
    const out = execFileSync(client,
      ["-h", host, "-P", String(porta), "-u", utente, "--protocol=TCP"],
      { input: sql, encoding: "utf-8", env: { ...process.env, MYSQL_PWD: passAdmin } });
    console.log(out.trim() || "eseguito.");
  } catch (e) {
    console.error("\nNon riuscito:\n" + (e.stderr || e.message));
    process.exit(1);
  }

  const url = `mysql://${db}:${encodeURIComponent(passApp)}@${host}:${porta}/${db}`;
  console.log("\n" + "=".repeat(70));
  console.log("Metti questa riga in apps/api/.env :\n");
  console.log(`DATABASE_URL="${url}"`);
  console.log("\nPoi, in ordine:");
  console.log("  npx prisma migrate dev --name inizio   # crea le tabelle");
  console.log("  node prisma/travaso.js importa         # travasa i dati esportati");
  console.log("=".repeat(70));
})();
