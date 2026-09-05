import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { API } from "../api/client";
import { Carta, Pagine, Pillola, Squadre as Duo, Stato, data, gb } from "../componenti/Ui";
import { Calendario, Condivisa, Pallone, Video } from "../componenti/Icone";
import RegistraPartita from "../componenti/RegistraPartita";

interface Pagina { elementi: any[]; totale: number; pagina: number; perPagina: number; pagines?: number; pagine: number }

/**
 * Elenco partite.
 *
 * Non e una tabella. Una partita e un **incontro**, e le sette colonne di un
 * foglio elettronico la raccontano peggio di una riga da tabellone: le due
 * squadre affiancate, il punteggio in mezzo, lo stato a destra. La stessa
 * disposizione regge su schermo largo e su telefono, per andare a capo invece
 * di cambiare impianto.
 *
 * I filtri vivono nell'indirizzo: ricaricabili e condivisibili.
 */
export default function Partite() {
  const nav = useNavigate();
  const [par, setPar] = useSearchParams();
  const stato = par.get("stato") ?? "";
  const q = par.get("q") ?? "";
  const pagina = Number(par.get("pagina")) || 1;
  const perPagina = par.get("perPagina") ?? "";

  const partite = useQuery({
    queryKey: ["partite", stato, q, pagina, perPagina],
    queryFn: () => API.get<Pagina>(`/matches?${new URLSearchParams(
      Object.fromEntries(Object.entries({ stato, q, perPagina, pagina: String(pagina) })
        .filter(([k, v]) => v && !(k === "pagina" && v === "1"))))}`),
  });
  const elementi = partite.data?.elementi ?? [];
  const camp = useQuery({ queryKey: ["campionati"], queryFn: () => API.get<any[]>("/competitions") });

  const imposta = (k: string, v: string) => {
    const p = new URLSearchParams(par);
    v ? p.set(k, v) : p.delete(k);
    // Cambiando un filtro si torna alla prima pagina: restare alla settima dopo
    // aver ristretto la ricerca mostrerebbe una schermata vuota senza motivo.
    if (k !== "pagina") p.delete("pagina");
    setPar(p);
  };

  return (
    <>
      <div className="riga-sp">
        <h1>Partite</h1>
        {/*
          * Due comandi, perche sono due gesti diversi e non due strade per lo
          * stesso. "Nuova partita" apre un modulo: lo si compila a tavolino.
          * "Registra" apre la fotocamera: lo si fa in palestra, mentre la
          * partita comincia. Chi arriva al campo non deve passare da un
          * modulo per accendere la telecamera.
          */}
        <div className="riga">
          <RegistraPartita modo="pulsante" />
          <button className="primario" onClick={() => nav("/partite/nuova")}>
            <Pallone d={16} /> Nuova partita
          </button>
        </div>
      </div>

      {/* Fuori dalla riga dei comandi: qui ci finiscono l'avviso per chi non
          ha l'applicazione e le registrazioni ancora da collegare. */}
      <RegistraPartita modo="pannello" />

      <div className="riga" style={{ margin: "0 0 20px" }}>
        <input placeholder="Cerca squadra…" value={q} style={{ maxWidth: 240 }}
               onChange={(e) => imposta("q", e.target.value)} />
        <select value={stato} style={{ maxWidth: 200 }} onChange={(e) => imposta("stato", e.target.value)}>
          <option value="">Tutti gli stati</option>
          <option value="WAITING">In attesa video</option>
          <option value="PENDING">In coda</option>
          <option value="RUNNING">Analisi in corso</option>
          <option value="READY">Pronte</option>
          <option value="ERROR">In errore</option>
        </select>
        <span className="piccolo muto">{camp.data?.length ?? 0} campionati visibili</span>
      </div>

      <Stato caricamento={partite.isLoading} errore={partite.error} vuoto={elementi.length === 0}
             messaggioVuoto="Nessuna partita con questi filtri.">
        <div className="colonna">
          {elementi.map((m: any) => <Riga key={m.id} m={m} onApri={() => nav(`/partite/${m.id}`)} />)}
        </div>

        <Pagine pagina={partite.data?.pagina ?? 1} pagine={partite.data?.pagine ?? 1}
                totale={partite.data?.totale ?? 0}
                onVai={(p) => imposta("pagina", String(p))} />
      </Stato>
    </>
  );
}

function Riga({ m, onApri }: { m: any; onApri: () => void }) {
  const peso = m.video.reduce((t: number, v: any) => t + (v.dimensione ?? 0), 0);

  return (
    <Carta onClick={onApri} className="partita-riga">
      <div className="partita-quando">
        <Calendario d={14} />
        <span className="numerico">{data(m.data)}</span>
      </div>

      <Duo casa={m.home.nome} ospite={m.away.nome}
                   squadraCasa={m.home} squadraOspite={m.away} />

      <div className="partita-coda">
        <span className="piccolo muto">{m.competition.nome}</span>

        {/* Le condivisioni sono in sola lettura: chi la vede deve saperlo
            guardando l'elenco, non scoprirlo quando prova a modificarla e
            si sente rispondere di no. */}
        {m.proprietario === false && (
          <span className="pillola condivisa"
                title={m.condivisaDa
                  ? `Condivisa da ${m.condivisaDa} · puoi consultarla, non modificarla`
                  : "Condivisa con te · puoi consultarla, non modificarla"}>
            <Condivisa d={11} />
            {m.condivisaDa ? `di ${m.condivisaDa}` : "condivisa"}
          </span>
        )}
        <span className="riga" style={{ gap: 6 }} title="Stato dei due video">
          <Video d={14} className="muto" />
          {m.video.map((v: any) => (
            <span key={v.lato} className={`spia ${v.stato === "ASSENTE" ? "assente"
                                          : v.stato === "IN_CARICAMENTO" ? "corso" : "presente"}`}
                  title={`Lato ${v.lato}: ${v.stato.toLowerCase().replace("_", " ")}`} />
          ))}
          {peso > 0 && <span className="piccolo muto numerico">{gb(peso)}</span>}
        </span>
        <Pillola stato={m.stato} />
      </div>

      {m.tag.length > 0 && (
        <div className="partita-tag">
          {m.tag.map((t: string) => <span key={t} className="etichetta-tag">{t}</span>)}
        </div>
      )}
    </Carta>
  );
}
