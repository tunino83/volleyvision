# Backend

NestJS + Prisma. `apps/api/src/`.

## Moduli

| Modulo | Responsabilita |
|---|---|
| `auth` | registrazione, accesso, token, reimpostazione, guardie |
| `admin` | utenti, ruoli, registro, reportistica |
| `persons` | anagrafica delle persone, rilevamento e unione duplicati |
| `teams` | squadre, roster, condivisione |
| `competitions` | campionati, condivisione |
| `matches` | partite, roster, formazioni, cambi, ciclo di vita |
| `uploads` | sessioni di caricamento, blocchi, riconciliazione |
| `notifications` | campanellina |

`common/` contiene servizi trasversali: Prisma, configurazione, filtro degli
errori, validazione, registro, email, controllo degli accessi.

## Come si aggiunge una rotta

1. Se servono nuovi dati, definisci lo schema in `packages/schema` — **non nel
   controller**: lo stesso schema vale nel client.
2. La logica va nel servizio; il controller resta sottile.
3. Valida con `new ZodPipe(Schema)`.
4. Proteggi con `@UseGuards(AuthGuard)` e, se serve, `RolesGuard` + `@Ruoli(...)`.
5. Per risorse dell'utente usa `AccessService`: non reimplementare i permessi.

## Controllo degli accessi

`common/access.service.ts`. Modello **proprieta + condivisione**, non licenze:
chi crea e proprietario e puo condividere in **sola lettura**. Non esistono
anagrafiche comuni.

Una partita e accessibile se lo e il suo campionato.

## Ciclo di vita della partita

`matches/lifecycle.service.ts`. Le transizioni ammesse sono dichiarate in una
tabella: un passaggio non previsto viene rifiutato, non ignorato.

`valutaAvvio()` porta la partita in coda quando **entrambi i video sono
caricati e la formazione del set 1 e completa per entrambe le squadre**. La
formazione e un dato di ingresso per l'analisi, non una comodita.

Da `RUNNING` in poi gli stati li imposta il fornitore: vedi intervento 1.

## Numero di set e roster incrementale

`PATCH /matches/:id/sets` registra quanti set ha avuto la partita (da 3 a 5).
La partita e gia stata giocata, quindi il numero si sa, e serve a decidere
quante formazioni chiedere. **Riducendolo si cancellano formazioni e
sostituzioni dei set che spariscono**: lasciarle sarebbe peggio, perche
resterebbero righe che nessuna schermata mostra piu.

`POST /matches/:id/players` aggiunge un giocatore per volta, dal selettore
delle formazioni. Rifiuta un numero di maglia gia assegnato nella stessa
squadra. Se non si indica una persona, **ne crea una**: senza identita stabile
non esistono statistiche fra partite diverse, quindi il collegamento non puo
restare vuoto. Con `salvaInSquadra` il giocatore entra anche nel roster della
squadra, cosi la volta dopo c'e gia.

`PATCH /matches/:id/players/:playerId` corregge un giocatore gia inserito e
`DELETE` lo rimuove. Due regole che stanno nel servizio e non nell'interfaccia,
perche valgono comunque:

- **Cambiando il numero, formazioni e cambi seguono.** Puntano al numero di
  maglia, non all'identificativo: senza propagazione resterebbero a indicare un
  giocatore che non esiste piu.
- **Non si rimuove chi e ancora in campo.** La risposta dice dove compare, set
  per set, cosi si sa cosa disfare prima.

## Caricamento

`uploads/`. Sessione, blocchi con offset, completamento con verifica della
dimensione. Se l'offset non corrisponde, la risposta dice **da dove riprendere**:
e cio che rende la ripresa possibile senza stato nel client.

**Aprire una sessione non ne distrugge una gia aperta**, se il file e lo stesso
(stesso nome, stessa dimensione): si riusa e si risponde `ripresa: true` con i
byte gia ricevuti. E la differenza fra riprendere un caricamento da 4 GB e
rifarlo. Se il file e diverso, la vecchia sessione e i suoi byte vengono
eliminati: tenerli significherebbe pagare spazio per un file che nessuno
completera.

`GET /matches/:id/videos/:lato/upload-session` restituisce la sessione aperta
senza crearla ne distruggerla. Serve alla schermata per proporre la ripresa
dopo che l'applicazione e stata chiusa — il caso normale sul mobile, dove il
caricamento avviene solo in primo piano.

Il driver di archiviazione e dietro un'interfaccia: vedi intervento 2.

## Cosa si puo fare, dato lo stato

`capacitaPartita(stato)` in `@vv/schema` e **l'unica dichiarazione** di quali
azioni sono possibili in quale stato. Il server la usa per rifiutare, il client
per non mostrare. Prima non esisteva e ogni schermata decideva per conto suo:
cosi una partita gia analizzata continuava a chiedere quanti set avesse avuto e
a offrire il caricamento dei video.

Il principio: **cio che e stato mandato all'analisi non si tocca piu.** Da
`PENDING` in avanti roster, formazioni e video sono i dati di ingresso di un
calcolo gia partito; cambiarli renderebbe i risultati non spiegabili.

| Stato | Roster, formazioni, video | Cambi | Statistiche |
|---|---|---|---|
| `WAITING` | si | si | no |
| `PENDING` `RUNNING` `READY_FOR_PP` | **no** | si | no |
| `READY` | **no** | si | si |
| `ERROR` | si (si corregge e si riprova) | si | no |

**Le sostituzioni fanno eccezione**: per progetto si registrano dopo, leggendo
il referto (docs/08, S-21). Non entrano nell'analisi, servono a sapere chi era
in campo.

Il rifiuto e `STATO_NON_CONSENTE` e porta con se il motivo, che la schermata
mostra invece di limitarsi a nascondere il comando.

**Il numero di set lo dice l'analisi quando c'e.** `dettaglio()` lo legge da
`pkg.sets.length` e segnala `setDaAnalisi`: chiederlo all'utente per una
partita gia analizzata era assurdo.

## Statistiche

Tre livelli, un solo motore (`packages/core`):

| Rotta | Cosa da |
|---|---|
| `GET /matches/:id/analysis/stats` | indicatori di squadra, ora **raggruppati per fondamentale** |
| `GET /matches/:id/analysis/players` | il tabellino: una riga per giocatore |
| `GET /matches/:id/analysis/players/:team/:jersey/:chiave` | gli eventi dietro una cella |
| `GET /stats/players` | **aggregato su piu partite**, per persona |

Le metriche che prima non calcolavamo pur avendone i dati: **attacchi murati**
(che NON sono errori — il fornitore distingue `Blocked` da `Error`, e mettere
insieme le due cose cancella l'informazione piu utile del fondamentale),
**efficienza vera** `(punto - errore - murato) / totale`, **punti realizzati**,
**ricezioni**, **difese** e i rispettivi errori.

`stagione.service.ts` aggrega su piu partite. Due avvertenze che non sono
dettagli:

1. **Si aggrega sulla PERSONA, non sul numero di maglia.** Il numero cambia fra
   squadre e stagioni. Chi non ha una persona collegata resta fuori, e il
   conteggio viene restituito perche la schermata lo dichiari.
2. **L'insieme va sempre dichiarato**: si restituisce quante partite sono state
   considerate e quali. Un numero senza il suo insieme viene letto come se
   valesse per tutto.

## Elenchi paginati

`GET /matches` risponde `{ elementi, totale, pagina, perPagina, pagine }`.
**Tutti i filtri stanno nella query**, compresi nome squadra e tag: filtrarli
dopo il taglio significherebbe non trovare mai cio che sta oltre la prima
pagina — ed e esattamente cio che faceva prima.

`perPagina` ha un tetto (`PAGINAZIONE.perPaginaMassimo`, 100). Senza, una
richiesta con `perPagina=1000000` scarica l'intero archivio.

Il tag e cercato dentro `tagJson` come stringa fra virgolette: i tag sono
elementi JSON, quindi `"casa"` non corrisponde mai a `"casalinga"`. Su
PostgreSQL diventera un contenimento su JSONB con indice.

## Manutenzione periodica

`uploads/manutenzione.service.ts` esegue la riconciliazione dei caricamenti
abbandonati: ogni ora, piu un giro trenta secondi dopo l'avvio. Un giro per
volta, e un errore non ferma il ciclo. **Con piu istanze va spostata fuori o
protetta da un lucchetto.**

## Errori

Sempre `{ code, message, details?, correlationId }`. Il codice di correlazione
compare all'utente e nei log del server. Nessuna stringa libera.
