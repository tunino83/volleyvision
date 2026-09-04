package it.volleyvision.app;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.provider.OpenableColumns;

import androidx.activity.result.ActivityResult;
import androidx.annotation.Nullable;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import android.database.Cursor;

/**
 * Il ponte fra l'applicazione web e le due sole funzioni native.
 *
 * <p>Un solo plugin per entrambe, e non due, perche non sono due
 * funzionalita indipendenti: registrare produce un file, caricare lo consuma,
 * e nell'uso reale sono un gesto solo. Separarle avrebbe significato due
 * ponti che si scambiano percorsi di file.
 *
 * <p>Tutto il resto dell'applicazione — elenchi, statistiche, dati senza rete
 * — resta web e non passa di qui. E la scelta di fondo del progetto
 * (`docs/02b`): il nativo si paga cinque volte, quindi ci va solo cio che non
 * puo stare altrove.
 */
@CapacitorPlugin(
    name = "VideoNativo",
    permissions = {
        @Permission(alias = "notifiche", strings = { android.Manifest.permission.POST_NOTIFICATIONS })
    }
)
public class VideoNativoPlugin extends Plugin {

  @Override public void load() {
    // Un solo ascoltatore, sostituito a ogni caricamento del ponte: se il
    // WebView viene ricreato, il vecchio puntava a un contesto morto.
    ServizioCaricamento.ascoltatore = () -> notifyListeners("caricamento", statoCorrente());
  }

  // ------------------------------------------------------- registrazione

  /** Vero se questo apparecchio puo registrare. Il web lo chiede per decidere
   *  se mostrare il comando: un pulsante che non fa niente e peggio di niente. */
  @PluginMethod public void disponibile(PluginCall call) {
    JSObject r = new JSObject();
    r.put("registrazione", RegistrazioneAttivita.disponibile(getContext()));
    r.put("caricamentoInSecondoPiano", true);
    call.resolve(r);
  }

  @PluginMethod public void registra(PluginCall call) {
    Intent i = new Intent(getContext(), RegistrazioneAttivita.class);
    startActivityForResult(call, i, "esitoRegistrazione");
  }

  @ActivityCallback
  private void esitoRegistrazione(PluginCall call, ActivityResult esito) {
    if (call == null) return;
    Intent d = esito.getData();

    if (esito.getResultCode() == Activity.RESULT_OK && d != null) {
      JSObject r = new JSObject();
      r.put("uri", "file://" + d.getStringExtra(RegistrazioneAttivita.EXTRA_PERCORSO));
      r.put("nome", nomeDa(d.getStringExtra(RegistrazioneAttivita.EXTRA_PERCORSO)));
      r.put("byte", d.getLongExtra(RegistrazioneAttivita.EXTRA_BYTE, 0));
      r.put("durataMs", d.getLongExtra(RegistrazioneAttivita.EXTRA_DURATA_MS, 0));
      call.resolve(r);
      return;
    }

    String errore = d == null ? null : d.getStringExtra(RegistrazioneAttivita.EXTRA_ERRORE);
    if (errore != null) { call.reject(errore, "REGISTRAZIONE_FALLITA"); return; }

    // Chiusura volontaria. Non e un errore: si risolve con `annullata`, cosi
    // il web non deve distinguere un rifiuto da un guasto guardando il testo.
    JSObject r = new JSObject();
    r.put("annullata", true);
    call.resolve(r);
  }

  // ------------------------------------------------------------- scelta

  /**
   * Scegliere un video gia sul telefono.
   *
   * <p>Non il selettore del WebView. Quello consegna un {@code File} che vive
   * nella pagina: quando l'applicazione va in secondo piano il file non
   * esiste piu, ed e esattamente il momento in cui il servizio ne avrebbe
   * bisogno. {@code ACTION_OPEN_DOCUMENT} con permesso persistente da invece
   * un indirizzo che resta valido dopo un riavvio.
   */
  @PluginMethod public void scegliVideo(PluginCall call) {
    Intent i = new Intent(Intent.ACTION_OPEN_DOCUMENT);
    i.addCategory(Intent.CATEGORY_OPENABLE);
    i.setType("video/*");
    i.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION
             | Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION);
    startActivityForResult(call, i, "esitoScelta");
  }

  @ActivityCallback
  private void esitoScelta(PluginCall call, ActivityResult esito) {
    if (call == null) return;
    Intent d = esito.getData();
    if (esito.getResultCode() != Activity.RESULT_OK || d == null || d.getData() == null) {
      JSObject r = new JSObject();
      r.put("annullata", true);
      call.resolve(r);
      return;
    }

    Uri uri = d.getData();
    try {
      // Senza questa riga il permesso vale finche l'applicazione e viva, e il
      // caricamento fallirebbe proprio dopo un riavvio — cioe quando serve.
      getContext().getContentResolver().takePersistableUriPermission(
          uri, Intent.FLAG_GRANT_READ_URI_PERMISSION);
    } catch (SecurityException e) {
      // Alcune sorgenti non lo concedono (certi provider cloud). Si prosegue:
      // il caricamento funzionera finche l'applicazione resta in memoria.
    }

    JSObject r = new JSObject();
    r.put("uri", uri.toString());
    r.put("nome", nomeContenuto(uri));
    r.put("byte", dimensione(uri));
    call.resolve(r);
  }

  // -------------------------------------------------------- caricamento

  /**
   * Avvia il caricamento in secondo piano.
   *
   * <p>Il `token` non e la sessione dell'utente ma il permesso ristretto a
   * questo caricamento, che la parte web chiede a
   * {@code POST /uploads/:id/delega}. Il perche sta in `delega.guard.ts`.
   */
  @PluginMethod public void carica(PluginCall call) {
    final String uri = call.getString("uri");
    final String uploadId = call.getString("uploadId");
    final String base = call.getString("base");
    final String token = call.getString("token");
    if (uri == null || uploadId == null || base == null || token == null) {
      call.reject("Mancano uri, uploadId, base o token", "DATI_MANCANTI");
      return;
    }

    Intent i = new Intent(getContext(), ServizioCaricamento.class);
    i.setAction(ServizioCaricamento.AZIONE_AVVIA);
    i.putExtra(ServizioCaricamento.EXTRA_URI, uri);
    i.putExtra(ServizioCaricamento.EXTRA_UPLOAD_ID, uploadId);
    i.putExtra(ServizioCaricamento.EXTRA_BASE, base);
    i.putExtra(ServizioCaricamento.EXTRA_TOKEN, token);
    i.putExtra(ServizioCaricamento.EXTRA_TITOLO, call.getString("titolo", "Caricamento video"));
    i.putExtra(ServizioCaricamento.EXTRA_BYTE_TOTALI,
        call.getLong("byteTotali") == null ? 0L : call.getLong("byteTotali"));
    Integer chunk = call.getInt("chunkBytes");
    if (chunk != null) i.putExtra(ServizioCaricamento.EXTRA_CHUNK, chunk.intValue());

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      getContext().startForegroundService(i);
    } else {
      getContext().startService(i);
    }
    call.resolve(statoCorrente());
  }

  @PluginMethod public void annullaCaricamento(PluginCall call) {
    Intent i = new Intent(getContext(), ServizioCaricamento.class);
    i.setAction(ServizioCaricamento.AZIONE_ANNULLA);
    getContext().startService(i);
    call.resolve();
  }

  @PluginMethod public void statoCaricamento(PluginCall call) {
    call.resolve(statoCorrente());
  }

  /**
   * Chiede il permesso di mostrare la notifica.
   *
   * <p>Va chiesto <b>prima</b> di avviare il caricamento, non durante: se
   * l'utente dice no, il trasferimento funziona lo stesso ma resta invisibile
   * — e un caricamento invisibile che dura mezz'ora e indistinguibile da uno
   * che non e partito.
   */
  @PluginMethod public void chiediNotifiche(PluginCall call) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) { call.resolve(esitoNotifiche(true)); return; }
    if (getPermissionState("notifiche") == com.getcapacitor.PermissionState.GRANTED) {
      call.resolve(esitoNotifiche(true));
      return;
    }
    requestPermissionForAlias("notifiche", call, "esitoNotifiche");
  }

  @PermissionCallback
  private void esitoNotifiche(PluginCall call) {
    call.resolve(esitoNotifiche(
        getPermissionState("notifiche") == com.getcapacitor.PermissionState.GRANTED));
  }

  private JSObject esitoNotifiche(boolean concesso) {
    JSObject r = new JSObject();
    r.put("concesso", concesso);
    return r;
  }

  // ------------------------------------------------------------- utilita

  private JSObject statoCorrente() {
    JSObject r = new JSObject();
    r.put("uploadId", ServizioCaricamento.statoUploadId);
    r.put("inviati", ServizioCaricamento.statoInviati);
    r.put("totali", ServizioCaricamento.statoTotali);
    r.put("errore", ServizioCaricamento.statoErrore);
    r.put("completato", ServizioCaricamento.statoCompletato);
    return r;
  }

  private String nomeDa(@Nullable String percorso) {
    if (percorso == null) return "video.mp4";
    int i = percorso.lastIndexOf('/');
    return i < 0 ? percorso : percorso.substring(i + 1);
  }

  private String nomeContenuto(Uri uri) {
    try (Cursor c = getContext().getContentResolver()
        .query(uri, new String[]{ OpenableColumns.DISPLAY_NAME }, null, null, null)) {
      if (c != null && c.moveToFirst()) {
        String n = c.getString(0);
        if (n != null) return n;
      }
    } catch (Exception ignored) {}
    return "video.mp4";
  }

  private long dimensione(Uri uri) {
    try (Cursor c = getContext().getContentResolver()
        .query(uri, new String[]{ OpenableColumns.SIZE }, null, null, null)) {
      if (c != null && c.moveToFirst() && !c.isNull(0)) return c.getLong(0);
    } catch (Exception ignored) {}
    return 0;
  }
}
