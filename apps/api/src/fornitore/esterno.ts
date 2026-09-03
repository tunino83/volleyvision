import { Injectable, ServiceUnavailableException } from "@nestjs/common";
import { CONFIG } from "../common/config";
import type { EsitoAvvio, FornitoreAnalisi, RichiestaAnalisi } from "./fornitore";

/**
 * FORNITORE ESTERNO — da completare quando sara ingaggiato.
 *
 * Lo scheletro c'e; mancano i dettagli che nessuno ha ancora negoziato:
 * indirizzo del servizio, autenticazione, forma della richiesta, formato della
 * risposta, meccanismo di notifica del completamento.
 *
 * Le sei domande da porgli sono in `docs/07-dati-fornitore.md`.
 *
 * Attivazione: FORNITORE_ANALISI=esterno, piu FORNITORE_URL e FORNITORE_TOKEN.
 *
 * Nota: se il fornitore ci richiamera da se invece di farsi interrogare,
 * `notificaSpontanea` va messo a vero e serve una rotta dedicata con
 * autenticazione separata. La macchina a stati e gia pronta a riceverlo.
 */
@Injectable()
export class FornitoreEsterno implements FornitoreAnalisi {
  readonly nome = "esterno";
  readonly notificaSpontanea = false;

  private non(cosa: string): never {
    throw new ServiceUnavailableException({
      code: "FORNITORE_NON_CONFIGURATO",
      message: `Il collegamento al fornitore non e completo: manca ${cosa}. ` +
               `Con FORNITORE_ANALISI=simulato si continua a lavorare sul simulatore.`,
    });
  }

  async avvia(r: RichiestaAnalisi): Promise<EsitoAvvio> {
    if (!CONFIG.fornitoreUrl) this.non("l'indirizzo del servizio (FORNITORE_URL)");

    // Forma indicativa: da concordare.
    //
    // const res = await fetch(`${CONFIG.fornitoreUrl}/analisi`, {
    //   method: "POST",
    //   headers: { "Content-Type": "application/json",
    //              Authorization: `Bearer ${CONFIG.fornitoreToken}` },
    //   body: JSON.stringify({ id: r.matchId, video: r.video }),
    // });
    // const d = await res.json();
    // return { riferimento: d.jobId, attesoPer: d.eta ? new Date(d.eta) : null };

    return this.non("l'implementazione della chiamata di avvio");
  }

  async ritira(_riferimento: string) {
    if (!CONFIG.fornitoreUrl) this.non("l'indirizzo del servizio (FORNITORE_URL)");
    return this.non("l'implementazione della chiamata di ritiro");
  }
}
