import { useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { API } from "../api/client";
import { Carta, Indietro, Stato } from "../componenti/Ui";
import TabellaGiocatori from "../componenti/TabellaGiocatori";
import EventiGiocatore from "../componenti/EventiGiocatore";

/**
 * Riepilogo statistico della partita (S-24).
 *
 * Ogni numero e cliccabile: porta con se gli eventi che lo compongono.
 * Non e una funzione in piu, e la conseguenza di come e scritto il motore
 * (`packages/core`): il numero E l'insieme di eventi.
 */

interface Indicatore {
  chiave: string; etichetta: string; formato: "intero" | "percentuale";
  casa: number; ospite: number; eventiCasa: number[]; eventiOspite: number[];
}
interface Gruppo { chiave: string; titolo: string; metriche: Indicatore[] }
interface Statistiche {
  squadre: { h: string; a: string };
  sets: Array<{ n: number; hPt: number; aPt: number }>;
  qualita: any;
  indicatori: Indicatore[];
  gruppi: Gruppo[];
  realizzatori: Array<{ team: "h" | "a"; jersey: number; punti: number; eventi: number[] }>;
}

const SKILL: Record<string, string> = {
  S: "Battuta", R: "Ricezione", E: "Alzata", A: "Attacco", D: "Difesa",
  B: "Muro", C: "Copertura", F: "Free ball", "0": "Palla a terra", X: "Altro",
};
const ESITO: Record<string, string> = { Point: "Punto", Error: "Errore", Blocked: "Murato" };

/**
 * Le statistiche di una partita.
 *
 * Si apre come pagina propria o **dentro una finestra**, sopra il dettaglio.
 * La differenza non e estetica: aprendola come pagina il video collegato
 * andrebbe perduto — e un `File` scelto dall'utente, che vive nello stato del
 * componente e nessuna navigazione puo conservare. Tornando indietro
 * bisognerebbe riselezionarlo, ogni volta.
 *
 * Da qui i due parametri: `id` per non dipendere dall'indirizzo, e
 * `inFinestra` per togliere il "torna alla partita", che dentro una finestra
 * non ha senso — si chiude, non si torna.
 */
export default function Statistiche({ id: idProp, inFinestra }: {
  id?: string; inFinestra?: boolean;
} = {}) {
  const params = useParams();
  const id = idProp ?? params.id;
  const [set, setSet] = useState<number | null>(null);
  const [vista, setVista] = useState<"squadre" | "giocatori">("squadre");
  const [aperto, setAperto] = useState<{ titolo: string; indici: number[] } | null>(null);
  // Gli eventi di una cella del tabellino arrivano da una rotta diversa: si
  // tengono a parte per non confondere i due percorsi.
  const [apertoGiocatore, setApertoGiocatore] =
    useState<{ titolo: string; url: string } | null>(null);

  const q = useQuery({
    queryKey: ["stats", id, set],
    queryFn: () => API.get<Statistiche>(
      `/matches/${id}/analysis/stats${set ? `?set=${set}` : ""}`),
  });

  const partita = useQuery({
    queryKey: ["partita", id],
    queryFn: () => API.get<any>(`/matches/${id}`),
  });

  const dettaglio = useQuery({
    queryKey: ["stats-eventi", id, aperto?.indici],
    queryFn: () => API.post<any[]>(`/matches/${id}/analysis/events`, { indici: aperto!.indici }),
    enabled: !!aperto,
  });

  const d = q.data;

  /*
   * Lo stato "pronta" e l'analisi devono andare d'accordo. Quando non lo fanno
   * — acquisizione fallita a meta, dato rimosso a mano — il messaggio secco
   * "non e disponibile un'analisi" fa credere a un difetto dell'applicazione.
   * Meglio dire cosa e successo e cosa si puo fare.
   */
  const assente = (q.error as any)?.code === "ANALISI_ASSENTE";
  if (assente) {
    return (
      <>
        {!inFinestra && <Indietro a={`/partite/${id}`} testo="Torna alla partita" />}
        <h1>Statistiche</h1>
        <div className="avviso attenzione">
          <div className="grassetto">Questa partita non ha ancora i dati dell'analisi.</div>
          <p style={{ marginBottom: 0 }}>
            Lo stato dice "pronta" ma il pacchetto non c'e: puo succedere se
            l'acquisizione si e interrotta. Riavvia l'elaborazione dal dettaglio
            della partita; se si ripete, serve guardare il registro del server.
          </p>
        </div>
      </>
    );
  }

  return (
    <Stato caricamento={q.isLoading} errore={q.error}>
      {d && <>
        {!inFinestra && <Indietro a={`/partite/${id}`} testo="Torna alla partita" />}
        <div className="riga-sp">
          <h1>Statistiche</h1>
          <span className="piccolo muto">
            {d.squadre.h} — {d.squadre.a} · {d.sets.map((s) => `${s.hPt}-${s.aPt}`).join(" / ")}
          </span>
        </div>

        <Qualita q={d.qualita} />

        <div className="riga" style={{ margin: "14px 0" }}>
          <button className={set === null ? "primario" : ""} onClick={() => setSet(null)}>Totale</button>
          {d.sets.map((s) => (
            <button key={s.n} className={set === s.n ? "primario" : ""} onClick={() => setSet(s.n)}>
              Set {s.n}
            </button>
          ))}
        </div>

        <div className="riga" style={{ marginBottom: 14 }}>
          {([["squadre", "Squadre"], ["giocatori", "Giocatori"]] as const).map(([v, testo]) => (
            <button key={v} className={vista === v ? "primario" : ""}
                    onClick={() => setVista(v)}>{testo}</button>
          ))}
        </div>

        {vista === "giocatori" ? (
          <TabellaGiocatori
            matchId={id!} set={set} roster={partita.data?.giocatori ?? []}
            onApriEventi={(titolo, chiave, team, jersey) => setApertoGiocatore({
              titolo,
              url: `/matches/${id}/analysis/players/${team}/${jersey}/${chiave}${set ? `?set=${set}` : ""}`,
            })} />
        ) : (
          /* Gli indicatori raggruppati per fondamentale: sedici numeri in fila
             non si leggono, gli stessi divisi per reparto si. */
          d.gruppi.map((g) => (
            <Carta key={g.chiave} style={{ marginBottom: 14 }}>
              <div className="riga-sp piccolo muto" style={{ marginBottom: 10 }}>
                <span><span className="punto casa" /> {d.squadre.h}</span>
                <span className="etichetta">{g.titolo}</span>
                <span>{d.squadre.a} <span className="punto ospite" /></span>
              </div>
              {g.metriche.map((i) => (
                <Barra key={i.chiave} i={i}
                       onApri={(lato) => setAperto({
                         titolo: `${i.etichetta} — ${lato === "h" ? d.squadre.h : d.squadre.a}`,
                         indici: lato === "h" ? i.eventiCasa : i.eventiOspite,
                       })} />
              ))}
            </Carta>
          ))
        )}

        {apertoGiocatore && (
          <EventiGiocatore titolo={apertoGiocatore.titolo} url={apertoGiocatore.url}
                           onChiudi={() => setApertoGiocatore(null)} />
        )}

        <h2>Migliori realizzatori</h2>
        <Carta>
          {d.realizzatori.length === 0
            ? <p className="piccolo muto">Nessun punto attribuito a un giocatore riconosciuto.</p>
            : d.realizzatori.map((r) => (
              <div key={`${r.team}-${r.jersey}`} className="riga-sp" style={{ padding: "6px 0" }}>
                <span className="riga" style={{ gap: 8 }}>
                  <span className={`punto ${r.team === "h" ? "casa" : "ospite"}`} />
                  <span className="grassetto">#{r.jersey}</span>
                  <span className="piccolo muto">{r.team === "h" ? d.squadre.h : d.squadre.a}</span>
                </span>
                <button className="piccolo" onClick={() => setAperto({
                  titolo: `Punti di #${r.jersey}`, indici: r.eventi })}>
                  {r.punti} punti
                </button>
              </div>
            ))}
        </Carta>

        {aperto && (
          <>
            <h2>{aperto.titolo}</h2>
            <Carta>
              <div className="riga-sp" style={{ marginBottom: 8 }}>
                <span className="piccolo muto">{aperto.indici.length} azioni</span>
                <button className="piccolo" onClick={() => setAperto(null)}>Chiudi</button>
              </div>
              <Stato caricamento={dettaglio.isLoading} errore={dettaglio.error}
                     vuoto={dettaglio.data?.length === 0} messaggioVuoto="Nessun evento.">
                <div className="tabella-scorrevole">
                  <table>
                    <thead><tr><th style={{ width: 50 }}>Set</th><th style={{ width: 90 }}>Punteggio</th>
                               <th style={{ width: 80 }}>Giocatore</th><th>Fondamentale</th>
                               <th>Esito</th><th style={{ width: 110 }}>Fotogramma</th></tr></thead>
                    <tbody>
                      {dettaglio.data?.map((e, i) => (
                        <tr key={i}>
                          <td className="numerico">{e.set}</td>
                          <td className="numerico piccolo">{e.azione ? `${e.azione.hPt}-${e.azione.aPt}` : "—"}</td>
                          <td className="grassetto">{e.jersey !== null ? `#${e.jersey}` :
                            <span className="muto piccolo">ignoto</span>}</td>
                          <td>{SKILL[e.skill] ?? e.skill}</td>
                          <td className="piccolo">{e.value ? ESITO[e.value] : "—"}</td>
                          <td className="numerico piccolo muto">{e.frame}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="piccolo muto" style={{ marginBottom: 0, marginTop: 10 }}>
                  Il numero di fotogramma e cio che permettera, con il video, di
                  saltare direttamente all'azione.
                </p>
              </Stato>
            </Carta>
          </>
        )}
      </>}
    </Stato>
  );
}

function Barra({ i, onApri }: { i: Indicatore; onApri: (lato: "h" | "a") => void }) {
  const tot = Math.max(i.casa + i.ospite, 1);
  const fmt = (v: number) => (i.formato === "percentuale" ? `${v}%` : String(v));
  const largh = i.formato === "percentuale"
    ? { c: i.casa, o: i.ospite }
    : { c: (i.casa / tot) * 100, o: (i.ospite / tot) * 100 };

  /*
   * Il numero e il contenuto, non un'etichetta accanto a una barra: sta in
   * cifre grandi e condensate, e **e il comando**. Chi vuole sapere da dove
   * viene quel 59 tocca il 59, non un pulsante di fianco.
   */
  return (
    <div className="indicatore">
      <button className="cifra valore casa" onClick={() => onApri("h")}
              title={`Mostra le ${i.etichetta.toLowerCase()}`}>{fmt(i.casa)}</button>

      <div className="mezzo">
        <div className="etichetta" style={{ textAlign: "center" }}>{i.etichetta}</div>
        <div className="riga" style={{ gap: 6, flexWrap: "nowrap" }}>
          <div className="barra" style={{ flex: 1, transform: "scaleX(-1)" }}>
            <div style={{ width: `${largh.c}%`, background: "var(--casa)" }} />
          </div>
          <div className="barra" style={{ flex: 1 }}>
            <div style={{ width: `${largh.o}%`, background: "var(--ospite)" }} />
          </div>
        </div>
      </div>

      <button className="cifra valore ospite" onClick={() => onApri("a")}
              title={`Mostra le ${i.etichetta.toLowerCase()}`}>{fmt(i.ospite)}</button>
    </div>
  );
}

/**
 * Dichiarazione della qualita del dato.
 * La piattaforma garantisce che il calcolo sia corretto, non che il dato in
 * ingresso lo sia: dirlo all'utente fa parte del prodotto.
 */
function Qualita({ q }: { q: any }) {
  const [aperto, setAperto] = useState(false);
  if (!q) return null;
  return (
    <div className="avviso attenzione">
      <div className="riga-sp">
        <span>
          <span className="grassetto">Dati prodotti dall'analisi automatica.</span>{" "}
          {q.azioni} azioni, {q.eventiTotali} tocchi rilevati
          {q.percentualeSenzaGiocatore > 0 &&
            `, di cui il ${q.percentualeSenzaGiocatore}% senza giocatore riconosciuto`}.
        </span>
        <button className="piccolo" onClick={() => setAperto(!aperto)}>
          {aperto ? "Nascondi" : `${q.avvisi.length} note`}
        </button>
      </div>
      {aperto && (
        <ul style={{ margin: "10px 0 0 18px" }} className="piccolo">
          {q.avvisi.map((a: string, i: number) => <li key={i}>{a}</li>)}
          <li className="muto">
            La piattaforma garantisce che le statistiche siano calcolate correttamente
            a partire da questi dati, non che i dati siano corretti.
          </li>
        </ul>
      )}
    </div>
  );
}
