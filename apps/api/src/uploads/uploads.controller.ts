import { BadRequestException, Body, Controller, Delete, Get, Param, Post, Query, Req, UseGuards } from "@nestjs/common";
import type { Request } from "express";
import { UploadsService } from "./uploads.service";
import { AuthGuard, CurrentUser, RolesGuard, Ruoli, type JwtUser } from "../auth/auth.guard";
import { ZodPipe } from "../common/zod.pipe";
import { UploadSessionInput } from "@vv/schema";
import { z } from "zod";

@Controller() @UseGuards(AuthGuard)
export class UploadsController {
  constructor(private svc: UploadsService) {}

  @Post("matches/:id/videos/:lato/upload-session")
  apri(@CurrentUser() u: JwtUser, @Param("id") id: string, @Param("lato") lato: string,
       @Body(new ZodPipe(UploadSessionInput)) d: UploadSessionInput) {
    return this.svc.apriSessione(u.sub, id, Number(lato), d);
  }

  /** Sessione aperta per quel lato: e cio che permette la ripresa dopo chiusura. */
  @Get("matches/:id/videos/:lato/upload-session")
  aperta(@CurrentUser() u: JwtUser, @Param("id") id: string, @Param("lato") lato: string) {
    return this.svc.sessioneAperta(u.sub, id, Number(lato));
  }

  @Get("uploads/:uploadId")
  stato(@CurrentUser() u: JwtUser, @Param("uploadId") id: string) { return this.svc.stato(u.sub, id); }

  /**
   * Ricezione di un blocco. In sviluppo i byte passano da qui; in esercizio
   * andranno diretti allo spazio di archiviazione. Vedi storage.ts.
   */
  @Post("uploads/:uploadId/chunk")
  chunk(@CurrentUser() u: JwtUser, @Param("uploadId") id: string,
        @Query("offset") offset: string, @Req() req: Request) {
    const buf = req.body as unknown as Buffer;
    if (!Buffer.isBuffer(buf)) {
      throw new BadRequestException({ code: "CORPO_NON_VALIDO",
        message: "Il blocco va inviato come flusso binario" });
    }
    return this.svc.ricevi(u.sub, id, Number(offset ?? 0), buf);
  }

  @Post("uploads/:uploadId/complete")
  completa(@CurrentUser() u: JwtUser, @Param("uploadId") id: string,
           @Body(new ZodPipe(z.object({ checksum: z.string().nullable().optional() }))) b: any) {
    return this.svc.completa(u.sub, id, b?.checksum);
  }

  @Delete("uploads/:uploadId")
  annulla(@CurrentUser() u: JwtUser, @Param("uploadId") id: string) { return this.svc.annulla(u.sub, id); }

  @Post("admin/uploads/reconcile") @UseGuards(RolesGuard) @Ruoli("admin")
  riconcilia() { return this.svc.riconcilia(); }
}
