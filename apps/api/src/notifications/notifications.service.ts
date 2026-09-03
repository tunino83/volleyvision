import { Injectable } from "@nestjs/common";
import { PrismaService } from "../common/prisma.service";

@Injectable()
export class NotificationsService {
  constructor(private prisma: PrismaService) {}

  /** Alimenta la campanellina: partite passate in READY e non ancora viste. */
  async disponibili(userId: string) {
    const n = await this.prisma.notification.findMany({
      where: { userId, vistaIl: null },
      include: { match: { include: { homeTeam: true, awayTeam: true } } },
      orderBy: { creatoIl: "desc" },
    });
    return {
      count: n.length,
      partite: n.filter((x) => x.match).map((x) => ({
        id: x.matchId, etichetta: `${x.match!.homeTeam.nome} — ${x.match!.awayTeam.nome}`,
        completataIl: x.creatoIl.toISOString(),
      })),
    };
  }

  async segnaViste(userId: string) {
    await this.prisma.notification.updateMany({
      where: { userId, vistaIl: null }, data: { vistaIl: new Date() } });
    return { ok: true };
  }
}
