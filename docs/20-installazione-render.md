# Installare su Render — guida

Scritta per **Render** (render.com). Rispetto a cPanel (`19-installazione-cpanel.md`)
il modello e diverso: non un pannello con Passenger, ma servizi separati che
Render costruisce da un repository Git e tiene in esecuzione lui.

## 0. La differenza che semplifica tutto: niente Passenger

Su cPanel il processo si addormentava senza traffico, e i lavori periodici
dentro l'API (riconciliazione, interrogazione del fornitore) si fermavano con
lui — serviva spostarli nel cron del pannello.

**Su Render il servizio web resta acceso** (sul piano gratuito si addormenta
dopo 15 minuti di inattivita e si risveglia alla richiesta successiva, con
qualche secondo di latenza: diverso da Passenger, che si spegne molto piu
spesso). I timer interni (`RICONCILIAZIONE_INTERVALLO_MIN`,
`LAVORAZIONE_INTERVALLO_SEC`) girano dentro lo stesso processo Node e
**funzionano senza altro lavoro**: non serve nessun cron esterno.

## 1. C'e un file che fa quasi tutto: `render.yaml`

E nella radice del repository. Su Render:

1. **New > Blueprint**
2. si sceglie il repository `tunino83/volleyvision`
3. Render legge `render.yaml` e propone di creare **tre risorse**: il
   database Postgres, il servizio API, il sito statico dell'interfaccia
4. si conferma

**Non serve compilare a mano i campi del pannello** che il file gia descrive.
Restano pero delle variabili segnate `sync: false` nel file: sono segreti o
indirizzi che non esistono ancora quando lo si legge, e vanno impostate a
mano — vedi il punto 3.

Se si preferisce non usare il Blueprint, lo stesso file e anche una
descrizione leggibile di cosa creare a mano, servizio per servizio.

## 2. Le tre risorse

| | Tipo Render | Cosa fa |
|---|---|---|
| `volleyvision-db` | PostgreSQL gestito | il database |
| `volleyvision-api` | Web Service (Node) | l'API NestJS |
| `volleyvision-web` | Static Site | l'interfaccia React costruita |

### L'API

```
buildCommand: npm install && (cd apps/api && npx prisma generate) && npm run build:packages && npm run build --workspace @vv/api
startCommand: npm run start --workspace @vv/api
```

**La radice resta quella del monorepo**, non `apps/api`: i pacchetti
condivisi (`@vv/schema`, `@vv/core`) si risolvono da li tramite gli npm
workspaces. E lo stesso principio della guida cPanel — puntare la radice
dentro `apps/api` fa fallire l'avvio con un pacchetto non trovato.

**`prisma generate` viene PRIMA di `nest build`, non dopo.** Il primo
tentativo aveva l'ordine invertito, e Render lo ha rifiutato con decine di
errori TypeScript ("implicitly has an 'any' type") sparsi in tutti i
servizi che interrogano il database: senza il client Prisma generato,
ogni risultato di query e tipizzato `any`, e la build fallisce. Riprodotto
in locale rimuovendo il client generato: build fallita con lo stesso schema
di errori; rigenerato il client prima della build, build pulita.

`healthCheckPath: /api/health` dice a Render come verificare che il servizio
sia vivo prima di instradargli traffico.

**Le migrazioni girano nello `startCommand`, non nel build**, perche durante
il build Render non garantisce l'accesso al database. Al primo deploy questo
era stato dimenticato del tutto: il servizio risultava sano — `/api/health`
rispondeva `{"ok":true}` perche non tocca il database — ma **qualunque
rotta che legge dati rispondeva 500**, con le tabelle inesistenti. Sintomo
ingannevole: il servizio sembra funzionare finche non ci si prova a entrare.

### L'interfaccia

```
buildCommand: npm install && npm run build:packages && npm run build --workspace @vv/web
staticPublishPath: apps/web/dist
```

E un sito statico: non gira un processo Node, sono file serviti da una CDN.
Le due regole in `render.yaml` — la riscrittura delle rotte e l'intestazione
sul guscio — sono le stesse della guida cPanel, tradotte nella sintassi che
Render usa al posto di `.htaccess`.

## 3. Cosa va impostato a mano, e perche

### `WEB_URL` (sul servizio API)

Render assegna l'indirizzo del sito statico solo dopo averlo creato: non
esiste ancora quando si legge `render.yaml` la prima volta. Dopo il primo
deploy di entrambi:

1. copia l'indirizzo di `volleyvision-web` (tipo `https://volleyvision-web.onrender.com`)
2. Dashboard di `volleyvision-api` > **Environment** > `WEB_URL` > incollalo
3. salva: l'API si riavvia da sola con il valore nuovo

### `VITE_API_URL` (sul sito statico) — **attenzione al momento**

Questa e la trappola vera, e diversa da qualunque cosa vista su cPanel.

**Vite la legge a tempo di build, non a runtime.** Cambiarla dopo il deploy
**non ha alcun effetto** finche non si ricostruisce il sito: non basta
riavviare come per una variabile normale.

Procedura corretta:

1. crea prima `volleyvision-api`, copia il suo indirizzo
   (`https://volleyvision-api.onrender.com`)
2. su `volleyvision-web` > **Environment** > `VITE_API_URL` > incollalo
3. **Manual Deploy > Clear build cache & deploy**, non un semplice riavvio

Se il sito e gia stato costruito prima di impostare la variabile, restera a
parlare con `http://localhost:3001` — l'indirizzo di sviluppo — finche non lo
si ricostruisce.

**E successo davvero al primo deploy.** Il sintomo: la pagina si apre ma
l'accesso non funziona, e negli strumenti per sviluppatori (F12 > Network) la
richiesta di login mostra `Request URL: http://localhost:3001/api/auth/login`
con `Origin: https://volleyvision-web.onrender.com`. Il browser sta chiedendo
a se stesso un indirizzo che esiste solo sul computer di chi sviluppa.

Non serve toccare il codice: e solo la variabile mancante al momento del
build. Impostala e **ricostruisci** — un riavvio non basta.

### `JWT_SECRET`

Il blueprint lo genera da solo (`generateValue: true`): **non e** il valore
predefinito `sviluppo-non-sicuro` scritto nel codice, che chiunque potrebbe
leggere e usare per firmarsi un accesso da amministratore. Non c'e nulla da
fare qui, ma va saputo che e cosi: se lo si rigenera a mano, tutte le sessioni
attive decadono.

## 4. Il limite serio del piano gratuito: **i video non sopravvivono**

Il filesystem di un servizio Render **e effimero per difetto**: a ogni
riavvio o nuovo deploy, quello che e stato scritto su disco sparisce.

**`render.yaml` non dichiara un disco persistente**, deliberatamente: Render
rifiuta l'intero Blueprint se un servizio sul piano `free` dichiara un
`disk:`, quindi la riga non puo nemmeno starci finche si resta su quel piano.
I video caricati **vengono persi al primo riavvio o deploy successivo** — il
file contiene, commentato, il blocco da aggiungere se si passa a un piano a
pagamento che lo supporta.

Non e un difetto della configurazione: e un limite del piano. Le strade,
in ordine di sforzo:

| | Costo | Nota |
|---|---|---|
| **Passare a un piano con disco persistente** | a pagamento | la soluzione piu diretta, nessuna modifica al codice |
| **Storage esterno** (S3, Google Cloud Storage) | a consumo, di solito pochi euro/mese | il punto 4 del `CLAUDE.md` lo prevede gia: `uploads/storage.ts` e pensato per un secondo driver, ma **quel driver non e ancora scritto** |
| **Provare senza caricare video veri** | gratis | va bene per collaudare tutto il resto — accesso, squadre, statistiche sui dati sintetici |

**Per un esercizio vero con caricamento video, il piano gratuito di Render
non basta.** E la stessa cautela gia scritta per l'hosting condiviso su
cPanel, qui piu stringente perche il gratuito non ha nemmeno l'opzione del
disco a pagamento minimo.

## 5. Cosa manca perche sia davvero in esercizio

Le stesse voci della guida cPanel, perche sono limiti del codice e non
dell'hosting:

| | |
|---|---|
| **Invio email** | `MAIL_DRIVER=console` stampa nei log di Render e basta. Senza, nessuno verifica l'indirizzo ne recupera la password |
| **Storage dei video** | vedi punto 4: oggi solo locale, e su Render il piano gratuito non lo conserva |
| **Freno ai tentativi di accesso** | la tabella `TentativoAccesso` c'e, la logica no |

**L'invio email resta bloccante** per un esercizio con utenti che si
registrano da soli, qui come su cPanel.

## 6. Verifica finale

```
curl https://volleyvision-api.onrender.com/api/health
```
Deve dare `{"ok":true}`.

```
curl https://volleyvision-api.onrender.com/api/version
```
Deve dare versione e funzioni attive.

Poi dal browser, su `https://volleyvision-web.onrender.com`:

1. deve comparire la schermata di accesso — se non compare, o le richieste
   falliscono, quasi sempre e `VITE_API_URL` non ricostruita (punto 3)
2. registra un utente — se l'email non arriva, e il punto 5
3. **F12 > Application > Service Workers**: deve dire *activated and running*
   (Render fornisce HTTPS di serie, quindi questo passaggio non ha il
   problema del certificato visto su cPanel)
4. spunta **Offline** in *Network* e ricarica: l'applicazione deve aprirsi
5. compare l'icona di installazione nella barra degli indirizzi

## 7. Dati dimostrativi

Dalla shell di Render (Dashboard di `volleyvision-api` > **Shell**) o da un
terminale locale puntato allo stesso `DATABASE_URL`:

```
cd apps/api && npx tsx prisma/seed-demo.ts
```

Crea 5 utenti, 30 squadre, 15 partite — vedi la spiegazione nel file stesso
per i dettagli.
