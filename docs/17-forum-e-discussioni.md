# Forum e discussioni — proposta

Idea: uno spazio dove gli utenti lasciano messaggi, filtrabili per partite,
campionati e simili.

**Il vincolo che l'ha fatta nascere gia risolta a meta**: le anagrafiche sono
private (punto 9d), quindi la squadra "Pallavolo Senigallia" creata da Mario
non esiste per Luca. Dieci utenti che seguono la stessa squadra reale hanno
dieci righe `Team` scollegate, senza nulla che le unisca.

Quindi **non si puo filtrare per squadra o per partita**: quei nomi non sono
condivisi. Il filtro dev'essere generico, come giustamente osservato.

## Cosa puo essere condiviso, e cosa no

| | Condivisibile? | |
|---|---|---|
| Le squadre dell'utente | **no** | esistono in un solo account |
| Le sue partite | **no** | idem, salvo condivisione esplicita |
| Le sue persone | **no** | idem |
| Il **campionato reale** (Serie B maschile, VNL) | **si** | e un fatto del mondo, non un dato dell'utente |
| La **categoria** (U16, seniores, femminile) | **si** | idem |
| Il **fondamentale** (muro, ricezione) | **si** | e vocabolario del gioco |
| Il tool stesso | **si** | |

Il forum puo appoggiarsi solo alla colonna di destra. Serve quindi un
**vocabolario condiviso che oggi non esiste**: un elenco di argomenti
mantenuto dall'amministrazione, non generato dagli utenti.

E lo stesso buco che il punto 9d chiama "anagrafiche pubbliche riutilizzabili
= evoluzione futura". Il forum lo incontra per primo.

## Due strade

**A. Tassonomia curata** — un elenco di argomenti gestito da admin
(campionati reali, categorie, fondamentali, il tool). Gli utenti scrivono
sotto quelle etichette. Nessun legame con i dati privati, quindi nessun
rischio di far trapelare cio che non deve uscire. Poco lavoro.

**B. Anagrafiche pubbliche** — entita reali condivise (societa vere,
campionati veri) a cui le squadre private possono puntare. Sblocca molto di
piu ("tutti quelli che seguono questa squadra"), ma e un lavoro grosso e
apre la questione di chi le mantiene aggiornate.

**Per ora A.** B resta l'evoluzione, e il forum non e la ragione giusta per
farla.

## Il ponte con i dati privati

C'e un modo per collegare i due mondi senza rompere la separazione: **si puo
allegare a un messaggio una propria partita, ma solo se la si condivide.**

La condivisione esiste gia (`TeamShare`, `CompetitionShare`). Allegare una
partita a un messaggio pubblico diventa un caso di condivisione, con la stessa
regola: **se non l'hai condivisa, gli altri vedono il titolo e nient'altro.**

Cosi il filtro resta generico, ma la discussione puo diventare specifica —
ed e li che sta il valore.

## Il parere che non e stato chiesto

**Un forum generico e la versione piu debole di questa idea.**

Discussioni sulla pallavolo esistono gia su Facebook, Reddit e WhatsApp, con
piu utenti e nessun costo per noi. Un forum dentro il tool competerebbe con
quelli partendo da zero iscritti, e porterebbe **moderazione, abusi, contenuti
illeciti e responsabilita legale** — un costo ricorrente, non una funzione che
si rilascia e si dimentica.

Quello che invece **nessun altro posto puo fare** e discutere di un dato che
esiste solo qui:

> "Guarda questa ricezione, fotogramma 3468: perche il libero e li?"

Un commento **ancorato a un'azione, a uno scambio o a una statistica**, con il
video che salta al punto giusto. Non e un forum: e la conversazione che il
tool rende possibile e che altrove sarebbe uno screenshot sfocato.

### La proposta alternativa, in ordine di costo

| | Costo | Valore |
|---|---|---|
| **1. Commenti su una partita condivisa** | ~1,5 giorni | alto: usa quel che c'e gia, zero moderazione pubblica |
| **2. Commenti ancorati all'azione**, col salto al fotogramma | ~2 giorni | **il pezzo differenziante** |
| 3. Bacheca pubblica con tassonomia curata | ~4 giorni | medio, e apre la moderazione |
| 4. Anagrafiche pubbliche | settimane | alto ma prematuro |

I primi due non hanno bisogno di nessuna tassonomia, di nessun vocabolario
condiviso e di nessun moderatore: **la cerchia e gia definita da chi ha
ricevuto la condivisione.**

## Se si fa comunque la bacheca

Note minime, per non rifarle dopo:

- gli argomenti sono **etichette globali**, in tabella, gestite da admin
- un messaggio ha **un argomento obbligatorio** e uno facoltativo
- serve **segnalazione e rimozione** dal primo giorno, non dal secondo rilascio
- serve una **decisione sul nome visibile**: nome vero o soprannome? Oggi
  `User` non ha un nome pubblico, e mostrare nome e cognome di un privato in
  una pagina pubblica e una scelta da prendere apposta, non per inerzia
- i messaggi vanno nell'**esportazione GDPR** e nella cancellazione account
