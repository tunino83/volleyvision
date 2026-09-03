import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { CompetitionsService } from "./competitions.service";
import { AuthGuard, CurrentUser, type JwtUser } from "../auth/auth.guard";
import { ZodPipe } from "../common/zod.pipe";
import { CompetitionInput, ShareInput } from "@vv/schema";

@Controller("competitions") @UseGuards(AuthGuard)
export class CompetitionsController {
  constructor(private svc: CompetitionsService) {}

  @Get() elenco(@CurrentUser() u: JwtUser) { return this.svc.elenco(u.sub); }
  @Post() crea(@CurrentUser() u: JwtUser, @Body(new ZodPipe(CompetitionInput)) d: CompetitionInput) {
    return this.svc.crea(u.sub, d);
  }
  @Get(":id") det(@CurrentUser() u: JwtUser, @Param("id") id: string) { return this.svc.dettaglio(u.sub, id); }
  @Patch(":id") agg(@CurrentUser() u: JwtUser, @Param("id") id: string,
                    @Body(new ZodPipe(CompetitionInput)) d: CompetitionInput) {
    return this.svc.aggiorna(u.sub, id, d);
  }
  @Delete(":id") del(@CurrentUser() u: JwtUser, @Param("id") id: string) { return this.svc.elimina(u.sub, id); }

  @Get(":id/shares") sh(@CurrentUser() u: JwtUser, @Param("id") id: string) { return this.svc.condivisioni(u.sub, id); }
  @Post(":id/shares") add(@CurrentUser() u: JwtUser, @Param("id") id: string,
                          @Body(new ZodPipe(ShareInput)) d: { email: string }) {
    return this.svc.condividi(u.sub, id, d.email);
  }
  @Delete(":id/shares/:shareId") rev(@CurrentUser() u: JwtUser, @Param("id") id: string,
                                     @Param("shareId") s: string) { return this.svc.revoca(u.sub, id, s); }
}
