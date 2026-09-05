# Cosa manca

Aggiornato il 2026-09-05. Fotografia onesta, ordinata per **cosa blocca**,
non per difficolta.

Regola di questo file: ogni voce dice *perche* blocca. Un elenco di cose da
fare senza il motivo diventa, dopo un mese, un elenco di cose che nessuno sa
piu se servano.

---

## 1. Registrazioni e account esterni

Sono le cose che **non possiamo fare noi**: richiedono un account intestato a
qualcuno, e spesso una carta di credito. Vanno cominciate presto perche
alcune hanno tempi di attesa che non dipendono da nessuno.

| Cosa | Serve per | Costo | Chi |
|---|---|---|---|
| **Servizio di invio email** | verifica indirizzo, reimposto password, inviti. **Oggi nessuna email parte**: finiscono a terminale, e un utente vero non completa la registrazione | gratis fino a ~3.000/mese | da aprire |
| **Dominio + record DNS** | senza SPF, DKIM e DMARC le email finiscono nello spam anche col miglior fornitore. Vedi §2 | ~15 €/anno | da aprire |
| **Progetto Firebase** | notifiche push sul telefono. Il guscio Android e **gia predisposto**: `classpath com.google.gms:google-services` c'e, l'`apply plugin` scatta appena si aggiunge `google-services.json` | gratis, senza limiti di volume | da aprire |
| **Account Google Play** | pubblicare l'app Android. Oggi l'APK si installa a mano da "origini sconosciute" | 25 $ una tantum | da aprire |
| **Account Apple Developer** | iOS: senza, non si compila nemmeno per il proprio telefono | 99 $/anno | da aprire |
| **Un Mac** | non si costruisce per iOS senza macOS e Xcode. Nessuna eccezione | — | da decidere |
| **Archiviazione oggetti** (S3, GCS, R2) | oggi i video stanno su disco e **spariscono a ogni riavvio** di Render. Vedi §2 | a consumo | da aprire |
| **Titolarita dell'infrastruttura** | chi possiede server, dominio, certificati e archiviazione **non e deciso**, e non e nell'offerta | — | **da decidere, non da comprare** |

---

## 2. Blocca l'esercizio con utenti veri

### Email che partono davvero

`MailService` ha un solo driver, `console`: scrive a terminale. Ci sono **8
punti di invio** e 5 tipi di messaggio, tutti dietro quell'interfaccia, quindi
il cambio e **un file solo**.

Il consiglio su come farlo sta in fondo, §7.

**Stima**: mezza giornata, una volta scelto il fornitore.

### I video non sopravvivono a un riavvio

Su Render il piano gratuito non ha disco persistente, e il resto del
filesystem e effimero: **ogni deploy cancella i video caricati**. Regge per
una demo, non per un utente vero che carica 5 GB.

`uploads/storage.ts` e gia scritto con un'interfaccia pensata per entrambi i
casi. Serve il driver per l'archiviazione a oggetti, e i byte devono smettere
di passare dall'API (regola 4).

**Stima**: 2-3 giorni, piu la scelta del fornitore.

### Le prime notifiche

Oggi c'e la campanellina, che va guardata. Il giro reale e: carichi dopo la
partita, vai a dormire, e la mattina dovresti ricordartene.

Lato server esiste **un solo punto** in cui nasce una notifica
(`analysis.service.ts:97`): l'invio push e una riga accanto a quella. Il
permesso `POST_NOTIFICATIONS` e gia dichiarato e gia chiesto dal plugin.

Le due cose che si dimenticano e che poi si pagano:
- i gettoni **scadono e cambiano**: vanno rinnovati e cancellati quando FCM
  dice che non valgono piu, o si accumula spazzatura;
- **uscire dall'account deve cancellare il gettone**, o il prossimo utente di
  quel telefono riceve le notifiche del precedente. E un difetto di
  riservatezza, e non si vede mai in prova.

**Stima**: 2-3 giorni.

---

## 3. Sicurezza

| Cosa | Perche | Stima |
|---|---|---|
| **CORS aperto a chiunque** | `main.ts:13` ha `origin: true` con `credentials: true`: l'API rimanda indietro qualunque `Origin`. Verificato in esercizio. Oggi il danno e limitato (il gettone sta in `localStorage`, non in un cookie), ma diventa sfruttabile il giorno che si aggiunge un cookie. Attenzione: `https://localhost` **serve**, e l'origine del WebView Capacitor | 1 ora |
| **Gettoni in `localStorage`** | leggibili da qualunque script eseguito nella pagina | 1 giorno |
| **Segreto JWT nel file di configurazione** | su Render e gia una variabile d'ambiente; in locale no | 1 ora |
| **Nessun freno ai tentativi di accesso** | la tabella `TentativoAccesso` esiste **e non e usata per frenare nessuno** | mezza giornata |

---

## 4. Debito e qualita

**Nessuna prova automatica.** C'e un solo script scritto a mano per
l'adattatore (`analysis/__prove__/`), e nessun esecutore configurato.

Non e teoria: in una sola giornata sono usciti tre difetti che nessuna
compilazione poteva vedere — un APK che puntava a `localhost`, un APK che
conteneva l'APK precedente, una casella di spunta larga quanto lo schermo.
Un minimo di prove sul motore statistiche e sull'adattatore si ripaga alla
prima regressione.

**Stima**: 2 giorni per l'impianto piu le prove che contano.

Altre voci minori, in `docs/05-interventi.md`: catalogo delle stringhe
(14), ridondanza `ruolo`/`libero` (20).

---

## 5. Funzionalita non fatte

In ordine di valore rispetto al costo, **dentro il Livello A** deciso.

| Cosa | Perche | Stima |
|---|---|---|
| **Sincronizzazione video → evento** | oggi si va dall'azione al video, non il contrario. Guardare il video e vedere l'azione corrente illuminarsi e cio che fa sembrare un banco di analisi invece di un elenco | 2 giorni |
| **Chi era in campo** | formazioni e sostituzioni sono gia nel database, ma nessuno li usa insieme. Sapere quali sei erano in campo durante un'azione e la domanda di un allenatore, e i dati ci sono gia | 1-2 giorni |
| **Pacchetto partita scaricabile** | l'API restituisce il pacchetto ma non esiste il download, ne la verifica di integrita | 2 giorni |
| **Scorciatoie da tastiera** | un banco di analisi si usa con la tastiera | 1 giorno |
| **Cambio lato** | passare da lato 1 a lato 2 tenendo il punto di gioco. Dipende da `frameDelta`, che oggi vale 0 e **non sappiamo se e vero** | dipende dal fornitore |

Restano **fuori per decisione**, non per dimenticanza: correzione degli
eventi, filtri personalizzati, montaggi e playlist, mappe di calore,
tabellino DataVolley completo, cambio palla e break point.

---

## 6. iOS e pubblicazione

Il guscio e quasi gratis, le due funzioni native no: sono Java e vanno
riscritte in Swift.

| | Stima |
|---|---|
| Guscio Capacitor, app web che gira | 1-2 giorni |
| Registrazione con mira | 4-6 giorni — **la pausa costa piu che su Android**: `AVCaptureMovieFileOutput` non la supporta, serve `AVAssetWriter` |
| Caricamento in secondo piano | 5-8 giorni — iOS qui e migliore (continua ad app terminata) ma con un modello diverso: `URLSession` in background pianifica quando vuole lui |
| Firma, privacy manifest, invio | 3-5 giorni piu la revisione |
| Prove su apparecchi veri | 3-5 giorni |

**Totale 16-26 giorni-uomo**, revisione esclusa.

**macOS e fuori**: sul computer l'applicazione si installa dal browser (PWA).
Il piano originale (`../docs/10`) diceva ancora "+ macOS e iOS" ed e stato
corretto il 2026-09-05.

Per Android manca la **firma**: oggi e un APK di debug. Il keystore va
custodito — **perderlo significa non poter piu aggiornare l'applicazione**.

---

## 7. Come mandare le email: cosa conviene

**Sconsigliato: un server SMTP nostro.** Non per difficolta di codice — sono
dieci righe — ma perche il problema delle email non e mandarle, e **farle
arrivare**. Un indirizzo IP nuovo di un server appena acceso non ha
reputazione, e Gmail e Outlook trattano la posta senza reputazione come
sospetta. Il risultato tipico e che tutto "funziona" e nessuno riceve niente,
senza un errore da nessuna parte — che e il modo peggiore in cui una cosa
puo rompersi.

In piu: **molti servizi in cloud bloccano le porte SMTP in uscita** (25, 465,
587) proprio per non essere usati come sorgenti di posta indesiderata. Se si
sceglie questa strada va verificato su Render **prima**, non dopo.

**Consigliato: un servizio con API.** Si manda una richiesta HTTPS, che non
e bloccata da nessuno, e la reputazione la mette il fornitore.

Per questo progetto il volume e minuscolo — verifiche, reimposti, inviti:
qualche centinaio di messaggi al mese nella migliore delle ipotesi. Quindi
il criterio non e il prezzo, e **quanto e veloce da configurare**.

| | Nota |
|---|---|
| **Resend** | il piu semplice: chiave, dominio, tre righe. 3.000/mese gratis. Buon punto di partenza |
| **Brevo** (ex Sendinblue) | 300/giorno gratis, azienda europea — un argomento in piu se qualcuno chiede dove stanno i dati |
| **Postmark** | il migliore per la posta transazionale, ma senza piano gratuito permanente |
| **Amazon SES** | il piu economico a volume alto, il piu noioso da configurare (bisogna uscire dalla *sandbox*, e serve chiedere) |

**Qualunque si scelga, la parte che conta e il dominio.** Mandare da
`@gmail.com` non si puo; mandare da un dominio nostro senza SPF, DKIM e DMARC
allineati significa finire nello spam lo stesso. Sono tre record DNS, li
detta il fornitore, e valgono piu della scelta del fornitore stesso.

**Cosa non cambia in ogni caso**: `MailService` resta l'unico punto che sa
come si spedisce. Gli 8 punti di invio non si toccano.

---

## Dipende dal fornitore, non da noi

Il rischio numero uno del progetto, e l'unica voce che non si comprime.

- **Le quattro domande bloccanti** in fondo a `../docs/06-criticita.md` non
  hanno ancora risposta.
- Abbiamo **una** partita reale. La Fase 2 non si chiude finche l'adattatore
  non ha visto piu file veri.
- I criteri di accettazione non sono **mai stati percorsi**: servono 20
  eventi verificati sul video e 3 partite ricontrollate a mano da un esperto.
- `frameDelta` vale 0 e non sappiamo se e vero. Da questo dipende il cambio
  lato.
