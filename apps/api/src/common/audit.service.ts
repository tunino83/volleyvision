import { Injectable } from "@nestjs/common";
import { PrismaService } from "./prisma.service";

/** Registro append-only. Nessuna funzione di modifica o cancellazione. */
@Injectable()
export class AuditService {
  constructor(private prisma: PrismaService) {}
  async log(actorId: string | null, azione: string,
            oggettoTipo?: string, oggettoId?: string, dettaglio?: string) {
    await this.prisma.auditLog.create({
      data: { actorId, azione, oggettoTipo, oggettoId, dettaglio },
    });
  }
}
