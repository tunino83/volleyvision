import { Navigate, Route, Routes, NavLink, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "./auth/AuthContext";
import { API } from "./api/client";
import Login from "./pagine/Login";
import Registrazione from "./pagine/Registrazione";
import Home from "./pagine/Home";
import Squadre from "./pagine/Squadre";
import SquadraDettaglio from "./pagine/SquadraDettaglio";
import Campionati from "./pagine/Campionati";
import Partite from "./pagine/Partite";
import PartitaNuova from "./pagine/PartitaNuova";
import PartitaDettaglio from "./pagine/PartitaDettaglio";
import Persone from "./pagine/Persone";
import Statistiche from "./pagine/Statistiche";
import Amministrazione from "./pagine/Amministrazione";
import Profilo from "./pagine/Profilo";
import Stagione from "./pagine/Stagione";
import PersonaScheda from "./pagine/PersonaScheda";
import { PasswordDimenticata, ReimpostaPassword, VerificaEmail } from "./pagine/Accesso";
import * as I from "./componenti/Icone";
import { InterruttoreTema } from "./componenti/Tema";
import { StrisciaSenzaRete, PulsanteEsci, PopupInstallazione } from "./componenti/Installazione";
import { Avvisi } from "./componenti/Avvisi";
import { Sincronizzazione, RiconoscimentoInstallazione } from "./locale/Sincronizzazione";

export default function App() {
  const { utente, caricamento } = useAuth();
  if (caricamento) {
    return (
      <div className="vuoto">
        <I.Pallone d={40} className="palla-vuoto" />
        Caricamento…
      </div>
    );
  }
  if (!utente) {
    return (
      <Routes>
            <Route path="/registrazione" element={<Registrazione />} />
            {/* Si raggiungono dal collegamento nell'email: devono funzionare
                senza sessione, altrimenti chi ha perso la password resta fuori. */}
            <Route path="/verifica-email" element={<VerificaEmail />} />
            <Route path="/password/dimenticata" element={<PasswordDimenticata />} />
            <Route path="/password/reset" element={<ReimpostaPassword />} />
            <Route path="*" element={<Login />} />
      </Routes>
    );
  }
  return (
    <>
      <div className="guscio">
        <ColonnaNavigazione />
        <main className="area">
          <BarraAlta />
          <StrisciaSenzaRete />
          <div className="contenitore">
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/squadre" element={<Squadre />} />
              <Route path="/squadre/:id" element={<SquadraDettaglio />} />
              <Route path="/campionati" element={<Campionati />} />
              <Route path="/partite" element={<Partite />} />
              <Route path="/partite/nuova" element={<PartitaNuova />} />
              <Route path="/partite/:id" element={<PartitaDettaglio />} />
              <Route path="/persone" element={<Persone />} />
              <Route path="/persone/:id" element={<PersonaScheda />} />
              <Route path="/statistiche" element={<Stagione />} />
              <Route path="/profilo" element={<Profilo />} />
              <Route path="/verifica-email" element={<VerificaEmail />} />
              <Route path="/partite/:id/statistiche" element={<Statistiche />} />
              {(utente.ruolo === "admin" || utente.ruolo === "segreteria") &&
                <Route path="/admin" element={<Amministrazione />} />}
                  <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </div>
        </main>
      </div>
      <BarraBassa />
      {/* Si mostra da sola al momento giusto, e non piu di una volta. */}
      <PopupInstallazione />
      {/* Nessuno dei tre disegna qualcosa: lavorano e parlano tramite `Avvisi`. */}
      <Sincronizzazione attiva />
      <RiconoscimentoInstallazione attiva />
      <Avvisi />
    </>
  );
}

/**
 * Le voci di navigazione, dichiarate una volta sola: le usano sia la barra in
 * alto sia quella in basso su telefono. Duplicarle significherebbe che prima o
 * poi le due divergono.
 */
/** La classe della voce corrente. Una sola definizione per le tre barre. */
const attivo = ({ isActive }: { isActive: boolean }) => isActive ? "attivo" : "";

const VOCI = [
  { a: "/", testo: "Home", Icona: I.Pallone, esatto: true },
  { a: "/partite", testo: "Partite", Icona: I.Calendario },
  { a: "/squadre", testo: "Squadre", Icona: I.Maglia },
  { a: "/campionati", testo: "Campionati", Icona: I.Trofeo },
  { a: "/persone", testo: "Persone", Icona: I.Persona },
  { a: "/statistiche", testo: "Statistiche", Icona: I.Statistiche },
];

/**
 * La colonna di navigazione. Resta ferma mentre il contenuto scorre: e cosi
 * che sono fatti gli strumenti con cui si guarda uno sport, non con una barra
 * che occupa la fascia alta dove invece deve stare il campo.
 *
 * Sotto i 1000 px si stringe alle sole icone; sotto i 760 sparisce e le voci
 * scendono in fondo, dove arriva il pollice.
 */
function ColonnaNavigazione() {
  const { utente, esci } = useAuth();
  const amministra = utente!.ruolo === "admin" || utente!.ruolo === "segreteria";

  return (
    <aside className="barra-laterale">
      <NavLink to="/" aria-label="Volley Vision"><I.Marchio /></NavLink>

      <nav className="nav">
        {VOCI.map(({ a, testo, Icona, esatto }) => (
          <NavLink key={a} to={a} end={esatto} className={attivo} title={testo}>
            <Icona d={19} /><span>{testo}</span>
          </NavLink>
        ))}
        {amministra && (
          <NavLink to="/admin" className={attivo} title="Amministrazione">
            <I.Ingranaggio d={19} /><span>Amministrazione</span>
          </NavLink>
        )}
      </nav>

      <div className="coda">
        <NavLink to="/profilo" className={attivo} title="Il tuo profilo">
          <I.Persona d={19} /><span>{utente!.nome} {utente!.cognome}</span>
        </NavLink>
        <div className="riga" style={{ paddingLeft: 12, gap: 4 }}>
          <InterruttoreTema />
          <PulsanteEsci esci={esci} />
        </div>
      </div>
    </aside>
  );
}

/** Solo su telefono: marchio e notifiche. Le voci stanno in fondo. */
function BarraAlta() {
  const nav = useNavigate();
  const { esci } = useAuth();
  const { data: notif } = useQuery({
    queryKey: ["notifiche"],
    queryFn: () => API.get<{ count: number }>("/notifications/available"),
    refetchInterval: 5 * 60 * 1000,
  });

  return (
    <header className="barra-alta">
      <NavLink to="/" aria-label="Volley Vision"><I.Marchio d={22} /></NavLink>
      <div className="spazio" />
      {!!notif?.count && (
        <button className="piccolo" onClick={() => nav("/partite?stato=READY")}
                title="Partite pronte">
          <I.Campanella d={15} /><span className="badge">{notif.count}</span>
        </button>
      )}
      {/*
        * Il profilo sta qui perche su telefono la colonna laterale non c'e,
        * e la barra in basso porta le sezioni del lavoro — squadre, partite,
        * statistiche — non le cose che riguardano la propria utenza.
        * Senza questo, dal telefono al profilo non si arrivava affatto.
        */}
      <NavLink to="/profilo"
               className={({ isActive }) => `icona-solo ${isActive ? "attivo" : ""}`}
               title="Il tuo profilo" aria-label="Il tuo profilo">
        <I.Persona d={18} />
      </NavLink>
      <InterruttoreTema />
      <PulsanteEsci esci={esci} />
    </header>
  );
}

function BarraBassa() {
  return (
    <nav className="nav-basso">
      {VOCI.map(({ a, testo, Icona, esatto }) => (
        <NavLink key={a} to={a} end={esatto} className={attivo}>
          <Icona d={20} />{testo}
        </NavLink>
      ))}
    </nav>
  );
}

