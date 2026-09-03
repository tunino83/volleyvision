

/**
 * IL CAMPO VISTO DALL'ALTO, in un riquadro nell'angolo del video.
 *
 * **E la rappresentazione onesta di questi dati.** Le posizioni sono
 * coordinate su un piano — metri su un campo 9 x 18 — e un piano si disegna
 * dall'alto. Portarle sull'immagine in prospettiva significa attraversare
 * un'omografia, e ogni imprecisione della matrice diventa uno scarto visibile
 * proprio dove serve precisione. Qui non c'e trasformazione: un metro e
 * sempre lo stesso numero di pixel, ovunque sul campo.
 *
 * Il segno sopra il video resta, ma come aggiunta: questo e il riferimento.
 */

export interface Posizione { n: number; x: number; y: number }

const CAMPO_X = 9, CAMPO_Y = 18;
/** Il margine e la zona libera: si serve e si difende anche fuori dalle linee. */
const FUORI = 2.2;

/**
 * Disegna il campo su una tela. Funzione pura, non componente: la chiama il
 * ciclo del video insieme all'overlay, cosi i due disegni restano in passo e
 * non c'e stato di React aggiornato trenta volte al secondo.
 */
export function disegnaCampoMini(c: HTMLCanvasElement,
                                 h: Posizione[], a: Posizione[],
                                 larghezza = 148) {
  {
    const totX = CAMPO_X + FUORI * 2, totY = CAMPO_Y + FUORI * 2;
    const scala = larghezza / totX;
    const altezza = totY * scala;

    const dpr = window.devicePixelRatio || 1;
    c.width = Math.round(larghezza * dpr);
    c.height = Math.round(altezza * dpr);
    c.style.width = `${larghezza}px`;
    c.style.height = `${altezza}px`;

    const g = c.getContext("2d");
    if (!g) return;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);

    /** Da metri a pixel del riquadro. Nessuna prospettiva: una moltiplicazione. */
    const P = (x: number, y: number) => [(x + FUORI) * scala, (y + FUORI) * scala] as const;

    g.fillStyle = "rgba(8,12,18,.82)";
    g.fillRect(0, 0, larghezza, altezza);

    // Il parquet, poi le linee: campo, meta campo, i due tre metri.
    g.fillStyle = "rgba(190,140,70,.14)";
    const [ax, ay] = P(0, 0);
    g.fillRect(ax, ay, CAMPO_X * scala, CAMPO_Y * scala);

    g.strokeStyle = "rgba(220,232,244,.55)"; g.lineWidth = 1;
    g.strokeRect(ax, ay, CAMPO_X * scala, CAMPO_Y * scala);
    for (const y of [6, 12]) {
      g.beginPath(); g.moveTo(...P(0, y)); g.lineTo(...P(CAMPO_X, y)); g.stroke();
    }
    // La rete piu marcata: e il riferimento che l'occhio cerca per primo.
    g.strokeStyle = "rgba(220,232,244,.95)"; g.lineWidth = 2;
    g.beginPath(); g.moveTo(...P(0, 9)); g.lineTo(...P(CAMPO_X, 9)); g.stroke();

    for (const [elenco, colore] of [[h, "#ffcc00"], [a, "#4da3ff"]] as const) {
      for (const p of elenco) {
        const [X, Y] = P(p.x, p.y);
        g.beginPath(); g.arc(X, Y, 7, 0, Math.PI * 2);
        g.fillStyle = colore; g.fill();
        g.font = "700 9px Inter, system-ui, sans-serif";
        g.textAlign = "center"; g.textBaseline = "middle";
        // Testo scuro sul disco pieno: a nove pixel e l'unico modo di leggerlo.
        g.fillStyle = "#0b1016";
        g.fillText(String(p.n), X, Y + 0.5);
      }
    }
  }
}
