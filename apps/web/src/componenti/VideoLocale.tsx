import { useEffect, useRef, useState } from "react";
import { OverlayCampo } from "./OverlayCampo";
import { useQuery } from "@tanstack/react-query";
import { API } from "../api/client";
import { Carta, Stato } from "./Ui";
import { Video as IcoVideo } from "./Icone";

/**
 * RIPRODUZIONE DEL VIDEO LOCALE, NEL BROWSER.
 *
 * Il file **non viene caricato da nessuna parte**: l'utente lo indica, il
 * browser ne ricava un indirizzo temporaneo (`URL.createObjectURL`) e lo legge
 * dal disco. Nessun byte esce dalla macchina, nessuno spazio di archiviazione,
 * nessuna banda. E l'esatto contrario del caricamento per l'analisi.
 *
 * Perche conta: la decisione "niente video nel browser" nasceva dal costo dello
 * **streaming** — servire gigabyte a ogni riproduzione. Qui non si serve nulla.
 * Il vincolo era sul trasporto, non sulla riproduzione.
 *
 * IL PUNTO DA VERIFICARE SUI FILE VERI
 *
 * Il salto e `currentTime = frame / fps`. Con file a fotogrammi fissi la
 * precisione e buona, ma **quanto** dipende dalla distanza fra i fotogrammi
 * chiave del file, che decide il fornitore. `requestVideoFrameCallback` dice
 * quale fotogramma e stato davvero presentato: la schermata lo mostra, cosi
 * lo scarto si misura invece di supporlo.
 */

interface Evento {
  idx: number; set: number; skill: string; value: string | null;
  frame: number; jersey: number | null; team: "h" | "a";
}

const SKILL: Record<string, string> = {
  S: "Battuta", R: "Ricezione", E: "Alzata", A: "Attacco", D: "Difesa",
  B: "Muro", C: "Copertura", F: "Free ball", "0": "Palla a terra", X: "Altro",
};

export default function VideoLocale({ partita }: { partita: any }) {
  const [file, setFile] = useState<File | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [errore, setErrore] = useState<string | null>(null);
  const [presentato, setPresentato] = useState<{ chiesto: number; ottenuto: number } | null>(null);
  /*
   * Due viste distinte, e la predefinita e il campo.
   *
   * Le posizioni sono coordinate su un piano: dall'alto si leggono senza
   * passare per nessuna trasformazione. I segni sull'immagine attraversano
   * l'omografia, e ogni sua imprecisione diventa uno scarto visibile — utili
   * come conferma, non come riferimento.
   */
  const [campo2d, setCampo2d] = useState(true);
  const [segni, setSegni] = useState(false);
  const [lato, setLato] = useState<1 | 2>(1);
  const video = useRef<HTMLVideoElement>(null);
  const scelta = useRef<HTMLInputElement>(null);

  // Il pacchetto porta gli fps: senza, il fotogramma non si converte in tempo.
  const pkg = useQuery({
    queryKey: ["pacchetto", partita.id],
    queryFn: () => API.get<any>(`/matches/${partita.id}/analysis`),
    enabled: partita.stato === "READY",
  });
  const fps: number | null = pkg.data?.video?.fps ?? null;
  // Le due matrici arrivano col pacchetto: senza, l'overlay non esiste.
  const omografia = pkg.data?.video?.homography ?? null;
  const posizioni: boolean = !!pkg.data?.qualita?.posizioniDisponibili;

  // L'indirizzo temporaneo va revocato: altrimenti il file resta agganciato
  // in memoria finche la scheda e aperta.
  useEffect(() => () => { if (url) URL.revokeObjectURL(url); }, [url]);

  const apri = (f: File) => {
    setErrore(null);
    const v = document.createElement("video");
    if (!v.canPlayType(f.type || "video/mp4")) {
      setErrore(`Il browser non sa decodificare questo formato (${f.type || "sconosciuto"}). `
                + "Serve un file che sappia leggere: H.264 in MP4 va sempre bene.");
      return;
    }
    if (url) URL.revokeObjectURL(url);
    setFile(f);
    setUrl(URL.createObjectURL(f));
    setPresentato(null);
  };

  /**
   * Salta a un fotogramma e **verifica dove e arrivato davvero**.
   * Dichiarare lo scarto invece di nasconderlo e cio che permette di capire,
   * sui file veri, se la tolleranza e accettabile.
   */
  const vaiAlFotogramma = (frame: number, riproduci = false) => {
    const v = video.current;
    if (!v || !fps) return;
    const t = frame / fps;

    const rvfc = (v as any).requestVideoFrameCallback;
    if (typeof rvfc === "function") {
      rvfc.call(v, (_now: number, meta: any) => {
        setPresentato({ chiesto: frame, ottenuto: Math.round(meta.mediaTime * fps) });
      });
    } else {
      v.onseeked = () => setPresentato({ chiesto: frame, ottenuto: Math.round(v.currentTime * fps) });
    }
    v.currentTime = t;

    /*
     * Riprendere o fermarsi non e la stessa richiesta.
     *
     * Chi preme "un fotogramma avanti" sta **ispezionando**: far ripartire il
     * video gli porterebbe via il fotogramma che voleva guardare. Chi clicca
     * un'azione nell'elenco vuole **vederla**, e restare fermi sul primo
     * fotogramma lo costringerebbe a un secondo clic ogni volta.
     *
     * `play()` restituisce una promessa che puo essere respinta — il browser
     * blocca la riproduzione non richiesta dall'utente. Qui nasce sempre da un
     * clic, quindi passa; si intercetta comunque, perche una promessa
     * respinta e non gestita finisce nella console come errore.
     */
    if (riproduci) void v.play().catch(() => { /* riproduzione negata: resta fermo */ });
    else v.pause();
  };

  const passo = (n: number) => {
    const v = video.current;
    if (!v || !fps) return;
    vaiAlFotogramma(Math.max(0, Math.round(v.currentTime * fps) + n));
  };

  if (partita.stato !== "READY") {
    return (
      <div className="avviso info">
        Il video locale si guarda quando l'analisi c'e: e l'analisi a dire a quale
        fotogramma saltare. Questa partita non e ancora pronta.
      </div>
    );
  }

  return (
    <>
      <div className="riga-sp">
        <h2>Video locale</h2>
        {file && <span className="piccolo muto">{file.name}</span>}
      </div>

      <div className="avviso info">
        Il file <strong>resta sul tuo computer</strong>: non viene caricato, non
        passa da nessun server. Lo indichi, e il browser lo legge dal disco.
      </div>

      {!url ? (
        <Carta>
          <div className="vuoto" style={{ padding: "var(--sp5)" }}>
            <IcoVideo d={36} className="palla-vuoto" />
            <p>Indica il file del video di questa partita.</p>
            <input ref={scelta} type="file" accept="video/*" style={{ display: "none" }}
                   onChange={(e) => e.target.files?.[0] && apri(e.target.files[0])} />
            <button className="primario" onClick={() => scelta.current?.click()}>
              Scegli il video
            </button>
          </div>
          {errore && <div className="avviso errore">{errore}</div>}
        </Carta>
      ) : (
        /*
         * Banco di lavoro: video a sinistra, azioni a destra.
         *
         * Sotto il video l'elenco costringe a scorrere per scegliere e a
         * tornare su per guardare, perdendo il posto a ogni azione. Di fianco
         * si vedono insieme — ed e per questo che tutti i banchi di analisi
         * video sono fatti cosi.
         */
        <div className="banco">
          <div className="banco-video">
            <Carta>
              {/* La tela sta sopra il video, dentro lo stesso riquadro: e
                  quel riquadro a dare le coordinate ai segni. */}
              <div className="lettore-riquadro">
                <video ref={video} src={url} controls preload="auto" className="lettore" />
                {fps && posizioni && (
                  <OverlayCampo matchId={partita.id} video={video} fps={fps}
                                omografia={omografia} lato={lato}
                                segniSulVideo={segni && !!omografia} campo2d={campo2d}
                                nomeCasa={partita.home?.nome} nomeOspiti={partita.away?.nome} />
                )}
              </div>

              <div className="riga" style={{ marginTop: "var(--sp3)" }}>
                <button className="piccolo" onClick={() => passo(-1)}>‹ 1 fot.</button>
                <button className="piccolo" onClick={() => passo(1)}>1 fot. ›</button>
                <button className="piccolo" onClick={() => passo(-(fps ?? 30) * 5)}>‹ 5 s</button>
                <button className="piccolo" onClick={() => passo((fps ?? 30) * 5)}>5 s ›</button>
                <span className="spazio" />
                {posizioni && (
                  <>
                    <button className={`piccolo ${campo2d ? "attivo" : ""}`}
                            onClick={() => setCampo2d((v) => !v)}
                            title="Il campo visto dall'alto, in un riquadro">
                      Campo 2D
                    </button>
                    {omografia && (
                      <>
                        <button className={`piccolo ${segni ? "attivo" : ""}`}
                                onClick={() => setSegni((v) => !v)}
                                title="Cerchi sotto i giocatori, sopra l'immagine">
                          Segni sul video
                        </button>
                        {/* Le due riprese hanno matrici diverse: indicare
                            quella sbagliata sposta tutti i segni. Non e
                            indovinabile dal file, quindi lo dice l'utente. */}
                        {segni && (
                          <button className="piccolo"
                                  onClick={() => setLato((l) => (l === 1 ? 2 : 1))}
                                  title="Da quale telecamera e ripreso questo file">
                            Telecamera {lato}
                          </button>
                        )}
                      </>
                    )}
                  </>
                )}
                <button className="piccolo" onClick={() => { setFile(null); setUrl(null); }}>
                  Cambia file
                </button>
              </div>

              {posizioni && segni && (
                <p className="piccolo muto" style={{ marginTop: 4, marginBottom: 0 }}>
                  I segni sul video passano per la prospettiva: se sono sfasati
                  tutti insieme, prova l'altra telecamera. Il campo 2D non ne
                  risente — le posizioni le disegna cosi come sono.
                </p>
              )}

              {/* Lo scarto dichiarato: e il numero che dira se il salto al
                  fotogramma regge sui file veri del fornitore. */}
              {presentato && (
                <p className="piccolo muto" style={{ marginBottom: 0 }}>
                  Chiesto il fotogramma <span className="numerico">{presentato.chiesto}</span>,
                  presentato il <span className="numerico">{presentato.ottenuto}</span>
                  {presentato.chiesto === presentato.ottenuto
                    ? " — esatto."
                    : ` — scarto di ${Math.abs(presentato.ottenuto - presentato.chiesto)} fotogrammi.`}
                </p>
              )}
              {!fps && (
                <p className="piccolo" style={{ color: "var(--attenzione)", marginBottom: 0 }}>
                  Gli fps non sono noti: senza, il fotogramma non si converte in tempo.
                </p>
              )}
            </Carta>
          </div>

          <Azioni partita={partita} onVai={vaiAlFotogramma} />
        </div>
      )}
    </>
  );
}

/**
 * La colonna delle azioni. Scorre per conto suo, cosi il video resta fermo:
 * se scorresse la pagina intera, ogni scelta rimanderebbe al punto di partenza.
 */
function Azioni({ partita, onVai }: {
  partita: any;
  /** `riproduci` distingue l'ispezione dal guardare: vedi `vaiAlFotogramma`. */
  onVai: (frame: number, riproduci?: boolean) => void;
}) {
  const [set, setSet] = useState(1);

  const q = useQuery({
    queryKey: ["scambi", partita.id, set],
    queryFn: () => API.get<any[]>(`/matches/${partita.id}/analysis/rallies?set=${set}`),
  });

  return (
    <aside className="banco-azioni">
      <div className="banco-azioni-testa">
        <span className="etichetta">Azioni</span>
        <div className="riga" style={{ gap: 4 }}>
          {[1, 2, 3, 4, 5].map((n) => (
            <button key={n} className={`piccolo ${set === n ? "primario" : ""}`}
                    onClick={() => setSet(n)}>{n}</button>
          ))}
        </div>
      </div>

      <div className="banco-azioni-elenco">
        <Stato caricamento={q.isLoading} errore={q.error} vuoto={q.data?.length === 0}
               messaggioVuoto="Nessuna azione in questo set.">
          {q.data?.map((a: any) => (
            <div key={a.idx} className="azione">
              <div className="azione-testa">
                <span className="numerico grassetto">{a.hPt}-{a.aPt}</span>
                <button className="piccolo" title={`Guarda l'azione dall'inizio (fotogramma ${a.frameStart})`}
                        onClick={() => onVai(a.frameStart, true)}>guarda</button>
              </div>
              <div className="azione-eventi">
                {(a.eventi as Evento[]).map((e) => (
                  <button key={e.idx} className={`tocco ${e.value ? "esito" : ""}`}
                          title={`${SKILL[e.skill] ?? e.skill}${e.value ? " · " + e.value : ""} — fotogramma ${e.frame}`}
                          onClick={() => onVai(e.frame, true)}>
                    <span className="tocco-skill">{e.skill}</span>
                    {e.jersey != null && <span className="tocco-maglia">{e.jersey}</span>}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </Stato>
      </div>
    </aside>
  );
}
