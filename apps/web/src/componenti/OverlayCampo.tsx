import { useCallback, useEffect, useRef, useState } from "react";
import { API } from "../api/client";
import { inverti, proietta, riquadroVideo, type Matrice } from "./omografia";
import { disegnaCampoMini } from "./CampoMini";

/**
 * OVERLAY SUL VIDEO — dove sono i giocatori, disegnato sull'immagine vera.
 *
 * Non un campetto accanto al video: i segni stanno **sopra i giocatori**,
 * mentre giocano. E la grafica da telecronaca, ed e possibile solo perche il
 * fornitore manda l'omografia di ogni telecamera insieme ai dati.
 *
 * Le posizioni salvate sono in **metri sul campo** — indipendenti dalla
 * telecamera, ed e giusto cosi. Qui si torna indietro ai pixel con la matrice
 * invertita, il che significa che **gli stessi dati si disegnano su entrambi i
 * video** senza doverli salvare due volte.
 *
 * ## Perche una finestra e non tutto il file
 *
 * Le posizioni di una partita sono ~7 MB — quaranta volte il pacchetto delle
 * statistiche. Scaricarle tutte per guardare dieci secondi sarebbe assurdo:
 * si prende una finestra intorno al punto in cui si sta guardando, e si
 * ricarica quando ci si avvicina al bordo.
 */

/** Un rilevamento: chi era in campo a quel fotogramma, in metri. */
interface Rilevamento {
  f: number;
  h: Array<{ n: number; x: number; y: number }>;
  a: Array<{ n: number; x: number; y: number }>;
}

/* Quanto si prende e quando si ricarica, in fotogrammi (a 30 fps). */
const INDIETRO = 150;      // 5 s: basta a coprire un salto all'indietro
const AVANTI = 900;        // 30 s in avanti: si guarda in avanti, non indietro
const MARGINE = 150;       // a 5 s dal bordo si ricarica, senza far vedere il vuoto

/**
 * Oltre questa distanza il rilevamento non si disegna.
 *
 * Fra un'azione e l'altra i rilevamenti non ci sono: senza questo limite si
 * mostrerebbe l'ultima posizione nota per minuti, con i cerchi fermi su
 * giocatori che nel frattempo si sono spostati. **Meglio niente che sbagliato.**
 */
const TOLLERANZA = 8;

export function OverlayCampo({ matchId, video, fps, omografia, lato,
                              segniSulVideo, campo2d, nomeCasa, nomeOspiti }: {
  matchId: string;
  video: React.RefObject<HTMLVideoElement>;
  fps: number;
  /** `{ side1, side2 }` dal pacchetto. */
  omografia: { side1?: Matrice; side2?: Matrice } | null;
  lato: 1 | 2;
  /** I cerchi sopra i giocatori: utili, ma passano per la prospettiva. */
  segniSulVideo: boolean;
  /** Il campo visto dall'alto: **e la vista fedele a questi dati**. */
  campo2d: boolean;
  nomeCasa?: string; nomeOspiti?: string;
}) {
  const tela = useRef<HTMLCanvasElement>(null);
  const mini = useRef<HTMLCanvasElement>(null);
  const attivo = segniSulVideo || campo2d;
  const dati = useRef<{ da: number; a: number; righe: Rilevamento[] }>({ da: 0, a: -1, righe: [] });
  const inCorso = useRef(false);
  const [pronto, setPronto] = useState(false);

  // L'inversa si calcola una volta: e la stessa per tutta la partita.
  const inversa = useRef<Matrice | null>(null);
  useEffect(() => {
    const m = lato === 1 ? omografia?.side1 : omografia?.side2;
    inversa.current = m ? inverti(m) : null;
    // Il campo 2D funziona anche senza omografia: si e pronti comunque.
    setPronto(true);
  }, [omografia, lato]);

  /** Prende la finestra intorno a un fotogramma, se non c'e gia. */
  const assicura = useCallback(async (frame: number) => {
    const d = dati.current;
    if (frame >= d.da + MARGINE && frame <= d.a - MARGINE) return;   // gia coperto
    if (inCorso.current) return;
    inCorso.current = true;
    const da = Math.max(0, frame - INDIETRO);
    const a = frame + AVANTI;
    try {
      const righe = await API.get<Rilevamento[]>(
        `/matches/${matchId}/analysis/positions?da=${da}&a=${a}`);
      dati.current = { da, a, righe };
    } catch {
      // Senza posizioni si guarda il video senza segni: e una perdita di
      // ornamento, non di funzione. Non si interrompe la riproduzione.
    } finally { inCorso.current = false; }
  }, [matchId]);

  /** Il rilevamento piu vicino al fotogramma, se abbastanza vicino. */
  const vicino = (frame: number): Rilevamento | null => {
    const righe = dati.current.righe;
    if (!righe.length) return null;
    // Ricerca binaria: a 30 fps si disegna trenta volte al secondo, e una
    // scansione lineare su migliaia di righe si sentirebbe.
    let lo = 0, hi = righe.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (righe[mid].f < frame) lo = mid + 1; else hi = mid;
    }
    const cand = [righe[lo], righe[lo - 1]].filter(Boolean);
    let best: Rilevamento | null = null, bestD = Infinity;
    for (const c of cand) {
      const dd = Math.abs(c.f - frame);
      if (dd < bestD) { bestD = dd; best = c; }
    }
    return bestD <= TOLLERANZA ? best : null;
  };

  const disegna = useCallback((frame: number) => {
    const v = video.current;
    if (!v) return;
    const r = vicino(frame);

    // Il campo dall'alto non ha bisogno ne del video ne dell'omografia:
    // e la stessa proiezione ortogonale dei dati, sempre valida.
    if (mini.current) disegnaCampoMini(mini.current, r?.h ?? [], r?.a ?? []);

    const c = tela.current, inv = inversa.current;
    if (!c || !inv) return;

    const riq = riquadroVideo(v);
    if (!riq) return;

    // La tela segue la dimensione mostrata, non quella del file: disegnare a
    // 1920x1080 e poi scalare con il CSS sfocherebbe i numeri di maglia.
    const dpr = window.devicePixelRatio || 1;
    if (c.width !== Math.round(v.clientWidth * dpr) || c.height !== Math.round(v.clientHeight * dpr)) {
      c.width = Math.round(v.clientWidth * dpr);
      c.height = Math.round(v.clientHeight * dpr);
    }
    const g = c.getContext("2d");
    if (!g) return;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, v.clientWidth, v.clientHeight);

    if (!r) return;

    for (const [squadra, elenco] of [["h", r.h], ["a", r.a]] as const) {
      const colore = squadra === "h" ? "#ffcc00" : "#4da3ff";
      for (const p of elenco) {
        const px = proietta(inv, { x: p.x, y: p.y });
        if (!px) continue;
        // Dai pixel del file a quelli mostrati: il video puo essere piu
        // piccolo dell'originale, e puo avere fasce vuote ai lati.
        const X = riq.sx + px.x * riq.scala;
        const Y = riq.sy + px.y * riq.scala;
        if (X < -40 || Y < -40 || X > v.clientWidth + 40 || Y > v.clientHeight + 40) continue;

        // Un'ellisse ai piedi, non un cerchio sulla testa: sta sul pavimento,
        // dove sta davvero il giocatore, e non copre chi si sta guardando.
        g.beginPath();
        g.ellipse(X, Y, 15, 6, 0, 0, Math.PI * 2);
        g.strokeStyle = colore; g.lineWidth = 2.5;
        g.stroke();

        g.font = "600 12px Inter, system-ui, sans-serif";
        g.textAlign = "center"; g.textBaseline = "middle";
        const testo = String(p.n);
        const w = g.measureText(testo).width + 8;
        // Fondo scuro dietro il numero: sul parquet chiaro il giallo sparisce.
        g.fillStyle = "rgba(8,12,18,.78)";
        g.fillRect(X - w / 2, Y - 30, w, 16);
        g.fillStyle = colore;
        g.fillText(testo, X, Y - 22);
      }
    }
  }, [video]);

  /* Il ciclo: a ogni fotogramma mostrato si ridisegna.
     `requestVideoFrameCallback` scatta quando il fotogramma e **davvero** a
     schermo, e porta il suo tempo esatto: con `requestAnimationFrame` i segni
     resterebbero indietro di uno o due fotogrammi rispetto all'immagine. */
  useEffect(() => {
    const v = video.current;
    if (!v || !attivo || !pronto) return;

    let vivo = true;
    let handle = 0;
    const rvfc = (v as any).requestVideoFrameCallback?.bind(v);

    const passo = (_t?: number, meta?: any) => {
      if (!vivo) return;
      const tempo = meta?.mediaTime ?? v.currentTime;
      const frame = Math.round(tempo * fps);
      void assicura(frame);
      disegna(frame);
      handle = rvfc ? rvfc(passo) : requestAnimationFrame(() => passo());
    };
    passo();

    return () => {
      vivo = false;
      if (!rvfc && handle) cancelAnimationFrame(handle);
      const c = tela.current;
      c?.getContext("2d")?.clearRect(0, 0, c.width, c.height);
    };
  }, [video, attivo, pronto, fps, assicura, disegna]);

  if (!attivo) return null;
  return (
    <>
      {segniSulVideo && <canvas ref={tela} className="overlay-campo" aria-hidden />}
      {campo2d && (
        <div className="campo-mini">
          <canvas ref={mini} />
          <div className="campo-mini-legenda">
            <span><i style={{ background: "#ffcc00" }} />{nomeCasa ?? "Casa"}</span>
            <span><i style={{ background: "#4da3ff" }} />{nomeOspiti ?? "Ospiti"}</span>
          </div>
        </div>
      )}
    </>
  );
}
