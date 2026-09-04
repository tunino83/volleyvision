import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { API, type ApiError } from "../api/client";
import { piattaforma, SOSPESO } from "../platform";
import { nativoPresente } from "../platform/nativo";
import CaricamentoNativo from "./CaricamentoNativo";
import { Carta, gb } from "./Ui";

const LIMITE_GB = 5;

/**
 * Caricamento dei video, da qualunque shell. Il secondo lato e
 * facoltativo: con una ripresa sola l'analisi parte lo stesso.
 *
 * Dove il trasferimento continua dipende dalla shell, e la schermata lo
 * dichiara invece di lasciarlo scoprire. Nell'applicazione Android va avanti
 * a schermo spento, affidato a un servizio (decisione 9b, rivista il
 * 2026-09-04). Nel browser vive quanto la scheda aperta — un browser non ha
 * un servizio a cui passare il lavoro — e alla riapertura si riprende dal
 * punto raggiunto invece di ricominciare.
 */

export default function Caricamento({ partita }: { partita: any }) {
  const aConsumo = piattaforma.rete.aConsumo();
  const cap = partita.capacita ?? {};

  /*
   * Con la partita gia mandata all'analisi non si carica piu nulla: i video
   * sono stati consumati. Mostrare il selettore di file sarebbe una promessa
   * che il server rifiuterebbe comunque.
   */
  if (cap.caricaVideo === false) {
    return (
      <>
        <h2>Video della partita</h2>
        <div className="avviso info">{cap.motivoBlocco}</div>
        <div className="griglia-due">
          {partita.video.map((v: any) => (
            <Carta key={v.lato}>
              <div className="riga-sp">
                <span className="grassetto">Lato {v.lato}</span>
                <span className="piccolo muto">{v.stato.toLowerCase().replace("_", " ")}</span>
              </div>
              <div className="piccolo muto" style={{ marginTop: 8 }}>
                {v.nomeFile ? `${v.nomeFile} · ${gb(v.dimensione)}` : "Nessun file"}
              </div>
            </Carta>
          ))}
        </div>
        <p className="piccolo muto">
          Il materiale video, una volta analizzato, non serve piu alla piattaforma:
          l'analisi vive nei dati.
        </p>
      </>
    );
  }

  return (
    <>
      <h2>Video della partita</h2>
      <div className="avviso info">
        Due video, ripresi dai due lati corti del campo. Limite indicativo di
        <strong> {LIMITE_GB} GB</strong> per video: sara confermato quando saranno
        noti i requisiti del fornitore dell'analisi.
      </div>

      {!piattaforma.trasferimentoInSecondoPiano && (
        <div className="avviso attenzione">
          Il caricamento avviene <strong>solo con l'applicazione aperta</strong>.
          Lo schermo resta acceso da solo finche dura. Se esci si ferma:
          riaprendo, riprende dal punto raggiunto senza ricominciare.
          {piattaforma.mobile && (
            <> Con l'<strong>applicazione per Android</strong> il caricamento
            prosegue anche a schermo spento.</>
          )}
        </div>
      )}

      {aConsumo === true && (
        <div className="avviso attenzione">
          Sei su <strong>rete dati</strong>. Un video puo pesare diversi gigabyte:
          conviene collegarsi a una rete Wi-Fi prima di cominciare.
        </div>
      )}

      {!partita.completezza.set1Completo && (
        <div className="avviso attenzione">
          Prima di caricare occorre la <strong>formazione del set 1</strong> per entrambe le squadre.
        </div>
      )}

      <div className="griglia-due">
        {partita.video.map((v: any) => (
          <Lato key={v.lato} video={v} partita={partita}
                bloccato={!partita.completezza.set1Completo} />
        ))}
      </div>

      <p className="piccolo muto" style={{ marginTop: "var(--sp3)" }}>
        Il <strong>lato 2 e facoltativo</strong>: con una sola ripresa l'analisi
        parte lo stesso. La seconda telecamera aggiunge le posizioni viste
        dall'altra estremita, dove la prima non arriva.
      </p>
    </>
  );
}

interface SessioneAperta {
  uploadId: string; nomeFile: string; mime: string;
  dimensione: number; bytesRicevuti: number; chunkBytes: number; scadeIl: string;
}

function Lato({ video, partita, bloccato }: { video: any; partita: any; bloccato: boolean }) {
  const qc = useQueryClient();
  const input = useRef<HTMLInputElement>(null);
  const [prog, setProg] = useState<{ inviati: number; totale: number } | null>(null);
  const [err, setErr] = useState<ApiError | null>(null);
  const [sospeso, setSospeso] = useState(false);
  const [fileErrato, setFileErrato] = useState<string | null>(null);
  const annulla = useRef<AbortController | null>(null);

  const presente = video.stato !== "ASSENTE";

  // Sessione lasciata a meta: e cio che permette di riprendere dopo aver
  // chiuso l'applicazione. Il file non si puo riaprire da soli — il browser
  // non conserva l'accesso — quindi lo ripropone l'utente e si verifica che
  // sia lo stesso.
  const aperta = useQuery({
    queryKey: ["sessione-caricamento", partita.id, video.lato],
    queryFn: () => API.get<SessioneAperta | null>(
      `/matches/${partita.id}/videos/${video.lato}/upload-session`),
    enabled: !presente || video.stato === "IN_CARICAMENTO",
  });
  const ripresa = aperta.data && aperta.data.bytesRicevuti > 0 ? aperta.data : null;

  // Se l'applicazione esce dal primo piano mentre si carica, sul mobile il
  // trasferimento si ferma. Meglio dirlo subito che lasciare una barra ferma.
  useEffect(() => {
    if (piattaforma.trasferimentoInSecondoPiano) return;
    const f = () => { if (document.visibilityState === "hidden") annulla.current?.abort(); };
    document.addEventListener("visibilitychange", f);
    return () => document.removeEventListener("visibilitychange", f);
  }, []);

  const avvia = async (file: File) => {
    // Ripresa: dev'essere lo stesso file, altrimenti i byte gia sul server
    // apparterrebbero a un video e la coda a un altro.
    if (ripresa && (file.name !== ripresa.nomeFile || file.size !== ripresa.dimensione)) {
      setFileErrato(`Atteso "${ripresa.nomeFile}" (${gb(ripresa.dimensione)}). `
                    + "Scegli lo stesso file, oppure annulla il caricamento e ricomincia.");
      return;
    }
    setErr(null); setSospeso(false); setFileErrato(null);
    annulla.current = new AbortController();
    try {
      await piattaforma.trasferimento.invia(file, {
        apriSessione: () => API.post(`/matches/${partita.id}/videos/${video.lato}/upload-session`, {
          nomeFile: file.name, dimensione: file.size, mime: file.type || "video/mp4" }),
        onProgresso: (inviati, totale) => setProg({ inviati, totale }),
        segnale: annulla.current.signal,
      });
      setProg(null);
      qc.invalidateQueries({ queryKey: ["partita", partita.id] });
      qc.invalidateQueries({ queryKey: ["sessione-caricamento", partita.id, video.lato] });
    } catch (e: any) {
      setProg(null);
      qc.invalidateQueries({ queryKey: ["sessione-caricamento", partita.id, video.lato] });
      if (e?.code === SOSPESO) { setSospeso(true); return; }
      if (e?.name !== "AbortError") setErr(e);
      else setSospeso(true);
    }
  };

  const scarta = async () => {
    if (!aperta.data) return;
    await API.del(`/uploads/${aperta.data.uploadId}`);
    setProg(null); setErr(null); setSospeso(false); setFileErrato(null);
    qc.invalidateQueries({ queryKey: ["partita", partita.id] });
    qc.invalidateQueries({ queryKey: ["sessione-caricamento", partita.id, video.lato] });
  };

  const pct = prog ? Math.round((prog.inviati / prog.totale) * 100) : 0;
  const pctRipresa = ripresa ? Math.round((ripresa.bytesRicevuti / ripresa.dimensione) * 100) : 0;
  const completo = video.stato === "CARICATO" || video.stato === "NORMALIZZATO";

  return (
    <Carta>
      <div className="riga-sp">
        <span className="grassetto">
          Lato {video.lato}
          {/* Detto qui e non solo in fondo: e la scheda che si guarda mentre
              si decide se caricare, e scoprirlo dopo non serve a niente. */}
          {video.lato === 2 && <span className="piccolo muto"> · facoltativo</span>}
        </span>
        <span className="piccolo muto">{video.stato.toLowerCase().replace("_", " ")}</span>
      </div>

      {completo && !prog && (
        <div className="piccolo muto" style={{ marginTop: 8 }}>
          {video.nomeFile} · {gb(video.dimensione)}
        </div>
      )}

      {prog && (
        <div style={{ marginTop: 10 }}>
          <div className="barra"><div style={{ width: `${pct}%`, background: "var(--primary)" }} /></div>
          <div className="riga-sp piccolo muto" style={{ marginTop: 6 }}>
            <span>{gb(prog.inviati)} di {gb(prog.totale)} · {pct}%</span>
            <button onClick={() => annulla.current?.abort()}>Sospendi</button>
          </div>
          <p className="piccolo muto" style={{ marginBottom: 0 }}>
            {piattaforma.trasferimentoInSecondoPiano
              ? "Il trasferimento riprende dal punto raggiunto se si interrompe."
              : "Tieni l'applicazione aperta. Se esci, riprende da qui alla riapertura."}
          </p>
        </div>
      )}

      {sospeso && !prog && (
        <div className="avviso info piccolo" style={{ marginTop: 10 }}>
          Trasferimento sospeso. Riprendi scegliendo di nuovo lo stesso file.
        </div>
      )}

      {err && (
        <div className="avviso errore" style={{ marginTop: 10 }}>
          {err.message}
          {err.correlationId && <div className="piccolo">Codice: {err.correlationId}</div>}
        </div>
      )}

      {fileErrato && <div className="avviso errore piccolo" style={{ marginTop: 10 }}>{fileErrato}</div>}

      {/*
        * Nell'applicazione Android i comandi sono altri, e non e una
        * variante estetica: il `File` del browser non sopravvive all'uscita
        * dall'applicazione, che e il momento in cui il servizio ne avrebbe
        * bisogno. Li si sceglie un indirizzo di contenuto, e il caricamento
        * lo porta avanti un servizio. Vedi `CaricamentoNativo`.
        */}
      {!completo && nativoPresente() && (
        <CaricamentoNativo partita={partita} video={video} bloccato={bloccato} />
      )}

      {!completo && !prog && !nativoPresente() && (
        <div style={{ marginTop: 10 }}>
          {ripresa && (
            <div className="avviso info piccolo">
              Caricamento interrotto al <strong>{pctRipresa}%</strong> di{" "}
              {ripresa.nomeFile} ({gb(ripresa.dimensione)}). Scegli lo stesso file
              per riprendere: i {gb(ripresa.bytesRicevuti)} gia trasferiti non si
              rifanno.
            </div>
          )}
          <input ref={input} type="file" accept="video/*" style={{ display: "none" }}
                 onChange={(e) => e.target.files?.[0] && avvia(e.target.files[0])} />
          <div className="riga">
            <button className="primario" disabled={bloccato} onClick={() => input.current?.click()}>
              {ripresa ? "Riprendi: scegli lo stesso file" : "Scegli il file"}
            </button>
            {aperta.data && <button onClick={scarta}>Annulla il caricamento</button>}
          </div>
          {bloccato && <div className="piccolo muto" style={{ marginTop: 6 }}>
            Completa prima la formazione del set 1.
          </div>}
        </div>
      )}
    </Carta>
  );
}
