import { Injectable } from "@nestjs/common";
import { CONFIG } from "./config";

/**
 * PUNTO DI INTERVENTO 3 — invio email.
 * In sviluppo scrive a terminale. In esercizio va collegato un servizio reale
 * (o il provider di autenticazione gestito, che gestisce da se verifica e
 * reimpostazione password). Vedi docs/05-interventi.md.
 */
@Injectable()
export class MailService {
  async invia(a: string, oggetto: string, corpo: string) {
    if (CONFIG.mailDriver === "console") {
      console.log("\n--- EMAIL ---------------------------------------");
      console.log("A:      ", a);
      console.log("Oggetto:", oggetto);
      console.log(corpo);
      console.log("-------------------------------------------------\n");
      return;
    }
    throw new Error(`MAIL_DRIVER non implementato: ${CONFIG.mailDriver}`);
  }

  verificaEmail(a: string, token: string) {
    return this.invia(a, "Verifica il tuo indirizzo",
      `Apri: ${CONFIG.webUrl}/verifica-email?token=${token}`);
  }
  resetPassword(a: string, token: string) {
    return this.invia(a, "Reimposta la password",
      `Apri: ${CONFIG.webUrl}/password/reset?token=${token}\nIl collegamento vale 60 minuti.`);
  }
  /** Invito a un'utenza creata dall'amministratore: sceglie lui la password. */
  invitoUtenza(a: string, token: string, nome: string) {
    return this.invia(a, "Sei stato aggiunto a Volley Vision",
      `Ciao ${nome},\nti e stata creata un'utenza. Scegli la tua password qui:\n`
      + `${CONFIG.webUrl}/password/reset?token=${token}\nIl collegamento vale 7 giorni.`);
  }

  invito(a: string, cosa: string, da: string) {
    return this.invia(a, `${da} ha condiviso ${cosa} con te`,
      `Accedi o registrati su ${CONFIG.webUrl} per vederlo.`);
  }
}
