import { useMemo } from "react";
/*
 * Import di spazio dei nomi e non del singolo nome: `@vv/core` e compilato
 * in CommonJS per l'API, e il raggruppatore del web non riesce a seguire i
 * nomi attraverso il suo `export *`. Cosi funziona, e soprattutto **non si
 * duplica il calcolo**: e lo stesso motore del server, come vuole la regola 2.
 */
import * as core from "@vv/core";
import type { AnalysisPackage } from "@vv/schema";

/**
 * LE STATISTICHE ACCANTO AL VIDEO, ferme al punto in cui stai guardando.
 *
 * Non sono le stesse della schermata dedicata messe di fianco: **seguono il
 * video**. Al fotogramma 40.000 mostrano com'era la partita a quel momento,
 * non com'e finita. E la domanda che ci si fa guardando un'azione — "a che
 * punto erano?" — e finora costringeva ad aprire un'altra schermata, dove pero
 * il numero era quello finale e non rispondeva.
 *
 * ## Perche il calcolo sta qui e non sul server
 *
 * Gli eventi sono **gia nel client**: la vista video scarica il pacchetto per
 * gli fps e l'omografia. Interrogare l'API a ogni fotogramma sarebbe trenta
 * richieste al secondo per dati che si hanno gia in memoria.
 *
 * E lo stesso motore di `packages/core` che usa il server: una definizione
 * sola delle metriche. Se il calcolo fosse duplicato qui, i numeri
 * divergerebbero da quelli della schermata statistiche — ed e esattamente cio
 * che la regola 2 vieta.
 */

/** Quante metriche mostrare: e una colonna stretta, non una tabella. */
const GRUPPI_MOSTRATI = ["sintesi", "attacco", "muro"];

export function StatisticheVideo({ pacchetto, frame, nomi }: {
  pacchetto: AnalysisPackage;
  /** Il fotogramma corrente del video. */
  frame: number;
  nomi: { h: string; a: string };
}) {
  /*
   * Il set in corso a questo fotogramma, e il punteggio a quel momento.
   *
   * Si ricava dalle azioni e non dai confini dichiarati dei set: sui dati
   * veri quei confini erano sbagliati e l'adattatore li ricalcola dal
   * punteggio. Fidarsi di nuovo del dichiarato rimetterebbe il difetto.
   */
  const stato = useMemo(() => {
    const passate = pacchetto.actions.filter((a) => a.frameStart <= frame);
    const ultima = passate[passate.length - 1];
    const set = ultima?.set ?? pacchetto.sets[0]?.n ?? 1;

    /*
     * Il punteggio dell'azione e quello **prima** che si giocasse: il punto
     * va aggiunto quando lo scambio e deciso.
     *
     * "Deciso" si misura sull'ULTIMO EVENTO, non su `frameEnd`. I due non
     * coincidono: sui dati veri il confine dichiarato dell'azione arriva
     * dopo il tocco che assegna il punto — misurato, fino a quattrocento
     * fotogrammi dopo, oltre dieci secondi. Guardando `frameEnd` il
     * tabellone direbbe 7 mentre le metriche, che contano gli eventi,
     * dicono 8: un punto in piu di quanti la squadra ne ha. Impossibile, e
     * visibile a chi guarda.
     *
     * Sugli eventi i due numeri concordano — ed e anche piu vero: il punto
     * si segna quando la palla tocca terra.
     */
    let hPt = ultima?.hPt ?? 0, aPt = ultima?.aPt ?? 0;
    if (ultima?.winner && ultima.eventi.length) {
      const ultimoTocco = pacchetto.events[ultima.eventi[ultima.eventi.length - 1]];
      if (ultimoTocco && ultimoTocco.frame <= frame) {
        if (ultima.winner === "h") hPt++; else aPt++;
      }
    }

    const vinti = { h: 0, a: 0 };
    for (const s of pacchetto.sets) {
      if (s.n >= set) continue;
      if (s.hPt > s.aPt) vinti.h++; else if (s.aPt > s.hPt) vinti.a++;
    }
    return { set, hPt, aPt, vinti };
  }, [pacchetto, frame]);

  /** Le metriche del set in corso, fino a questo fotogramma. */
  const gruppi = useMemo(
    () => core.riepilogoPerGruppi(pacchetto.events, { set: stato.set, untilFrame: frame })
            .filter((g) => GRUPPI_MOSTRATI.includes(g.chiave)),
    [pacchetto.events, stato.set, frame],
  );

  return (
    <div className="stat-video">
      <div className="stat-video-tabellone">
        <span className="stat-video-squadra">{nomi.h}</span>
        <span className="numerico stat-video-punti">{stato.hPt}</span>
        <span className="stat-video-set">
          set {stato.set}
          <em>{stato.vinti.h}–{stato.vinti.a}</em>
        </span>
        <span className="numerico stat-video-punti">{stato.aPt}</span>
        <span className="stat-video-squadra">{nomi.a}</span>
      </div>

      {gruppi.map((g) => (
        <div key={g.chiave} className="stat-video-gruppo">
          <span className="etichetta">{g.titolo}</span>
          {g.metriche.map((m) => (
            <div key={m.chiave} className="stat-video-riga">
              <span className="numerico">{fmt(m.casa, m.formato)}</span>
              <span className="stat-video-nome">{m.etichetta}</span>
              <span className="numerico">{fmt(m.ospite, m.formato)}</span>
            </div>
          ))}
        </div>
      ))}

      <p className="piccolo muto stat-video-nota">
        Valori del <strong>set {stato.set}</strong> fino al punto in cui stai
        guardando, non di fine partita.
        {/* Detto qui e non taciuto: sui dati reali il 53% degli eventi
            marcati "punto" contraddice chi ha vinto lo scambio, e i punti
            realizzati possono risultare piu dei punti segnati. Garantiamo
            che il calcolo sia corretto, non che il dato in ingresso lo sia
            — vedi docs/07-dati-fornitore.md. */}
        {" "}I <strong>punti realizzati</strong> vengono dai tocchi marcati dal
        fornitore e possono non quadrare col tabellone: e un limite del dato,
        non del calcolo.
      </p>
    </div>
  );
}

const fmt = (v: number, formato: "intero" | "percentuale") =>
  formato === "percentuale" ? `${Math.round(v)}%` : String(v);
