import { Body, Controller, Delete, Get, NotFoundException, Param, Patch,
         Post, Put, Query, Res, UseGuards } from "@nestjs/common";
import type { Response } from "express";
import { PersonsService } from "./persons.service";
import { SchedaService } from "./scheda.service";
import { AuthGuard, CurrentUser, type JwtUser } from "../auth/auth.guard";
import { ZodPipe } from "../common/zod.pipe";
import { CONFIG } from "../common/config";
import { AvatarInput, FotoPersonaInput, PersonInput, PreferitoInput } from "@vv/schema";
import { z } from "zod";

@Controller("persons") @UseGuards(AuthGuard)
export class PersonsController {
  constructor(private svc: PersonsService, private sched: SchedaService) {}

  @Get() elenco(@CurrentUser() u: JwtUser, @Query("q") q?: string) { return this.svc.elenco(u.sub, q); }
  /** La scheda di una persona: cosa ha fatto, partita per partita. */
  @Get(":id/scheda")
  scheda(@CurrentUser() u: JwtUser, @Param("id") id: string) {
    return this.sched.scheda(u.sub, id);
  }

  @Get("duplicati") dup(@CurrentUser() u: JwtUser) { return this.svc.possibiliDuplicati(u.sub); }

  /**
   * Le preferite, per la home: solo quelle, con quel che serve a disegnarne
   * l'avatar. L'elenco completo porta squadre e conteggi per centinaia di
   * persone, e la home ne usa cinque.
   *
   * Le statistiche non stanno qui: le ha gia `GET /stats/players`. Calcolarle
   * una seconda volta altrove e il modo sicuro di vedere due numeri diversi
   * per la stessa cosa.
   */
  @Get("preferite") pref(@CurrentUser() u: JwtUser) { return this.svc.preferite(u.sub); }

  @Put(":id/preferita")
  preferisci(@CurrentUser() u: JwtUser, @Param("id") id: string,
             @Body(new ZodPipe(PreferitoInput)) d: PreferitoInput) {
    return this.svc.preferisci(u.sub, id, d.preferita);
  }

  @Post() crea(@CurrentUser() u: JwtUser, @Body(new ZodPipe(PersonInput)) d: PersonInput) {
    return this.svc.crea(u.sub, d);
  }

  @Patch(":id") agg(@CurrentUser() u: JwtUser, @Param("id") id: string,
                    @Body(new ZodPipe(PersonInput)) d: PersonInput) {
    return this.svc.aggiorna(u.sub, id, d);
  }

  /** Cambia l'avatar. Non e un file: sono due stringhe da cui si disegna. */
  @Patch(":id/avatar")
  avatar(@CurrentUser() u: JwtUser, @Param("id") id: string,
         @Body(new ZodPipe(AvatarInput)) d: AvatarInput) {
    return this.svc.impostaAvatar(u.sub, id, d);
  }

  /**
   * La fotografia: la si mette, la si toglie, la si guarda.
   *
   * Tre rotte e non un campo dell'anagrafica, perche i byte dell'immagine non
   * devono viaggiare con l'elenco delle persone — quello finisce in locale su
   * ogni dispositivo e deve restare di decine di KB, non di megabyte.
   */
  /**
   * Spente si comportano come se non esistessero: nascondere il comando nel
   * client non basta: chi conosce la rotta la chiamerebbe lo stesso.
   */
  private esigiFoto() {
    if (!CONFIG.funzioni.fotoPersone) {
      throw new NotFoundException({ code: "NON_ATTIVA",
        message: "Le fotografie non sono attive su questa installazione" });
    }
  }

  @Put(":id/foto")
  metteFoto(@CurrentUser() u: JwtUser, @Param("id") id: string,
            @Body(new ZodPipe(FotoPersonaInput)) d: FotoPersonaInput) {
    this.esigiFoto();
    return this.svc.impostaFoto(u.sub, id, d.dataUri);
  }

  @Delete(":id/foto")
  togliFoto(@CurrentUser() u: JwtUser, @Param("id") id: string) {
    this.esigiFoto();
    return this.svc.rimuoviFoto(u.sub, id);
  }

  @Get(":id/foto")
  async leggiFoto(@CurrentUser() u: JwtUser, @Param("id") id: string,
                  @Res() res: Response) {
    this.esigiFoto();
    const f = await this.svc.foto(u.sub, id);
    if (!f) throw new NotFoundException({ code: "NON_TROVATO", message: "Nessuna fotografia" });
    // `private`: e la foto di una persona nell'anagrafica di **un** utente, e
    // non deve finire in una cache condivisa lungo la strada.
    // L'indirizzo porta gia `?v=` con la data: qui si puo tenere a lungo.
    res.setHeader("Content-Type", f.tipo);
    res.setHeader("Cache-Control", "private, max-age=31536000, immutable");
    res.setHeader("ETag", `"${f.aggiornataIl.getTime()}"`);
    res.send(f.dati);
  }

  @Post(":id/merge")
  merge(@CurrentUser() u: JwtUser, @Param("id") id: string,
        @Body(new ZodPipe(z.object({ intoPersonId: z.string() }))) b: { intoPersonId: string }) {
    return this.svc.unisci(u.sub, id, b.intoPersonId);
  }
}
