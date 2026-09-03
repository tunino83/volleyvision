import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { API, type ApiError } from "../api/client";
import { Campo, Carta } from "../componenti/Ui";
import { SelettoreAnagrafica } from "../componenti/SelettoreAnagrafica";

export default function PartitaNuova() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const [err, setErr] = useState<ApiError | null>(null);
  const [d, setD] = useState({
    competitionId: "", homeTeamId: "", awayTeamId: "",
    data: new Date().toISOString().slice(0, 16), citta: "", campo: "", arbitri: "", tag: [] as string[],
  });
  const [tagTesto, setTagTesto] = useState("");

  const camp = useQuery({ queryKey: ["campionati"], queryFn: () => API.get<any[]>("/competitions") });
  const squadre = useQuery({ queryKey: ["squadre"], queryFn: () => API.get<any[]>("/teams") });

  const crea = useMutation({
    mutationFn: () => API.post<any>("/matches", {
      ...d, data: new Date(d.data).toISOString(),
      tag: tagTesto.split(",").map((t) => t.trim()).filter(Boolean),
    }),
    onSuccess: (m) => nav(`/partite/${m.id}`),
    onError: (e: any) => setErr(e),
  });

  const pronto = d.competitionId && d.homeTeamId && d.awayTeamId && d.homeTeamId !== d.awayTeamId;
  // Il server dice che un riferimento non esiste: gli elenchi sono vecchi.
  const stale = err?.code === "NON_TROVATO";

  return (
    <>
      <h1>Nuova partita</h1>
      <p className="muto">
        Dopo la creazione si dichiara quanti set ha avuto la partita e si compongono le
        formazioni. Quella del set 1 e obbligatoria prima di caricare i video: e un dato
        di ingresso per l'analisi. Squadre e campionati che non sono in elenco si creano
        qui, senza uscire dal modulo.
      </p>

      <Carta className="colonna" style={{ maxWidth: 640 }}>
        <SelettoreAnagrafica
          etichetta="Campionato" risorsa="/competitions" chiaveCache="campionati"
          voci={camp.data} valore={d.competitionId} errore={err?.details?.competitionId}
          onCambia={(id) => setD({ ...d, competitionId: id })} />

        <div className="riga">
          <SelettoreAnagrafica
            etichetta="Squadra di casa" risorsa="/teams" chiaveCache="squadre"
            voci={squadre.data} valore={d.homeTeamId} escludi={d.awayTeamId}
            errore={err?.details?.homeTeamId}
            onCambia={(id) => setD({ ...d, homeTeamId: id })} />
          <SelettoreAnagrafica
            etichetta="Squadra ospite" risorsa="/teams" chiaveCache="squadre"
            voci={squadre.data} valore={d.awayTeamId} escludi={d.homeTeamId}
            errore={err?.details?.awayTeamId}
            onCambia={(id) => setD({ ...d, awayTeamId: id })} />
        </div>

        <div className="riga">
          <Campo etichetta="Data e ora" errore={err?.details?.data}>
            <input type="datetime-local" value={d.data} onChange={(e) => setD({ ...d, data: e.target.value })} />
          </Campo>
          <Campo etichetta="Citta"><input value={d.citta} onChange={(e) => setD({ ...d, citta: e.target.value })} /></Campo>
          <Campo etichetta="Campo"><input value={d.campo} onChange={(e) => setD({ ...d, campo: e.target.value })} /></Campo>
        </div>

        <Campo etichetta="Tag liberi (separati da virgola)">
          <input value={tagTesto} onChange={(e) => setTagTesto(e.target.value)}
                 placeholder="amichevole, casa, under19" />
        </Campo>

        {/*
          * "Campionato non trovato" mentre il campionato e li nell'elenco non
          * e un messaggio, e un enigma. Succede quando gli elenchi in pagina
          * sono piu vecchi del database — un'altra scheda ha eliminato quella
          * voce, o i dati sono stati ricaricati. Va detto cosa e successo e
          * offerta l'unica azione utile.
          */}
        {err && !err.details && (
          <div className="avviso errore">
            {stale ? (
              <>
                <div className="grassetto">Gli elenchi in questa pagina non sono piu aggiornati.</div>
                <p style={{ marginBottom: 8 }}>
                  Il {err.message.toLowerCase().includes("campionato") ? "campionato" : "dato"} scelto
                  non esiste piu sul server: puo essere stato eliminato altrove.
                  Ricarica gli elenchi e riprova.
                </p>
                <button className="piccolo" onClick={() => {
                  qc.invalidateQueries({ queryKey: ["campionati"] });
                  qc.invalidateQueries({ queryKey: ["squadre"] });
                  setD({ ...d, competitionId: "", homeTeamId: "", awayTeamId: "" });
                  setErr(null);
                }}>Ricarica gli elenchi</button>
              </>
            ) : err.message}
          </div>
        )}
        {d.homeTeamId && d.homeTeamId === d.awayTeamId &&
          <div className="avviso errore">Le due squadre devono essere diverse.</div>}

        <div className="riga">
          <button className="primario" disabled={!pronto || crea.isPending} onClick={() => crea.mutate()}>
            {crea.isPending ? "Creazione…" : "Crea partita"}
          </button>
          <button onClick={() => nav("/partite")}>Annulla</button>
        </div>
      </Carta>
    </>
  );
}
