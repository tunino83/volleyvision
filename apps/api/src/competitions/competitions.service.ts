import { BadRequestException, Injectable } from "@nestjs/common";
import { PrismaService } from "../common/prisma.service";
import { AccessService } from "../common/access.service";
import { AuditService } from "../common/audit.service";
import { MailService } from "../common/mail.service";
import type { CompetitionInput } from "@vv/schema";

@Injectable()
export class CompetitionsService {
  constructor(private prisma: PrismaService, private access: AccessService,
              private audit: AuditService, private mail: MailService) {}

  async elenco(userId: string) {
    const ids = await this.access.competitionIdsVisibili(userId);
    const c = await this.prisma.competition.findMany({
      where: { id: { in: ids } },
      include: { _count: { select: { matches: true } } },
      orderBy: [{ stagione: "desc" }, { nome: "asc" }],
    });
    return c.map((x) => ({
      id: x.id, nome: x.nome, stagione: x.stagione, descrizione: x.descrizione,
      dataInizio: x.dataInizio?.toISOString() ?? null,
      dataFine: x.dataFine?.toISOString() ?? null,
      partite: x._count.matches, proprietario: x.ownerId === userId,
    }));
  }

  crea(userId: string, dto: CompetitionInput) {
    return this.prisma.competition.create({
      data: { ownerId: userId, nome: dto.nome, stagione: dto.stagione,
              descrizione: dto.descrizione ?? null,
              dataInizio: dto.dataInizio ? new Date(dto.dataInizio) : null,
              dataFine: dto.dataFine ? new Date(dto.dataFine) : null },
    });
  }

  async dettaglio(userId: string, id: string) {
    const { competition, proprietario } = await this.access.competition(userId, id);
    const partite = await this.prisma.match.count({ where: { competitionId: id } });
    return { ...competition, proprietario, partite };
  }

  async aggiorna(userId: string, id: string, dto: CompetitionInput) {
    await this.access.competition(userId, id, true);
    return this.prisma.competition.update({
      where: { id }, data: { nome: dto.nome, stagione: dto.stagione,
        descrizione: dto.descrizione ?? null,
        dataInizio: dto.dataInizio ? new Date(dto.dataInizio) : null,
        dataFine: dto.dataFine ? new Date(dto.dataFine) : null } });
  }

  async elimina(userId: string, id: string) {
    await this.access.competition(userId, id, true);
    const n = await this.prisma.match.count({ where: { competitionId: id } });
    if (n > 0) {
      throw new BadRequestException({ code: "CONFLITTO",
        message: `Impossibile eliminare: il campionato contiene ${n} partite` });
    }
    await this.prisma.competition.delete({ where: { id } });
    return { ok: true };
  }

  async condivisioni(userId: string, id: string) {
    await this.access.competition(userId, id);
    return this.prisma.competitionShare.findMany({ where: { competitionId: id } });
  }

  async condividi(userId: string, id: string, email: string) {
    const { competition } = await this.access.competition(userId, id, true);
    const dest = await this.prisma.user.findUnique({ where: { email } });
    const share = await this.prisma.competitionShare.upsert({
      where: { competitionId_email: { competitionId: id, email } },
      create: { competitionId: id, email, userId: dest?.id ?? null,
                statoInvito: dest ? "attivo" : "pendente" },
      update: {},
    });
    await this.mail.invito(email, `il campionato ${competition.nome}`, "Un utente");
    await this.audit.log(userId, "condivisione_concessa", "competition", id, email);
    return share;
  }

  async revoca(userId: string, id: string, shareId: string) {
    await this.access.competition(userId, id, true);
    await this.prisma.competitionShare.delete({ where: { id: shareId } });
    await this.audit.log(userId, "condivisione_revocata", "competition", id, shareId);
    return { ok: true };
  }
}
