import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { API } from "../api/client";
import { Carta, Stato } from "./Ui";

/**
 * Il tabellino: una riga per giocatore.
 *
 * Ogni cella con un numero **e cliccabile** e porta agli eventi che la
 * compongono, come per le statistiche di squadra. Non e una funzione in piu:
 * e la conseguenza di come e scritto il motore (`packages/core`), dove il
 * numero E l'insieme di eventi.
 *
 * Le colonne sono raggruppate per fondamentale, perche quindici numeri in
 * fila non si leggono.
 */

interface Voce {
  team: "h" | "a"; jersey: number; punti: number;
  attacchi: number; attacchiPunto: number; attacchiErrore: number; attacchiMurati: number;
  efficienzaAttacco: number | null;
  battute: number; ace: number; erroriServizio: number;
  muriPunto: number; ricezioni: number; erroriRicezione: number;
  difese: number; erroriDifesa: number; alzate: number; tocchi: number;
}

interface Dati {
  squadre: { h: string; a: string };
  voci: Voce[];
  tocchiSenzaGiocatore: number;
  tocchiTotali: number;
  quotaSenzaGiocatore: number;
}

/** Le colonne, con la chiave che il server sa tradurre in eventi. */
const COLONNE: Array<{ gruppo: string; chiave: keyof Voce; testo: string; pct?: boolean }> = [
  { gruppo: "", chiave: "punti", testo: "Pt" },
  { gruppo: "Attacco", chiave: "attacchi", testo: "Tot" },
  { gruppo: "Attacco", chiave: "attacchiPunto", testo: "Pt" },
  { gruppo: "Attacco", chiave: "attacchiErrore", testo: "Err" },
  { gruppo: "Attacco", chiave: "attacchiMurati", testo: "Mur" },
  { gruppo: "Attacco", chiave: "efficienzaAttacco", testo: "Eff", pct: true },
  { gruppo: "Servizio", chiave: "battute", testo: "Tot" },
  { gruppo: "Servizio", chiave: "ace", testo: "Ace" },
  { gruppo: "Servizio", chiave: "erroriServizio", testo: "Err" },
  { gruppo: "Muro", chiave: "muriPunto", testo: "Pt" },
  { gruppo: "Ricezione", chiave: "ricezioni", testo: "Tot" },
  { gruppo: "Ricezione", chiave: "erroriRicezione", testo: "Err" },
  { gruppo: "Difesa", chiave: "difese", testo: "Tot" },
  { gruppo: "Difesa", chiave: "erroriDifesa", testo: "Err" },
  { gruppo: "", chiave: "alzate", testo: "Alz" },
];

export default function TabellaGiocatori({ matchId, set, roster, onApriEventi }: {
  matchId: string; set: number | null;
  roster: Array<{ lato: string; numeroMaglia: number; cognome: string; nome: string;
                  personId?: string | null }>;
  onApriEventi: (titolo: string, chiave: string, team: "h" | "a", jersey: number) => void;
}) {
  const [lato, setLato] = useState<"h" | "a">("h");

  const q = useQuery({
    queryKey: ["stat-giocatori", matchId, set],
    queryFn: () => API.get<Dati>(
      `/matches/${matchId}/analysis/players${set ? `?set=${set}` : ""}`),
  });

  const d = q.data;
  const voci = (d?.voci ?? []).filter((v) => v.team === lato);

  /**
   * Il nome dal roster, e il collegamento alla persona quando c'e.
   *
   * Il fornitore manda numeri di maglia: il nome esiste solo perche qualcuno
   * ha compilato il roster, e la persona solo se l'ha anche collegata. Dove
   * manca si mostra il trattino, che e la verita.
   */
  const cella = (v: Voce) => {
    const g = roster.find((r) => r.lato === v.team && r.numeroMaglia === v.jersey);
    if (!g) return <span className="muto">—</span>;
    const testo = `${g.cognome} ${g.nome[0]}.`;
    return g.personId
      ? <Link to={`/persone/${g.personId}`} title="Apri la scheda della persona">{testo}</Link>
      : <span title="Nessuna persona collegata: non entra nelle statistiche di stagione">
          {testo}
        </span>;
  };

  return (
    <Stato caricamento={q.isLoading} errore={q.error}>
      {d && <>
        <div className="riga-sp" style={{ marginBottom: 12 }}>
          <div className="riga">
            {(["h", "a"] as const).map((l) => (
              <button key={l} className={lato === l ? "primario" : ""} onClick={() => setLato(l)}>
                <span className={`punto ${l === "h" ? "casa" : "ospite"}`} />
                {l === "h" ? d.squadre.h : d.squadre.a}
              </button>
            ))}
          </div>
          <span className="piccolo muto">tocca un numero per vedere le azioni</span>
        </div>

        {/*
          * La somma delle righe non fa il totale di squadra, e va detto qui e
          * non in una nota a fondo pagina: chi confronta i due numeri e si
          * accorge da solo che non tornano pensa a un difetto.
          */}
        {d.quotaSenzaGiocatore > 0 && (
          <div className="avviso attenzione piccolo">
            Il <strong>{d.quotaSenzaGiocatore}%</strong> dei tocchi
            ({d.tocchiSenzaGiocatore} su {d.tocchiTotali}) non ha un giocatore
            riconosciuto dall'analisi: e conteggiato nei totali di squadra ma non
            in queste righe. <strong>La somma della tabella non fa il totale.</strong>
          </div>
        )}

        <Carta>
          <div className="tabella-scorrevole">
            <table className="tabellino">
              <thead>
                <tr>
                  <th colSpan={2} />
                  {["Attacco", "Servizio", "Muro", "Ricezione", "Difesa"].map((g) => (
                    <th key={g} colSpan={COLONNE.filter((c) => c.gruppo === g).length}
                        style={{ textAlign: "center" }}>{g}</th>
                  ))}
                  <th />
                </tr>
                <tr>
                  <th style={{ width: 40 }}>N.</th>
                  <th>Giocatore</th>
                  {COLONNE.map((c) => (
                    <th key={`${c.gruppo}-${String(c.chiave)}`} style={{ textAlign: "right" }}>
                      {c.testo}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {voci.map((v) => (
                  <tr key={v.jersey}>
                    <td className="numerico grassetto">{v.jersey}</td>
                    <td style={{ whiteSpace: "nowrap" }}>{cella(v)}</td>
                    {COLONNE.map((c) => {
                      const valore = v[c.chiave] as number | null;
                      const vuoto = valore === null || valore === 0;
                      return (
                        <td key={String(c.chiave)} style={{ textAlign: "right" }}>
                          {vuoto ? <span className="muto">—</span> : (
                            <button className="piccolo cella"
                                    onClick={() => onApriEventi(
                                      `${c.gruppo || "Totale"} · ${c.testo} — #${v.jersey}`,
                                      String(c.chiave), v.team, v.jersey)}>
                              {c.pct ? `${valore}%` : valore}
                            </button>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {voci.length === 0 && (
            <p className="piccolo muto">Nessun giocatore riconosciuto per questa squadra.</p>
          )}
        </Carta>
      </>}
    </Stato>
  );
}
