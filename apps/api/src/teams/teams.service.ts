import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { CONFIG } from "../common/config";
import { PrismaService } from "../common/prisma.service";
import { AccessService } from "../common/access.service";
import { AuditService } from "../common/audit.service";
import { MailService } from "../common/mail.service";
import type { TeamInput, TeamRosterInput } from "@vv/schema";

@Injectable()
export class TeamsService {
  constructor(private prisma: PrismaService, private access: AccessService,
              private audit: AuditService, private mail: MailService) {}

  async elenco(userId: string) {
    const ids = await this.access.teamIdsVisibili(userId);
    const teams = await this.prisma.team.findMany({
      where: { id: { in: ids } },
      include: { owner: { select: { id: true, nome: true, cognome: true } },
                 _count: { select: { giocatori: true, matchesHome: true, matchesAway: true } } },
      orderBy: [{ stagione: "desc" }, { nome: "asc" }],
    });
    return teams.map((t) => ({
      id: t.id, nome: t.nome, stagione: t.stagione,
      giocatori: t._count.giocatori,
      partite: t._count.matchesHome + t._count.matchesAway,
      proprietario: t.ownerId === userId,
      proprietarioNome: `${t.owner.nome} ${t.owner.cognome}`,
    }));
  }

  crea(userId: string, dto: TeamInput) {
    return this.prisma.team.create({ data: { ownerId: userId, ...dto } });
  }

  async dettaglio(userId: string, id: string) {
    const { team, proprietario } = await this.access.team(userId, id);
    const righe = await this.prisma.teamPlayer.findMany({
      where: { teamId: id }, orderBy: { numeroMaglia: "asc" },
      // L'avatar sta sulla persona: la stessa faccia segue il giocatore fra
      // squadre e stagioni, che e il motivo per cui non sta sulla riga.
      include: { person: { select: { id: true, cognome: true, nome: true,
                                     avatarStile: true, avatarSeme: true,
                                     // Solo la data: i byte restano fuori dall'album.
                                     foto: { select: { aggiornataIl: true } } } } },
    });

    // La foto si appiattisce a **un numero**, la sua versione. Lasciarla
    // uscire come oggetto (`{ aggiornataIl }`) la renderebbe comunque
    // "vera" per il client, che la userebbe come versione nell'indirizzo:
    // funzionerebbe per caso, e la foto aggiornata non comparirebbe mai
    // perche la chiave della copia locale non cambierebbe.
    const giocatori = righe.map((r) => ({
      ...r,
      person: r.person && {
        ...r.person,
        foto: CONFIG.funzioni.fotoPersone && r.person.foto
              ? r.person.foto.aggiornataIl.getTime() : null,
      },
    }));

    return { id: team.id, nome: team.nome, stagione: team.stagione, proprietario, giocatori };
  }

  async aggiorna(userId: string, id: string, dto: TeamInput) {
    await this.access.team(userId, id, true);
    return this.prisma.team.update({ where: { id }, data: dto });
  }

  /**
   * Sostituzione completa del roster. Le partite gia create NON cambiano:
   * ne conservano una copia (match_players). Vedi docs/09 S-10.
   */
  async salvaRoster(userId: string, id: string, dto: TeamRosterInput) {
    await this.access.team(userId, id, true);
    await this.prisma.$transaction([
      this.prisma.teamPlayer.deleteMany({ where: { teamId: id } }),
      this.prisma.teamPlayer.createMany({
        data: dto.giocatori.map((g) => ({
          teamId: id, personId: g.personId ?? null, numeroMaglia: g.numeroMaglia,
          cognome: g.cognome, nome: g.nome, ruolo: g.ruolo ?? null, libero: g.libero ?? false,
        })),
      }),
    ]);
    return this.dettaglio(userId, id);
  }

  async elimina(userId: string, id: string) {
    await this.access.team(userId, id, true);
    const n = await this.prisma.match.count({
      where: { OR: [{ homeTeamId: id }, { awayTeamId: id }] } });
    if (n > 0) {
      throw new BadRequestException({ code: "CONFLITTO",
        message: `Impossibile eliminare: la squadra e associata a ${n} partite` });
    }
    await this.prisma.team.delete({ where: { id } });
    return { ok: true };
  }

  // --------------------------------------------------------- condivisione
  /**
   * `ruolo` e `libero` dicono la stessa cosa in due modi, e possono
   * contraddirsi. Finche esistono entrambi, il ruolo comanda: e quello che
   * l'utente sceglie da un elenco, mentre la spunta e una scorciatoia.
   */
  private coerente<T extends { ruolo?: string | null; libero?: boolean }>(d: T) {
    if (d.ruolo === "libero") return { ...d, libero: true };
    if (d.libero === true && d.ruolo == null) return { ...d, ruolo: "libero" };
    if (d.libero === true && d.ruolo && d.ruolo !== "libero") return { ...d, libero: false };
    return d;
  }

  /**
   * Aggiunge un giocatore. Crea sempre la **persona** se manca: senza identita
   * stabile il giocatore non entra nelle statistiche di stagione, e scoprirlo
   * mesi dopo costa piu che crearla adesso.
   */
  async aggiungiGiocatore(userId: string, teamId: string, dtoGrezzo: any) {
    await this.access.team(userId, teamId, true);
    const dto = this.coerente(dtoGrezzo);

    const occupato = await this.prisma.teamPlayer.findFirst({
      where: { teamId, numeroMaglia: dto.numeroMaglia } });
    if (occupato) {
      throw new BadRequestException({ code: "CONFLITTO",
        message: `Il numero ${dto.numeroMaglia} e gia di ${occupato.cognome}`,
        details: { numeroMaglia: ["Numero gia assegnato"] } });
    }

    let personId: string | null = dto.personId ?? null;
    if (!personId) {
      const p = await this.prisma.person.create({
        data: { ownerId: userId, cognome: dto.cognome, nome: dto.nome } });
      personId = p.id;
    }

    return this.prisma.teamPlayer.create({
      data: { teamId, numeroMaglia: dto.numeroMaglia, cognome: dto.cognome, nome: dto.nome,
              ruolo: dto.ruolo ?? null, libero: dto.libero ?? false, personId },
    });
  }

  async modificaGiocatore(userId: string, teamId: string, playerId: string, dtoGrezzo: any) {
    await this.access.team(userId, teamId, true);
    const dto = this.coerente(dtoGrezzo);
    const g = await this.prisma.teamPlayer.findFirst({ where: { id: playerId, teamId } });
    if (!g) throw new NotFoundException({ code: "NON_TROVATO", message: "Giocatore non trovato" });

    if (dto.numeroMaglia != null && dto.numeroMaglia !== g.numeroMaglia) {
      const occupato = await this.prisma.teamPlayer.findFirst({
        where: { teamId, numeroMaglia: dto.numeroMaglia, id: { not: playerId } } });
      if (occupato) {
        throw new BadRequestException({ code: "CONFLITTO",
          message: `Il numero ${dto.numeroMaglia} e gia di ${occupato.cognome}`,
          details: { numeroMaglia: ["Numero gia assegnato"] } });
      }
    }

    return this.prisma.teamPlayer.update({
      where: { id: playerId },
      data: {
        numeroMaglia: dto.numeroMaglia ?? g.numeroMaglia,
        cognome: dto.cognome ?? g.cognome,
        nome: dto.nome ?? g.nome,
        ruolo: dto.ruolo === undefined ? g.ruolo : dto.ruolo,
        libero: dto.libero ?? g.libero,
        personId: dto.personId === undefined ? g.personId : dto.personId,
      },
    });
  }

  /**
   * Toglie un giocatore dal roster della squadra.
   *
   * **Le partite gia giocate non si toccano**: `MatchPlayer` e una copia, non
   * un riferimento (docs/04-dati.md). Chi ha giocato ha giocato, e togliere
   * qualcuno dalla rosa di oggi non riscrive il passato.
   */
  async rimuoviGiocatore(userId: string, teamId: string, playerId: string) {
    await this.access.team(userId, teamId, true);
    const g = await this.prisma.teamPlayer.findFirst({ where: { id: playerId, teamId } });
    if (!g) throw new NotFoundException({ code: "NON_TROVATO", message: "Giocatore non trovato" });
    await this.prisma.teamPlayer.delete({ where: { id: playerId } });
    return { ok: true };
  }

  async condivisioni(userId: string, id: string) {
    await this.access.team(userId, id);
    return this.prisma.teamShare.findMany({ where: { teamId: id } });
  }

  /**
   * La condivisione concede SOLA LETTURA ed e un trasferimento di dati
   * personali a terzi: viene registrata nell'audit.
   */
  async condividi(userId: string, id: string, email: string) {
    const { team } = await this.access.team(userId, id, true);
    const dest = await this.prisma.user.findUnique({ where: { email } });
    const share = await this.prisma.teamShare.upsert({
      where: { teamId_email: { teamId: id, email } },
      create: { teamId: id, email, userId: dest?.id ?? null,
                statoInvito: dest ? "attivo" : "pendente" },
      update: {},
    });
    await this.mail.invito(email, `la squadra ${team.nome}`, "Un utente");
    await this.audit.log(userId, "condivisione_concessa", "team", id, email);
    return share;
  }

  async revoca(userId: string, id: string, shareId: string) {
    await this.access.team(userId, id, true);
    await this.prisma.teamShare.delete({ where: { id: shareId } });
    await this.audit.log(userId, "condivisione_revocata", "team", id, shareId);
    return { ok: true };
  }
}
