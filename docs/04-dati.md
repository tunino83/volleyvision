# Modello dati

`apps/api/prisma/schema.prisma`. Quindici entita.

## Due mondi separati

- **Dati di piattaforma** — utenti, squadre, campionati, partite, roster,
  formazioni, tag. Li crea l'utente, stanno nel database, sono nostri.
- **Dati di analisi** — eventi e posizioni. Li produce il fornitore, sono
  immutabili, arrivano nel pacchetto partita. **Non ancora presenti**: il
  formato canonico e definito in `packages/schema/src/analysis.ts`.

## Entita

```
User ──< Token
     ──< Person ──< TeamPlayer >── Team ──< TeamShare
                ──< MatchPlayer      │
                                     ├──< Match ──< Lineup
Competition ──< Match                │         ──< Substitution
            ──< CompetitionShare     │         ──< Video ──── UploadSession
                                     │         ──< Notification
AuditLog
```

## Scelte da conoscere

**La persona e un'entita nostra.** Il modello del fornitore identifica i
giocatori per numero di maglia, valido solo dentro una partita. Senza
un'identita stabile, "42 attacchi in stagione" non e calcolabile. `Person` e
collegata da `TeamPlayer` e `MatchPlayer`; il collegamento e facoltativo, e
l'interfaccia avvisa quando manca.

**`MatchPlayer` e una copia, non un riferimento.** Se la squadra cambia i numeri
a stagione in corso, le partite passate non devono cambiare.

**Il giocatore aggiunto dal selettore delle formazioni ottiene sempre una
persona**, creata sul momento se non se ne indica una. E l'unico punto in cui il
collegamento non e facoltativo: e li che nasce la maggior parte dei giocatori, e
lasciarlo vuoto significherebbe scoprire mesi dopo che le statistiche di
stagione non tornano.

**`Match.numeroSet` lo dichiara l'utente**, non il fornitore: la partita e gia
stata giocata quando la si carica. Serve a sapere quante formazioni chiedere.
Resta nullo finche non lo si dichiara, e nessuna formazione oltre quel numero
sopravvive a una riduzione.

**I byte sono `BigInt`.** Un video da 5 GB non sta in un intero a 32 bit. La
serializzazione a numero avviene in `main.ts`: sicura fino a 9 PB.

**`tagJson` e testo.** Su PostgreSQL diventera `JSONB` con indice. I tag non
sono strutturati per scelta.

**`AuditLog` e in sola aggiunta.** Nessuna funzione di modifica o cancellazione.

## Modificare lo schema

```bash
# modifica prisma/schema.prisma, poi:
npm run db:push       # sviluppo: allinea il database
npm run db:seed       # ricarica i dati di esempio
```

Fermare l'API prima di rigenerare: il processo in esecuzione blocca il motore.

In esercizio serviranno migrazioni versionate (`prisma migrate`), non `db:push`.
