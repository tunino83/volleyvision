import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { API, type ApiError } from "../api/client";
import { Campo, Carta } from "../componenti/Ui";

/**
 * Le schermate del ciclo di accesso che non richiedono una sessione:
 * verifica dell'indirizzo, password dimenticata, scelta della password.
 *
 * Stanno insieme perche condividono la stessa cornice e lo stesso principio:
 * **non rivelano mai se un indirizzo esiste**. Chi chiede il reimposto di una
 * password riceve sempre la stessa risposta, che l'account ci sia o no.
 */

function Cornice({ titolo, children }: { titolo: string; children: React.ReactNode }) {
  return (
    <div className="contenitore" style={{ maxWidth: 460, marginTop: 60 }}>
      <h1 style={{ marginBottom: 4 }}>Volley Vision</h1>
      <p className="muto" style={{ marginTop: 0 }}>{titolo}</p>
      <Carta>{children}</Carta>
      <p className="piccolo" style={{ marginTop: 16 }}>
        <Link to="/login">Torna all'accesso</Link>
      </p>
    </div>
  );
}

/** Arrivo dal collegamento nell'email di verifica. */
export function VerificaEmail() {
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";

  const q = useQuery({
    queryKey: ["verifica-email", token],
    queryFn: () => API.post<{ ok: boolean; gia?: boolean }>("/auth/verify-email", { token }),
    enabled: !!token,
    retry: false,
  });

  return (
    <Cornice titolo="Verifica dell'indirizzo">
      {!token && <div className="avviso errore">Collegamento incompleto: manca il codice.</div>}
      {q.isLoading && <p className="muto">Verifica in corso…</p>}
      {q.isError && (
        <div className="avviso errore">
          {(q.error as unknown as ApiError)?.message ?? "Collegamento non valido."}
          <p className="piccolo" style={{ marginBottom: 0 }}>
            Se il collegamento e scaduto, accedi e richiedine uno nuovo.
          </p>
        </div>
      )}
      {q.data && (
        <>
          <div className="avviso info">
            {q.data.gia
              ? "Questo indirizzo era gia stato verificato."
              : "Indirizzo verificato. Ora puoi accedere."}
          </div>
          <Link to="/login"><button className="primario">Vai all'accesso</button></Link>
        </>
      )}
    </Cornice>
  );
}

/** Richiesta del collegamento per reimpostare la password. */
export function PasswordDimenticata() {
  const [email, setEmail] = useState("");
  const inviata = useMutation({
    mutationFn: () => API.post("/auth/password/forgot", { email: email.trim() }),
  });

  return (
    <Cornice titolo="Password dimenticata">
      {inviata.isSuccess ? (
        <div className="avviso info" style={{ margin: 0 }}>
          Se esiste un account con quell'indirizzo, hai ricevuto un messaggio con
          il collegamento per scegliere una nuova password. Vale <strong>60 minuti</strong>.
        </div>
      ) : (
        <>
          <p className="piccolo muto" style={{ marginTop: 0 }}>
            Indica il tuo indirizzo: ti mandiamo un collegamento per sceglierne una nuova.
          </p>
          <Campo etichetta="Email">
            <input type="email" value={email} autoFocus
                   onChange={(e) => setEmail(e.target.value)}
                   onKeyDown={(e) => { if (e.key === "Enter" && email.trim()) inviata.mutate(); }} />
          </Campo>
          <button className="primario" disabled={!email.trim() || inviata.isPending}
                  onClick={() => inviata.mutate()}>
            {inviata.isPending ? "Invio…" : "Mandami il collegamento"}
          </button>
        </>
      )}
    </Cornice>
  );
}

/**
 * Scelta della password: sia dopo "password dimenticata", sia alla prima
 * apertura di un'utenza creata dall'amministratore. E lo stesso modulo perche
 * e la stessa cosa — scegliere una password che non si aveva.
 */
export function ReimpostaPassword() {
  const [params] = useSearchParams();
  const nav = useNavigate();
  const token = params.get("token") ?? "";
  const [pwd, setPwd] = useState("");
  const [ripeti, setRipeti] = useState("");
  const [err, setErr] = useState<ApiError | null>(null);

  const salva = useMutation({
    mutationFn: () => API.post("/auth/password/reset", { token, password: pwd }),
    onSuccess: () => setTimeout(() => nav("/login"), 1800),
    onError: (e: any) => setErr(e),
  });

  const corta = pwd.length > 0 && pwd.length < 10;
  const diverse = ripeti.length > 0 && pwd !== ripeti;
  const pronto = pwd.length >= 10 && pwd === ripeti;

  return (
    <Cornice titolo="Scegli la password">
      {!token && <div className="avviso errore">Collegamento incompleto: manca il codice.</div>}

      {salva.isSuccess ? (
        <div className="avviso info" style={{ margin: 0 }}>
          Password impostata. Ti riportiamo all'accesso…
        </div>
      ) : (
        <>
          <Campo etichetta="Nuova password" errore={corta ? ["Almeno 10 caratteri"] : undefined}>
            <input type="password" value={pwd} autoFocus
                   onChange={(e) => { setPwd(e.target.value); setErr(null); }} />
          </Campo>
          <Campo etichetta="Ripeti la password" errore={diverse ? ["Le due password non coincidono"] : undefined}>
            <input type="password" value={ripeti}
                   onChange={(e) => setRipeti(e.target.value)}
                   onKeyDown={(e) => { if (e.key === "Enter" && pronto) salva.mutate(); }} />
          </Campo>

          {err && <div className="avviso errore">{err.message}</div>}

          <p className="piccolo muto">
            Impostando la password, le sessioni aperte altrove vengono chiuse.
          </p>
          <button className="primario" disabled={!pronto || !token || salva.isPending}
                  onClick={() => salva.mutate()}>
            {salva.isPending ? "Salvataggio…" : "Imposta la password"}
          </button>
        </>
      )}
    </Cornice>
  );
}
