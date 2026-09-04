package it.volleyvision.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.net.ConnectivityManager;
import android.net.NetworkCapabilities;
import android.net.Uri;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.os.PowerManager;
import android.util.Log;

import androidx.annotation.Nullable;
import androidx.core.app.NotificationCompat;

import org.json.JSONObject;

import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.concurrent.atomic.AtomicBoolean;

/**
 * Il caricamento che continua a schermo spento e ad applicazione chiusa.
 *
 * <h3>Cosa NON e</h3>
 *
 * Non e un secondo meccanismo di caricamento. Manda gli <b>stessi</b> blocchi
 * alla <b>stessa</b> API di {@code platform/trasferimento.ts}, e come quello
 * chiede al server da dove ripartire invece di ricordarselo. E la regola 4b:
 * lo stato del caricamento sta sul server. Se fosse nel client, questo
 * servizio e la scheda web si contraddirebbero al primo riavvio.
 *
 * <h3>Perche serve comunque</h3>
 *
 * Un video da 5 GB su rete mobile sono decine di minuti. Nel browser il
 * trasferimento vive quanto la scheda in primo piano: si chiede all'utente di
 * tenere il telefono acceso e sbloccato per mezz'ora, subito dopo una
 * partita. E la cosa che fa smettere di caricare — ed e il motivo per cui la
 * decisione 9b, che escludeva i servizi in secondo piano, e stata rivista il
 * 2026-09-04.
 *
 * <h3>Il gettone</h3>
 *
 * Non usa la sessione dell'utente: usa un permesso ristretto a questo solo
 * caricamento, chiesto dalla parte web a {@code POST /uploads/:id/delega}. Il
 * perche sta in {@code delega.guard.ts} lato server — in breve: il rinnovo
 * della sessione e a uso singolo, e due che se lo passano si scalzano a
 * vicenda.
 */
public class ServizioCaricamento extends Service {

  public static final String AZIONE_AVVIA = "it.volleyvision.app.CARICA";
  public static final String AZIONE_ANNULLA = "it.volleyvision.app.ANNULLA";

  public static final String EXTRA_URI = "uri";
  public static final String EXTRA_UPLOAD_ID = "uploadId";
  public static final String EXTRA_BASE = "base";
  public static final String EXTRA_TOKEN = "token";
  public static final String EXTRA_BYTE_TOTALI = "byteTotali";
  public static final String EXTRA_CHUNK = "chunkBytes";
  public static final String EXTRA_TITOLO = "titolo";

  private static final String TAG = "VVCaricamento";
  private static final String CANALE = "caricamenti";
  private static final int NOTIFICA = 1701;

  /** Ritentativi su errore di rete, con attesa raddoppiata a ogni giro. */
  private static final int TENTATIVI = 6;
  private static final long ATTESA_INIZIALE_MS = 2000;

  /**
   * Lo stato, leggibile dal resto dell'applicazione.
   *
   * <p>Statico perche il servizio e uno solo per costruzione: due
   * caricamenti insieme si contenderebbero la banda e finirebbero entrambi in
   * ritardo. Chi ne chiede un secondo sostituisce il primo.
   */
  public static volatile String statoUploadId = null;
  public static volatile long statoInviati = 0;
  public static volatile long statoTotali = 0;
  public static volatile String statoErrore = null;
  public static volatile boolean statoCompletato = false;

  /** Notifica il resto dell'applicazione a ogni cambiamento. */
  public interface Ascoltatore { void cambiato(); }
  public static volatile Ascoltatore ascoltatore = null;

  private final AtomicBoolean annullato = new AtomicBoolean(false);
  private Thread lavoro;
  private PowerManager.WakeLock sveglia;
  private final Handler principale = new Handler(Looper.getMainLooper());

  @Nullable @Override public IBinder onBind(Intent i) { return null; }

  @Override public int onStartCommand(Intent intent, int flag, int id) {
    if (intent == null) return START_NOT_STICKY;

    if (AZIONE_ANNULLA.equals(intent.getAction())) {
      annullato.set(true);
      fermaTutto();
      return START_NOT_STICKY;
    }

    final String uri = intent.getStringExtra(EXTRA_URI);
    final String uploadId = intent.getStringExtra(EXTRA_UPLOAD_ID);
    final String base = intent.getStringExtra(EXTRA_BASE);
    final String token = intent.getStringExtra(EXTRA_TOKEN);
    final String titolo = intent.getStringExtra(EXTRA_TITOLO);
    final long totali = intent.getLongExtra(EXTRA_BYTE_TOTALI, 0);
    final int chunk = intent.getIntExtra(EXTRA_CHUNK, 8 * 1024 * 1024);

    if (uri == null || uploadId == null || base == null || token == null) {
      Log.e(TAG, "avvio senza i dati necessari");
      stopSelf();
      return START_NOT_STICKY;
    }

    // Un caricamento gia in corso sullo stesso: non si riparte da capo. Senza
    // questo, ogni riapertura dell'applicazione butterebbe i gigabyte gia
    // trasferiti — e lo stesso motivo per cui il server non chiude una
    // sessione aperta quando se ne chiede un'altra sullo stesso file.
    if (lavoro != null && lavoro.isAlive() && uploadId.equals(statoUploadId)) {
      return START_STICKY;
    }
    if (lavoro != null && lavoro.isAlive()) { annullato.set(true); lavoro.interrupt(); }

    annullato.set(false);
    statoUploadId = uploadId;
    statoInviati = 0;
    statoTotali = totali;
    statoErrore = null;
    statoCompletato = false;

    avviaInPrimoPiano(titolo == null ? "Caricamento video" : titolo);
    prendiSveglia();

    lavoro = new Thread(() -> esegui(uri, uploadId, base, token, chunk, titolo));
    lavoro.start();

    // `START_STICKY`: se il sistema uccide il processo per memoria, lo
    // riavvia. Ripartira senza intent e non fara nulla, ma il caricamento
    // riprende alla prossima apertura — dallo stesso punto, perche il conto
    // lo tiene il server.
    return START_STICKY;
  }

  // ---------------------------------------------------------------- lavoro

  private void esegui(String uri, String uploadId, String base, String token,
                      int chunkRichiesto, String titolo) {
    try {
      // Da dove ripartire lo dice il server, non noi.
      long inviati = chiediInviati(base, uploadId, token);
      long totali = statoTotali;
      statoInviati = inviati;
      avvisa();

      byte[] buffer = new byte[chunkRichiesto];

      while (!annullato.get() && (totali <= 0 || inviati < totali)) {
        int letti = leggi(uri, inviati, buffer);
        if (letti <= 0) break;   // fine del file

        long dopo = inviaBlocco(base, uploadId, token, inviati, buffer, letti);
        if (dopo < 0) return;    // errore gia registrato

        // Il server dice quanto ha: puo essere piu di quanto crediamo (un
        // blocco arrivato mentre la risposta si perdeva). Ci si allinea a lui.
        inviati = dopo;
        statoInviati = inviati;
        avvisa();
        aggiornaNotifica(titolo, inviati, totali);
      }

      if (annullato.get()) { fermaTutto(); return; }

      completa(base, uploadId, token);
      statoCompletato = true;
      avvisa();
      notificaFinita(titolo);
    } catch (InterruptedException e) {
      Thread.currentThread().interrupt();
    } catch (Exception e) {
      Log.e(TAG, "caricamento fallito", e);
      statoErrore = "Caricamento interrotto: " + e.getMessage();
      avvisa();
      notificaErrore(titolo);
    } finally {
      rilasciaSveglia();
      // Non `stopSelf` in caso di errore: la notifica deve restare a dire
      // cosa e successo. Il servizio esce dal primo piano e basta.
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) stopForeground(STOP_FOREGROUND_DETACH);
      else stopForeground(false);
      if (statoErrore == null) stopSelf();
    }
  }

  /** Legge dal file un blocco a partire da {@code da}. Ritorna quanti byte. */
  private int leggi(String uri, long da, byte[] buffer) throws Exception {
    try (InputStream in = apri(uri)) {
      long saltati = 0;
      while (saltati < da) {
        long n = in.skip(da - saltati);
        // `skip` puo restituire zero senza essere a fine file: leggere un
        // byte e il modo di distinguere le due cose senza girare a vuoto.
        if (n <= 0) { if (in.read() < 0) return -1; saltati++; }
        else saltati += n;
      }
      int totale = 0;
      while (totale < buffer.length) {
        int n = in.read(buffer, totale, buffer.length - totale);
        if (n < 0) break;
        totale += n;
      }
      return totale;
    }
  }

  /**
   * Il file si riapre a ogni blocco.
   *
   * <p>Tenerlo aperto per due ore sarebbe piu efficiente e molto piu fragile:
   * su un URI di contenuto il permesso puo decadere, la scheda di memoria
   * puo essere rimontata, il sistema puo chiudere i descrittori di un
   * processo in secondo piano. Riaprire costa millisecondi ogni otto
   * megabyte — non si misura.
   */
  private InputStream apri(String uri) throws Exception {
    if (uri.startsWith("content://")) {
      InputStream in = getContentResolver().openInputStream(Uri.parse(uri));
      if (in == null) throw new IllegalStateException("file non piu accessibile");
      return in;
    }
    return new java.io.FileInputStream(uri.startsWith("file://")
        ? Uri.parse(uri).getPath() : uri);
  }

  private long chiediInviati(String base, String uploadId, String token) throws Exception {
    HttpURLConnection c = connessione(base + "/api/uploads/" + uploadId, "GET", token);
    try {
      if (c.getResponseCode() != 200) return 0;
      JSONObject j = new JSONObject(leggiTutto(c.getInputStream()));
      if (statoTotali <= 0) statoTotali = j.optLong("bytesTotali", 0);
      return j.optLong("bytesRicevuti", 0);
    } finally { c.disconnect(); }
  }

  /** Ritorna i byte totali confermati dal server, oppure -1 se si smette. */
  private long inviaBlocco(String base, String uploadId, String token,
                           long da, byte[] buffer, int quanti) throws Exception {
    long attesa = ATTESA_INIZIALE_MS;

    for (int tentativo = 1; ; tentativo++) {
      if (annullato.get()) return -1;
      attendiLaRete();

      HttpURLConnection c = null;
      try {
        c = connessione(base + "/api/uploads/" + uploadId + "/chunk?offset=" + da, "POST", token);
        c.setDoOutput(true);
        c.setFixedLengthStreamingMode(quanti);
        c.setRequestProperty("Content-Type", "application/octet-stream");
        try (OutputStream out = c.getOutputStream()) { out.write(buffer, 0, quanti); }

        int codice = c.getResponseCode();
        if (codice >= 200 && codice < 300) {
          return new JSONObject(leggiTutto(c.getInputStream())).optLong("bytesRicevuti", da + quanti);
        }

        String corpo = leggiTutto(c.getErrorStream());
        String errore = new JSONObject(corpo.isEmpty() ? "{}" : corpo).optString("code", "");

        // Il server sa piu di noi: se dice da dove riprendere, si riparte da li.
        if ("OFFSET_ERRATO".equals(errore)) {
          JSONObject j = new JSONObject(corpo);
          JSONObject d = j.optJSONObject("details");
          if (d != null && d.optJSONArray("bytesRicevuti") != null) {
            return d.optJSONArray("bytesRicevuti").optLong(0, da);
          }
        }

        // Errori definitivi: ritentare non cambia nulla, e insistere per sei
        // giri con attese raddoppiate significa tenere occupato il telefono
        // per minuti a fare niente.
        if ("SESSIONE_SCADUTA".equals(errore) || "NON_TROVATO".equals(errore)
            || "TROPPO_GRANDE".equals(errore) || "FORMATO_NON_AMMESSO".equals(errore)
            || "FORMAZIONE_MANCANTE".equals(errore) || codice == 401 || codice == 403) {
          statoErrore = messaggioDi(errore, codice);
          avvisa();
          return -1;
        }

        if (tentativo >= TENTATIVI) { statoErrore = "Il server non risponde."; avvisa(); return -1; }
      } catch (java.io.IOException e) {
        // Rete caduta: e la norma su mobile, non l'eccezione. Si aspetta.
        if (tentativo >= TENTATIVI) { statoErrore = "Rete non disponibile."; avvisa(); return -1; }
      } finally {
        if (c != null) c.disconnect();
      }

      Thread.sleep(attesa);
      attesa = Math.min(attesa * 2, 60_000);
    }
  }

  private String messaggioDi(String codice, int http) {
    if ("SESSIONE_SCADUTA".equals(codice)) return "La sessione di caricamento e scaduta: riprova dall'applicazione.";
    if ("NON_TROVATO".equals(codice)) return "Questo caricamento non esiste piu.";
    if ("TROPPO_GRANDE".equals(codice)) return "Il video supera la dimensione massima.";
    if ("FORMATO_NON_AMMESSO".equals(codice)) return "Formato del video non ammesso.";
    if ("FORMAZIONE_MANCANTE".equals(codice)) return "Manca la formazione del primo set.";
    if (http == 401 || http == 403) return "Il permesso di caricamento e scaduto: riapri l'applicazione.";
    return "Caricamento non riuscito.";
  }

  private void completa(String base, String uploadId, String token) throws Exception {
    HttpURLConnection c = connessione(base + "/api/uploads/" + uploadId + "/complete", "POST", token);
    try {
      c.setDoOutput(true);
      c.setRequestProperty("Content-Type", "application/json");
      try (OutputStream out = c.getOutputStream()) { out.write("{}".getBytes("UTF-8")); }
      int codice = c.getResponseCode();
      if (codice < 200 || codice >= 300) {
        throw new IllegalStateException("chiusura rifiutata dal server (" + codice + ")");
      }
    } finally { c.disconnect(); }
  }

  private HttpURLConnection connessione(String url, String metodo, String token) throws Exception {
    HttpURLConnection c = (HttpURLConnection) new URL(url).openConnection();
    c.setRequestMethod(metodo);
    c.setRequestProperty("Authorization", "Bearer " + token);
    c.setConnectTimeout(20_000);
    // Generoso: su rete debole otto megabyte possono richiedere minuti, e un
    // tempo massimo stretto trasformerebbe una rete lenta in un errore.
    c.setReadTimeout(180_000);
    return c;
  }

  private String leggiTutto(@Nullable InputStream in) {
    if (in == null) return "";
    try (java.io.ByteArrayOutputStream b = new java.io.ByteArrayOutputStream()) {
      byte[] buf = new byte[4096];
      int n;
      while ((n = in.read(buf)) > 0) b.write(buf, 0, n);
      return b.toString("UTF-8");
    } catch (Exception e) {
      return "";
    }
  }

  /**
   * Aspetta che ci sia rete, invece di consumare i ritentativi a vuoto.
   *
   * <p>Chi esce dal palazzetto e sale in macchina perde il segnale per
   * qualche minuto. Senza questa attesa, sei tentativi con attese
   * raddoppiate finirebbero in due minuti e il caricamento si fermerebbe
   * proprio mentre la rete stava per tornare.
   */
  private void attendiLaRete() throws InterruptedException {
    for (int i = 0; i < 60 && !annullato.get(); i++) {
      if (ceRete()) return;
      Thread.sleep(5000);
    }
  }

  private boolean ceRete() {
    ConnectivityManager cm = (ConnectivityManager) getSystemService(Context.CONNECTIVITY_SERVICE);
    if (cm == null) return true;
    NetworkCapabilities n = cm.getNetworkCapabilities(cm.getActiveNetwork());
    return n != null && n.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET);
  }

  // ----------------------------------------------------------- notifiche

  private void avviaInPrimoPiano(String titolo) {
    creaCanale();
    Notification n = costruisci(titolo, "Preparazione…", 0, 0, true);
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
      startForeground(NOTIFICA, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC);
    } else {
      startForeground(NOTIFICA, n);
    }
  }

  private void creaCanale() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
    NotificationManager m = getSystemService(NotificationManager.class);
    if (m == null || m.getNotificationChannel(CANALE) != null) return;
    // Importanza bassa: la notifica deve esserci — il sistema la pretende per
    // un servizio in primo piano — ma non deve suonare a ogni caricamento.
    NotificationChannel c = new NotificationChannel(CANALE, "Caricamenti",
        NotificationManager.IMPORTANCE_LOW);
    c.setDescription("Avanzamento dell'invio dei video");
    c.setShowBadge(false);
    m.createNotificationChannel(c);
  }

  private Notification costruisci(String titolo, String testo, long fatti, long totali,
                                  boolean indeterminato) {
    Intent apri = new Intent(this, MainActivity.class);
    apri.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
    PendingIntent pi = PendingIntent.getActivity(this, 0, apri,
        PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

    Intent stop = new Intent(this, ServizioCaricamento.class).setAction(AZIONE_ANNULLA);
    PendingIntent ps = PendingIntent.getService(this, 1, stop,
        PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

    NotificationCompat.Builder b = new NotificationCompat.Builder(this, CANALE)
        .setContentTitle(titolo)
        .setContentText(testo)
        .setSmallIcon(android.R.drawable.stat_sys_upload)
        .setOngoing(true)
        .setOnlyAlertOnce(true)
        .setContentIntent(pi)
        .addAction(android.R.drawable.ic_menu_close_clear_cancel, "Annulla", ps);

    if (indeterminato || totali <= 0) b.setProgress(0, 0, true);
    else b.setProgress(100, (int) (fatti * 100 / totali), false);
    return b.build();
  }

  private void aggiornaNotifica(String titolo, long fatti, long totali) {
    NotificationManager m = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
    if (m == null) return;
    String t = totali > 0
        ? String.format(java.util.Locale.ITALY, "%.1f di %.1f GB",
            fatti / 1_073_741_824f, totali / 1_073_741_824f)
        : String.format(java.util.Locale.ITALY, "%.1f GB inviati", fatti / 1_073_741_824f);
    m.notify(NOTIFICA, costruisci(titolo == null ? "Caricamento video" : titolo,
        t, fatti, totali, false));
  }

  private void notificaFinita(String titolo) {
    fine(titolo, "Caricamento completato. L'analisi partira a breve.");
  }

  private void notificaErrore(String titolo) {
    fine(titolo, statoErrore == null ? "Caricamento non riuscito." : statoErrore);
  }

  private void fine(String titolo, String testo) {
    NotificationManager m = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
    if (m == null) return;
    Intent apri = new Intent(this, MainActivity.class);
    apri.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
    m.notify(NOTIFICA, new NotificationCompat.Builder(this, CANALE)
        .setContentTitle(titolo == null ? "Volley Vision" : titolo)
        .setContentText(testo)
        .setStyle(new NotificationCompat.BigTextStyle().bigText(testo))
        .setSmallIcon(android.R.drawable.stat_sys_upload_done)
        .setAutoCancel(true)
        .setOngoing(false)
        .setContentIntent(PendingIntent.getActivity(this, 0, apri,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE))
        .build());
  }

  // -------------------------------------------------------------- energia

  /**
   * Tiene sveglio il <b>processore</b>, non lo schermo.
   *
   * <p>Un servizio in primo piano non viene ucciso, ma il telefono puo
   * comunque addormentarsi: senza questo, il trasferimento rallenta fino a
   * fermarsi appena si mette il telefono in tasca — che e esattamente il caso
   * per cui il servizio esiste.
   */
  private void prendiSveglia() {
    PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
    if (pm == null) return;
    sveglia = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "VolleyVision:caricamento");
    // Con un tempo massimo: se qualcosa va storto e non venisse mai
    // rilasciato, quattro ore dopo il sistema lo toglie comunque. Un blocco
    // dimenticato scarica la batteria in una notte.
    sveglia.acquire(4 * 60 * 60 * 1000L);
  }

  private void rilasciaSveglia() {
    try { if (sveglia != null && sveglia.isHeld()) sveglia.release(); } catch (Exception ignored) {}
    sveglia = null;
  }

  private void fermaTutto() {
    rilasciaSveglia();
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) stopForeground(STOP_FOREGROUND_REMOVE);
    else stopForeground(true);
    stopSelf();
  }

  private void avvisa() {
    Ascoltatore a = ascoltatore;
    if (a != null) principale.post(a::cambiato);
  }

  @Override public void onDestroy() {
    super.onDestroy();
    annullato.set(true);
    rilasciaSveglia();
  }
}
