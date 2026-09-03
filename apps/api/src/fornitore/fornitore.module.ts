import { Module, forwardRef } from "@nestjs/common";
import { FORNITORE } from "./fornitore";
import { FornitoreSimulato } from "./simulato";
import { FornitoreEsterno } from "./esterno";
import { LavorazioneService } from "./lavorazione.service";
import { LavorazioneController } from "./lavorazione.controller";
import { PrismaService } from "../common/prisma.service";
import { AuditService } from "../common/audit.service";
import { AccessService } from "../common/access.service";
import { CONFIG } from "../common/config";
import { AuthModule } from "../auth/auth.module";
import { MatchesModule } from "../matches/matches.module";
import { AnalysisModule } from "../analysis/analysis.module";

/**
 * IL PUNTO IN CUI SI CAMBIA FORNITORE.
 *
 * Una variabile d'ambiente, una riga qui, e il resto del sistema non se ne
 * accorge: nessun altro file conosce l'implementazione.
 */
@Module({
  imports: [AuthModule, MatchesModule, AnalysisModule],
  controllers: [LavorazioneController],
  providers: [
    {
      provide: FORNITORE,
      useClass: CONFIG.fornitoreAnalisi === "esterno" ? FornitoreEsterno : FornitoreSimulato,
    },
    LavorazioneService, PrismaService, AuditService, AccessService,
  ],
  exports: [LavorazioneService],
})
export class FornitoreModule {}
