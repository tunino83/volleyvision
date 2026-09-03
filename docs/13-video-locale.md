# Il video locale, e cosa ne consegue per il desktop

## Cosa si e scoperto

La regola "niente video nel browser" nasceva dal costo dello **streaming**:
servire gigabyte a ogni riproduzione. Ma esiste una terza strada, che non era
stata considerata: **l'utente indica il file sul proprio disco e il browser lo
riproduce da li**.

```
<input type="file"> → URL.createObjectURL(file) → <video src={blob}>
```

Nessun byte esce dalla macchina. Nessuna archiviazione, nessuna banda, nessun
server. **Il vincolo era sul trasporto, non sulla riproduzione**, e per anni le
due cose sono state confuse perche di solito viaggiano insieme.

## Cosa e stato verificato

Su Chrome 148, misurato e non ricordato:

| | |
|---|---|
| `URL.createObjectURL` | c'e |
| `requestVideoFrameCallback` | c'e — **dice quale fotogramma e stato davvero presentato** |
| `showOpenFilePicker` | c'e — handle persistente al file, ma **solo su Chromium** |
| H.264, HEVC, VP9, AV1 | tutti decodificabili |

Il salto e `currentTime = frame / fps`, e gli fps arrivano da `videos.json`.

## Cosa NON e stato verificato

**La precisione del salto sui file veri.** Dipende dalla distanza fra i
fotogrammi chiave, che la decide il fornitore quando normalizza. Per questo la
schermata **dichiara lo scarto** a ogni salto: "chiesto 3468, presentato 3468 —
esatto", oppure di quanti fotogrammi sbaglia.

E la misura che va fatta per prima, perche da sola sposta settimane di piano.

## Cosa ne consegue per l'applicazione desktop

Electron esisteva per tre ragioni. Due cadono.

| Ragione | Regge ancora? |
|---|---|
| Riprodurre il video con salto al fotogramma | **no**: lo fa il browser |
| Leggere il file dal disco | **no**: lo fa il browser, e su Chromium ricorda anche quale |
| Pacchetti partita senza rete | **si, in parte**: sono ~2 MB a partita, e IndexedDB li tiene senza problemi. Electron non serve |
| Essere un'applicazione installata, con icona e aggiornamenti | **si** — ma lo fa anche una PWA |

**Quindi si: il desktop diventa molto piu semplice**, e la domanda vera non e
piu "come lo costruiamo" ma "serve ancora?".

### Tre cose da sapere prima di eliminarlo

1. **`showOpenFilePicker` e solo Chromium.** Su Firefox e Safari il file va
   riscelto a ogni sessione. Non e drammatico — si sceglie una volta per
   sessione di lavoro — ma va detto, non scoperto.
2. **I codec.** Il browser deve saper decodificare quel che consegna il
   fornitore. H.264 in MP4 va sempre; HEVC e ProRes no, dappertutto. **E una
   domanda da fare al fornitore**, e va fatta adesso.
3. **La misura del salto.** Se sui file veri il salto sbagliasse di parecchi
   fotogrammi, Electron tornerebbe utile: con l'accesso diretto al file si puo
   decodificare in modo piu controllato.

### Cosa fare, in ordine

1. Aprire un video vero nella scheda "Guarda il video" e **leggere lo scarto**.
2. Chiedere al fornitore **codec e distanza fra i fotogrammi chiave** dei video
   normalizzati.
3. Solo dopo, decidere se il desktop resta Electron, diventa una PWA, o sparisce.

Finche i primi due punti non sono chiusi, **il piano di Fase 2 non va
riscritto**: la scoperta e promettente, non ancora una certezza.
