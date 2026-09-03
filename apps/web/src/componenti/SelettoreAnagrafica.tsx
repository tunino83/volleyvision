import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { API, type ApiError } from "../api/client";
import { Campo } from "./Ui";

/**
 * Scelta di una squadra o di un campionato, con creazione al volo.
 *
 * Non esistono anagrafiche comuni: ogni utente ha le proprie (decisione 9d).
 * Alla prima partita l'elenco e quindi vuoto per definizione, e mandare
 * l'utente su un'altra schermata per poi tornare qui gli farebbe perdere
 * quanto ha gia scritto. Si crea sul posto e si seleziona.
 */

interface Voce { id: string; nome: string; stagione?: string; proprietario?: boolean }

export function SelettoreAnagrafica({
  etichetta, risorsa, chiaveCache, voci, valore, escludi, errore, onCambia,
}: {
  etichetta: string;
  /** Percorso dell'API: `/teams` oppure `/competitions`. */
  risorsa: "/teams" | "/competitions";
  chiaveCache: string;
  voci: Voce[] | undefined;
  valore: string;
  /** Identificativo da non proporre: l'altra squadra della partita. */
  escludi?: string;
  errore?: string[];
  onCambia: (id: string) => void;
}) {
  const qc = useQueryClient();
  const [nuovo, setNuovo] = useState(false);
  const [nome, setNome] = useState("");
  const [stagione, setStagione] = useState(stagioneCorrente());
  const [err, setErr] = useState<ApiError | null>(null);

  const crea = useMutation({
    mutationFn: () => API.post<Voce>(risorsa, { nome: nome.trim(), stagione }),
    onSuccess: async (v) => {
      setNuovo(false); setNome(""); setErr(null);
      await qc.invalidateQueries({ queryKey: [chiaveCache] });
      onCambia(v.id);
    },
    onError: (e: any) => setErr(e),
  });

  const elenco = (voci ?? [])
    .filter((v) => v.proprietario !== false)
    .filter((v) => v.id !== escludi);

  if (nuovo) {
    return (
      <div className="campo">
        <label>{etichetta} — nuova</label>
        <div className="riga">
          <input value={nome} autoFocus placeholder="Nome" style={{ minWidth: 180 }}
                 onChange={(e) => setNome(e.target.value)}
                 onKeyDown={(e) => { if (e.key === "Enter" && nome.trim().length >= 2) crea.mutate(); }} />
          <input value={stagione} style={{ width: 110 }} placeholder="2026/2027"
                 onChange={(e) => setStagione(e.target.value)} />
          <button className="primario" disabled={nome.trim().length < 2 || crea.isPending}
                  onClick={() => crea.mutate()}>
            {crea.isPending ? "…" : "Crea"}
          </button>
          <button onClick={() => { setNuovo(false); setErr(null); }}>Annulla</button>
        </div>
        {err && (
          <div className="errore-campo">
            {err.details ? Object.values(err.details).flat().join(". ") : err.message}
          </div>
        )}
      </div>
    );
  }

  return (
    <Campo etichetta={etichetta} errore={errore}>
      <div className="riga">
        <select value={valore} onChange={(e) => {
          if (e.target.value === "__nuovo__") { setNuovo(true); return; }
          onCambia(e.target.value);
        }}>
          <option value="">— seleziona —</option>
          {elenco.map((v) => (
            <option key={v.id} value={v.id}>
              {v.nome}{v.stagione ? ` (${v.stagione})` : ""}
            </option>
          ))}
          <option value="__nuovo__">+ non e in elenco: creala…</option>
        </select>
      </div>
    </Campo>
  );
}

/** Stagione sportiva: da settembre in poi si guarda gia all'anno dopo. */
function stagioneCorrente() {
  const d = new Date();
  const a = d.getMonth() >= 7 ? d.getFullYear() : d.getFullYear() - 1;
  return `${a}/${a + 1}`;
}
