/**
 * Audit responsive — da incollare nella console del browser.
 *
 * Non ha dipendenze e gira sull'applicazione vera con i dati veri: e cio che
 * serve adesso. La versione automatica (Playwright, in CI) e nel piano —
 * vedi docs/10-restyling-e-responsive.md — ma non esiste ancora, e finche non
 * esiste questo e il modo di non misurare a occhio.
 *
 * USO
 *   1. apri l'applicazione ed esegui l'accesso
 *   2. strumenti di sviluppo, scheda "dispositivo", larghezza 375
 *   3. incolla questo file nella console e premi invio
 *
 * Le rotte con identificativo si scoprono da sole: prende la prima partita e
 * la prima squadra dall'API, cosi non c'e nulla da aggiornare a mano.
 */
(async () => {
  const SOGLIA_TOCCO = 44;          // area minima raccomandata per il dito
  // Mezzo pixel di tolleranza: un elemento alto esattamente 44 px viene
  // misurato 43.99 e verrebbe segnalato per sempre senza che ci sia nulla da
  // correggere. Un audit che grida al lupo lo si smette di guardare.
  const TOLLERANZA = 0.5;
  const ATTESA = 1300;              // tempo dato alle richieste per rispondere

  const token = localStorage.getItem("vv.access");
  if (!token) return console.error("Esegui prima l'accesso.");
  const h = { Authorization: "Bearer " + token };
  const api = (p) => fetch("http://localhost:3001/api" + p, { headers: h }).then((r) => r.json());

  const [partite, squadre] = await Promise.all([api("/matches"), api("/teams")]);
  const M = partite[0]?.id, S = squadre[0]?.id;

  const rotte = [
    "/", "/squadre", S && "/squadre/" + S, "/campionati", "/partite",
    "/partite/nuova", M && "/partite/" + M, "/persone",
    M && "/partite/" + M + "/statistiche",
  ].filter(Boolean);

  // Navigazione interna senza ricaricare: il router ascolta popstate.
  const vai = async (p) => {
    history.pushState({}, "", p);
    dispatchEvent(new PopStateEvent("popstate"));
    await new Promise((r) => setTimeout(r, ATTESA));
  };

  const nome = (e) => e.tagName.toLowerCase()
    + (typeof e.className === "string" && e.className
        ? "." + e.className.trim().split(/\s+/).join(".") : "");

  const esiti = [];
  for (const p of rotte) {
    await vai(p);
    const de = document.documentElement;
    const W = de.clientWidth;

    // Chi sfora davvero: si scarta l'antenato che sfora solo perche sfora un figlio.
    const sforano = [...document.querySelectorAll("#root .contenitore *")]
      .filter((e) => e.scrollWidth > e.clientWidth + 2 || e.getBoundingClientRect().width > W)
      .filter((e) => ![...e.children].some((c) => c.scrollWidth > c.clientWidth + 2))
      .slice(0, 5).map((e) => `${nome(e)} client=${e.clientWidth} scroll=${e.scrollWidth}`);

    const piccoli = [...document.querySelectorAll("button, .nav a, a[href], input, select")]
      .map((e) => ({ e, h: e.getBoundingClientRect().height }))
      .filter((x) => x.h > 0 && x.h < SOGLIA_TOCCO - TOLLERANZA);

    esiti.push({
      rotta: p.replace(M, "‹partita›").replace(S, "‹squadra›"),
      sforaX: de.scrollWidth - W,
      sottoSoglia: piccoli.length,
      causa: sforano[0] ?? "",
    });
  }
  await vai("/");

  console.table(esiti);
  const rotte_rotte = esiti.filter((r) => r.sforaX > 0);
  const tocchi = esiti.reduce((n, r) => n + r.sottoSoglia, 0);
  console.log(rotte_rotte.length === 0 && tocchi === 0
    ? `PASSA — nessuna rotta sposta la pagina, nessun comando sotto i ${SOGLIA_TOCCO} px`
    : `FALLISCE — ${rotte_rotte.length} rotte spostano la pagina, ${tocchi} comandi sotto i ${SOGLIA_TOCCO} px`);
  return esiti;
})();
