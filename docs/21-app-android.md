# L'applicazione Android

**Stato: l'APK si costruisce e contiene le due funzioni native. Non e stato
provato su un telefono — e la verifica che manca, ed e quella che conta.**

E la **stessa applicazione web** dentro un guscio Capacitor, non una
riscrittura: la scelta di fondo del progetto (`02b`), che regge perche quasi
tutto — elenchi, statistiche, dati senza rete — non ha niente di specifico
per piattaforma.

## Cosa c'e dentro, oggi

Tutto cio che l'applicazione web sa fare e che ha senso su un telefono:

| | |
|---|---|
| Accesso, partite, squadre, campionati, persone | si |
| Statistiche di partita e di stagione, schede giocatore | si |
| Dati senza rete (IndexedDB, ~1,3 MB a partita) | si |
| Caricamento video, con ripresa dal punto raggiunto | si |
| Avatar componibili | si |
| **Registrazione con la mira di inquadratura** | si |
| **Caricamento a schermo spento e ad app chiusa** | si |

## Le due funzioni native

Sono le sole. Tutto il resto e la stessa pagina che gira nel browser, e resta
cosi di proposito: il nativo si paga su ogni piattaforma.

### La registrazione con la mira di inquadratura

`RegistrazioneAttivita.java`, `MiraCampo.java`.

La mira non e una decorazione. Il fornitore ricava le posizioni dei giocatori
da un'omografia, e l'omografia si calcola sui **quattro angoli del campo**: se
un angolo esce dall'inquadratura le posizioni non si possono ricavare affatto.
Il video sarebbe guardabile e inutile — e lo si scoprirebbe giorni dopo, ad
analisi fatta e pagata. Registrare dall'applicazione e l'unica occasione di
dirlo a chi riprende, mentre puo ancora spostarsi.

**720p a 4 Mbit/s**, e non e una scelta di qualita ma di aritmetica: il limite
di caricamento e ~5 GB (decisione 9f), e a 4 Mbit/s sono circa due ore e mezza
di ripresa. A 1080p e 12 Mbit/s si sfonderebbe il limite dopo cinquanta minuti
— meno di una partita.

Orientamento bloccato in orizzontale, schermo che non si spegne, spazio libero
dichiarato **in minuti di ripresa** e non in gigabyte: "3,7 GB" non dice a
nessuno se basta per un set.

### Il caricamento a schermo spento

`ServizioCaricamento.java`, `VideoNativoPlugin.java`.

Un servizio in primo piano con notifica, che tiene sveglio il **processore**
(non lo schermo) e riprende da solo dopo le interruzioni di rete. Sopravvive
alla chiusura dell'applicazione.

**Non e un secondo meccanismo di caricamento.** Manda gli stessi blocchi alla
stessa API di `platform/trasferimento.ts` e, come quello, chiede al server da
dove ripartire invece di ricordarselo. E la regola 4b: lo stato sta sul
server. Riscrive quel ciclo in Java per una ragione sola — gira quando il
WebView non esiste piu, e cio che deve sopravvivere all'uscita
dall'applicazione non puo stare dentro l'applicazione.

**Il gettone non e la sessione dell'utente.** Il rinnovo della sessione e a
uso singolo (`auth.service.ts`): se il servizio e la scheda web se lo
passassero, il primo che rinnova butterebbe fuori l'altro — l'utente
disconnesso a meta partita, o il caricamento morto. Da qui un permesso
ristretto a un solo caricamento, che la parte web chiede a
`POST /uploads/:id/delega` e che su tutto il resto dell'API non vale
(`uploads/delega.guard.ts`).

**Il file si sceglie con `ACTION_OPEN_DOCUMENT`,** non con `<input type=file>`.
Il `File` del browser vive nella pagina: quando l'applicazione va in secondo
piano non esiste piu, cioe proprio quando il servizio ne avrebbe bisogno.

## Cosa NON c'e, e non e una dimenticanza

**La riproduzione video.** E la decisione 9b: un video pesa 5 GB e nessuno lo
tiene sul telefono. Il telefono riprende e carica; si guarda dal computer.

## Costruirlo

Serve il JDK di Android Studio e l'SDK Android. Su questa macchina ci sono
gia entrambi.

```
cd apps/web
VITE_API_URL="https://volleyvision-api-qtc1.onrender.com" npm run android:sync
```

**L'indirizzo dell'API e quello, con il suffisso.** Render assegna
`volleyvision-api.onrender.com` solo se e libero, e non lo era: quel nome
appartiene a un altro servizio, che risponde tranquillamente `{"service":
"SideOut"}`. Puntarci l'applicazione non darebbe un errore evidente, darebbe
risposte sbagliate da uno sconosciuto. L'indirizzo vero si legge dal bundle
del sito in esercizio, dove e compilato dentro.

**`android:sync` e non `build` + `cap sync` a mano.** In mezzo c'e un passo
che controlla due cose e ne corregge una, e nessuna delle due si vede
guardando l'APK finito:

1. **Rifiuta se il sito costruito contiene ancora `localhost:3001`.** Dentro
   l'APK quell'indirizzo e il telefono stesso: l'applicazione si apre, sembra
   sana, e ogni schermata e vuota con "il server non risponde". **E successo**,
   ed e successo a chi aveva scritto qui sotto l'avvertimento. Una nota in un
   documento la legge chi il problema lo conosce gia; il posto giusto per una
   regola e dove si viola.
2. **Toglie `dist/scarica` prima della copia.** `cap sync` copia *tutta*
   `dist` negli asset Android, e li dentro c'e l'APK da scaricare: senza quel
   passo ogni versione si porta dentro la precedente — la 1.1 conteneva i 6 MB
   di quella prima, la 1.2 gli 11 MB della 1.1 — e cresce a valanga senza che
   niente lo segnali, perche l'applicazione funziona lo stesso: e solo grossa.

Poi, con le variabili d'ambiente giuste:

```
JAVA_HOME="C:\Program Files\Android\Android Studio\jbr"
ANDROID_HOME="%LOCALAPPDATA%\Android\Sdk"
cd android && gradlew.bat clean assembleDebug
```

**`clean` non e prudenza.** La build incrementale impacchetta senza
comprimere: un APK di 16,7 MB il cui contenuto scompattato ne pesa 13,7 —
un archivio piu grande di cio che contiene. Da pulito lo stesso APK pesa
6,0 MB.

L'APK esce in `android/app/build/outputs/apk/debug/app-debug.apk`. Per
pubblicarlo sul sito:

```
node scripts/pubblica-apk.mjs
```

Copia il file in `apps/web/public/scarica/` **con la versione nel nome**
(`volley-vision-1.1.apk`) e rigenera `apps/web/src/apk.ts`, che il sito
importa per il collegamento e per il testo accanto al pulsante.

**La versione sta in un posto solo**, `android/app/build.gradle`. Scritta
anche altrove, prima o poi diverge — e il giorno che succede il sito annuncia
una versione e ne consegna un'altra, senza che niente lo segnali. Ricordarsi
di alzare `versionCode` a ogni pubblicazione: Android rifiuta di installare
sopra un codice piu alto.

Il nome versionato serve a chi ha scaricato la settimana prima: guardando il
file nella cartella Download non avrebbe altro modo di sapere se e l'ultimo.
Le versioni precedenti restano raggiungibili, cosi se una si rivela guasta su
un modello di telefono si torna indietro. **Il prezzo e la cronologia di
git**: una decina di megabyte per versione, per sempre. E la ragione per cui
prima o poi va spostato su una release di GitHub — a quel punto cambia solo
il `percorso` nel modulo generato.

**`VITE_API_URL` va passata a `android:sync`, che dentro fa il `build`.** Vite
la scrive dentro il JavaScript al momento della costruzione: e la stessa
trappola gia incontrata su Render (`20-installazione-render.md`). Un APK
costruito senza quella variabile cerchera `localhost:3001` sul telefono, dove
non c'e nulla.

Questo paragrafo esisteva gia quando l'errore e stato commesso — motivo per
cui adesso c'e anche un controllo che rifiuta, e non solo un avvertimento che
si puo non leggere. **La 1.2 e stata pubblicata cosi e non funziona: usare la
1.3 o successive.**

## Due scelte da conoscere

**Il service worker non gira nell'applicazione nativa.** I file sono gia nel
pacchetto installato: non c'e niente da conservare per l'uso senza rete. In
piu il guscio consegnerebbe file depositati al posto di quelli
dell'aggiornamento appena installato dallo store, e l'applicazione
resterebbe indietro senza che si capisca perche. Lo decide
`inAppNativa()` in `platform/installazione.ts`.

**Il traffico in chiaro e vietato** (`allowMixedContent: false`). L'API sta
su HTTPS, e permettere l'HTTP "per comodita in sviluppo" e il modo in cui
poi resta acceso.

## Cosa manca per pubblicarlo

| | |
|---|---|
| **Firma** | questo e un APK di *debug*: si installa a mano abilitando le origini sconosciute, ma nessuno store lo accetta. Serve un keystore, e va custodito: **perderlo significa non poter piu aggiornare l'applicazione** |
| **Account Google Play** | 25 $ una tantum, con tempi di revisione che non dipendono da noi |
| **Schermata d'avvio** | ancora quella predefinita di Capacitor. L'icona invece e la nostra: `scripts/icone-android.ps1` la ricava da `icona-512.png`, e va rieseguito solo se cambia il marchio |
| **Prova su un telefono vero** | **non fatta**: l'APK e valido e contiene tutto, ma non l'ha ancora aperto nessuno. Vale in particolare per registrazione e caricamento in secondo piano, che sul telefono possono comportarsi diversamente da come compilano |
| **Esenzione dal risparmio energetico** | su alcuni telefoni (Xiaomi, Huawei, certi Samsung) il servizio in primo piano viene ucciso lo stesso. Va chiesta all'utente, e non si puo dare per scontato che basti |

## Provarlo adesso

Sul telefono, abilitando l'installazione da origini sconosciute:

```
adb install app-debug.apk
```

oppure copiando il file sul telefono e aprendolo. Prima cosa da guardare:
**l'accesso**. Se fallisce, quasi sempre e `VITE_API_URL` non passata al
`build`.
