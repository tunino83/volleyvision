import { Module } from "@nestjs/common";
import { TeamsController } from "./teams.controller";
import { TeamsService } from "./teams.service";
import { PrismaService } from "../common/prisma.service";
import { AccessService } from "../common/access.service";
import { AuditService } from "../common/audit.service";
import { MailService } from "../common/mail.service";
import { AuthModule } from "../auth/auth.module";

@Module({
  imports: [AuthModule],
  controllers: [TeamsController],
  providers: [TeamsService, PrismaService, AccessService, AuditService, MailService],
})
export class TeamsModule {}
