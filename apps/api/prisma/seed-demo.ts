/**
 * DATI DIMOSTRATIVI — cinque utenti con un mondo ciascuno.
 *
 * Diverso da `seed.ts`, che crea il minimo per sviluppare: questo riempie il
 * database come se cinque persone lo usassero da qualche mese.
 *
 *   npx tsx prisma/seed-demo.ts           # aggiunge
 *   npx tsx prisma/seed-demo.ts --rifai   # cancella i suoi e rifa
 *
 * Per ciascuno: **6 squadre** con roster completo, **3 partite** — due gia
 * analizzate e una in attesa dei video.
 *
 * ## Due cose che non sono ornamento
 *
 * **I roster puntano a `Person`.** Senza persona collegata le statistiche su
 * piu partite non hanno righe: si aggrega sulla persona, non sul numero di
 * maglia. Un dato dimostrativo che non lo facesse mostrerebbe schermate vuote
 * proprio dove il prodotto ha piu da dire.
 *
 * **Le partite "pronte" hanno un'analisi vera**, generata dallo stesso
 * percorso dell'esercizio: generatore sintetico, poi adattatore. Uno stato che
 * i dati non sostengono e peggio di uno stato assente — fa credere a un
 * difetto dove c'e solo un dato mancante.
 *
 * Ogni utente ha citta, squadre e campionato suoi: serve a vedere subito, in
 * amministrazione, che i dati di uno non finiscono nelle schermate di un
 * altro.
 */
import { Prisma, PrismaClient } from "@prisma/client";
import * as bcrypt from "bcryptjs";
import * as fs from "fs";
import * as path from "path";
import { generaCasuale } from "@vv/mock";
import { adatta, allineaEventiAiSet } from "../src/analysis/adapter";

const prisma = new PrismaClient();

const COGNOMI = [
  "Rossi", "Bianchi", "Ferrari", "Russo", "Esposito", "Romano", "Colombo",
  "Ricci", "Marino", "Greco", "Bruno", "Gallo", "Conti", "De Luca", "Costa",
  "Giordano", "Mancini", "Rizzo", "Lombardi", "Moretti", "Barbieri", "Fontana",
  "Caruso", "Ferrara", "Santoro", "Mariani", "Rinaldi", "Leone", "Longo", "Martini",
];
const NOMI = [
  "Marco", "Luca", "Andrea", "Matteo", "Davide", "Simone", "Alessio", "Federico",
  "Giulio", "Tommaso", "Riccardo", "Stefano", "Paolo", "Nicola", "Filippo",
  "Lorenzo", "Gabriele", "Emanuele", "Cristian", "Michele",
];
const RUOLI = ["palleggiatore", "opposto", "schiacciatore", "centrale", "libero"];

/** Il ruolo comanda: la spunta `libero` non puo contraddirlo. */
const coerente = (ruolo: string | null) => ruolo === "libero";

/**
 * I cinque mondi.
 *
 * Ognuno ha la sua zona: le squadre di Marcello sono marchigiane, quelle di
 * Fabio venete, e cosi via. Non e folklore — con nomi tutti uguali non si
 * distinguerebbe a colpo d'occhio di chi sono i dati che si sta guardando.
 */
const MONDI = [
  {
    nome: "Marcello", cognome: "Bernardi", citta: "Senigallia",
    campionato: "Serie C maschile Marche", stagione: "2026/2027",
    squadre: ["Pallavolo Senigallia", "Volley Club Ancona", "Jesi Volley",
              "Pesaro Pallavolo", "Fano Volley 2005", "Falconara Team Volley"],
  },
  {
    nome: "Fabio", cognome: "Zanetti", citta: "Treviso",
    campionato: "Serie B2 Veneto", stagione: "2026/2027",
    squadre: ["Treviso Volley", "Pallavolo Castelfranco", "Conegliano Sport",
              "Montebelluna Volley", "Vittorio Veneto Pallavolo", "Oderzo Team"],
  },
  {
    nome: "Antonio", cognome: "Esposito", citta: "Salerno",
    campionato: "Serie D Campania", stagione: "2026/2027",
    squadre: ["Pallavolo Salerno", "Cava Volley", "Battipaglia Sport",
              "Nocera Pallavolo", "Sarno Volley Club", "Eboli Team Volley"],
  },
  {
    nome: "Andrea", cognome: "Ferraris", citta: "Cuneo",
    campionato: "Serie C maschile Piemonte", stagione: "2026/2027",
    squadre: ["Cuneo Pallavolo", "Alba Volley", "Bra Sport Volley",
              "Mondovi Team", "Savigliano Pallavolo", "Fossano Volley"],
  },
  {
    nome: "Paolo", cognome: "Lombardo", citta: "Ragusa",
    campionato: "Serie D Sicilia", stagione: "2026/2027",
    squadre: ["Pallavolo Ragusa", "Modica Volley", "Vittoria Sport",
              "Comiso Team Volley", "Scicli Pallavolo", "Ispica Volley Club"],
  },
];

const EMAIL = (n: string) => `${n.toLowerCase()}@volleyvision.test`;

async function rimuoviPrecedenti() {
  const utenti = await prisma.user.findMany({
    where: { email: { in: MONDI.map((m) => EMAIL(m.nome)) } }, select: { id: true } });
  if (!utenti.length) return 0;

  const ids = utenti.map((u) => u.id);

  /*
   * I file delle posizioni **non stanno nel database**: sono su disco, e la
   * cascata delle chiavi esterne non li tocca. Cancellando solo le righe si
   * lascerebbero 4-5 MB per partita di file che non appartengono piu a
   * nessuno, e a ogni `--rifai` se ne aggiungerebbero altri.
   */
  // In ordine di dipendenza: prima cio che cita, poi cio che e citato.
  // Le partite portano via da sole roster, formazioni, video e analisi
  // (cascata sulle chiavi esterne); campionati e squadre no.
  await prisma.notification.deleteMany({ where: { userId: { in: ids } } });
  await prisma.auditLog.deleteMany({ where: { actorId: { in: ids } } });
  await prisma.match.deleteMany({ where: { createdById: { in: ids } } });
  await prisma.competition.deleteMany({ where: { ownerId: { in: ids } } });
  await prisma.team.deleteMany({ where: { ownerId: { in: ids } } });
  await prisma.person.deleteMany({ where: { ownerId: { in: ids } } });
  await prisma.user.deleteMany({ where: { id: { in: ids } } });
  return utenti.length;
}

async function main() {
  const rifai = process.argv.includes("--rifai");

  /*
   * `--solo-reale`: aggiunge la partita vera senza rifare i mondi sintetici.
   *
   * Serve perche i dati sintetici sono ~100 MB di posizioni, e su un database
   * remoto scriverli richiede minuti: se il collegamento cade a meta, la
   * partita reale — che si crea per ultima — non arriva mai. Con questa
   * opzione la si aggiunge da sola, agli utenti che ci sono gia.
   */
  if (process.argv.includes("--solo-reale")) {
    const utenti = await prisma.user.findMany({
      where: { email: { in: MONDI.map((m) => EMAIL(m.nome)) } },
      select: { id: true, nome: true },
      orderBy: { creatoIl: "asc" },
    });
    if (!utenti.length) {
      console.error("Nessun utente dimostrativo: esegui prima il seed completo.");
      process.exit(1);
    }
    // Si toglie la precedente, se c'e: rieseguire deve sostituire.
    await prisma.competition.deleteMany({
      where: { nome: "Volleyball Nations League", ownerId: utenti[0].id } });
    await partitaReale(utenti);
    await prisma.$disconnect();
    return;
  }

  const esistenti = await prisma.user.count({
    where: { email: { in: MONDI.map((m) => EMAIL(m.nome)) } } });
  if (esistenti && !rifai) {
    console.error(
      `Ci sono gia ${esistenti} utenti dimostrativi.\n` +
      `Rilanciare con --rifai per cancellarli e ricrearli.`);
    process.exit(1);
  }
  if (rifai) {
    const n = await rimuoviPrecedenti();
    if (n) console.log(`Rimossi ${n} utenti dimostrativi precedenti.\n`);
  }

  const pwd = await bcrypt.hash("password123", 10);
  let totPartite = 0, totAnalisi = 0, totPosizioni = 0;
  const utenti: { id: string; nome: string }[] = [];

  for (const [iM, mondo] of MONDI.entries()) {
    console.log(`\n${mondo.nome} ${mondo.cognome} — ${mondo.citta}`);

    const utente = await prisma.user.create({
      data: {
        email: EMAIL(mondo.nome), nome: mondo.nome, cognome: mondo.cognome,
        ruolo: "utente", emailVerificataIl: new Date(),
        privacyAccettataIl: new Date(), privacyVersione: "1.0",
        identita: { create: { provider: "password",
                              providerUserId: EMAIL(mondo.nome), passwordHash: pwd } },
      },
    });

    const camp = await prisma.competition.create({
      data: {
        ownerId: utente.id, nome: mondo.campionato, stagione: mondo.stagione,
        descrizione: `Girone ${"ABCDE"[iM]}`,
        dataInizio: new Date("2026-10-01"), dataFine: new Date("2027-05-31"),
      },
    });

    // --- le sei squadre, ciascuna con dodici giocatori collegati a persone ---
    // Il tipo si dichiara: partendo da `[]` TypeScript lo dedurrebbe `any[]`,
    // e da li in poi il roster non sarebbe piu controllato da nessuno.
    type SquadraConRoster = Prisma.TeamGetPayload<{ include: { giocatori: true } }>;
    const squadre: SquadraConRoster[] = [];
    for (const [iS, nomeSq] of mondo.squadre.entries()) {
      const t = await prisma.team.create({
        data: { ownerId: utente.id, nome: nomeSq, stagione: mondo.stagione } });

      /*
       * In blocco, non una riga per volta.
       *
       * Erano due `create` per giocatore: 720 viaggi fino al database per
       * cinque utenti. In locale non si nota, su un database remoto sono
       * minuti — e se il seed viene interrotto, cio che si crea per ultimo
       * (la partita reale) non arriva mai. Con `createMany` restano due
       * chiamate per squadra.
       *
       * Gli identificativi si generano qui perche `createMany` non li
       * restituisce, e servono subito per collegare i giocatori alle persone.
       */
      const persone: { id: string; ownerId: string; cognome: string; nome: string }[] = [];
      const rosa: { id: string; teamId: string; personId: string; numeroMaglia: number;
                    cognome: string; nome: string; ruolo: string; libero: boolean }[] = [];
      for (let i = 0; i < 12; i++) {
        // Lo scarto per utente e per squadra evita che i dodici giocatori
        // della prima squadra siano gli stessi dodici di tutte le altre.
        const cognome = COGNOMI[(i + iS * 5 + iM * 7) % COGNOMI.length];
        const nome = NOMI[(i * 3 + iS + iM * 4) % NOMI.length];
        const ruolo = RUOLI[i % RUOLI.length];
        const idPersona = `seed_p_${iM}_${iS}_${i}`;
        persone.push({ id: idPersona, ownerId: utente.id, cognome, nome });
        rosa.push({ id: `seed_tp_${iM}_${iS}_${i}`, teamId: t.id, personId: idPersona,
                    numeroMaglia: i + 1, cognome, nome, ruolo, libero: coerente(ruolo) });
      }
      await prisma.person.createMany({ data: persone });
      await prisma.teamPlayer.createMany({ data: rosa });

      squadre.push(await prisma.team.findUniqueOrThrow({
        where: { id: t.id }, include: { giocatori: true } }));
    }
    console.log(`  ${squadre.length} squadre, ${squadre.length * 12} giocatori`);

    /** Copia il roster di una squadra sulla partita, con le persone. */
    const copiaRoster = async (matchId: string, lato: "h" | "a", sq: typeof squadre[0]) =>
      prisma.matchPlayer.createMany({
        data: sq.giocatori.map((g) => ({
          matchId, lato, numeroMaglia: g.numeroMaglia, cognome: g.cognome,
          nome: g.nome, ruolo: g.ruolo, libero: g.libero, personId: g.personId,
          capitano: g.numeroMaglia === 1,
        })),
      });

    // --- tre partite: due analizzate, una in attesa dei video ---------------
    for (let iP = 0; iP < 3; iP++) {
      const casa = squadre[iP * 2];
      const ospite = squadre[iP * 2 + 1];
      const pronta = iP < 2;
      const data = new Date(2026, 9, 4 + iP * 9, 18 + iP, 30);

      const m = await prisma.match.create({
        data: {
          competitionId: camp.id, homeTeamId: casa.id, awayTeamId: ospite.id,
          createdById: utente.id, data,
          citta: casa.nome.split(" ").pop() ?? mondo.citta,
          campo: `Pala${(casa.nome.split(" ").pop() ?? "Sport").slice(0, 8)}`,
          arbitri: pronta ? "Designazione ufficiale" : null,
          numeroSet: pronta ? 3 : null,
          stato: pronta ? "READY" : "WAITING",
          revisioneAnalisi: pronta ? 1 : null,
          tagJson: JSON.stringify(["campionato", iP % 2 === 0 ? "casa" : "trasferta"]),
          video: {
            create: pronta
              ? [1, 2].map((lato) => ({
                  lato, stato: "NORMALIZZATO", nomeFile: `lato${lato}.mp4`,
                  // Dimensioni un po' diverse fra loro: due riprese non pesano
                  // mai uguali, e serve a vedere che il numero non e cablato.
                  dimensione: BigInt(3_800_000_000 + iM * 90_000_000 + lato * 40_000_000),
                  fps: 30, frameCount: 148_000 + iP * 3_000, caricatoIl: data,
                }))
              // In attesa: i due posti ci sono, i file no.
              : [{ lato: 1 }, { lato: 2 }],
          },
        },
      });
      totPartite++;

      await copiaRoster(m.id, "h", casa);
      await copiaRoster(m.id, "a", ospite);

      if (!pronta) {
        // Le formazioni si dichiarano prima dei video: la partita in attesa
        // le ha, altrimenti non sarebbe pronta per essere mandata in analisi.
        for (const lato of ["h", "a"] as const) {
          await prisma.lineup.create({
            data: { matchId: m.id, set: 1, lato, pos1: 1, pos2: 2, pos3: 3,
                    pos4: 4, pos5: 5, pos6: 6, libero1: 5,
                    primoServizio: lato === "h" },
          });
        }
        continue;
      }

      // --- l'analisi, dallo stesso percorso dell'esercizio -----------------
      const partita = generaCasuale({
        // Seme diverso per ogni partita di ogni utente: due partite identiche
        // renderebbero sospette le statistiche.
        seme: 20260000 + iM * 100 + iP,
        casa: casa.nome, ospite: ospite.nome,
      });
      const { pacchetto, frames } = adatta(m.id, 1, {
        events: partita.events, videos: partita.videos,
        frames: partita.frames ?? undefined,
      });
      const allineato = allineaEventiAiSet(pacchetto);

      const analisi = await prisma.analysis.create({
        data: { matchId: m.id, revision: 1,
                pacchettoJson: JSON.stringify(allineato),
                qualitaJson: JSON.stringify(allineato.qualita), framesKey: null },
      });
      totAnalisi++;

      // Le posizioni nel database, in un blocco: cosi il campo bidimensionale
      // funziona anche dove il disco e effimero, e il client se le porta via
      // tutte insieme per usarle senza rete.
      if (frames.length) {
        const dati = JSON.stringify(frames);
        await prisma.analysisPosizioni.create({
          data: { analysisId: analisi.id, datiJson: dati,
                  fotogrammi: frames.length, byte: dati.length },
        });
        totPosizioni += frames.length;
      }

      // La notifica della prima partita resta da leggere: cosi il campanello
      // in alto mostra qualcosa appena si entra.
      await prisma.notification.create({
        data: { userId: utente.id, matchId: m.id, tipo: "partita_pronta",
                vistaIl: iP === 0 ? null : new Date() },
      });
    }
    console.log(`  3 partite (2 analizzate, 1 in attesa video)`);
    utenti.push(utente);
  }

  await partitaReale(utenti);

  console.log(`
Pronto.

  5 utenti, password: password123
${MONDI.map((m) => `    ${EMAIL(m.nome).padEnd(30)} ${m.citta}`).join("\n")}

  30 squadre · 360 giocatori · ${totPartite} partite · ${totAnalisi} analisi
  ${totPosizioni.toLocaleString("it-IT")} fotogrammi con posizioni

  Ogni utente vede solo i propri dati: entrando con due utenze diverse le
  schermate non devono avere nulla in comune.
`);
}

/**
 * LA PARTITA VERA — una copia sola, condivisa con tutti.
 *
 * Bulgaria vs Cina, VNL 2021: gli unici dati reali del fornitore. E l'unica
 * partita su cui il campo bidimensionale e il salto al fotogramma si possono
 * confrontare con un video vero — le sintetiche non hanno un video.
 *
 * **Condivisa e non duplicata.** Duplicarla darebbe a ognuno dieci megabyte
 * di posizioni identiche; e soprattutto sarebbero cinque partite diverse, e
 * una correzione su una non si vedrebbe sulle altre. `CompetitionShare` fa
 * esattamente questo lavoro, ed esiste gia.
 *
 * Passa dallo stesso adattatore dell'esercizio, quindi porta con se i difetti
 * dei dati veri — confini dei set sbagliati, 15% di eventi senza giocatore.
 * E cio che la rende utile: le sintetiche sono troppo pulite.
 */
async function partitaReale(utenti: { id: string; nome: string }[]) {
  // `__dirname` e la cartella DI QUESTO FILE (apps/api/prisma): per
  // arrivare alla radice del progetto si risale di tre.
  //
  // Ci ero gia cascato: avevo "corretto" a due dopo una prova fatta da
  // apps/api/ invece che da qui, quindi misurava un'altra cartella. Il seed
  // non trovava piu i file e saltava la partita in silenzio. Se si tocca
  // questa riga, la prova va fatta da dentro `prisma/`.
  const dir = path.join(__dirname, "..", "..", "..", "dati-di-prova", "reale");
  const leggi = (n: string) => JSON.parse(fs.readFileSync(path.join(dir, n), "utf-8"));

  if (!fs.existsSync(path.join(dir, "events.json"))) {
    console.log("Partita reale: file non trovati in dati-di-prova/reale, saltata.");
    return;
  }

  const proprietario = utenti[0];
  console.log(`
Partita reale — di ${proprietario.nome}, condivisa con gli altri`);

  const camp = await prisma.competition.create({
    data: { ownerId: proprietario.id, nome: "Volleyball Nations League",
            stagione: "2021", descrizione: "Dati reali del fornitore" },
  });

  // Le due nazionali: squadre normali, come le creerebbe un utente.
  const squadre: Record<string, string> = {};
  for (const nome of ["Bulgaria", "Cina"]) {
    const t = await prisma.team.create({
      data: { ownerId: proprietario.id, nome, stagione: "2021" } });
    squadre[nome] = t.id;
  }

  const m = await prisma.match.create({
    data: {
      competitionId: camp.id, homeTeamId: squadre["Bulgaria"], awayTeamId: squadre["Cina"],
      createdById: proprietario.id, data: new Date("2021-06-01T20:00:00"),
      citta: "Rimini", campo: "VNL Bubble", numeroSet: 3,
      stato: "READY", revisioneAnalisi: 1,
      tagJson: JSON.stringify(["reale", "fornitore"]),
      video: { create: [1, 2].map((lato) => ({
        lato, stato: "NORMALIZZATO", nomeFile: `lato${lato}.mp4`,
        fps: 30, frameCount: 148648, caricatoIl: new Date("2021-06-01T20:00:00"),
      })) },
    },
  });

  const { pacchetto, frames } = adatta(m.id, 1, {
    events: leggi("events.json"), videos: leggi("videos.json"), frames: leggi("frames.json"),
  });
  const allineato = allineaEventiAiSet(pacchetto);

  const analisi = await prisma.analysis.create({
    data: { matchId: m.id, revision: 1,
            pacchettoJson: JSON.stringify(allineato),
            qualitaJson: JSON.stringify(allineato.qualita), framesKey: null },
  });

  if (frames.length) {
    const dati = JSON.stringify(frames);
    await prisma.analysisPosizioni.create({
      data: { analysisId: analisi.id, datiJson: dati,
              fotogrammi: frames.length, byte: dati.length },
    });
  }

  // Il roster della partita: i numeri che il fornitore ha visto in campo.
  // Non collegati a `Person`, e non e una svista — sono giocatori di due
  // nazionali, non persone dell'anagrafica di chi guarda.
  const maglie = new Map<string, Set<number>>([["h", new Set()], ["a", new Set()]]);
  for (const e of allineato.events) {
    if (e.jersey != null) maglie.get(e.team)!.add(e.jersey);
  }
  for (const [lato, numeri] of maglie) {
    await prisma.matchPlayer.createMany({
      data: [...numeri].sort((x, y) => x - y).map((n) => ({
        matchId: m.id, lato, numeroMaglia: n,
        cognome: lato === "h" ? "BUL" : "CHN", nome: `n.${n}`,
      })),
    });
  }

  // La condivisione: gli altri quattro la vedono senza averne una copia.
  for (const u of utenti.slice(1)) {
    await prisma.competitionShare.create({
      data: { competitionId: camp.id, userId: u.id,
              email: `${u.nome.toLowerCase()}@volleyvision.test` },
    });
  }

  console.log(`  ${allineato.events.length} eventi · ${allineato.actions.length} azioni · `
            + `${frames.length.toLocaleString("it-IT")} fotogrammi con posizioni`);
  console.log(`  condivisa con ${utenti.length - 1} utenti`);
}

main().catch((e) => { console.error(e); process.exit(1); })
      .finally(() => prisma.$disconnect());
