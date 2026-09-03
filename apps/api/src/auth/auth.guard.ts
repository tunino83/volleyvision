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
      req.user = await this.jwt.verifyAsync<JwtUser>(h.slice(7));
      return true;
    } catch {
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
