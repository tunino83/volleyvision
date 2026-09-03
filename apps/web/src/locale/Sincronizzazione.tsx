import { useEffect, useRef } from "react";
import { piattaforma } from "../platform";
import { avvisa } from "../componenti/Avvisi";
import { sincronizza, vuoleTutto } from "./scarico";

/**
 * PORTA I DATI IN LOCALE, E LO DICE.
 *
 * Non disegna nulla: sta montato accanto all'applicazione, lavora quando c'e
 * da lavorare, e parla solo quando ha qualcosa da dire.
 *
 * Il momento giusto e **subito dopo l'accesso**: c'e la rete per certo (si e
 * appena parlato col server) e l'utente e fermo, non in mezzo a un'altra cosa.
 * Poi a ogni ritorno della rete, perche e li che si e accumulato del nuovo.
 */

/** "su questo computer" o "su questo telefono": si dice dove si e davvero. */
const QUI = piattaforma.mobile ? "su questo telefono" : "su questo computer";

export function Sincronizzazione({ attiva }: { attiva: boolean }) {
  // Una sola sincronizzazione alla volta: due in parallelo scriverebbero le
  // stesse chiavi e raddoppierebbero il conteggio degli avvisi.
  const inCorso = useRef(false);
  const gia = useRef(false);

  useEffect(() => {
    if (!attiva) { gia.current = false; return; }

    const esegui = async () => {
      if (inCorso.current) return;
      inCorso.current = true;
      try {
        const e = await sincronizza();

        if (e.fermato === "a-consumo") {
          // Chiede una decisione, quindi non sparisce da solo. L'interruttore
          // vero sta nel profilo: l'avviso informa, non contratta.
          avvisa("Sei su una connessione a consumo: le partite non sono state "
               + "scaricate. Puoi cambiare la scelta nel tuo profilo.",
                 { tono: "attenzione", durata: 0 });
          return;
        }

        // **Niente avvisi per le non-notizie**: se non e cambiato nulla,
        // silenzio. "0 nuove partite" e rumore, non informazione.
        if (e.nuove > 0) {
          avvisa(e.nuove === 1
            ? `Ora 1 nuova partita e disponibile anche offline ${QUI}.`
            : `Ora ${e.nuove} nuove partite sono disponibili anche offline ${QUI}.`);
        }
        if (e.aggiornate > 0) {
          avvisa(e.aggiornate === 1
            ? "Una partita e stata aggiornata con la nuova analisi."
            : `${e.aggiornate} partite sono state aggiornate con la nuova analisi.`);
        }
      } finally { inCorso.current = false; }
    };

    // Al primo passaggio dopo l'accesso.
    if (!gia.current) { gia.current = true; void esegui(); }

    // E quando la rete torna: e li che si e accumulato del nuovo.
    const alRitorno = () => { if (piattaforma.installazione.inRete()) void esegui(); };
    window.addEventListener("online", alRitorno);
    return () => window.removeEventListener("online", alRitorno);
  }, [attiva]);

  return null;
}

/**
 * "L'applicazione e installata qui": lo si dice una volta sola.
 *
 * Ha senso solo mentre si e in una **scheda del browser**: chi sta gia usando
 * l'applicazione installata lo sa. E se e installata, i dati si portano in
 * locale senza chiedere — quindi il messaggio non propone, informa.
 */
const DETTO = "vv.locale.riconosciuta";

export function RiconoscimentoInstallazione({ attiva }: { attiva: boolean }) {
  useEffect(() => {
    if (!attiva) return;
    const inst = piattaforma.installazione;
    if (inst.giaInstallata()) return;              // ci siamo dentro: inutile dirlo
    if (localStorage.getItem(DETTO) === "1") return;

    void inst.installazioneEsistente().then((esiste) => {
      // `null` vuol dire "non lo so" — Safari, o il segnaposto ancora nel
      // manifesto. Non si inventa una notizia da un non-lo-so.
      if (esiste !== true) return;
      localStorage.setItem(DETTO, "1");
      avvisa(`Volley Vision e installata ${QUI}: aprila da li per averla anche `
           + "senza rete, con le tue partite gia scaricate.", { durata: 12000 });
    });
  }, [attiva]);

  return null;
}

/** Serve al profilo per spiegare cosa sta succedendo su questo dispositivo. */
export const portaTutto = () =>
  piattaforma.installazione.giaInstallata() || vuoleTutto();
