import { Body, Controller, Get, Param, Post, Query, UseGuards } from "@nestjs/common";
import { AnalysisService } from "./analysis.service";
import { StagioneService } from "./stagione.service";
import { AuthGuard, CurrentUser, type JwtUser } from "../auth/auth.guard";

/**
 * Statistiche su piu partite. Sta fuori da `matches/:id` perche non riguarda
 * una partita: riguarda **un insieme di partite**, ed e quello il soggetto.
 */
@Controller("stats") @UseGuards(AuthGuard)
export class StagioneController {
  constructor(private svc: StagioneService) {}

  @Get("players")
  giocatori(@CurrentUser() u: JwtUser, @Query() q: any) {
    return this.svc.perGiocatore(u.sub, {
      competitionId: q.competitionId, teamId: q.teamId,
      stagione: q.stagione, dal: q.dal, al: q.al,
    });
  }
}

@Controller("matches/:id/analysis") @UseGuards(AuthGuard)
export class AnalysisController {
  constructor(private svc: AnalysisService) {}

  /**
   * Acquisizione dei file del fornitore.
   * Provvisoria: quando il fornitore sara ingaggiato, l'acquisizione avverra
   * su sua notifica e non per invio manuale. Vedi docs/05-interventi.md, 1.
   */
  @Post("import")
  importa(@CurrentUser() u: JwtUser, @Param("id") id: string,
          @Body() b: { events: unknown; videos?: unknown; frames?: unknown }) {
    return this.svc.importa(u.sub, id, b);
  }

  @Get() pacchetto(@CurrentUser() u: JwtUser, @Param("id") id: string) {
    return this.svc.pacchetto(u.sub, id);
  }

  @Get("stats")
  stats(@CurrentUser() u: JwtUser, @Param("id") id: string,
        @Query("set") set?: string, @Query("untilFrame") uf?: string) {
    return this.svc.statistiche(u.sub, id, {
      set: set ? Number(set) : undefined,
      untilFrame: uf ? Number(uf) : undefined,
    });
  }

  @Get("players")
  giocatori(@CurrentUser() u: JwtUser, @Param("id") id: string, @Query("set") set?: string) {
    return this.svc.statisticheGiocatori(u.sub, id, { set: set ? Number(set) : undefined });
  }

  @Get("players/:team/:jersey/:chiave")
  eventiGiocatore(@CurrentUser() u: JwtUser, @Param("id") id: string,
                  @Param("team") team: "h" | "a", @Param("jersey") jersey: string,
                  @Param("chiave") chiave: string, @Query("set") set?: string) {
    return this.svc.eventiGiocatore(u.sub, id, team, Number(jersey), chiave,
                                    set ? Number(set) : undefined);
  }

  @Get("rallies")
  scambi(@CurrentUser() u: JwtUser, @Param("id") id: string, @Query("set") set?: string) {
    return this.svc.scambi(u.sub, id, set ? Number(set) : undefined);
  }

  @Post("events")
  eventi(@CurrentUser() u: JwtUser, @Param("id") id: string, @Body() b: { indici: number[] }) {
    return this.svc.eventi(u.sub, id, b.indici ?? []);
  }

  /**
   * Le posizioni dei giocatori. **Senza `da` e `a` le restituisce tutte**,
   * ed e cosi che le chiede il client: se le porta in locale una volta sola,
   * cosi il campo bidimensionale funziona anche senza rete.
   *
   * Un intervallo si puo ancora chiedere, ma non e la via principale.
   */
  @Get("positions")
  posizioni(@CurrentUser() u: JwtUser, @Param("id") id: string,
            @Query("da") da?: string, @Query("a") a?: string) {
    // `Number("abc")` fa NaN, che confrontato con qualunque cosa e falso e
    // svuoterebbe il risultato senza dire perche: si ripiega su "tutte".
    const n = (v?: string) => {
      const x = Number(v);
      return Number.isFinite(x) ? x : 0;
    };
    return this.svc.posizioni(u.sub, id, n(da), n(a));
  }
}
