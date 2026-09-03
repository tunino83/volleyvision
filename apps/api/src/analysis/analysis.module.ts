import { Module } from "@nestjs/common";
import { AnalysisController, StagioneController } from "./analysis.controller";
import { AnalysisService } from "./analysis.service";
import { StagioneService } from "./stagione.service";
import { PrismaService } from "../common/prisma.service";
import { AccessService } from "../common/access.service";
import { AuditService } from "../common/audit.service";
import { AuthModule } from "../auth/auth.module";
import { MatchesModule } from "../matches/matches.module";

@Module({
  imports: [AuthModule, MatchesModule],
  controllers: [AnalysisController, StagioneController],
  providers: [AnalysisService, StagioneService, PrismaService, AccessService, AuditService],
  exports: [AnalysisService],
})
export class AnalysisModule {}
