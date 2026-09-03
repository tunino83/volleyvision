import { Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { LavorazioneService } from "./lavorazione.service";
import { AuthGuard, CurrentUser, RolesGuard, Ruoli, type JwtUser } from "../auth/auth.guard";
import { AccessService } from "../common/access.service";

@Controller() @UseGuards(AuthGuard)
export class LavorazioneController {
  constructor(private svc: LavorazioneService, private access: AccessService) {}

  /** Stato dell'elaborazione presso il fornitore. */
  @Get("matches/:id/processing")
  async stato(@CurrentUser() u: JwtUser, @Param("id") id: string) {
    await this.access.match(u.sub, id);
    return this.svc.stato(id);
  }

  /**
   * Anticipa la consegna del simulatore.
   * Non fa nulla col fornitore vero: e uno strumento di sviluppo.
   */
  @Post("matches/:id/processing/accelerate")
  async accelera(@CurrentUser() u: JwtUser, @Param("id") id: string) {
    await this.access.match(u.sub, id, true);
    return this.svc.accelera(id);
  }

  /** Giro di interrogazione forzato, per diagnosi. */
  @Post("admin/processing/poll") @UseGuards(RolesGuard) @Ruoli("admin")
  giro() { return this.svc.giro(); }
}
