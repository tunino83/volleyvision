# Piani e profili utente — **parcheggiato**

**Non si implementa.** Deciso il 2026-08-30: la proposta e stata fatta,
discussa e messa da parte. Questo documento esiste perche fra sei mesi non si
rifaccia il ragionamento da zero.

Sostituisce, quando e se verra ripreso, il punto 8 del `CLAUDE.md`
("licenze e quote parcheggiate").

## Il numero da cui parte tutto

| | |
|---|---|
| Un video | 5 GB |
| I suoi dati di analisi | 180 KB |
| **Rapporto** | **29.000 a 1** |

Limitare quante partite un utente *vede*, o quante statistiche gli si
mostrano, e **arbitrario**: non costa nulla. Tenere i dati di 60 partite sono
10 MB, e si possono lasciare a vita senza pensarci.

L'unica cosa che costa e **per quanto tempo si conserva il video**.

Da cui la forma, che e anche una promessa vendibile:

> **Le statistiche restano per sempre. Il video scade.**

## La proposta

Destinatario: **il singolo appassionato**, non la societa (punto 6e del
`CLAUDE.md`). Quindi il piano si attacca a `User`, e non serve nessuna entita
nuova ne alcun cambio di proprieta dei dati.

| | Standard | Premium | Gold |
|---|---|---|---|
| Partite analizzate all'anno | 3 | 25 | 60 |
| **Conservazione del video** | 7 giorni | 3 mesi | 12 mesi |
| Statistiche della partita | tutte | tutte | tutte |
| **Le statistiche restano** | per sempre | per sempre | per sempre |
| Statistiche cross-partita | — | stagione corrente | tutte le stagioni |
| Squadre seguite | 1 | 2 | illimitate |
| Condivisione con un allenatore | — | si | si |
| Uso offline e installazione | si | si | si |

### Le tre scelte da difendere

**Non si limita la comprensione, si limita il volume.** Chi ha lo Standard
vede **tutto** di poche partite, non poco di tante: se non vedesse le
statistiche per giocatore non scoprirebbe mai perche dovrebbe pagare.

**Le cross-partita sono il confine naturale**, non perche costino ma perche
con 3 partite non significano niente. Chi arriva a volerle ha gia capito il
prodotto: e un limite che matura invece di frustrare.

**L'offline non si tocca.** Gatearlo farebbe sembrare il prodotto rotto,
non incompleto.

### Il superamento non cancella

**Chi scende di piano continua a leggere tutto quello che aveva**; smette solo
di aggiungere. Cancellare dati per un mancato rinnovo e il modo piu rapido di
farsi odiare, e sui video sarebbe anche un rischio legale.

## Perche non si puo tarare adesso

**Quanto chiede il fornitore per analizzare una partita e ancora ignoto**, ed
e quasi certamente la voce dominante — piu dello spazio.

A 20 € a partita, un Gold da 60 partite costa 1.200 € l'anno di solo
fornitore, e nessun appassionato lo paga. A 1 €, la scala cambia del tutto.

**I valori 3 / 25 / 60 sono segnaposto, non una proposta.** E la stessa
domanda bloccante in fondo a `06-criticita.md`.

## Come si scriverebbe

Esattamente come `capacitaPartita(stato)`, che qui funziona gia:

```ts
capacitaPiano(piano) -> { partiteAnnue, squadreMassime,
                          crossPartita, giorniConservazioneVideo, ... }
```

Una dichiarazione sola in `@vv/schema`: **il server rifiuta, il client non
mostra.** I due si compongono — cio che si puo fare e l'intersezione fra il
piano e lo stato della partita.

Il valore di questa forma e che i limiti restano leggibili in un posto solo,
invece di spargersi in trenta `if` che poi nessuno riesce piu a cambiare.

Stima, a fornitore noto: **3-4 giorni**, piu i pagamenti (fornitore da
scegliere, non compreso nell'offerta).

## Cosa e stato scartato

**L'entita Societa** — account con piu utenti membri, dati posseduti
dall'organizzazione. E il modello giusto per vendere a un club, non a una
persona. Costava 4-5 giorni e cambiava la proprieta dei dati. Vedi il punto
6e del `CLAUDE.md`.
