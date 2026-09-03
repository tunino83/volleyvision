# Restyling e responsive

> **Stato: fatto.** I punti da 1 a 5 sono stati eseguiti. L'audit a 375 px
> passa su tutte e dieci le rotte: nessuna sposta la pagina, nessun comando
> sotto i 44 px. Quel che resta e in fondo, sotto "Cosa manca ancora".
> La pagina resta perche i numeri di partenza spiegano le scelte fatte.

L'interfaccia di Fase 1 e stata scritta per **funzionare**, non per essere
guardata: 114 righe di CSS, un solo punto di rottura a 720px con tre regole.
Ha retto finche le schermate erano poche. Non regge il telefono.

**La stessa applicazione gira anche su mobile**, con meno funzioni ma la stessa
struttura: non e un'altra interfaccia, e la stessa a larghezza diversa. Vale
quindi la pena sistemarla adesso, prima che le schermate si moltiplichino in
Fase 2, perche ogni schermata scritta male va poi corretta due volte.

## L'audit, non le impressioni

Misurato a **375 x 812** (iPhone SE / Android piccolo) su tutte e nove le
rotte, con l'applicazione vera e i dati di esempio.

| Rotta | Sfora in orizzontale | Comandi sotto i 40 px |
|---|---|---|
| `/` | — | 5 |
| `/squadre` | — | 5 |
| `/squadre/:id` | **135 px** | 77 |
| `/campionati` | — | 5 |
| `/partite` | **300 px** | 5 |
| `/partite/nuova` | — | 5 |
| `/partite/:id` | **100 px** | 57 |
| `/persone` | — | 5 |
| `/partite/:id/statistiche` | **26 px** | 10 |

Quattro rotte su nove **spostano la pagina di lato**: il testo esce dallo
schermo e si legge solo trascinando. Non e un dettaglio estetico, e contenuto
irraggiungibile.

### Le tre cause, tutte e tre in `stile.css`

**1. Le tabelle non stanno in un contenitore che scorre.**
E la causa del 90% del problema.

```
/partite       tabella larga 642 px dentro una scheda da 341
/squadre/:id   tabella larga 477 px dentro una scheda da 341
```

`table { width: 100% }` non serve a nulla quando il contenuto ha una larghezza
minima superiore: la tabella sfonda la scheda, la scheda sfonda la pagina.

**2. Le righe flex non vanno a capo.** `.riga` e `.riga-sp` non hanno
`flex-wrap`: intestazione di scheda, filtri e gruppi di pulsanti restano su una
riga sola e spingono. Su `/partite/:id` valgono 459 px in 343 disponibili.

**3. La barra di navigazione scorre di lato.** La regola a 720px le mette
`overflow-x: auto`: e un rattoppo, non una scelta. Cinque voci piu marchio,
utente e uscita non stanno in 375 px, e una barra che scorre di lato nasconde
meta delle voci senza dirlo.

### E poi i comandi troppo piccoli

Le voci di navigazione sono alte 35 px, i pulsanti `.piccolo` nelle tabelle
(*modifica*, *rimuovi*, i `+` delle formazioni) stanno sotto la stessa soglia.
Il minimo raccomandato e **44 px**; `docs/09` delle specifiche lo chiede gia
esplicitamente per il diagramma del campo, ma vale ovunque si tocchi con un
dito. I conteggi in tabella sono misurati sotto i **40** px, quindi sono una
stima per difetto: alzando la soglia a 44 crescono.

## Cosa si fa

Cinque interventi, in quest'ordine. I primi tre chiudono le rotture misurate
sopra; gli ultimi due sono il restyling vero.

### 1. Tabelle che scorrono per conto loro  *(la meta del problema)*

Un contenitore `.tabella-scorrevole` con `overflow-x: auto` attorno a ogni
tabella. La pagina smette di spostarsi; la tabella scorre dentro il suo
riquadro, dove ci si aspetta che scorra.

Dove le colonne sono davvero troppe — elenco partite — sotto i 700 px la
tabella diventa **un elenco di schede**, una per partita, con le due squadre,
la data e lo stato. Una tabella a sei colonne su 375 px non e leggibile
nemmeno scorrendo.

### 2. Righe che vanno a capo

`flex-wrap: wrap` su `.riga` e `.riga-sp`, e `min-width: 0` sui figli che
contengono testo lungo. Due caratteri di CSS che tolgono la seconda causa.

### 3. Navigazione ripensata per il pollice

Sotto i 720 px la barra in alto tiene marchio, notifiche e uscita; le cinque
voci vanno in una **barra in basso**, dove il pollice arriva. E la struttura
che l'applicazione avra comunque quando sara incapsulata in Capacitor: farla
adesso significa non rifarla poi.

Le voci non disponibili su mobile — l'amministrazione — non si nascondono con
un `display: none`: **non vengono proprio registrate**, come gia si fa per le
capacita assenti (`01-architettura.md`).

### 4. Aree toccabili da 44 px

`min-height: 44px` sui comandi quando il puntatore e grossolano:

```css
@media (pointer: coarse) { button, .nav a, input, select { min-height: 44px; } }
```

Legato al **puntatore, non alla larghezza**: un tablet largo si tocca lo stesso,
una finestra stretta col mouse no. E la distinzione giusta, e costa una riga.

### 5. Restyling: scala, spaziatura, densita

Qui si passa dal "non e rotto" al "e curato".

- **Scala tipografica dichiarata.** Oggi le dimensioni sono numeri sparsi nei
  componenti (`fontSize: 15`, `size: 13`, `11px`). Diventano quattro token:
  `--t-titolo`, `--t-corpo`, `--t-piccolo`, `--t-etichetta`.
- **Spaziatura su una scala.** `--sp` esiste gia (4px) ma **non e usato da
  nessuna parte**: i margini sono numeri a mano. Da li nasce la sensazione di
  disordine, perche 8, 10, 12 e 14 convivono senza motivo.
- **Fine degli stili in linea.** Ci sono decine di `style={{...}}` nei
  componenti: vanno in classi. Finche stanno li, cambiare l'aspetto significa
  aprire venti file.
- **Densita doppia.** Su desktop le tabelle restano compatte; sotto i 720 px le
  righe si distanziano. Stessa struttura, respiro diverso.
- **Stati di caricamento decenti.** `Stato` impone i quattro stati ma il
  caricamento e testo: diventa una sagoma grigia della schermata che sta per
  arrivare.

## Cosa NON si fa

- **Non si passa a Tailwind.** I token ci sono e le classi sono semantiche: il
  cambio costerebbe una riscrittura di ogni componente in cambio di nulla che
  serva oggi.
- **Non si introduce una libreria di componenti.** Cinque schermate non la
  giustificano, e porterebbe con se un tema da combattere.
- **Non si ridisegna il diagramma del campo.** Funziona, e la disposizione e
  quella che ha in mente chi allena. Prende solo le aree da 44 px.

## Come si verifica

L'audit va rifatto, non ricordato.

**Oggi**, senza dipendenze: `apps/web/audit-responsive.js` si incolla nella
console del browser con la finestra a 375 px. Percorre le nove rotte, scopre da
solo gli identificativi di partita e squadra dall'API, e stampa una tabella con
quanto ogni rotta sfora e quanti comandi stanno sotto i 44 px. E il file che ha
prodotto i numeri di questa pagina.

**Da fare**, mezza giornata: la stessa cosa con Playwright, a 375, 768 e
1280 px, con uscita in errore se una qualsiasi rotta sposta la pagina o espone
comandi sotto soglia. Solo cosi diventa una prova che qualcuno esegue senza
ricordarsene: finche va lanciato a mano, prima o poi non si lancia piu.

## Com'e finita

| Rotta | Prima | Dopo |
|---|---|---|
| `/partite` | sfora **300 px** | — |
| `/squadre/:id` | sfora **135 px** | — |
| `/partite/:id` | sfora **100 px** | — |
| `/partite/:id/statistiche` | sfora **26 px** | — |
| tutte | comandi sotto soglia | — |

Le tre cause sono state tolte alla radice: `.tabella-scorrevole` attorno a ogni
tabella, `flex-wrap` su `.riga` e `.riga-sp`, barra di navigazione in basso
sotto i 760 px. Piu due difetti emersi solo misurando **dopo**:

- **L'intestazione sforava di 14 px** a 375: marchio esteso piu quattro
  comandi non ci stanno. Sotto i 520 px resta il solo pallone. La barra
  inferiore, che e `fixed` sul documento, ereditava quella larghezza e si e
  sistemata da se — un difetto solo, non due.
- `button.piccolo` era fissato a **38 px** sotto puntatore grossolano, cioe
  sotto la soglia che questa pagina dichiarava. O si alzava a 44, o la soglia
  era una promessa da non fare. E stata alzata: le righe delle tabelle sono
  piu alte quando si tocca, ed e il prezzo giusto.

## Il secondo giro: da dashboard a telecronaca

Il primo restyling aveva tolto i difetti e aggiunto le icone, ma la struttura
era rimasta quella di sempre: fondo grigio, schede bianche arrotondate, barra
di navigazione in alto. **Si riconosceva a colpo d'occhio come un modello
generico**, ed e esattamente il giudizio che e arrivato. Il difetto non erano i
colori: era l'impianto.

Cambiato il riferimento. Non le dashboard aziendali, ma le **grafiche da
telecronaca**. Tre scelte portano tutto il carattere:

### 1. Tipografia condensata

`Barlow Condensed` per titoli, numeri, etichette e comandi: maiuscolo,
spaziato, stretto. E la scrittura dei tabelloni. Il testo corrente resta in
`Inter`, perche li serve leggerlo, non riconoscerlo.

E il singolo cambiamento che sposta di piu. Un'interfaccia in Segoe UI e un
documento; la stessa in condensato maiuscolo e un prodotto sportivo.

### 2. I numeri sono il contenuto

Le statistiche non sono piu etichette accanto a una barra: sono **cifre
grandi, tabulari, nel colore della squadra**, e sono loro il comando — si tocca
il 59 per vedere da dove viene, non un pulsante di fianco al 59.

### 3. Due squadre sono un incontro, non un elenco

Ovunque compaiano due squadre — elenco, dettaglio, statistiche — la
disposizione e la stessa: fascia colore, nome condensato, punteggio in mezzo.
Sta in un componente solo (`Squadre` in `Ui.tsx`), quindi cambiarla la cambia
dappertutto.

**L'elenco partite non e piu una tabella.** Sette colonne raccontavano un
incontro peggio di una riga da tabellone: ora ogni partita e una riga con le
due squadre affiancate, e la stessa disposizione regge su telefono andando a
capo invece di cambiare impianto.

### E poi l'impianto

| Prima | Adesso |
|---|---|
| Barra di navigazione in alto | **Colonna laterale** che resta ferma; sotto i 1000 px si stringe alle icone, sotto i 760 scende in fondo |
| Angoli arrotondati 10 px | 4 px: le grafiche sportive non sono morbide |
| Accento blu aziendale | Il **giallo del pallone**, unico colore acceso |
| Tema chiaro predefinito | **Scuro predefinito**: e cosi che si guardano gli sport |
| Fondo grigio piatto | Linee di campo diagonali e il bagliore dei fari |

**La colonna segue il tema come tutto il resto.** Avevo scelto di tenerla
scura in entrambi — "la striscia di regia" — ed era una scelta sbagliata: un
interruttore del tema che lascia mezza schermata com'era non sembra una scelta
di stile, sembra un interruttore rotto.

Il motivo per cui l'avevo tenuta scura era pero vero: il giallo `#ffcc00`
sparisce sulla carta chiara. Si risolve dove va risolto, cioe **sul colore**.
`--palla` cambia valore fra i due temi — oro pieno sul nero, oro brunito
`#b07d00` sulla carta — senza cambiare identita. E il colore a doversi
adattare, non il fondo a restare scuro.

Il tema chiaro non e piu "il bianco da ufficio" ma **carta calda**: il referto
stampato, non un foglio elettronico.

### Un difetto trovato solo misurando dopo

`.indicatore .valore` ha specificita maggiore di `button`, quindi il suo
`min-height: 0` scavalcava la regola sulle aree toccabili e i numeri delle
statistiche restavano sotto i 44 px al tocco. Va **nominato** dentro
`@media (pointer: coarse)`. E il tipo di errore che nessuna rilettura trova e
che l'audit trova subito.

## Il sistema di stile

`apps/web/src/stile.css`, ~330 righe. **Due temi, un solo insieme di
variabili**: i componenti non conoscono i colori, usano i ruoli
(`--sfondo`, `--carta`, `--primario`) e il tema li riempie.

### Da dove viene l'identita

Il campo da gioco, non un tema generico:

| Elemento | Scelta |
|---|---|
| Marchio | il pallone con le tre fasce curve, disegnato a mano in `Icone.tsx` |
| Oro `--palla` | `#ffcc00` sul nero, `#b07d00` sulla carta: **stessa identita, valore diverso**, perche il giallo acceso non si legge sul chiaro |
| Filo sotto i titoli | tre pixel di giallo — e la linea di fondo campo |
| `--terreno` | parquet sotto i fari di notte, sabbia calda di giorno |
| Icone | pallone, rete, campo, maglia, trofeo, fischietto: dicono "pallavolo" dove un'icona generica direbbe "gestionale" |
| Sfondo | due diagonali di campo e il bagliore dei fari, appena accennati |

Le icone sono disegnate, non importate da una libreria. Una libreria generica
ne porterebbe duemila e nessuna di queste.

### I due temi

Tre stati, non due: `sistema` e il valore iniziale e segue il dispositivo. Chi
sceglie esplicitamente vince, e la scelta resta in `localStorage`. Partire da
"chiaro" ignorerebbe chi tiene il telefono in scuro tutto il giorno.

Il tema si scrive su `<html data-tema>`; `<meta name="theme-color">` viene
aggiornato di conseguenza, altrimenti su mobile la barra del browser resta
bianca sopra un'applicazione scura e si vede la cucitura.

### Le regole che valgono per le schermate nuove

0. **Prima di aggiungere una tabella, chiediti se e un elenco.** Un incontro,
   un confronto, un tabellino non lo sono: la tabella li appiattisce. L'elenco
   partite era una tabella a sette colonne ed e diventato righe da tabellone.
1. **Ogni `<table>` che resta sta dentro `.tabella-scorrevole`.** Sempre.
2. **Colori solo dalle variabili.** Un `#fff` scritto a mano funziona in un
   tema e rompe l'altro.
3. **Spaziature da `--sp1`…`--sp7`**, misure da `--t-*`. I numeri a mano sono
   il motivo per cui l'interfaccia sembrava disordinata.
4. **Le aree toccabili le impone `@media (pointer: coarse)`**, che e legato al
   puntatore e non alla larghezza: un tablet largo si tocca lo stesso.
5. **Sette colonne non stanno su un telefono.** Dove servono, si aggiunge
   `.elenco-schede` per lo stretto e `.solo-largo` sulla tabella.
6. **Attenzione alla specificita quando si scrivono regole sui comandi.** Un
   selettore piu specifico di `button` scavalca le regole sulle aree toccabili
   e va nominato nel blocco `@media (pointer: coarse)`.

## Cosa manca ancora

- **Gli stili in linea nei componenti.** Restano decine di `style={{...}}`.
  Vanno in classi, altrimenti cambiare l'aspetto significa aprire venti file.
- **Stati di caricamento come sagoma** invece che come parola.
- **L'audit automatico con Playwright**: oggi lo script va lanciato a mano.

## Quanto e costato e quando farlo

| Intervento | Stima | Quando |
|---|---|---|
| 1 — tabelle scorrevoli e schede | 1 g | **subito** |
| 2 — righe a capo | 0,5 g | **subito** |
| 3 — navigazione in basso | 1 g | **subito** |
| 4 — aree da 44 px | 0,5 g | **subito** |
| 5 — restyling, token, stili in linea | 2-3 g | prima della Fase 2 |
| Script di verifica | 0,5 g | insieme al punto 1 |

**Da 1 a 4 piu lo script: circa 3,5 giorni**, e chiudono tutto quanto e stato
misurato. Il punto 5 e lavoro di cura e puo seguire, ma **prima che la Fase 2
aggiunga le sue schermate**: dopo costerebbe il doppio, perche andrebbe
applicato anche a quelle.
