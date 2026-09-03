/**
 * PROVA DI CARICO delle statistiche su piu partite.
 *
 * Risponde a una domanda che non si puo stimare a occhio: **quante partite
 * regge l'aggregazione cross-partita prima di diventare un collo di bottiglia?**
 *
 * Genera N partite con analisi vera (stesso percorso dell'esercizio:
 * generatore, poi adattatore), poi misura `/stats/players`.
 *
 *   node prisma/prova-carico.js 100      # genera e misura
 *   node prisma/prova-carico.js pulisci  # rimuove tutto quel che ha creato
 *
 * Le partite create portano il tag `prova-carico`: la pulizia si basa su quello.
 */
const { PrismaClient } = require("@prisma/client");
const path = require("path");
const fs = require("fs");

const p = new PrismaClient();
const TAG = "prova-carico";

async function accedi() {
  const r = await fetch("http://localhost:3001/api/auth/login", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "utente@volleyvision.test", password: "password123" }),
  });
  return (await r.json()).access;
}

async function pulisci() {
  const partite = await p.match.findMany({
    where: { tagJson: { contains: `"${TAG}"` } }, select: { id: true } });
  for (const m of partite) await p.match.delete({ where: { id: m.id } });
  const t = await p.team.deleteMany({ where: { nome: { startsWith: "Carico " } } });
  const c = await p.competition.deleteMany({ where: { nome: "Prova di carico" } });
  console.log(`rimosse ${partite.length} partite, ${t.count} squadre, ${c.count} campionati`);
}

async function genera(quante) {
  // Si importa il sorgente TypeScript: si esegue con `tsx`, cosi non serve
  // costruire `dist/` — e costruirlo mentre l'API gira la fa cadere.
  // `default ?? modulo` perche l'interoperabilita fra CommonJS ed ESM mette
  // gli export sotto `default` a seconda di come tsx risolve il file.
  const mock = await import("@vv/mock");
  const { generaCasuale } = mock.default ?? mock;
  const ad = await import("../src/analysis/adapter.ts");
  const { adatta, allineaEventiAiSet } = ad.default ?? ad;

  const utente = await p.user.findFirstOrThrow({ where: { email: "utente@volleyvision.test" } });
  const camp = await p.competition.create({
    data: { ownerId: utente.id, nome: "Prova di carico", stagione: "2026/2027" } });

  // Un pool di squadre con roster collegati a persone: senza persona
  // l'aggregazione non ha righe, e misureremmo il caso facile.
  const squadre = [];
  for (let s = 0; s < 8; s++) {
    const t = await p.team.create({
      data: { ownerId: utente.id, nome: `Carico ${s + 1}`, stagione: "2026/2027" } });
    for (let i = 1; i <= 14; i++) {
      const persona = await p.person.create({
        data: { ownerId: utente.id, cognome: `Carico${s + 1}`, nome: `G${i}` } });
      await p.teamPlayer.create({
        data: { teamId: t.id, personId: persona.id, numeroMaglia: i,
                cognome: persona.cognome, nome: persona.nome },
      });
    }
    squadre.push(await p.team.findUniqueOrThrow({
      where: { id: t.id }, include: { giocatori: true } }));
  }

  console.log(`genero ${quante} partite…`);
  const t0 = Date.now();
  for (let i = 0; i < quante; i++) {
    const casa = squadre[i % squadre.length];
    const ospite = squadre[(i + 1 + (i % 3)) % squadre.length];
    if (casa.id === ospite.id) continue;

    const m = await p.match.create({
      data: {
        competitionId: camp.id, homeTeamId: casa.id, awayTeamId: ospite.id,
        createdById: utente.id, data: new Date(2026, 8, 1 + (i % 250)),
        stato: "READY", revisioneAnalisi: 1,
        tagJson: JSON.stringify([TAG]),
      },
    });

    for (const [lato, sq] of [["h", casa], ["a", ospite]]) {
      await p.matchPlayer.createMany({
        data: sq.giocatori.map((g) => ({
          matchId: m.id, lato, numeroMaglia: g.numeroMaglia,
          cognome: g.cognome, nome: g.nome, personId: g.personId,
        })),
      });
    }

    const gen = generaCasuale({ seme: 1000 + i, casa: casa.nome, ospite: ospite.nome });
    const { pacchetto } = adatta(m.id, 1, {
      events: gen.events, videos: gen.videos, frames: undefined });
    const pkg = allineaEventiAiSet(pacchetto);
    await p.analysis.create({
      data: { matchId: m.id, revision: 1,
              pacchettoJson: JSON.stringify(pkg),
              qualitaJson: JSON.stringify(pkg.qualita) },
    });
    if ((i + 1) % 25 === 0) console.log(`  ${i + 1}…`);
  }
  console.log(`  generate in ${Math.round((Date.now() - t0) / 1000)}s`);
}

async function misura(token) {
  const quante = await p.match.count({ where: { stato: "READY" } });
  const analisi = await p.analysis.findMany({ select: { pacchettoJson: true } });
  const pesoMB = analisi.reduce((s, a) => s + a.pacchettoJson.length, 0) / 1024 / 1024;

  const tempi = [];
  for (let g = 0; g < 3; g++) {
    const t = Date.now();
    const r = await fetch("http://localhost:3001/api/stats/players", {
      headers: { Authorization: "Bearer " + token } });
    const d = await r.json();
    tempi.push(Date.now() - t);
    if (g === 2) {
      console.log(`  partite analizzate: ${d.insieme?.partiteConsiderate} · righe: ${d.voci?.length}`);
    }
  }
  const medio = Math.round(tempi.reduce((a, b) => a + b, 0) / tempi.length);
  console.log(`  partite READY nel db: ${quante} · pacchetti: ${pesoMB.toFixed(1)} MB`);
  console.log(`  /stats/players: ${tempi.join(" / ")} ms  → medio ${medio} ms`);
  return { quante, pesoMB, medio };
}

(async () => {
  const arg = process.argv[2];
  if (arg === "pulisci") { await pulisci(); await p.$disconnect(); return; }

  const token = await accedi();
  if (arg && Number(arg)) await genera(Number(arg));
  await misura(token);
  await p.$disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
