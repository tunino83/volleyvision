import { Module } from "@nestjs/common";
import { MatchesController } from "./matches.controller";
import { MatchesService } from "./matches.service";
import { LifecycleService } from "./lifecycle.service";
import { PrismaService } from "../common/prisma.service";
import { AccessService } from "../common/access.service";
import { AuditService } from "../common/audit.service";
import { AuthModule } from "../auth/auth.module";

@Module({
  imports: [AuthModule],
  controllers: [MatchesController],
  providers: [MatchesService, LifecycleService, PrismaService, AccessService, AuditService],
  exports: [LifecycleService],
})
export class MatchesModule {}
