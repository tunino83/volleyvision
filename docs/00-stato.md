# Stato del progetto

Aggiornato alla prima consegna della Fase 1.

## Verificato funzionante

Provato end-to-end, non solo compilato:

| Area | Prova eseguita |
|---|---|
| Accesso | login, token, rinnovo, `/auth/me` |
| Anagrafiche | 2 squadre da 12 giocatori con persone collegate |
| Partite | elenco, dettaglio, completezza, roster importato |
| Formazioni | set 1 precompilato e riletto correttamente (4-3-2 / 5-6-1) |
| Formazioni, campo | numero di set dichiarato, `+` su ogni posizione, giocatore scelto dal roster |
| Formazioni, nuovo giocatore | creato dal selettore, finito nel roster partita **e** in quello squadra, con persona collegata |
| Anagrafiche al volo | squadra creata dal modulo di nuova partita e selezionata da se; la squadra di casa sparisce dalle ospiti |
| Roster, correzione | numero 9 → 19 dall'interfaccia, riga riordinata; numero gia occupato rifiutato con il nome di chi lo ha |
| Roster, rinumerazione | cambiando 7 in 77 le formazioni dei set 1 e 2 hanno seguito |
| Roster, rimozione | rifiutata finche il giocatore e in formazione, con l'elenco dei set; riuscita quando non lo e piu |
| Caricamento | blocchi, **ripresa da offset errato**, completamento, rifiuto di file incompleto |
| Caricamento, ripresa | riaprendo con **lo stesso file** la sessione e riusata (`ripresa: true`); con un file diverso si ricomincia e i byte vecchi sono eliminati |
| Caricamento, annullo | `DELETE /uploads/:id` riporta il lato ad ASSENTE e cancella i byte |
| Caricamento da mobile | avviso "solo in primo piano" mostrato con user agent mobile; blocchi da 2 MB |
| Ciclo di vita | transizioni con guardie, valutazione automatica dell'avvio |
| Notifiche | campanellina con conteggio corretto |
| Interfaccia | accesso, home, dettaglio partita, formazioni — nel browser |

## Riepilogo per modulo

| Modulo | Backend | Interfaccia |
|---|---|---|
| Autenticazione | completo, con identita multiple | accesso, registrazione, verifica email, password dimenticata, reimposto, profilo |
| Gestione utenti | completo | elenco, **creazione con invito**, correzione, ruoli, sospensione, reimposto, eliminazione |
| Utenti e ruoli | completo | completo |
| Accesso con Google | scheletro pronto, non attivo | il profilo dichiara i modi di accesso |
| Registro operazioni | completo | completo (sola lettura) |
| Reportistica | completo | completo |
| Squadre e roster | completo, con aggiunta/correzione/rimozione per giocatore | **album di figurine** con avatar generati |
| Avatar | sulla persona, stile e seme | scelta fra 8 stili, "cambia faccia", ricadute sul nome |
| Campionati | completo | elenco, creazione, correzione, eliminazione, condivisione |
| Persone | completo, incluso unione duplicati | elenco, ricerca, correzione, **unione guidata dei duplicati** |
| Condivisione | completo | squadre e campionati |
| Partite | completo | completo |
| Roster di partita | completo | importazione, aggiunta, correzione e rimozione riga per riga |
| Formazioni | completo | completo (numero di set, campo, selettore con creazione) |
| Sostituzioni | completo | completo (scheda per set, scelta dal roster, minuto) |
| Caricamento | completo (driver locale) | completo |
| Ciclo di elaborazione | completo | completo |

## Cosa manca

Sta in **`12-cosa-manca.md`**, tenuto aggiornato. In breve: la Fase 1 e finita
sul piano funzionale e le manca solo la messa in esercizio (email, cloud,
PostgreSQL); la Fase 2 ha gia motore statistiche, tabellino, statistiche di
stagione e riproduzione video, e le mancano il pacchetto scaricabile, il campo
2D e i **dati veri del fornitore**.

## Verificato in questa tornata (statistiche e coerenza)

| Prova | Esito |
|---|---|
| Coerenza stato/azioni | su una partita `READY` il server rifiuta numero di set, formazione, nuovo giocatore e caricamento video con `STATO_NON_CONSENTE`; i **cambi restano possibili**, per progetto |
| Numero di set | letto dall'analisi (4), non piu chiesto all'utente |
| Statistiche di squadra | 13 indicatori in 5 gruppi, comprese le metriche nuove |
| Tabellino giocatori | 24 giocatori, 4.9% dei tocchi senza giocatore **dichiarato a schermo** |
| Explainability per cella | i 10 punti di Ferrari mostrano 10 eventi con set, punteggio, fondamentale, esito, fotogramma |
| Statistiche di stagione | aggregate per persona; 7 voci senza persona collegata segnalate |

## Verificato in questa tornata

| Prova | Esito |
|---|---|
| Paginazione partite | pagina 1 e 3 senza sovrapposizioni; `perPagina=99999` limitato a 100 |
| Filtri nel database | tag `prova-pagine` trova 9, tag `prova` ne trova **0** (nessuna corrispondenza per prefisso) |
| Sostituzioni | cambio valido registrato; rifiutati giocatore fuori roster, esce=entra, e cambio senza momento |
| Condivisione campionato | aggiunta e revoca dalla scheda |
| Unione persone | due omonime unite; le presenze riassegnate sono state contate e dichiarate |
| Riconciliazione | il servizio parte all'avvio e dichiara l'intervallo nel registro |
| Statistiche sui dati di esempio | 176 azioni, 1192 tocchi, 4 set; sette indicatori e explainability (clic su 59 → le 59 azioni con set, punteggio, maglia, fotogramma) |

## Cosa non e ancora presentabile

L'interfaccia ha ora un'identita e regge il telefono
(`10-restyling-e-responsive.md`). Restano gli **stili in linea** sparsi nei
componenti e le sagome di caricamento. Non e bloccante, ma va chiuso prima che
la Fase 2 aggiunga le sue schermate.

## Deviazioni dai documenti di analisi

Consapevoli, per far girare il progetto senza dipendenze esterne. Tutte
reversibili, dettagli in `05-interventi.md`.

| Documentato | Realizzato | Perche |
|---|---|---|
| pnpm | npm workspaces | pnpm non presente sulla macchina |
| PostgreSQL | SQLite | nessun database installato; una riga per cambiare |
| Tailwind | CSS con token | meno pezzi mobili, stessi token di `docs/09` |
| Provider di autenticazione gestito | JWT locale | nessun account esterno necessario |
| Archiviazione cloud | disco locale | nessuna credenziale necessaria |

## Numeri

Circa 60 file di codice. Backend: 8 moduli, 40 rotte. Interfaccia: 11 schermate.
Modello dati: 15 entita.
