import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { API, type ApiError } from "../api/client";
import { Campo, Carta, Stato } from "../componenti/Ui";
import { Persona } from "../componenti/Icone";

/**
 * Persone: l'identita stabile del giocatore.
 *
 * La parte delicata e **l'unione dei duplicati**, perche e irreversibile: una
 * persona sparisce e le sue apparizioni passano all'altra. Per questo la
 * schermata mostra sempre, prima di chiedere conferma, quante righe verrebbero
 * spostate e quale delle due sopravvive.
 */

export default function Persone() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [modifica, setModifica] = useState<string | null>(null);

  const persone = useQuery({
    queryKey: ["persone", q],
    queryFn: () => API.get<any[]>(`/persons${q ? `?q=${encodeURIComponent(q)}` : ""}`),
  });
  const dup = useQuery({ queryKey: ["persone-dup"], queryFn: () => API.get<any[]>("/persons/duplicati") });

  const ricarica = () => {
    qc.invalidateQueries({ queryKey: ["persone"] });
    qc.invalidateQueries({ queryKey: ["persone-dup"] });
  };

  return (
    <>
      <h1>Persone</h1>
      <p className="muto piccolo">
        L'identita stabile del giocatore, indipendente dal numero di maglia e dalla squadra.
        E cio che rende possibili le statistiche su piu partite.
      </p>

      {!!dup.data?.length && <Duplicati coppie={dup.data} onUnito={ricarica} />}

      <input placeholder="Cerca per cognome o nome…" value={q} style={{ maxWidth: 300, margin: "12px 0" }}
             onChange={(e) => setQ(e.target.value)} />

      <Stato caricamento={persone.isLoading} errore={persone.error} vuoto={persone.data?.length === 0}
             messaggioVuoto="Nessuna persona. Vengono create collegando i giocatori nei roster.">
        <Carta>
          <div className="tabella-scorrevole">
            <table>
              <thead>
                <tr><th>Cognome</th><th>Nome</th><th>Squadre</th>
                    <th style={{ width: 80 }}>Partite</th><th style={{ width: 90 }} /></tr>
              </thead>
              <tbody>
                {persone.data?.map((p) => (
                  modifica === p.id ? (
                    <tr key={p.id}>
                      <td colSpan={5} style={{ padding: 0 }}>
                        <ModificaPersona persona={p}
                                         onFatto={() => { setModifica(null); ricarica(); }}
                                         onAnnulla={() => setModifica(null)} />
                      </td>
                    </tr>
                  ) : (
                    <tr key={p.id}>
                      <td className="grassetto">
                        <Link to={`/persone/${p.id}`}>{p.cognome}</Link>
                      </td>
                      <td>{p.nome}</td>
                      <td className="piccolo muto">{p.squadre.join(", ") || "—"}</td>
                      <td className="numerico">{p.partite}</td>
                      <td style={{ textAlign: "right" }}>
                        <button className="piccolo" onClick={() => setModifica(p.id)}>modifica</button>
                      </td>
                    </tr>
                  )
                ))}
              </tbody>
            </table>
          </div>
        </Carta>
      </Stato>
    </>
  );
}

function ModificaPersona({ persona, onFatto, onAnnulla }: {
  persona: any; onFatto: () => void; onAnnulla: () => void;
}) {
  const [d, setD] = useState({ cognome: persona.cognome, nome: persona.nome });
  const [err, setErr] = useState<ApiError | null>(null);

  const salva = useMutation({
    mutationFn: () => API.patch(`/persons/${persona.id}`,
                                { cognome: d.cognome.trim(), nome: d.nome.trim() }),
    onSuccess: () => { setErr(null); onFatto(); },
    onError: (e: any) => setErr(e),
  });

  return (
    <div style={{ padding: "var(--sp3)", background: "var(--carta-alt)" }}>
      <div className="riga">
        <Campo etichetta="Cognome" errore={err?.details?.cognome}>
          <input value={d.cognome} autoFocus onChange={(e) => setD({ ...d, cognome: e.target.value })} />
        </Campo>
        <Campo etichetta="Nome" errore={err?.details?.nome}>
          <input value={d.nome} onChange={(e) => setD({ ...d, nome: e.target.value })} />
        </Campo>
      </div>
      <p className="piccolo muto" style={{ marginTop: 0 }}>
        Correggere qui non tocca i roster: quelli conservano il nome scritto per
        quella squadra o quella partita.
      </p>
      {err && !err.details && <div className="avviso errore piccolo">{err.message}</div>}
      <div className="riga">
        <button className="primario piccolo"
                disabled={!d.cognome.trim() || !d.nome.trim() || salva.isPending}
                onClick={() => salva.mutate()}>Salva</button>
        <button className="piccolo" onClick={onAnnulla}>Annulla</button>
      </div>
    </div>
  );
}

/**
 * I possibili duplicati li propone il server: stesso cognome e stessa iniziale
 * del nome. E un sospetto, non un verdetto — decide chi guarda.
 */
function Duplicati({ coppie, onUnito }: { coppie: any[]; onUnito: () => void }) {
  const [apri, setApri] = useState(false);

  return (
    <div className="avviso attenzione">
      <div className="riga-sp">
        <span>
          <span className="grassetto">{coppie.length} possibili duplicati.</span>{" "}
          Stesso cognome e stessa iniziale: potrebbero essere la stessa persona.
        </span>
        <button className="piccolo" onClick={() => setApri(!apri)}>
          {apri ? "Nascondi" : "Esamina"}
        </button>
      </div>

      {apri && (
        <div style={{ marginTop: 12 }}>
          {coppie.map((c, i) => <Coppia key={i} a={c.a} b={c.b} onUnito={onUnito} />)}
        </div>
      )}
    </div>
  );
}

function Coppia({ a, b, onUnito }: { a: any; b: any; onUnito: () => void }) {
  // `tieni` e chi sopravvive; l'altra viene assorbita e sparisce.
  const [tieni, setTieni] = useState<string | null>(null);
  const [err, setErr] = useState<ApiError | null>(null);
  const [esito, setEsito] = useState<string | null>(null);

  const unisci = useMutation({
    mutationFn: () => {
      const assorbita = tieni === a.id ? b.id : a.id;
      return API.post<any>(`/persons/${assorbita}/merge`, { intoPersonId: tieni });
    },
    onSuccess: (r: any) => {
      setErr(null);
      setEsito(`Unite: ${r.riassegnati.roster} righe di roster e ${r.riassegnati.partite} `
               + "presenze in partita sono passate alla persona tenuta.");
      onUnito();
    },
    onError: (e: any) => setErr(e),
  });

  if (esito) return <div className="avviso successo piccolo">{esito}</div>;

  const nome = (p: any) => `${p.cognome} ${p.nome}`;

  /**
   * Cosa distingue le due. Quando i nomi coincidono davvero — e capita, due
   * righe create per sbaglio — e l'unica informazione che permette di
   * scegliere: chi ha le presenze e chi non ne ha.
   */
  const presenze = (p: any) => {
    const parti = [`${p.partite} ${p.partite === 1 ? "partita" : "partite"}`];
    if (p.squadre?.length) parti.push(p.squadre.join(", "));
    else parti.push("nessuna squadra");
    return parti.join(" · ");
  };
  const omonime = nome(a) === nome(b);

  return (
    <Carta style={{ marginBottom: 10 }}>
      {omonime && (
        <p className="piccolo muto" style={{ marginTop: 0 }}>
          Hanno lo <strong>stesso nome</strong>: guarda le presenze per capire
          quale tenere. Di norma si tiene quella che ne ha di piu.
        </p>
      )}
      <div className="riga-sp">
        {[a, b].map((p) => (
          <button key={p.id}
                  className={tieni === p.id ? "primario" : ""}
                  style={{ flex: 1, justifyContent: "flex-start", minWidth: 0 }}
                  onClick={() => { setTieni(p.id); setErr(null); }}>
            <Persona d={16} />
            <span style={{ textAlign: "left", minWidth: 0 }}>
              <span className="grassetto">{nome(p)}</span>
              <br />
              <span className="piccolo">{presenze(p)}</span>
              <br />
              <span className="piccolo">
                {tieni === p.id ? "← questa resta" : "tieni questa"}
              </span>
            </span>
          </button>
        ))}
      </div>

      {tieni && (
        <>
          <p className="piccolo" style={{ marginTop: 10, marginBottom: 6 }}>
            {omonime ? (
              <>
                Si tiene quella con <strong>{presenze(tieni === a.id ? a : b)}</strong>;
                sparisce quella con <strong>{presenze(tieni === a.id ? b : a)}</strong>.
              </>
            ) : (
              <>
                <strong>{nome(tieni === a.id ? b : a)}</strong> viene assorbita in{" "}
                <strong>{nome(tieni === a.id ? a : b)}</strong> e sparisce.
              </>
            )}{" "}
            Tutte le presenze passano a quella tenuta.{" "}
            <strong>L'operazione non si annulla.</strong>
          </p>
          {err && <div className="avviso errore piccolo">{err.message}</div>}
          <div className="riga">
            <button className="pericolo piccolo" disabled={unisci.isPending}
                    onClick={() => unisci.mutate()}>
              {unisci.isPending ? "Unione…" : "Unisci definitivamente"}
            </button>
            <button className="piccolo" onClick={() => setTieni(null)}>Annulla</button>
          </div>
        </>
      )}
    </Carta>
  );
}
