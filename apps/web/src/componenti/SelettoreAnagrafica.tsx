import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { API, type ApiError } from "../api/client";
import { Campo } from "./Ui";
import { Stemma, type SquadraConStemma } from "./LogoSquadra";

/**
 * Scelta di una squadra o di un campionato, con creazione al volo.
 *
 * Non esistono anagrafiche comuni: ogni utente ha le proprie (decisione 9d).
 * Alla prima partita l'elenco e quindi vuoto per definizione, e mandare
 * l'utente su un'altra schermata per poi tornare qui gli farebbe perdere
 * quanto ha gia scritto. Si crea sul posto e si seleziona.
 */

interface Voce extends Partial<SquadraConStemma> {
  id: string; nome: string; stagione?: string; proprietario?: boolean;
}

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
  const [filtro, setFiltro] = useState("");
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

  /*
   * Pastiglie e non un menu a tendina.
   *
   * Una `select` su telefono apre un elenco a schermo intero che copre il
   * modulo: si sceglie alla cieca, senza piu vedere cosa si stava
   * compilando. E anche da computer nasconde le opzioni finche non la si
   * apre, mentre qui sono in genere poche — le proprie squadre, i propri
   * campionati — e stanno tutte sotto gli occhi.
   *
   * Sopra una certa quantita un campo di ricerca torna utile: si filtra
   * invece di scorrere. Sotto, sarebbe un comando in piu da ignorare.
   */
  const CON_RICERCA = 8;
  const cerca = filtro.trim().toLowerCase();
  const visibili = cerca
    ? elenco.filter((v) => `${v.nome} ${v.stagione ?? ""}`.toLowerCase().includes(cerca))
    : elenco;

  return (
    <Campo etichetta={etichetta} errore={errore}>
      {elenco.length > CON_RICERCA && (
        <input className="opzione-ricerca" value={filtro} placeholder="Cerca…"
               onChange={(e) => setFiltro(e.target.value)} />
      )}

      <div className="opzioni">
        {visibili.map((v) => (
          <button key={v.id} type="button"
                  className={`opzione ${valore === v.id ? "opzione-attiva" : ""}`}
                  aria-pressed={valore === v.id}
                  onClick={() => onCambia(valore === v.id ? "" : v.id)}>
            {/*
              * Lo stemma solo per le squadre, e lo decide il selettore
              * guardando `risorsa`: passarlo dall'esterno sarebbe una cosa
              * in piu da ricordare a ogni chiamata, e prima o poi qualcuno
              * se ne dimenticherebbe. I campionati non hanno stemma.
              */}
            {risorsa === "/teams" && <Stemma squadra={v as SquadraConStemma} d={20} />}
            <span className="opzione-nome">{v.nome}</span>
            {v.stagione && <span className="opzione-nota">{v.stagione}</span>}
          </button>
        ))}

        {/* Creare non e scegliere: si distingue anche a colpo d'occhio. */}
        <button type="button" className="opzione opzione-nuova" onClick={() => setNuovo(true)}>
          + Crea
        </button>
      </div>

      {cerca && !visibili.length && (
        <p className="piccolo muto" style={{ margin: "6px 0 0" }}>
          Nessuna corrispondenza. Puoi crearla con <b>+ Crea</b>.
        </p>
      )}
    </Campo>
  );
}

/** Stagione sportiva: da settembre in poi si guarda gia all'anno dopo. */
function stagioneCorrente() {
  const d = new Date();
  const a = d.getMonth() >= 7 ? d.getFullYear() : d.getFullYear() - 1;
  return `${a}/${a + 1}`;
}
