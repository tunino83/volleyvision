# Il simulatore del fornitore

Finche il fornitore dell'analisi video non e ingaggiato, a rispondere e un
simulatore: si caricano i due video, e dopo qualche minuto compaiono i dati di
una partita generata al momento, diversa ogni volta.

Serve ad **astrarre** l'analisi video: il resto del sistema lavora come se il
fornitore ci fosse gia.

## L'interruttore

```
FORNITORE_ANALISI=simulato     # oggi
FORNITORE_ANALISI=esterno      # quando il fornitore sara ingaggiato
```

**E l'unica cosa da cambiare.** Nessun altro file conosce l'implementazione:
il sistema vede solo l'interfaccia `FornitoreAnalisi`.

| Variabile | Predefinito | A cosa serve |
|---|---|---|
| `FORNITORE_ANALISI` | `simulato` | quale implementazione usare |
| `SIMULA_RITARDO_MINUTI` | `5` | quanto "ci mette" il simulatore |
| `LAVORAZIONE_INTERVALLO_SEC` | `20` | ogni quanto si chiede se ha finito |
| `FORNITORE_URL` / `FORNITORE_TOKEN` | — | solo per il fornitore vero |

## Come e fatto

```
fornitore.ts             il contratto: avvia() e ritira(). Due metodi, nient'altro.
simulato.ts              genera una partita finta dopo il ritardo configurato
esterno.ts               scheletro del fornitore vero, da completare
lavorazione.service.ts   accoda, interroga a intervalli, acquisisce
fornitore.module.ts      il punto in cui si sceglie l'implementazione
```

Il contratto e volutamente minimo: si chiede di analizzare una partita, e prima
o poi arrivano i dati. Tutto quello che riguarda formato, autenticazione e
meccanismo di notifica sta dietro.

## Il percorso

1. Si caricano entrambi i video e si compila la formazione del set 1
2. La partita passa in coda, e la lavorazione la accoda presso il fornitore → **analisi in corso**
3. A intervalli si chiede se ha finito
4. Quando c'e: **elaborazione dati**, si acquisisce con l'adattatore, e la partita e **pronta** con la notifica

Il passaggio 3 esiste perche il simulatore non richiama da se. Se il fornitore
vero notifichera spontaneamente, basta mettere `notificaSpontanea = true` e
aggiungere la rotta: l'interrogazione periodica si spegne da sola.

## Lo stato sta nel database

La tabella `Lavorazione` conserva riferimento, momento previsto e stato. **Un
riavvio del server non perde le elaborazioni in corso**: al riavvio si riprende
a interrogare quelle rimaste aperte.

Il simulatore, dal canto suo, non tiene nulla in memoria: il riferimento
(`sim:<seme>:<quando>`) contiene tutto il necessario per riprodurre la stessa
partita.

## Ogni caricamento e diverso

Il seme deriva da identificativo della partita e momento della richiesta.
Cambiano squadre, numero di set, punteggi, e il profilo dei difetti:

```
QAT-CHN  25-23 / 25-16 / 25-23 / 25-19    4 set · 181 azioni · ignoti 18,6%
ARG-GER  33-31 / 25-22 / 25-21 / 16-25    4 set · 198 azioni · ignoti 13,0%
QAT-ARG  24-26 / 27-29 / 19-25            3 set · 150 azioni · ignoti 24,2%
```

I punteggi sono possibili: chi vince prende tre set e l'ultimo set e sempre suo.
Ci sono set ai vantaggi, tie-break a 15, e una volta su sei le posizioni mancano
del tutto — capita anche col fornitore vero, e l'applicazione deve reggerlo.

**Una volta su venticinque l'elaborazione fallisce**, con un messaggio
plausibile: la partita va in errore. Anche quel percorso va collaudato.

## Non aspettare cinque minuti

```
POST /api/matches/:id/processing/accelerate
```

Anticipa la consegna. Funziona **solo col simulatore**: col fornitore vero non
fa nulla. Durante lo sviluppo si puo anche abbassare `SIMULA_RITARDO_MINUTI`.

Per vedere a che punto e:

```
GET /api/matches/:id/processing
```

## Quando arrivera il fornitore vero

1. Completare `esterno.ts`: chiamata di avvio e chiamata di ritiro. Lo scheletro e commentato con la forma attesa.
2. Se notifica da se, mettere `notificaSpontanea = true` e aggiungere la rotta con autenticazione separata.
3. Verificare l'adattatore sul suo formato reale (`07-dati-fornitore.md`).
4. `FORNITORE_ANALISI=esterno`.

Il simulatore resta: serve comunque per lo sviluppo e per i test, dove chiamare
il fornitore vero non ha senso.

## Cosa non simula

Il tempo di elaborazione reale, che nessuno conosce. Il ritardo e configurabile
ma arbitrario: quando il fornitore comunichera i suoi tempi, andra allineato.

E non produce video: genera soltanto i dati. Il materiale video resta assente
finche non arrivera dal fornitore.
