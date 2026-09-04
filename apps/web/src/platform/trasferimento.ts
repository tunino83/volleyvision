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

/**
 * Tiene acceso lo schermo per la durata del caricamento.
 *
 * **La causa piu frequente di interruzione non e l'utente che esce
 * dall'applicazione: e lo schermo che si spegne da solo dopo trenta
 * secondi.** Un video da 5 GB richiede mezz'ora su una buona rete mobile,
 * due ore su una lenta: senza questo, il caricamento si ferma decine di
 * volte e riparte solo quando qualcuno tocca il telefono.
 *
 * E un'API del browser, quindi vale anche dentro il guscio Android: non
 * serve codice nativo per risolvere il problema piu comune.
 *
 * Non tutti i browser la offrono, e il sistema puo negarla (batteria
 * scarica, risparmio energetico): in quel caso si carica lo stesso, con lo
 * schermo che si spegne come prima. Non e un motivo per fermarsi.
 */
async function tieniAccesoLoSchermo(): Promise<() => void> {
  const wl = (navigator as any).wakeLock;
  if (!wl?.request) return () => {};
  try {
    let blocco = await wl.request("screen");

    // Il sistema lo revoca quando l'applicazione perde il primo piano: al
    // ritorno va richiesto, altrimenti resta spento per il resto del
    // caricamento senza che nessuno se ne accorga.
    const alRitorno = async () => {
      if (document.visibilityState !== "visible") return;
      try { blocco = await wl.request("screen"); } catch { /* negato */ }
    };
    document.addEventListener("visibilitychange", alRitorno);

    return () => {
      document.removeEventListener("visibilitychange", alRitorno);
      try { blocco?.release?.(); } catch { /* gia rilasciato */ }
    };
  } catch {
    return () => {};
  }
}

export function creaTrasferimento(p: ParametriTrasferimento): Trasferimento {
  return {
    async invia(file, { apriSessione, onProgresso, onRipresa, segnale }: OpzioniInvio) {
      const rilasciaSchermo = await tieniAccesoLoSchermo();
      try {
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
      } finally {
        // Sempre, anche se il caricamento fallisce o viene annullato:
        // lasciare lo schermo bloccato scaricherebbe la batteria a vuoto.
        rilasciaSchermo();
      }
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
