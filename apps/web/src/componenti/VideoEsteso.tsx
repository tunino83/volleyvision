import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * LA VISTA ESTESA: il video grande, e intorno cio che serve a leggerlo.
 *
 * Tre colonne — pannelli a sinistra, video al centro, azioni a destra — su
 * tutto lo schermo. Il banco normale sta dentro una pagina, con la
 * navigazione e le altre schede intorno: qui si toglie tutto quello, perche
 * guardare una partita e un'attivita a se, non una fra le tante aperte.
 *
 * ## Perche il video non si sposta ma si ricrea
 *
 * Passando alla vista estesa l'elemento `<video>` viene ricostruito: React
 * non sposta un nodo da un punto all'altro dell'albero. Ricrearlo
 * ripartirebbe da zero, buttando via il punto in cui si stava guardando —
 * ed e proprio il momento in cui si vuole ingrandire. Quindi si prende il
 * tempo prima e lo si rimette dopo.
 */

export function VideoEsteso({ aperto, onChiudi, sinistra, centro, destra }: {
  aperto: boolean;
  onChiudi: () => void;
  sinistra: ReactNode;
  centro: ReactNode;
  destra: ReactNode;
}) {
  useEffect(() => {
    if (!aperto) return;
    // Esc chiude: e cio che ci si aspetta da qualunque cosa a schermo intero,
    // e senza, l'unica via d'uscita sarebbe trovare il pulsante.
    const tasto = (e: KeyboardEvent) => { if (e.key === "Escape") onChiudi(); };
    window.addEventListener("keydown", tasto);
    // La pagina sotto non deve scorrere mentre si guarda: il rotolino serve
    // ai pannelli laterali, non al documento che c'e dietro.
    const prima = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", tasto);
      document.body.style.overflow = prima;
    };
  }, [aperto, onChiudi]);

  if (!aperto) return null;

  return (
    <div className="esteso" role="dialog" aria-modal="true" aria-label="Video a schermo intero">
      <aside className="esteso-sinistra">{sinistra}</aside>
      <div className="esteso-centro">
        <button className="piccolo esteso-chiudi" onClick={onChiudi}>
          Chiudi vista estesa
        </button>
        {centro}
      </div>
      <aside className="esteso-destra">{destra}</aside>
    </div>
  );
}

/**
 * Un pannello che si apre e si chiude, con la scelta ricordata.
 *
 * Generico perche ne servono due — statistiche e roster — e averli scritti
 * due volte significherebbe vederli divergere alla prima modifica.
 */
export function Pannello({ titolo, chiave, apertoDiSuo = true, children }: {
  titolo: string;
  /** Dove si ricorda la scelta. Diverso per pannello. */
  chiave: string;
  apertoDiSuo?: boolean;
  children: ReactNode;
}) {
  const [aperto, setAperto] = useState(() => {
    try {
      const v = localStorage.getItem(chiave);
      return v === null ? apertoDiSuo : v === "1";
    } catch { return apertoDiSuo; }
  });

  const cambia = () => setAperto((v) => {
    try { localStorage.setItem(chiave, v ? "0" : "1"); } catch { /* finestra privata */ }
    return !v;
  });

  return (
    <section className={`pannello ${aperto ? "" : "chiuso"}`}>
      <button className="pannello-testa" onClick={cambia} aria-expanded={aperto}>
        <span className={`freccia ${aperto ? "su" : "giu"}`} aria-hidden />
        <span className="etichetta">{titolo}</span>
      </button>
      {aperto && <div className="pannello-corpo">{children}</div>}
    </section>
  );
}

/**
 * Conserva il punto del video quando l'elemento viene ricreato.
 *
 * Restituisce `annota`, da chiamare **nel gestore del clic**, prima che
 * React ridisegni. Il primo tentativo lo faceva nella pulizia dell'effetto,
 * ed era sbagliato: quella gira quando il DOM e gia stato sostituito, quindi
 * leggeva il tempo dell'elemento NUOVO — zero — e lo riscriveva. Il video
 * ripartiva da capo, e il difetto si vedeva solo eseguendo.
 */
export function useTempoConservato(video: React.RefObject<HTMLVideoElement>,
                                   dipendenza: unknown) {
  const tempo = useRef(0);
  const inRiproduzione = useRef(false);

  /** Da chiamare PRIMA di cambiare vista, finche l'elemento vecchio c'e. */
  const annota = () => {
    const v = video.current;
    if (!v) return;
    tempo.current = v.currentTime;
    inRiproduzione.current = !v.paused;
  };

  // Dopo che il nuovo elemento e pronto, ci si rimette dove si era.
  useEffect(() => {
    const v = video.current;
    if (!v || !tempo.current) return;
    const ripristina = () => {
      v.currentTime = tempo.current;
      if (inRiproduzione.current) void v.play().catch(() => { /* negata */ });
    };
    // `readyState >= 1` significa che la durata e nota: prima di allora
    // assegnare `currentTime` non ha effetto.
    if (v.readyState >= 1) ripristina();
    else v.addEventListener("loadedmetadata", ripristina, { once: true });
  }, [dipendenza, video]);

  return annota;
}
