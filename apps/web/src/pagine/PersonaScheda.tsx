import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { API } from "../api/client";
import { Carta, Indietro, Stato, data } from "../componenti/Ui";
import { Avatar } from "../componenti/Avatar";
import { BarraDivisa, Colonne, Righe, type Fetta } from "../componenti/Grafici";

/**
 * La scheda di una persona.
 *
 * Tre domande, in quest'ordine, perche e l'ordine in cui uno se le fa:
 *   1. quanto pesa — i numeri grandi in cima
 *   2. che giocatore e — la distribuzione dei tocchi lo dice meglio del ruolo
 *      scritto nel roster, perche viene da cosa ha fatto in campo
 *   3. come sta andando — l'andamento partita per partita
 *
 * E sotto, il dettaglio riga per riga, per chi vuole i numeri e non il quadro.
 */

interface Voce {
  punti: number; attacchi: number; attacchiPunto: number; attacchiErrore: number;
  attacchiMurati: number; efficienzaAttacco: number | null;
  battute: number; ace: number; erroriServizio: number; muriPunto: number;
  ricezioni: number; erroriRicezione: number; difese: number; erroriDifesa: number;
  alzate: number; tocchi: number;
}

interface Scheda {
  persona: { id: string; cognome: string; nome: string;
             avatarStile: string | null; avatarSeme: string | null;
             foto: number | null; avatarOpzioni?: Record<string, string[]> | null };
  maglie: number[];
  squadre: string[];
  totali: Voce;
  insieme: { partiteConteggiate: number; presenze: number; senzaAnalisi: number };
  limiti: { quotaSenzaGiocatore: number };
  perPartita: Array<{
    matchId: string; data: string; campionato: string; stagione: string;
    squadra: string; avversario: string; inCasa: boolean; maglia: number;
    set: number; voce: Voce;
  }>;
}

export default function PersonaScheda() {
  const { id } = useParams();
  const q = useQuery({
    queryKey: ["persona-scheda", id],
    queryFn: () => API.get<Scheda>(`/persons/${id}/scheda`),
  });

  const d = q.data;

  return (
    <Stato caricamento={q.isLoading} errore={q.error}>
      {d && <>
        <Indietro a="/persone" testo="Tutte le persone" />

        <div className="scheda-testa">
          <Avatar seme={d.persona.avatarSeme || `${d.persona.cognome} ${d.persona.nome}`}
                  stile={d.persona.avatarStile} d={92} className="scheda-volto"
                  opzioni={d.persona.avatarOpzioni}
                  personId={d.persona.id} foto={d.persona.foto} />
          <div>
            <h1 style={{ marginBottom: 4 }}>{d.persona.cognome} {d.persona.nome}</h1>
            <p className="muto" style={{ margin: 0 }}>
              {d.squadre.join(", ") || "Nessuna squadra"}
              {d.maglie.length > 0 && <> · maglia {d.maglie.join(", ")}</>}
            </p>
          </div>
        </div>

        {/* Su quante partite valgono i numeri: senza, non si leggono. */}
        {d.insieme.partiteConteggiate === 0 ? (
          <div className="avviso attenzione">
            {d.insieme.presenze === 0
              ? "Questa persona non compare nel roster di nessuna partita."
              : `Compare in ${d.insieme.presenze} partite, ma nessuna ha ancora l'analisi: `
                + "non c'e niente da contare."}
          </div>
        ) : (
          <>
            <p className="piccolo muto">
              Su <strong>{d.insieme.partiteConteggiate}</strong>{" "}
              {d.insieme.partiteConteggiate === 1 ? "partita analizzata" : "partite analizzate"}
              {d.insieme.senzaAnalisi > 0 &&
                <> · altre {d.insieme.senzaAnalisi} senza analisi, non conteggiate</>}
              {d.limiti.quotaSenzaGiocatore > 0 &&
                <> · il {d.limiti.quotaSenzaGiocatore}% dei tocchi nelle sue partite non ha
                   un giocatore riconosciuto, e non finisce in nessuna riga</>}
            </p>

            <Cifre v={d.totali} />

            <div className="griglia-due">
              <Carta>
                <h2 style={{ marginTop: 0 }}>Che giocatore e</h2>
                <p className="piccolo muto" style={{ marginTop: 0 }}>
                  Come si distribuiscono i suoi tocchi. Lo dice meglio del ruolo
                  scritto nel roster, perche viene da cosa ha fatto in campo.
                </p>
                <BarraDivisa fette={distribuzione(d.totali)} />
              </Carta>

              <Carta>
                <h2 style={{ marginTop: 0 }}>Come chiude l'attacco</h2>
                <p className="piccolo muto" style={{ marginTop: 0 }}>
                  Murato non e errore: il primo e merito del muro avversario,
                  il secondo e suo.
                </p>
                <Righe voci={[
                  { etichetta: "Punto", valore: d.totali.attacchiPunto, colore: "var(--successo)" },
                  { etichetta: "Murato", valore: d.totali.attacchiMurati, colore: "var(--attenzione)" },
                  { etichetta: "Errore", valore: d.totali.attacchiErrore, colore: "var(--pericolo)" },
                  { etichetta: "Continua", valore: Math.max(0, d.totali.attacchi
                      - d.totali.attacchiPunto - d.totali.attacchiMurati - d.totali.attacchiErrore),
                    colore: "var(--bordo-forte)" },
                ]} />
              </Carta>
            </div>

            {d.perPartita.length > 1 && (
              <Carta style={{ marginTop: "var(--sp4)" }}>
                <h2 style={{ marginTop: 0 }}>Partita per partita</h2>
                <div className="etichetta">Punti realizzati</div>
                <Colonne dati={[...d.perPartita].reverse().map((p) => ({
                  etichetta: p.avversario.split(" ").pop()!.slice(0, 6),
                  valore: p.voce.punti,
                  titolo: `${data(p.data)} · ${p.avversario}: ${p.voce.punti} punti`,
                }))} />

                <div className="etichetta" style={{ marginTop: "var(--sp4)" }}>
                  Efficienza in attacco
                </div>
                <Colonne unita="%" colore="var(--casa)"
                         dati={[...d.perPartita].reverse().map((p) => ({
                           etichetta: p.avversario.split(" ").pop()!.slice(0, 6),
                           valore: p.voce.efficienzaAttacco,
                           titolo: `${data(p.data)} · ${p.avversario}: ${p.voce.efficienzaAttacco}%`,
                         }))} />
              </Carta>
            )}

            <h2>Dettaglio</h2>
            <Carta>
              <div className="tabella-scorrevole">
                <table className="tabellino">
                  <thead>
                    <tr>
                      <th>Partita</th><th>N.</th>
                      <th style={{ textAlign: "right" }}>Punti</th>
                      <th style={{ textAlign: "right" }}>Att.</th>
                      <th style={{ textAlign: "right" }}>Eff.</th>
                      <th style={{ textAlign: "right" }}>Ace</th>
                      <th style={{ textAlign: "right" }}>Muri</th>
                      <th style={{ textAlign: "right" }}>Ric.</th>
                      <th style={{ textAlign: "right" }}>Dif.</th>
                      <th style={{ textAlign: "right" }}>Alz.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {d.perPartita.map((p) => (
                      <tr key={p.matchId}>
                        <td style={{ whiteSpace: "nowrap" }}>
                          <Link to={`/partite/${p.matchId}`}>
                            {p.inCasa ? "vs" : "a"} {p.avversario}
                          </Link>
                          <span className="muto piccolo"> · {data(p.data)}</span>
                        </td>
                        <td className="numerico">{p.maglia}</td>
                        <td className="numerico" style={{ textAlign: "right" }}>{p.voce.punti}</td>
                        <td className="numerico" style={{ textAlign: "right" }}>{p.voce.attacchi}</td>
                        <td className="numerico" style={{ textAlign: "right" }}>
                          {p.voce.efficienzaAttacco === null ? "—" : `${p.voce.efficienzaAttacco}%`}
                        </td>
                        <td className="numerico" style={{ textAlign: "right" }}>{p.voce.ace}</td>
                        <td className="numerico" style={{ textAlign: "right" }}>{p.voce.muriPunto}</td>
                        <td className="numerico" style={{ textAlign: "right" }}>{p.voce.ricezioni}</td>
                        <td className="numerico" style={{ textAlign: "right" }}>{p.voce.difese}</td>
                        <td className="numerico" style={{ textAlign: "right" }}>{p.voce.alzate}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Carta>
          </>
        )}
      </>}
    </Stato>
  );
}

/** I numeri che si guardano per primi, grandi. */
function Cifre({ v }: { v: Voce }) {
  const voci: Array<[string, string | number]> = [
    ["Punti", v.punti],
    ["Attacchi", v.attacchi],
    ["Efficienza", v.efficienzaAttacco === null ? "—" : `${v.efficienzaAttacco}%`],
    ["Ace", v.ace],
    ["Muri", v.muriPunto],
    ["Tocchi", v.tocchi],
  ];
  return (
    <div className="cifre">
      {voci.map(([etichetta, valore]) => (
        <Carta key={etichetta}>
          <div className="cifra">{valore}</div>
          <div className="etichetta">{etichetta}</div>
        </Carta>
      ))}
    </div>
  );
}

/**
 * La distribuzione dei tocchi. I colori non sono decorativi: raggruppano il
 * gioco d'attacco (caldi) e quello di seconda linea (freddi), cosi la forma
 * della barra si legge prima delle etichette.
 */
function distribuzione(v: Voce): Fetta[] {
  return [
    { chiave: "A", etichetta: "Attacco", valore: v.attacchi, colore: "var(--ospite)" },
    { chiave: "S", etichetta: "Battuta", valore: v.battute, colore: "var(--palla)" },
    { chiave: "B", etichetta: "Muro", valore: v.muriPunto, colore: "var(--pericolo)" },
    { chiave: "E", etichetta: "Alzata", valore: v.alzate, colore: "var(--casa)" },
    { chiave: "R", etichetta: "Ricezione", valore: v.ricezioni, colore: "var(--successo)" },
    { chiave: "D", etichetta: "Difesa", valore: v.difese, colore: "var(--bordo-forte)" },
  ];
}
