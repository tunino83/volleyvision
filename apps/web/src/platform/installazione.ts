/**
 * INSTALLAZIONE E ASSENZA DI RETE
 *
 * La parte di piattaforma che nel piano originale avrebbe richiesto Electron:
 * mettere l'applicazione sul computer dell'utente e farla funzionare senza
 * connessione. Qui la fa il browser.
 *
 * Sta nel livello di piattaforma e non in un componente perche e esattamente
 * il tipo di cosa che cambia da contenitore a contenitore: dentro Electron o
 * Capacitor l'applicazione **e gia installata**, e questi metodi rispondono
 * di conseguenza invece di proporre un pulsante che non avrebbe senso.
 */

/** L'evento con cui il browser offre l'installazione. Non e ancora standard. */
interface EventoInstallazione extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

let invito: EventoInstallazione | null = null;
const ascoltatori = new Set<() => void>();
const avvisa = () => ascoltatori.forEach((f) => f());

/**
 * L'evento arriva **una volta sola e presto**, spesso prima che React sia
 * montato. Se non lo si trattiene qui, all'avvio del modulo, e perduto: da
 * quel momento il pulsante "Installa" non potrebbe piu comparire.
 */
if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();                 // niente banner di sistema: lo chiediamo noi, al momento giusto
    invito = e as EventoInstallazione;
    avvisa();
  });
  window.addEventListener("appinstalled", () => { invito = null; avvisa(); });
  window.addEventListener("online", avvisa);
  window.addEventListener("offline", avvisa);
}

/** Vero quando l'applicazione gira nella propria finestra, non in una scheda. */
export function giaInstallata(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(display-mode: standalone)").matches
    // Safari su iOS non implementa `display-mode` e usa una proprieta sua.
    || (navigator as any).standalone === true;
}

/**
 * Esiste un'installazione su questo dispositivo, anche se ora siamo in una
 * scheda del browser?
 *
 * Diverso da `giaInstallata()`, che dice se stiamo girando *dentro*
 * l'applicazione installata. Questa risponde alla domanda "l'ha gia messa sul
 * computer?" mentre si e nel browser, ed e il segnale con cui si decide se
 * portarsi dietro i dati: chi ha installato ha gia detto "questo e il mio
 * dispositivo".
 *
 * **Solo Chromium**, e solo se il manifesto la dichiara in
 * `related_applications` con l'indirizzo VERO dell'esercizio. Altrove — e con
 * il segnaposto ancora nel manifesto — risponde `null`, che vuol dire "non lo
 * so", non "no".
 */
export async function installazioneEsistente(): Promise<boolean | null> {
  const n = navigator as any;
  if (typeof n.getInstalledRelatedApps !== "function") return null;
  try {
    const app = await n.getInstalledRelatedApps();
    return Array.isArray(app) && app.length > 0;
  } catch { return null; }
}

/** Il browser ha offerto l'installazione? Safari non lo fa mai: si spiega a mano. */
export const installabile = () => invito !== null;

/** Apre la richiesta di installazione. Restituisce cosa ha scelto l'utente. */
export async function installa(): Promise<"accettata" | "rifiutata" | "non-disponibile"> {
  if (!invito) return "non-disponibile";
  await invito.prompt();
  const { outcome } = await invito.userChoice;
  // L'invito si consuma: il browser non lo ripropone nella stessa sessione.
  invito = null;
  avvisa();
  return outcome === "accepted" ? "accettata" : "rifiutata";
}

/**
 * LO STATO DELLA CONNESSIONE, IN TRE CASI.
 *
 * Due non bastano, e il terzo e il piu frequente di quanto sembri.
 *
 * `navigator.onLine` dice il vero quando e falso: nessuna interfaccia di
 * rete, non si va da nessuna parte. Ma quando e **vero** significa soltanto
 * "sei attaccato a una rete" — non che la rete funzioni. Wi-Fi d'albergo
 * dietro una pagina di accesso, hotspot senza credito, palestra col router
 * acceso e la linea giu: `onLine` risponde di si e le richieste falliscono.
 *
 * Percio lo stato non si legge da `onLine` soltanto: lo dice **l'esito vero
 * delle richieste**, che il client dell'API segnala qui.
 */
export type StatoRete = "in-rete" | "senza-rete" | "non-risponde";

/* Un fallimento isolato non e un guasto: capita, e si ritenta. Due di fila
   senza nessun successo in mezzo sono un'altra cosa. */
const FALLIMENTI_PER_DICHIARARE_GUASTO = 2;
let fallimenti = 0;

/** Il client dell'API lo chiama a ogni richiesta. Non lo chiami altri. */
export function segnalaEsito(riuscita: boolean) {
  const prima = statoRete();
  fallimenti = riuscita ? 0 : fallimenti + 1;
  if (statoRete() !== prima) avvisa();
}

export function statoRete(): StatoRete {
  if (typeof navigator !== "undefined" && !navigator.onLine) return "senza-rete";
  return fallimenti >= FALLIMENTI_PER_DICHIARARE_GUASTO ? "non-risponde" : "in-rete";
}

/** Vero solo quando si e davvero raggiungibili: e cio che conta per scaricare. */
export const inRete = () => statoRete() === "in-rete";

/** Per i componenti: si iscrive ai cambi di stato (rete, invito, installazione). */
export function osserva(f: () => void): () => void {
  ascoltatori.add(f);
  return () => ascoltatori.delete(f);
}

/**
 * Attiva il guscio senza rete.
 *
 * **Solo in esercizio.** In sviluppo un service worker consegnerebbe file
 * depositati al posto di quelli appena modificati, e si passerebbero
 * pomeriggi a cercare un errore che non c'e piu.
 */
/**
 * Vero dentro l'applicazione Android, falsa nel browser.
 *
 * Capacitor mette un oggetto sulla finestra: e il modo che il guscio ha di
 * farsi riconoscere senza che il codice dipenda dalla sua libreria.
 */
export const inAppNativa = () =>
  typeof window !== "undefined" && !!(window as any).Capacitor?.isNativePlatform?.();

export function registraGuscio(onNuovaVersione?: () => void) {
  if (!("serviceWorker" in navigator) || import.meta.env.DEV) return;

  /*
   * Dentro l'applicazione nativa il guscio non serve e fa danno.
   *
   * I file sono gia sul telefono, dentro il pacchetto installato: non c'e
   * niente da conservare per l'uso senza rete, quello e gia risolto. In piu
   * il guscio consegnerebbe file depositati al posto di quelli
   * dell'aggiornamento appena installato dallo store, e l'applicazione
   * resterebbe indietro senza che nessuno capisca perche.
   */
  if (inAppNativa()) return;

  /* Un guscio nuovo ha preso il posto del vecchio: significa che e stata
     pubblicata una versione diversa **mentre questa pagina era aperta**.
     Il codice che sta girando adesso e vecchio, e nessuno lo sostituisce
     finche non si ricarica: l'aggiornamento automatico avviene alla
     riapertura, non sotto i piedi dell'utente. Quindi glielo si dice. */
  let primoControllo = !navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    // Alla primissima visita il controllo passa da "nessuno" al guscio appena
    // installato: non e un aggiornamento, e l'installazione. Non si annuncia.
    if (primoControllo) { primoControllo = false; return; }
    onNuovaVersione?.();
  });

  window.addEventListener("load", () => {
    sorvegliaVersione(() => onNuovaVersione?.());
    navigator.serviceWorker.register("/sw.js").then(() => {
      // Si dice al guscio quali file servono adesso, cosi puo buttare quelli
      // delle pubblicazioni precedenti. Solo la pagina lo sa: li ha caricati.
      potaDeposito();
    }).catch((e) => {
      // Non e un errore fatale: senza guscio l'applicazione funziona, ma solo
      // con la rete. Va detto nel registro, non all'utente.
      console.warn("guscio non registrato:", e);
    });
  });
}

/**
 * Controlla se e uscita una versione nuova, quando l'utente torna sulla
 * finestra.
 *
 * Serve perche il segnale del guscio non basta: `controllerchange` scatta solo
 * quando cambia **`sw.js`**, e nella maggior parte delle pubblicazioni quel
 * file resta identico — cambiano solo i file dell'applicazione. Senza questo
 * controllo, chi tiene la finestra aperta per giorni non verrebbe avvisato di
 * niente.
 *
 * Non e un sondaggio a intervalli: si guarda quando l'utente **torna**, che e
 * il momento in cui potrebbe essere passato del tempo ed e anche il momento
 * in cui ricaricare gli costa meno.
 */
const ATTESA_FRA_CONTROLLI = 5 * 60 * 1000;
let ultimoControllo = 0;

function sorvegliaVersione(onNuovaVersione: () => void) {
  const miei = risorseDellaPagina().filter((p) => p.endsWith(".js"));
  if (!miei.length) return;               // niente con cui confrontare

  const controlla = async () => {
    if (document.visibilityState !== "visible" || !inRete()) return;
    if (Date.now() - ultimoControllo < ATTESA_FRA_CONTROLLI) return;
    ultimoControllo = Date.now();
    try {
      // `no-store`: si vuole la pagina del server, non quella del deposito —
      // e proprio la loro differenza la domanda a cui si risponde.
      const html = await fetch("/", { cache: "no-store" }).then((r) => r.text());
      const usciti = [...html.matchAll(/\/assets\/[A-Za-z0-9._-]+\.js/g)].map((m) => m[0]);
      if (usciti.length && !usciti.some((u) => miei.includes(u))) onNuovaVersione();
    } catch { /* senza rete non si sa, e non si inventa */ }
  };

  document.addEventListener("visibilitychange", controlla);
  window.addEventListener("focus", controlla);
}

/** I file che questa pagina sta usando: tutto il resto nel deposito e vecchio. */
function risorseDellaPagina(): string[] {
  return [...document.querySelectorAll<HTMLScriptElement>("script[src]")].map((e) => e.src)
    .concat([...document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"][href]')]
      .map((e) => e.href))
    .map((u) => { try { return new URL(u, location.href).pathname; } catch { return ""; } })
    .filter((p) => p.startsWith("/assets/"));
}

function potaDeposito() {
  // `controller` puo essere nullo alla primissima visita: alla prossima
  // apertura ci sara, e la potatura avverra allora. Non c'e fretta.
  navigator.serviceWorker.controller?.postMessage({
    tipo: "pota", risorse: risorseDellaPagina() });
}

/**
 * All'uscita: le risposte depositate riguardano l'utente che se ne va.
 * Su un computer condiviso non devono sopravvivergli.
 */
export function dimenticaDati() {
  navigator.serviceWorker?.controller?.postMessage({ tipo: "dimentica-dati" });
}

/**
 * Chiede al browser di **non buttare via** i dati depositati quando lo spazio
 * scarseggia.
 *
 * Senza questa richiesta il deposito e "best effort": il sistema puo
 * liberarlo quando vuole, e l'utente scoprirebbe in trasferta che la partita
 * scaricata non c'e piu. I browser la concedono a chi ha installato
 * l'applicazione o la usa spesso — su `localhost` di norma rispondono di no,
 * e non e un difetto.
 */
export async function chiediSpazioPersistente(): Promise<boolean | null> {
  if (!navigator.storage?.persist) return null;
  if (await navigator.storage.persisted?.()) return true;
  return navigator.storage.persist();
}
