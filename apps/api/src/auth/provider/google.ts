/**
 * ACCEDI CON GOOGLE — scheletro, non attivo.
 *
 * Non e codice morto per abitudine: e la dimostrazione che la struttura regge.
 * Quando servira, questo file si completa e **nient'altro cambia**, perche
 * tutto il sistema conosce solo `User.id` e l'innesto e un metodo solo:
 * `IdentitaService.accediConProvider()`.
 *
 * COSA MANCA PER ATTIVARLO
 *
 * 1. Credenziali OAuth dalla console Google, con gli indirizzi di ritorno
 *    dichiarati: uno per lo sviluppo, uno per l'esercizio.
 * 2. `npm i google-auth-library` — serve a verificare la firma del token, che
 *    e l'unico passaggio che non si puo improvvisare.
 * 3. Togliere i commenti qui sotto e registrare le due rotte in
 *    `auth.controller.ts`:
 *
 *      GET  /auth/google          manda l'utente da Google
 *      GET  /auth/google/callback riceve il codice e apre la sessione
 *
 * 4. Nel client, un pulsante che apre `/auth/google`. Nient'altro:
 *    la sessione che torna e la stessa di sempre.
 *
 * SULLE SHELL NON WEB
 *
 * Su Electron e Capacitor il giro OAuth non puo avvenire dentro una vista
 * incorporata — Google la rifiuta. Va aperto il browser di sistema e
 * intercettato il ritorno con uno schema dedicato (`volleyvision://`). E il
 * motivo per cui questo file sta dietro il livello di astrazione delle
 * piattaforme e non dentro un componente.
 */

import type { ProfiloEsterno } from "../identita.service";

export const GOOGLE_ATTIVO = false;

/**
 * Converte il token di identita di Google nel profilo che il resto del
 * sistema capisce. **La verifica della firma non e facoltativa**: senza,
 * chiunque puo inviare un token costruito a mano e diventare chi vuole.
 */
export async function profiloDaGoogle(_idToken: string): Promise<ProfiloEsterno> {
  throw new Error("Accesso con Google non attivo: vedi auth/provider/google.ts");

  // const client = new OAuth2Client(CONFIG.googleClientId);
  // const ticket = await client.verifyIdToken({
  //   idToken: _idToken, audience: CONFIG.googleClientId });
  // const p = ticket.getPayload();
  // if (!p?.email) throw new BadRequestException({ code: "PROFILO_INCOMPLETO",
  //   message: "Google non ha fornito un indirizzo email" });
  // return {
  //   provider: "google",
  //   providerUserId: p.sub,          // stabile: non cambia se cambia l'email
  //   email: p.email,
  //   nome: p.given_name,
  //   cognome: p.family_name,
  //   emailVerificata: p.email_verified === true,
  // };
}
