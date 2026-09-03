import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { AdminService } from "./admin.service";
import { AuthGuard, CurrentUser, RolesGuard, Ruoli, type JwtUser } from "../auth/auth.guard";
import { ZodPipe } from "../common/zod.pipe";
import { InvitoUtenteInput, ModificaUtenteInput, Role, UserStatus } from "@vv/schema";
import { z } from "zod";

@Controller("admin") @UseGuards(AuthGuard, RolesGuard) @Ruoli("admin", "segreteria")
export class AdminController {
  constructor(private svc: AdminService) {}

  @Get("users") utenti(@Query("q") q?: string, @Query("ruolo") r?: string, @Query("stato") s?: string) {
    return this.svc.utenti(q, r, s);
  }
  @Get("users/:id") utente(@Param("id") id: string) { return this.svc.utente(id); }

  @Post("users")
  invita(@CurrentUser() u: JwtUser,
         @Body(new ZodPipe(InvitoUtenteInput)) d: InvitoUtenteInput) {
    return this.svc.invitaUtente(u.sub, d);
  }

  @Post("users/:id/invite")
  rinvia(@CurrentUser() u: JwtUser, @Param("id") id: string) {
    return this.svc.rinviaInvito(u.sub, id);
  }

  @Patch("users/:id")
  modifica(@CurrentUser() u: JwtUser, @Param("id") id: string,
           @Body(new ZodPipe(ModificaUtenteInput)) d: ModificaUtenteInput) {
    return this.svc.modificaUtente(u.sub, id, d);
  }

  @Patch("users/:id/role") @Ruoli("admin")
  ruolo(@CurrentUser() u: JwtUser, @Param("id") id: string,
        @Body(new ZodPipe(z.object({ ruolo: Role }))) b: { ruolo: string }) {
    return this.svc.cambiaRuolo(u.sub, id, b.ruolo);
  }

  @Patch("users/:id/status")
  stato(@CurrentUser() u: JwtUser, @Param("id") id: string,
        @Body(new ZodPipe(z.object({ stato: UserStatus }))) b: { stato: string }) {
    return this.svc.cambiaStato(u.sub, id, b.stato);
  }

  @Post("users/:id/password-reset")
  reset(@CurrentUser() u: JwtUser, @Param("id") id: string) { return this.svc.inviaReset(u.sub, id); }

  @Delete("users/:id") @Ruoli("admin")
  del(@CurrentUser() u: JwtUser, @Param("id") id: string) { return this.svc.eliminaUtente(u.sub, id); }

  @Get("audit") @Ruoli("admin")
  registro(@Query("actor") a?: string, @Query("azione") az?: string) {
    return this.svc.registro({ actor: a, azione: az });
  }

  @Get("reports/usage") @Ruoli("admin") report() { return this.svc.report(); }
}
