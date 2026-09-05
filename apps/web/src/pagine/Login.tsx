import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { Campo } from "../componenti/Ui";
import { Pallone } from "../componenti/Icone";
import { ScaricaAndroid } from "../componenti/Installazione";
import { inAppNativa } from "../platform/installazione";
import { piattaforma } from "../platform";

export default function Login() {
  const { accedi } = useAuth();
  const [email, setEmail] = useState("utente@volleyvision.test");
  const [password, setPassword] = useState("password123");
  const [errore, setErrore] = useState<string | null>(null);
  const [inCorso, setInCorso] = useState(false);

  const invia = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrore(null); setInCorso(true);
    try { await accedi(email, password); }
    catch (err: any) { setErrore(err.message ?? "Accesso non riuscito"); }
    finally { setInCorso(false); }
  };

  return (
    <div className="contenitore ingresso" style={{ maxWidth: 420, paddingTop: 72 }}>
      {/* Il pallone grande: e la prima cosa che si vede, e deve dire subito
          di che sport si parla. */}
      <Pallone d={56} className="ingresso-palla" />
      <h1>Volley Vision</h1>
      <p className="muto">Accedi per continuare.</p>
      <form onSubmit={invia} className="carta" style={{ marginTop: 20 }}>
        <Campo etichetta="Email">
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
        </Campo>
        <Campo etichetta="Password">
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </Campo>
        {errore && <div className="avviso errore">{errore}</div>}
        <button className="primario" disabled={inCorso} style={{ width: "100%", justifyContent: "center" }}>
          {inCorso ? "Accesso…" : "Accedi"}
        </button>
        <p className="piccolo muto" style={{ marginBottom: 0, marginTop: 14 }}>
          <Link to="/password/dimenticata">Password dimenticata?</Link>
        </p>
        <p className="piccolo muto" style={{ marginBottom: 0, marginTop: 6 }}>
          Non hai un account? <Link to="/registrazione">Registrati</Link>
        </p>
      </form>
      <p className="piccolo muto">
        Dati di esempio: utente@volleyvision.test / admin@volleyvision.test — password123
      </p>

      {/*
        * Il collegamento all'applicazione Android **prima** dell'accesso.
        *
        * Nel profilo c'era gia, ma il profilo sta dietro l'accesso: chi apre
        * il sito dal telefono per la prima volta compilava il modulo dentro
        * il browser senza sapere che esiste l'applicazione. E il momento in
        * cui l'informazione serve.
        *
        * Non dentro l'app nativa, dove sarebbe l'offerta di scaricare se
        * stessa.
        */}
      {!inAppNativa() && <ScaricaAndroid daComputer={!piattaforma.mobile} chiuso />}
    </div>
  );
}
