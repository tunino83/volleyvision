import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { API } from "../api/client";
import { Campo, Carta, Stato } from "../componenti/Ui";
import { useAuth } from "../auth/AuthContext";

export default function Amministrazione() {
  const { utente } = useAuth();
  const qc = useQueryClient();
  const [scheda, setScheda] = useState<"utenti" | "registro" | "report">("utenti");
  const admin = utente!.ruolo === "admin";

  return (
    <>
      <h1>Amministrazione</h1>
      <p className="muto piccolo">
        La segreteria gestisce utenti, ruoli e reimpostazione password.
        Nessun accesso ai contenuti: video, partite, statistiche.
      </p>

      <div className="riga" style={{ margin: "12px 0" }}>
        <button className={scheda === "utenti" ? "primario" : ""} onClick={() => setScheda("utenti")}>Utenti</button>
        {admin && <button className={scheda === "registro" ? "primario" : ""} onClick={() => setScheda("registro")}>Registro</button>}
        {admin && <button className={scheda === "report" ? "primario" : ""} onClick={() => setScheda("report")}>Reportistica</button>}
      </div>

      {scheda === "utenti" && <Utenti admin={admin} qc={qc} />}
      {scheda === "registro" && <Registro />}
      {scheda === "report" && <Report />}
    </>
  );
}

function Utenti({ admin, qc }: { admin: boolean; qc: any }) {
  const [q, setQ] = useState("");
  const [nuovo, setNuovo] = useState(false);
  const [modifica, setModifica] = useState<string | null>(null);
  const utenti = useQuery({ queryKey: ["admin-utenti", q],
    queryFn: () => API.get<any[]>(`/admin/users${q ? `?q=${encodeURIComponent(q)}` : ""}`) });

  const azione = useMutation({
    mutationFn: ({ p, b, metodo }: any) => metodo === "post" ? API.post(p, b) : API.patch(p, b),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-utenti"] }),
  });

  return (
    <>
      <div className="riga-sp" style={{ marginBottom: 12 }}>
        <input placeholder="Cerca per email o nome…" value={q} style={{ maxWidth: 300 }}
               onChange={(e) => setQ(e.target.value)} />
        <button className="primario" onClick={() => { setNuovo(true); setModifica(null); }}>
          Aggiungi un'utenza
        </button>
      </div>

      {nuovo && <ModuloUtente qc={qc} onChiudi={() => setNuovo(false)} />}
      <Stato caricamento={utenti.isLoading} errore={utenti.error} vuoto={utenti.data?.length === 0}
             messaggioVuoto="Nessun utente.">
        <Carta>
          <div className="tabella-scorrevole">
            <table>
              <thead><tr><th>Email</th><th>Nome</th><th>Ruolo</th><th>Stato</th>
                         <th>Ultimo accesso</th><th style={{ width: 240 }}>Azioni</th></tr></thead>
              <tbody>
                {utenti.data?.map((u) => (
                  <tr key={u.id}>
                    <td>
                      {u.email}
                      {u.inAttesaDiInvito
                        ? <span className="piccolo" style={{ color: "var(--warning)" }}> · invito non ancora accettato</span>
                        : !u.emailVerificata && <span className="piccolo muto"> · non verificata</span>}
                    </td>
                    <td>{u.nome} {u.cognome}</td>
                    <td>
                      {admin ? (
                        <select value={u.ruolo} style={{ maxWidth: 130 }}
                                onChange={(e) => azione.mutate({ metodo: "patch",
                                  p: `/admin/users/${u.id}/role`, b: { ruolo: e.target.value } })}>
                          <option value="utente">utente</option>
                          <option value="segreteria">segreteria</option>
                          <option value="admin">admin</option>
                        </select>
                      ) : u.ruolo}
                    </td>
                    <td className="piccolo">{u.stato}</td>
                    <td className="piccolo muto numerico">
                      {u.ultimoAccesso ? new Date(u.ultimoAccesso).toLocaleDateString("it-IT") : "mai"}
                    </td>
                    <td>
                      <div className="riga piccolo">
                        <button onClick={() => { setModifica(u.id); setNuovo(false); }}>Modifica</button>
                        {u.inAttesaDiInvito
                          ? <button onClick={() => azione.mutate({ metodo: "post",
                              p: `/admin/users/${u.id}/invite`, b: {} })}>Rimanda invito</button>
                          : <button onClick={() => azione.mutate({ metodo: "post",
                              p: `/admin/users/${u.id}/password-reset`, b: {} })}>Invia reset</button>}
                        <button onClick={() => azione.mutate({ metodo: "patch",
                          p: `/admin/users/${u.id}/status`,
                          b: { stato: u.stato === "attivo" ? "sospeso" : "attivo" } })}>
                          {u.stato === "attivo" ? "Sospendi" : "Riattiva"}
                        </button>
                      </div>
                      {modifica === u.id && (
                        <ModuloUtente qc={qc} utente={u} onChiudi={() => setModifica(null)} />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="piccolo muto" style={{ marginBottom: 0, marginTop: 10 }}>
            Non esiste alcuna funzione per vedere o impostare una password:
            si puo solo mandare il collegamento con cui l'interessato la sceglie.
            Vale anche per le utenze create qui.
          </p>
        </Carta>
      </Stato>
    </>
  );
}

/**
 * Un solo modulo per creare e per correggere: i campi sono gli stessi.
 * **Nessun campo password**, in nessuno dei due casi: chi amministra manda un
 * collegamento, non sceglie le credenziali di qualcun altro.
 */
function ModuloUtente({ qc, utente, onChiudi }: { qc: any; utente?: any; onChiudi: () => void }) {
  const correzione = !!utente;
  const [d, setD] = useState({
    nome: utente?.nome ?? "", cognome: utente?.cognome ?? "",
    email: utente?.email ?? "", ruolo: utente?.ruolo ?? "utente",
  });
  const [err, setErr] = useState<any>(null);

  const salva = useMutation({
    mutationFn: () => correzione
      ? API.patch(`/admin/users/${utente.id}`,
                  { nome: d.nome.trim(), cognome: d.cognome.trim(), email: d.email.trim() })
      : API.post("/admin/users",
                 { nome: d.nome.trim(), cognome: d.cognome.trim(), email: d.email.trim(), ruolo: d.ruolo }),
    onSuccess: () => { setErr(null); qc.invalidateQueries({ queryKey: ["admin-utenti"] }); onChiudi(); },
    onError: (e: any) => setErr(e),
  });

  const pronto = d.nome.trim() && d.cognome.trim() && d.email.trim();

  return (
    <div style={{ border: "1px solid var(--primary)", borderRadius: "var(--r)",
                  padding: 12, margin: "10px 0", background: "#fbfcfe" }}>
      <div className="grassetto piccolo" style={{ marginBottom: 8 }}>
        {correzione ? "Correggi l'utenza" : "Nuova utenza"}
      </div>
      <div className="riga">
        <Campo etichetta="Nome" errore={err?.details?.nome}>
          <input value={d.nome} autoFocus onChange={(e) => setD({ ...d, nome: e.target.value })} />
        </Campo>
        <Campo etichetta="Cognome" errore={err?.details?.cognome}>
          <input value={d.cognome} onChange={(e) => setD({ ...d, cognome: e.target.value })} />
        </Campo>
        <Campo etichetta="Email" errore={err?.details?.email}>
          <input type="email" value={d.email} onChange={(e) => setD({ ...d, email: e.target.value })} />
        </Campo>
        {!correzione && (
          <Campo etichetta="Ruolo">
            <select value={d.ruolo} onChange={(e) => setD({ ...d, ruolo: e.target.value })}>
              <option value="utente">utente</option>
              <option value="segreteria">segreteria</option>
              <option value="admin">admin</option>
            </select>
          </Campo>
        )}
      </div>

      <p className="piccolo muto" style={{ marginTop: 0 }}>
        {correzione
          ? "Cambiando l'indirizzo, l'utenza dovra verificarlo di nuovo e accedera con quello nuovo."
          : "Non si imposta nessuna password: riceve un collegamento per sceglierla, valido 7 giorni."}
      </p>

      {err && !err.details && <div className="avviso errore piccolo">{err.message}</div>}

      <div className="riga">
        <button className="primario" disabled={!pronto || salva.isPending}
                onClick={() => salva.mutate()}>
          {salva.isPending ? "Salvataggio…" : correzione ? "Salva" : "Crea e manda l'invito"}
        </button>
        <button onClick={onChiudi}>Annulla</button>
      </div>
    </div>
  );
}

function Registro() {
  const q = useQuery({ queryKey: ["admin-audit"], queryFn: () => API.get<any[]>("/admin/audit") });
  return (
    <Stato caricamento={q.isLoading} errore={q.error} vuoto={q.data?.length === 0}
           messaggioVuoto="Nessuna operazione registrata.">
      <Carta>
        <div className="tabella-scorrevole">
          <table>
            <thead><tr><th style={{ width: 160 }}>Momento</th><th>Attore</th><th>Azione</th><th>Oggetto</th><th>Dettaglio</th></tr></thead>
            <tbody>
              {q.data?.map((r) => (
                <tr key={r.id}>
                  <td className="piccolo numerico">{new Date(r.momento).toLocaleString("it-IT")}</td>
                  <td className="piccolo">{r.attore}</td>
                  <td className="piccolo grassetto">{r.azione}</td>
                  <td className="piccolo muto">{r.oggetto ?? "—"}</td>
                  <td className="piccolo muto">{r.dettaglio ?? ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="piccolo muto" style={{ marginBottom: 0, marginTop: 10 }}>
          Sola lettura: nessuna modifica ne cancellazione.
        </p>
      </Carta>
    </Stato>
  );
}

function Report() {
  const q = useQuery({ queryKey: ["admin-report"], queryFn: () => API.get<any>("/admin/reports/usage") });
  const voci: Array<[string, string]> = q.data ? [
    ["Utenti registrati", q.data.utenti], ["Attivi negli ultimi 30 giorni", q.data.attiviUltimi30gg],
    ["Partite create", q.data.partite], ["Partite pronte", q.data.partitePronte],
    ["Analisi fallite", q.data.analisiFallite], ["Video caricati", q.data.videoCaricati],
    ["Squadre", q.data.squadre],
    ["Spazio occupato", `${(q.data.spazioOccupatoBytes / 1024 ** 3).toFixed(1)} GB`],
  ] : [];
  return (
    <Stato caricamento={q.isLoading} errore={q.error}>
      <div className="griglia">
        {voci.map(([k, v]) => (
          <Carta key={k}>
            <div className="piccolo muto">{k}</div>
            <div className="numerico" style={{ fontSize: 28, fontWeight: 600 }}>{v}</div>
          </Carta>
        ))}
      </div>
    </Stato>
  );
}
