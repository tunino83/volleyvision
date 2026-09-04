import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { API, type ApiError } from "../api/client";
import { Campo, Carta } from "../componenti/Ui";
import { useAuth } from "../auth/AuthContext";
import { InvitoInstallazione, ScaricaAndroid } from "../componenti/Installazione";
import { SchedaLocale } from "../locale/SchedaLocale";
import { piattaforma } from "../platform";

/**
 * Il proprio profilo: chi sono, come entro, come cambio la password.
 *
 * L'elenco dei **modi di accesso** e qui perche e la schermata dove domani
 * comparira "Collega Google": quando ci sara, sara una riga in piu in questa
 * tabella, non una schermata nuova.
 */

const NOMI_PROVIDER: Record<string, string> = {
  password: "Password",
  google: "Google",
  apple: "Apple",
  microsoft: "Microsoft",
};

export default function Profilo() {
  const { utente, ricarica } = useAuth();

  return (
    <>
      <h1>Il tuo profilo</h1>
      <div className="griglia-due">
        <Anagrafica onSalvato={ricarica} />
        <div className="colonna">
          <Password />
          <ModiDiAccesso onCambiato={ricarica} />
          {/* Sta qui e non in un banner: e una cosa che riguarda "come uso
              questa applicazione", non il lavoro in corso. */}
          <InvitoInstallazione />
          {/* Anche da computer: il collegamento lo si manda al proprio
              telefono, ed e da qui che si va a cercarlo. */}
          {!piattaforma.mobile && <ScaricaAndroid daComputer />}
          {/* L'altro lato della stessa domanda: cosa tiene questo dispositivo. */}
          <SchedaLocale />
        </div>
      </div>

      <p className="piccolo muto" style={{ marginTop: 16 }}>
        Ruolo: <strong>{utente!.ruolo}</strong>. I ruoli li assegna
        l'amministrazione, non si cambiano da qui.
      </p>
    </>
  );
}

function Anagrafica({ onSalvato }: { onSalvato: () => Promise<void> }) {
  const { utente } = useAuth();
  const [d, setD] = useState({ nome: utente!.nome, cognome: utente!.cognome });
  const [err, setErr] = useState<ApiError | null>(null);
  const [fatto, setFatto] = useState(false);

  const salva = useMutation({
    mutationFn: () => API.patch("/auth/me", { nome: d.nome.trim(), cognome: d.cognome.trim() }),
    onSuccess: async () => { setErr(null); setFatto(true); await onSalvato(); },
    onError: (e: any) => { setFatto(false); setErr(e); },
  });

  const cambiato = d.nome !== utente!.nome || d.cognome !== utente!.cognome;

  return (
    <Carta>
      <h2 style={{ marginTop: 0 }}>Dati personali</h2>
      <Campo etichetta="Nome" errore={err?.details?.nome}>
        <input value={d.nome} onChange={(e) => { setD({ ...d, nome: e.target.value }); setFatto(false); }} />
      </Campo>
      <Campo etichetta="Cognome" errore={err?.details?.cognome}>
        <input value={d.cognome} onChange={(e) => { setD({ ...d, cognome: e.target.value }); setFatto(false); }} />
      </Campo>
      <Campo etichetta="Email">
        <input value={utente!.email} disabled />
      </Campo>
      <p className="piccolo muto" style={{ marginTop: -6 }}>
        L'indirizzo identifica l'utenza: lo cambia l'amministrazione, perche
        cambiarlo significa cambiare come si accede.
      </p>

      {err && !err.details && <div className="avviso errore">{err.message}</div>}
      {fatto && <div className="avviso info piccolo">Dati aggiornati.</div>}

      <button className="primario" disabled={!cambiato || salva.isPending}
              onClick={() => salva.mutate()}>
        {salva.isPending ? "Salvataggio…" : "Salva"}
      </button>
    </Carta>
  );
}

function Password() {
  const [d, setD] = useState({ attuale: "", nuova: "", ripeti: "" });
  const [err, setErr] = useState<ApiError | null>(null);
  const [fatto, setFatto] = useState(false);

  const salva = useMutation({
    mutationFn: () => API.post("/auth/password/change", { attuale: d.attuale, nuova: d.nuova }),
    onSuccess: () => { setErr(null); setFatto(true); setD({ attuale: "", nuova: "", ripeti: "" }); },
    onError: (e: any) => { setFatto(false); setErr(e); },
  });

  const corta = d.nuova.length > 0 && d.nuova.length < 10;
  const diverse = d.ripeti.length > 0 && d.nuova !== d.ripeti;
  const pronto = d.attuale && d.nuova.length >= 10 && d.nuova === d.ripeti;

  return (
    <Carta>
      <h2 style={{ marginTop: 0 }}>Cambia la password</h2>
      <Campo etichetta="Password attuale" errore={err?.details?.attuale}>
        <input type="password" value={d.attuale}
               onChange={(e) => { setD({ ...d, attuale: e.target.value }); setErr(null); setFatto(false); }} />
      </Campo>
      <Campo etichetta="Nuova password" errore={corta ? ["Almeno 10 caratteri"] : undefined}>
        <input type="password" value={d.nuova}
               onChange={(e) => setD({ ...d, nuova: e.target.value })} />
      </Campo>
      <Campo etichetta="Ripeti la nuova" errore={diverse ? ["Le due password non coincidono"] : undefined}>
        <input type="password" value={d.ripeti}
               onChange={(e) => setD({ ...d, ripeti: e.target.value })} />
      </Campo>

      {err && !err.details && <div className="avviso errore">{err.message}</div>}
      {fatto && <div className="avviso info piccolo">Password cambiata.</div>}

      <button className="primario" disabled={!pronto || salva.isPending}
              onClick={() => salva.mutate()}>
        {salva.isPending ? "Salvataggio…" : "Cambia la password"}
      </button>
    </Carta>
  );
}

function ModiDiAccesso({ onCambiato }: { onCambiato: () => Promise<void> }) {
  const { utente } = useAuth();
  const [err, setErr] = useState<ApiError | null>(null);
  const identita = utente!.identita ?? [];

  const scollega = useMutation({
    mutationFn: (id: string) => API.del(`/auth/identita/${id}`),
    onSuccess: async () => { setErr(null); await onCambiato(); },
    onError: (e: any) => setErr(e),
  });

  return (
    <Carta>
      <h2 style={{ marginTop: 0 }}>Come accedi</h2>
      <div className="tabella-scorrevole">
        <table>
          <tbody>
            {identita.map((i) => (
              <tr key={i.id}>
                <td className="grassetto">{NOMI_PROVIDER[i.provider] ?? i.provider}</td>
                <td className="piccolo muto">
                  {i.ultimoUsoIl
                    ? `ultimo uso ${new Date(i.ultimoUsoIl).toLocaleDateString("it-IT")}`
                    : "mai usato"}
                </td>
                <td style={{ width: 90, textAlign: "right" }}>
                  {identita.length > 1 && (
                    <button className="piccolo" disabled={scollega.isPending}
                            onClick={() => scollega.mutate(i.id)}>scollega</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {err && <div className="avviso errore piccolo">{err.message}</div>}

      <p className="piccolo muto" style={{ marginBottom: 0 }}>
        L'accesso con Google e con altri provider non e ancora attivo. Quando lo
        sara, comparira qui: si collega al profilo che stai usando, non crea una
        seconda utenza.
      </p>
    </Carta>
  );
}
