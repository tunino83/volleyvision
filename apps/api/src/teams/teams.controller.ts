import { Body, Controller, Delete, Get, Param, Patch, Post, Put, UseGuards } from "@nestjs/common";
import { TeamsService } from "./teams.service";
import { AuthGuard, CurrentUser, type JwtUser } from "../auth/auth.guard";
import { ZodPipe } from "../common/zod.pipe";
import { ModificaGiocatoreSquadraInput, ShareInput, TeamInput,
         TeamPlayerInput, TeamRosterInput } from "@vv/schema";

@Controller("teams") @UseGuards(AuthGuard)
export class TeamsController {
  constructor(private svc: TeamsService) {}

  @Get() elenco(@CurrentUser() u: JwtUser) { return this.svc.elenco(u.sub); }
  @Post() crea(@CurrentUser() u: JwtUser, @Body(new ZodPipe(TeamInput)) d: TeamInput) { return this.svc.crea(u.sub, d); }
  @Get(":id") det(@CurrentUser() u: JwtUser, @Param("id") id: string) { return this.svc.dettaglio(u.sub, id); }
  @Patch(":id") agg(@CurrentUser() u: JwtUser, @Param("id") id: string,
                    @Body(new ZodPipe(TeamInput)) d: TeamInput) { return this.svc.aggiorna(u.sub, id, d); }
  @Put(":id/players") roster(@CurrentUser() u: JwtUser, @Param("id") id: string,
                             @Body(new ZodPipe(TeamRosterInput)) d: TeamRosterInput) {
    return this.svc.salvaRoster(u.sub, id, d);
  }
  @Post(":id/players")
  aggiungi(@CurrentUser() u: JwtUser, @Param("id") id: string,
           @Body(new ZodPipe(TeamPlayerInput)) d: TeamPlayerInput) {
    return this.svc.aggiungiGiocatore(u.sub, id, d);
  }

  @Patch(":id/players/:playerId")
  modifica(@CurrentUser() u: JwtUser, @Param("id") id: string,
           @Param("playerId") playerId: string,
           @Body(new ZodPipe(ModificaGiocatoreSquadraInput)) d: ModificaGiocatoreSquadraInput) {
    return this.svc.modificaGiocatore(u.sub, id, playerId, d);
  }

  @Delete(":id/players/:playerId")
  togli(@CurrentUser() u: JwtUser, @Param("id") id: string, @Param("playerId") playerId: string) {
    return this.svc.rimuoviGiocatore(u.sub, id, playerId);
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
