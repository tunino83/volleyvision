import type { CSSProperties } from "react";

/**
 * Icone disegnate a mano, non una libreria.
 *
 * Sono poche e specifiche: pallone, rete, fischietto, campo. Una libreria
 * generica ne porterebbe duemila e nessuna di queste — e quelle che servono
 * qui sono proprio quelle che dicono "pallavolo" invece di "gestionale".
 *
 * Tutte ereditano il colore dal testo (`currentColor`) e la dimensione dalla
 * proprieta `d`: cosi stanno dentro un pulsante senza aggiustamenti.
 */

interface P { d?: number; className?: string; style?: CSSProperties; titolo?: string }

const base = (d: number, style?: CSSProperties) => ({
  width: d, height: d, viewBox: "0 0 24 24", fill: "none",
  stroke: "currentColor", strokeWidth: 1.7,
  strokeLinecap: "round" as const, strokeLinejoin: "round" as const,
  style, "aria-hidden": true,
});

/**
 * Il pallone: cerchio con le tre fasce curve del Mikasa. E il segno che porta
 * tutta l'identita — compare nel marchio, nel caricamento, nello stato vuoto.
 */
export function Pallone({ d = 20, className, style, titolo }: P) {
  return (
    <svg {...base(d, style)} className={className} role={titolo ? "img" : undefined}>
      {titolo && <title>{titolo}</title>}
      <circle cx="12" cy="12" r="9.2" />
      <path d="M12 2.8c3.4 3 5 6.6 4.7 10.9" />
      <path d="M12 2.8c-3 3.4-4.2 7.2-3.2 11.4" />
      <path d="M3.1 10.4c4.3-1.3 8.4-.7 11.9 2" />
      <path d="M20.6 9.3c-3.9 2.2-6.7 5.2-8.2 9" />
      <path d="M4.6 17.9c1.7-3.7 1.9-7.2.6-10.6" />
    </svg>
  );
}

/**
 * Nuvola sbarrata: non c'e connessione.
 *
 * Sbarrata e non semplicemente vuota: una nuvola da sola direbbe "cloud", che
 * e il contrario del messaggio. La sbarra si legge anche a 14 px.
 */
export function Nuvola({ d = 20, className, style }: P) {
  return (
    <svg {...base(d, style)} className={className}>
      <path d="M17.5 17.5H7a4 4 0 0 1-.6-7.96A5.5 5.5 0 0 1 15.9 8" />
      <path d="M19.5 9.4A4 4 0 0 1 19 17.4" />
      <path d="M3.5 3.5l17 17" />
    </svg>
  );
}

/**
 * Condivisione: due persone, una davanti e una dietro.
 *
 * Non le due frecce che si rincorrono — quelle dicono "sincronizza", che qui
 * sarebbe falso: le condivisioni sono in sola lettura e nulla torna indietro.
 */
export function Condivisa({ d = 20, className, style }: P) {
  return (
    <svg {...base(d, style)} className={className}>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3.5 19.5v-1.2a4.3 4.3 0 0 1 4.3-4.3h2.4a4.3 4.3 0 0 1 4.3 4.3v1.2" />
      <path d="M16.2 5.2a3.2 3.2 0 0 1 0 5.6" />
      <path d="M18.4 14.2a4.3 4.3 0 0 1 2.6 4v1.3" />
    </svg>
  );
}

/** Rete: due pali e la maglia. Serve dove si parla di campo e formazioni. */
export function Rete({ d = 20, className, style }: P) {
  return (
    <svg {...base(d, style)} className={className}>
      <path d="M3 5v14M21 5v14" />
      <path d="M3 7h18M3 11h18M3 15h18" />
      <path d="M8 7v8M13 7v8M18 7v8" />
    </svg>
  );
}

/** Campo visto dall'alto: rettangolo, linea di meta, linee dei tre metri. */
export function Campo({ d = 20, className, style }: P) {
  return (
    <svg {...base(d, style)} className={className}>
      <rect x="2.5" y="4.5" width="19" height="15" rx="1.2" />
      <path d="M12 4.5v15" />
      <path d="M7.5 4.5v15M16.5 4.5v15" strokeDasharray="2 2" opacity=".65" />
    </svg>
  );
}

export function Calendario({ d = 20, className, style }: P) {
  return (
    <svg {...base(d, style)} className={className}>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18M8 3v4M16 3v4" />
    </svg>
  );
}

/** Maglia da gioco: dice "squadra" meglio di due omini. */
export function Maglia({ d = 20, className, style }: P) {
  return (
    <svg {...base(d, style)} className={className}>
      <path d="M8.5 3 5 5 3.2 8.6 6 10.2V21h12V10.2l2.8-1.6L19 5l-3.5-2" />
      <path d="M8.5 3c0 1.9 1.6 3 3.5 3s3.5-1.1 3.5-3" />
    </svg>
  );
}

/**
 * La maglia come CONTENITORE, non come icona.
 *
 * Serve per il campo del numero di maglia: un'etichetta "N." puo voler dire
 * qualsiasi cosa, una maglia con dentro un numero no. E riempita e senza
 * tratto, perche qui e uno sfondo su cui si scrive, non un simbolo da leggere.
 */
export function MagliaPiena({ d = 20, className, style }: P) {
  return (
    <svg width={d} height={d} viewBox="0 0 24 24" className={className} style={style} aria-hidden>
      <path fill="currentColor"
            d="M8.6 2.6 4.6 4.9 2.4 9.1l3.2 1.9V21.4h12.8V11l3.2-1.9-2.2-4.2-4-2.3
               a3.6 3.6 0 0 1-7.2 0z" />
    </svg>
  );
}

export function Persona({ d = 20, className, style }: P) {
  return (
    <svg {...base(d, style)} className={className}>
      <circle cx="12" cy="8" r="3.6" />
      <path d="M4.6 20.2c.7-3.7 3.8-5.8 7.4-5.8s6.7 2.1 7.4 5.8" />
    </svg>
  );
}

export function Trofeo({ d = 20, className, style }: P) {
  return (
    <svg {...base(d, style)} className={className}>
      <path d="M7 4h10v5a5 5 0 0 1-10 0z" />
      <path d="M7 5.5H4.6a2.6 2.6 0 0 0 2.6 4M17 5.5h2.4a2.6 2.6 0 0 1-2.6 4" />
      <path d="M12 14v3.5M8.5 20.5h7" />
    </svg>
  );
}

export function Video({ d = 20, className, style }: P) {
  return (
    <svg {...base(d, style)} className={className}>
      <rect x="2.5" y="6" width="13" height="12" rx="2" />
      <path d="M15.5 10.6 21.5 7.6v8.8l-6-3z" />
    </svg>
  );
}

export function Statistiche({ d = 20, className, style }: P) {
  return (
    <svg {...base(d, style)} className={className}>
      <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
    </svg>
  );
}

export function Fischietto({ d = 20, className, style }: P) {
  return (
    <svg {...base(d, style)} className={className}>
      <path d="M13.5 8h6.7a1.3 1.3 0 0 1 0 2.6h-6.7" />
      <circle cx="8" cy="13" r="5.2" />
      <path d="M13.2 10.7A5.2 5.2 0 0 0 8 7.8V5.2" />
    </svg>
  );
}

export function Ingranaggio({ d = 20, className, style }: P) {
  return (
    <svg {...base(d, style)} className={className}>
      <circle cx="12" cy="12" r="3.2" />
      <path d="M12 2.6v2.6M12 18.8v2.6M21.4 12h-2.6M5.2 12H2.6M18.6 5.4l-1.8 1.8M7.2 16.8l-1.8 1.8M18.6 18.6l-1.8-1.8M7.2 7.2 5.4 5.4" />
    </svg>
  );
}

export function Sole({ d = 20, className, style }: P) {
  return (
    <svg {...base(d, style)} className={className}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2.4M12 19.6V22M22 12h-2.4M4.4 12H2M19.1 4.9l-1.7 1.7M6.6 17.4l-1.7 1.7M19.1 19.1l-1.7-1.7M6.6 6.6 4.9 4.9" />
    </svg>
  );
}

export function Luna({ d = 20, className, style }: P) {
  return (
    <svg {...base(d, style)} className={className}>
      <path d="M20.5 14.6A8.6 8.6 0 0 1 9.4 3.5a8.6 8.6 0 1 0 11.1 11.1z" />
    </svg>
  );
}

export function Campanella({ d = 20, className, style }: P) {
  return (
    <svg {...base(d, style)} className={className}>
      <path d="M18 8.6a6 6 0 1 0-12 0c0 6-2 7.4-2 7.4h16s-2-1.4-2-7.4z" />
      <path d="M13.7 19.5a2 2 0 0 1-3.4 0" />
    </svg>
  );
}

export function Carica({ d = 20, className, style }: P) {
  return (
    <svg {...base(d, style)} className={className}>
      <path d="M4 15.5V18a2.5 2.5 0 0 0 2.5 2.5h11A2.5 2.5 0 0 0 20 18v-2.5" />
      <path d="M12 15.5V3.5M7.6 7.9 12 3.5l4.4 4.4" />
    </svg>
  );
}

export function Esci({ d = 20, className, style }: P) {
  return (
    <svg {...base(d, style)} className={className}>
      <path d="M14.5 20.5H6A1.5 1.5 0 0 1 4.5 19V5A1.5 1.5 0 0 1 6 3.5h8.5" />
      <path d="M17 15.5 20.5 12 17 8.5M20 12H9.5" />
    </svg>
  );
}

/**
 * Il marchio: pallone piu nome. Sta qui e non nell'intestazione perche lo
 * useranno anche l'accesso, gli stati vuoti e — un giorno — la schermata di
 * avvio delle shell native.
 */
export function Marchio({ d = 26, compatto = false }: { d?: number; compatto?: boolean }) {
  return (
    <span className="marchio">
      <span className="marchio-palla"><Pallone d={d} /></span>
      {!compatto && (
        <span className="marchio-nome">
          <b>VOLLEY</b><span>VISION</span>
        </span>
      )}
    </span>
  );
}
