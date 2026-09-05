package it.volleyvision.app;

import android.Manifest;
import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.os.StatFs;
import android.util.Log;
import android.view.ScaleGestureDetector;
import android.view.View;
import android.view.WindowManager;
import android.widget.Button;
import android.widget.TextView;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.appcompat.app.AppCompatActivity;
import androidx.camera.core.Camera;
import androidx.camera.core.CameraControl;
import androidx.camera.core.CameraSelector;
import androidx.camera.core.Preview;
import androidx.camera.core.ZoomState;
import androidx.camera.lifecycle.ProcessCameraProvider;
import androidx.camera.video.FallbackStrategy;
import androidx.camera.video.FileOutputOptions;
import androidx.camera.video.Quality;
import androidx.camera.video.QualitySelector;
import androidx.camera.video.Recorder;
import androidx.camera.video.Recording;
import androidx.camera.video.VideoCapture;
import androidx.camera.video.VideoRecordEvent;
import androidx.camera.view.PreviewView;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;

import com.google.common.util.concurrent.ListenableFuture;

import java.io.File;
import java.util.Arrays;
import java.util.Locale;

/**
 * La registrazione di una partita, con la mira di inquadratura.
 *
 * <p><b>Perche e nativa e non una pagina web.</b> Non per l'anteprima — quella
 * si otterrebbe anche nel WebView — ma per le tre cose che decidono se il
 * video sara analizzabile: il <b>profilo di codifica</b> (registrando dal
 * browser si ottiene quello che decide il browser, e su un'ora di partita la
 * differenza fra 4 e 12 Mbit/s sono gigabyte), l'<b>orientamento bloccato</b>,
 * e il fatto che lo schermo <b>non si spenga</b> a meta primo set.
 *
 * <p>Il risultato non e un file caricato: e un percorso. Chi ha chiesto la
 * registrazione decide poi cosa farne — di norma passarlo al caricamento in
 * secondo piano ({@link ServizioCaricamento}). Tenere separate le due cose
 * significa poter registrare senza rete, che nei palazzetti e la norma.
 */
public class RegistrazioneAttivita extends AppCompatActivity {

  public static final String EXTRA_PERCORSO = "percorso";
  public static final String EXTRA_DURATA_MS = "durataMs";
  public static final String EXTRA_BYTE = "byte";
  public static final String EXTRA_ERRORE = "errore";

  private static final String TAG = "VVRegistrazione";
  private static final int RICHIESTA_PERMESSI = 4711;

  /**
   * 720p e 4 Mbit/s.
   *
   * <p>Non e una scelta di qualita ma di aritmetica: il limite di caricamento
   * e ~5 GB (decisione 9f), e a 4 Mbit/s sono circa due ore e mezza di
   * ripresa. A 1080p e 12 Mbit/s si sfonderebbe il limite dopo cinquanta
   * minuti — meno di una partita. Per riconoscere giocatori e palla 720p
   * basta; per non poter caricare il file non basta niente.
   */
  private static final int BITRATE = 4_000_000;

  /** Sotto questo spazio libero non si comincia nemmeno. */
  private static final long SPAZIO_MINIMO = 2L * 1024 * 1024 * 1024;

  private PreviewView anteprima;
  private TextView tempo;
  private TextView spazio;
  private TextView avviso;
  private MiraCampo mira;
  private Button registra;
  private Button annulla;
  private Button pausa;
  private Button miraVisibile;

  private VideoCapture<Recorder> cattura;
  private Recording inCorso;
  private File file;
  private long avvioMs;
  private boolean inPausa;

  /**
   * Il tempo gia registrato prima dell'ultima pausa.
   *
   * <p>Serve perche il cronometro deve dire **quanto video c'e**, non quanto
   * tempo e passato da quando si e premuto Registra. Con una pausa di dieci
   * minuti fra due set, le due cose divergono di dieci minuti — e chi guarda
   * lo schermo per sapere se ha ripreso il secondo set intero leggerebbe un
   * numero che non corrisponde a niente.
   */
  private long msPrimaDellaPausa;

  private CameraControl comandi;
  private ZoomState zoom;

  private final Handler orologio = new Handler(Looper.getMainLooper());
  private final Runnable tic = new Runnable() {
    @Override public void run() {
      if (inCorso == null) return;
      long s = registratoMs() / 1000;
      tempo.setText(String.format(Locale.ITALY, "%02d:%02d:%02d%s",
          s / 3600, (s / 60) % 60, s % 60, inPausa ? "  IN PAUSA" : ""));
      aggiornaSpazio();
      orologio.postDelayed(this, 1000);
    }
  };

  /** Millisecondi di video effettivamente registrati, pause escluse. */
  private long registratoMs() {
    return msPrimaDellaPausa + (inPausa ? 0 : System.currentTimeMillis() - avvioMs);
  }

  @Override protected void onCreate(@Nullable Bundle stato) {
    super.onCreate(stato);
    setContentView(R.layout.attivita_registrazione);

    anteprima = findViewById(R.id.anteprima);
    tempo = findViewById(R.id.tempo);
    spazio = findViewById(R.id.spazio);
    avviso = findViewById(R.id.avviso);
    mira = findViewById(R.id.mira);
    registra = findViewById(R.id.registra);
    annulla = findViewById(R.id.annulla);
    pausa = findViewById(R.id.pausa);
    miraVisibile = findViewById(R.id.mira_visibile);

    // Lo schermo resta acceso per tutta la registrazione. Senza, si spegne
    // dopo trenta secondi e con lui, su molti telefoni, se ne va l'anteprima:
    // la registrazione continua, ma nessuno puo piu correggere l'inquadratura.
    getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);

    registra.setOnClickListener(v -> { if (inCorso == null) avvia(); else ferma(); });
    annulla.setOnClickListener(v -> {
      // Registrazione in corso: fermarla salva quel che c'e. Buttare via
      // mezz'ora di partita per un tocco sbagliato non e un'opzione.
      if (inCorso != null) ferma(); else chiudi(null);
    });
    pausa.setOnClickListener(v -> alternaPausa());
    miraVisibile.setOnClickListener(v -> {
      boolean accesa = mira.getVisibility() == View.VISIBLE;
      mira.setVisibility(accesa ? View.GONE : View.VISIBLE);
      miraVisibile.setTextColor(accesa ? 0xFFFFFFFF : 0xFFFFCC00);
    });

    abilitaZoom();

    aggiornaSpazio();

    if (permessiConcessi()) apriFotocamera();
    else ActivityCompat.requestPermissions(this, permessiNecessari(), RICHIESTA_PERMESSI);
  }

  private String[] permessiNecessari() {
    return new String[]{ Manifest.permission.CAMERA, Manifest.permission.RECORD_AUDIO };
  }

  private boolean permessiConcessi() {
    for (String p : permessiNecessari()) {
      if (ContextCompat.checkSelfPermission(this, p) != PackageManager.PERMISSION_GRANTED) return false;
    }
    return true;
  }

  @Override public void onRequestPermissionsResult(int codice, @NonNull String[] permessi,
                                                   @NonNull int[] esiti) {
    super.onRequestPermissionsResult(codice, permessi, esiti);
    if (codice != RICHIESTA_PERMESSI) return;
    if (permessiConcessi()) apriFotocamera();
    else chiudi("Senza fotocamera e microfono non si puo registrare.");
  }

  private void apriFotocamera() {
    final ListenableFuture<ProcessCameraProvider> futuro = ProcessCameraProvider.getInstance(this);
    futuro.addListener(() -> {
      try {
        ProcessCameraProvider fornitore = futuro.get();

        Preview vista = new Preview.Builder().build();
        vista.setSurfaceProvider(anteprima.getSurfaceProvider());

        // Un ripiego serve: non tutti i telefoni offrono HD, e senza ripiego
        // la registrazione fallirebbe all'avvio proprio su quelli.
        Recorder recorder = new Recorder.Builder()
            .setQualitySelector(QualitySelector.fromOrderedList(
                Arrays.asList(Quality.HD, Quality.SD, Quality.FHD),
                FallbackStrategy.lowerQualityOrHigherThan(Quality.HD)))
            .setTargetVideoEncodingBitRate(BITRATE)
            .build();
        cattura = VideoCapture.withOutput(recorder);

        fornitore.unbindAll();
        Camera camera = fornitore.bindToLifecycle(
            this, CameraSelector.DEFAULT_BACK_CAMERA, vista, cattura);

        // I comandi della fotocamera esistono solo dopo il collegamento: lo
        // zoom prima di qui non avrebbe nulla su cui agire.
        comandi = camera.getCameraControl();
        camera.getCameraInfo().getZoomState().observe(this, z -> zoom = z);
      } catch (Exception e) {
        Log.e(TAG, "fotocamera non disponibile", e);
        chiudi("Non e stato possibile aprire la fotocamera.");
      }
    }, ContextCompat.getMainExecutor(this));
  }

  private void avvia() {
    if (cattura == null) return;
    if (spazioLibero() < SPAZIO_MINIMO) {
      mostra("Spazio insufficiente: libera almeno 2 GB prima di registrare.");
      return;
    }

    // Nella cartella privata dell'applicazione: nessun permesso di
    // archiviazione da chiedere, e il file sparisce con la disinstallazione
    // invece di restare a occupare la galleria di chi ha gia caricato.
    File cartella = new File(getExternalFilesDir(null), "registrazioni");
    if (!cartella.exists() && !cartella.mkdirs()) {
      mostra("Non e stato possibile creare la cartella delle registrazioni.");
      return;
    }
    file = new File(cartella, "partita-" + System.currentTimeMillis() + ".mp4");

    FileOutputOptions uscita = new FileOutputOptions.Builder(file).build();
    try {
      inCorso = cattura.getOutput()
          .prepareRecording(this, uscita)
          .withAudioEnabled()
          .start(ContextCompat.getMainExecutor(this), this::evento);
    } catch (SecurityException e) {
      // `withAudioEnabled` lancia se il microfono e stato revocato fra il
      // controllo e qui: succede se i permessi si cambiano da fuori.
      Log.e(TAG, "microfono negato", e);
      mostra("Il permesso del microfono e stato revocato.");
      return;
    }

    avvioMs = System.currentTimeMillis();
    msPrimaDellaPausa = 0;
    inPausa = false;
    registra.setText("Ferma");
    annulla.setEnabled(false);
    pausa.setEnabled(true);
    pausa.setText("Pausa");
    avviso.setVisibility(View.GONE);
    orologio.post(tic);
  }

  /**
   * Pausa e ripresa, dentro <b>lo stesso file</b>.
   *
   * <p>E la differenza che conta: fermare e ricominciare produrrebbe due
   * video, e due video vogliono dire due caricamenti da gigabyte e due
   * analisi da pagare. Qui l'intervallo fra i set semplicemente non viene
   * registrato, e la partita resta un file solo.
   *
   * <p>Conseguenza da sapere: nel video finito i due tronconi sono
   * consecutivi, senza traccia dell'intervallo. Chi cerchera un'azione per
   * minuto e secondo dovra contare sul tempo registrato, non sull'orologio
   * del palazzetto.
   */
  private void alternaPausa() {
    if (inCorso == null) return;
    try {
      if (inPausa) {
        inCorso.resume();
        avvioMs = System.currentTimeMillis();
        inPausa = false;
        pausa.setText("Pausa");
      } else {
        inCorso.pause();
        msPrimaDellaPausa = registratoMs();
        inPausa = true;
        pausa.setText("Riprendi");
      }
    } catch (Exception e) {
      // Alcuni apparecchi non permettono la pausa a meta registrazione. Non
      // e un motivo per fermare tutto: si dice, e si continua a registrare.
      Log.e(TAG, "pausa non riuscita", e);
      mostra("Questo telefono non permette di mettere in pausa: la"
             + " registrazione prosegue.");
      pausa.setEnabled(false);
      inPausa = false;
    }
  }

  /**
   * Zoom con due dita.
   *
   * <p>Serve a inquadrare, che qui e la cosa che decide se il video sara
   * analizzabile: da una tribuna lontana il campo entra tutto ma i giocatori
   * diventano puntini, da vicino si perdono gli angoli. Lo zoom e l'unico
   * modo di aggiustare senza spostarsi — e spostarsi, a partita iniziata, non
   * si puo.
   *
   * <p>Ottico finche l'apparecchio ce l'ha, poi digitale: CameraX passa
   * dall'uno all'altro da solo e non c'e niente da decidere qui.
   */
  private void abilitaZoom() {
    ScaleGestureDetector rilevatore = new ScaleGestureDetector(this,
        new ScaleGestureDetector.SimpleOnScaleGestureListener() {
          @Override public boolean onScale(@NonNull ScaleGestureDetector d) {
            if (comandi == null || zoom == null) return true;
            float attuale = zoom.getZoomRatio() * d.getScaleFactor();
            // Dentro i limiti dichiarati dall'apparecchio: fuori, la chiamata
            // viene ignorata in silenzio e lo zoom sembrerebbe inceppato.
            comandi.setZoomRatio(Math.max(zoom.getMinZoomRatio(),
                Math.min(attuale, zoom.getMaxZoomRatio())));
            return true;
          }
        });
    anteprima.setOnTouchListener((v, ev) -> {
      rilevatore.onTouchEvent(ev);
      // `performClick` non serve: l'anteprima non e un comando, e senza tocco
      // singolo non c'e nulla da annunciare a chi usa TalkBack.
      return true;
    });
  }

  private void evento(VideoRecordEvent e) {
    if (!(e instanceof VideoRecordEvent.Finalize)) return;
    VideoRecordEvent.Finalize f = (VideoRecordEvent.Finalize) e;
    orologio.removeCallbacks(tic);

    if (f.hasError()) {
      Log.e(TAG, "registrazione conclusa con errore " + f.getError(), f.getCause());

      // Lo spazio esaurito e un caso a se: CameraX chiude comunque il file, e
      // mezza partita registrata vale piu di niente. Si consegna quel che c'e.
      boolean spazioFinito = f.getError() == VideoRecordEvent.Finalize.ERROR_INSUFFICIENT_STORAGE;
      boolean recuperabile = spazioFinito && file != null && file.length() > 0;
      if (!recuperabile) {
        chiudi(spazioFinito ? "Spazio esaurito durante la registrazione."
                            : "La registrazione non e riuscita.");
        return;
      }
    }
    consegna();
  }

  private void ferma() {
    registra.setEnabled(false);
    pausa.setEnabled(false);
    // In pausa il cronometro e gia fermo: senza questo, `registratoMs()`
    // ricomincerebbe a contare dal vecchio `avvioMs` e la durata consegnata
    // includerebbe l'intervallo.
    if (!inPausa) { msPrimaDellaPausa = registratoMs(); inPausa = true; }
    if (inCorso != null) { inCorso.stop(); inCorso = null; }
    // Non si chiude qui: la chiusura del file e asincrona e il risultato
    // arriva in `evento`. Consegnare adesso darebbe un file troncato.
  }

  private void consegna() {
    Intent d = new Intent();
    d.putExtra(EXTRA_PERCORSO, file.getAbsolutePath());
    d.putExtra(EXTRA_BYTE, file.length());
    // Il tempo REGISTRATO, non quello trascorso: con una pausa fra i set le
    // due cose divergono, ed e la prima che descrive il file consegnato.
    d.putExtra(EXTRA_DURATA_MS, registratoMs());
    setResult(Activity.RESULT_OK, d);
    finish();
  }

  private void chiudi(@Nullable String errore) {
    Intent d = new Intent();
    if (errore != null) d.putExtra(EXTRA_ERRORE, errore);
    setResult(errore == null ? Activity.RESULT_CANCELED : Activity.RESULT_FIRST_USER, d);
    finish();
  }

  private void mostra(String s) {
    avviso.setText(s);
    avviso.setVisibility(View.VISIBLE);
  }

  private long spazioLibero() {
    File d = getExternalFilesDir(null);
    if (d == null) return 0;
    return new StatFs(d.getAbsolutePath()).getAvailableBytes();
  }

  private void aggiornaSpazio() {
    long liberi = spazioLibero();
    // A 4 Mbit/s sono mezzo megabyte al secondo. Il minuto e l'unita giusta:
    // "3,7 GB" non dice a nessuno se basta per un set.
    long minuti = liberi / (BITRATE / 8L) / 60L;
    spazio.setText(String.format(Locale.ITALY, "%.1f GB · ~%d min",
        liberi / 1_073_741_824f, minuti));
  }

  @Override protected void onDestroy() {
    super.onDestroy();
    orologio.removeCallbacks(tic);
    // Se l'attivita muore mentre registra (sistema a corto di memoria) si
    // chiude il file, invece di lasciarne uno corrotto sul disco.
    if (inCorso != null) { inCorso.stop(); inCorso = null; }
  }

  @Override public void onBackPressed() {
    // Durante la registrazione il tasto indietro non esce: e troppo facile da
    // sfiorare col telefono in mano, e costerebbe la partita.
    if (inCorso != null) ferma(); else super.onBackPressed();
  }

  /** Vero se questo apparecchio ha una fotocamera utilizzabile. */
  public static boolean disponibile(Context c) {
    return c.getPackageManager().hasSystemFeature(PackageManager.FEATURE_CAMERA_ANY);
  }
}
