# Come funziona l'applicazione senza rete — analisi completa

**Riguarda i computer.** Su telefoni e tablet e prevista l'applicazione
nativa (punto 6g del `CLAUDE.md`): i limiti di Safari elencati piu sotto
restano validi solo per chi apra il sito da un browser mobile per caso.

Stato al 2026-08-30. Sostituisce nulla: mette insieme cio che e sparso fra i
documenti 13, 14 e 15 e aggiunge i numeri misurati.

## 1. I quattro strati

L'uso senza rete non e una funzione: sono quattro meccanismi diversi che
funzionano insieme. Capire quali sono spiega anche perche alcuni limiti
esistono e altri no.

### Strato 1 — Il guscio (service worker)

I file dell'applicazione (pagina, stili, codice) restano sul dispositivo.
E cio che permette alla finestra di **aprirsi** senza connessione.

Regola: **prima la rete, poi la copia**. Chi e connesso vede sempre l'ultima
versione; la copia interviene solo quando la rete manca.

### Strato 2 — I dati (IndexedDB)

| Cosa | Peso misurato | Quando si prende |
|---|---|---|
| Squadre, campionati, persone, elenco partite | **55 KB** | sempre, ovunque |
| Pacchetto di analisi di una partita | **120-180 KB** | vedi sotto |
| Video | **5 GB** | **mai** |

Le partite si scaricano **tutte e in automatico** se l'applicazione e
installata; in una scheda del browser solo quelle che si aprono, salvo
richiesta esplicita. La distinzione protegge il caso del computer condiviso
senza fare domande a nessuno: **installare e gia dire "questo dispositivo e
mio"**.

Si **sostituisce l'insieme intero** a ogni aggiornamento: e cio che rende
questa una copia e non una sincronizzazione — le cancellazioni si risolvono da
sole, e non servono ne fusioni ne risoluzione di conflitti.

### Strato 3 — Il video

**Non viene mai copiato.** Resta dove sta, sul disco dell'utente, e si collega
dall'applicazione. E la scoperta che ha tolto a una applicazione desktop
nativa la sua ragione principale (documento 13).

Il rapporto fra le due grandezze e il numero che governa tutte le scelte:

> **Un video 5 GB, i suoi dati 180 KB. Ventinovemila a uno.**

Tutto cio che non e video e praticamente gratis da tenere in locale. Ecco
perche non si chiede all'utente cosa scaricare: non c'e niente da risparmiare.

### Strato 4 — La sessione

Senza rete **non si rifa l'accesso**: si entra con l'ultimo profilo conosciuto.

I dati sono gia sul dispositivo, e chi ha il dispositivo in mano puo leggerli
comunque: **a proteggerli e il dispositivo, non la nostra schermata di
accesso**, che offline non potrebbe verificare nulla contro il server.

Non serve una scadenza inventata: quando la rete torna, il token di rinnovo o
vale ancora o no. I suoi **30 giorni** sono il tempo massimo di uso continuato
senza mai collegarsi.

## 2. Cosa si puo fare, e cosa no

| Senza rete si puo | Senza rete non si puo |
|---|---|
| Aprire l'applicazione | Modificare qualunque cosa |
| Consultare squadre, campionati, persone | Aprire una partita non scaricata |
| Vedere le statistiche delle partite scaricate | Caricare un video (richiede la rete per definizione) |
| Statistiche per giocatore, grafici, schede persona | Ricevere nuove analisi |
| Statistiche cross-partita sulle partite scaricate | **Uscire e rientrare** |
| Guardare il video locale col salto al fotogramma | Cambiare utente |

**Offline si legge, non si scrive** — scelta deliberata (documento 14): la
sincronizzazione bidirezionale costa settimane, e servirebbe per un caso raro.
I comandi di modifica **non compaiono**, non sono disabilitati dopo il clic.

## 3. I vantaggi

### Rispetto a un'applicazione nativa (Electron)

| | Electron | Questa soluzione |
|---|---|---|
| Installatore | `.exe` e `.dmg` da costruire e ospitare | nessuno |
| Firma del codice Windows | ~300-500 €/anno | nessuna |
| Notarizzazione Apple | 99 $/anno + processo a ogni versione | nessuna |
| Aggiornamento | da scrivere, con server e firma | **si pubblica e basta** |
| Peso scaricato | 80-150 MB per sistema | ~1 MB |
| Sistemi da costruire | Windows e macOS separatamente | uno |
| Tempo alla prima consegna | settimane | **gia fatto** |

### Altri

- **Un solo codice** per Windows, macOS, Android e iOS
- **Aggiornamento automatico**: alla riapertura si ha sempre l'ultima versione,
  senza che l'utente faccia nulla
- **I dati pesano niente**: 100 partite sono ~18 MB, contro 500 GB dei loro video
- **Nessuna dipendenza da uno store** e dai suoi tempi di revisione

## 4. I limiti

Divisi per natura, perche non sono la stessa cosa.

### 4a. Limiti di progetto — scelti, non subiti

| | |
|---|---|
| **Offline si consulta soltanto** | la scrittura bidirezionale costa settimane e servirebbe di rado |
| **In una scheda del browser le partite non si scaricano** da sole | protegge il computer condiviso; basta installare, o accendere l'opzione |
| **Uscire senza rete e una porta a senso unico** | cancella i dati locali e non si rientra fino al ritorno della rete. Il comando resta comunque disponibile: e la via di fuga di chi usa un computer altrui. Chiede conferma |
| **Su un dispositivo condiviso** chi apre vede l'ultimo utente entrato | fino all'uscita, che cancella tutto |

### 4b. Limiti delle piattaforme — non aggirabili

| | |
|---|---|
| **iOS libera lo spazio dopo alcune settimane di non utilizzo** | politica di Safari. Per il consulto occasionale non cambia nulla; per "ho la stagione sempre con me" e un limite reale |
| **La memoria del file video e solo su Chromium** | su Safari il video va riscelto a ogni sessione |
| **Alcune configurazioni aziendali impediscono l'installazione** | l'applicazione continua a funzionare in una scheda, senza finestra propria |
| **`storage.persist()` non e garantito** | senza, il sistema puo liberare i dati quando lo spazio scarseggia. In esercizio, su dominio vero e ad applicazione installata, i browser normalmente concedono — **da verificare** |

### 4c. Limiti tecnici da chiudere — lavoro, non vincoli

| | |
|---|---|
| **2,4 MB di JavaScript in un blocco unico** | alla prima apertura su rete lenta si sente. Da dividere per rotta |
| **`related_applications` contiene un segnaposto** | finche non c'e il dominio vero, il riconoscimento dell'installazione risponde "non lo so" **senza segnalare errori** |
| **Nessuna misura dello scarto sul video vero del fornitore** | l'accuratezza del salto al fotogramma e dichiarata a schermo, non garantita |

### 4d. **Non ancora verificato** — lo stato piu importante

| | |
|---|---|
| Registrazione del guscio | **non verificata** |
| Apertura senza rete | **non verificata** |
| Installazione vera | **non verificata** |
| Potatura dei file vecchi | **non verificata** |

I service worker sono disabilitati nel browser usato per lo sviluppo: fallisce
la registrazione anche di un file vuoto, quindi **non e un difetto del codice
— ma non e nemmeno una prova che funzioni**.

Verificato invece: manifesto valido, icone, tipi, sintassi, deposito
IndexedDB con dati reali (55 KB di anagrafiche + 2 pacchetti da 300 KB
complessivi, 1192 eventi), i tre stati di rete, il confronto delle versioni.

**I cinque passi per chiudere questo punto sono in `15-installazione-e-offline.md`.**
Sono dieci minuti in Edge, e finche non sono fatti tutto il resto di questo
documento e una promessa.

## 5. Numeri di riferimento

| | |
|---|---|
| Anagrafiche complete | 55 KB |
| Pacchetto partita | 120-180 KB |
| 100 partite | ~18 MB |
| Un video | 5 GB (mai in locale) |
| Scrittura + rilettura IndexedDB | 3 ms |
| Quota disponibile misurata | 2.630 MB |
| Durata massima di uso senza rete | 30 giorni |
