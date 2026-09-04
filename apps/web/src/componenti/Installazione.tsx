import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { piattaforma } from "../platform";
import { Carta } from "./Ui";
import * as I from "./Icone";

/**
 * Installare l'applicazione, e dire quando la rete non c'e.
 *
 * Due cose che l'utente deve poter capire senza spiegazioni: che questa cosa
 * puo stare sul suo computer come un programma, e che in questo momento sta
 * guardando dati che non si stanno aggiornando.
 */

const inst = piattaforma.installazione;

/** Stato di rete e di installazione, sempre allineato senza rileggerlo a mano. */
export function useInstallazione() {
  const stato = useSyncExternalStore(
    inst.osserva,
    // La chiave cambia solo quando cambia qualcosa: React non ridisegna a vuoto.
    () => `${inst.statoRete()}|${inst.installabile()}|${inst.giaInstallata()}`,
    () => "in-rete|false|false",        // sul server non c'e ne rete ne finestra
  );
  const [rete, installabile, giaInstallata] = stato.split("|");
  return {
    statoRete: rete as "in-rete" | "senza-rete" | "non-risponde",
    inRete: rete === "in-rete",
    installabile: installabile === "true",
    giaInstallata: giaInstallata === "true",
  };
}

/**
 * La striscia che compare quando la rete cade.
 *
 * Sta in alto e resta: senza rete **l'applicazione continua a funzionare in
 * lettura**, e questo va detto — altrimenti l'utente pensa che sia rotta.
 * Dice anche cosa non puo fare, perche e la domanda immediatamente successiva.
 */
export function StrisciaSenzaRete() {
  const { statoRete } = useInstallazione();
  if (statoRete === "in-rete") return null;

  // Due messaggi diversi perche sono due situazioni diverse, e l'utente puo
  // farci due cose diverse: nel primo caso aspetta, nel secondo puo sospettare
  // del Wi-Fi a cui e attaccato — che il browser giura funzionante.
  const senzaRete = statoRete === "senza-rete";
  return (
    <div className="striscia-senza-rete" role="status">
      <I.Nuvola d={16} />
      <b>{senzaRete ? "Sei senza rete." : "La connessione non risponde."}</b>
      <span>
        {senzaRete
          ? "Puoi consultare i dati che hai su questo dispositivo. Le modifiche riprendono quando torna la connessione."
          : "Risulti collegato, ma il server non risponde: stai vedendo dati che potrebbero non essere aggiornati."}
      </span>
    </div>
  );
}

/**
 * Le tre condizioni dell'uso installato.
 *
 * Vanno dette **prima** di installare, non scoperte dopo: riguardano
 * l'accesso e i dati dell'utente, e sono tutte e tre controintuitive per chi
 * si aspetta un programma normale. Sono scritte qui una volta sola perche
 * compaiono sia nell'invito sia nella scheda di chi ha gia installato — e
 * due copie divergerebbero.
 */
const CONDIZIONI = [
  {
    titolo: "L'accesso resta quello dell'ultimo ingresso dal web",
    testo: "Senza rete entri come l'ultimo utente che ha fatto accesso, e non "
         + "puoi cambiarlo. Dopo 30 giorni senza mai collegarsi, l'accesso va rifatto.",
  },
  {
    titolo: "Senza rete non c'e tutto",
    testo: "Squadre, campionati e persone ci sono sempre. Delle partite solo "
         + "quelle che hai scelto di tenere con te. E si consulta soltanto: "
         + "per modificare serve la connessione.",
  },
  {
    titolo: "I dati su questo dispositivo sono di un utente solo",
    testo: "Quando esci, o quando entra un altro utente, vengono cancellati e "
         + "riscaricati al primo accesso con rete. Non si accumulano per piu persone.",
  },
];

function Condizioni({ compatte = false }: { compatte?: boolean }) {
  return (
    <ul className={`condizioni${compatte ? " compatte" : ""}`}>
      {CONDIZIONI.map((c) => (
        <li key={c.titolo}>
          <b>{c.titolo}</b>
          {!compatte && <span>{c.testo}</span>}
        </li>
      ))}
    </ul>
  );
}

/**
 * L'invito a installare.
 *
 * Non compare da solo in mezzo al lavoro: sta nel profilo, dove si trovano le
 * cose che riguardano "come uso questa applicazione". Un banner a comparsa
 * verrebbe chiuso senza leggerlo.
 */
export function InvitoInstallazione() {
  const { installabile, giaInstallata } = useInstallazione();
  const [esito, setEsito] = useState<string | null>(null);
  const [persistente, setPersistente] = useState<boolean | null>(null);

  useEffect(() => { inst.chiediSpazioPersistente().then(setPersistente); }, []);

  const installa = useCallback(async () => {
    const r = await inst.installa();
    setEsito(r === "accettata" ? "Fatto: la trovi fra le tue applicazioni."
      : r === "rifiutata" ? "Nessun problema: puoi installarla quando vuoi."
      : null);
  }, []);

  // Su telefono si rimanda all'app vera invece di proporne una seconda.
  if (piattaforma.mobile && !giaInstallata) {
    return <ScaricaAndroid />;
  }

  if (giaInstallata) {
    return (
      <Carta className="nota-installazione">
        <h3><I.Pallone d={17} /> Applicazione installata</h3>
        <p className="piccolo muto">
          Stai usando Volley Vision come applicazione. Si apre anche senza
          connessione: vedrai le partite che hai gia aperto.
        </p>
        {persistente === false && (
          <p className="piccolo attenzione">
            Il sistema non garantisce i dati salvati: se lo spazio scarseggia
            potrebbe rimuoverli, e andranno riscaricati.
          </p>
        )}
        <Condizioni compatte />
      </Carta>
    );
  }

  return (
    <Carta className="nota-installazione">
      <h3><I.Pallone d={17} /> Installa Volley Vision</h3>
      <p className="piccolo muto">
        La metti sul computer come un programma: icona sua, finestra sua, e si
        apre anche senza connessione. Si aggiorna da sola, non ci sono
        installatori da scaricare.
      </p>
      <Condizioni />
      {installabile
        ? <button className="primario" onClick={installa}>Installa</button>
        // Safari non offre l'installazione a un pulsante: la voce esiste, ma
        // e nel menu del browser. Dirlo e meglio che nascondere la funzione.
        : <p className="piccolo muto">
            Il tuo browser non offre l'installazione da qui. Su Safari usa
            <b> Condividi › Aggiungi al Dock</b>; su Chrome o Edge l'icona di
            installazione nella barra degli indirizzi.
          </p>}
      {esito && <p className="piccolo">{esito}</p>}
    </Carta>
  );
}

/**
 * Il pulsante per uscire, con l'avvertimento quando non c'e rete.
 *
 * Senza rete uscire e una **porta a senso unico**: cancella i dati tenuti su
 * questo dispositivo, e rientrare richiede la connessione. Chi lo preme per
 * abitudine, alla fine di una sessione in trasferta, si chiuderebbe fuori.
 *
 * Nonostante questo il comando **resta disponibile**, e non va nascosto come
 * gli altri: uscire e proprio la via di fuga di chi ha usato l'applicazione
 * sul computer di qualcun altro. Toglierlo per proteggere i dati locali
 * proteggerebbe la cosa sbagliata.
 */
export function PulsanteEsci({ esci, d = 18 }: { esci: () => void; d?: number }) {
  const { inRete } = useInstallazione();
  const [chiede, setChiede] = useState(false);

  return (
    <>
      <button className="icona-solo" title="Esci" aria-label="Esci"
              onClick={() => (inRete ? esci() : setChiede(true))}>
        <I.Esci d={d} />
      </button>

      {chiede && (
        <div className="velo" role="dialog" aria-modal="true" aria-label="Confermi di uscire?"
             // Chiude solo il clic sul velo, non quello dentro la scheda:
             // `Carta` non espone l'evento, quindi si confronta il bersaglio.
             onClick={(e) => { if (e.target === e.currentTarget) setChiede(false); }}>
          <Carta className="finestrella">
            <h3><I.Nuvola d={17} /> Sei senza rete</h3>
            <p className="piccolo">
              Se esci adesso, i dati tenuti su questo dispositivo vengono
              cancellati e <b>non potrai rientrare finche non torni online</b>.
            </p>
            <div className="riga">
              <button className="primario" onClick={() => setChiede(false)}>Resta</button>
              <button onClick={() => { setChiede(false); esci(); }}>Esci comunque</button>
            </div>
          </Carta>
        </div>
      )}
    </>
  );
}

/* ============================================================
   L'INVITO GUIDATO
   ============================================================

   Un vincolo del browser che decide tutto il disegno: **`prompt()` si puo
   chiamare solo dentro un gesto dell'utente.** Non esiste il modo di far
   comparire da soli la finestra di installazione del browser — Chrome ed Edge
   la rifiutano se non nasce da un clic.

   Quindi il guidato si fa cosi, ed e l'unico modo che funziona:

     1. **noi** decidiamo quando mostrare la nostra finestra (qui c'e liberta)
     2. l'utente preme "Installa" — ed **e quel clic** a dare il permesso
     3. compare la finestra del browser, che conferma

   Due finestre di seguito, e non si puo evitare: la seconda e del browser e
   non e nostra. In cambio la prima e nostra per davvero, e puo spiegare le
   condizioni invece di limitarsi a un "Installa? Si/No". */

const APERTURE = "vv.installa.aperture";
const RIMANDATO = "vv.installa.rimandato";

/* Non alla prima apertura: chi arriva adesso non sa ancora cosa sia questa
   cosa, e installare un programma di cui non sai nulla e una richiesta che si
   rifiuta per riflesso. Alla terza l'utente ha capito se gli serve. */
const APERTURE_PRIMA_DI_CHIEDERE = 3;
const GIORNI_PRIMA_DI_RICHIEDERE = 30;

/** Si conta una volta per avvio, non a ogni disegno della schermata. */
let contata = false;
function contaApertura(): number {
  const n = Number(localStorage.getItem(APERTURE) ?? "0") + (contata ? 0 : 1);
  if (!contata) { contata = true; try { localStorage.setItem(APERTURE, String(n)); } catch { /* privata */ } }
  return n;
}

function rimandatoDaPoco(): boolean {
  const q = localStorage.getItem(RIMANDATO);
  if (!q) return false;
  return Date.now() - Number(q) < GIORNI_PRIMA_DI_RICHIEDERE * 86400000;
}

/**
 * La finestra che propone l'installazione, al momento giusto e una volta sola.
 *
 * Le condizioni sono **dentro** la finestra e non dietro un collegamento:
 * riguardano l'accesso e i dati, e chi sta per premere "Installa" e l'unica
 * persona che le leggera mai.
 */
export function PopupInstallazione() {
  const { installabile, giaInstallata, inRete } = useInstallazione();
  const [visibile, setVisibile] = useState(false);
  const [esito, setEsito] = useState<string | null>(null);

  useEffect(() => {
    if (giaInstallata || !installabile || !inRete) return;
    // **Su telefono e tablet no.** Li l'applicazione arriva dagli store, e
    // proporre di installare la versione web farebbe finire l'utente con due
    // cose che sembrano la stessa. L'installabile e per i computer.
    if (piattaforma.mobile) return;
    if (rimandatoDaPoco()) return;
    if (contaApertura() < APERTURE_PRIMA_DI_CHIEDERE) return;
    setVisibile(true);
  }, [installabile, giaInstallata, inRete]);

  if (!visibile) return null;

  const rimanda = () => {
    try { localStorage.setItem(RIMANDATO, String(Date.now())); } catch { /* privata */ }
    setVisibile(false);
  };

  return (
    <div className="velo" role="dialog" aria-modal="true" aria-labelledby="titolo-installa"
         onClick={(e) => { if (e.target === e.currentTarget) rimanda(); }}>
      <Carta className="finestrella finestrella-larga">
        <h3 id="titolo-installa"><I.Pallone d={18} /> Vuoi Volley Vision sul tuo computer?</h3>
        <p className="piccolo muto">
          La metti sul computer come un programma: icona sua, finestra sua, e si
          apre anche senza connessione. Si aggiorna da sola, non ci sono
          installatori da scaricare.
        </p>

        <Condizioni />

        {esito
          ? <p className="piccolo">{esito}</p>
          : (
            <div className="riga">
              <button className="primario" onClick={async () => {
                const r = await inst.installa();
                if (r === "accettata") { setVisibile(false); return; }
                // Rifiutata nella finestra del browser: non si insiste, e non
                // si richiede per un mese. Un secondo tentativo subito dopo un
                // no e la cosa che fa disinstallare le applicazioni.
                rimanda();
              }}>Installa</button>
              <button onClick={rimanda}>Non ora</button>
            </div>
          )}

        <p className="piccolo muto nota-finale">
          Puoi installarla quando vuoi da <b>Il tuo profilo</b>.
        </p>
      </Carta>
    </div>
  );
}


/*
 * Dove sta l'APK.
 *
 * Oggi fra i file statici del sito. **Non e la sistemazione definitiva**: e
 * un binario di sei megabyte che cambia a ogni versione, e versionarlo fa
 * crescere la cronologia per sempre. La casa giusta e una release su
 * GitHub, o lo store quando ci sara: e per questo che l'indirizzo e una
 * costante e non e scritto nel testo — cambiarlo sara una riga.
 */
const APK = "/scarica/volley-vision.apk";

/**
 * L'invito a scaricare l'applicazione Android.
 *
 * Si mostra a chi apre il sito da un telefono, dove installare la versione
 * web non ha senso: su Android l'applicazione e un'altra cosa. Ma anche da
 * computer serve, perche il collegamento lo si manda a se stessi — per
 * questo compare in entrambi i casi, con parole diverse.
 */
export function ScaricaAndroid({ daComputer = false }: { daComputer?: boolean }) {
  return (
    <Carta className="nota-installazione">
      <h3><I.Pallone d={17} /> Volley Vision per Android</h3>

      <p className="piccolo muto">
        {daComputer
          ? "Per il telefono c'e un'applicazione a se. Apri questo indirizzo dal telefono, oppure mandati il file."
          : "Su telefono Volley Vision e un'applicazione a se. Questa pagina funziona lo stesso, ma l'applicazione si apre dalla schermata Home e non dipende dal browser."}
      </p>

      <a className="bottone" href={APK} download>Scarica per Android</a>

      {/*
        * Detto prima e non dopo: Android mostra un avviso, e chi non se lo
        * aspetta pensa che il file sia guasto e lo butta.
        */}
      <p className="piccolo muto nota-finale">
        Android chiedera il permesso di installare da <b>origini sconosciute</b>:
        e normale per un'applicazione che non arriva dal Play Store. La versione
        firmata per lo store arrivera piu avanti.
      </p>
    </Carta>
  );
}