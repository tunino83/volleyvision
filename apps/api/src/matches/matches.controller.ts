import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Query, UseGuards } from "@nestjs/common";
import { MatchesService } from "./matches.service";
import { AuthGuard, CurrentUser, type JwtUser } from "../auth/auth.guard";
import { ZodPipe } from "../common/zod.pipe";
import { AggiungiGiocatoreInput, LineupInput, MatchInput, MatchRosterInput,
         ModificaGiocatoreInput, NumeroSetInput, SubstitutionInput } from "@vv/schema";
import { z } from "zod";

@Controller("matches") @UseGuards(AuthGuard)
export class MatchesController {
  constructor(private svc: MatchesService) {}

  @Get() elenco(@CurrentUser() u: JwtUser, @Query() q: any) {
    return this.svc.elenco(u.sub, { competitionId: q.competitionId, teamId: q.teamId,
                                    stato: q.stato, q: q.q, tag: q.tag,
                                    pagina: Number(q.pagina) || 1,
                                    perPagina: Number(q.perPagina) || undefined });
  }
  @Post() crea(@CurrentUser() u: JwtUser, @Body(new ZodPipe(MatchInput)) d: MatchInput) {
    return this.svc.crea(u.sub, d);
  }
  @Get(":id") det(@CurrentUser() u: JwtUser, @Param("id") id: string) { return this.svc.dettaglio(u.sub, id); }
  @Patch(":id") agg(@CurrentUser() u: JwtUser, @Param("id") id: string,
                    @Body(new ZodPipe(MatchInput)) d: MatchInput) { return this.svc.aggiorna(u.sub, id, d); }
  @Delete(":id") del(@CurrentUser() u: JwtUser, @Param("id") id: string) { return this.svc.elimina(u.sub, id); }

  @Patch(":id/sets")
  numeroSet(@CurrentUser() u: JwtUser, @Param("id") id: string,
            @Body(new ZodPipe(NumeroSetInput)) d: NumeroSetInput) {
    return this.svc.impostaNumeroSet(u.sub, id, d.numeroSet);
  }

  @Post(":id/players")
  aggiungi(@CurrentUser() u: JwtUser, @Param("id") id: string,
           @Body(new ZodPipe(AggiungiGiocatoreInput)) d: AggiungiGiocatoreInput) {
    return this.svc.aggiungiGiocatore(u.sub, id, d);
  }

  @Patch(":id/players/:playerId")
  modificaGiocatore(@CurrentUser() u: JwtUser, @Param("id") id: string,
                    @Param("playerId") playerId: string,
                    @Body(new ZodPipe(ModificaGiocatoreInput)) d: ModificaGiocatoreInput) {
    return this.svc.modificaGiocatore(u.sub, id, playerId, d);
  }

  @Delete(":id/players/:playerId")
  rimuoviGiocatore(@CurrentUser() u: JwtUser, @Param("id") id: string,
                   @Param("playerId") playerId: string) {
    return this.svc.rimuoviGiocatore(u.sub, id, playerId);
  }

  @Put(":id/players") roster(@CurrentUser() u: JwtUser, @Param("id") id: string,
                             @Body(new ZodPipe(MatchRosterInput)) d: MatchRosterInput) {
    return this.svc.salvaRoster(u.sub, id, d);
  }
  @Post(":id/players/import")
  importa(@CurrentUser() u: JwtUser, @Param("id") id: string,
          @Body(new ZodPipe(z.object({ lato: z.enum(["h", "a"]) }))) b: { lato: "h" | "a" }) {
    return this.svc.importaRoster(u.sub, id, b.lato);
  }

  @Put(":id/lineups/:set")
  formazione(@CurrentUser() u: JwtUser, @Param("id") id: string, @Param("set") set: string,
             @Body(new ZodPipe(LineupInput)) d: LineupInput) {
    return this.svc.salvaFormazione(u.sub, id, Number(set), d);
  }

  @Post(":id/substitutions")
  cambio(@CurrentUser() u: JwtUser, @Param("id") id: string,
         @Body(new ZodPipe(SubstitutionInput)) d: SubstitutionInput) {
    return this.svc.aggiungiCambio(u.sub, id, d);
  }
  @Delete(":id/substitutions/:subId")
  delCambio(@CurrentUser() u: JwtUser, @Param("id") id: string, @Param("subId") s: string) {
    return this.svc.eliminaCambio(u.sub, id, s);
  }

  @Post(":id/reprocess")
  ripr(@CurrentUser() u: JwtUser, @Param("id") id: string) { return this.svc.rielabora(u.sub, u.ruolo, id); }
}
