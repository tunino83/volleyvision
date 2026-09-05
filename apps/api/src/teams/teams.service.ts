import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { CONFIG } from "../common/config";
import { PrismaService } from "../common/prisma.service";
import { AccessService } from "../common/access.service";
import { AuditService } from "../common/audit.service";
import { MailService } from "../common/mail.service";
import type { TeamInput, TeamRosterInput } from "@vv/schema";

/** Massimo per uno stemma caricato. Vedi `impostaLogo`. */
const LOGO_MAX_BYTE = 512 * 1024;
const LOGO_TIPI = ["image/png", "image/jpeg", "image/webp"];

/**
 * Le tre cose che il client deve sapere sullo stemma, e nessun byte.
 *
 * Lo stemma disegnato e due stringhe; quello caricato e **un numero**, la sua
 * versione. Lasciarlo uscire come oggetto (`{ aggiornatoIl }`) lo renderebbe
 * comunque "vero" per il client, che lo userebbe come versione
 * nell'indirizzo: funzionerebbe per caso, e lo stemma aggiornato non
 * comparirebbe mai perche la chiave della copia locale non cambierebbe. E lo
 * stesso inciampo gia visto con le fotografie.
 */
function stemma(t: { logoStile?: string | null; logoSeme?: string | null;
                     logoOpzioniJson?: string | null;
                     logo?: { aggiornatoIl: Date } | null } | null) {
  if (!t) return { logoStile: null, logoSeme: null, logoOpzioni: null, logo: null };
  return {
    logoStile: t.logoStile ?? null,
    logoSeme: t.logoSeme ?? null,
    logoOpzioni: (() => {
      if (!t.logoOpzioniJson) return null;
      try { return JSON.parse(t.logoOpzioniJson); } catch { return null; }
    })(),
    logo: t.logo ? t.logo.aggiornatoIl.getTime() : null,
  };
}

@Injectable()
export class TeamsService {
  constructor(private prisma: PrismaService, private access: AccessService,
              private audit: AuditService, private mail: MailService) {}

  async elenco(userId: string) {
    const ids = await this.access.teamIdsVisibili(userId);
    const teams = await this.prisma.team.findMany({
      where: { id: { in: ids } },
      include: { owner: { select: { id: true, nome: true, cognome: true } },
                 // Solo la data dello stemma, mai i byte: l'elenco delle
                 // squadre finisce in locale su ogni dispositivo.
                 logo: { select: { aggiornatoIl: true } },
                 _count: { select: { giocatori: true, matchesHome: true, matchesAway: true } } },
      orderBy: [{ stagione: "desc" }, { nome: "asc" }],
    });
    return teams.map((t) => ({
      id: t.id, nome: t.nome, stagione: t.stagione,
      giocatori: t._count.giocatori,
      partite: t._count.matchesHome + t._count.matchesAway,
      proprietario: t.ownerId === userId,
      proprietarioNome: `${t.owner.nome} ${t.owner.cognome}`,
      ...stemma(t),
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
                                     avatarStile: true, avatarSeme: true, avatarOpzioniJson: true,
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
        // Dal testo all'oggetto: il client si aspetta le scelte gia
        // interpretate, non una stringa da aprire lui.
        avatarOpzioni: (() => {
          if (!r.person.avatarOpzioniJson) return null;
          try { return JSON.parse(r.person.avatarOpzioniJson); } catch { return null; }
        })(),
      },
    }));

    const conLogo = await this.prisma.team.findUnique({
      where: { id }, select: { logoStile: true, logoSeme: true, logoOpzioniJson: true,
                               logo: { select: { aggiornatoIl: true } } } });

    return { id: team.id, nome: team.nome, stagione: team.stagione, proprietario, giocatori,
             ...stemma(conLogo) };
  }

  async aggiorna(userId: string, id: string, dto: TeamInput) {
    await this.access.team(userId, id, true);
    return this.prisma.team.update({ where: { id }, data: dto });
  }

  /**
   * Lo stemma disegnato: stile, seme, scelte a mano. Nessun file.
   *
   * Il seme predefinito e il nome della squadra, quindi lo stemma **c'e
   * comunque** e non cambia da solo: prima ancora che qualcuno lo scelga,
   * ogni squadra ha gia il suo, sempre lo stesso.
   */
  async impostaLogoDisegnato(userId: string, id: string,
                             d: { logoStile: string | null; logoSeme: string | null;
                                  logoOpzioni?: Record<string, string[]> | null }) {
    await this.access.team(userId, id, true);
    const t = await this.prisma.team.update({
      where: { id },
      data: {
        logoStile: d.logoStile, logoSeme: d.logoSeme,
        // `undefined` lascia com'e, `null` cancella: chi manda solo stile e
        // seme non perde le scelte fatte a mano.
        ...(d.logoOpzioni === undefined ? {} : {
          logoOpzioniJson: d.logoOpzioni ? JSON.stringify(d.logoOpzioni) : null,
        }),
      },
      include: { logo: { select: { aggiornatoIl: true } } },
    });
    return { id: t.id, ...stemma(t) };
  }

  /**
   * Lo stemma caricato. Arriva gia ridotto dal client.
   *
   * **Convalidato comunque.** Il client ridimensiona, ma il client e solo il
   * chiamante piu probabile, non l'unico: mezzo megabyte e un elenco chiuso
   * di formati sono il confine oltre il quale questa rotta non e piu un
   * caricatore di stemmi ma un deposito di file. Niente SVG: e un documento
   * eseguibile, e servirlo dallo stesso dominio dell'applicazione
   * significherebbe eseguirlo li dentro.
   *
   * Ha la precedenza sullo stemma disegnato ma non lo cancella: chi la toglie
   * ritrova quello di prima invece di un riquadro vuoto.
   */
  async impostaLogo(userId: string, id: string, dataUri: string) {
    await this.access.team(userId, id, true);

    const virgola = dataUri.indexOf(",");
    const puntoevirgola = dataUri.indexOf(";");
    if (!dataUri.startsWith("data:") || virgola < 0 || puntoevirgola < 0) {
      throw new BadRequestException({ code: "VALIDAZIONE",
        message: "Immagine non riconosciuta" });
    }
    const tipo = dataUri.slice(5, puntoevirgola);
    if (!LOGO_TIPI.includes(tipo)) {
      throw new BadRequestException({ code: "FORMATO_NON_AMMESSO",
        message: `Formati ammessi: ${LOGO_TIPI.join(", ")}` });
    }
    const dati = Buffer.from(dataUri.slice(virgola + 1), "base64");
    if (dati.length === 0 || dati.length > LOGO_MAX_BYTE) {
      throw new BadRequestException({ code: "TROPPO_GRANDE",
        message: `Lo stemma non puo superare ${Math.round(LOGO_MAX_BYTE / 1024)} KB` });
    }

    const l = await this.prisma.teamLogo.upsert({
      where: { teamId: id },
      create: { teamId: id, dati, tipo, byte: dati.length },
      update: { dati, tipo, byte: dati.length, aggiornatoIl: new Date() },
    });
    await this.audit.log(userId, "stemma_squadra", "team", id, `${l.byte} byte, ${tipo}`);
    return { id, logo: l.aggiornatoIl.getTime(), byte: l.byte };
  }

  /** I byte, per la rotta che li serve. Nullo se non c'e. */
  async logo(userId: string, id: string) {
    await this.access.team(userId, id);
    return this.prisma.teamLogo.findUnique({ where: { teamId: id } });
  }

  async rimuoviLogo(userId: string, id: string) {
    await this.access.team(userId, id, true);
    // `deleteMany` e non `delete`: togliere uno stemma che non c'e non e un
    // errore, e chiedere di non premere due volte sarebbe assurdo.
    await this.prisma.teamLogo.deleteMany({ where: { teamId: id } });
    return { id, logo: null };
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
