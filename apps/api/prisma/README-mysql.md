# Passaggio a MySQL / MariaDB

Il database non e piu SQLite. Questa e la procedura, in ordine.

## Perche MySQL e non PostgreSQL

Una ragione di sostanza e una pratica.

**Le ricerche restano insensibili alle maiuscole.** Le collation predefinite
di MySQL (`utf8mb4_..._ci`) si comportano come SQLite: i cinque `contains`
dell'applicazione — persone, partite, amministrazione — continuano a
funzionare senza toccarli. Su PostgreSQL `LIKE` distingue le maiuscole, e
`cerca "bianchi"` non troverebbe piu "Bianchi": servirebbe
`mode: "insensitive"` su ogni singola query, e **il difetto non darebbe
errore** — semplicemente non troverebbe niente.

**Su Plesk c'e gia**, mentre PostgreSQL e un componente opzionale spesso non
installato.

Nessuno dei vantaggi veri di PostgreSQL — JSONB con indici, tipi array,
indici parziali — e usato da questo schema.

## Il prezzo: le annotazioni `@db.`

Su MySQL, Prisma mappa `String` a **VARCHAR(191)**. Su PostgreSQL sarebbe
`text`, illimitato.

Il `pacchettoJson` piu grande misurato e di **184.082 caratteri**. Senza
annotazione esplicita **non entra nella colonna** — e non lo si scopre in
migrazione, ma in esercizio, al primo pacchetto vero.

Sono annotati: `pacchettoJson` (`@db.LongText`), `dati` della fotografia
(`@db.LongBlob`), e come `@db.Text` tutti i campi di testo libero o JSON:
`qualitaJson`, `profiloJson`, `tagJson`, `descrizione`, `messaggio`,
`erroreMessaggio`, `agente`, `sospesoMotivo`, `arbitri`.

**Regola per il futuro:** ogni nuovo campo che contiene testo scritto da un
utente o JSON vuole `@db.Text`; se puo superare i 64 KB, `@db.LongText`.

## Procedura

### 1. Esporta i dati esistenti — **prima di ogni altra cosa**

Va fatto mentre lo schema e ancora quello vecchio:

```
node prisma/travaso.js esporta
```

Scrive `prisma/travaso.json`. Se questo passaggio non e stato fatto prima di
cambiare provider, i dati si recuperano solo dalla copia di `dev.db`.

### 2. Crea il database

```
node prisma/crea-database.js --porta 3306 --utente root
```

Chiede la password dell'amministratore e quella da dare all'utenza
applicativa, **senza mostrarle a schermo e senza passarle sulla riga di
comando** (gli argomenti di un processo sono leggibili da chiunque sulla
macchina). Alla fine stampa la riga da mettere nel `.env`.

Opzioni: `--host`, `--porta`, `--utente`, `--db`, `--client` (percorso di
`mysql.exe`, se non viene trovato da solo).

In alternativa, a mano:

```
mysql -h 127.0.0.1 -P 3306 -u root -p < prisma/crea-database.sql
```

— ma prima cambia la password segnaposto dentro il file.

### 3. Punta l'applicazione al nuovo database

In `apps/api/.env`:

```
DATABASE_URL="mysql://volleyvision:LA_PASSWORD@127.0.0.1:3306/volleyvision"
```

### 4. Crea le tabelle

```
npx prisma migrate deploy
```

La migrazione iniziale **e gia scritta**, in
`prisma/migrations/20260901000000_inizio/migration.sql`: 21 tabelle, 28
chiavi esterne, 16 KB di SQL. E stata generata dallo schema con
`prisma migrate diff`, che non ha bisogno di un database per girare — quindi
non e stata provata su un server vero, ma non e scritta a mano.

**Da qui in poi si usano le migrazioni, non piu `db push`.** Ogni modifica
allo schema produce un file nuovo con `npx prisma migrate dev --name <cosa>`,
che si versiona insieme al codice.

#### Se preferisci eseguirlo a mano

Il file e SQL normale: si puo dare in pasto a `mysql` direttamente.

```
mysql -h 127.0.0.1 -P 3306 -u UTENTE -p NOME_DB   < prisma/migrations/20260901000000_inizio/migration.sql
```

**Ma poi Prisma non sa che l'hai fatto**, e al primo `migrate deploy`
proverebbe a rifare tutto. Se scegli questa strada, dichiaralo:

```
npx prisma migrate resolve --applied 20260901000000_inizio
```

Preferibile la strada normale: `migrate deploy` fa entrambe le cose.

### 5. Rimetti dentro i dati

```
node prisma/travaso.js importa
```

Stampa quante righe sono entrate per tabella: **vanno confrontate con i
conteggi dell'esportazione**. Le righe rifiutate sono elencate una per una
con il motivo, invece di far fallire tutto.

## Note

**Su Plesk avrai MariaDB, non MySQL.** Lo stesso connettore Prisma serve
entrambi, ma non sono identici: collauda sulla versione che gira in
esercizio, non su quella che hai sul portatile.

**`utf8mb4`, mai `utf8`.** Il vecchio `utf8` di MySQL e a tre byte e non tiene
le emoji ne diversi caratteri: i nomi scritti dagli utenti prima o poi li
conterranno. Lo script lo imposta gia.

**La password dell'utenza applicativa finisce nel `.env`.** Quel file non va
committato, e in esercizio ne serve una diversa da quella di sviluppo.
