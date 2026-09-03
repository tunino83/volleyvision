/**
 * OMOGRAFIA — il ponte fra il video e il campo.
 *
 * Il fornitore manda, per ogni telecamera, una matrice 3x3 che porta i **pixel
 * dell'immagine** ai **metri sul campo**. E cosi che le posizioni dei
 * giocatori, rilevate in pixel, diventano coordinate su un campo 9 x 18.
 *
 * Per disegnare **sopra** il video serve il viaggio opposto: dai metri ai
 * pixel. E la stessa matrice, invertita — ed e il motivo per cui l'overlay
 * costa quasi nulla: la matematica e gia arrivata insieme ai dati.
 *
 * Una trasformazione proiettiva non e una moltiplicazione qualunque: la terza
 * componente **divide** le altre due. E cio che fa rimpicciolire le cose
 * lontane, e senza quella divisione i giocatori in fondo al campo finirebbero
 * nel posto sbagliato.
 */

export type Matrice = number[][];      // 3x3
export type Punto = { x: number; y: number };

/**
 * Applica la trasformazione a un punto.
 *
 * `w` e la profondita proiettiva. Quando tende a zero il punto sta
 * sull'orizzonte — dietro la telecamera o all'infinito — e non ha una
 * posizione sullo schermo: si restituisce `null` invece di un numero enorme.
 */
export function proietta(m: Matrice, p: Punto): Punto | null {
  const w = m[2][0] * p.x + m[2][1] * p.y + m[2][2];
  if (!Number.isFinite(w) || Math.abs(w) < 1e-9) return null;
  return {
    x: (m[0][0] * p.x + m[0][1] * p.y + m[0][2]) / w,
    y: (m[1][0] * p.x + m[1][1] * p.y + m[1][2]) / w,
  };
}

/**
 * L'inversa di una 3x3, con la regola dei cofattori.
 *
 * Tre righe di algebra invece di una libreria: importare una libreria di
 * matrici per una sola inversa 3x3 significherebbe centinaia di KB nel
 * pacchetto per quindici moltiplicazioni.
 */
export function inverti(m: Matrice): Matrice | null {
  const [[a, b, c], [d, e, f], [g, h, i]] = m;

  const A =  (e * i - f * h), B = -(d * i - f * g), C =  (d * h - e * g);
  const det = a * A + b * B + c * C;
  // Determinante nullo: la matrice schiaccia il piano su una retta e non si
  // puo tornare indietro. Non capita con omografie valide, ma un dato
  // corrotto non deve produrre `Infinity` sparsi sul disegno.
  if (!Number.isFinite(det) || Math.abs(det) < 1e-12) return null;

  return [
    [A / det,  -(b * i - c * h) / det,  (b * f - c * e) / det],
    [B / det,   (a * i - c * g) / det, -(a * f - c * d) / det],
    [C / det,  -(a * h - b * g) / det,  (a * e - b * d) / det],
  ];
}

/**
 * Il rettangolo in cui il video e davvero disegnato dentro il suo elemento.
 *
 * Con `object-fit: contain` il video conserva le proporzioni, quindi puo
 * restare una fascia vuota sopra e sotto oppure ai lati. Disegnare
 * ignorandola sposterebbe tutti i segni — poco, ma abbastanza da far sembrare
 * che i giocatori non stiano dove stanno.
 */
export function riquadroVideo(v: HTMLVideoElement) {
  const cw = v.clientWidth, ch = v.clientHeight;
  const vw = v.videoWidth, vh = v.videoHeight;
  if (!vw || !vh) return null;

  const scala = Math.min(cw / vw, ch / vh);
  const w = vw * scala, h = vh * scala;
  return { sx: (cw - w) / 2, sy: (ch - h) / 2, scala, w, h };
}
