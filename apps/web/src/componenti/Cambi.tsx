import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { API, type ApiError } from "../api/client";
import { Campo, Carta } from "./Ui";
import { Rete } from "./Icone";

/**
 * Sostituzioni, registrate a posteriori.
 *
 * La partita e gia stata giocata: i cambi si inseriscono guardando il referto,
 * non in diretta. Per questo si chiede il **minuto** e non il fotogramma —
 * quello lo calcola il server quando conosce gli fps, che arrivano col
 * pacchetto di analisi.
 *
 * Non sono obbligatori per far partire l'analisi. Servono a sapere **chi era
 * in campo** in un dato momento, che e cio che rende attribuibili le azioni
 * quando il fornitore non riconosce il giocatore.
 */

export default function Cambi({ partita }: { partita: any }) {
  const qc = useQueryClient();
  const ricarica = () => qc.invalidateQueries({ queryKey: ["partita", partita.id] });
  const [set, setSet] = useState(1);

  const dichiarati: number | null = partita.numeroSet ?? null;

  if (!dichiarati) {
    return (
      <>
        <h2>Sostituzioni</h2>
        <div className="avviso attenzione">
          Prima dichiara <strong>quanti set</strong> ha avuto la partita, nella
          scheda Formazioni: senza, non si sa a quali set assegnare i cambi.
        </div>
      </>
    );
  }

  const attivo = Math.min(set, dichiarati);
  const delSet = partita.sostituzioni.filter((c: any) => c.set === attivo);

  return (
    <>
      <div className="riga-sp">
        <h2>Sostituzioni</h2>
        <span className="piccolo muto">
          {partita.sostituzioni.length} in tutta la partita
        </span>
      </div>

      <div className="avviso info">
        Si inseriscono <strong>dopo</strong>, leggendo il referto. Non servono per
        avviare l'analisi: servono a sapere chi era in campo quando il fornitore
        non riconosce il giocatore.
      </div>

      <div className="riga" style={{ margin: "12px 0" }}>
        {Array.from({ length: dichiarati }, (_, i) => i + 1).map((n) => {
          const quanti = partita.sostituzioni.filter((c: any) => c.set === n).length;
          return (
            <button key={n} className={attivo === n ? "primario" : ""} onClick={() => setSet(n)}>
              Set {n}{quanti > 0 && <span className="badge">{quanti}</span>}
            </button>
          );
        })}
      </div>

      <div className="griglia-due">
        {(["h", "a"] as const).map((lato) => (
          <Squadra key={`${lato}-${attivo}`} lato={lato} set={attivo} partita={partita}
                   cambi={delSet.filter((c: any) => c.lato === lato)} onRicarica={ricarica} />
        ))}
      </div>
    </>
  );
}

function Squadra({ lato, set, partita, cambi, onRicarica }: {
  lato: "h" | "a"; set: number; partita: any; cambi: any[]; onRicarica: () => void;
}) {
  const [apri, setApri] = useState(false);
  const roster = partita.giocatori
    .filter((g: any) => g.lato === lato)
    .sort((a: any, b: any) => a.numeroMaglia - b.numeroMaglia);
  const nome = lato === "h" ? partita.home.nome : partita.away.nome;

  const elimina = useMutation({
    mutationFn: (subId: string) => API.del(`/matches/${partita.id}/substitutions/${subId}`),
    onSuccess: onRicarica,
  });

  const etichetta = (n: number) => {
    const g = roster.find((x: any) => x.numeroMaglia === n);
    return g ? `${n} ${g.cognome}` : `${n}`;
  };

  return (
    <Carta>
      <div className="riga-sp" style={{ marginBottom: 10 }}>
        <span className="grassetto">
          <span className={`punto ${lato === "h" ? "casa" : "ospite"}`} /> {nome}
        </span>
        <span className="piccolo muto">{cambi.length} nel set {set}</span>
      </div>

      {roster.length === 0 ? (
        <div className="avviso attenzione piccolo">
          Nessun giocatore nel roster: aggiungilo dalla scheda "Dati e roster".
        </div>
      ) : cambi.length === 0 ? (
        <p className="piccolo muto">Nessuna sostituzione in questo set.</p>
      ) : (
        <div className="tabella-scorrevole">
          <table>
            <tbody>
              {cambi.sort((a, b) => (a.minuto ?? 0) - (b.minuto ?? 0)).map((c) => (
                <tr key={c.id}>
                  <td className="piccolo muto numerico" style={{ width: 54 }}>
                    {c.minuto != null ? `${c.minuto}'` : "—"}
                  </td>
                  <td>
                    <span className="riga" style={{ gap: 6 }}>
                      <span className="piccolo" style={{ color: "var(--pericolo)" }}>
                        ↓ {etichetta(c.esce)}
                      </span>
                      <span className="piccolo" style={{ color: "var(--successo)" }}>
                        ↑ {etichetta(c.entra)}
                      </span>
                    </span>
                  </td>
                  <td style={{ width: 80, textAlign: "right" }}>
                    <button className="piccolo" disabled={elimina.isPending}
                            onClick={() => elimina.mutate(c.id)}>togli</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {apri ? (
        <Modulo partita={partita} lato={lato} set={set} roster={roster}
                onFatto={() => { setApri(false); onRicarica(); }}
                onAnnulla={() => setApri(false)} />
      ) : (
        <button className="piccolo" style={{ marginTop: 10 }} disabled={roster.length < 2}
                onClick={() => setApri(true)}>
          <Rete d={15} /> Aggiungi una sostituzione
        </button>
      )}
    </Carta>
  );
}

function Modulo({ partita, lato, set, roster, onFatto, onAnnulla }: {
  partita: any; lato: "h" | "a"; set: number; roster: any[];
  onFatto: () => void; onAnnulla: () => void;
}) {
  const [d, setD] = useState({ esce: "", entra: "", minuto: "" });
  const [err, setErr] = useState<ApiError | null>(null);

  const salva = useMutation({
    mutationFn: () => API.post(`/matches/${partita.id}/substitutions`, {
      set, lato, esce: Number(d.esce), entra: Number(d.entra),
      minuto: d.minuto === "" ? null : Number(d.minuto),
    }),
    onSuccess: () => { setErr(null); onFatto(); },
    onError: (e: any) => setErr(e),
  });

  const uguali = d.esce !== "" && d.esce === d.entra;
  const pronto = d.esce !== "" && d.entra !== "" && !uguali && d.minuto !== "";

  const opzioni = (escludi: string) => roster
    .filter((g: any) => String(g.numeroMaglia) !== escludi)
    .map((g: any) => (
      <option key={g.id} value={g.numeroMaglia}>{g.numeroMaglia} — {g.cognome} {g.nome}</option>
    ));

  return (
    <div style={{ border: "1px solid var(--primario)", borderRadius: "var(--r-piccolo)",
                  padding: "var(--sp3)", marginTop: "var(--sp3)", background: "var(--carta-alt)" }}>
      <div className="riga">
        <Campo etichetta="Esce" errore={err?.details?.esce}>
          <select value={d.esce} autoFocus onChange={(e) => setD({ ...d, esce: e.target.value })}>
            <option value="">— chi esce —</option>
            {opzioni(d.entra)}
          </select>
        </Campo>
        <Campo etichetta="Entra" errore={err?.details?.entra}>
          <select value={d.entra} onChange={(e) => setD({ ...d, entra: e.target.value })}>
            <option value="">— chi entra —</option>
            {opzioni(d.esce)}
          </select>
        </Campo>
        <Campo etichetta="Minuto" errore={err?.details?.minuto}>
          <input type="number" min={0} value={d.minuto} style={{ width: 100 }}
                 placeholder="dal via"
                 onChange={(e) => setD({ ...d, minuto: e.target.value })} />
        </Campo>
      </div>

      <p className="piccolo muto" style={{ marginTop: 0 }}>
        Il minuto e dall'inizio del video. Diventera un fotogramma esatto quando
        arriveranno gli fps col pacchetto di analisi.
      </p>

      {uguali && <div className="avviso errore piccolo">Chi esce e chi entra devono essere diversi.</div>}
      {err && !err.details && <div className="avviso errore piccolo">{err.message}</div>}

      <div className="riga">
        <button className="primario piccolo" disabled={!pronto || salva.isPending}
                onClick={() => salva.mutate()}>
          {salva.isPending ? "Salvataggio…" : "Registra"}
        </button>
        <button className="piccolo" onClick={onAnnulla}>Annulla</button>
      </div>
    </div>
  );
}
