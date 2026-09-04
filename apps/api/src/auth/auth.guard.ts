import { CanActivate, ExecutionContext, Injectable, SetMetadata,
         UnauthorizedException, ForbiddenException, createParamDecorator } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { JwtService } from "@nestjs/jwt";

export interface JwtUser { sub: string; email: string; ruolo: string }

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private jwt: JwtService) {}
  async canActivate(ctx: ExecutionContext) {
    const req = ctx.switchToHttp().getRequest();
    const h = req.headers.authorization as string | undefined;
    if (!h?.startsWith("Bearer ")) {
      throw new UnauthorizedException({ code: "NON_AUTENTICATO", message: "Accesso richiesto" });
    }
    try {
      const p = await this.jwt.verifyAsync<JwtUser & { scopo?: string }>(h.slice(7));

      /*
       * Un gettone con `scopo` non e una sessione.
       *
       * E il permesso ristretto che il servizio di caricamento nativo usa
       * per un solo trasferimento (`uploads/delega.guard.ts`): vive dodici
       * ore invece di quindici minuti, e quel prezzo si paga solo perche
       * non apre nient'altro. Accettarlo qui lo trasformerebbe in una
       * sessione lunga mezza giornata su tutta l'API.
       */
      if ((p as any).scopo) {
        throw new UnauthorizedException({ code: "NON_AUTENTICATO",
          message: "Questo permesso non vale per l'accesso" });
      }

      req.user = p;
      return true;
    } catch (e) {
      if (e instanceof UnauthorizedException) throw e;
      throw new UnauthorizedException({ code: "NON_AUTENTICATO", message: "Sessione non valida" });
    }
  }
}

export const RUOLI = "ruoli";
export const Ruoli = (...r: string[]) => SetMetadata(RUOLI, r);

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}
  canActivate(ctx: ExecutionContext) {
    const richiesti = this.reflector.getAllAndOverride<string[]>(RUOLI, [ctx.getHandler(), ctx.getClass()]);
    if (!richiesti?.length) return true;
    const u = ctx.switchToHttp().getRequest().user as JwtUser | undefined;
    if (!u || !richiesti.includes(u.ruolo)) {
      throw new ForbiddenException({ code: "NON_AUTORIZZATO", message: "Non hai i permessi" });
    }
    return true;
  }
}

export const CurrentUser = createParamDecorator((_d, ctx: ExecutionContext) =>
  ctx.switchToHttp().getRequest().user as JwtUser);
