# Come si installa, e come funziona senza rete — senza Electron

Due domande: **se non facciamo l'applicazione Electron, come funziona
l'offline? E come viene distribuita?**

La risposta e che il browser fa entrambe le cose, e da qualche anno le fa bene.
Questo documento descrive il meccanismo, cosa e implementato, e — soprattutto —
**dove il browser non arriva**, perche e li che si decide se una shell nativa
serve davvero.

## 1. Come viene distribuita

**Non viene distribuita: viene visitata, e poi installata dal browser.**

L'utente apre `volleyvision.it`. Il browser legge `manifest.webmanifest`,
trova un service worker registrato, e riconosce che quel sito **e**
un'applicazione. A quel punto offre di installarla:

| Dove | Come |
|---|---|
| Chrome / Edge, Windows e macOS | icona di installazione nella barra degli indirizzi, oppure il pulsante nel profilo |
| Safari su macOS (14+) | Condividi › **Aggiungi al Dock** |
| Chrome su Android | "Aggiungi a schermata Home", oppure il nostro pulsante |
| Safari su iOS | Condividi › **Aggiungi a Home** |

Dopo l'installazione: **icona nel menu Start, nel Dock o nella schermata
Home; finestra propria senza barra degli indirizzi; voce nella barra delle
applicazioni.** Per l'utente e un programma installato, e non c'e modo di
distinguerlo da uno.

### Cosa sparisce rispetto a Electron

Non e un dettaglio di comodita: e la ragione principale della scelta.

| | Electron | Applicazione installabile |
|---|---|---|
| Installatore | `.exe` e `.dmg` da costruire e ospitare | nessuno |
| Firma del codice | certificato Windows (~300-500 €/anno) | nessuna |
| Notarizzazione Apple | account sviluppatore (99 $/anno) + processo a ogni versione | nessuna |
| Aggiornamento | da scrivere (electron-updater), server, firma dei delta | **si pubblica e basta** |
| Peso scaricato | 80-150 MB per sistema | ~1 MB |
| Sistemi da costruire | Windows e macOS separatamente, su macchine diverse | uno |
| Tempo alla prima consegna | settimane | **e gia fatto** |

L'**aggiornamento** e il punto che pesa di piu nel tempo. Con Electron ogni
correzione richiede: costruire due pacchetti, firmarli, notarizzare quello
Apple, pubblicarli, e sperare che l'aggiornatore automatico funzioni sui
computer che non si vedono. Qui si pubblicano i file: alla riapertura
successiva l'utente ha la versione nuova, e non ha dovuto fare nulla.

## 2. Come funziona senza rete

Tre pezzi, e ognuno risolve una cosa diversa.

### Il guscio — `apps/web/public/sw.js`

Il service worker e un pezzo di codice che **si mette fra l'applicazione e la
rete**, e resta installato. Quando la rete manca, risponde lui.

Due depositi, due regole opposte, e la differenza conta:

- **il guscio** (pagina, stili, codice): *prima la rete, poi la copia*. Al
  contrario si consegnerebbero per giorni versioni vecchie a chi e connesso.
  I file con nome versionato (`index-a1b2c3.js`) sono l'eccezione: il nome
  contiene l'impronta del contenuto, quindi la copia non puo essere obsoleta.
- **i dati** (risposte GET dell'API): *prima la rete, la copia come rete di
  sicurezza*, marcata `X-Da-Deposito` cosi l'interfaccia puo dire che non e
  aggiornata.

E cosi che il documento 14 — "si scarica cio che si apre, e resta disponibile
senza rete" — si ottiene **senza scrivere un livello di sincronizzazione**.

Il deposito dei dati si cancella all'uscita: le risposte riguardano
quell'utente, e su un computer condiviso non devono sopravvivergli.

### Il video

Non c'entra con la rete: **e gia sul disco dell'utente**. Si collega dalla
scheda "Guarda il video" e si riproduce in locale, col salto al fotogramma
(documento 13). Nessun deposito, nessun gigabyte da gestire: e questa la
scoperta che ha tolto a Electron la sua ragione principale.

### I dati delle partite

Oggi il deposito del service worker copre il caso "riapro quello che ho gia
guardato". Per il caso vero — **"scarico la partita adesso perche domani sono
in trasferta"** — serve IndexedDB e un comando esplicito di scaricamento:
e l'intervento 22, non ancora fatto. Il costo e contenuto (i pacchetti sono
0,12-0,5 MB) e la prova e stata fatta: 0,12 MB scritti e riletti in 3 ms.

## 3. Cosa e implementato

| | |
|---|---|
| `public/manifest.webmanifest` | nome, icone, colori, scorciatoie |
| `public/sw.js` | il guscio e le due regole di deposito |
| `genera-icone.py` | le icone, disegnate dal marchio, `any` e `maskable` |
| `src/platform/installazione.ts` | installazione e stato di rete, **nel livello di piattaforma** |
| `componenti/Installazione.tsx` | la striscia "sei senza rete" e l'invito nel profilo |

### L'invito guidato, e il vincolo che lo disegna

**`prompt()` si puo chiamare solo dentro un gesto dell'utente.** Non esiste il
modo di far comparire da soli la finestra di installazione del browser: Chrome
ed Edge la rifiutano se non nasce da un clic. E anche per questo l'invito
automatico del browser viene soppresso (`preventDefault`): se lo lasciassimo
fare a lui, l'utente installerebbe senza aver letto nulla.

Quindi il guidato funziona in tre tempi:

1. **noi** decidiamo quando mostrare la nostra finestra — qui c'e liberta
2. l'utente preme "Installa", ed **e quel clic** a dare il permesso
3. compare la finestra del browser, che conferma

**Due finestre di seguito, e non si evita**: la seconda e del browser. In
cambio la prima e nostra, e spiega le condizioni invece di limitarsi a
"Installa? Si/No".

Quando compare: dalla **terza apertura** (chi arriva adesso non sa ancora cosa
sia questa cosa, e installare un programma di cui non sai nulla si rifiuta per
riflesso), solo con rete, e mai se gia installata. "Non ora" o un rifiuto
nella finestra del browser la zittiscono per **30 giorni** — insistere subito
dopo un no e cio che fa disinstallare le applicazioni.

### Cosa e verificato, e cosa no

Onesta necessaria, perche il resto del documento e una promessa finche non lo
si prova sulla macchina di qualcuno.

| | |
|---|---|
| Manifesto letto e valido | **si**: 4 icone, `standalone`, 2 scorciatoie |
| Icone generate | **si** |
| Tipi e compilazione | **si** |
| Sintassi del service worker | **si** (`node --check`) |
| **Registrazione del guscio** | **NO — non verificata** |
| **Apertura senza rete** | **NO — non verificata** |
| **Installazione vera** | **NO — non verificata** |

I service worker sono **disabilitati nel browser usato per la verifica**:
fallisce la registrazione anche di un file vuoto, quindi non e un difetto del
codice — ma non e nemmeno una prova che funzioni.

**Da provare in Chrome o Edge veri**, con `npx vite preview` (non `npm run
dev`: in sviluppo il guscio non si registra apposta):

1. aprire `http://localhost:4173`
2. Strumenti per sviluppatori > Application > Service Workers: deve risultare
   **activated and running**
3. Application > Manifest: nessun avviso, e la voce sull'installabilita
4. spuntare **Offline** nella scheda Network e ricaricare: **l'applicazione
   deve aprirsi**, e comparire la striscia "Sei senza rete"
5. installarla dall'icona nella barra degli indirizzi, e riaprirla dal menu
   Start

Se il punto 4 fallisce, il difetto e in `sw.js` e si vede nella console del
guscio, non in quella della pagina.

`installazione.ts` sta nel livello di piattaforma e non in un componente per
la regola 1: dentro Electron o Capacitor l'applicazione **e gia installata**,
e quei metodi risponderanno di conseguenza invece di proporre un pulsante che
non avrebbe senso.

## 4. I limiti, detti chiaramente

Non e una soluzione senza spigoli, e vanno messi in conto.

- **`navigator.storage.persist()` risponde di no su `localhost`.** Senza
  quella garanzia il sistema puo liberare il deposito quando lo spazio
  scarseggia. In esercizio, su dominio vero e ad applicazione installata, i
  browser normalmente concedono — **ma va verificato**, non dato per fatto.
- **Su iOS il deposito viene rimosso dopo alcune settimane di non utilizzo.**
  E una politica di Safari e non si aggira. Per il consulto occasionale non
  cambia nulla; per un uso "ho la stagione sempre con me" e un limite reale.
- **Nessun ambiente aziendale garantisce l'installazione.** Alcune
  configurazioni la disabilitano. L'applicazione continua a funzionare in una
  scheda, ma senza finestra propria.
- **Il collegamento al video locale con memoria del file** e solo su
  Chromium. Su Safari il file va riscelto a ogni sessione.
- **Il pacchetto costruito e 2,4 MB di JavaScript.** Non e un problema
  dell'installazione, ma alla prima apertura si sente su rete lenta. Va
  spezzato (intervento da aprire).

## 5. Cosa resta a una shell nativa

Dopo tutto questo, **una cosa sola merita ancora una shell**: la
**registrazione lunga da telefono**, con l'overlay sul campo.

Le API ci sono anche nel browser — `getUserMedia`, `MediaRecorder` con H.264
in MP4, `wakeLock` per lo schermo, `showSaveFilePicker` per scrivere su disco
— e sono state verificate. Ma su **Safari iOS** `MediaRecorder` e limitato,
`showSaveFilePicker` non esiste, e novanta minuti di ripresa dentro una scheda
del browser sono un rischio serio: memoria, sfratto della scheda, qualita.

**Quindi: Capacitor per la registrazione, se e una funzione centrale.
Electron per niente.**

E prima di decidere anche quello, va saputo se gli utenti riprendono col
telefono o con una telecamera. Non lo sappiamo ancora.
