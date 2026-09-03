Oggetto: Volley Vision — uso senza connessione e installazione sul computer

Buongiorno,

ti aggiorno su una parte che si e rivelata piu semplice e piu economica del
previsto: **l'uso dell'applicazione senza connessione, e la sua installazione
sul computer dell'utente.**

## In breve

**Sui computer** l'applicazione web puo essere **installata come un normale
programma**: icona propria, finestra propria, voce nel menu Start o nel Dock.
Una volta installata **si apre e funziona anche senza connessione**.

Su telefoni e tablet resta prevista l'applicazione dedicata, distribuita
tramite App Store e Play Store: quanto segue riguarda quindi l'uso da
computer.

Non serve costruire un'applicazione desktop separata per Windows e macOS.
Questo elimina installatori, firma del codice, notarizzazione Apple e la
realizzazione di un sistema di aggiornamento automatico.

## Come funziona

L'utente apre il sito e il browser gli propone di installarlo. Da quel
momento:

- **i file dell'applicazione restano sul suo computer**, quindi si apre anche
  senza rete;
- **i dati vengono scaricati automaticamente**: squadre, campionati, persone e
  le partite analizzate;
- **i video non vengono mai copiati**: restano sul disco dell'utente e
  l'applicazione li riproduce da li, con il salto al singolo fotogramma.

Il peso e trascurabile. Un pacchetto di analisi completo di una partita —
tutti gli eventi, le azioni, i set — occupa **120-180 KB**. Cento partite sono
circa **18 MB**. Il video della stessa partita ne occupa 5.000: **il rapporto
e di ventinovemila a uno**, ed e la ragione per cui i dati possono essere
tenuti in locale senza costi ne per noi ne per l'utente.

## Cosa si puo fare senza connessione

- consultare squadre, campionati e giocatori;
- vedere le statistiche delle partite scaricate, per squadra e per giocatore,
  con grafici e schede;
- calcolare le statistiche su piu partite;
- guardare il video della partita e saltare al fotogramma della singola azione.

**Senza connessione l'applicazione si consulta ma non si modifica.** E una
scelta di progetto: creare una partita, compilare un roster o caricare un
video sono operazioni che si fanno da fermi, dove la rete c'e — e il
caricamento del video la richiede per definizione. Consultare i dati e invece
esattamente cio che si fa lontano dalla rete: in palestra, in trasferta, in
viaggio.

## Vantaggi rispetto a un'applicazione desktop tradizionale

|  | Applicazione desktop | Soluzione adottata |
|---|---|---|
| Installatore da distribuire | si | no |
| Firma del codice Windows | ~300-500 €/anno | non necessaria |
| Notarizzazione Apple | 99 $/anno, a ogni versione | non necessaria |
| Aggiornamento | da realizzare e mantenere | automatico |
| Peso dello scaricamento | 80-150 MB | ~1 MB |
| Versioni da costruire | Windows e macOS separate | una sola |

**Gli aggiornamenti sono automatici**: alla riapertura successiva l'utente ha
sempre l'ultima versione, senza scaricare nulla e senza doverlo sapere. Se
tiene l'applicazione aperta a lungo, viene avvisato che ne e disponibile una
nuova.

## Limiti da tenere presenti

**L'uso senza rete e in sola consultazione.** Le modifiche richiedono la
connessione. I comandi non compaiono affatto quando non sono utilizzabili,
cosi l'utente non prova operazioni che non andrebbero a buon fine.

**Le partite si scaricano automaticamente solo con l'applicazione installata.**
Chi la usa in una scheda del browser conserva le anagrafiche e le partite che
apre; puo scaricare tutto con un comando esplicito. La distinzione e voluta:
tutelare chi accede da un computer non suo, senza porre domande a nessuno.

**Il collegamento al video con memoria del file** e disponibile su Chrome ed
Edge. Su Safari il file va riselezionato a ogni sessione.

**L'uso continuato senza mai collegarsi ha una durata massima di 30 giorni**,
dopo i quali viene richiesto un nuovo accesso.

**Alcune configurazioni aziendali impediscono l'installazione.**
L'applicazione resta pienamente utilizzabile in una scheda del browser.

**Su un dispositivo condiviso**, chi apre l'applicazione trova l'ultimo utente
collegato, fino a quando questi non esce: l'uscita cancella tutti i dati
locali.

## Da completare

Le funzioni sono realizzate e il codice e verificato. **Restano da collaudare
sul campo l'installazione e l'apertura senza rete**: l'ambiente di sviluppo
utilizzato non consente di eseguire il componente che le governa. Si tratta di
una verifica breve, su browser Chrome o Edge, prevista come prossimo passo.

E ancora da misurare, sui file video reali del fornitore, la precisione del
salto al fotogramma. In attesa, l'applicazione dichiara a schermo il margine
di approssimazione anziche darlo per garantito.

## Prossimi passi proposti

1. Collaudo dell'installazione e dell'apertura senza rete.
2. Verifica della precisione del salto al fotogramma sui video del fornitore,
   e richiesta al fornitore delle caratteristiche tecniche dei file.
3. Definizione del dominio di esercizio, necessario per l'attivazione
   completa del riconoscimento dell'installazione.

Resto a disposizione per un confronto.

Cordiali saluti
