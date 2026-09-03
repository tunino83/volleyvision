import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { API, type ApiError } from "../api/client";
import { Carta } from "./Ui";

/**
 * Roster della partita, correggibile riga per riga.
 *
 * L'importazione dal roster squadra copre il caso normale; questa schermata
 * copre gli altri due, che capitano sempre: il numero battuto storto e il
 * giocatore che non doveva esserci.
 *
 * La rimozione puo essere rifiutata dal server — il giocatore e ancora in una
 * formazione o in un cambio — e il rifiuto si mostra dove si e premuto, con
 * scritto dove compare.
 */

const RUOLI = ["palleggiatore", "opposto", "schiacciatore", "centrale", "libero"];

export default function RosterPartita({ partita }: { partita: any }) {
  const qc = useQueryClient();
  const ricarica = () => qc.invalidateQueries({ queryKey: ["partita", partita.id] });
  const cap = partita.capacita ?? {};
  const bloccato = cap.modificaRoster === false;

  return (
    <>
      <h2>Roster della partita</h2>
      {/* Il roster e stato il dato di ingresso dell'analisi: dopo si guarda. */}
      {bloccato && <div className="avviso info">{cap.motivoBlocco}</div>}
      <div className="griglia-due">
        {(["h", "a"] as const).map((lato) => (
          <Squadra key={lato} lato={lato} partita={partita}
                   bloccato={bloccato} onRicarica={ricarica} />
        ))}
      </div>
    </>
  );
}

function Squadra({ lato, partita, bloccato, onRicarica }: {
  lato: "h" | "a"; partita: any; bloccato: boolean; onRicarica: () => void;
}) {
  const [nuovo, setNuovo] = useState(false);
  const giocatori = partita.giocatori
    .filter((g: any) => g.lato === lato)
    .sort((a: any, b: any) => a.numeroMaglia - b.numeroMaglia);

  const importa = useMutation({
    mutationFn: () => API.post(`/matches/${partita.id}/players/import`, { lato }),
    onSuccess: onRicarica,
  });

  return (
    <Carta>
      <div className="riga-sp">
        <span className="grassetto">
          <span className={`punto ${lato === "h" ? "casa" : "ospite"}`} />{" "}
          {lato === "h" ? partita.home.nome : partita.away.nome}
        </span>
        {!bloccato && (
          <button className="piccolo" disabled={importa.isPending} onClick={() => importa.mutate()}>
            Importa dal roster squadra
          </button>
        )}
      </div>

      <div className="tabella-scorrevole">
        <table style={{ marginTop: 8 }}>
          <tbody>
            {giocatori.map((g: any) => (
              <Riga key={g.id} g={g} partita={partita} bloccato={bloccato} onRicarica={onRicarica} />
            ))}
          </tbody>
        </table>
      </div>

      {giocatori.length === 0 && (
        <p className="piccolo muto">Nessun giocatore. Importa il roster della squadra,
          oppure aggiungili uno alla volta.</p>
      )}

      {bloccato ? null : nuovo
        ? <Modulo partita={partita} lato={lato} onFatto={() => { setNuovo(false); onRicarica(); }}
                  onAnnulla={() => setNuovo(false)} />
        : <button className="piccolo" style={{ marginTop: 10 }} onClick={() => setNuovo(true)}>
            + Aggiungi un giocatore
          </button>}
    </Carta>
  );
}

function Riga({ g, partita, bloccato, onRicarica }: {
  g: any; partita: any; bloccato: boolean; onRicarica: () => void;
}) {
  const [modifica, setModifica] = useState(false);
  const [conferma, setConferma] = useState(false);
  const [err, setErr] = useState<ApiError | null>(null);

  const rimuovi = useMutation({
    mutationFn: () => API.del(`/matches/${partita.id}/players/${g.id}`),
    onSuccess: () => { setConferma(false); setErr(null); onRicarica(); },
    onError: (e: any) => { setConferma(false); setErr(e); },
  });

  if (modifica) {
    return (
      <tr>
        <td colSpan={4} style={{ padding: 0 }}>
          <Modulo partita={partita} lato={g.lato} giocatore={g}
                  onFatto={() => { setModifica(false); onRicarica(); }}
                  onAnnulla={() => setModifica(false)} />
        </td>
      </tr>
    );
  }

  return (
    <tr>
      <td className="numerico" style={{ width: 40 }}>{g.numeroMaglia}</td>
      <td>
        {g.personId ? (
          <Link to={`/persone/${g.personId}`} title="Apri la scheda della persona">
            {g.cognome} {g.nome}
          </Link>
        ) : (
          <>
            {g.cognome} {g.nome}
            <span className="piccolo" style={{ color: "var(--attenzione)" }}
                  title="Senza persona collegata non entra nelle statistiche di stagione">
              {" "}· persona non collegata
            </span>
          </>
        )}
        {err && <div className="errore-campo">{err.message}</div>}
      </td>
      <td className="piccolo muto">
        {g.ruolo ?? ""}{g.libero ? " · libero" : ""}{g.capitano ? " · capitano" : ""}
      </td>
      <td style={{ width: bloccato ? 0 : 150, textAlign: "right", whiteSpace: "nowrap" }}>
        {bloccato ? null : conferma ? (
          <span className="riga piccolo" style={{ justifyContent: "flex-end" }}>
            <span className="muto">rimuovere?</span>
            <button className="piccolo" disabled={rimuovi.isPending}
                    onClick={() => rimuovi.mutate()}>si</button>
            <button className="piccolo" onClick={() => setConferma(false)}>no</button>
          </span>
        ) : (
          <span className="riga piccolo" style={{ justifyContent: "flex-end" }}>
            <button className="piccolo" onClick={() => { setErr(null); setModifica(true); }}>
              modifica
            </button>
            <button className="piccolo" onClick={() => { setErr(null); setConferma(true); }}>
              rimuovi
            </button>
          </span>
        )}
      </td>
    </tr>
  );
}

/**
 * Un solo modulo per l'aggiunta e per la correzione: i campi sono gli stessi,
 * cambia solo dove va a finire. Duplicarlo significherebbe correggere due
 * volte ogni validazione.
 */
function Modulo({ partita, lato, giocatore, onFatto, onAnnulla }: {
  partita: any; lato: "h" | "a"; giocatore?: any;
  onFatto: () => void; onAnnulla: () => void;
}) {
  const correzione = !!giocatore;
  const [d, setD] = useState({
    numeroMaglia: giocatore ? String(giocatore.numeroMaglia) : "",
    cognome: giocatore?.cognome ?? "",
    nome: giocatore?.nome ?? "",
    ruolo: giocatore?.ruolo ?? "",
    libero: giocatore?.libero ?? false,
    capitano: giocatore?.capitano ?? false,
    salvaInSquadra: true,
  });
  const [err, setErr] = useState<ApiError | null>(null);

  const salva = useMutation({
    mutationFn: () => {
      const comune = {
        numeroMaglia: Number(d.numeroMaglia), cognome: d.cognome.trim(), nome: d.nome.trim(),
        ruolo: d.ruolo || null, libero: d.libero, capitano: d.capitano,
      };
      return correzione
        ? API.patch(`/matches/${partita.id}/players/${giocatore.id}`, comune)
        : API.post(`/matches/${partita.id}/players`,
                   { ...comune, lato, salvaInSquadra: d.salvaInSquadra });
    },
    onSuccess: () => { setErr(null); onFatto(); },
    onError: (e: any) => setErr(e),
  });

  const pronto = d.numeroMaglia !== "" && d.cognome.trim() && d.nome.trim();

  return (
    <div style={{
      border: "1px solid var(--primary)", borderRadius: "var(--r)",
      padding: 10, marginTop: 10, background: "#fbfcfe",
    }}>
      <div className="riga">
        <input type="number" min={0} max={99} value={d.numeroMaglia} autoFocus
               style={{ width: 80 }} placeholder="n."
               onChange={(e) => setD({ ...d, numeroMaglia: e.target.value })} />
        <input value={d.cognome} placeholder="Cognome"
               onChange={(e) => setD({ ...d, cognome: e.target.value })} />
        <input value={d.nome} placeholder="Nome"
               onChange={(e) => setD({ ...d, nome: e.target.value })} />
      </div>
      <div className="riga" style={{ marginTop: 8 }}>
        <select value={d.ruolo} style={{ width: 160 }}
                onChange={(e) => setD({ ...d, ruolo: e.target.value })}>
          <option value="">ruolo —</option>
          {RUOLI.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
        <label className="riga piccolo" style={{ whiteSpace: "nowrap" }}>
          <input type="checkbox" style={{ width: "auto" }} checked={d.libero}
                 onChange={(e) => setD({ ...d, libero: e.target.checked })} /> libero
        </label>
        <label className="riga piccolo" style={{ whiteSpace: "nowrap" }}>
          <input type="checkbox" style={{ width: "auto" }} checked={d.capitano}
                 onChange={(e) => setD({ ...d, capitano: e.target.checked })} /> capitano
        </label>
      </div>

      {!correzione && (
        <label className="riga piccolo" style={{ marginTop: 8 }}>
          <input type="checkbox" style={{ width: "auto" }} checked={d.salvaInSquadra}
                 onChange={(e) => setD({ ...d, salvaInSquadra: e.target.checked })} />
          Salvalo anche nel roster della squadra
        </label>
      )}

      {correzione && (
        <p className="piccolo muto" style={{ margin: "8px 0 0" }}>
          Cambiando il numero, formazioni e cambi vengono aggiornati di conseguenza.
          Il roster della squadra non viene toccato: la correzione vale per questa partita.
        </p>
      )}

      {err && (
        <div className="errore-campo">
          {err.details ? Object.values(err.details).flat().join(". ") : err.message}
        </div>
      )}

      <div className="riga" style={{ marginTop: 10 }}>
        <button className="primario piccolo" disabled={!pronto || salva.isPending}
                onClick={() => salva.mutate()}>
          {salva.isPending ? "Salvataggio…" : correzione ? "Salva la correzione" : "Aggiungi"}
        </button>
        <button className="piccolo" onClick={onAnnulla}>Annulla</button>
      </div>
    </div>
  );
}
