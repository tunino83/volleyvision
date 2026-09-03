import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { API } from "../api/client";
import { Carta, Pillola, Squadre as Duo, Stato, data } from "../componenti/Ui";
import { useAuth } from "../auth/AuthContext";

export default function Home() {
  const { utente } = useAuth();
  const nav = useNavigate();
  // La home mostra le ultime: chiede una pagina piccola, non tutto l'archivio.
  const partite = useQuery({
    queryKey: ["partite", "home"],
    queryFn: () => API.get<{ elementi: any[] }>("/matches?perPagina=5"),
  });
  const squadre = useQuery({ queryKey: ["squadre"], queryFn: () => API.get<any[]>("/teams") });

  const primoAccesso = !squadre.isLoading && (squadre.data?.length ?? 0) === 0;

  return (
    <>
      <div className="riga-sp">
        <div>
          <h1>Bentornato, {utente!.nome}</h1>
          <p className="muto">Organizza la stagione e carica i video delle partite.</p>
        </div>
        <button className="primario" onClick={() => nav("/partite/nuova")}>Nuova partita</button>
      </div>

      {primoAccesso && (
        <div className="avviso info">
          <div className="grassetto">Per iniziare, in tre passi</div>
          <ol style={{ margin: "8px 0 0 18px" }}>
            <li>Crea una <Link to="/squadre">squadra</Link> e inserisci il roster</li>
            <li>Crea un <Link to="/campionati">campionato</Link></li>
            <li>Crea una <Link to="/partite/nuova">partita</Link> e carica i video</li>
          </ol>
        </div>
      )}

      <h2>Partite recenti</h2>
      <Stato caricamento={partite.isLoading} errore={partite.error}
             vuoto={partite.data?.elementi.length === 0} messaggioVuoto="Nessuna partita."
             azione={<button className="primario" onClick={() => nav("/partite/nuova")}>Crea la prima</button>}>
        <div className="colonna">
          {partite.data?.elementi.map((m: any) => (
            <Carta key={m.id} onClick={() => nav(`/partite/${m.id}`)}>
              <div className="riga-sp">
                <div>
                  <Duo casa={m.home.nome} ospite={m.away.nome} />
                  <div className="piccolo muto">{m.competition.nome} · {data(m.data)}</div>
                </div>
                <Pillola stato={m.stato} />
              </div>
            </Carta>
          ))}
        </div>
      </Stato>

      <h2>Le tue squadre</h2>
      <Stato caricamento={squadre.isLoading} errore={squadre.error}
             vuoto={squadre.data?.length === 0} messaggioVuoto="Nessuna squadra."
             azione={<Link className="bottone" to="/squadre">Crea una squadra</Link>}>
        <div className="griglia">
          {squadre.data?.map((t) => (
            <Carta key={t.id} onClick={() => nav(`/squadre/${t.id}`)}>
              <div className="grassetto">{t.nome}</div>
              <div className="piccolo muto">{t.stagione}</div>
              <div className="piccolo muto" style={{ marginTop: 6 }}>
                {t.giocatori} giocatori · {t.partite} partite
                {!t.proprietario && " · condivisa"}
              </div>
            </Carta>
          ))}
        </div>
      </Stato>
    </>
  );
}
