import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import type { JwtUser } from "../auth/auth.guard";

/**
 * Il permesso di trasferire **un solo caricamento**.
 *
 * <h3>Perche esiste</h3>
 *
 * Il servizio nativo Android carica a schermo spento, per ore. In quelle ore
 * il gettone di sessione scade (15 minuti) e va rinnovato — ma il rinnovo
 * **consuma** il gettone di rinnovo e ne emette un altro
 * (`auth.service.ts`, `refresh`). Se il servizio e la scheda web usassero lo
 * stesso, il primo che rinnova butterebbe fuori l'altro: o l'utente si
 * ritrova disconnesso a meta partita, o il caricamento muore. Non e un caso
 * limite, e quello che succede sempre.
 *
 * Da qui un gettone **suo**, che vive quanto un caricamento lungo e non
 * serve a nient'altro: non legge partite, non cambia anagrafiche, non apre
 * altre sessioni. Se finisse nelle mani sbagliate, il danno e poter scrivere
 * byte dentro un caricamento gia aperto dal suo proprietario.
 *
 * <h3>Le due meta della regola</h3>
 *
 * Questa guardia accetta il gettone delegato **solo** sulle rotte di
 * trasferimento e **solo** per il caricamento che nomina. L'altra meta sta
 * in `AuthGuard`, che rifiuta qualunque gettone con `scopo`: senza quella,
 * questo sarebbe un normale gettone di sessione con dodici ore di vita.
 */
@Injectable()
export class DelegaGuard implements CanActivate {
  constructor(private jwt: JwtService) {}

  async canActivate(ctx: ExecutionContext) {
    const req = ctx.switchToHttp().getRequest();
    const h = req.headers.authorization as string | undefined;
    if (!h?.startsWith("Bearer ")) {
      throw new UnauthorizedException({ code: "NON_AUTENTICATO", message: "Accesso richiesto" });
    }

    let p: any;
    try {
      p = await this.jwt.verifyAsync(h.slice(7));
    } catch {
      throw new UnauthorizedException({ code: "NON_AUTENTICATO", message: "Sessione non valida" });
    }

    // Gettone di sessione normale: passa, come prima.
    if (!p?.scopo) { req.user = p as JwtUser; return true; }

    if (p.scopo !== "upload" || p.uploadId !== req.params?.uploadId) {
      throw new UnauthorizedException({ code: "NON_AUTENTICATO",
        message: "Questo permesso non vale per questo caricamento" });
    }

    // Email e ruolo non ci sono e non servono: le rotte di trasferimento
    // guardano solo di chi e il caricamento. Metterli finti sarebbe peggio
    // che lasciarli vuoti — qualcuno prima o poi ci si fiderebbe.
    req.user = { sub: p.sub, email: "", ruolo: "" } satisfies JwtUser;
    return true;
  }
}
