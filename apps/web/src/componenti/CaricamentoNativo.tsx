import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { API } from "../api/client";
import { gb } from "./Ui";
import {
  annullaCaricamentoNativo, caricaInSecondoPiano, capacitaNative, chiediNotifiche,
  osservaCaricamento, registraPartita, scegliVideoNativo, statoCaricamentoNativo,
  type StatoCaricamentoNativo,
} from "../platform/nativo";

/**
 * Il caricamento dentro l'applicazione Android.
 *
 * <p>Sostituisce il selettore di file del browser, e non per estetica. Il
 * `File` del browser vive nella pagina: appena l'applicazione va in secondo
 * piano non esiste piu — proprio quando il servizio ne avrebbe bisogno. Qui
 * si passa un indirizzo di contenuto che resta valido anche dopo un riavvio.
 *
 * <p>L'avanzamento arriva dal servizio, non da questa pagina: se si esce e si
 * rientra, la barra riprende da dove il servizio e arrivato nel frattempo,
 * invece di ripartire da zero perche il componente e stato ricreato.
 */
export default function CaricamentoNativo({ partita, video, bloccato }: {
  partita: any; video: any; bloccato: boolean;
}) {
  const qc = useQueryClient();
  const [capacita, setCapacita] = useState<{ registrazione: boolean } | null>(null);
  const [stato, setStato] = useState<StatoCaricamentoNativo | null>(null);
  const [errore, setErrore] = useState<string | null>(null);
  const [inApertura, setInApertura] = useState(false);

  useEffect(() => { capacitaNative().then(setCapacita); }, []);

  // Lo stato si chiede all'apertura e poi si ascolta. Chiederlo e necessario:
  // gli eventi raccontano i cambiamenti, non cosa e successo mentre la
  // pagina era chiusa.
  useEffect(() => {
    let vivo = true;
    let rimuovi: (() => void) | null = null;

    statoCaricamentoNativo().then((s) => { if (vivo) setStato(s); }).catch(() => {});
    osservaCaricamento((s) => {
      if (!vivo) return;
      setStato(s);
      if (s.completato) {
        qc.invalidateQueries({ queryKey: ["partita", partita.id] });
        qc.invalidateQueries({ queryKey: ["sessione-caricamento", partita.id, video.lato] });
      }
    }).then((h) => { rimuovi = () => { h.remove(); }; }).catch(() => {});

    return () => { vivo = false; rimuovi?.(); };
  }, [partita.id, video.lato, qc]);

  const nostro = stato?.uploadId != null;
  const inCorso = nostro && !stato!.completato && !stato!.errore;

  const avvia = async (scelta: { uri?: string; nome?: string; byte?: number; annullata?: boolean }) => {
    if (scelta.annullata || !scelta.uri) return;
    setErrore(null);
    setInApertura(true);
    try {
      // Prima la notifica, poi il trasferimento. Un caricamento che dura
      // mezz'ora senza notifica e indistinguibile da uno che non e partito —
      // e chiederlo dopo l'avvio significa chiederlo quando non serve piu.
      await chiediNotifiche().catch(() => ({ concesso: false }));

      const s = await API.post<{ uploadId: string; chunkBytes: number }>(
        `/matches/${partita.id}/videos/${video.lato}/upload-session`,
        { nomeFile: scelta.nome ?? "video.mp4", dimensione: scelta.byte ?? 0, mime: "video/mp4" });

      const iniziale = await caricaInSecondoPiano({
        uri: scelta.uri,
        uploadId: s.uploadId,
        byteTotali: scelta.byte ?? 0,
        chunkBytes: s.chunkBytes,
        titolo: `${partita.home.nome} — ${partita.away.nome}`,
      });
      setStato(iniziale);
      qc.invalidateQueries({ queryKey: ["sessione-caricamento", partita.id, video.lato] });
    } catch (e: any) {
      setErrore(e?.message ?? "Non e stato possibile avviare il caricamento.");
    } finally {
      setInApertura(false);
    }
  };

  if (!capacita) return null;

  const pct = stato && stato.totali > 0
    ? Math.round((stato.inviati / stato.totali) * 100) : 0;

  return (
    <div style={{ marginTop: 10 }}>
      {inCorso && (
        <>
          <div className="barra"><div style={{ width: `${pct}%`, background: "var(--primario)" }} /></div>
          <div className="riga-sp piccolo muto" style={{ marginTop: 6 }}>
            <span>{gb(stato!.inviati)}{stato!.totali > 0 && ` di ${gb(stato!.totali)}`} · {pct}%</span>
            <button onClick={() => { annullaCaricamentoNativo(); setStato(null); }}>Annulla</button>
          </div>
          <p className="piccolo muto" style={{ marginBottom: 0 }}>
            {/* Il punto dell'intera funzione, detto dove serve. */}
            Puoi chiudere l'applicazione e spegnere lo schermo: il caricamento
            continua. Lo trovi fra le notifiche.
          </p>
        </>
      )}

      {stato?.errore && (
        <div className="avviso errore piccolo" style={{ marginTop: 6 }}>{stato.errore}</div>
      )}
      {errore && <div className="avviso errore piccolo" style={{ marginTop: 6 }}>{errore}</div>}

      {!inCorso && (
        <div className="riga" style={{ flexWrap: "wrap" }}>
          {capacita.registrazione && (
            <button className="primario" disabled={bloccato || inApertura}
                    onClick={() => registraPartita().then(avvia).catch((e) => setErrore(e.message))}>
              Registra la partita
            </button>
          )}
          <button disabled={bloccato || inApertura}
                  onClick={() => scegliVideoNativo().then(avvia).catch((e) => setErrore(e.message))}>
            Scegli un video
          </button>
        </div>
      )}

      {!inCorso && capacita.registrazione && (
        <p className="piccolo muto" style={{ marginTop: 6, marginBottom: 0 }}>
          Registrando dall'applicazione, la mira di inquadratura aiuta a tenere
          il campo intero nell'immagine: senza i quattro angoli, le posizioni
          dei giocatori non si possono ricavare.
        </p>
      )}

      {bloccato && (
        <div className="piccolo muto" style={{ marginTop: 6 }}>
          Completa prima la formazione del set 1.
        </div>
      )}
    </div>
  );
}
