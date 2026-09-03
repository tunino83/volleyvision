/**
 * SERVICE WORKER — il guscio che rende l'applicazione installabile e usabile
 * senza rete.
 *
 * E cio che sostituisce Electron: un'applicazione installata sul computer,
 * con la sua icona e la sua finestra, che si apre anche senza connessione.
 * Senza installatori, senza firma del codice, senza notarizzazione Apple e
 * senza un aggiornatore automatico da scrivere. Vedi `docs/15-installazione-e-offline.md`.
 *
 * DUE DEPOSITI, DUE REGOLE DIVERSE — perche il contenuto e diverso:
 *
 *   guscio  I file dell'applicazione (pagina, stili, codice). Cambiano solo
 *           quando pubblichiamo. Regola: **prima la rete, poi il deposito**.
 *           Non il contrario: `cache-first` sul guscio significa consegnare
 *           per giorni una versione vecchia a chi ha la rete.
 *
 *   dati    Le risposte GET dell'API. Regola: **prima la rete, e se manca si
 *           consegna la copia** marcandola come tale. E cio che il documento
 *           14 chiama "si scarica cio che si apre, e resta disponibile senza
 *           rete", ottenuto senza scrivere un livello di sincronizzazione.
 *
 * I file con nome versionato (`/assets/nome-a1b2c3.js`) sono l'eccezione:
 * il loro nome cambia a ogni pubblicazione, quindi la copia non puo essere
 * vecchia e si consegna subito.
 *
 * COSA NON FA, deliberatamente:
 *  - non conserva risposte che non siano GET: creare una partita senza rete
 *    non e previsto (documento 14, "offline si legge, non si scrive")
 *  - non conserva i video: sono gigabyte, e stanno sul disco dell'utente
 *  - non lavora in secondo piano: nessun `sync`, nessuna notifica push
 */

const VERSIONE = "v1";
const GUSCIO = `vv-guscio-${VERSIONE}`;
const DATI = `vv-dati-${VERSIONE}`;

/* Il minimo perche l'applicazione si apra senza rete. Il resto del codice
   arriva dai file versionati, che si depositano da soli al primo uso. */
const ESSENZIALI = ["/", "/manifest.webmanifest", "/icona-192.png", "/icona-512.png"];

self.addEventListener("install", (e) => {
  // `addAll` fallisce tutto se un file solo non c'e: in sviluppo capita.
  // Meglio installarsi comunque che restare fuori gioco.
  e.waitUntil(
    caches.open(GUSCIO)
      .then((c) => Promise.allSettled(ESSENZIALI.map((u) => c.add(u))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil((async () => {
    // Via i depositi di una VERSIONE precedente del guscio. Attenzione: questo
    // scatta solo quando cambia `VERSIONE` qui sopra, non a ogni pubblicazione
    // — i nomi dei depositi sono costanti. La ripulitura dei file di una
    // pubblicazione vecchia la fa `pota`, piu sotto.
    const nomi = await caches.keys();
    await Promise.all(nomi
      .filter((n) => n.startsWith("vv-") && n !== GUSCIO && n !== DATI)
      .map((n) => caches.delete(n)));
    await self.clients.claim();
  })());
});

/**
 * All'uscita l'applicazione chiede di dimenticare i dati.
 *
 * Necessario, non cosmetico: le risposte dell'API riguardano **quell'utente**.
 * Su un computer condiviso, la copia di una partita non deve sopravvivere
 * all'utente che l'ha aperta.
 */
self.addEventListener("message", (e) => {
  if (e.data?.tipo === "dimentica-dati") {
    e.waitUntil(caches.delete(DATI).then(() => e.source?.postMessage({ tipo: "dati-dimenticati" })));
  }

  /* POTATURA — la ripulitura che serve davvero.
   *
   * I file dell'applicazione hanno il nome versionato (`index-a1b2c3.js`):
   * a ogni pubblicazione ne nascono di nuovi, e i vecchi resterebbero nel
   * deposito **per sempre**, perche nessuno sa piu che esistono. Dopo venti
   * pubblicazioni sono venti copie dell'applicazione sul disco dell'utente.
   *
   * Solo la pagina sa quali file servono adesso: li ha appena caricati. Li
   * manda qui, e tutto il resto sotto `/assets/` se ne va.
   *
   * Si potrebbe pensare di farlo in `activate`, ma quello scatta solo quando
   * cambia il service worker — che nella maggior parte delle pubblicazioni
   * non cambia affatto. */
  if (e.data?.tipo === "pota" && Array.isArray(e.data.risorse)) {
    const vive = new Set(e.data.risorse);
    e.waitUntil((async () => {
      const c = await caches.open(GUSCIO);
      const dentro = await c.keys();
      await Promise.all(dentro.map((req) => {
        const u = new URL(req.url);
        if (u.origin !== self.location.origin) return null;
        if (!u.pathname.startsWith("/assets/")) return null;   // la pagina e le icone restano
        return vive.has(u.pathname) ? null : c.delete(req);
      }));
    })());
  }
});

const versionato = (url) => /\/assets\/.+-[A-Za-z0-9_-]{8,}\.(js|css|woff2?)$/.test(url.pathname);

self.addEventListener("fetch", (e) => {
  const { request } = e;
  if (request.method !== "GET") return;               // le scritture non si toccano

  const url = new URL(request.url);

  /* L'API si riconosce dal percorso, NON dall'origine: in sviluppo sta su
     un'altra porta (`:3001`), in esercizio dietro lo stesso dominio. Se si
     filtrasse per origine, in sviluppo la regola dei dati non scatterebbe mai
     e la copia di sicurezza non esisterebbe. */
  const dellApi = url.pathname.startsWith("/api/");
  if (!dellApi && url.origin !== self.location.origin) return;  // i caratteri restano a Google

  /* 1. La navigazione: l'utente apre l'applicazione.
        Prima la rete — cosi chi e connesso vede sempre l'ultima versione —
        e se manca si consegna la pagina depositata. E il momento in cui
        l'applicazione installata si apre senza connessione. */
  if (request.mode === "navigate") {
    e.respondWith((async () => {
      try {
        const r = await fetch(request);
        (await caches.open(GUSCIO)).put("/", r.clone());
        return r;
      } catch {
        return (await caches.match("/")) ?? Response.error();
      }
    })());
    return;
  }

  /* 2. I file versionati: il nome contiene l'impronta del contenuto, quindi
        la copia depositata NON puo essere obsoleta. Si consegna subito. */
  if (versionato(url)) {
    e.respondWith((async () => {
      const copia = await caches.match(request);
      if (copia) return copia;
      const r = await fetch(request);
      if (r.ok) (await caches.open(GUSCIO)).put(request, r.clone());
      return r;
    })());
    return;
  }

  /* 3. L'API: prima la rete, la copia solo come rete di sicurezza.
        La copia consegnata porta `X-Da-Deposito`, e l'applicazione lo legge
        per dire all'utente che sta guardando dati non aggiornati invece di
        farglieli scambiare per correnti. */
  if (dellApi) {
    e.respondWith((async () => {
      try {
        const r = await fetch(request);
        if (r.ok) (await caches.open(DATI)).put(request, r.clone());
        return r;
      } catch {
        const copia = await caches.match(request);
        if (!copia) throw new Error("senza rete e senza copia");
        const testa = new Headers(copia.headers);
        testa.set("X-Da-Deposito", "1");
        return new Response(await copia.blob(), {
          status: copia.status, statusText: copia.statusText, headers: testa });
      }
    })());
    return;
  }

  /* 4. Tutto il resto (icone, immagini): la copia se c'e, altrimenti la rete. */
  e.respondWith(
    caches.match(request).then((c) => c ?? fetch(request).then(async (r) => {
      if (r.ok) (await caches.open(GUSCIO)).put(request, r.clone());
      return r;
    })),
  );
});
