/**
 * Migrazione: da `User.passwordHash` a `AuthIdentity`.
 *
 * Si esegue in TRE passi, e l'ordine conta:
 *
 *   node prisma/migra-identita.js leggi     # 1. salva le password su file
 *   npx prisma db push --accept-data-loss   # 2. crea la tabella, toglie la colonna
 *   node prisma/migra-identita.js scrivi    # 3. ricrea le identita
 *
 * Il passo 1 va fatto PRIMA del 2: dopo, la colonna non c'e piu e le password
 * sono perse. In esercizio la stessa cosa si fa con una migrazione versionata
 * in tre istruzioni (crea tabella, copia, elimina colonna) dentro una sola
 * transazione; qui i passi sono separati perche `db push` non le sa comporre.
 */
const { PrismaClient } = require("@prisma/client");
const fs = require("fs");
const path = require("path");

const DEPOSITO = path.join(__dirname, "identita-migrazione.json");
const p = new PrismaClient();

(async () => {
  const modo = process.argv[2];

  if (modo === "leggi") {
    const righe = await p.$queryRawUnsafe(
      "SELECT id, email, passwordHash FROM User WHERE passwordHash IS NOT NULL");
    fs.writeFileSync(DEPOSITO, JSON.stringify(righe, null, 2));
    console.log(`salvate ${righe.length} password in ${DEPOSITO}`);
  } else if (modo === "scrivi") {
    if (!fs.existsSync(DEPOSITO)) throw new Error("Manca il file: esegui prima il passo 'leggi'");
    const righe = JSON.parse(fs.readFileSync(DEPOSITO, "utf8"));
    let n = 0;
    for (const r of righe) {
      const gia = await p.authIdentity.findFirst({
        where: { userId: r.id, provider: "password" } });
      if (gia) continue;
      await p.authIdentity.create({
        data: { userId: r.id, provider: "password",
                providerUserId: r.email.toLowerCase(), passwordHash: r.passwordHash },
      });
      n++;
    }
    console.log(`create ${n} identita a password`);
    fs.unlinkSync(DEPOSITO);
    console.log("deposito temporaneo rimosso: non deve restare in giro");
  } else {
    console.error("Uso: node prisma/migra-identita.js leggi|scrivi");
    process.exitCode = 1;
  }
  await p.$disconnect();
})();
