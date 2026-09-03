import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { randomBytes } from "crypto";
import { PrismaService } from "../common/prisma.service";
import { AuditService } from "../common/audit.service";
import { MailService } from "../common/mail.service";

/**
 * La SEGRETERIA gestisce utenti, ruoli e reimpostazione password.
 * NON ha accesso ad alcun contenuto: video, partite, statistiche.
 * Nessuna funzione consente di vedere o impostare una password.
 */
@Injectable()
export class AdminService {
  constructor(private prisma: PrismaService, private audit: AuditService, private mail: MailService) {}

  async utenti(q?: string, ruolo?: string, stato?: string) {
    const users = await this.prisma.user.findMany({
      where: {
        ...(q ? { OR: [{ email: { contains: q, mode: "insensitive" } }, { cognome: { contains: q, mode: "insensitive" } }, { nome: { contains: q, mode: "insensitive" } }] } : {}),
        ...(ruolo ? { ruolo } : {}), ...(stato ? { stato } : {}),
      },
      orderBy: { creatoIl: "desc" }, take: 200,
    });
    const conIdentita = await this.prisma.authIdentity.groupBy({
      by: ["userId"], _count: { _all: true },
      where: { userId: { in: users.map((u) => u.id) } } });
    const quante = new Map(conIdentita.map((r) => [r.userId, r._count._all]));
    return users.map((u) => ({
      id: u.id, email: u.email, nome: u.nome, cognome: u.cognome, ruolo: u.ruolo,
      stato: u.stato, creatoIl: u.creatoIl.toISOString(),
      ultimoAccesso: u.ultimoAccesso?.toISOString() ?? null,
      emailVerificata: !!u.emailVerificataIl,
      // Nessuna identita e nessun accesso: l'invito non e ancora stato accettato.
      inAttesaDiInvito: (quante.get(u.id) ?? 0) === 0 && !u.ultimoAccesso,
    }));
  }

  /**
   * Crea un'utenza e manda il collegamento per scegliere la password.
   * **Non esiste una funzione che imposti una password**, qui: chi amministra
   * non deve poter entrare nell'account di nessuno.
   */
  async invitaUtente(actorId: string, dto: { nome: string; cognome: string; email: string; ruolo: string }) {
    const email = dto.email.toLowerCase();
    const gia = await this.prisma.user.findUnique({ where: { email } });
    if (gia) {
      throw new BadRequestException({ code: "CONFLITTO",
        message: "Esiste gia un'utenza con questo indirizzo",
        details: { email: ["Indirizzo gia registrato"] } });
    }
    const u = await this.prisma.user.create({
      data: { email, nome: dto.nome, cognome: dto.cognome, ruolo: dto.ruolo },
    });
    // Nessuna identita: nasce quando l'interessato sceglie la password.
    const valore = randomBytes(32).toString("hex");
    await this.prisma.token.create({
      data: { userId: u.id, tipo: "invito", valore,
              scadeIl: new Date(Date.now() + 7 * 86400000) },
    });
    await this.mail.invitoUtenza(email, valore, dto.nome);
    await this.audit.log(actorId, "invito_utente", "user", u.id, email);
    return { id: u.id, email: u.email, nome: u.nome, cognome: u.cognome,
             ruolo: u.ruolo, stato: u.stato, invitato: true };
  }

  /** Rimanda l'invito: il collegamento vale sette giorni e scade. */
  async rinviaInvito(actorId: string, id: string) {
    const u = await this.prisma.user.findUniqueOrThrow({ where: { id } });
    const valore = randomBytes(32).toString("hex");
    await this.prisma.token.create({
      data: { userId: id, tipo: "invito", valore, scadeIl: new Date(Date.now() + 7 * 86400000) } });
    await this.mail.invitoUtenza(u.email, valore, u.nome);
    await this.audit.log(actorId, "invito_reinviato", "user", id);
    return { ok: true };
  }

  async modificaUtente(actorId: string, id: string,
                       dto: { nome?: string; cognome?: string; email?: string }) {
    if (dto.email) {
      const altro = await this.prisma.user.findUnique({ where: { email: dto.email.toLowerCase() } });
      if (altro && altro.id !== id) {
        throw new BadRequestException({ code: "CONFLITTO",
          message: "Indirizzo gia usato da un'altra utenza",
          details: { email: ["Indirizzo gia registrato"] } });
      }
    }
    const u = await this.prisma.user.update({
      where: { id },
      data: { ...(dto.nome ? { nome: dto.nome } : {}),
              ...(dto.cognome ? { cognome: dto.cognome } : {}),
              ...(dto.email ? { email: dto.email.toLowerCase(), emailVerificataIl: null } : {}) },
    });
    // Cambiando l'email cambia anche l'identita a password, che vi si appoggia.
    if (dto.email) {
      await this.prisma.authIdentity.updateMany({
        where: { userId: id, provider: "password" },
        data: { providerUserId: dto.email.toLowerCase() } });
    }
    await this.audit.log(actorId, "modifica_utente", "user", id);
    return { id: u.id, email: u.email, nome: u.nome, cognome: u.cognome };
  }

  async utente(id: string) {
    const u = await this.prisma.user.findUnique({
      where: { id },
      include: { teams: { select: { id: true, nome: true } },
                 competitions: { select: { id: true, nome: true } } },
    });
    if (!u) throw new NotFoundException({ code: "NON_TROVATO", message: "Utente non trovato" });
    // Solo i NOMI delle risorse possedute: nessun accesso ai contenuti.
    return { id: u.id, email: u.email, nome: u.nome, cognome: u.cognome, ruolo: u.ruolo,
             stato: u.stato, creatoIl: u.creatoIl.toISOString(),
             ultimoAccesso: u.ultimoAccesso?.toISOString() ?? null,
             squadre: u.teams.map((t) => t.nome), campionati: u.competitions.map((c) => c.nome) };
  }

  async cambiaRuolo(actorId: string, id: string, ruolo: string) {
    const u = await this.prisma.user.update({ where: { id }, data: { ruolo } });
    await this.audit.log(actorId, "cambio_ruolo", "user", id, `-> ${ruolo}`);
    return { id: u.id, ruolo: u.ruolo };
  }

  async cambiaStato(actorId: string, id: string, stato: string) {
    const u = await this.prisma.user.update({ where: { id }, data: { stato } });
    await this.audit.log(actorId, stato === "sospeso" ? "sospensione" : "riattivazione", "user", id);
    return { id: u.id, stato: u.stato };
  }

  /** Invia il collegamento di reimpostazione. Non imposta mai la password. */
  async inviaReset(actorId: string, id: string) {
    const u = await this.prisma.user.findUniqueOrThrow({ where: { id } });
    const valore = randomBytes(32).toString("hex");
    await this.prisma.token.create({
      data: { userId: u.id, tipo: "reset", valore, scadeIl: new Date(Date.now() + 3600 * 1000) } });
    await this.mail.resetPassword(u.email, valore);
    await this.audit.log(actorId, "reset_password_inviato", "user", id);
    return { ok: true };
  }

  async eliminaUtente(actorId: string, id: string) {
    await this.prisma.user.delete({ where: { id } });
    await this.audit.log(actorId, "eliminazione_utente", "user", id);
    return { ok: true };
  }

  async registro(q?: { actor?: string; azione?: string }) {
    const righe = await this.prisma.auditLog.findMany({
      where: { ...(q?.actor ? { actorId: q.actor } : {}), ...(q?.azione ? { azione: q.azione } : {}) },
      include: { actor: { select: { email: true } } },
      orderBy: { creatoIl: "desc" }, take: 300,
    });
    return righe.map((r) => ({
      id: r.id, momento: r.creatoIl.toISOString(), attore: r.actor?.email ?? "sistema",
      azione: r.azione, oggetto: r.oggettoTipo ? `${r.oggettoTipo}:${r.oggettoId}` : null,
      dettaglio: r.dettaglio,
    }));
  }

  async report() {
    const [utenti, attivi, partite, pronte, errori, video, squadre] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.count({ where: { ultimoAccesso: { gte: new Date(Date.now() - 30 * 86400000) } } }),
      this.prisma.match.count(),
      this.prisma.match.count({ where: { stato: "READY" } }),
      this.prisma.match.count({ where: { stato: "ERROR" } }),
      this.prisma.video.count({ where: { stato: { in: ["CARICATO", "NORMALIZZATO"] } } }),
      this.prisma.team.count(),
    ]);
    const bytes = await this.prisma.video.aggregate({ _sum: { dimensione: true } });
    return { utenti, attiviUltimi30gg: attivi, partite, partitePronte: pronte,
             analisiFallite: errori, videoCaricati: video, squadre,
             spazioOccupatoBytes: Number(bytes._sum.dimensione ?? 0) };
  }
}
