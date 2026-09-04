# L'applicazione Android

**Stato: l'APK si costruisce e contiene l'applicazione. Non e stato provato
su un telefono.**

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

## Cosa NON c'e, e non e una dimenticanza

**La riproduzione video.** E la decisione 9b: un video pesa 5 GB e nessuno lo
tiene sul telefono. Il telefono riprende e carica; si guarda dal computer.

**La registrazione con la griglia di inquadratura.** E l'**unica funzione
davvero nativa** prevista dal piano, ed e quella che giustifica un guscio
invece della sola applicazione web. **Non e ancora scritta.** Questo guscio
la ospitera senza cambiare nient'altro: servira il permesso della
fotocamera nel manifesto e un plugin di registrazione.

Detto altrimenti: **questo APK oggi non fa niente che il browser del
telefono non farebbe.** Ha comunque senso — si installa da uno store, ha la
sua icona, non dipende dal browser — ma la ragione forte per averlo arrivera
con la registrazione.

## Costruirlo

Serve il JDK di Android Studio e l'SDK Android. Su questa macchina ci sono
gia entrambi.

```
cd apps/web
VITE_API_URL="https://IL-TUO-DOMINIO-API" npm run build
npx cap sync android
```

Poi, con le variabili d'ambiente giuste:

```
JAVA_HOME="C:\Program Files\Android\Android Studio\jbr"
ANDROID_HOME="%LOCALAPPDATA%\Android\Sdk"
cd android && gradlew.bat assembleDebug
```

L'APK esce in `android/app/build/outputs/apk/debug/app-debug.apk`.

**`VITE_API_URL` va passata al `build`, non al `sync`.** Vite la scrive
dentro il JavaScript al momento della costruzione: e la stessa trappola gia
incontrata su Render (`20-installazione-render.md`). Un APK costruito senza
quella variabile cerchera `localhost:3001` sul telefono, dove non c'e nulla,
e l'accesso non funzionera.

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
| **Icona e schermata d'avvio** | ora sono quelle predefinite di Capacitor, col logo generico |
| **Prova su un telefono vero** | **non fatta**: l'APK e valido e contiene l'applicazione, ma non l'ha ancora aperto nessuno |

## Provarlo adesso

Sul telefono, abilitando l'installazione da origini sconosciute:

```
adb install app-debug.apk
```

oppure copiando il file sul telefono e aprendolo. Prima cosa da guardare:
**l'accesso**. Se fallisce, quasi sempre e `VITE_API_URL` non passata al
`build`.
