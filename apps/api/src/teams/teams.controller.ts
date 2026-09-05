import { Body, Controller, Delete, Get, NotFoundException, Param, Patch, Post, Put,
         Res, UseGuards } from "@nestjs/common";
import type { Response } from "express";
import { TeamsService } from "./teams.service";
import { AuthGuard, CurrentUser, type JwtUser } from "../auth/auth.guard";
import { ZodPipe } from "../common/zod.pipe";
import { FotoSquadraInput, LogoSquadraInput, ModificaGiocatoreSquadraInput, ShareInput,
         TeamInput, TeamPlayerInput, TeamRosterInput } from "@vv/schema";

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

  /*
   * Lo stemma. Due modi, e non si escludono: disegnato dalle iniziali, o
   * caricato come immagine. Il caricato ha la precedenza ma non cancella il
   * disegnato — chi lo toglie ritrova quello di prima, non un riquadro
   * vuoto.
   *
   * A differenza delle fotografie delle persone, **non c'e bandiera di
   * funzione**: lo stemma di una societa non e il volto di un minorenne, e
   * la ragione per cui le foto sono spente qui non si applica.
   */
  @Patch(":id/logo")
  disegnaLogo(@CurrentUser() u: JwtUser, @Param("id") id: string,
              @Body(new ZodPipe(LogoSquadraInput)) d: LogoSquadraInput) {
    return this.svc.impostaLogoDisegnato(u.sub, id, d);
  }

  @Put(":id/logo")
  metteLogo(@CurrentUser() u: JwtUser, @Param("id") id: string,
            @Body(new ZodPipe(FotoSquadraInput)) d: FotoSquadraInput) {
    return this.svc.impostaLogo(u.sub, id, d.dataUri);
  }

  @Delete(":id/logo")
  togliLogo(@CurrentUser() u: JwtUser, @Param("id") id: string) {
    return this.svc.rimuoviLogo(u.sub, id);
  }

  @Get(":id/logo")
  async leggiLogo(@CurrentUser() u: JwtUser, @Param("id") id: string, @Res() res: Response) {
    const l = await this.svc.logo(u.sub, id);
    if (!l) throw new NotFoundException({ code: "NON_TROVATO", message: "Nessuno stemma" });
    // `private` anche qui: la rotta e protetta, e una cache condivisa lungo
    // la strada servirebbe lo stemma di una squadra a chi non la vede.
    // L'indirizzo porta gia `?v=` con la data: si puo tenere a lungo.
    res.setHeader("Content-Type", l.tipo);
    res.setHeader("Cache-Control", "private, max-age=31536000, immutable");
    res.setHeader("ETag", `"${l.aggiornatoIl.getTime()}"`);
    res.send(l.dati);
  }

  @Get(":id/shares") sh(@CurrentUser() u: JwtUser, @Param("id") id: string) { return this.svc.condivisioni(u.sub, id); }
  @Post(":id/shares") add(@CurrentUser() u: JwtUser, @Param("id") id: string,
                          @Body(new ZodPipe(ShareInput)) d: { email: string }) {
    return this.svc.condividi(u.sub, id, d.email);
  }
  @Delete(":id/shares/:shareId") rev(@CurrentUser() u: JwtUser, @Param("id") id: string,
                                     @Param("shareId") s: string) { return this.svc.revoca(u.sub, id, s); }
}
