# Utenti e accesso

## Come si entra: entrambe le strade

**Ci si registra da soli.** Chi arriva sul sito si iscrive, riceve l'email di
verifica, entra. E la strada normale: l'obiettivo non e servire una societa
sportiva ma un appassionato qualsiasi, e mettere un amministratore fra lui e
l'applicazione non avrebbe senso.

**Oppure l'amministratore crea l'utenza.** Serve nei casi in cui le
registrazioni sono chiuse, o quando si vuole assegnare subito un ruolo. Chi
viene creato riceve un collegamento e sceglie da se la password.

Quale delle due valga lo dice una variabile, non il codice:

```
REGISTRAZIONE=aperta    # predefinito: chiunque si registra
REGISTRAZIONE=invito    # solo utenze create dall'amministratore
```

In modalita `invito` la registrazione risponde `REGISTRAZIONE_CHIUSA` e la
schermata lo dice. Risolve il punto aperto 7 di `../docs/01` **senza scegliere
al posto del cliente**.

> **Nessuno, in nessun ruolo, puo impostare la password di un altro.** Non
> esiste una funzione che lo faccia. L'amministratore manda un collegamento;
> la password la sceglie l'interessato. E il motivo per cui il modulo di
> creazione utenza non ha un campo password.

## Il modello: utente e identita

```
User  ──<  AuthIdentity
             provider        password | google | apple
             providerUserId  identificativo presso il provider
             passwordHash    solo per `password`
```

**La password non sta sull'utente**: sta su una delle sue identita. Un utente
ne ha una o piu. Chi entra con Google e **lo stesso utente** che entrava con la
password, non un secondo account.

E la differenza fra aggiungere un provider in mezza giornata e riscrivere
l'autenticazione. Finche la password e una colonna di `User`, il secondo
provider non ha dove stare.

## Aggiungere "Accedi con Google"

Il punto d'innesto e **uno solo**: `IdentitaService.accediConProvider()`.
Un provider nuovo si riduce a ottenere `{ providerUserId, email, nome, cognome }`
e chiamare quel metodo. Lo scheletro commentato, con l'elenco preciso di cosa
manca, e in `apps/api/src/auth/provider/google.ts`.

Il metodo tratta tre casi, e **l'ordine conta**:

1. **L'identita esiste gia** → e lui, si entra.
2. **Esiste un utente con quella email** → si collega l'identita all'utente che
   c'e gia. Senza questo passaggio, chi si era registrato con la password e poi
   entra con Google si troverebbe un account vuoto e crederebbe di aver perso
   le sue partite.
3. **Nessuno dei due** → si crea l'utente, se le registrazioni sono aperte.

Sulle shell non web il giro OAuth non puo avvenire in una vista incorporata —
Google la rifiuta — e va aperto il browser di sistema con ritorno su uno schema
dedicato. E il motivo per cui il provider sta dietro il livello di astrazione
delle piattaforme e non dentro un componente.

## Cosa c'e, schermata per schermata

| Dove | Cosa si fa |
|---|---|
| `/registrazione` | iscrizione, se le registrazioni sono aperte |
| `/verifica-email` | si apre dal collegamento ricevuto; token valido 24 ore |
| `/password/dimenticata` | si chiede il collegamento; risposta **identica** che l'account esista o no |
| `/password/reset` | si sceglie la password: vale sia per il reimposto sia per il primo accesso da invito |
| `/profilo` | i propri dati, cambio password, **elenco dei modi di accesso** |
| `/admin` → Utenti | elenco, ricerca, crea, correggi, ruolo, sospendi, reimposta, elimina |

Il profilo mostra i modi di accesso perche e li che comparira "Collega Google":
una riga in piu in quella tabella, non una schermata nuova.

## Le regole che non si negoziano

1. **Non si rivela mai se un indirizzo esiste.** Registrazione e "password
   dimenticata" rispondono allo stesso modo in ogni caso.
2. **L'ultima identita non si scollega.** Si resterebbe fuori dal proprio
   account senza modo di rientrare.
3. **Cambiare password chiude le altre sessioni.** Se la password e stata
   scoperta, cambiarla deve bastare.
4. **Cambiare password da dentro richiede quella attuale.** Senza, chi trovasse
   una sessione aperta si approprierebbe dell'account per sempre.
5. **Il token di invito vale 7 giorni**, quello di reimposto 60 minuti, quello
   di verifica 24 ore. Usati una volta sola.
6. **Accettare l'invito verifica anche l'indirizzo**: chi apre quel
   collegamento ha appena dimostrato di leggere quella casella.

## Ruoli

| Ruolo | Puo |
|---|---|
| `utente` | i propri contenuti e quelli condivisi con lui |
| `segreteria` | gestire utenti, ruoli, reimposto. **Nessun accesso ai contenuti** |
| `admin` | come sopra, piu registro operazioni, reportistica, eliminazione utenze |

I ruoli non si cambiano dal proprio profilo: solo dall'amministrazione.

## Migrazione gia fatta

Il passaggio da `User.passwordHash` a `AuthIdentity` e avvenuto **senza perdere
le password**, con `apps/api/prisma/migra-identita.js` in tre passi: leggi,
`db push`, scrivi. Lo script resta come ricetta.

> **Attenzione**, pagata sul campo: su SQLite togliere una colonna **ricrea la
> tabella**, e le chiavi esterne portano via a cascata tutto cio che appartiene
> a quelle righe. Le password erano salve, i contenuti no. Prima di
> `--accept-data-loss`, **copiare `dev.db`**. In esercizio non si usa `db push`
> ma una migrazione versionata che crea, copia e poi elimina, in transazione.
