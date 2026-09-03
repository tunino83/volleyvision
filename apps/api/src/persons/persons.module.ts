import { Module } from "@nestjs/common";
import { PersonsController } from "./persons.controller";
import { PersonsService } from "./persons.service";
import { SchedaService } from "./scheda.service";
import { AccessService } from "../common/access.service";
import { PrismaService } from "../common/prisma.service";
import { AuditService } from "../common/audit.service";
import { AuthModule } from "../auth/auth.module";

@Module({
  imports: [AuthModule],
  controllers: [PersonsController],
  providers: [PersonsService, PrismaService, AuditService, AccessService, SchedaService],
})
export class PersonsModule {}
