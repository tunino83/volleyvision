/**
 * Esportazione di una tabella in CSV e in Excel.
 *
 * <h3>Perche serve</h3>
 *
 * Chi allena vive nei fogli di calcolo, e soprattutto: e l'unico modo di far
 * vedere i numeri a **chi non ha un account**. Finche i dati stanno solo
 * dentro l'applicazione, condividerli significa fare uno screenshot.
 *
 * <h3>Perche l'XLSX e scritto a mano</h3>
 *
 * Un `.xlsx` e uno ZIP con dentro qualche file XML: niente di magico. Le
 * librerie che lo fanno pesano fra i 400 KB e il megabyte, su un pacchetto
 * che ne pesa gia 2,5 — e servirebbero per scrivere trenta righe di numeri.
 *
 * Le voci dello ZIP sono **memorizzate senza compressione**: un tabellino
 * sono pochi kilobyte, e un compressore vero (deflate) sarebbe la parte piu
 * lunga di questo file per un guadagno che non si misura. Lo ZIP resta
 * valido: la compressione e facoltativa nel formato.
 *
 * <h3>Perche non lo fa il server</h3>
 *
 * I numeri sono gia nel client, calcolati da `@vv/core`. Rifarli sul server
 * significherebbe una seconda implementazione delle stesse metriche — e la
 * regola 2 del progetto esiste per non averne due.
 */

export interface Colonna<T> {
  chiave: string;
  intestazione: string;
  /** Come si ricava il valore dalla riga. Predefinito: `riga[chiave]`. */
  valore?: (riga: T) => string | number | null | undefined;
}

// --------------------------------------------------------------------- CSV

/**
 * CSV con **punto e virgola**, non virgola.
 *
 * E la convenzione italiana, e non e pedanteria: Excel in configurazione
 * italiana usa la virgola come separatore decimale, quindi un CSV separato da
 * virgole finisce tutto in una colonna sola. Chi apre il file lo apre quasi
 * sempre con Excel.
 */
const SEP = ";";

function cella(v: unknown): string {
  if (v == null) return "";
  const s = String(v);
  // Virgolette raddoppiate e campo quotato solo se serve: un file pieno di
  // virgolette inutili e illeggibile aperto con un editor di testo.
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function csv<T>(colonne: Colonna<T>[], righe: T[]): string {
  const intestazione = colonne.map((c) => cella(c.intestazione)).join(SEP);
  const corpo = righe.map((r) => colonne
    .map((c) => cella(c.valore ? c.valore(r) : (r as any)[c.chiave]))
    .join(SEP));
  /*
   * Il BOM iniziale.
   *
   * Senza, Excel legge il file come ANSI e "Perù" diventa "PerÃ¹". Costa tre
   * byte e toglie l'unico difetto che chi riceve il file notera subito.
   */
  return "﻿" + [intestazione, ...corpo].join("\r\n");
}

// -------------------------------------------------------------------- XLSX

const xmlSicuro = (s: string) => s
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;");

/** Da indice di colonna a lettera: 0 → A, 26 → AA. */
function lettera(i: number): string {
  let s = "";
  for (let n = i + 1; n > 0; n = Math.floor((n - 1) / 26)) {
    s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  }
  return s;
}

function foglio<T>(colonne: Colonna<T>[], righe: T[]): string {
  const riga = (celle: string[], n: number) =>
    `<row r="${n}">${celle.join("")}</row>`;

  const testa = riga(colonne.map((c, i) =>
    // `s="1"` e lo stile in grassetto definito in `stili()`.
    `<c r="${lettera(i)}1" t="inlineStr" s="1"><is><t>${xmlSicuro(c.intestazione)}</t></is></c>`), 1);

  const corpo = righe.map((r, n) => riga(colonne.map((c, i) => {
    const v = c.valore ? c.valore(r) : (r as any)[c.chiave];
    const rif = `${lettera(i)}${n + 2}`;
    // Cella vuota e non zero: e la stessa distinzione che si fa a schermo.
    // Uno zero finto entrerebbe nelle medie di chi apre il foglio.
    if (v == null || v === "") return `<c r="${rif}"/>`;
    // I numeri come numeri: scritti come testo, Excel non li somma e non li
    // ordina, ed e la prima cosa che chi riceve il file prova a fare.
    if (typeof v === "number" && Number.isFinite(v)) return `<c r="${rif}"><v>${v}</v></c>`;
    return `<c r="${rif}" t="inlineStr"><is><t>${xmlSicuro(String(v))}</t></is></c>`;
  }), n + 2));

  const larghezze = colonne.map((c, i) =>
    `<col min="${i + 1}" max="${i + 1}" width="${Math.max(8, Math.min(28, c.intestazione.length + 4))}" customWidth="1"/>`);

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<sheetViews><sheetView workbookViewId="0">
<pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/>
</sheetView></sheetViews>
<cols>${larghezze.join("")}</cols>
<sheetData>${testa}${corpo.join("")}</sheetData>
</worksheet>`;
}

const stili = () => `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font>
<font><sz val="11"/><name val="Calibri"/><b/></font></fonts>
<fills count="2"><fill><patternFill patternType="none"/></fill>
<fill><patternFill patternType="gray125"/></fill></fills>
<borders count="1"><border/></borders>
<cellStyleXfs count="1"><xf/></cellStyleXfs>
<cellXfs count="2"><xf xfId="0"/><xf xfId="0" fontId="1" applyFont="1"/></cellXfs>
</styleSheet>`;

export function xlsx<T>(colonne: Colonna<T>[], righe: T[], nomeFoglio = "Dati"): Blob {
  const nome = xmlSicuro(nomeFoglio).slice(0, 31);
  const file: Array<[string, string]> = [
    ["[Content_Types].xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
</Types>`],
    ["_rels/.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`],
    ["xl/workbook.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"
 xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheets><sheet name="${nome}" sheetId="1" r:id="rId1"/></sheets></workbook>`],
    ["xl/_rels/workbook.xml.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`],
    ["xl/styles.xml", stili()],
    ["xl/worksheets/sheet1.xml", foglio(colonne, righe)],
  ];

  return zip(file.map(([n, t]) => [n, new TextEncoder().encode(t)]));
}

// ---------------------------------------------------------------------- ZIP

/** Tabella CRC-32, costruita una volta sola al primo uso. */
let tabella: Uint32Array | null = null;
function crc32(dati: Uint8Array): number {
  if (!tabella) {
    tabella = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      tabella[i] = c >>> 0;
    }
  }
  let c = 0xffffffff;
  for (let i = 0; i < dati.length; i++) c = tabella[(c ^ dati[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/**
 * Uno ZIP con le voci **memorizzate**, senza compressione.
 *
 * La compressione e facoltativa nel formato, e qui si tratta di pochi
 * kilobyte di XML: scrivere un deflate sarebbe la parte piu lunga di questo
 * file per un guadagno che nessuno noterebbe.
 */
function zip(voci: Array<[string, Uint8Array]>): Blob {
  const pezzi: Uint8Array[] = [];
  const centrale: Uint8Array[] = [];
  let posizione = 0;

  const u16 = (v: number) => [v & 0xff, (v >>> 8) & 0xff];
  const u32 = (v: number) => [v & 0xff, (v >>> 8) & 0xff, (v >>> 16) & 0xff, (v >>> 24) & 0xff];

  for (const [nome, dati] of voci) {
    const n = new TextEncoder().encode(nome);
    const crc = crc32(dati);

    const locale = Uint8Array.from([
      ...u32(0x04034b50), ...u16(20), ...u16(0), ...u16(0),
      // Data e ora fisse: un file identico deve produrre byte identici, e
      // l'orologio renderebbe ogni esportazione diversa dalla precedente.
      ...u16(0), ...u16(0x21), ...u32(crc), ...u32(dati.length), ...u32(dati.length),
      ...u16(n.length), ...u16(0), ...n,
    ]);
    pezzi.push(locale, dati);

    centrale.push(Uint8Array.from([
      ...u32(0x02014b50), ...u16(20), ...u16(20), ...u16(0), ...u16(0),
      ...u16(0), ...u16(0x21), ...u32(crc), ...u32(dati.length), ...u32(dati.length),
      ...u16(n.length), ...u16(0), ...u16(0), ...u16(0), ...u16(0),
      ...u32(0), ...u32(posizione), ...n,
    ]));
    posizione += locale.length + dati.length;
  }

  const dimCentrale = centrale.reduce((s, c) => s + c.length, 0);
  const fine = Uint8Array.from([
    ...u32(0x06054b50), ...u16(0), ...u16(0),
    ...u16(voci.length), ...u16(voci.length),
    ...u32(dimCentrale), ...u32(posizione), ...u16(0),
  ]);

  /*
   * Un solo blocco contiguo invece di un elenco di pezzi.
   *
   * TypeScript rifiuta un `Uint8Array` generico come parte di un `Blob`,
   * perche il suo buffer potrebbe essere condiviso fra thread. Concatenare
   * risolve il tipo e non costa niente: qui si tratta di pochi kilobyte.
   */
  const tutti = [...pezzi, ...centrale, fine];
  const totale = tutti.reduce((s, p) => s + p.length, 0);
  const uscita = new Uint8Array(totale);
  let scritto = 0;
  for (const p of tutti) { uscita.set(p, scritto); scritto += p.length; }

  return new Blob([uscita.buffer as ArrayBuffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}

// ------------------------------------------------------------- salvataggio

/** Un nome di file che non faccia litigare i sistemi operativi. */
export function nomeFile(base: string, estensione: string): string {
  const pulito = base.normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9 _-]+/g, " ").replace(/\s+/g, "-").replace(/^-|-$/g, "")
    .slice(0, 60) || "volley-vision";
  const oggi = new Date().toISOString().slice(0, 10);
  return `${pulito}-${oggi}.${estensione}`;
}
