import { useState } from "react";
import { Link } from "react-router-dom";
import { API, type ApiError } from "../api/client";
import { Campo } from "../componenti/Ui";

export default function Registrazione() {
  const [d, setD] = useState({ nome: "", cognome: "", email: "", password: "", privacyAccettata: false });
  const [err, setErr] = useState<ApiError | null>(null);
  const [fatto, setFatto] = useState(false);

  const invia = async (e: React.FormEvent) => {
    e.preventDefault(); setErr(null);
    try { await API.post("/auth/register", d); setFatto(true); }
    catch (e: any) { setErr(e); }
  };

  if (fatto) return (
    <div className="contenitore" style={{ maxWidth: 460, paddingTop: 80 }}>
      <div className="carta">
        <h2 style={{ marginTop: 0 }}>Controlla la posta</h2>
        <p>Se l'indirizzo e valido riceverai un messaggio con il collegamento di verifica.</p>
        <p className="piccolo muto">In sviluppo il messaggio compare nel terminale dell'API.</p>
        <Link to="/">Torna all'accesso</Link>
      </div>
    </div>
  );

  return (
    <div className="contenitore" style={{ maxWidth: 460, paddingTop: 60 }}>
      <h1>Crea un account</h1>
      <form onSubmit={invia} className="carta" style={{ marginTop: 16 }}>
        <div className="riga">
          <Campo etichetta="Nome" errore={err?.details?.nome}>
            <input value={d.nome} onChange={(e) => setD({ ...d, nome: e.target.value })} required />
          </Campo>
          <Campo etichetta="Cognome" errore={err?.details?.cognome}>
            <input value={d.cognome} onChange={(e) => setD({ ...d, cognome: e.target.value })} required />
          </Campo>
        </div>
        <Campo etichetta="Email" errore={err?.details?.email}>
          <input type="email" value={d.email} onChange={(e) => setD({ ...d, email: e.target.value })} required />
        </Campo>
        <Campo etichetta="Password (almeno 10 caratteri)" errore={err?.details?.password}>
          <input type="password" value={d.password} onChange={(e) => setD({ ...d, password: e.target.value })} required />
        </Campo>
        <label className="riga piccolo" style={{ marginBottom: 12 }}>
          <input type="checkbox" style={{ width: "auto" }} checked={d.privacyAccettata}
                 onChange={(e) => setD({ ...d, privacyAccettata: e.target.checked })} />
          Accetto l'informativa sul trattamento dei dati
        </label>
        {err && !err.details && <div className="avviso errore">{err.message}</div>}
        <button className="primario" style={{ width: "100%", justifyContent: "center" }}>Crea account</button>
        <p className="piccolo muto" style={{ marginBottom: 0, marginTop: 14 }}>
          Hai gia un account? <Link to="/">Accedi</Link>
        </p>
      </form>
    </div>
  );
}
