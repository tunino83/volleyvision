package it.volleyvision.app;

import android.content.Context;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.graphics.Path;
import android.util.AttributeSet;
import android.view.View;

/**
 * La mira di inquadratura: il disegno sovrapposto all'anteprima.
 *
 * <p>Serve a un problema concreto. Il fornitore ricava le posizioni dei
 * giocatori da un'omografia, e l'omografia si calcola sui quattro angoli del
 * campo: se un angolo esce dall'inquadratura, o se la telecamera e cosi bassa
 * che il fondo campo lontano si schiaccia in una riga, le posizioni non si
 * possono calcolare affatto. Il video sarebbe guardabile e inutile — e lo si
 * scoprirebbe giorni dopo, ad analisi fatta e pagata.
 *
 * <p>Quindi non e una decorazione: e l'unica occasione di dirlo a chi
 * riprende, mentre puo ancora spostarsi.
 *
 * <p>Il disegno e volutamente approssimativo. Non pretende di coincidere col
 * campo — non sappiamo ne l'altezza ne l'angolo della ripresa — ma di dire
 * <b>dove devono cadere le cose</b>: i quattro angoli dentro i segni, la rete
 * lungo la riga di mezzo, un po' di spazio sopra per le palle alte.
 */
public class MiraCampo extends View {

  private final Paint linea = new Paint(Paint.ANTI_ALIAS_FLAG);
  private final Paint linea_tenue = new Paint(Paint.ANTI_ALIAS_FLAG);
  private final Paint testo = new Paint(Paint.ANTI_ALIAS_FLAG);
  private final Paint ombra_testo = new Paint(Paint.ANTI_ALIAS_FLAG);
  private final Path percorso = new Path();

  /** Il giallo del pallone, lo stesso dell'applicazione web. */
  private static final int GIALLO = Color.parseColor("#FFCC00");

  public MiraCampo(Context c) { this(c, null); }

  public MiraCampo(Context c, AttributeSet a) {
    super(c, a);
    float d = getResources().getDisplayMetrics().density;

    linea.setStyle(Paint.Style.STROKE);
    linea.setStrokeWidth(2f * d);
    linea.setColor(GIALLO);

    linea_tenue.setStyle(Paint.Style.STROKE);
    linea_tenue.setStrokeWidth(1.2f * d);
    // Il campo di riferimento resta leggibile ma non compete con l'immagine:
    // chi inquadra deve guardare il campo vero, non il disegno.
    linea_tenue.setColor(Color.argb(120, 255, 255, 255));

    testo.setColor(Color.WHITE);
    testo.setTextSize(13f * d);

    // Il testo bianco su un palazzetto chiaro sparisce. Un contorno scuro
    // costa una riga e lo rende leggibile ovunque.
    ombra_testo.setColor(Color.argb(170, 0, 0, 0));
    ombra_testo.setStyle(Paint.Style.STROKE);
    ombra_testo.setStrokeWidth(3f * d);
    ombra_testo.setTextSize(13f * d);
  }

  @Override protected void onDraw(Canvas c) {
    super.onDraw(c);
    float w = getWidth(), h = getHeight();
    float d = getResources().getDisplayMetrics().density;

    // Il trapezio: il campo visto da un lato e in alto. Il fondo lontano e
    // piu stretto e piu in alto, il fondo vicino piu largo e piu in basso.
    float su = h * 0.34f, giu = h * 0.90f;
    float rientroSu = w * 0.22f, rientroGiu = w * 0.06f;

    percorso.reset();
    percorso.moveTo(rientroSu, su);
    percorso.lineTo(w - rientroSu, su);
    percorso.lineTo(w - rientroGiu, giu);
    percorso.lineTo(rientroGiu, giu);
    percorso.close();
    c.drawPath(percorso, linea_tenue);

    // La rete, a meta fra i due fondi campo. E il riferimento piu facile da
    // centrare a occhio, ed e quello che conta: se la rete e storta o fuori
    // asse, tutto il resto lo e.
    float y = (su + giu) / 2f;
    float rientro = (rientroSu + rientroGiu) / 2f;
    c.drawLine(rientro - w * 0.03f, y, w - rientro + w * 0.03f, y, linea);

    // I quattro angoli, marcati. Sono i punti che devono stare dentro
    // l'immagine: senza, l'omografia non si calcola.
    angolo(c, rientroSu, su, +1, +1, d);
    angolo(c, w - rientroSu, su, -1, +1, d);
    angolo(c, w - rientroGiu, giu, -1, -1, d);
    angolo(c, rientroGiu, giu, +1, -1, d);

    riga(c, "Tutti e quattro gli angoli del campo dentro i segni", w / 2f, h * 0.14f, d);
    riga(c, "La rete lungo la riga gialla · telecamera in alto, ferma", w / 2f, h * 0.14f + 19f * d, d);
  }

  /** Un angolo a squadra: due segmenti, non un cerchio. Dice anche il verso. */
  private void angolo(Canvas c, float x, float y, int vx, int vy, float d) {
    float l = 22f * d;
    c.drawLine(x, y, x + l * vx, y, linea);
    c.drawLine(x, y, x, y + l * vy, linea);
  }

  private void riga(Canvas c, String s, float cx, float y, float d) {
    float x = cx - testo.measureText(s) / 2f;
    c.drawText(s, x, y, ombra_testo);
    c.drawText(s, x, y, testo);
  }
}
