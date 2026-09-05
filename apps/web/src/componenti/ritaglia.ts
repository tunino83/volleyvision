/**
 * Prepara una fotografia prima di mandarla al server.
 *
 * **Il ritaglio lo fa il client, e non per pigrizia.** Una foto scattata da
 * telefono pesa 3-8 MB; quella che serve qui ne pesa 20 KB. Mandare gli 8 MB
 * al server per fargliene ricavare 20 KB significa far pagare all'utente il
 * trasferimento di 8 MB — su rete mobile, di tasca sua. Si riduce prima.
 *
 * Il ritaglio e **quadrato e centrato**: le figurine sono tonde, e una foto
 * rettangolare verrebbe tagliata comunque, ma a caso. Meglio deciderlo qui,
 * prendendo il centro — dove nelle fotografie di persone sta quasi sempre il
 * viso.
 */

/** 256 px bastano: la figurina piu grande in cui compare e 96. */
const LATO = 256;
const QUALITA = 0.85;

export async function preparaFoto(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Il file scelto non e un'immagine.");
  }

  const bitmap = await creaBitmap(file);
  try {
    // Il lato del quadrato piu grande che ci sta dentro, centrato.
    const lato = Math.min(bitmap.width, bitmap.height);
    const sx = (bitmap.width - lato) / 2;
    const sy = (bitmap.height - lato) / 2;

    const tela = document.createElement("canvas");
    tela.width = tela.height = LATO;
    const ctx = tela.getContext("2d");
    if (!ctx) throw new Error("Impossibile elaborare l'immagine su questo browser.");

    // Sfondo bianco: se la sorgente e un PNG con trasparenza, in JPEG
    // diventerebbe nera. Bianco e neutro sotto entrambi i temi.
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, LATO, LATO);
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(bitmap, sx, sy, lato, lato, 0, 0, LATO, LATO);

    return tela.toDataURL("image/jpeg", QUALITA);
  } finally {
    // `createImageBitmap` tiene memoria fuori dal garbage collector.
    if ("close" in bitmap) (bitmap as ImageBitmap).close();
  }
}

/** Lo stemma puo essere piu grande: e un segno, non una figurina. */
const LATO_STEMMA = 512;

/**
 * Prepara lo stemma di una squadra.
 *
 * Due differenze dal ritaglio di una fotografia, e sono le due che contano:
 *
 * **Si adatta dentro, non si taglia.** Molti stemmi sono larghi — una scritta
 * col nome della societa — e un ritaglio quadrato centrato ne butterebbe via
 * meta. Qui l'immagine intera entra nel quadrato, con il vuoto attorno.
 *
 * **Resta trasparente, e resta PNG.** Uno stemma ha spesso poche tinte
 * piatte e bordi netti: il JPEG li sporca, e un fondo bianco cotto dentro
 * l'immagine stona sul tema scuro. Il PNG costa piu byte, e il limite e
 * generoso apposta (512 KB contro i 300 delle fotografie).
 */
export async function preparaStemma(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Il file scelto non e un'immagine.");
  }
  // Un SVG non si disegna in modo affidabile su tela in tutti i browser, e
  // comunque il server non lo accetta: e un documento eseguibile.
  if (file.type === "image/svg+xml") {
    throw new Error("Gli SVG non sono ammessi: esporta lo stemma in PNG.");
  }

  const bitmap = await creaBitmap(file);
  try {
    const scala = Math.min(LATO_STEMMA / bitmap.width, LATO_STEMMA / bitmap.height, 1);
    const w = Math.max(1, Math.round(bitmap.width * scala));
    const h = Math.max(1, Math.round(bitmap.height * scala));

    const tela = document.createElement("canvas");
    tela.width = tela.height = LATO_STEMMA;
    const ctx = tela.getContext("2d");
    if (!ctx) throw new Error("Impossibile elaborare l'immagine su questo browser.");

    ctx.imageSmoothingQuality = "high";
    // Centrata nel quadrato: senza, uno stemma largo resterebbe appoggiato in
    // alto a sinistra e sembrerebbe storto ovunque comparisse.
    ctx.drawImage(bitmap, (LATO_STEMMA - w) / 2, (LATO_STEMMA - h) / 2, w, h);

    return tela.toDataURL("image/png");
  } finally {
    if ("close" in bitmap) (bitmap as ImageBitmap).close();
  }
}

/**
 * `createImageBitmap` applica l'orientamento EXIF: senza, le foto scattate in
 * verticale col telefono arriverebbero coricate. Dove manca si ripiega su
 * `<img>`, accettando che qualche foto possa risultare ruotata.
 */
async function creaBitmap(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === "function") {
    try { return await createImageBitmap(file, { imageOrientation: "from-image" }); }
    catch { /* alcuni browser non accettano l'opzione: si ritenta senza */ }
    try { return await createImageBitmap(file); } catch { /* e si ripiega */ }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    await new Promise<void>((ok, ko) => {
      img.onload = () => ok();
      img.onerror = () => ko(new Error("Immagine non leggibile."));
      img.src = url;
    });
    return img;
  } finally { URL.revokeObjectURL(url); }
}

/** Il peso dei byte veri dietro un `data:` URI, per mostrarlo all'utente. */
export const byteDiDataUri = (d: string) =>
  Math.round((d.length - d.indexOf(",") - 1) * 3 / 4);
