# Installare su un server cPanel — guida

Scritta per un server **cPanel su Linux**. Le differenze rispetto a un VPS
normale non sono cosmetiche: cPanel decide i nomi dei database, come si avvia
un processo Node e quanto a lungo resta acceso. Ignorarle costa un pomeriggio.

## 0. Prima di cominciare: cPanel e adatto?

Onesta, perche cambia la fatica.

| | |
|---|---|
| **cPanel su VPS o dedicato** (hai root) | va bene |
| **cPanel condiviso** (niente root) | si puo, con i limiti qui sotto |

Su hosting condiviso pesano tre cose:

- **Lo spazio disco.** Un video e ~5 GB. Dieci partite sono 50 GB: molti piani
  condivisi ne offrono 20-100 in tutto. **E il limite che si tocca per primo.**
- **La memoria.** Le statistiche cross-partita interpretano i pacchetti a ogni
  richiesta; i piani condivisi limitano spesso a 512 MB-1 GB per processo.
- **I lavori periodici** (punto 7): il processo Node viene spento quando non
  arrivano richieste.

Se il piano e condiviso, e adatto a **provarlo con pochi utenti**, non a
tenerci i video di una stagione.

## 1. Cosa serve installato

| | Versione | Dove |
|---|---|---|
| **Node.js** | **20 o superiore** (`engines: node >=20`) | cPanel > *Setup Node.js App*, dal menu a tendina |
| **MySQL o MariaDB** | MySQL 8 / MariaDB 10.5+ | gia presente su ogni cPanel |
| **Accesso a un terminale** | — | cPanel > *Terminal*, oppure SSH abilitato dal fornitore |
| **Certificato HTTPS** | — | cPanel > *SSL/TLS Status* > **Run AutoSSL** |

**HTTPS non e opzionale**: senza, il service worker non si registra e
l'applicazione non si installa ne funziona senza rete.

Non serve nient'altro: niente Docker, niente nginx da configurare, niente
PM2. **Passenger, incluso in cPanel, avvia e sorveglia il processo Node.**

## 2. Il database — attenzione ai nomi

Su cPanel il database **non** si crea con `prisma/crea-database.js`: quello
script vuole un'utenza amministrativa che su cPanel non hai.

Si usa **cPanel > MySQL Databases**:

1. crea il database, es. `volleyvision`
2. crea l'utente, es. `vvapp`, con una password lunga
3. assegna l'utente al database con **ALL PRIVILEGES**

**cPanel antepone il nome dell'account a entrambi.** Se l'account e `mario`,
i nomi veri diventano `mario_volleyvision` e `mario_vvapp` — ed e questo che
va nell'indirizzo, non quello che hai digitato:

```
DATABASE_URL="mysql://mario_vvapp:LA_PASSWORD@127.0.0.1:3306/mario_volleyvision"
```

E l'errore piu comune di questa procedura.

Verifica la collation: deve finire per **`_ci`** (`utf8mb4_general_ci` o
`utf8mb4_unicode_ci`), cioe insensibile alle maiuscole. E cio che fa
funzionare le ricerche per cognome. cPanel di norma la imposta gia cosi.

## 3. Caricare il codice

Da **cPanel > Terminal**, oppure via SSH:

```
cd ~
git clone <il-repository> volleyvision
cd volleyvision
```

Senza git: comprimi la cartella **senza `node_modules` e senza `dist`**,
caricala con *File Manager* ed estraila.

> **Non caricare `node_modules` dal tuo computer.** Prisma usa un motore
> compilato **per un sistema operativo preciso**: quello di Windows non gira
> su Linux, e l'errore che ne esce non dice questo. Le dipendenze si
> installano sul server.

## 4. Preparare l'applicazione — **c'e uno script**

I passaggi 4 e 6 li fa `scripts/installa-server.sh`: dipendenze,
compilazione, client Prisma, tabelle, e la copia dell'interfaccia col suo
`.htaccess`.

```
bash scripts/installa-server.sh --web ~/public_html
```

**Prima controlla, poi costruisce**: se DATABASE_URL contiene ancora un
segnaposto, o se `JWT_SECRET` e rimasto quello di sviluppo, si ferma subito
invece di accorgersene dopo dieci minuti di `npm install`. Si puo rilanciare:
non cancella dati.

Cio che resta a mano e solo quello che sta nel pannello — creare il database
(punto 2) e l'applicazione Node (punto 5).

Il resto di questo paragrafo descrive gli stessi passaggi uno per uno, per
chi preferisce farli a mano o per capire cosa sta succedendo.

```
npm install
npm run build:packages
npm run build --workspace @vv/api
npm run build --workspace @vv/web
```

Poi la configurazione, in `apps/api/.env`:

```
DATABASE_URL="mysql://mario_vvapp:PASSWORD@127.0.0.1:3306/mario_volleyvision"
JWT_SECRET="<stringa lunga e casuale, diversa da quella di sviluppo>"
WEB_URL="https://iltuodominio.it"
STORAGE_LOCAL_DIR="/home/mario/volleyvision-video"
RICONCILIAZIONE_INTERVALLO_MIN=0
```

`JWT_SECRET` **va cambiato**: il valore predefinito e `sviluppo-non-sicuro`,
ed e scritto nel codice sorgente. Chi lo conosce puo firmarsi da solo un
accesso da amministratore.

Infine le tabelle:

```
cd apps/api
npx prisma generate
npx prisma migrate deploy
```

`migrate deploy` esegue `prisma/migrations/20260901000000_inizio/migration.sql`,
che e **gia nel repository**: 21 tabelle e 28 chiavi esterne. Non devi
scrivere ne cercare nessuno script SQL, e **il database non si popola da
solo**: crea le tabelle vuote.

Per avere le utenze di prova: `npm run db:seed` (solo in prova, mai in
esercizio: crea utenti con password note).

## 5. Avviare l'API — Setup Node.js App

cPanel > **Setup Node.js App** > *Create Application*:

| Campo | Valore |
|---|---|
| Node.js version | **20** o superiore |
| Application mode | Production |
| Application root | `volleyvision` |
| Application URL | il dominio, oppure un sottodominio dedicato |
| Application startup file | `apps/api/dist/src/main.js` |

**La radice e il monorepo, non `apps/api`.** Le dipendenze sono raccolte nel
`node_modules` in cima (npm workspaces): puntando a `apps/api` come radice,
cPanel installerebbe nel posto sbagliato e l'avvio fallirebbe.

Poi **Restart**.

> Passenger assegna lui la porta e la passa in `PORT`. L'applicazione la legge
> gia (`apps/api/src/main.ts`): non c'e niente da cambiare.

## 6. Servire l'interfaccia e collegarla all'API

Le rotte dell'API cominciano tutte con **`/api`** (`setGlobalPrefix("api")`).
Due modi, e il primo e piu semplice.

### A. Sottodominio per l'API — consigliato

- l'applicazione Node su `api.iltuodominio.it`
- il contenuto di `apps/web/dist` dentro `public_html`
- **prima** di costruire il web: `VITE_API_URL="https://api.iltuodominio.it"`

### B. Stesso dominio, API sotto `/api`

Piu ordinato per l'utente e **fa sparire la questione CORS**, ma va detto a
Passenger di gestire `/api` lasciando il resto ai file statici.

In entrambi i casi `public_html/.htaccess` deve mandare **tutti i percorsi
sconosciuti a `index.html`**: altrimenti ricaricare la pagina su
`/partite/123` da 404, perche quel file non esiste — le rotte le disegna
React nel browser.

```apache
<IfModule mod_rewrite.c>
  RewriteEngine On
  RewriteBase /

  # L'API non si tocca.
  RewriteRule ^api/ - [L]

  # File e cartelle che esistono davvero: si servono.
  RewriteCond %{REQUEST_FILENAME} -f [OR]
  RewriteCond %{REQUEST_FILENAME} -d
  RewriteRule ^ - [L]

  # Tutto il resto e una rotta dell'applicazione.
  RewriteRule . /index.html [L]
</IfModule>

# Il guscio non va mai conservato: se lo fosse, gli aggiornamenti
# arriverebbero agli utenti con giorni di ritardo.
<Files "sw.js">
  Header set Cache-Control "no-cache, must-revalidate"
</Files>
```

## 7. La trappola: i lavori periodici si fermano

**Passenger spegne l'applicazione quando non arrivano richieste.** Dentro il
processo Node girano due lavori a tempo — la riconciliazione dei caricamenti
abbandonati e l'interrogazione del fornitore — e con l'applicazione spenta
**non girano**.

Non e un difetto da correggere: e come funziona questo tipo di hosting. Si
spostano nel cron di cPanel.

Nel `.env`, `RICONCILIAZIONE_INTERVALLO_MIN=0` li disattiva dentro il
processo. Poi cPanel > **Cron Jobs**, ogni ora:

```
curl -s https://iltuodominio.it/api/health > /dev/null
```

Questa riga da sola tiene sveglia l'applicazione. Per far girare davvero la
riconciliazione servira una rotta dedicata che il cron possa chiamare:
**non c'e ancora**, va aggiunta a `05-interventi.md`.

## 8. Cosa manca perche sia davvero in esercizio

Non e questione di installazione: sono cose che **il codice non fa ancora**.

| | |
|---|---|
| **Invio email** | `MAIL_DRIVER=console` **stampa e basta**. Senza, nessuno verifica l'indirizzo ne recupera la password. cPanel ha un server di posta: serve il driver SMTP, ~mezza giornata |
| **Storage dei video** | oggi scrive su disco locale. Su cPanel funziona, ma lo spazio e quello del piano |
| **Freno ai tentativi di accesso** | la tabella `TentativoAccesso` c'e, la logica no |
| **Rotta per la riconciliazione da cron** | vedi punto 7 |

**L'invio email e bloccante** per un esercizio vero con utenti che si
registrano da soli.

## 9. Verifica finale

Nell'ordine, e ognuna dice una cosa diversa.

```
curl https://iltuodominio.it/api/health
```
Deve dare `{"ok":true}`: l'API e viva e Passenger la avvia.

```
curl https://iltuodominio.it/api/version
```
Deve dare versione e funzioni attive: legge la configurazione.

Poi dal browser:

1. apri `https://iltuodominio.it` — deve comparire la schermata di accesso
2. registra un utente — se l'email non arriva, e il punto 8
3. **F12 > Application > Service Workers**: deve dire *activated and running*
4. spunta **Offline** in *Network* e ricarica: l'applicazione deve aprirsi
5. compare l'icona di installazione nella barra degli indirizzi

Se il punto 3 fallisce, il certificato non e attivo oppure `sw.js` non viene
servito dalla radice del dominio.
