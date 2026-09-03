/**
 * Dati di esempio per lo sviluppo.
 * Crea tre utenti (uno per ruolo), due squadre con roster e persone
 * collegate, un campionato e due partite in stati diversi.
 *
 * Esecuzione: npm run db:seed
 */
import { PrismaClient } from "@prisma/client";
import * as bcrypt from "bcryptjs";
import * as fs from "fs";
import * as path from "path";
import { generaCasuale } from "@vv/mock";
import { adatta, allineaEventiAiSet } from "../src/analysis/adapter";

const prisma = new PrismaClient();

const COGNOMI = ["Rossi", "Bianchi", "Ferrari", "Russo", "Esposito", "Romano",
                 "Colombo", "Ricci", "Marino", "Greco", "Bruno", "Gallo",
                 "Conti", "De Luca"];
const NOMI = ["Marco", "Luca", "Andrea", "Matteo", "Davide", "Simone", "Alessio",
              "Federico", "Giulio", "Tommaso", "Riccardo", "Stefano", "Paolo", "Nicola"];
const RUOLI = ["palleggiatore", "opposto", "schiacciatore", "centrale", "libero"];

async function main() {
  console.log("Pulizia...");
  await prisma.auditLog.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.uploadSession.deleteMany();
  await prisma.video.deleteMany();
  await prisma.substitution.deleteMany();
  await prisma.lineup.deleteMany();
  await prisma.matchPlayer.deleteMany();
  await prisma.match.deleteMany();
  await prisma.competitionShare.deleteMany();
  await prisma.competition.deleteMany();
  await prisma.teamShare.deleteMany();
  await prisma.teamPlayer.deleteMany();
  await prisma.team.deleteMany();
  await prisma.person.deleteMany();
  await prisma.authIdentity.deleteMany();
  await prisma.token.deleteMany();
  await prisma.user.deleteMany();

  /** Il ruolo comanda: la spunta `libero` non puo contraddirlo. */
  const coerente = (ruolo: string | null, libero: boolean) =>
    ruolo === "libero" ? true : libero && ruolo == null;

  const pwd = await bcrypt.hash("password123", 10);
  // L'utente non porta piu la password: la porta l'identita, come in esercizio.
  const mk = (email: string, nome: string, cognome: string, ruolo: string) =>
    prisma.user.create({
      data: {
        email, nome, cognome, ruolo, emailVerificataIl: new Date(),
        identita: { create: { provider: "password", providerUserId: email, passwordHash: pwd } },
      },
    });

  console.log("Utenti...");
  const admin = await mk("admin@volleyvision.test", "Anna", "Admin", "admin");
  await mk("segreteria@volleyvision.test", "Sara", "Segreteria", "segreteria");
  const utente = await mk("utente@volleyvision.test", "Ugo", "Utente", "utente");

  console.log("Campionato e squadre...");
  const camp = await prisma.competition.create({
    data: { ownerId: utente.id, nome: "Serie C maschile", stagione: "2026/2027",
            descrizione: "Girone B", dataInizio: new Date("2026-10-01"),
            dataFine: new Date("2027-05-31") },
  });

  async function squadra(nome: string, offset: number) {
    const t = await prisma.team.create({
      data: { ownerId: utente.id, nome, stagione: "2026/2027" } });
    for (let i = 0; i < 12; i++) {
      const cognome = COGNOMI[(i + offset) % COGNOMI.length];
      const nomeG = NOMI[(i + offset * 3) % NOMI.length];
      const p = await prisma.person.create({
        data: { ownerId: utente.id, cognome, nome: nomeG } });
      await prisma.teamPlayer.create({
        data: { teamId: t.id, personId: p.id, numeroMaglia: i + 1,
                cognome, nome: nomeG,
                ruolo: RUOLI[i % RUOLI.length],
                libero: coerente(RUOLI[i % RUOLI.length], false) },
      });
    }
    return t;
  }

  // Nomi verosimili con la citta dentro, come le societa vere. Inventati:
  // usare nomi di societa esistenti nei dati di prova non serve a nessuno.
  const casa = await squadra("Pallavolo Senigallia", 0);
  const ospite = await squadra("Volley Club Ancona", 5);

  console.log("Partite...");
  // Partita 1: completa di formazioni, in attesa dei video.
  const m1 = await prisma.match.create({
    data: { competitionId: camp.id, homeTeamId: casa.id, awayTeamId: ospite.id,
            createdById: utente.id, data: new Date("2026-10-12T18:00:00"),
            citta: "Senigallia", campo: "PalaPanzini",
            tagJson: JSON.stringify(["campionato", "casa"]),
            video: { create: [{ lato: 1 }, { lato: 2 }] } },
  });

  for (const [lato, teamId] of [["h", casa.id], ["a", ospite.id]] as const) {
    const roster = await prisma.teamPlayer.findMany({ where: { teamId } });
    await prisma.matchPlayer.createMany({
      data: roster.map((g) => ({
        matchId: m1.id, lato, numeroMaglia: g.numeroMaglia, cognome: g.cognome,
        nome: g.nome, ruolo: g.ruolo, libero: g.libero, personId: g.personId,
        capitano: g.numeroMaglia === 1,
      })),
    });
    await prisma.lineup.create({
      data: { matchId: m1.id, set: 1, lato, pos1: 1, pos2: 2, pos3: 3,
              pos4: 4, pos5: 5, pos6: 6, libero1: 9, primoServizio: lato === "h" },
    });
  }

  // Partita 2: gia pronta, con notifica non ancora vista.
  const m2 = await prisma.match.create({
    data: { competitionId: camp.id, homeTeamId: ospite.id, awayTeamId: casa.id,
            createdById: utente.id, data: new Date("2026-10-05T20:30:00"),
            citta: "Ancona", campo: "PalaVeneto", stato: "READY", revisioneAnalisi: 1,
            tagJson: JSON.stringify(["campionato", "trasferta"]),
            video: { create: [
              { lato: 1, stato: "NORMALIZZATO", nomeFile: "lato1.mp4", dimensione: BigInt(4_100_000_000),
                fps: 30, frameCount: 324000, caricatoIl: new Date() },
              { lato: 2, stato: "NORMALIZZATO", nomeFile: "lato2.mp4", dimensione: BigInt(4_050_000_000),
                fps: 30, frameCount: 324000, caricatoIl: new Date() },
            ] } },
  });
  /*
   * L'analisi della partita 2.
   *
   * Prima il seed scriveva `stato: READY` e basta: la pillola diceva "pronta"
   * e la schermata statistiche rispondeva che non c'era nulla. Uno stato che i
   * dati non sostengono e peggio di uno stato assente, perche fa credere a un
   * difetto dove c'e solo un dato mancante.
   *
   * Si passa dallo stesso percorso dell'esercizio — generatore, poi
   * adattatore — cosi i dati di esempio hanno gli stessi difetti dei dati veri
   * e le statistiche si vedono davvero.
   */
  /*
   * Il roster della partita gia pronta, con le PERSONE collegate.
   *
   * Non e un dettaglio del dato di esempio: senza persona collegata le
   * statistiche su piu partite non hanno righe, perche si aggrega sulla
   * persona e non sul numero di maglia (`docs/04-dati.md`). Una partita
   * "pronta" senza roster e incoerente quanto una "pronta" senza analisi.
   */
  for (const [lato, teamId] of [["h", ospite.id], ["a", casa.id]] as const) {
    const roster = await prisma.teamPlayer.findMany({ where: { teamId } });
    await prisma.matchPlayer.createMany({
      data: roster.map((g) => ({
        matchId: m2.id, lato, numeroMaglia: g.numeroMaglia, cognome: g.cognome,
        nome: g.nome, ruolo: g.ruolo, libero: g.libero, personId: g.personId,
        capitano: g.numeroMaglia === 1,
      })),
    });
  }

  console.log("Analisi della partita pronta...");
  const partita = generaCasuale({ seme: 20261005, casa: ospite.nome, ospite: casa.nome });
  const { pacchetto, frames } = adatta(m2.id, 1, {
    events: partita.events, videos: partita.videos, frames: partita.frames ?? undefined,
  });
  const allineato = allineaEventiAiSet(pacchetto);

  let framesKey: string | null = null;
  if (frames.length) {
    framesKey = path.join(process.env.STORAGE_LOCAL_DIR ?? "./storage-dev",
                          "analysis", m2.id, "frames-1.json");
    fs.mkdirSync(path.dirname(framesKey), { recursive: true });
    fs.writeFileSync(framesKey, JSON.stringify(frames));
  }

  await prisma.analysis.create({
    data: { matchId: m2.id, revision: 1,
            pacchettoJson: JSON.stringify(allineato),
            qualitaJson: JSON.stringify(allineato.qualita),
            framesKey },
  });
  console.log(`  ${allineato.events.length} eventi, ${allineato.actions.length} azioni, `
              + `${allineato.sets.length} set`);

  await prisma.notification.create({
    data: { userId: utente.id, matchId: m2.id, tipo: "partita_pronta" } });

  await prisma.auditLog.create({
    data: { actorId: admin.id, azione: "seed", dettaglio: "dati di esempio caricati" } });

  console.log(`
Pronto.

  Accessi (password: password123)
    admin@volleyvision.test        ruolo admin
    segreteria@volleyvision.test   ruolo segreteria
    utente@volleyvision.test       ruolo utente

  1 campionato, 2 squadre da 12 giocatori, 2 partite
  (una in attesa di video, una pronta con l'analisi e le statistiche).
`);
}

main().catch((e) => { console.error(e); process.exit(1); })
      .finally(() => prisma.$disconnect());
