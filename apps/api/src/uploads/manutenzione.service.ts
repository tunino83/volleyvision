import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { UploadsService } from "./uploads.service";
import { CONFIG } from "../common/config";

/**
 * Manutenzione dei caricamenti: **esegue** la riconciliazione, invece di
 * limitarsi a offrirla.
 *
 * `UploadsService.riconcilia()` esisteva gia, ma lo richiamava solo una rotta
 * amministrativa: cioe nessuno, in pratica. I caricamenti abbandonati —
 * sessione scaduta, applicazione chiusa, dispositivo perso — restavano sul
 * disco per sempre, e dopo qualche mese si paga l'archiviazione di file che
 * nessuno sa di avere.
 *
 * Segue lo stesso schema del ciclo del fornitore (`lavorazione.service.ts`):
 * un intervallo, `unref()` perche non tenga vivo il processo, e un primo giro
 * poco dopo l'avvio per ripulire quanto e scaduto mentre il server era fermo.
 *
 * **In esercizio, con piu istanze**, questo va spostato su uno scheduler
 * esterno o protetto da un lucchetto: altrimenti tutte le istanze ripuliscono
 * insieme. Con una sola istanza, come oggi, va bene cosi.
 */
@Injectable()
export class ManutenzioneService implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger("Manutenzione");
  private timer?: NodeJS.Timeout;
  private avvio?: NodeJS.Timeout;
  private inCorso = false;

  constructor(private uploads: UploadsService) {}

  onModuleInit() {
    const ogni = CONFIG.riconciliazioneIntervalloMs;
    if (ogni <= 0) {
      this.log.warn("Riconciliazione dei caricamenti disattivata (intervallo a zero).");
      return;
    }
    this.log.log(`Riconciliazione dei caricamenti ogni ${Math.round(ogni / 60000)} minuti.`);

    // Un primo giro subito dopo l'avvio, non all'avvio: mentre il server era
    // fermo le sessioni hanno continuato a scadere, e il momento migliore per
    // accorgersene e adesso. Il ritardo lascia finire la partenza.
    this.avvio = setTimeout(() => this.giro(), 30_000);
    this.avvio.unref?.();

    this.timer = setInterval(() => this.giro(), ogni);
    this.timer.unref?.();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
    if (this.avvio) clearTimeout(this.avvio);
  }

  /**
   * Un giro solo per volta: se il precedente e ancora in corso — molti file da
   * eliminare, disco lento — accavallarne un secondo cancellerebbe due volte
   * le stesse chiavi.
   */
  private async giro() {
    if (this.inCorso) return;
    this.inCorso = true;
    try {
      const { ripulite } = await this.uploads.riconcilia();
      if (ripulite > 0) {
        this.log.log(`Caricamenti scaduti ripuliti: ${ripulite}.`);
      }
    } catch (e) {
      // Un errore qui non deve fermare il ciclo: si riprova al giro dopo.
      this.log.error(`Riconciliazione fallita: ${(e as Error).message}`);
    } finally {
      this.inCorso = false;
    }
  }
}
