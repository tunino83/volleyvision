import { Module, forwardRef } from "@nestjs/common";
import { UploadsController, UploadsTrasferimentoController } from "./uploads.controller";
import { DelegaGuard } from "./delega.guard";
import { UploadsService } from "./uploads.service";
import { ManutenzioneService } from "./manutenzione.service";
import { PrismaService } from "../common/prisma.service";
import { AccessService } from "../common/access.service";
import { AuditService } from "../common/audit.service";
import { AuthModule } from "../auth/auth.module";
import { MatchesModule } from "../matches/matches.module";
import { FornitoreModule } from "../fornitore/fornitore.module";

@Module({
  imports: [AuthModule, MatchesModule, forwardRef(() => FornitoreModule)],
  controllers: [UploadsController, UploadsTrasferimentoController],
  providers: [UploadsService, ManutenzioneService, PrismaService, AccessService, AuditService,
              DelegaGuard],
})
export class UploadsModule {}
