import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { API } from "../api/client";
import { Carta, Indietro, Pillola, Squadre as Duo, Stato, data, gb } from "../componenti/Ui";
import Formazioni from "../componenti/Formazioni";
import RosterPartita from "../componenti/RosterPartita";
import Cambi from "../componenti/Cambi";
import VideoLocale from "../componenti/VideoLocale";
import Caricamento from "../componenti/Caricamento";
import Lavorazione from "../componenti/Lavorazione";
import { FinestraStatistiche } from "../componenti/FinestraStatistiche";

const PASSI = ["WAITING", "PENDING", "RUNNING", "READY_FOR_PP", "READY"];
const NOMI: Record<string, string> = {
  WAITING: "In attesa video", PENDING: "In coda", RUNNING: "Analisi",
  READY_FOR_PP: "Elaborazione", READY: "Pronta",
};

export default function PartitaDettaglio() {
  const { id } = useParams();
  const qc = useQueryClient();
  const [scheda, setScheda] = useState<"dati" | "formazioni" | "cambi" | "video" | "locale">("dati");
  /** Le statistiche in una finestra sopra, per non perdere il video scelto. */
  const [statistiche, setStatistiche] = useState(false);

  const q = useQuery({
    queryKey: ["partita", id],
    queryFn: () => API.get<any>(`/matches/${id}`),
    refetchInterval: (d: any) => (d?.state?.data?.stato && !["READY", "ERROR", "WAITING"]
      .includes(d.state.data.stato) ? 60000 : false),
  });
  const m = q.data;

  return (
    <Stato caricamento={q.isLoading} errore={q.error}>
      {m && <>
        <Indietro a="/partite" testo="Tutte le partite" />
        <div className="riga-sp">
          <div>
            <h1><Duo casa={m.home.nome} ospite={m.away.nome} /></h1>
            <p className="muto">{m.competition.nome} · {data(m.data)}{m.citta && ` · ${m.citta}`}</p>
          </div>
          <div className="riga">
            {m.stato === "READY" && m.revisioneAnalisi && (
              /*
               * Si apre in una finestra, non in un'altra pagina.
               *
               * Il video collegato e un `File` scelto dall'utente: vive nello
               * stato del componente, e nessuna navigazione puo conservarlo.
               * Andando alle statistiche e tornando indietro bisognava
               * riselezionarlo ogni volta — proprio mentre si stava
               * lavorando su quella partita.
               */
              <button className="bottone" onClick={() => setStatistiche(true)}>
                Vedi statistiche
              </button>
            )}
            <Pillola stato={m.stato} />
          </div>
        </div>

        <Carta style={{ marginTop: 12 }}>
          <div className="riga" style={{ flexWrap: "wrap" }}>
            {PASSI.map((s, i) => {
              const idx = PASSI.indexOf(m.stato);
              const fatto = idx >= i && m.stato !== "ERROR";
              return (
                <span key={s} className="riga piccolo" style={{ gap: 6 }}>
                  <span className="punto" style={{ background: fatto ? "var(--success)" : "var(--bordo)" }} />
                  <span className={idx === i ? "grassetto" : "muto"}>{NOMI[s]}</span>
                  {i < PASSI.length - 1 && <span className="muto">›</span>}
                </span>
              );
            })}
          </div>
          {m.stato === "ERROR" && (
            <div className="avviso errore" style={{ marginTop: 10 }}>
              {m.erroreMessaggio ?? "L'analisi non e riuscita."} Contatta l'assistenza.
            </div>
          )}
          <Lavorazione matchId={m.id} statoPartita={m.stato} />
        </Carta>

        <div className="riga" style={{ marginTop: 18 }}>
          {(["dati", "formazioni", "cambi", "video", "locale"] as const)
            .filter((s) => s !== "locale" || m.stato === "READY")
            .map((s) => (
            <button key={s} className={scheda === s ? "primario" : ""} onClick={() => setScheda(s)}>
              {s === "dati" ? "Dati e roster" : s === "formazioni" ? "Formazioni"
               : s === "cambi" ? "Sostituzioni" : s === "video" ? "Video" : "Guarda il video"}
            </button>
          ))}
        </div>

        {scheda === "dati" && (
          <>
            <h2>Completezza</h2>
            <Carta>
              <ul style={{ margin: 0, paddingLeft: 18 }}>
                <li>Roster casa: <span className="grassetto">{m.completezza.rosterCasa}</span> giocatori</li>
                <li>Roster ospite: <span className="grassetto">{m.completezza.rosterOspite}</span> giocatori</li>
                <li>Formazione set 1: {m.completezza.set1Completo
                  ? <span style={{ color: "var(--success)" }}>completa</span>
                  : <span style={{ color: "var(--warning)" }}>mancante — obbligatoria prima del caricamento</span>}</li>
                <li>
                  Set con formazione: {m.completezza.setCompletati}
                  {m.completezza.setDichiarati
                    ? ` di ${m.completezza.setDichiarati}`
                    : " · numero di set non ancora dichiarato"}
                </li>
              </ul>
            </Carta>

            <RosterPartita partita={m} />
          </>
        )}

        {scheda === "formazioni" && <Formazioni partita={m} />}
        {scheda === "cambi" && <Cambi partita={m} />}
        {scheda === "video" && <Caricamento partita={m} />}
        {scheda === "locale" && <VideoLocale partita={m} />}
      </>}

      {/* Dentro la guardia: senza partita non c'e `m.id` da leggere, e la
          schermata cadrebbe mentre carica o se la richiesta fallisce. */}
      {m && (
        <FinestraStatistiche aperta={statistiche} onChiudi={() => setStatistiche(false)}
                             id={m.id} titolo={`${m.home.nome} — ${m.away.nome}`} />
      )}
    </Stato>
  );
}
