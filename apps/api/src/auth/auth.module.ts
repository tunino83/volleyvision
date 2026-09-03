import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { IdentitaService } from "./identita.service";
import { PrismaService } from "../common/prisma.service";
import { AuditService } from "../common/audit.service";
import { MailService } from "../common/mail.service";
import { CONFIG } from "../common/config";

@Module({
  imports: [JwtModule.register({ secret: CONFIG.jwtSecret, signOptions: { expiresIn: CONFIG.accessTtl } })],
  controllers: [AuthController],
  providers: [AuthService, IdentitaService, PrismaService, AuditService, MailService],
  exports: [AuthService, JwtModule],
})
export class AuthModule {}
