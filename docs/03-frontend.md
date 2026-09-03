# Interfaccia

React + Vite + TypeScript. `apps/web/src/`.

```
platform/     livello di astrazione delle piattaforme — l'unico che tocca l'ambiente
api/          client HTTP con rinnovo automatico della sessione
auth/         contesto di autenticazione
componenti/   componenti condivisi
pagine/       una per schermata
stile.css     token e stili — corrisponde a ../docs/09, capitolo 2
```

## Come si aggiunge una schermata

1. Crea il file in `pagine/`.
2. Registra la rotta in `App.tsx`. **Se la schermata non ha senso su una
   piattaforma, non registrarla**: non nasconderla.
3. Usa `useQuery` per leggere e `useMutation` per scrivere.
4. Avvolgi il contenuto in `<Stato>`: impone caricamento, errore, vuoto.
5. I filtri vanno nell'indirizzo (`useSearchParams`), non nello stato locale:
   cosi la vista e ricaricabile e condivisibile.

## Componenti condivisi

`componenti/Ui.tsx`: `Carta`, `Campo`, `Stato`, `Pillola`, `Squadre`, piu i
formattatori `gb()` e `data()`.

`Formazioni.tsx` chiede prima **quanti set ha avuto la partita** — e gia stata
giocata, il numero si sa — e poi presenta un set alla volta come **campo visto
dall'alto**: rete in cima, 4-3-2 in prima linea, 5-6-1 in seconda. Ogni casella
e un pulsante: mostra il giocatore o un `+`. Il `+` apre il selettore **sotto la
linea a cui la casella appartiene**, non in fondo alla scheda, cosi resta
accanto a quello che si e toccato.

Il selettore elenca i giocatori gia salvati per quella squadra, meno quelli gia
in campo. Se il giocatore non c'e, si crea li: numero, cognome, nome, ruolo, e
una spunta — attiva per impostazione predefinita — che lo aggiunge anche al
roster della squadra, con la persona collegata. Senza persona non esistono le
statistiche fra partite diverse, quindi il collegamento non e opzionale: se non
se ne indica una, il server ne crea una.

`SelettoreAnagrafica.tsx` fa lo stesso per squadre e campionati nel modulo di
nuova partita. Non esistono anagrafiche comuni (decisione 9d): alla prima
partita l'elenco e vuoto **per definizione**, e mandare l'utente su un'altra
schermata gli farebbe perdere quanto ha gia scritto. L'ultima voce della tendina
e "non e in elenco: creala", che sostituisce la tendina con nome e stagione e
poi seleziona da se cio che ha creato. La squadra gia scelta come casa non
compare fra le ospiti.

`SquadraDettaglio.tsx` mostra il roster come **album di figurine**, non come
tabella. Le informazioni sono le stesse; il modo di leggerle no. Una squadra e
un gruppo di persone, e un gruppo di persone si guarda: volto, numero grande in
filigrana, cognome, ruolo. La fascia in alto e blu, arancione per i liberi.

Si modifica **una figurina per volta**, aprendola. La figurina aperta pero
**non e una figurina**: e un modulo, e prende la riga intera. Dentro una cella
larga quanto una figurina i campi si incolonnavano tutti e la scheda diventava
altissima e storta. Due colonne: a sinistra cio che si guarda (volto e stili),
a destra cio che si compila, con larghezze proporzionate al contenuto — il
numero di maglia non ha bisogno dello spazio di un cognome.

La spunta "libero" **sparisce quando il ruolo dice gia "libero"**: due comandi
per la stessa cosa sono cio che li faceva discordare (intervento 20). La modifica di massa che
c'era prima — tutte le righe insieme, un salvataggio solo — era comoda per chi
inserisce venti giocatori di fila e scomoda per il caso normale, che e
correggere un numero.

`Avatar.tsx` genera i volti con `@dicebear`. **Generati, non caricati**: due
stringhe — stile e seme — da cui esce un SVG. Niente file significa niente
archiviazione, niente ritaglio, niente moderazione di immagini: per una prima
versione e il compromesso giusto, e le fotografie si potranno aggiungere dopo
senza disfare nulla, perche il resto chiede "l'avatar di questa persona" e non
"il file di questa persona".

**L'avatar sta sulla persona, non sulla riga di roster**: altrimenti lo stesso
giocatore avrebbe una faccia diversa in ogni squadra. Chi non ha una persona
collegata riceve comunque un volto, derivato dal nome — sempre lo stesso — ma
non puo sceglierlo. E l'ennesima ragione concreta per collegare le persone.

`TabellaGiocatori.tsx` e il tabellino: una riga per giocatore, colonne
raggruppate per fondamentale. **Ogni cella con un numero e cliccabile** e porta
agli eventi che la compongono, come per le statistiche di squadra: non e una
funzione in piu, e la conseguenza di come e scritto il motore.

Dichiara sempre che **la somma delle righe non fa il totale di squadra**,
perche il fornitore non riconosce tutti i giocatori (circa il 5% dei tocchi sui
dati reali). Chi confronta i due numeri e se ne accorge da solo pensa a un
difetto: meglio dirlo prima.

`Stagione.tsx` (`/statistiche`) aggrega su piu partite. Le due cose che deve
dire sempre, e che nessun'altra schermata dice: **su quali partite valgono** —
con l'elenco apribile — e **chi resta fuori**, cioe chi non ha una persona
collegata.

`Cambi.tsx` registra le sostituzioni, un set per volta. Si sceglie chi esce e
chi entra **dal roster**, non digitando un numero: cosi non si registrano cambi
di giocatori che non esistono. Si chiede il minuto, non il fotogramma.

`Persone.tsx` guida l'unione dei duplicati. Le coppie portano con se squadre e
partite perche **quando i due nomi coincidono davvero** quello e l'unico dato
con cui si decide: chiedere "quale tieni?" mostrando due volte la stessa
scritta non e una domanda.

`Pagine` in `Ui.tsx` non elenca i numeri di pagina — con molte partite sarebbe
una fila di cifre inutile — e **sparisce da sola** quando c'e una pagina sola:
un comando che non fa nulla e peggio di nessun comando.

`RosterPartita.tsx` rende il roster correggibile riga per riga. Un solo
`Modulo` serve sia l'aggiunta sia la correzione: i campi sono gli stessi, e
duplicarlo significherebbe correggere due volte ogni validazione. Il rifiuto
della rimozione compare **nella riga da cui si e premuto**, non in cima alla
pagina: chi lo legge sta guardando quella riga.

`Caricamento.tsx` guida il trasferimento passando **sempre** dal livello di
astrazione: non chiama mai direttamente la rete per i blocchi.

Tre cose che la schermata dichiara invece di nascondere:

- **Su mobile il caricamento avviene solo con l'applicazione aperta.** Non c'e
  servizio in secondo piano, e dirlo prima e piu onesto che lasciare l'utente
  davanti a una barra ferma. Uscendo dal primo piano il trasferimento si sospende.
- **Su rete a consumo avvisa**, non blocca: caricare i propri gigabyte su rete
  dati e una scelta dell'utente. Dove il sistema non espone il tipo di
  connessione, l'avviso non compare: meglio tacere che sbagliare.
- **La ripresa chiede di riscegliere lo stesso file.** Il server conserva i byte
  ricevuti, non il file: nessuna applicazione puo riaprire da sola un file
  scelto in una sessione precedente. La schermata dice a che percentuale si era
  arrivati e quale file serve; se nome e dimensione non coincidono, rifiuta e
  propone di annullare.

## Stile

CSS con variabili, non Tailwind. I token corrispondono a quelli documentati:
colori semantici, colori squadra fissi e distinguibili, cifre tabulari sui
numeri. Le classi sono semantiche (`carta`, `pillola`, `avviso`): passare a
Tailwind in seguito non richiede di riscrivere la struttura.

## Sessione

`api/client.ts` rinnova il token da se al primo 401 e, se il rinnovo fallisce,
riporta all'accesso. I componenti non se ne occupano.
