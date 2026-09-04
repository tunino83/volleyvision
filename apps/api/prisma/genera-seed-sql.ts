/**
 * GENERA UN SEED IN SQL PURO — da eseguire dove non si puo lanciare Node.
 *
 *   npx tsx prisma/genera-seed-sql.ts > prisma/seed-demo.sql
 *
 * Stessi dati di `seed-demo.ts`: cinque utenti, sei squadre e tre partite
 * ciascuno, due gia analizzate e una in attesa dei video. **Il file SQL non
 * si scrive a mano**: si genera da qui, cosi non puo divergere dalla logica
 * del seed vero ne dallo schema.
 *
 * Serve quando la Shell della piattaforma non e disponibile (e il caso del
 * piano gratuito di alcuni hosting) e si ha in mano solo un client SQL.
 *
 * ## Cosa NON fa, e non e una svista
 *
 * **Non scrive nulla su disco**, e non serve piu: dalla revisione di
 * settembre le posizioni stanno nel database (`PosizioneFrame`, una riga per
 * fotogramma) e il file SQL le include. `framesKey` resta nullo, ed e giusto:
 * indicava il vecchio file.
 *
 * ## Due dettagli di PostgreSQL che rompono se si sbagliano
 *
 * **Le maiuscole vanno virgolettate.** Prisma crea `"User"`, non `user`:
 * senza virgolette PostgreSQL abbassa il nome e non trova la tabella. Vale
 * anche per le colonne in maiuscolo-minuscolo come `"numeroMaglia"`.
 *
 * **Gli apici nei dati vanno raddoppiati.** I pacchetti di analisi sono JSON
 * da 150 KB: basta un apice non protetto per troncare la stringa e rendere
 * illeggibile tutto il resto del file.
 */
import * as bcrypt from "bcryptjs";
import { generaCasuale } from "@vv/mock";
import { adatta, allineaEventiAiSet } from "../src/analysis/adapter";

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

const MONDI = [
  { nome: "Marcello", cognome: "Bernardi", citta: "Senigallia",
    campionato: "Serie C maschile Marche",
    squadre: ["Pallavolo Senigallia", "Volley Club Ancona", "Jesi Volley",
              "Pesaro Pallavolo", "Fano Volley 2005", "Falconara Team Volley"] },
  { nome: "Fabio", cognome: "Zanetti", citta: "Treviso",
    campionato: "Serie B2 Veneto",
    squadre: ["Treviso Volley", "Pallavolo Castelfranco", "Conegliano Sport",
              "Montebelluna Volley", "Vittorio Veneto Pallavolo", "Oderzo Team"] },
  { nome: "Antonio", cognome: "Esposito", citta: "Salerno",
    campionato: "Serie D Campania",
    squadre: ["Pallavolo Salerno", "Cava Volley", "Battipaglia Sport",
              "Nocera Pallavolo", "Sarno Volley Club", "Eboli Team Volley"] },
  { nome: "Andrea", cognome: "Ferraris", citta: "Cuneo",
    campionato: "Serie C maschile Piemonte",
    squadre: ["Cuneo Pallavolo", "Alba Volley", "Bra Sport Volley",
              "Mondovi Team", "Savigliano Pallavolo", "Fossano Volley"] },
  { nome: "Paolo", cognome: "Lombardo", citta: "Ragusa",
    campionato: "Serie D Sicilia",
    squadre: ["Pallavolo Ragusa", "Modica Volley", "Vittoria Sport",
              "Comiso Team Volley", "Scicli Pallavolo", "Ispica Volley Club"] },
];

const STAGIONE = "2026/2027";

/* Identificativi prevedibili invece di cuid casuali: un seed che si puo
   rieseguire deve poter anche cancellare cio che ha creato, e con id
   riconoscibili la cancellazione e una sola clausola invece di una lista. */
const id = (tipo: string, ...parti: (string | number)[]) =>
  `seed_${tipo}_${parti.join("_")}`;

/** Apici raddoppiati: e cio che tiene insieme i 150 KB di JSON per riga. */
const S = (v: string | null | undefined) =>
  v == null ? "NULL" : `'${v.replace(/'/g, "''")}'`;
const N = (v: number | null | undefined) => (v == null ? "NULL" : String(v));
const B = (v: boolean) => (v ? "true" : "false");
const D = (v: Date | null) => (v == null ? "NULL" : `'${v.toISOString()}'`);

const righe: string[] = [];
const ora = new Date();

righe.push(`-- Seed dimostrativo di Volley Vision — GENERATO, non scrivere a mano.
-- Rigenerare con:  npx tsx prisma/genera-seed-sql.ts > prisma/seed-demo.sql
--
-- Cinque utenti (password: password123), sei squadre e tre partite ciascuno.
-- Include le posizioni dei giocatori (tabella "PosizioneFrame"), quindi il
-- campo bidimensionale funziona. Sono la parte piu voluminosa del file.
--
-- Si puo rieseguire: la transazione comincia cancellando cio che un seed
-- precedente aveva creato, riconoscibile dal prefisso "seed_".

BEGIN;

-- L'ordine e quello delle dipendenze: prima cio che cita, poi cio che e
-- citato. Le partite portano via da sole roster, formazioni, video e analisi
-- (ON DELETE CASCADE); squadre e campionati vanno tolti a parte.
DELETE FROM "Notification" WHERE "userId" LIKE 'seed_%';
DELETE FROM "AuditLog"     WHERE "actorId" LIKE 'seed_%';
DELETE FROM "Match"        WHERE "createdById" LIKE 'seed_%';
DELETE FROM "Competition"  WHERE "ownerId" LIKE 'seed_%';
DELETE FROM "Team"         WHERE "ownerId" LIKE 'seed_%';
DELETE FROM "Person"       WHERE "ownerId" LIKE 'seed_%';
DELETE FROM "AuthIdentity" WHERE "userId" LIKE 'seed_%';
DELETE FROM "User"         WHERE "id" LIKE 'seed_%';
`);

const pwd = bcrypt.hashSync("password123", 10);
let nAnalisi = 0;
let nPosizioni = 0;

for (const [iM, mondo] of MONDI.entries()) {
  const uid = id("user", iM);
  const email = `${mondo.nome.toLowerCase()}@volleyvision.test`;

  righe.push(`\n-- ============ ${mondo.nome} ${mondo.cognome} — ${mondo.citta}`);
  righe.push(`INSERT INTO "User" ("id","email","nome","cognome","ruolo","stato","emailVerificataIl","creatoIl","privacyAccettataIl","privacyVersione") VALUES
  (${S(uid)}, ${S(email)}, ${S(mondo.nome)}, ${S(mondo.cognome)}, 'utente', 'attivo', ${D(ora)}, ${D(ora)}, ${D(ora)}, '1.0');`);

  righe.push(`INSERT INTO "AuthIdentity" ("id","userId","provider","providerUserId","passwordHash","creatoIl") VALUES
  (${S(id("ident", iM))}, ${S(uid)}, 'password', ${S(email)}, ${S(pwd)}, ${D(ora)});`);

  const cid = id("comp", iM);
  righe.push(`INSERT INTO "Competition" ("id","ownerId","nome","stagione","descrizione","dataInizio","dataFine","creatoIl") VALUES
  (${S(cid)}, ${S(uid)}, ${S(mondo.campionato)}, ${S(STAGIONE)}, ${S("Girone " + "ABCDE"[iM])}, '2026-10-01T00:00:00.000Z', '2027-05-31T00:00:00.000Z', ${D(ora)});`);

  // --- squadre, persone, roster ---
  const squadre: { id: string; nome: string; giocatori: any[] }[] = [];
  for (const [iS, nomeSq] of mondo.squadre.entries()) {
    const tid = id("team", iM, iS);
    righe.push(`INSERT INTO "Team" ("id","ownerId","nome","stagione","creatoIl") VALUES
  (${S(tid)}, ${S(uid)}, ${S(nomeSq)}, ${S(STAGIONE)}, ${D(ora)});`);

    const giocatori: any[] = [];
    const persone: string[] = [];
    const players: string[] = [];
    for (let i = 0; i < 12; i++) {
      const cognome = COGNOMI[(i + iS * 5 + iM * 7) % COGNOMI.length];
      const nome = NOMI[(i * 3 + iS + iM * 4) % NOMI.length];
      const ruolo = RUOLI[i % RUOLI.length];
      const pid = id("pers", iM, iS, i);

      persone.push(`  (${S(pid)}, ${S(uid)}, ${S(cognome)}, ${S(nome)}, ${D(ora)})`);
      players.push(`  (${S(id("tp", iM, iS, i))}, ${S(tid)}, ${S(pid)}, ${N(i + 1)}, ${S(cognome)}, ${S(nome)}, ${S(ruolo)}, ${B(ruolo === "libero")})`);
      giocatori.push({ personId: pid, numeroMaglia: i + 1, cognome, nome, ruolo, libero: ruolo === "libero" });
    }
    righe.push(`INSERT INTO "Person" ("id","ownerId","cognome","nome","creatoIl") VALUES\n${persone.join(",\n")};`);
    righe.push(`INSERT INTO "TeamPlayer" ("id","teamId","personId","numeroMaglia","cognome","nome","ruolo","libero") VALUES\n${players.join(",\n")};`);

    squadre.push({ id: tid, nome: nomeSq, giocatori });
  }

  // --- tre partite: due analizzate, una in attesa video ---
  for (let iP = 0; iP < 3; iP++) {
    const casa = squadre[iP * 2];
    const ospite = squadre[iP * 2 + 1];
    const pronta = iP < 2;
    const mid = id("match", iM, iP);
    const data = new Date(2026, 9, 4 + iP * 9, 18 + iP, 30);
    const citta = casa.nome.split(" ").pop() ?? mondo.citta;

    righe.push(`\n-- ${casa.nome} vs ${ospite.nome}${pronta ? " (analizzata)" : " (in attesa video)"}`);
    righe.push(`INSERT INTO "Match" ("id","competitionId","homeTeamId","awayTeamId","createdById","data","citta","campo","arbitri","numeroSet","stato","statoAggiornatoIl","revisioneAnalisi","tagJson","creatoIl") VALUES
  (${S(mid)}, ${S(cid)}, ${S(casa.id)}, ${S(ospite.id)}, ${S(uid)}, ${D(data)}, ${S(citta)}, ${S("Pala" + citta.slice(0, 8))}, ${pronta ? S("Designazione ufficiale") : "NULL"}, ${pronta ? 3 : "NULL"}, ${pronta ? "'READY'" : "'WAITING'"}, ${D(ora)}, ${pronta ? 1 : "NULL"}, ${S(JSON.stringify(["campionato", iP % 2 === 0 ? "casa" : "trasferta"]))}, ${D(ora)});`);

    // video
    const video: string[] = [];
    for (const lato of [1, 2]) {
      video.push(pronta
        ? `  (${S(id("vid", iM, iP, lato))}, ${S(mid)}, ${N(lato)}, 'NORMALIZZATO', ${S(`lato${lato}.mp4`)}, ${N(3_800_000_000 + iM * 90_000_000 + lato * 40_000_000)}, 30, ${N(148_000 + iP * 3_000)}, ${D(data)})`
        : `  (${S(id("vid", iM, iP, lato))}, ${S(mid)}, ${N(lato)}, 'ASSENTE', NULL, NULL, NULL, NULL, NULL)`);
    }
    righe.push(`INSERT INTO "Video" ("id","matchId","lato","stato","nomeFile","dimensione","fps","frameCount","caricatoIl") VALUES\n${video.join(",\n")};`);

    // roster della partita, con le persone collegate
    const mp: string[] = [];
    for (const [lato, sq] of [["h", casa], ["a", ospite]] as const) {
      for (const g of sq.giocatori) {
        mp.push(`  (${S(id("mp", iM, iP, lato, g.numeroMaglia))}, ${S(mid)}, ${S(g.personId)}, ${S(lato)}, ${N(g.numeroMaglia)}, ${S(g.cognome)}, ${S(g.nome)}, ${S(g.ruolo)}, ${B(g.libero)}, ${B(g.numeroMaglia === 1)})`);
      }
    }
    righe.push(`INSERT INTO "MatchPlayer" ("id","matchId","personId","lato","numeroMaglia","cognome","nome","ruolo","libero","capitano") VALUES\n${mp.join(",\n")};`);

    if (!pronta) {
      const lu: string[] = [];
      for (const lato of ["h", "a"] as const) {
        lu.push(`  (${S(id("lu", iM, iP, lato))}, ${S(mid)}, 1, ${S(lato)}, 1, 2, 3, 4, 5, 6, 5, NULL, ${B(lato === "h")})`);
      }
      righe.push(`INSERT INTO "Lineup" ("id","matchId","set","lato","pos1","pos2","pos3","pos4","pos5","pos6","libero1","libero2","primoServizio") VALUES\n${lu.join(",\n")};`);
      continue;
    }

    // --- l'analisi, dallo stesso percorso dell'esercizio ---
    const partita = generaCasuale({
      seme: 20260000 + iM * 100 + iP, casa: casa.nome, ospite: ospite.nome });
    const { pacchetto, frames } = adatta(mid, 1, {
      events: partita.events, videos: partita.videos,
      frames: partita.frames ?? undefined });
    const allineato = allineaEventiAiSet(pacchetto);
    nAnalisi++;

    righe.push(`INSERT INTO "Analysis" ("id","matchId","revision","pacchettoJson","qualitaJson","framesKey","creatoIl","aggiornatoIl") VALUES
  (${S(id("an", iM, iP))}, ${S(mid)}, 1, ${S(JSON.stringify(allineato))}, ${S(JSON.stringify(allineato.qualita))}, NULL, ${D(ora)}, ${D(ora)});`);

    /*
     * Le posizioni, in un blocco unico.
     *
     * Un solo INSERT per partita e non una riga per fotogramma: il client se
     * le porta via tutte insieme, quindi il database non ha motivo di
     * tenerle separate — e ventimila righe di INSERT farebbero un file
     * ingestibile.
     */
    const anId = id("an", iM, iP);
    if (frames.length) {
      const dati = JSON.stringify(frames);
      righe.push(`INSERT INTO "AnalysisPosizioni" ("analysisId","datiJson","fotogrammi","byte") VALUES
  (${S(anId)}, ${S(dati)}, ${N(frames.length)}, ${N(dati.length)});`);
      nPosizioni += frames.length;
    }

    righe.push(`INSERT INTO "Notification" ("id","userId","matchId","tipo","vistaIl","creatoIl") VALUES
  (${S(id("notif", iM, iP))}, ${S(uid)}, ${S(mid)}, 'partita_pronta', ${iP === 0 ? "NULL" : D(ora)}, ${D(ora)});`);
  }
}

righe.push(`\nCOMMIT;`);
righe.push(`\n-- 5 utenti · 30 squadre · 360 giocatori · 15 partite · ${nAnalisi} analisi
-- ${nPosizioni.toLocaleString("it-IT")} fotogrammi con posizioni`);
righe.push(`-- Accessi: marcello@ fabio@ antonio@ andrea@ paolo@volleyvision.test — password123`);

process.stdout.write(righe.join("\n") + "\n");
