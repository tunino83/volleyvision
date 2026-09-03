# Cosa manca, per fase

Fotografia allo stato attuale. Le fasi sono quelle di consegna
(`../docs/10-piano-di-sviluppo.md`), non gli sprint.

## Fase 1 — Il gestionale, solo web

**Dal punto di vista funzionale e finita.** Tutto quello che l'utente deve
poter fare, lo fa: registrarsi, creare squadre con roster e avatar, campionati,
persone, condivisioni; creare una partita con roster, formazioni per set,
sostituzioni e tag; caricare i due video e seguirli fino a "pronta".

Quel che manca **non e funzionalita: e messa in esercizio.**

| Cosa | Perche blocca | Intervento |
|---|---|---|
| **Invio email** | verifica indirizzo, reimposto password e inviti oggi finiscono a terminale. Senza, un utente vero non completa la registrazione | 3 |
| **Archiviazione cloud** | i video stanno su disco locale e passano dall'API. Con file da GB e piu utenti non regge | 2 |
| **PostgreSQL** | SQLite non regge accessi concorrenti. E una riga di configurazione piu una migrazione vera | 4 |
| **Irrobustimento accessi** | i token stanno in `localStorage`, il segreto JWT e nel file di configurazione | 5 |
| **Titolarita infrastruttura** | chi possiede server, dominio, certificati e archiviazione **non e ancora deciso** e non e nell'offerta | — |

Piu tre voci che non bloccano ma andrebbero chiuse prima di aggiungere
schermate: **catalogo delle stringhe** (14), **prove automatiche** (12), e la
ridondanza `ruolo`/`libero` (20).

**Stima**: 5-8 giorni per le voci tecniche, esclusa la decisione
sull'infrastruttura che non dipende da noi.

## Fase 2 — L'analisi

Qui il quadro e cambiato molto rispetto al piano, e in meglio.

### Gia fatto, e non era previsto cosi presto

| | Stato |
|---|---|
| Motore statistiche | **fatto**, e oltre il previsto: 13 indicatori raggruppati, tabellino per giocatore, explainability su ogni numero e ogni cella |
| Statistiche su piu partite | **fatte** (erano di Fase 3) |
| Elenco rally ed eventi | **fatto**, come colonna accanto al video |
| Riproduzione video con salto al fotogramma | **fatta nel browser**, sul file locale — vedi `13-video-locale.md` |

### Quel che manca davvero

| Cosa | Nota |
|---|---|
| **Dati veri del fornitore** | ne abbiamo **una** partita. La fase non si chiude finche l'adattatore non ha visto piu file veri, e finche non sappiamo se il salto al fotogramma e esatto sui loro video |
| **Pacchetto partita scaricabile** | l'API restituisce il pacchetto ma **non esiste il download**, ne la verifica di integrita, ne la gestione dello spazio |
| **Lavoro senza rete** | il pacchetto va tenuto nel client. Sono ~2 MB a partita: IndexedDB basta, ma non c'e niente |
| **Campo bidimensionale** | i `frames` con le posizioni ci sono e l'omografia converte in metri, ma nel client non e usato niente |
| **Sincronizzazione bidirezionale** | oggi si va dall'evento al video. Manca il contrario: il video avanza e l'evento corrente si illumina |
| **Scorciatoie da tastiera** | un banco di analisi si usa con la tastiera, non col mouse |
| **Cambio lato** | passare da lato 1 a lato 2 tenendo il punto di gioco. Dipende da `frameDelta`, che oggi vale 0 e non sappiamo se e vero |
| **Shell Windows e Android** | Fase 2 le prevede. **Da rivedere**: vedi sotto |

### La domanda che cambia la Fase 2

Se il salto al fotogramma nel browser risulta esatto sui file veri, allora
**il player non ha piu bisogno di Electron**, e con esso cade la ragione
principale per cui la shell desktop esisteva. Vedi `13-video-locale.md`.

**Non e ancora una decisione**: dipende da una misura che si fa solo sui video
del fornitore. Ma e la cosa da misurare per prima, perche sposta settimane.

## Cosa NON e cambiato

Il Livello A resta quello deciso: niente correzione degli eventi, niente
tabellino DataVolley completo, niente cambio palla e break point, niente mappe
di calore, niente montaggi. `19` elenca cosa i dati permetterebbero e che
consapevolmente non facciamo.
