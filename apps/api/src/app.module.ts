import { Module } from "@nestjs/common";
import { PrismaService } from "./common/prisma.service";
import { AuditService } from "./common/audit.service";
import { MailService } from "./common/mail.service";
import { AuthModule } from "./auth/auth.module";
import { AdminModule } from "./admin/admin.module";
import { PersonsModule } from "./persons/persons.module";
import { TeamsModule } from "./teams/teams.module";
import { CompetitionsModule } from "./competitions/competitions.module";
import { MatchesModule } from "./matches/matches.module";
import { UploadsModule } from "./uploads/uploads.module";
import { NotificationsModule } from "./notifications/notifications.module";
import { AnalysisModule } from "./analysis/analysis.module";
import { FornitoreModule } from "./fornitore/fornitore.module";
import { HealthController } from "./common/health.controller";

@Module({
  imports: [AuthModule, AdminModule, PersonsModule, TeamsModule,
            CompetitionsModule, MatchesModule, UploadsModule, NotificationsModule,
            AnalysisModule, FornitoreModule],
  controllers: [HealthController],
  providers: [PrismaService, AuditService, MailService],
  exports: [PrismaService, AuditService, MailService],
})
export class AppModule {}
