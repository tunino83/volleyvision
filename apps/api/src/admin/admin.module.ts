import { Module } from "@nestjs/common";
import { AdminController } from "./admin.controller";
import { AdminService } from "./admin.service";
import { PrismaService } from "../common/prisma.service";
import { AuditService } from "../common/audit.service";
import { MailService } from "../common/mail.service";
import { AuthModule } from "../auth/auth.module";

@Module({
  imports: [AuthModule],
  controllers: [AdminController],
  providers: [AdminService, PrismaService, AuditService, MailService],
})
export class AdminModule {}
