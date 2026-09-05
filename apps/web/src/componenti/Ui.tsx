import { Link } from "react-router-dom";
import { LogoSquadra } from "./LogoSquadra";
import type { CSSProperties, ReactNode } from "react";

export function Carta({ children, onClick, className = "", style }: {
  children: ReactNode; onClick?: () => void; className?: string; style?: CSSProperties;
}) {
  return (
    <div className={`carta ${onClick ? "carta-cliccabile" : ""} ${className}`}
         onClick={onClick} style={style}>
      {children}
    </div>
  );
}

export function Campo({ etichetta, errore, children }:
  { etichetta: string; errore?: string[]; children: ReactNode }) {
  return (
    <div className="campo">
      <label>{etichetta}</label>
      {children}
      {errore?.length ? <div className="errore-campo">{errore.join(". ")}</div> : null}
    </div>
  );
}

/**
 * Comando di pagina.
 *
 * Non mostra i numeri di tutte le pagine: con molte partite diventerebbe una
 * fila di cifre inutile. Dice **dove si e** e permette di muoversi di uno.
 * Sparisce da solo quando c'e una pagina sola: un comando che non fa nulla e
 * peggio di nessun comando.
 */
export function Pagine({ pagina, pagine, totale, onVai }: {
  pagina: number; pagine: number; totale: number; onVai: (p: number) => void;
}) {
  if (pagine <= 1) {
    return <p className="piccolo muto" style={{ marginTop: 12 }}>{totale} in tutto</p>;
  }
  return (
    <div className="riga-sp" style={{ marginTop: 16 }}>
      <span className="piccolo muto">
        Pagina {pagina} di {pagine} · {totale} in tutto
      </span>
      <span className="riga">
        <button className="piccolo" disabled={pagina <= 1} onClick={() => onVai(pagina - 1)}>
          ‹ Precedente
        </button>
        <button className="piccolo" disabled={pagina >= pagine} onClick={() => onVai(pagina + 1)}>
          Successiva ›
        </button>
      </span>
    </div>
  );
}

/**
 * Il ritorno all'elenco da cui si e arrivati.
 *
 * Serve su OGNI schermata di dettaglio, e per questo sta qui: nessuna lo
 * aveva, e la barra di navigazione non basta. Portare a "Squadre" non e la
 * stessa cosa che tornare indietro — la navigazione ti sposta, il ritorno ti
 * riporta, e chi sta guardando una squadra si aspetta la seconda cosa.
 *
 * Va messo **sopra il titolo**: sotto verrebbe letto come un'azione della
 * pagina invece che come una via d'uscita.
 */
export function Indietro({ a, testo }: { a: string; testo: string }) {
  return (
    <Link to={a} className="indietro">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
           strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M15 18l-6-6 6-6" />
      </svg>
      {testo}
    </Link>
  );
}

/** Nessuna schermata bianca: sempre caricamento, contenuto, vuoto o errore. */
export function Stato({ caricamento, errore, vuoto, messaggioVuoto, azione, children }: {
  caricamento?: boolean; errore?: unknown; vuoto?: boolean;
  messaggioVuoto?: string; azione?: ReactNode; children: ReactNode;
}) {
  if (caricamento) return <div className="vuoto">Caricamento…</div>;
  if (errore) {
    const e = errore as { message?: string; correlationId?: string };
    return (
      <div className="avviso errore">
        <div className="grassetto">{e.message ?? "Si e verificato un errore"}</div>
        {e.correlationId && <div className="piccolo muto">Codice: {e.correlationId}</div>}
      </div>
    );
  }
  if (vuoto) return <div className="vuoto"><p>{messaggioVuoto ?? "Nessun elemento"}</p>{azione}</div>;
  return <>{children}</>;
}

const CLASSI: Record<string, string> = {
  WAITING: "attesa", PENDING: "corso", RUNNING: "corso",
  READY_FOR_PP: "corso", READY: "pronta", ERROR: "errore",
};
const ETICHETTE: Record<string, string> = {
  WAITING: "In attesa video", PENDING: "In coda", RUNNING: "Analisi in corso",
  READY_FOR_PP: "Elaborazione dati", READY: "Pronta", ERROR: "Errore",
};
export const Pillola = ({ stato }: { stato: string }) =>
  <span className={`pillola ${CLASSI[stato] ?? "attesa"}`}>{ETICHETTE[stato] ?? stato}</span>;

/**
 * Due squadre non sono un elenco: sono un **incontro**.
 *
 * Barra colore, nome in tipografia condensata, e in mezzo il punteggio dei set
 * se c'e. E la disposizione dei tabelloni, e vale ovunque compaiano due
 * squadre: elenco partite, dettaglio, statistiche. Averla in un posto solo
 * significa che cambiarla la cambia dappertutto.
 */
export const Squadre = ({ casa, ospite, parziali, squadraCasa, squadraOspite }: {
  casa: string; ospite: string;
  parziali?: Array<{ hPt: number; aPt: number }>;
  /*
   * Le squadre intere, quando ci sono, per mostrarne lo stemma.
   *
   * Facoltative: qualche chiamante ha solo i due nomi (le formazioni salvate
   * dentro una partita, per esempio, che ne conservano una copia). Renderle
   * obbligatorie avrebbe costretto a inventare stemmi dove non c'e la
   * squadra, e uno stemma inventato e peggio di nessuno stemma.
   */
  squadraCasa?: { id: string; nome: string; logoStile?: string | null;
                  logoSeme?: string | null; logoOpzioni?: Record<string, string[]> | null;
                  logo?: number | null } | null;
  squadraOspite?: typeof squadraCasa;
}) => (
  <span className="incontro">
    <span className="lato">
      {squadraCasa
        ? <LogoSquadra nome={squadraCasa.nome} stile={squadraCasa.logoStile}
                       seme={squadraCasa.logoSeme} opzioni={squadraCasa.logoOpzioni}
                       teamId={squadraCasa.id} logo={squadraCasa.logo} d={22} />
        : <span className="fascia casa" />}
      <span className="nome">{casa}</span>
    </span>
    <span className="parziali">
      {parziali?.length
        ? parziali.map((s) => `${s.hPt}-${s.aPt}`).join("  ")
        : "vs"}
    </span>
    <span className="lato destra">
      {squadraOspite
        ? <LogoSquadra nome={squadraOspite.nome} stile={squadraOspite.logoStile}
                       seme={squadraOspite.logoSeme} opzioni={squadraOspite.logoOpzioni}
                       teamId={squadraOspite.id} logo={squadraOspite.logo} d={22} />
        : <span className="fascia ospite" />}
      <span className="nome">{ospite}</span>
    </span>
  </span>
);

export function gb(bytes: number | null | undefined) {
  if (!bytes) return "—";
  return bytes >= 1024 ** 3 ? `${(bytes / 1024 ** 3).toFixed(1)} GB`
       : bytes >= 1024 ** 2 ? `${(bytes / 1024 ** 2).toFixed(0)} MB`
       : `${(bytes / 1024).toFixed(0)} KB`;
}

export const data = (iso: string) => new Date(iso).toLocaleDateString("it-IT",
  { day: "2-digit", month: "2-digit", year: "numeric" });
