import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { API } from "../api/client";
import { Carta, Pillola, Squadre as Duo, Stato, data } from "../componenti/Ui";
import { Righe } from "../componenti/Grafici";
import * as I from "../componenti/Icone";

/**
 * La prima schermata: cosa e successo e cosa c'e da fare.
 *
 * Non un indice di collegamenti — quelli stanno gia nella navigazione — ma
 * **i numeri della propria stagione**, le ultime partite e le squadre.
 *
 * Le statistiche vengono dalle partite gia analizzate, e l'insieme si
 * dichiara sempre: un numero senza sapere su quante partite e calcolato non
 * significa niente (regola del progetto, `docs/14`).
 */
export default function Home() {
  const nav = useNavigate();

  const partite = useQuery({
    queryKey: ["partite", "home"],
    queryFn: () => API.get<any>("/matches?perPagina=5"),
  });
  const squadre = useQuery({ queryKey: ["squadre"], queryFn: () => API.get<any[]>("/teams") });
  const stagione = useQuery({
    queryKey: ["stats", "stagione", "home"],
    queryFn: () => API.get<any>("/stats/players"),
  });

  const primoAccesso = !squadre.isLoading && (squadre.data?.length ?? 0) === 0;

  return (
    <>
      <div className="riga-sp">
        <div>
          <h1>Bentornato</h1>
          <p className="muto">Organizza la stagione e carica i video delle partite.</p>
        </div>
        <button className="primario" onClick={() => nav("/partite/nuova")}>Nuova partita</button>
      </div>

      {primoAccesso && (
        <Carta style={{ marginTop: 12 }}>
          <div className="grassetto">Per cominciare</div>
          <ol style={{ margin: "8px 0 0", paddingLeft: 18 }}>
            <li>Crea una <Link to="/squadre">squadra</Link> e inserisci il roster</li>
            <li>Crea un <Link to="/campionati">campionato</Link></li>
            <li>Crea una <Link to="/partite/nuova">partita</Link> e carica i video</li>
          </ol>
        </Carta>
      )}

      {!primoAccesso && <Sintesi stagione={stagione} />}

      <h2>Partite recenti</h2>
      <Stato caricamento={partite.isLoading} errore={partite.error}
             vuoto={partite.data?.elementi.length === 0} messaggioVuoto="Nessuna partita."
             azione={<button className="primario" onClick={() => nav("/partite/nuova")}>Crea la prima</button>}>
        <div className="colonna">
          {partite.data?.elementi.map((m: any) => (
            <Carta key={m.id} onClick={() => nav(`/partite/${m.id}`)}>
              <div className="riga-sp">
                <Duo casa={m.home.nome} ospite={m.away.nome} />
                <Pillola stato={m.stato} />
              </div>
              <div className="piccolo muto" style={{ marginTop: 4 }}>
                {m.competition.nome} · {data(m.data)}
              </div>
            </Carta>
          ))}
        </div>
      </Stato>

      <h2>Le tue squadre</h2>
      <Stato caricamento={squadre.isLoading} errore={squadre.error}
             vuoto={squadre.data?.length === 0} messaggioVuoto="Nessuna squadra."
             azione={<Link className="bottone" to="/squadre">Crea una squadra</Link>}>
        {/*
          * Righe e non riquadri.
          *
          * Una squadra non ha niente da mostrare che giustifichi un riquadro:
          * e un nome e due numeri. In griglia occupavano mezza schermata per
          * dire poco, e su telefono diventavano una colonna da scorrere.
          * In riga si leggono in fila, come un elenco — che e quello che sono.
          */}
        <Carta className="elenco-squadre">
          {squadre.data?.map((t) => (
            <button key={t.id} className="riga-squadra" onClick={() => nav(`/squadre/${t.id}`)}>
              <I.Maglia d={17} className="muto" />
              <span className="riga-squadra-nome">
                {t.nome}
                {!t.proprietario && <em className="piccolo muto"> · condivisa</em>}
              </span>
              <span className="piccolo muto">{t.stagione}</span>
              <span className="piccolo muto numerico riga-squadra-numeri">
                {t.giocatori} giocatori · {t.partite} partite
              </span>
            </button>
          ))}
        </Carta>
      </Stato>
    </>
  );
}

/**
 * I numeri della stagione, in cima.
 *
 * Solo cose che i dati contengono davvero. Un grafico "andamento per partita"
 * sarebbe la cosa piu naturale da mettere qui, ma l'elenco delle partite non
 * porta con se nessun valore per partita: sarebbe uscito vuoto.
 */
function Sintesi({ stagione }: { stagione: any }) {
  const d = stagione.data;
  const partiteConsiderate = d?.insieme?.partiteConsiderate ?? 0;

  if (stagione.isLoading) return null;
  if (!partiteConsiderate) {
    return (
      <Carta style={{ marginTop: 12 }}>
        <div className="piccolo muto">
          {/* Grafici a zero non dicono "non hai ancora dati": dicono
              "questa applicazione e vuota". */}
          Le statistiche compariranno qui quando la prima partita sara analizzata.
        </div>
      </Carta>
    );
  }

  const voci: any[] = d.voci ?? [];

  // I migliori per punti: e la prima domanda che ci si fa su una stagione.
  const migliori = voci.slice(0, 5)
    .map((v) => ({ etichetta: `${v.cognome}${v.nome ? ` ${v.nome[0]}.` : ""}`, valore: v.punti }));

  // Da dove arrivano i punti. Le tre voci sommate su tutte le persone
  // dell'insieme: attacco, muro, battuta.
  const somma = (k: string) => voci.reduce((s, v) => s + (v[k] ?? 0), 0);
  const origine = [
    { etichetta: "Attacco", valore: somma("attacchiPunto"), colore: "var(--ospite)" },
    { etichetta: "Muro", valore: somma("muriPunto"), colore: "var(--casa)" },
    { etichetta: "Ace", valore: somma("ace"), colore: "var(--palla)" },
  ];

  return (
    <div className="sintesi-home">
      <Carta>
        <span className="etichetta">Migliori realizzatori</span>
        {migliori.length
          ? <Righe voci={migliori} />
          : <p className="piccolo muto" style={{ margin: 0 }}>
              Nessun giocatore del roster e collegato a una persona: senza
              quel collegamento le statistiche di stagione non hanno righe.
            </p>}
      </Carta>

      <Carta>
        <span className="etichetta">Da dove arrivano i punti</span>
        <Righe voci={origine} />
        <div className="riga-sp" style={{ marginTop: 10, alignItems: "flex-end" }}>
          <p className="piccolo muto" style={{ margin: 0 }}>
            {/* L'insieme si dichiara sempre: e la regola del progetto. */}
            Su <b className="numerico">{partiteConsiderate}</b> partite analizzate
            {d.insieme.senzaAnalisi
              ? `, ${d.insieme.senzaAnalisi} non ancora analizzate sono escluse`
              : ""}.
            {d.limiti?.vociSenzaPersona
              ? ` ${d.limiti.vociSenzaPersona} righe senza persona collegata non sono contate.`
              : ""}
          </p>
          <Link className="piccolo" to="/statistiche">Tutte</Link>
        </div>
      </Carta>
    </div>
  );
}
