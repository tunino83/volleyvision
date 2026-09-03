import { API, type ApiError } from "../api/client";
import type { Trasferimento, OpzioniInvio } from "./index";

/**
 * Caricamento riprendibile a blocchi, condiviso da tutte le shell.
 *
 * Sta qui e non in `browser.ts` perche il meccanismo e lo stesso ovunque: e
 * il 85% comune di cui parla `docs/02b`. Cambiano soltanto i parametri —
 * dimensione del blocco, e se il trasferimento sopravvive all'uscita
 * dall'applicazione — e quelli li passa la piattaforma.
 *
 * Lo stato sta sul server. Il client conserva un solo identificativo: alla
 * ripresa chiede da dove ripartire. E cio che rende il caricamento da mobile
 * possibile senza servizi in secondo piano.
 */

export interface ParametriTrasferimento {
  /**
   * Blocco piu piccolo del massimo consentito dal server. Su rete mobile un
   * blocco grande che fallisce a meta si ritrasmette tutto: conviene perdere
   * poco per volta.
   */
  chunkMax: number;
  /**
   * Vero quando il trasferimento si ferma appena l'applicazione esce dal
   * primo piano. Vale per il browser su mobile e per la shell Capacitor
   * (opzione A): niente servizi in secondo piano, quindi il sistema
   * congela il processo e non c'e nulla da fare se non riprendere dopo.
   */
  soloPrimoPiano: boolean;
}

/** Il caricamento si e fermato perche l'applicazione e uscita dal primo piano. */
export const SOSPESO = "SOSPESO_SECONDO_PIANO";

const TENTATIVI = 4;

export function creaTrasferimento(p: ParametriTrasferimento): Trasferimento {
  return {
    async invia(file, { apriSessione, onProgresso, onRipresa, segnale }: OpzioniInvio) {
      const s = await apriSessione();
      const blocco = Math.min(s.chunkBytes, p.chunkMax);

      // Il server dice quanto ha gia. Se non e zero, si sta riprendendo un
      // caricamento interrotto: chi guarda deve saperlo, non vedere una barra
      // che parte gia a meta senza spiegazione.
      let inviati = s.bytesRicevuti ?? 0;
      if (inviati > 0) onRipresa?.(inviati, file.size);
      onProgresso?.(inviati, file.size);

      while (inviati < file.size) {
        if (segnale?.aborted) throw new DOMException("Annullato", "AbortError");
        if (p.soloPrimoPiano && typeof document !== "undefined"
            && document.visibilityState === "hidden") {
          const e: ApiError = { code: SOSPESO,
            message: "Trasferimento sospeso: l'applicazione non era in primo piano" };
          throw e;
        }

        const fine = Math.min(inviati + blocco, file.size);
        inviati = await inviaBlocco(s.uploadId, file, inviati, fine, segnale);
        onProgresso?.(inviati, file.size);
      }

      await API.post(`/uploads/${s.uploadId}/complete`, {});
      return { uploadId: s.uploadId };
    },
  };
}

/**
 * Un blocco, con ritentativi. Su rete mobile l'errore momentaneo non e
 * l'eccezione ma la norma: senza ritentativi ogni buca di campo butterebbe
 * via l'intero caricamento.
 */
async function inviaBlocco(uploadId: string, file: File, da: number, a: number,
                           segnale?: AbortSignal): Promise<number> {
  let attesa = 800;
  for (let tentativo = 1; ; tentativo++) {
    try {
      const r = await API.raw(`/uploads/${uploadId}/chunk?offset=${da}`,
                              file.slice(da, a), segnale);
      return r.bytesRicevuti;
    } catch (e: any) {
      if (e?.name === "AbortError") throw e;

      // Il server sa piu di noi: se dice da dove riprendere, si riparte da li.
      if (e?.code === "OFFSET_ERRATO") {
        const detto = Number(e?.details?.bytesRicevuti?.[0]);
        if (Number.isFinite(detto)) return detto;
      }
      // Errori definitivi: ritentare non cambia nulla.
      if (e?.code === "SESSIONE_SCADUTA" || e?.code === "NON_TROVATO"
          || e?.code === "TROPPO_GRANDE" || e?.code === "FORMATO_NON_AMMESSO"
          || e?.code === "FORMAZIONE_MANCANTE") throw e;

      if (tentativo >= TENTATIVI) throw e;
      await new Promise((r) => setTimeout(r, attesa));
      attesa *= 2;
    }
  }
}
