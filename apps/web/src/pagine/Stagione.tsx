import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { API } from "../api/client";
import { Carta, Stato, data } from "../componenti/Ui";
import { Statistiche as IcoStat } from "../componenti/Icone";

/**
 * STATISTICHE SU PIU PARTITE.
 *
 * Due cose che questa schermata deve dire sempre, e che nessun'altra dice:
 *
 * 1. **Su quali partite valgono.** Un numero senza il suo insieme viene letto
 *    come se valesse per tutto. L'elenco delle partite considerate e in
 *    fondo, aperto da un comando: non nascosto, ma non ingombrante.
 * 2. **Chi resta fuori.** Si aggrega sulla persona, non sul numero di maglia,
 *    perche il numero cambia fra squadre e stagioni. Chi non ha una persona
 *    collegata non compare, e va detto invece di lasciarlo scoprire.
 */

interface Voce {
  personId: string; cognome: string; nome: string;
  maglie: number[]; squadre: string[]; partite: number;
  punti: number; attacchi: number; attacchiPunto: number; attacchiErrore: number;
  attacchiMurati: number; efficienzaAttacco: number | null;
  battute: number; ace: number; erroriServizio: number; muriPunto: number;
  ricezioni: number; erroriRicezione: number; difese: number; erroriDifesa: number;
  alzate: number; tocchi: number;
}

interface Dati {
  voci: Voce[];
  insieme: {
    partiteConsiderate: number; partiteTrovate: number; senzaAnalisi: number;
    elenco: Array<{ id: string; data: string; casa: string; ospite: string;
                    campionato: string; stagione: string }>;
  };
  limiti: { vociSenzaPersona: number; tocchiSenzaGiocatore: number; quotaSenzaGiocatore: number };
}

type Ordine = keyof Pick<Voce, "punti" | "attacchi" | "efficienzaAttacco" | "ace"
                              | "muriPunto" | "ricezioni" | "difese" | "alzate" | "tocchi">;

const COLONNE: Array<{ chiave: Ordine; testo: string; gruppo: string; pct?: boolean }> = [
  { chiave: "punti", testo: "Punti", gruppo: "" },
  { chiave: "attacchi", testo: "Attacchi", gruppo: "Attacco" },
  { chiave: "efficienzaAttacco", testo: "Eff", gruppo: "Attacco", pct: true },
  { chiave: "ace", testo: "Ace", gruppo: "Servizio" },
  { chiave: "muriPunto", testo: "Muri", gruppo: "Muro" },
  { chiave: "ricezioni", testo: "Ricez.", gruppo: "Ricezione" },
  { chiave: "difese", testo: "Difese", gruppo: "Difesa" },
  { chiave: "alzate", testo: "Alzate", gruppo: "" },
];

export default function Stagione() {
  const [competitionId, setCompetitionId] = useState("");
  const [teamId, setTeamId] = useState("");
  const [ordine, setOrdine] = useState<Ordine>("punti");
  const [apriInsieme, setApriInsieme] = useState(false);

  const camp = useQuery({ queryKey: ["campionati"], queryFn: () => API.get<any[]>("/competitions") });
  const squadre = useQuery({ queryKey: ["squadre"], queryFn: () => API.get<any[]>("/teams") });

  const q = useQuery({
    queryKey: ["stagione", competitionId, teamId],
    queryFn: () => API.get<Dati>(`/stats/players?${new URLSearchParams(
      Object.fromEntries(Object.entries({ competitionId, teamId }).filter(([, v]) => v)))}`),
  });

  const d = q.data;
  const voci = [...(d?.voci ?? [])].sort((a, b) => {
    const va = a[ordine] ?? -1, vb = b[ordine] ?? -1;
    return (vb as number) - (va as number);
  });

  return (
    <>
      <div className="riga-sp">
        <h1>Statistiche di stagione</h1>
        <span className="piccolo muto">
          <IcoStat d={14} /> aggregate per persona, su piu partite
        </span>
      </div>

      <div className="riga" style={{ marginBottom: 16 }}>
        <select value={competitionId} style={{ maxWidth: 240 }}
                onChange={(e) => setCompetitionId(e.target.value)}>
          <option value="">Tutti i campionati</option>
          {camp.data?.map((c) => (
            <option key={c.id} value={c.id}>{c.nome} ({c.stagione})</option>
          ))}
        </select>
        <select value={teamId} style={{ maxWidth: 240 }} onChange={(e) => setTeamId(e.target.value)}>
          <option value="">Tutte le squadre</option>
          {squadre.data?.map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}
        </select>
      </div>

      <Stato caricamento={q.isLoading} errore={q.error}>
        {d && <>
          {/* L'ampiezza dell'insieme, sempre visibile: e la premessa di ogni
              numero che segue. */}
          <div className={`avviso ${d.insieme.partiteConsiderate === 0 ? "attenzione" : "info"}`}>
            <div className="riga-sp">
              <span>
                {d.insieme.partiteConsiderate === 0 ? (
                  <>Nessuna partita analizzata con questi filtri: non c'e nulla da aggregare.</>
                ) : (
                  <>
                    Calcolate su <strong>{d.insieme.partiteConsiderate}</strong>{" "}
                    {d.insieme.partiteConsiderate === 1 ? "partita" : "partite"} con analisi
                    {d.insieme.senzaAnalisi > 0 && (
                      <> · {d.insieme.senzaAnalisi} trovate ma non ancora analizzate</>
                    )}
                  </>
                )}
              </span>
              {d.insieme.elenco.length > 0 && (
                <button className="piccolo" onClick={() => setApriInsieme(!apriInsieme)}>
                  {apriInsieme ? "Nascondi" : "Quali partite"}
                </button>
              )}
            </div>

            {apriInsieme && (
              <div style={{ marginTop: 10 }}>
                {d.insieme.elenco.map((m) => (
                  <div key={m.id} className="piccolo" style={{ padding: "3px 0" }}>
                    <Link to={`/partite/${m.id}`}>
                      {data(m.data)} · {m.casa} — {m.ospite}
                    </Link>
                    <span className="muto"> · {m.campionato} {m.stagione}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {(d.limiti.vociSenzaPersona > 0 || d.limiti.quotaSenzaGiocatore > 0) && (
            <div className="avviso attenzione piccolo">
              <strong>Chi non compare.</strong>{" "}
              {d.limiti.vociSenzaPersona > 0 && (
                <>{d.limiti.vociSenzaPersona} righe non hanno una persona collegata nel roster:
                  senza identita stabile non si possono sommare fra partite. Collegale dalla
                  scheda "Dati e roster" della partita. </>
              )}
              {d.limiti.quotaSenzaGiocatore > 0 && (
                <>Inoltre il {d.limiti.quotaSenzaGiocatore}% dei tocchi non ha un giocatore
                  riconosciuto dall'analisi.</>
              )}
            </div>
          )}

          {voci.length > 0 && (
            <Carta>
              <div className="tabella-scorrevole">
                <table className="tabellino">
                  <thead>
                    <tr>
                      <th>Giocatore</th>
                      <th>Squadre</th>
                      <th style={{ textAlign: "right" }}>Part.</th>
                      {COLONNE.map((c) => (
                        <th key={c.chiave} style={{ textAlign: "right" }}>
                          {/* L'intestazione ordina: e il comando piu naturale
                              su una tabella, e non serve spiegarlo. */}
                          <button className="piccolo cella"
                                  style={{ color: ordine === c.chiave ? "var(--palla)" : undefined }}
                                  onClick={() => setOrdine(c.chiave)}>
                            {c.testo}{ordine === c.chiave ? " ↓" : ""}
                          </button>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {voci.map((v) => (
                      <tr key={v.personId}>
                        <td style={{ whiteSpace: "nowrap" }}>
                          {/* Qui la persona c'e per costruzione: si aggrega su
                              di lei, quindi il collegamento e sempre valido. */}
                          <Link to={`/persone/${v.personId}`}>
                            <span className="grassetto">{v.cognome}</span> {v.nome}
                          </Link>
                          <span className="muto piccolo"> #{v.maglie.join(", ")}</span>
                        </td>
                        <td className="piccolo muto">{v.squadre.join(", ")}</td>
                        <td className="numerico" style={{ textAlign: "right" }}>{v.partite}</td>
                        {COLONNE.map((c) => {
                          const val = v[c.chiave] as number | null;
                          return (
                            <td key={c.chiave} className="numerico" style={{ textAlign: "right" }}>
                              {val === null ? <span className="muto">—</span>
                               : c.pct ? `${val}%` : val}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <p className="piccolo muto" style={{ marginBottom: 0, marginTop: 10 }}>
                Si somma sulla <strong>persona</strong>, non sul numero di maglia: il numero
                cambia fra squadre e stagioni, e le maglie usate sono indicate accanto al nome.
              </p>
            </Carta>
          )}
        </>}
      </Stato>
    </>
  );
}
