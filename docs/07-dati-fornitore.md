# I dati del fornitore

Analisi dei primi file reali ricevuti: `events.json`, `frames.json`,
`videos.json` — partita VNL 2021, Bulgaria-Cina, tre set.

**Vale la pena leggerlo prima di toccare qualunque cosa riguardi l'analisi.**
Il formato reale non coincide con il PDF "Modello dati - VV", e la qualita del
dato determina cosa l'applicazione puo e non puo mostrare.

## Cosa e arrivato

| File | Peso | Contenuto |
|---|---|---|
| `events.json` | 1,1 MB | 3 set, 128 azioni, 788 eventi |
| `frames.json` | 12,4 MB | 21.644 fotogrammi con posizioni dei giocatori |
| `videos.json` | 1 KB | fotogrammi al secondo e matrici omografiche |

**I video non ci sono.** `path` e nullo in entrambi i lati: arrivano i dati, non
il materiale. La riproduzione resta quindi non collaudabile.

Le dimensioni confermano la divisione decisa in fase di analisi: gli eventi sono
il 10% del peso e il 100% delle statistiche.

## Differenze rispetto al PDF del modello dati

Sette scostamenti, tutti gestiti nell'adattatore.

| # | Il PDF diceva | I dati dicono |
|---|---|---|
| 1 | `actions[].data.events[]` | **`actions[].events[]`** — gli eventi stanno sull'azione, non dentro `data` |
| 2 | `hP`/`aP` sull'azione | **`hP`/`oP`** — l'incoerenza segnalata in analisi e reale |
| 3 | `fS` come inizio del set | **`fs`** minuscolo nei set, `fS` nella partita |
| 4 | `hP`/`aP` = roster con nomi e ruoli | **elenchi di numeri di maglia**, nient'altro |
| 5 | `hRef`/`aRef` = riferimenti alle squadre | **`"left"` / `"right"`** |
| 6 | coordinate in metri (tabella) o pixel (nota) | **pixel**, da proiettare con l'omografia |
| 7 | `court` = "info per la conversione" | **array di matrici omografiche 3x3** |

Il punto 6 era una contraddizione interna al PDF, segnalata in fase di analisi:
i dati la sciolgono a favore dei pixel.

## Campi che il fornitore non produce

Sempre nulli su tutti i 788 eventi:

`pId` · `st` (tipo di fondamentale) · `c` (combinazione) · `posS` · `posE`
(posizioni di partenza e arrivo) · `speed` · `prev` · `isAtk` · `isCtk` ·
`atkRec` · `atkSet`

Sull'azione sono nulli anche `hS`/`aS` (alzatori), `hSP`/`aSP` (posizione
dell'alzatore) e tutti i `hPR1`/`aPR1`/`isATO`/`isAVC`.

L'unico campo opzionale valorizzato e `j` (in salto): 269 eventi su 788.

**Conseguenza diretta**: sono irrealizzabili, con questi dati, le analisi
geografiche e le mappe di calore (mancano `posS`/`posE`), le fasi cambio
palla/break point e le analisi per rotazione (manca la posizione dell'alzatore),
le combinazioni d'attacco e le velocita. Non e questione di effort: manca
l'informazione.

## Qualita rilevata

| Misura | Valore |
|---|---|
| Azioni rilevate | 128, contro 129 punti dichiarati — **ne manca una** |
| Eventi senza giocatore riconosciuto | 121 su 788 = **15,4%** |
| Azioni attribuite al set sbagliato | **8** |
| Posizione della palla | **mai presente** |
| Rilevamenti di posizione scartati | 525 |
| Copertura dei fotogrammi | 15% della durata |

### Numeri di maglia segnaposto

Oltre ai numeri reali compaiono: **100** (89 eventi, sempre con fondamentale
`0` = palla a terra: e un marcatore, non un giocatore), **1000**, **1001**,
**1002** (giocatori non riconosciuti), **-6** e **-27**, piu 21 eventi con
numero nullo.

L'adattatore li marca `jerseyIgnoto` invece di scartarli: l'evento resta nelle
statistiche di squadra e sparisce solo da quelle individuali.

### I confini dei set sono sbagliati

Il difetto piu insidioso, perche silenzioso. Le prime azioni di ogni set
appartengono in realta al set precedente: il set 2 comincia con quattro scambi
sul punteggio 16-23, 17-23, 17-24, 18-24 — la coda del set 1, che finisce 18-25.

**L'adattatore non si fida della segmentazione: ricostruisce i set dal
punteggio**, aprendone uno nuovo quando il conteggio torna a zero dopo essere
salito. Sono 8 le azioni riassegnate.

### Doppia marcatura dello stesso punto

Ci sono 141 eventi con esito su 128 scambi. Uno scambio puo portare due
marcature: la battuta e `Point` e la ricezione avversaria e `Error`. E la stessa
conclusione descritta due volte.

Per questo la misura di qualita confronta **azioni contro punti dichiarati**, non
la somma degli esiti: sommare gli esiti gonfierebbe il conto del 10%.

## Le posizioni

I fotogrammi non sono campionati a intervalli regolari, come il PDF lasciava
intendere: arrivano in **129 raffiche continue**, una per scambio, con tutti i
fotogrammi consecutivi durante il gioco e nulla negli intervalli. Raffica media
168 fotogrammi, circa 5,6 secondi.

E migliore di quanto previsto: durante uno scambio la posizione e nota fotogramma
per fotogramma.

**L'omografia funziona.** Proiettando i pixel con la matrice di `videos.json` si
ottengono coordinate coerenti con un campo da pallavolo:

```
fotogramma 3474 — casa
  #19 (4.8, 9.7)   #11 (5.6, 9.1)   #1 (5.1, 13.1)
  #8  (3.9, 9.9)   #18 (3.2, 15.4)  #22 (2.5, 13.2)
```

La proiezione degenera pero sui rilevamenti vicini alla linea d'orizzonte,
producendo valori come y = -33 m. L'adattatore scarta quanto cade fuori da una
fascia ragionevole intorno al campo.

Media di 5,6 giocatori per fotogramma invece di 6: qualcuno sfugge sempre al
rilevamento.

## Cosa si puo mostrare, e cosa no

**Calcolabile e verificato sui dati reali:**

| | BUL | CHN |
|---|---|---|
| Attacchi punto | 22 | 11 |
| Errori di attacco | 3 | 6 |
| Percentuale di attacco | 36% | 9% |
| Ace | 10 | 7 |
| Errori al servizio | 7 | 7 |
| Muri punto | 3 | 2 |

Piu i migliori realizzatori, l'elenco degli scambi con la sequenza dei tocchi, e
le posizioni in metri per il campo bidimensionale.

**Una cautela sui valori assoluti.** Sono rilevati 110 attacchi in 128 scambi,
meno di uno per scambio: in una partita vera sono due o tre. Il rilevamento perde
parecchi tocchi. I numeri reggono il **confronto fra le due squadre**, ma non
vanno presentati come statistica ufficiale — ed e la ragione per cui la schermata
dichiara sempre la qualita del dato.

**Non calcolabile**: mappe di calore, analisi geografiche, fasi cambio
palla/break point, rotazioni, combinazioni d'attacco, velocita, traiettoria della
palla.

## Dove sta il codice

| Cosa | Dove |
|---|---|
| Formato in ingresso | `packages/schema/src/fornitore.ts` |
| Formato canonico | `packages/schema/src/analysis.ts` |
| Adattatore e correzioni | `apps/api/src/analysis/adapter.ts` |
| Acquisizione e lettura | `apps/api/src/analysis/analysis.service.ts` |
| Metriche | `packages/core/src/metrics.ts` |
| Schermata | `apps/web/src/pagine/Statistiche.tsx` |

L'adattatore e l'**unico** punto che conosce il formato del fornitore. Se cambia,
si tocca quel file e nient'altro.

## `winner` e `value: "Point"` si contraddicono — scoperto il 2026-09-04

Costruendo il pannello statistiche accanto al video e emersa una
**contraddizione sistematica** nei dati reali, non un caso isolato:

| | |
|---|---|
| Azioni con almeno un evento `Point` | 64 su 128 |
| Di queste, in **contrasto** col vincitore dichiarato | **34 — il 53%** |

Esempio, la primissima azione della partita: dichiara `winner: "a"` (Cina),
ma contiene un attacco della Bulgaria marcato `value: "Point"`. Le due cose
non possono essere entrambe vere.

### Cosa e affidabile e cosa no

**`hPt`/`aPt` sono affidabili.** Il punteggio progressivo ricostruito dalle
azioni coincide con i punteggi finali dei set dichiarati: 18-25, 25-20,
22-19. Verificato su tutta la partita.

**`value: "Point"` non lo e**, o non significa quello che sembra. Metà delle
volte contraddice chi ha vinto lo scambio.

### Conseguenza per le metriche

`puntiRealizzati` in `packages/core/src/metrics.ts` conta gli eventi
`value: "Point"` di fondamentali A, S, B. Su questi dati **il numero non e
attendibile**: in piu punti della partita risulta maggiore dei punti
effettivamente segnati dalla squadra, che e impossibile.

Non e un difetto del motore — calcola correttamente cio che gli si chiede —
ma di cio che gli arriva. Finche non si chiarisce con il fornitore, quel
valore va trattato con sospetto, e le schermate che lo mostrano dovrebbero
dichiararlo.

## Da chiedere al fornitore

0. **`value: "Point"` contro `winner`**: nel 53% delle azioni si
   contraddicono (vedi sopra). Qual e la semantica esatta di `value`? Su
   quale dei due si deve fare affidamento?
1. **I video**: `path` e nullo. Su quale materiale sono contati i fotogrammi?
2. **`frameDelta` vale 0**: i due lati sono davvero allineati, o non e stato calcolato?
3. **Segmentazione dei set errata**: e un difetto noto o un caso isolato?
4. **Campi mai valorizzati**: `posS`/`posE`, tipo di fondamentale, alzatore. Sono previsti in futuro? Da essi dipendono mappe di calore e analisi per rotazione.
5. **Tocchi mancanti**: 110 attacchi in 128 scambi. Quale tasso di rilevamento e atteso?
6. **Numeri segnaposto** (100, 1000, 1001, -6): la convenzione e documentata da qualche parte?
