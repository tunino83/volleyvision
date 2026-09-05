import { useState } from "react";
import { Stemma } from "../componenti/LogoSquadra";
import { Preferita } from "../componenti/Preferita";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { API, type ApiError } from "../api/client";
import { Campo, Carta, Stato } from "../componenti/Ui";

export default function Squadre() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const [apri, setApri] = useState(false);
  const [d, setD] = useState({ nome: "", stagione: "2026/2027" });
  const [err, setErr] = useState<ApiError | null>(null);

  const q = useQuery({ queryKey: ["squadre"], queryFn: () => API.get<any[]>("/teams") });
  const crea = useMutation({
    mutationFn: () => API.post<any>("/teams", d),
    onSuccess: (t) => { qc.invalidateQueries({ queryKey: ["squadre"] }); nav(`/squadre/${t.id}`); },
    onError: (e: any) => setErr(e),
  });

  return (
    <>
      <div className="riga-sp">
        <h1>Squadre</h1>
        <button className="primario" onClick={() => setApri(!apri)}>Nuova squadra</button>
      </div>
      <p className="muto piccolo">
        Ogni utente crea le proprie squadre: non esistono anagrafiche comuni.
      </p>

      {apri && (
        <Carta className="colonna">
          <div className="riga">
            <Campo etichetta="Nome" errore={err?.details?.nome}>
              <input value={d.nome} onChange={(e) => setD({ ...d, nome: e.target.value })} autoFocus />
            </Campo>
            <Campo etichetta="Stagione" errore={err?.details?.stagione}>
              <input value={d.stagione} onChange={(e) => setD({ ...d, stagione: e.target.value })} />
            </Campo>
          </div>
          {err && !err.details && <div className="avviso errore">{err.message}</div>}
          <div className="riga">
            <button className="primario" onClick={() => crea.mutate()} disabled={crea.isPending}>Crea</button>
            <button onClick={() => setApri(false)}>Annulla</button>
          </div>
        </Carta>
      )}

      <div style={{ marginTop: 16 }}>
        <Stato caricamento={q.isLoading} errore={q.error} vuoto={q.data?.length === 0}
               messaggioVuoto="Nessuna squadra. Creane una per iniziare.">
          <div className="griglia">
            {q.data?.map((t) => (
              <Carta key={t.id} onClick={() => nav(`/squadre/${t.id}`)}>
                <div className="riga-sp">
                  <div className="riga">
                    <Stemma squadra={t} d={34} />
                    <div style={{ minWidth: 0 }}>
                      <div className="grassetto">{t.nome}</div>
                      <div className="piccolo muto">{t.stagione}</div>
                    </div>
                  </div>
                  {/* Anche sulle condivise: preferire e di chi guarda, non
                      del proprietario. */}
                  <Preferita risorsa="teams" id={t.id} preferita={!!t.preferita}
                             chiaviDaAggiornare={[["squadre"], ["squadra", t.id]]} />
                </div>
                <div className="piccolo muto" style={{ marginTop: 6 }}>
                  {t.giocatori} giocatori · {t.partite} partite
                </div>
                {!t.proprietario && (
                  <div className="piccolo muto" style={{ marginTop: 4 }}>
                    condivisa da {t.proprietarioNome} · sola lettura
                  </div>
                )}
              </Carta>
            ))}
          </div>
        </Stato>
      </div>
    </>
  );
}
