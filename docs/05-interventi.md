# Punti di intervento

**Il file da cui partire.** Ogni voce dice cosa manca, dove, e quanto pesa.
Numerati in modo stabile: si citano per numero.

## Bloccanti per l'esercizio

### 1 — Collegamento al fornitore vero
`apps/api/src/fornitore/esterno.ts`

**Fatto**: tutto il resto. Il fornitore sta dietro un'interfaccia di due metodi;
un simulatore la implementa e produce, dopo il ritardo configurato, una partita
diversa a ogni caricamento. Percorso completo collaudato: caricamento dei due
video, accodamento, interrogazione periodica, acquisizione, notifica.
Vedi `09-simulatore-fornitore.md`.

**Manca**: `esterno.ts`, che oggi e uno scheletro commentato. Servono indirizzo,
autenticazione, forma della richiesta e della risposta — nessuna delle quali e
negoziata. Le sei domande da porre sono in `07-dati-fornitore.md`.

Il passaggio, quando ci sara: completare `esterno.ts` e mettere
`FORNITORE_ANALISI=esterno`. Nient'altro.

### 2 — Archiviazione su cloud
`apps/api/src/uploads/storage.ts`

Oggi i blocchi si accodano su disco locale e **i byte passano dall'API**, cosa
che in esercizio non deve accadere (`../docs/03`, "Regola zero"). L'interfaccia
`StorageDriver` e gia pensata per entrambe le modalita: `urlCaricamento`
restituisce `diretto: false` in locale e dovra restituire un indirizzo firmato
con `diretto: true`.

Il client (`apps/web/src/platform/browser.ts`) gia distingue i due casi.

### 3 — Invio email
`apps/api/src/common/mail.service.ts`

Scrive a terminale. Servono verifica indirizzo, reimpostazione password e
inviti di condivisione. Se si adotta un provider di autenticazione gestito
(punto 5), i primi due spariscono.

### 4 — Da SQLite a PostgreSQL
`apps/api/prisma/schema.prisma`

Cambiare `provider` e `DATABASE_URL`, poi `npm run db:push`. Lo schema e gia
scritto in modo portabile: niente enumerazioni native, JSON serializzato come
testo. Da rivedere al passaggio: `tagJson` puo diventare `JSONB` con indice, e
si possono introdurre le enumerazioni native.

### 5 — Autenticazione
`apps/api/src/auth/`

Realizzata in proprio con JWT: funziona ed e corretta (messaggi generici, blocco
dopo cinque tentativi, invalidazione delle sessioni al cambio password). I
documenti raccomandano pero un **provider gestito**, che porta con se verifica
email, reimpostazione e accesso con account esterni gia sicuri.

Da decidere prima di aprire al pubblico.

## Necessari per completare la Fase 1

### 6 — ~~Schermate di verifica email e reimpostazione password~~  *(risolto)*
`apps/web/src/pagine/Accesso.tsx`, `pagine/Profilo.tsx`

Le tre schermate esistono, piu il profilo. Vivono **fuori dalla sessione**:
chi ha perso la password non ce l'ha, e una schermata che richiede l'accesso
per recuperare l'accesso non serve a nessuno.

Il modulo di scelta password e **uno solo** per il reimposto e per il primo
accesso da invito: e la stessa cosa, scegliere una password che non si aveva.
Dettagli e regole in `11-utenti-e-accesso.md`.

### 7 — ~~Unione delle persone duplicate~~  *(risolto)*
`apps/web/src/pagine/Persone.tsx`, `apps/api/src/persons/persons.service.ts`

Il server propone le coppie sospette — stesso cognome, stessa iniziale — e la
schermata le fa esaminare una per una. **E un sospetto, non un verdetto**: due
fratelli sono due persone, e il caso Colombo Alessio / Colombo Andrea nei dati
di esempio serve proprio a ricordarlo.

Una cosa non era ovvia e l'ha mostrata la prova: **quando i due nomi coincidono
davvero**, chiedere "quale tieni?" mostrando due volte la stessa scritta non e
una domanda. Le coppie portano ora con se **squadre e partite**, che sono
l'unica informazione con cui si decide, e la conferma nomina quelle invece dei
nomi. La riga sotto e il vecchio testo, tenuto per memoria.

### 8 — ~~Sostituzioni~~  *(risolto)*
`apps/web/src/componenti/Cambi.tsx`

Scheda dedicata nel dettaglio partita, un set per volta, le due squadre
affiancate. Si sceglie chi esce e chi entra **dal roster**, non digitando un
numero: cosi non si registrano cambi di giocatori che non esistono.

Si chiede il **minuto**, non il fotogramma: la partita e gia stata giocata e i
cambi si leggono dal referto. Il fotogramma lo calcola il server quando conosce
gli fps, che arrivano col pacchetto di analisi.

Richiede che il numero di set sia gia dichiarato: senza, non si sa a quali set
assegnarli, e la scheda lo dice invece di mostrare campi inutili.

### 9 — ~~Campionati: modifica, eliminazione, condivisione~~  *(risolto)*
`apps/web/src/pagine/Campionati.tsx`

Correzione in linea, eliminazione con conferma sulla scheda stessa,
condivisione per indirizzo email con revoca. Chi riceve un campionato lo vede
in **sola lettura** e la sua scheda non porta comandi: non e un pulsante
disabilitato, e proprio assente.

Se l'indirizzo non e ancora registrato la condivisione resta un invito, e si
attiva da se alla sua iscrizione (`attivaInviti` in `auth.service.ts`).

### 10 — ~~Roster di partita: modifica e rimozione riga per riga~~  *(risolto)*
`apps/web/src/componenti/RosterPartita.tsx`, `apps/api/src/matches/matches.service.ts`

`PATCH /matches/:id/players/:playerId` corregge, `DELETE` rimuove. Tre cose che
non erano ovvie e che ora il codice fa:

- **Il cambio di numero si propaga.** Formazioni e cambi puntano al numero di
  maglia, non all'identificativo: correggere il numero senza portarseli dietro
  lascerebbe formazioni che indicano un giocatore inesistente
  (`rinumeraRiferimenti`).
- **La rimozione e rifiutata se il giocatore e ancora in campo**, con
  l'elenco di dove compare — "formazioni dei set 1, 2", "un cambio". Un
  messaggio che dice soltanto "impossibile" costringe a cercare a mano.
- **Il capitano resta uno solo per squadra**: nominandone uno, l'altro decade.

La correzione vale per **quella partita**: `MatchPlayer` e una copia, non un
riferimento, e il roster della squadra non viene toccato. Vedi `04-dati.md`.

### 11 — ~~Riconciliazione periodica dei caricamenti~~  *(risolto)*
`apps/api/src/uploads/manutenzione.service.ts`

`riconcilia()` **viene eseguita**, non solo offerta: ogni ora, piu un giro
trenta secondi dopo l'avvio, perche mentre il server era fermo le sessioni
hanno continuato a scadere. Un giro per volta — se il precedente e ancora in
corso, accavallarne un secondo cancellerebbe due volte le stesse chiavi — e un
errore non ferma il ciclo.

```
RICONCILIAZIONE_INTERVALLO_MIN=60   # 0 disattiva
```

**Con piu istanze va spostata su uno scheduler esterno o protetta da un
lucchetto**, altrimenti tutte ripuliscono insieme. Con una sola istanza, come
oggi, va bene cosi.

## Debito tecnico dichiarato

### 12 — Nessun esecutore di test  *(parzialmente risolto)*
Esiste una verifica eseguibile dell'adattatore su cinque insiemi sintetici —
45 asserzioni, codice di uscita 0/1 — in
`apps/api/src/analysis/__prove__/adattatore.prova.ts`. Vedi `08-dati-di-prova.md`.

Manca un esecutore vero (Vitest) e la copertura di: metriche di `packages/core`,
guardie della macchina a stati, percorso di caricamento con ripresa. Le
asserzioni esistenti si trasferiscono cosi come sono.

### 13 — ~~Paginazione~~  *(risolto per le partite)*
`apps/api/src/matches/matches.service.ts`, `apps/web/src/pagine/Partite.tsx`

Il `take: 200` non era paginazione, era un tetto — e i filtri su nome squadra e
tag giravano **dopo** il taglio, quindi cercare una squadra oltre la
duecentesima riga non la trovava mai. Ora tutto il filtro sta nella query, il
totale e il totale, e `perPagina` ha un tetto di 100: senza,
`perPagina=1000000` scarica l'archivio intero.

Il tag e cercato dentro `tagJson` come stringa fra virgolette, cosi `"casa"`
non corrisponde a `"casalinga"`. Su PostgreSQL diventera un contenimento su
JSONB con indice.

Restano da paginare gli elenchi che oggi non crescono: persone, utenze,
registro operazioni. Hanno ancora un tetto, e va bene finche i numeri sono
questi.

### 14 — Catalogo delle stringhe
Le stringhe stanno nei componenti. I documenti chiedono un catalogo unico.
Va fatto prima che i componenti si moltiplichino, non dopo.

### 15 — ~~`packages/core` non e ancora usato~~  *(risolto)*
Il motore alimenta ora le statistiche reali. La scelta di scriverlo come
"query -> insieme di eventi" si e ripagata subito: l'explainability — clic su un
numero, compaiono le azioni che lo compongono — non e costata nulla in piu.

### 16 — Limite di caricamento
`MAX_VIDEO_BYTES` vale 5 GB. **E una stima indicativa** in attesa dei requisiti
del fornitore. Il valore vive in un solo posto (`common/config.ts`) ed e citato
nell'interfaccia: cambiarlo e una riga.

### 17 — Shell mobile: quel che resta

Il caricamento da telefono **continua a schermo spento** nell'app Android
(decisione 9b, rivista il 2026-09-04 dopo l'opzione A del 2026-08-29). Nel
browser resta legato alla scheda aperta, e non e una scelta: un browser non ha
un servizio a cui consegnare il lavoro.

La parte comune gira gia nel browser:

- `platform/trasferimento.ts` — blocchi, ripresa, ritentativi con attesa
  crescente. Un solo meccanismo, parametrizzato dalla piattaforma.
- `platform/browser.ts` — riconosce il caso mobile dallo user agent: blocchi
  da 2 MB invece che da 8, e sospensione all'uscita dal primo piano.
- `platform/index.ts` — la capacita `rete`, per avvisare su rete a consumo.
- `Caricamento.tsx` — avvisi, proposta di ripresa, rifiuto del file sbagliato.
- Lato server: la sessione si riusa se il file e lo stesso, e
  `GET /matches/:id/videos/:lato/upload-session` la espone senza distruggerla.

**Fatto con la shell Android** (2026-09-04):

- Selettore di file nativo (`ACTION_OPEN_DOCUMENT` con permesso persistente):
  l'indirizzo resta valido dopo un riavvio, cosa che un `File` del browser non
  fa — ed e precisamente cio che serve a un servizio che gira quando la pagina
  non c'e piu.
- Schermo acceso durante il trasferimento nel browser (`wakeLock`), e sveglia
  del processore nel servizio nativo: sono due cose diverse: la prima tiene
  acceso lo schermo, la seconda permette di spegnerlo.
- Registrazione con la mira di inquadratura, 720p a 4 Mbit/s, orientamento
  bloccato.
- Servizio in primo piano con notifica e ripresa automatica dopo le
  interruzioni di rete.

**Resta da fare:**

1. Sostituire il riconoscimento da user agent con la piattaforma dichiarata
   dalla shell. Oggi `browser.ts` guarda `Capacitor.isNativePlatform()` per il
   solo trasferimento in secondo piano; il resto (blocchi da 2 MB) va ancora
   per user agent.
2. `navigator.connection` non e disponibile su iOS: la capacita `rete` deve
   passare al plugin di rete di Capacitor, altrimenti l'avviso sul consumo non
   compare mai proprio dove serve di piu.
3. **Provarlo su file veri da gigabyte**, su rete di palestra, su un telefono
   vero. Nulla di quanto sopra e stato eseguito su un apparecchio: compila e
   basta. E la verifica che manca, ed e quella che conta.
4. Esenzione dall'ottimizzazione della batteria: su alcuni telefoni
   (Xiaomi, Huawei, Samsung con risparmio aggressivo) il servizio in primo
   piano viene ucciso lo stesso. Va chiesta all'utente, e non si puo dare per
   scontato che basti.

### 18 — ~~Responsive e restyling~~  *(risolto)*
`apps/web/src/stile.css`, `componenti/Icone.tsx`, `componenti/Tema.tsx`

Sistema di stile riscritto: due temi, identita presa dal campo da gioco, icone
disegnate. L'audit a 375 px passa su tutte e dieci le rotte. Quel che resta —
stili in linea, sagome di caricamento, audit automatico — e in fondo a
`10-restyling-e-responsive.md`.

### 19 — Statistiche: quel che resta
`packages/core`, `apps/api/src/analysis/`

Fatto in questa tornata: 13 indicatori di squadra raggruppati per fondamentale,
il tabellino per giocatore con explainability su ogni cella, e l'aggregato su
piu partite per persona (`/stats/players`).

**Quel che i dati permetterebbero e non facciamo ancora:**

- **Distribuzione dell'attacco per zona.** I `frames` portano le posizioni dei
  giocatori e l'omografia converte in metri: da li si ricava da dove parte
  l'attacco. E il presupposto delle mappe di calore, che il Livello A esclude.
- **Serie di punti consecutivi.** Le `actions` hanno `winner` e il punteggio
  prima dell'azione: i parziali e le serie si ricavano senza dati nuovi.
- **Cambio palla e break point.** Servirebbe sapere chi era al servizio a ogni
  azione: e ricavabile dal punteggio piu la formazione iniziale, ma il Livello A
  lo esclude esplicitamente.
- **Ricezione positiva/negativa.** Il fornitore da solo `Error`: senza una
  valutazione della qualita, "ricezione positiva" non e calcolabile. **Non e un
  limite nostro**, e un limite del dato in ingresso: da chiedere al fornitore.

**Cross-partita, quel che manca:** il calcolo gira sul server. In Fase 3 deve
girare **nel client** sulle partite scaricate, con la stessa funzione di
`@vv/core` — una sola definizione delle metriche, altrimenti i numeri
divergono fra le due strade.

### 20 — `ruolo` e `libero` possono contraddirsi
`apps/api/prisma/schema.prisma`

`PlayerRole` contiene gia `"libero"`, e accanto c'e un booleano `libero`: due
campi che dicono la stessa cosa e che **possono discordare**. Nei dati di
esempio c'erano giocatori con ruolo "libero" e flag falso, e altri col
contrario; nell'album due figurine dicevano entrambe "LIBERO" con la fascia di
colore diverso, e sembrava un difetto grafico.

Tamponato: `TeamsService.coerente()` impedisce che divergano dove si scrivono,
e il seed non li produce piu contraddittori. **Non e risolto**: la ridondanza
resta, e chi scrive dall'API con un altro percorso puo ricrearla.

La cosa giusta e togliere il booleano dal roster e derivarlo dal ruolo. Tocca
`TeamPlayer`, `MatchPlayer`, le validazioni delle formazioni e la scelta del
libero: mezza giornata, da fare quando si tocca quell'area per altro.

### 21 — Aggregati precalcolati per le statistiche cross-partita
`apps/api/src/analysis/stagione.service.ts`

**Misurato** con `prisma/prova-carico.js`: la risposta cresce linearmente,
~2,7 ms per partita — 171 ms a 52 partite, 716 ms a 252, **1358 ms a 502**.
Il costo e leggere e interpretare ogni pacchetto a ogni richiesta: a 500
partite sono 98 MB di JSON per una schermata.

Il limite pratico e **~100 partite**. Il collo di bottiglia vero non e la
latenza ma la memoria: 98 MB interpretati per richiesta, per ogni utente
contemporaneo.

**Non urgente**: una stagione sono 20-30 partite. Quando servira, la strada e
una tabella `StatisticaGiocatorePartita` scritta all'acquisizione dell'analisi,
non una cache. Dettagli e numeri in `14-scala-e-sincronizzazione.md`.

### 22 — Offline: scaricamento del pacchetto e guscio senza rete
`apps/web/src/platform`, service worker

Manca tutto: il comando di scaricamento, l'archiviazione in IndexedDB, il
confronto di revisione, il service worker e il manifest. **Provato** che
IndexedDB regge senza problemi: 0,12 MB scritti e riletti in 3 ms, quota
2,6 GB.

La sincronizzazione **non e automatica per scelta**, e in offline si legge e
basta: vedi `14-scala-e-sincronizzazione.md`, dove sta anche il perche la
bidirezionale non conviene.

## 23. Guscio installabile — **fatto in parte**

Manifesto, service worker, icone, invito all'installazione e striscia "sei
senza rete": `15-installazione-e-offline.md`. **La registrazione del guscio e
il funzionamento senza rete non sono ancora verificati** — vanno provati in
Chrome o Edge veri, e finche non lo sono l'intervento non e chiuso.

Resta fuori lo **scaricamento esplicito della partita** (intervento 22): oggi
resta disponibile solo cio che si e gia aperto, non cio che si e deciso di
portarsi dietro.

Conseguenza sul piano: **Electron non serve piu**. Vale la pena rileggere
Fase 2 con questo in mano.

## 24. Il pacchetto costruito e 2,4 MB di JavaScript

Un solo blocco, nessuna divisione. Alla prima apertura su rete lenta si sente,
e ora che l'applicazione si installa la prima apertura conta di piu.

Da dividere per rotta (`React.lazy`) e da isolare le dipendenze pesanti — gli
avatar generati sono il primo sospetto, e servono in due schermate su dodici.

## 25. Rotta per la riconciliazione, chiamabile da cron

Su hosting con Passenger (cPanel, Plesk) **il processo Node viene spento
quando non arrivano richieste**, e i lavori a tempo dentro il processo — la
riconciliazione dei caricamenti e l'interrogazione del fornitore — smettono
di girare.

`RICONCILIAZIONE_INTERVALLO_MIN=0` li disattiva gia. Manca **una rotta
protetta che il cron possa chiamare** per eseguirli una volta.

Protetta da un segreto nell'intestazione, non aperta: e un comando, e chi la
chiama non e un utente. Vedi `19-installazione-cpanel.md`, punto 7.

## Trappole gia incontrate

Da non ripercorrere.

| Problema | Causa | Soluzione adottata |
|---|---|---|
| `Value does not fit in an INT column` | 5 GB non stanno in un intero a 32 bit | `BigInt` su `dimensione` e `bytesRicevuti`; serializzazione a numero in `main.ts` |
| Rotta dei blocchi in stallo | `rawBody` di Nest consumava il flusso | un solo passaggio sceglie fra corpo grezzo e JSON secondo la rotta |
| `@vv/schema` non risolto a runtime | il pacchetto puntava al sorgente TypeScript | pacchetti compilati con `main` su `dist` |
| `prisma generate` fallisce | il processo in esecuzione blocca il motore | fermare il processo prima di rigenerare |
| **`prisma db push` ha cancellato i dati** | su SQLite togliere una colonna **ricrea la tabella**, e le chiavi esterne portano via a cascata tutto cio che appartiene a quelle righe: squadre, campionati, partite | prima di `--accept-data-loss`, **copiare `dev.db`**. In esercizio mai `db push`: migrazione versionata che crea, copia e poi elimina, dentro una transazione |
| "Campionato non trovato" con il campionato nell'elenco | dopo `db:seed` gli identificativi cambiano, e la pagina aperta tiene in cache quelli vecchi | **ricaricare la pagina dopo ogni `db:seed`**. Nel modulo di nuova partita l'errore `NON_TROVATO` ora spiega che gli elenchi sono vecchi e offre di ricaricarli |
| Stato di fuoco invisibile su un'icona | `transition: color` su un `<svg>` il cui `fill` e `currentColor`: la transizione impedisce al colore di risolversi, e `:focus-within` sembrava non applicarsi pur combaciando | niente transizione sul `color` di un SVG. Se serve animarla, si transisce `fill` sul `path` |
| Partita "pronta" senza statistiche | il seed scriveva `stato: READY, revisioneAnalisi: 1` **senza creare il record `Analysis`**: la pillola prometteva un dato che non esisteva | il seed genera l'analisi davvero, passando dal generatore e dall'adattatore come in esercizio. **Uno stato che i dati non sostengono e peggio di uno stato assente**: fa credere a un difetto dove c'e solo un dato mancante |
| API in crash durante `npm run build` | `nest build` ripulisce `dist/` mentre `nest start --watch` sta girando: il watcher prova ad avviare `dist/main` che non c'e piu | **non costruire mentre `npm run dev` gira.** Fermare, costruire, riavviare |
| Elenco partite ristretto alla larghezza del testo | nei grafici avevo chiamato una classe `.colonna`, **lo stesso nome dell'utilita di impaginazione**: la regola del grafico l'ha sovrascritta in tutta l'applicazione | nomi generici in un foglio globale sono una trappola. Rinominata `.colonna-grafico`: si nominano le cose per il posto in cui vivono |
| Vite serviva codice vecchio | `tsc -b --noEmit false` emetteva un `.js` accanto a ogni `.tsx`, e Vite risolve `.js` **prima** di `.tsx` | build corretto in `tsc --noEmit -p tsconfig.json`, `.js` rimossi da `src/` e messi in `.gitignore` |
