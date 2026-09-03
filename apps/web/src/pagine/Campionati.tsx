import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { API, type ApiError } from "../api/client";
import { Campo, Carta, Stato } from "../componenti/Ui";
import { Trofeo } from "../componenti/Icone";

/**
 * Campionati e stagioni: elenco, creazione, correzione, condivisione.
 *
 * Non esistono campionati precaricati (decisione 9d): ognuno crea i propri e,
 * se vuole, li condivide per indirizzo email. La condivisione e **in sola
 * lettura** — chi la riceve vede, non tocca.
 */

const stagioneCorrente = () => {
  const d = new Date();
  const a = d.getMonth() >= 7 ? d.getFullYear() : d.getFullYear() - 1;
  return `${a}/${a + 1}`;
};

export default function Campionati() {
  const qc = useQueryClient();
  const [nuovo, setNuovo] = useState(false);
  const [apertoId, setApertoId] = useState<string | null>(null);

  const q = useQuery({ queryKey: ["campionati"], queryFn: () => API.get<any[]>("/competitions") });
  const ricarica = () => qc.invalidateQueries({ queryKey: ["campionati"] });

  return (
    <>
      <div className="riga-sp">
        <h1>Campionati e stagioni</h1>
        <button className="primario" onClick={() => { setNuovo(!nuovo); setApertoId(null); }}>
          <Trofeo d={16} /> Nuovo campionato
        </button>
      </div>
      <p className="muto piccolo">Creati da te. Non esistono campionati precaricati o comuni.</p>

      {nuovo && (
        <Modulo onFatto={() => { setNuovo(false); ricarica(); }} onAnnulla={() => setNuovo(false)} />
      )}

      <div style={{ marginTop: 16 }}>
        <Stato caricamento={q.isLoading} errore={q.error} vuoto={q.data?.length === 0}
               messaggioVuoto="Nessun campionato. Creane uno per organizzare le partite.">
          <div className="griglia">
            {q.data?.map((c) => (
              <Scheda key={c.id} c={c} aperto={apertoId === c.id}
                      onApri={() => { setApertoId(apertoId === c.id ? null : c.id); setNuovo(false); }}
                      onRicarica={ricarica} />
            ))}
          </div>
        </Stato>
      </div>
    </>
  );
}

function Scheda({ c, aperto, onApri, onRicarica }: {
  c: any; aperto: boolean; onApri: () => void; onRicarica: () => void;
}) {
  const [modifica, setModifica] = useState(false);
  const [conferma, setConferma] = useState("");
  const [err, setErr] = useState<ApiError | null>(null);

  const elimina = useMutation({
    mutationFn: () => API.del(`/competitions/${c.id}`),
    onSuccess: () => { setErr(null); onRicarica(); },
    onError: (e: any) => setErr(e),
  });

  // Chi non e proprietario vede e basta: la condivisione e in sola lettura.
  if (!c.proprietario) {
    return (
      <Carta>
        <div className="grassetto">{c.nome}</div>
        <div className="piccolo muto">{c.stagione}</div>
        {c.descrizione && <div className="piccolo" style={{ marginTop: 4 }}>{c.descrizione}</div>}
        <div className="piccolo muto" style={{ marginTop: 6 }}>
          {c.partite} partite · <span style={{ color: "var(--primario)" }}>condiviso con te</span>
        </div>
      </Carta>
    );
  }

  if (modifica) {
    return (
      <Modulo campionato={c} onFatto={() => { setModifica(false); onRicarica(); }}
              onAnnulla={() => setModifica(false)} />
    );
  }

  return (
    <Carta>
      <div className="grassetto">{c.nome}</div>
      <div className="piccolo muto">{c.stagione}</div>
      {c.descrizione && <div className="piccolo" style={{ marginTop: 4 }}>{c.descrizione}</div>}
      <div className="piccolo muto" style={{ marginTop: 6 }}>{c.partite} partite</div>

      {err && <div className="avviso errore piccolo">{err.message}</div>}

      <div className="riga" style={{ marginTop: 10 }}>
        <button className="piccolo" onClick={() => setModifica(true)}>Modifica</button>
        <button className="piccolo" onClick={onApri}>
          {aperto ? "Chiudi condivisioni" : "Condivisioni"}
        </button>
        {conferma === c.id ? (
          <>
            <button className="piccolo pericolo" disabled={elimina.isPending}
                    onClick={() => elimina.mutate()}>conferma</button>
            <button className="piccolo" onClick={() => setConferma("")}>annulla</button>
          </>
        ) : (
          <button className="piccolo pericolo" onClick={() => { setErr(null); setConferma(c.id); }}>
            Elimina
          </button>
        )}
      </div>

      {conferma === c.id && (
        <p className="piccolo" style={{ color: "var(--pericolo)", marginBottom: 0 }}>
          {c.partite > 0
            ? `Ha ${c.partite} partite: non si elimina finche sono li.`
            : "L'eliminazione e definitiva."}
        </p>
      )}

      {aperto && <Condivisioni id={c.id} />}
    </Carta>
  );
}

/** Chi vede questo campionato, oltre a chi lo possiede. */
function Condivisioni({ id }: { id: string }) {
  const qc = useQueryClient();
  const [email, setEmail] = useState("");
  const [err, setErr] = useState<ApiError | null>(null);
  const chiave = ["condivisioni-campionato", id];

  const q = useQuery({ queryKey: chiave, queryFn: () => API.get<any[]>(`/competitions/${id}/shares`) });
  const ricarica = () => qc.invalidateQueries({ queryKey: chiave });

  const aggiungi = useMutation({
    mutationFn: () => API.post(`/competitions/${id}/shares`, { email: email.trim() }),
    onSuccess: () => { setEmail(""); setErr(null); ricarica(); },
    onError: (e: any) => setErr(e),
  });
  const revoca = useMutation({
    mutationFn: (s: string) => API.del(`/competitions/${id}/shares/${s}`),
    onSuccess: ricarica,
  });

  return (
    <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--bordo)" }}>
      <div className="etichetta" style={{ marginBottom: 8 }}>Condiviso con</div>

      {q.data?.length === 0 && <p className="piccolo muto">Con nessuno.</p>}
      {q.data?.map((s) => (
        <div key={s.id} className="riga-sp piccolo" style={{ marginBottom: 6 }}>
          <span>
            {s.email}
            {s.statoInvito === "invito"
              ? <span className="muto"> · non ancora registrato</span>
              : null}
          </span>
          <button className="piccolo" disabled={revoca.isPending}
                  onClick={() => revoca.mutate(s.id)}>revoca</button>
        </div>
      ))}

      <div className="riga" style={{ marginTop: 8 }}>
        <input type="email" value={email} placeholder="indirizzo email" style={{ minWidth: 170 }}
               onChange={(e) => { setEmail(e.target.value); setErr(null); }}
               onKeyDown={(e) => { if (e.key === "Enter" && email.trim()) aggiungi.mutate(); }} />
        <button className="piccolo" disabled={!email.trim() || aggiungi.isPending}
                onClick={() => aggiungi.mutate()}>Condividi</button>
      </div>

      {err && <div className="errore-campo">
        {err.details ? Object.values(err.details).flat().join(". ") : err.message}
      </div>}

      <p className="piccolo muto" style={{ marginTop: 8, marginBottom: 0 }}>
        Sola lettura: chi lo riceve vede il campionato e le sue partite, non le
        modifica. Se non e ancora registrato, l'invito si attiva alla sua iscrizione.
      </p>
    </div>
  );
}

/** Un solo modulo per creare e per correggere: i campi sono gli stessi. */
function Modulo({ campionato, onFatto, onAnnulla }: {
  campionato?: any; onFatto: () => void; onAnnulla: () => void;
}) {
  const correzione = !!campionato;
  const [d, setD] = useState({
    nome: campionato?.nome ?? "",
    stagione: campionato?.stagione ?? stagioneCorrente(),
    descrizione: campionato?.descrizione ?? "",
  });
  const [err, setErr] = useState<ApiError | null>(null);

  const salva = useMutation({
    mutationFn: () => {
      const corpo = { nome: d.nome.trim(), stagione: d.stagione.trim(),
                      descrizione: d.descrizione.trim() || null };
      return correzione
        ? API.patch(`/competitions/${campionato.id}`, corpo)
        : API.post("/competitions", corpo);
    },
    onSuccess: () => { setErr(null); onFatto(); },
    onError: (e: any) => setErr(e),
  });

  const pronto = d.nome.trim().length >= 2 && d.stagione.trim();

  return (
    <Carta className="colonna">
      <div className="grassetto piccolo">
        {correzione ? "Correggi il campionato" : "Nuovo campionato"}
      </div>
      <div className="riga">
        <Campo etichetta="Nome" errore={err?.details?.nome}>
          <input value={d.nome} autoFocus onChange={(e) => setD({ ...d, nome: e.target.value })} />
        </Campo>
        <Campo etichetta="Stagione" errore={err?.details?.stagione}>
          <input value={d.stagione} placeholder="2026/2027" style={{ maxWidth: 130 }}
                 onChange={(e) => setD({ ...d, stagione: e.target.value })} />
        </Campo>
      </div>
      <Campo etichetta="Descrizione" errore={err?.details?.descrizione}>
        <input value={d.descrizione} placeholder="girone, categoria, note…"
               onChange={(e) => setD({ ...d, descrizione: e.target.value })} />
      </Campo>

      {err && !err.details && <div className="avviso errore">{err.message}</div>}

      <div className="riga">
        <button className="primario" disabled={!pronto || salva.isPending}
                onClick={() => salva.mutate()}>
          {salva.isPending ? "Salvataggio…" : correzione ? "Salva" : "Crea"}
        </button>
        <button onClick={onAnnulla}>Annulla</button>
      </div>
    </Carta>
  );
}
