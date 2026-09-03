# Scala delle statistiche, e sincronizzazione fra le shell

Tre domande architetturali, con quel che si e misurato e quel che resta da
decidere.

## 1. Quante partite regge l'aggregazione cross-partita?

**Misurato**, non stimato: `apps/api/prisma/prova-carico.js` genera N partite
con analisi vera e cronometra `/stats/players`.

| Partite | Peso dei pacchetti | Risposta |
|---|---|---|
| 52 | 9,8 MB | **171 ms** |
| 252 | 48,3 MB | **716 ms** |
| 502 | 97,9 MB | **1358 ms** |

**Perfettamente lineare: ~2,7 ms per partita.** E il segno che il costo non e
nella query ma nel lavoro per riga — infatti l'implementazione di oggi
**legge e interpreta ogni pacchetto a ogni richiesta**. A 500 partite significa
interpretare 98 MB di JSON per una schermata.

### Il limite pratico

| Partite | Giudizio |
|---|---|
| fino a ~100 | va bene, ~300 ms |
| ~250 | al limite, 0,7 s: si nota |
| oltre ~400 | **non accettabile**, e non e solo la latenza |

Il problema piu serio non e il tempo ma la **memoria**: 98 MB interpretati per
ogni richiesta. Dieci utenti insieme sono un gigabyte. E il collo di bottiglia
vero, e arriva prima di quanto suggerisca il cronometro.

### Cosa fare, quando serve

**Non ottimizzare adesso.** Un utente con 100 partite e gia un utente molto
attivo — una stagione intera di una squadra sono 20-30 partite. Il momento per
intervenire e quando qualcuno supera il centinaio, e si vedra dai dati.

Quando servira, la strada e una sola e non e "mettere una cache": si
**precalcolano gli aggregati al momento dell'acquisizione dell'analisi**. Una
tabella `StatisticaGiocatorePartita` con una riga per giocatore per partita —
quindici numeri — scritta una volta quando il pacchetto arriva. La query
cross-partita diventa una somma su una tabella stretta invece che
l'interpretazione di 98 MB di JSON.

Costo stimato: 2-3 giorni. **Non e urgente, ma va scritto adesso che si sa
perche**, altrimenti fra un anno qualcuno mettera una cache e curera il sintomo.

Nota: l'aggregato precalcolato **non sostituisce** il motore in
`packages/core`. Quello resta la definizione unica delle metriche; la tabella
e solo il suo risultato messo da parte. Se divergessero, i numeri
divergerebbero — ed e esattamente cio che la regola 2 vieta.

## 2. Come si sincronizzano mobile e desktop?

Ogni utente scarica **solo i propri dati**: le partite che possiede o che gli
sono state condivise. Sono i pacchetti di analisi, ~0,12-0,5 MB l'uno
(misurato sulla partita reale: 0,12 MB per 788 eventi).

**La sincronizzazione non e automatica, ed e una scelta.**

Scaricare da soli quel che l'utente non ha chiesto significa consumare la sua
rete e il suo spazio per dati che forse non guardera. Su rete mobile e un costo
che paga lui. Quindi:

- **si scarica cio che si apre**, e resta disponibile senza rete
- **si aggiorna quando l'applicazione e aperta e c'e rete**, controllando la
  revisione: se il server ha una revisione piu recente, la si sostituisce
- **si puo scaricare in blocco**, ma lo si chiede — non capita da solo

E lo stesso principio del caricamento video: **niente lavoro in secondo piano
che l'utente non ha chiesto**.

### Le anagrafiche si tengono **sempre**, le partite su richiesta

Deciso il 2026-08-30. La regola e una sola, e la detta la **dimensione**.

| | Peso misurato |
|---|---|
| Squadre | 627 byte |
| Campionati | 418 byte |
| Persone (472) | 53 KB |
| Elenco partite | 2,1 KB |
| **Tutte le anagrafiche** | **~56 KB** |
| *Una singola partita* | *~120 KB* |

**Tutte le anagrafiche insieme pesano meno della meta di una partita.** A
questo prezzo non ha senso chiedere all'utente cosa vuole portarsi dietro: si
tengono e basta, e si aggiornano a ogni apertura con rete.

Gli avatar non pesano: sono salvati come *stile + seme*, due stringhe brevi, e
disegnati dal client. Offline funzionano senza scaricare nulla.

### Corretto il 2026-08-30, misurando anche le partite

La prima stesura diceva "anagrafiche in KB sempre, partite in MB su
richiesta". **La misura non la sostiene**: un pacchetto partita e
**120-180 KB**, non megabyte. Cento partite al peso massimo sono **18 MB**.

Far scegliere all'utente fra oggetti da 150 KB e farlo lavorare per niente.
**Si scarica tutto.** L'unica cosa grande e il video, che in locale non ci va.

Resta pero una domanda buona, e non e *cosa* scaricare ma **se**: su un
computer condiviso portarsi dietro l'intera stagione di qualcuno e peggio che
non farlo. La risposta la da l'installazione stessa:

| | |
|---|---|
| Anagrafiche | **sempre**, ovunque |
| Partite, con l'applicazione **installata** | **tutte**, in automatico: installarla e gia dire "questo e il mio dispositivo" |
| Partite, in una **scheda** del browser | quelle che apri, piu un comando esplicito "scarica tutto" |
| Su rete **a consumo** (`piattaforma.rete.aConsumo()`) | si chiede una volta prima di scaricare |
| Video | mai |

Cosi il caso del computer condiviso si protegge **senza fare domande a
nessuno**, e chi ha installato non ne vede nemmeno una.

**Conseguenza sul piano: l'interruttore "tieni con me" per singola partita non
serve piu.** Al suo posto uno scaricamento automatico con una riga di
avanzamento e un modo per spegnerlo. Meno lavoro e meno decisioni per l'utente.

Il segnale dell'installazione si legge in due modi, entrambi verificati:
`display-mode: standalone` dice con certezza che si sta girando *come*
applicazione; `navigator.getInstalledRelatedApps()` dice se un'installazione
esiste anche mentre si e in una scheda, ma **solo su Chromium** e solo se il
manifesto la dichiara in `related_applications`.

### Perche non e il problema di sincronizzazione che vogliamo evitare

Perche si **sostituisce l'insieme intero**, non si fondono le righe.

Si scarica la collezione, si sostituisce quella locale, fine. Le
cancellazioni si risolvono da sole (la riga sparita non c'e nell'insieme
nuovo), non servono revisioni per riga, ne segnalibri, ne fusioni. E la
differenza fra una copia e una sincronizzazione: la prima e mezza giornata, la
seconda settimane.

Funziona **solo** perche i dati sono piccoli e in sola lettura. Se un giorno
diventassero grandi o modificabili offline, questa scelta va rifatta.

### Un aiuto che era gia in casa

Il roster della partita **e gia una copia sulla partita**: `MatchPlayer`
porta cognome, nome, numero di maglia, ruolo. Correggere il roster della
squadra non cambia le partite gia giocate — ed e giusto cosi.

Quindi di cio che "scivola" restano solo il nome della squadra, quello del
campionato e nome e avatar della persona: tutti dentro i 56 KB delle
anagrafiche.

### Cosa serve, e non c'e

| | |
|---|---|
| Scaricamento del pacchetto | l'API lo restituisce, ma **non esiste il comando** |
| Archiviazione nel client | IndexedDB. Provato: 0,12 MB scritti e riletti in **3 ms**, quota disponibile 2,6 GB |
| Confronto di revisione | `Match.revisioneAnalisi` c'e gia: basta confrontarla |
| Guscio senza rete | service worker e manifest: **non ci sono** |

## 3. Le modifiche fatte offline

**Proposta: offline si legge, non si scrive.**

Non e una rinuncia comoda, e la lettura di cosa fa davvero l'applicazione.
Guardare una partita, leggere le statistiche, muoversi nel video: **tutte
operazioni di sola lettura**, e sono quelle che si fanno lontano dalla rete —
in palestra, in trasferta, sul treno.

Creare una partita, compilare un roster, caricare un video: si fanno da fermi,
davanti a un computer, dove la rete c'e. E il caricamento del video **richiede**
la rete per definizione.

### Perche non fare la sincronizzazione bidirezionale

Perche costa molto e serve poco. Servirebbero: registro delle modifiche locali,
risoluzione dei conflitti (due dispositivi che cambiano lo stesso roster),
identificativi generati dal client, e una politica per il caso peggiore — la
modifica fatta offline su dati che nel frattempo sono cambiati.

**E la parte piu costosa e piu fragile di qualunque applicazione offline**, e
qui pagherebbe un caso d'uso raro: correggere un numero di maglia senza rete.

### Cosa fa l'applicazione, in concreto

Senza rete i comandi di modifica **non ci sono** — non sono disabilitati con un
messaggio dopo il clic: non compaiono, come gia accade per le partite in
analisi (`capacitaPartita`). La schermata dichiara "sei senza rete: puoi
guardare, non modificare".

**Una sola eccezione da valutare**: le sostituzioni. Si registrano leggendo il
referto, potenzialmente a bordo campo, e non entrano nell'analisi. Se servisse,
sono l'unico caso in cui una coda di modifiche locali avrebbe senso — e
sarebbe una coda semplice, perche due persone non registrano gli stessi cambi
della stessa partita.

**Da decidere con il committente**, non da noi: e una scelta di prodotto, e la
si prende sapendo che la bidirezionale costa settimane.
