# Dati di prova

Cinque partite sintetiche nel **formato del fornitore**, generate da
`packages/mock`. Servono a collaudare l'intera catena — adattatore,
acquisizione, metriche, schermate — senza dipendere dal fornitore.

```bash
npm run genera:dati        # riscrive dati-di-prova/
```

Deterministiche: stesso seme, stessi file. I test devono poter riprodurre.

## I cinque insiemi

| Cartella | Partita | Parziali | Che cosa mette alla prova |
|---|---|---|---|
| `pulita` | ITA-FRA | 25-20 / 23-25 / 25-22 | **Il riferimento.** Quasi nessun difetto: se qualcosa non torna qui, il problema e nostro |
| `realistica` | POL-BRA | 22-25 / 25-19 / 25-23 | Il profilo di difetti osservato nella partita vera |
| `cinque-set` | USA-SLO | 25-23 / 19-25 / 25-21 / 21-25 / **15-13** | Partita lunga e tie-break: il conteggio non deve presumere il 25 |
| `degradata` | ARG-NED | 5 set, due ai vantaggi | Rilevamento scarso e **nessuna posizione**: degrado con garbo |
| `limiti` | SRB-JPN | **32-30** / 25-15 / **34-36** | Vantaggi prolungati, numero di maglia 0, scambi senza tocchi rilevati |

Ogni cartella contiene `events.json`, `videos.json` e — tranne `degradata` —
`frames.json`. In `indice.json` ci sono i valori attesi, che sono la base delle
asserzioni.

## I difetti sono voluti

Non sono inventati: riproducono quelli osservati nei primi dati reali
(`07-dati-fornitore.md`). Costruire l'applicazione su dati perfetti
significherebbe costruire l'applicazione sbagliata.

| Difetto | pulita | realistica | cinque-set | degradata | limiti |
|---|---|---|---|---|---|
| Eventi senza giocatore riconosciuto | 1% | **15%** | 6% | **35%** | 8% |
| Tocchi non rilevati | 2% | 25% | 10% | **45%** | 30% |
| Azioni attribuite al set sbagliato | 0 | 4 per set | 2 per set | **6 per set** | 1 per set |
| Doppia marcatura dell'esito | 2% | 10% | 2% | 15% | 5% |
| Posizioni inutilizzabili | 1% | 2% | 1% | — | 6% |
| File delle posizioni | si | si | si | **assente** | si |

I numeri di maglia segnaposto sono gli stessi trovati nei dati veri: 100, 1000,
1001, 1002, -6, piu eventi con numero nullo.

## Verosimiglianza pallavolistica

Gli scambi non sono rumore: hanno la struttura giusta — battuta, ricezione,
alzata, attacco, difesa e contrattacco fino alla chiusura — e le proporzioni
seguono la pallavolo vera.

Come si chiude uno scambio: attacco vincente 62%, errore d'attacco 20%, muro
10%, ace o errore in battuta 8%. Ne risultano circa **tre attacchi punto per
ogni errore**, efficacia d'attacco fra il 15% e il 30%, e punteggi che tornano
esattamente con i parziali dichiarati.

Le posizioni sono generate **in metri** sulle sei posizioni regolamentari e poi
proiettate all'indietro in pixel con l'omografia dei dati reali: il percorso di
andata e ritorno attraverso l'adattatore restituisce coordinate corrette.

## La verifica

```bash
npx tsx src/analysis/__prove__/adattatore.prova.ts      # da apps/api
```

Nove asserzioni per insieme, quarantacinque in tutto:

- i set riconosciuti sono quelli attesi
- nessuna azione va persa
- i parziali coincidono
- **i confini dei set sbagliati vengono ricostruiti** nel numero previsto
- le posizioni ci sono, o non ci sono, come previsto
- ogni azione appartiene a un set esistente
- gli eventi seguono il set della loro azione
- i fotogrammi non decrescono dentro un'azione
- i punti dichiarati vengono letti correttamente

Restituisce codice di uscita 0 o 1: quando arrivera un esecutore di test, le
asserzioni si trasferiscono cosi come sono (`05-interventi.md`, punto 12).

## Come si usano

Per provare a mano tutta la catena:

```bash
# dalla schermata di una partita, oppure via API:
POST /api/matches/:id/analysis/import
  { "events": …, "videos": …, "frames": … }
```

L'insieme `cinque-set` e quello che copre piu casi in una volta sola:
tie-break, confini sbagliati, difetti moderati.

L'insieme `degradata` e il piu utile per l'interfaccia: verifica che
l'applicazione si comporti bene quando i dati sono scarsi e le posizioni non
ci sono affatto.

## Aggiungere un profilo

In `packages/mock/src/genera.ts`, aggiungere una voce a `PROFILI` con seme,
squadre, parziali e profilo di difetti. La verifica lo raccoglie da sola
leggendo `indice.json`.
