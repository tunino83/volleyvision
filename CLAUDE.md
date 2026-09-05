# Volley Vision — contesto di lavoro

Piattaforma di video-analisi per la pallavolo. Questo repository contiene
**l'implementazione**; l'analisi funzionale sta in `../docs/` (documento di
rilascio, specifiche di dettaglio, piano di sviluppo).

**Stato: Fase 1 completa. Prime statistiche sui dati reali del fornitore.**

## Prima di lavorare, leggi

| File | Quando serve |
|---|---|
| `TODO.md` | **cosa manca e cosa blocca**: account da aprire, esercizio, sicurezza, iOS. Parti da qui per capire dove siamo |
| `docs/00-stato.md` | cosa esiste e cosa no, sempre |
| `docs/05-interventi.md` | **i punti aperti numerati: parti sempre da qui** |
| `docs/01-architettura.md` | prima di aggiungere un modulo o una schermata |
| `docs/02-backend.md` | prima di toccare l'API |
| `docs/03-frontend.md` | prima di toccare l'interfaccia |
| `docs/04-dati.md` | prima di modificare lo schema |
| `docs/07-dati-fornitore.md` | **prima di toccare qualunque cosa riguardi l'analisi** |
| `docs/08-dati-di-prova.md` | i cinque insiemi sintetici e come verificarli |
| `docs/09-simulatore-fornitore.md` | **come si disattiva il simulatore e si punta al fornitore vero** |
| `docs/10-restyling-e-responsive.md` | **prima di toccare il CSS o aggiungere una schermata**: sistema di stile, due temi, regole responsive |
| `docs/11-utenti-e-accesso.md` | **prima di toccare autenticazione, ruoli o utenze**; e come si innesta Google |
| `docs/12-cosa-manca.md` | cosa resta per Fase 1 e Fase 2, aggiornato |
| `docs/13-video-locale.md` | **prima di pianificare la shell desktop**: perche potrebbe non servire piu |
| `docs/19-installazione-cpanel.md` | **prima di mettere in esercizio**: cosa installare, i nomi che cPanel cambia, e cosa il codice ancora non fa |
| `docs/21-app-android.md` | **prima di toccare il guscio Android**: cosa contiene, cosa manca, e perche il service worker li non gira |
| `docs/20-installazione-render.md` | **prima di installare su Render**: il file `render.yaml`, le due variabili da impostare a mano, e perche il piano gratuito non conserva i video |
| `docs/16-piani-e-profili.md` | **parcheggiato**: la proposta dei tre piani e perche non si tara senza il prezzo del fornitore |
| `docs/17-forum-e-discussioni.md` | prima di progettare qualunque cosa sociale: perche i filtri non possono usare le anagrafiche private |
| `docs/15-installazione-e-offline.md` | **prima di pianificare Electron o Capacitor**: come si installa e come funziona senza rete, e cosa resta davvero a una shell nativa |
| `docs/14-scala-e-sincronizzazione.md` | **prima di toccare le statistiche cross-partita o l'offline**: numeri misurati e limiti |

## Le regole che non si negoziano

1. **Il livello di astrazione delle piattaforme resta sottile.** Nessun
   componente dell'interfaccia accede a filesystem o interfacce native: tutto
   passa da `apps/web/src/platform`. Il giorno che si rompe, ogni modifica si
   paga tre volte.
2. **Il motore statistiche nasce da insiemi di eventi**, mai da contatori:
   `packages/core/src/select.ts` e la base; `metrics.ts` (squadra) e
   `giocatori.ts` (tabellino) ci costruiscono sopra. E cio che rende gratuita
   l'explainability: vale anche per le celle del tabellino.
2b. **Cosa si puo fare lo dice `capacitaPartita(stato)`**, in `@vv/schema`, e
   nessun altro. Il server rifiuta, il client non mostra. Regola:
   **cio che e stato mandato all'analisi non si tocca piu** — eccetto le
   sostituzioni, che per progetto si registrano dopo.
3. **`@vv/schema` e la fonte unica** di tipi e validazioni: stesso schema nel
   client e nel server. Non duplicare le regole.
4. **I byte dei video non passano mai dall'API in esercizio.** Oggi in sviluppo
   si, per non dipendere dal cloud; l'interfaccia in `uploads/storage.ts` e
   pensata per entrambi.
4b. **Lo stato del caricamento sta sul server, mai nel client.** E cio che rende
   la ripresa uguale in tutte le shell, e cio che ha reso il servizio nativo
   Android **un secondo chiamante della stessa API**, non un secondo
   meccanismo: manda gli stessi pezzi allo stesso indirizzo e chiede al server
   da dove ripartire. Il meccanismo condiviso e `platform/trasferimento.ts`; le
   shell gli passano due parametri. Aprire una sessione **non ne distrugge una
   gia aperta sullo stesso file**: se lo facesse, ogni riapertura butterebbe i
   gigabyte gia trasferiti.
   Dove il caricamento continua cambia con la shell (decisione 9b, rivista il
   2026-09-04): **nell'app Android anche a schermo spento e ad applicazione
   chiusa**, grazie a un servizio in primo piano con notifica; **nel browser
   solo con la scheda aperta**, perche il browser non ha un servizio — li si
   tiene acceso lo schermo e basta.
5. **Il fornitore sta dietro un'interfaccia.** Oggi risponde un simulatore;
   si passa al vero con `FORNITORE_ANALISI=esterno` e nient'altro. Nessun file
   fuori da `apps/api/src/fornitore/` sa chi analizza i video.
6. **Il formato del fornitore lo conosce solo l'adattatore.** I primi dati reali
   sono arrivati e NON coincidono col PDF del modello dati: sette scostamenti,
   piu difetti da correggere (confini dei set sbagliati, 15% di eventi senza
   giocatore). Tutto in `apps/api/src/analysis/adapter.ts` e documentato in
   `docs/07-dati-fornitore.md`. I client vedono solo il formato canonico.
6b. **La password e una delle identita, non un campo dell'utente.**
   `AuthIdentity` tiene i modi di accesso; il resto del sistema conosce solo
   `User.id`. E cio che rende l'aggiunta di Google un innesto in un metodo solo
   (`accediConProvider`) invece di una riscrittura. **Nessuna funzione, in
   nessun ruolo, imposta la password di un altro**: si manda un collegamento.
6c. **"Non ho potuto chiedere" non e "la risposta e no".** Un errore di rete
   non e una risposta di errore: `ERRORE_DI_RETE` in `api/client.ts` li
   distingue, e chi tratta l'uno per l'altro cancella sessioni valide. Vale
   ovunque, non solo nell'accesso.
6d. **In locale va tutto tranne il video.** Anagrafiche ~56 KB, un pacchetto
   partita 120-180 KB: **nulla qui e grande**, e far scegliere all'utente fra
   oggetti da 150 KB e farlo lavorare per niente. Si **sostituisce l'insieme
   intero** a ogni apertura con rete, in sola lettura — e una copia, non una
   sincronizzazione. L'unica domanda che resta e **se**, non cosa: con
   l'applicazione installata si scarica tutto (installarla e gia dire "questo
   e il mio dispositivo"); in una scheda del browser, che puo essere un
   computer condiviso, solo le anagrafiche e cio che si apre. Regge finche i
   dati sono piccoli e non si modificano offline. Vedi `docs/14`.
6g. **L'applicazione installabile e per i computer. Telefoni e tablet avranno
   l'app nativa** (confermato il 2026-08-30). Conseguenze pratiche: l'invito a
   installare **non si propone su mobile** — competerebbe con l'app degli
   store e confonderebbe; e i limiti di Safari su iOS (spazio liberato dopo
   settimane, file video da riscegliere) **escono dal discorso**, perche su
   iPhone non si usera il browser. Restano validi per chi apre da un browser
   mobile per caso.
6e. **Il destinatario e il singolo appassionato, non la societa** (confermato
   il 2026-08-30). L'entita *Societa* — account con piu utenti membri, dati
   posseduti dall'organizzazione — e stata valutata e **messa da parte**: e il
   modello giusto per vendere a un club, non a una persona. Conferma il punto
   9d. Conseguenza: un eventuale piano si attacca a `User`, e non serve
   nessun cambio di proprieta dei dati.
6f. **Se arriveranno i piani, il limite vero e il video.** Un video pesa 5 GB,
   i suoi dati 180 KB: **29.000 a 1**. Limitare i dati sarebbe arbitrario e
   basta; l'unico limite che corrisponde a un costo e per quanto tempo si
   conserva il video. Da cui la forma: **le statistiche restano per sempre, il
   video scade.** Nota: il costo per partita chiesto dal fornitore e ancora
   ignoto, e probabilmente domina tutto il resto.
7. **La qualita del dato si dichiara all'utente.** Ogni pacchetto porta con se
   un giudizio sui propri limiti, e la schermata lo mostra. Garantiamo che il
   calcolo sia corretto, non che il dato in ingresso lo sia.

## Funzioni scritte ma non in esercizio

Il codice c'e, provato e funzionante; l'esercizio no. **Il valore lo decide il
server** (`CONFIG.funzioni`) e i client lo chiedono a `/api/version`: due
bandiere indipendenti, una per lato, prima o poi divergono — e si finisce con
un pulsante che c'e e una rotta che risponde "non esiste". Spenta, la rotta
**rifiuta**: nascondere il comando nel client non basta.

| Variabile | Cosa accende | Perche e spenta |
|---|---|---|
| `FOTO_PERSONE=1` | fotografie al posto degli avatar disegnati | dati personali, spesso di minori: prima servono informativa e consenso |

## Comandi

```
npm run setup     # installa, costruisce i pacchetti, crea il database, carica i dati
npm run dev       # API su :3001 e web su :5173
npm run db:seed   # ricarica i dati di esempio
npm run genera:dati  # riscrive i cinque insiemi di prova
```

Accessi di prova (password `password123`):
`admin@`, `segreteria@`, `utente@volleyvision.test`.

## Convenzioni

- TypeScript ovunque, `strict: true`.
- **Interfaccia e messaggi in italiano; codice, tipi e commenti in italiano
  tecnico.** Nessun testo scritto nei componenti: le stringhe stanno con il
  componente che le usa (in Fase 2 andranno in un catalogo unico).
- Errori uniformi `{ code, message, details, correlationId }`. Mai stringhe libere.
- Ogni schermata ha i quattro stati: caricamento, contenuto, vuoto, errore.
  Il componente `Stato` li impone.
