import { mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import { genera, PROFILI } from "./genera";

/**
 * Produce i cinque insiemi di prova.
 *   npm run genera --workspace @vv/mock -- [cartella]
 */
const dest = process.argv[2] ?? join(__dirname, "..", "..", "..", "dati-di-prova");
mkdirSync(dest, { recursive: true });

const indice: any[] = [];

for (const p of PROFILI) {
  const g = genera(p);
  const dir = join(dest, p.chiave);
  mkdirSync(dir, { recursive: true });

  writeFileSync(join(dir, "events.json"), JSON.stringify(g.events));
  writeFileSync(join(dir, "videos.json"), JSON.stringify(g.videos, null, 2));
  if (g.frames) writeFileSync(join(dir, "frames.json"), JSON.stringify(g.frames));

  const ev = (g.events as any).data.match;
  const nEventi = ev.sets.reduce((s: number, x: any) =>
    s + x.actions.reduce((t: number, a: any) => t + a.events.length, 0), 0);
  const nFrames = g.frames ? (g.frames as any).data.frames.length : 0;

  indice.push({
    chiave: p.chiave, titolo: p.titolo, descrizione: p.descrizione,
    squadre: `${p.casa} - ${p.ospite}`,
    parziali: p.parziali.map((x) => `${x[0]}-${x[1]}`).join(" / "),
    atteso: g.atteso,
    prodotto: { eventi: nEventi, azioni: g.atteso.azioni, fotogrammi: nFrames },
    difetti: p.difetti,
  });

  console.log(`${p.chiave.padEnd(14)} ${g.atteso.set} set · ${String(g.atteso.azioni).padStart(3)} azioni · ` +
              `${String(nEventi).padStart(4)} eventi · ${String(nFrames).padStart(6)} fotogrammi` +
              `${g.frames ? "" : "  (senza posizioni)"}`);
}

writeFileSync(join(dest, "indice.json"), JSON.stringify(indice, null, 2));
console.log(`\nScritti in ${dest}`);
