import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "./prisma.service";

/**
 * Modello dei permessi: OWNERSHIP + CONDIVISIONE, non licenze.
 * Chi crea una squadra o un campionato ne e proprietario e puo condividerlo
 * in SOLA LETTURA. Non esistono anagrafiche comuni: ogni utente crea le proprie.
 * Vedi docs/01 del progetto di analisi.
 */
@Injectable()
export class AccessService {
  constructor(private prisma: PrismaService) {}

  async team(userId: string, teamId: string, scrittura = false) {
    const t = await this.prisma.team.findUnique({
      where: { id: teamId }, include: { shares: true } });
    if (!t) throw new NotFoundException({ code: "NON_TROVATO", message: "Squadra non trovata" });
    if (t.ownerId === userId) return { team: t, proprietario: true };
    if (scrittura) throw new ForbiddenException({ code: "NON_AUTORIZZATO", message: "Non hai i permessi" });
    if (t.shares.some((s) => s.userId === userId)) return { team: t, proprietario: false };
    throw new ForbiddenException({ code: "NON_AUTORIZZATO", message: "Non hai i permessi" });
  }

  async competition(userId: string, competitionId: string, scrittura = false) {
    const c = await this.prisma.competition.findUnique({
      where: { id: competitionId }, include: { shares: true } });
    if (!c) throw new NotFoundException({ code: "NON_TROVATO", message: "Campionato non trovato" });
    if (c.ownerId === userId) return { competition: c, proprietario: true };
    if (scrittura) throw new ForbiddenException({ code: "NON_AUTORIZZATO", message: "Non hai i permessi" });
    if (c.shares.some((s) => s.userId === userId)) return { competition: c, proprietario: false };
    throw new ForbiddenException({ code: "NON_AUTORIZZATO", message: "Non hai i permessi" });
  }

  /** Una partita e accessibile se lo e il suo campionato. */
  async match(userId: string, matchId: string, scrittura = false) {
    const m = await this.prisma.match.findUnique({
      where: { id: matchId },
      include: { competition: { include: { shares: true } }, homeTeam: true, awayTeam: true,
                 video: true },
    });
    if (!m) throw new NotFoundException({ code: "NON_TROVATO", message: "Partita non trovata" });
    const proprietario = m.competition.ownerId === userId || m.createdById === userId;
    if (proprietario) return { match: m, proprietario: true };
    if (scrittura) throw new ForbiddenException({ code: "NON_AUTORIZZATO", message: "Non hai i permessi" });
    if (m.competition.shares.some((s) => s.userId === userId)) return { match: m, proprietario: false };
    throw new ForbiddenException({ code: "NON_AUTORIZZATO", message: "Non hai i permessi" });
  }

  /** Id dei campionati visibili: propri + condivisi. */
  async competitionIdsVisibili(userId: string) {
    const [propri, condivisi] = await Promise.all([
      this.prisma.competition.findMany({ where: { ownerId: userId }, select: { id: true } }),
      this.prisma.competitionShare.findMany({ where: { userId }, select: { competitionId: true } }),
    ]);
    return [...propri.map((c) => c.id), ...condivisi.map((s) => s.competitionId)];
  }

  async teamIdsVisibili(userId: string) {
    const [propri, condivisi] = await Promise.all([
      this.prisma.team.findMany({ where: { ownerId: userId }, select: { id: true } }),
      this.prisma.teamShare.findMany({ where: { userId }, select: { teamId: true } }),
    ]);
    return [...propri.map((t) => t.id), ...condivisi.map((s) => s.teamId)];
  }
}
