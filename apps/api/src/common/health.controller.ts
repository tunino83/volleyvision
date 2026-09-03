import { Controller, Get } from "@nestjs/common";
import { CONFIG } from "./config";

@Controller()
export class HealthController {
  @Get("health") health() { return { ok: true }; }

  /** Versione minima supportata: consente di forzare l'aggiornamento dei client. */
  @Get("version")
  version() {
    return { version: "0.1.0", minClient: "0.1.0", fase: "1 — gestionale (web)",
             // Quali funzioni sono accese: i client si regolano su questa,
             // non su una loro variabile di costruzione.
             funzioni: CONFIG.funzioni };
  }
}
