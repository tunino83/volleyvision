/**
 * Verifica dell'adattatore sui cinque insiemi sintetici.
 *   npx tsx src/analysis/__prove__/adattatore.prova.ts
 *
 * Non e ancora un test automatico (vedi docs/05-interventi.md, 12): e una
 * verifica eseguibile che asserisce e restituisce codice di uscita. Quando
 * arrivera un esecutore di test, le asserzioni si trasferiscono cosi come sono.
 */
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { adatta, allineaEventiAiSet } from "../adapter";
import { riepilogo, miglioriRealizzatori } from "@vv/core";

const BASE = join(__dirname, "..", "..", "..", "..", "..", "dati-di-prova");
const indice = JSON.parse(readFileSync(join(BASE, "indice.json"), "utf-8"));

let falliti = 0;

for (const v of indice) {
  const dir = join(BASE, v.chiave);
  const leggi = (n: string) => existsSync(join(dir, n))
    ? JSON.parse(readFileSync(join(dir, n), "utf-8")) : undefined;

  console.log(`\n${"=".repeat(66)}\n${v.titolo}  (${v.squadre})  ${v.parziali}`);

  const t0 = Date.now();
  const { pacchetto, frames } = adatta(v.chiave, 1, {
    events: leggi("events.json"), videos: leggi("videos.json"), frames: leggi("frames.json"),
  });
  allineaEventiAiSet(pacchetto);
  const q = pacchetto.qualita;

  // ---- asserzioni sul comportamento atteso
  const prove: Array<[string, boolean, string]> = [];
  prove.push(["set riconosciuti", pacchetto.sets.length === v.atteso.set,
              `${pacchetto.sets.length} invece di ${v.atteso.set}`]);
  prove.push(["azioni conservate", q.azioni === v.atteso.azioni,
              `${q.azioni} invece di ${v.atteso.azioni}`]);
  prove.push(["punti dichiarati letti", q.puntiDichiarati === v.atteso.puntiTotali,
              `${q.puntiDichiarati} invece di ${v.atteso.puntiTotali}`]);
  const parzialiOk = pacchetto.sets.every((s, i) =>
    s.hPt === v.atteso.parziali[i][0] && s.aPt === v.atteso.parziali[i][1]);
  prove.push(["parziali corretti", parzialiOk,
              pacchetto.sets.map((s) => `${s.hPt}-${s.aPt}`).join(" ")]);
  prove.push(["confini set ricostruiti", q.confiniSetRicalcolati === v.difetti.confiniSetSbagliati * (v.atteso.set - 1),
              `${q.confiniSetRicalcolati} riassegnate`]);
  prove.push(["posizioni come atteso", q.posizioniDisponibili === v.atteso.posizioniDisponibili,
              String(q.posizioniDisponibili)]);
  // ogni azione deve appartenere a un set esistente
  const setValidi = new Set(pacchetto.sets.map((s) => s.n));
  prove.push(["ogni azione in un set valido",
              pacchetto.actions.every((a) => setValidi.has(a.set)), ""]);
  // gli eventi devono seguire il set della loro azione
  prove.push(["eventi allineati alle azioni",
              pacchetto.events.every((e) => e.set === pacchetto.actions[e.actionIdx].set), ""]);
  // i fotogrammi devono crescere
  prove.push(["fotogrammi non decrescenti",
              pacchetto.events.every((e, i, arr) => i === 0 || arr[i].actionIdx !== arr[i-1].actionIdx || e.frame >= arr[i-1].frame), ""]);

  for (const [nome, ok, det] of prove) {
    if (!ok) falliti++;
    console.log(`  ${ok ? "ok  " : "NO  "} ${nome}${ok ? "" : "  -> " + det}`);
  }

  console.log(`  --- ${q.eventiTotali} eventi, ${q.azioni} azioni, ${frames.length} fotogrammi, ${Date.now()-t0} ms`);
  console.log(`      senza giocatore ${q.percentualeSenzaGiocatore}% (voluto ~${Math.round(v.difetti.giocatoriIgnoti*100)}%)`);

  const r = riepilogo(pacchetto.events);
  console.log(`      ${pacchetto.squadre.h} ${pacchetto.squadre.a}   ` +
    r.map((m) => `${m.etichetta.split(" ")[0]} ${m.casa}/${m.ospite}`).join("  "));
  const top = miglioriRealizzatori(pacchetto.events, {}, 2);
  console.log(`      migliori: ${top.map((x) => `#${x.jersey} (${x.punti})`).join(", ") || "nessuno"}`);
  if (q.avvisi.length) console.log(`      avvisi: ${q.avvisi.length}`);
}

console.log(`\n${"=".repeat(66)}`);
console.log(falliti === 0 ? "Tutte le verifiche superate." : `${falliti} verifiche fallite.`);
process.exit(falliti === 0 ? 0 : 1);
