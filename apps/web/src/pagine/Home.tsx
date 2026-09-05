import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { API } from "../api/client";
import { Carta, Pillola, Squadre as Duo, Stato, data } from "../componenti/Ui";
import { Righe } from "../componenti/Grafici";
import { Stemma } from "../componenti/LogoSquadra";
import { Avatar } from "../componenti/Avatar";

/**
 * La prima schermata: cosa e successo e cosa c'e da fare.
 *
 * Non un indice di collegamenti — quelli stanno gia nella navigazione — ma
 * **i numeri della propria stagione**, le ultime partite, e le squadre e le
 * persone che si e scelto di tenere d'occhio.
 *
 * Le preferite, e non tutto: con dieci squadre e centinaia di persone una
 * home che le elenca tutte non e una sintesi, e un secondo elenco. Chi
 * guarda decide cosa gli interessa; finche non ha deciso, la schermata lo
 * chiede invece di indovinare.
 */
export default function Home() {
  const nav = useNavigate();

  const partite = useQuery({
    queryKey: ["partite", "home"],
    queryFn: () => API.get<any>("/matches?perPagina=4"),
  });
  const squadre = useQuery({ queryKey: ["squadre"], queryFn: () => API.get<any[]>("/teams") });
  const stagione = useQuery({
    queryKey: ["stats", "stagione", "home"],
    queryFn: () => API.get<any>("/stats/players"),
  });
  const persone = useQuery({
    queryKey: ["persone", "preferite"],
    queryFn: () => API.get<any[]>("/persons/preferite"),
  });

  const primoAccesso = !squadre.isLoading && (squadre.data?.length ?? 0) === 0;
  const preferite = (squadre.data ?? []).filter((t) => t.preferita);

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
        {/*
          * Due per riga, non tre.
          *
          * A tre colonne i nomi delle squadre andavano a capo su ogni scheda:
          * "Sarno Volley Club" occupava due righe e la scheda diventava un
          * francobollo. Lo spazio in piu non e ornamento — e la differenza
          * fra leggere un nome e decifrarlo.
          */}
        <div className="griglia-due">
          {partite.data?.elementi.map((m: any) => (
            <Carta key={m.id} onClick={() => nav(`/partite/${m.id}`)}>
              <div className="riga-sp">
                <Duo casa={m.home.nome} ospite={m.away.nome}
                     squadraCasa={m.home} squadraOspite={m.away} />
                <Pillola stato={m.stato} />
              </div>
              <div className="piccolo muto" style={{ marginTop: 4 }}>
                {m.competition.nome} · {data(m.data)}
              </div>
            </Carta>
          ))}
        </div>
      </Stato>

      {!primoAccesso && <SquadrePreferite squadre={squadre} preferite={preferite} />}
      {!primoAccesso && <PersonePreferite persone={persone} stagione={stagione} />}
    </>
  );
}

/** Le squadre che si e scelto di tenere d'occhio. */
function SquadrePreferite({ squadre, preferite }: { squadre: any; preferite: any[] }) {
  const nav = useNavigate();

  return (
    <>
      <h2>Le tue squadre</h2>
      <Stato caricamento={squadre.isLoading} errore={squadre.error}>
        {preferite.length === 0 ? (
          <Carta>
            <div className="piccolo muto">
              {/* Non uno stato vuoto ma un'istruzione: le squadre ci sono, e
                  quello che manca e una scelta che solo chi guarda puo fare. */}
              Nessuna squadra fra le preferite. Aprine una da{" "}
              <Link to="/squadre">Squadre</Link> e segnala con la stella: qui
              compariranno quelle, invece di tutte.
            </div>
          </Carta>
        ) : (
          <div className="griglia-due">
            {preferite.map((t) => (
              <Carta key={t.id} onClick={() => nav(`/squadre/${t.id}`)}>
                <div className="riga">
                  <Stemma squadra={t} d={34} />
                  <div style={{ minWidth: 0 }}>
                    <div className="grassetto">{t.nome}</div>
                    <div className="piccolo muto">
                      {t.stagione} · {t.giocatori} giocatori · {t.partite} partite
                      {!t.proprietario && " · condivisa"}
                    </div>
                  </div>
                </div>
              </Carta>
            ))}
          </div>
        )}
      </Stato>
    </>
  );
}

/**
 * Le persone preferite, coi loro numeri di stagione.
 *
 * I numeri arrivano da `/stats/players`, la stessa risposta che alimenta la
 * sintesi qui sopra: **non si ricalcolano**. Calcolarli una seconda volta in
 * un altro punto significherebbe, prima o poi, che la home dice un numero e
 * la scheda un altro — ed e il tipo di errore che nessuno segnala, perche
 * nessuno guarda due schermate insieme.
 */
function PersonePreferite({ persone, stagione }: { persone: any; stagione: any }) {
  const elenco: any[] = persone.data ?? [];
  // Nessuna preferita: nessuna sezione. Un riquadro che dice "non hai scelto
  // nessuno" e gia stato messo per le squadre, e ripeterlo trasformerebbe la
  // home in un elenco di cose non fatte.
  if (persone.isLoading || elenco.length === 0) return null;

  const per = new Map<string, any>(
    (stagione.data?.voci ?? []).map((v: any) => [v.personId, v]));

  return (
    <>
      <h2>Le persone che segui</h2>
      <div className="griglia-due">
        {elenco.map((p) => {
          const v = per.get(p.id);
          return (
            <Carta key={p.id}>
              <Link to={`/persone/${p.id}`} className="riga persona-preferita">
                <Avatar seme={p.avatarSeme || `${p.cognome} ${p.nome}`} stile={p.avatarStile}
                        opzioni={p.avatarOpzioni} personId={p.id} foto={p.foto} d={38} />
                <div style={{ minWidth: 0 }}>
                  <div className="grassetto">{p.cognome} {p.nome}</div>
                  <div className="piccolo muto">
                    {v ? `${v.partite} partite · ${v.squadre.join(", ")}`
                       : "nessuna partita analizzata"}
                  </div>
                </div>
              </Link>

              {v ? (
                <div className="numeri-persona">
                  <Numero valore={v.punti} etichetta="punti" />
                  <Numero valore={v.attacchiPunto} etichetta="in attacco" />
                  <Numero valore={v.muriPunto} etichetta="a muro" />
                  <Numero valore={v.ace} etichetta="ace" />
                  {/* L'efficienza puo essere negativa, ed e nulla se non ha
                      mai attaccato: `null` non e zero, e mostrarlo come zero
                      direbbe una cosa falsa. */}
                  <Numero valore={v.efficienzaAttacco} etichetta="eff. att." unita="%" />
                </div>
              ) : (
                <p className="piccolo muto" style={{ marginBottom: 0, marginTop: 8 }}>
                  I numeri compariranno quando una sua partita sara analizzata.
                </p>
              )}
            </Carta>
          );
        })}
      </div>
    </>
  );
}

function Numero({ valore, etichetta, unita = "" }: {
  valore: number | null | undefined; etichetta: string; unita?: string;
}) {
  return (
    <div className="numero-persona">
      <span className="numerico valore">{valore == null ? "—" : `${valore}${unita}`}</span>
      <span className="piccolo muto">{etichetta}</span>
    </div>
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
