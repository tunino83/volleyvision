import { Module } from "@nestjs/common";
import { CompetitionsController } from "./competitions.controller";
import { CompetitionsService } from "./competitions.service";
import { PrismaService } from "../common/prisma.service";
import { AccessService } from "../common/access.service";
import { AuditService } from "../common/audit.service";
import { MailService } from "../common/mail.service";
import { AuthModule } from "../auth/auth.module";

@Module({
  imports: [AuthModule],
  controllers: [CompetitionsController],
  providers: [CompetitionsService, PrismaService, AccessService, AuditService, MailService],
})
export class CompetitionsModule {}
