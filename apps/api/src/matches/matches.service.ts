import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../common/prisma.service";
import { AccessService } from "../common/access.service";
import { AuditService } from "../common/audit.service";
import { LifecycleService } from "./lifecycle.service";
import { aggregateStatus, capacitaPartita, lineupCompleta, LIMITS, PAGINAZIONE } from "@vv/schema";
import type { MatchStatus } from "@vv/schema";
import type { AggiungiGiocatoreInput, LineupInput, MatchInput, MatchRosterInput,
                ModificaGiocatoreInput, SubstitutionInput } from "@vv/schema";

@Injectable()
export class MatchesService {
  constructor(private prisma: PrismaService, private access: AccessService,
              private audit: AuditService, private lifecycle: LifecycleService) {}

  /**
   * Elenco paginato. **Tutti i filtri stanno nella query**, compresi nome
   * squadra e tag: filtrarli dopo il taglio significherebbe non trovare mai
   * cio che sta oltre la prima pagina.
   *
   * Il tag e cercato dentro `tagJson` come stringa fra virgolette: i tag sono
   * elementi JSON e `"casa"` non corrisponde mai a `"casalinga"`. Su
   * PostgreSQL diventera un contenimento su JSONB con indice.
   */
  async elenco(userId: string, f: { competitionId?: string; teamId?: string; stato?: string;
                                    q?: string; tag?: string; pagina?: number; perPagina?: number }) {
    const ids = await this.access.competitionIdsVisibili(userId);
    const perPagina = Math.min(f.perPagina || PAGINAZIONE.perPaginaPredefinito,
                               PAGINAZIONE.perPaginaMassimo);
    const pagina = Math.max(1, f.pagina || 1);

    const where = {
      competitionId: f.competitionId ? f.competitionId : { in: ids },
      ...(f.stato ? { stato: f.stato } : {}),
      ...(f.teamId ? { OR: [{ homeTeamId: f.teamId }, { awayTeamId: f.teamId }] } : {}),
      ...(f.tag ? { tagJson: { contains: `"${f.tag}"`, mode: "insensitive" } } : {}),
      ...(f.q ? { OR: [{ homeTeam: { nome: { contains: f.q, mode: "insensitive" } } },
                       { awayTeam: { nome: { contains: f.q, mode: "insensitive" } } }] } : {}),
    } as any;

    const [totale, m] = await this.prisma.$transaction([
      this.prisma.match.count({ where }),
      this.prisma.match.findMany({
        where,
        include: { competition: true, homeTeam: true, awayTeam: true, video: true },
        orderBy: { data: "desc" },
        skip: (pagina - 1) * perPagina,
        take: perPagina,
      }),
    ]);

    return { elementi: m.map((x) => this.dto(x)), totale, pagina, perPagina,
             pagine: Math.max(1, Math.ceil(totale / perPagina)) };
  }

  private dto(x: any) {
    return {
      id: x.id, data: x.data.toISOString(), stato: x.stato,
      statoAggregato: aggregateStatus(x.stato),
      erroreMessaggio: x.erroreMessaggio,
      competition: { id: x.competition.id, nome: x.competition.nome, stagione: x.competition.stagione },
      home: { id: x.homeTeam.id, nome: x.homeTeam.nome },
      away: { id: x.awayTeam.id, nome: x.awayTeam.nome },
      citta: x.citta, campo: x.campo, arbitri: x.arbitri, numeroSet: x.numeroSet,
      tag: JSON.parse(x.tagJson ?? "[]"),
      revisioneAnalisi: x.revisioneAnalisi,
      video: [1, 2].map((lato) => {
        const v = x.video?.find((vv: any) => vv.lato === lato);
        return { lato, stato: v?.stato ?? "ASSENTE", nomeFile: v?.nomeFile ?? null,
                 dimensione: v?.dimensione != null ? Number(v.dimensione) : null,
                 caricatoIl: v?.caricatoIl?.toISOString() ?? null };
      }),
    };
  }

  async crea(userId: string, dto: MatchInput) {
    await this.access.competition(userId, dto.competitionId, true);
    await this.access.team(userId, dto.homeTeamId);
    await this.access.team(userId, dto.awayTeamId);
    const m = await this.prisma.match.create({
      data: {
        competitionId: dto.competitionId, homeTeamId: dto.homeTeamId, awayTeamId: dto.awayTeamId,
        createdById: userId, data: new Date(dto.data),
        citta: dto.citta ?? null, campo: dto.campo ?? null, arbitri: dto.arbitri ?? null,
        tagJson: JSON.stringify(dto.tag ?? []),
        video: { create: [{ lato: 1 }, { lato: 2 }] },
      },
      include: { competition: true, homeTeam: true, awayTeam: true, video: true },
    });
    return this.dto(m);
  }

  async dettaglio(userId: string, id: string) {
    await this.access.match(userId, id);
    const m = await this.prisma.match.findUniqueOrThrow({
      where: { id }, include: { competition: true, homeTeam: true, awayTeam: true, video: true } });
    const [giocatori, formazioni, sostituzioni, analisi] = await Promise.all([
      this.prisma.matchPlayer.findMany({ where: { matchId: id }, orderBy: [{ lato: "asc" }, { numeroMaglia: "asc" }] }),
      this.prisma.lineup.findMany({ where: { matchId: id }, orderBy: [{ set: "asc" }, { lato: "asc" }] }),
      this.prisma.substitution.findMany({ where: { matchId: id }, orderBy: [{ set: "asc" }, { frame: "asc" }] }),
      this.prisma.analysis.findUnique({ where: { matchId: id }, select: { pacchettoJson: true } }),
    ]);

    /*
     * Quanti set ha avuto la partita.
     *
     * Se l'analisi c'e, **lo sa lei**: continuare a chiederlo all'utente e
     * assurdo, ed e esattamente quello che l'applicazione faceva. Il valore
     * dichiarato a mano serve solo prima, quando i dati non ci sono ancora.
     */
    let numeroSet = m.numeroSet;
    let setDaAnalisi = false;
    if (analisi) {
      try {
        const pkg = JSON.parse(analisi.pacchettoJson);
        if (Array.isArray(pkg.sets) && pkg.sets.length) {
          numeroSet = pkg.sets.length;
          setDaAnalisi = true;
        }
      } catch { /* pacchetto illeggibile: resta il dichiarato */ }
    }

    return { ...this.dto(m), giocatori, formazioni, sostituzioni,
             numeroSet, setDaAnalisi,
             capacita: capacitaPartita(m.stato as MatchStatus),
             completezza: this.completezza(giocatori, formazioni, numeroSet) };
  }

  /** Indicatore di completezza usato dall'interfaccia per guidare l'utente. */
  private completezza(giocatori: any[], formazioni: any[], numeroSet: number | null) {
    const set1 = formazioni.filter((f) => f.set === 1);
    const completi = [...new Set(formazioni.filter(lineupCompleta).map((f) => f.set))];
    // Un set e completo se entrambe le squadre hanno la formazione.
    const perSet = new Map<number, number>();
    for (const f of formazioni.filter(lineupCompleta)) {
      perSet.set(f.set, (perSet.get(f.set) ?? 0) + 1);
    }
    const setCompletati = [...perSet.values()].filter((n) => n === 2).length;
    return {
      rosterCasa: giocatori.filter((g) => g.lato === "h").length,
      rosterOspite: giocatori.filter((g) => g.lato === "a").length,
      set1Completo: set1.length === 2 && set1.every(lineupCompleta),
      setCompletati,
      setDichiarati: numeroSet,
      tuttiISetCompletati: numeroSet !== null && setCompletati >= numeroSet,
    };
  }

  async aggiorna(userId: string, id: string, dto: MatchInput) {
    const { match } = await this.access.match(userId, id, true);
    this.esigi(match.stato, "modificaDatiPartita", "Modifica dei dati");
    await this.prisma.match.update({
      where: { id }, data: { data: new Date(dto.data), citta: dto.citta ?? null,
        campo: dto.campo ?? null, arbitri: dto.arbitri ?? null,
        tagJson: JSON.stringify(dto.tag ?? []) } });
    return this.dettaglio(userId, id);
  }

  async elimina(userId: string, id: string) {
    await this.access.match(userId, id, true);
    await this.prisma.match.delete({ where: { id } });
    await this.audit.log(userId, "eliminazione_partita", "match", id);
    return { ok: true };
  }

  /**
   * Rifiuta la modifica quando lo stato non la consente.
   *
   * Il controllo sta qui e non nelle schermate: un client vecchio, o una
   * chiamata diretta all'API, non devono poter cambiare i dati di ingresso di
   * un'analisi gia fatta.
   */
  private esigi(stato: string, cosa: keyof ReturnType<typeof capacitaPartita>, azione: string) {
    const c = capacitaPartita(stato as MatchStatus);
    if (c[cosa] !== true) {
      throw new BadRequestException({ code: "STATO_NON_CONSENTE",
        message: `${azione}: non e possibile con la partita in stato "${stato}". ${c.motivoBlocco ?? ""}`.trim() });
    }
  }

  /** Quanti set ha avuto la partita: guida le schede delle formazioni. */
  async impostaNumeroSet(userId: string, id: string, numeroSet: number) {
    const { match } = await this.access.match(userId, id, true);
    this.esigi(match.stato, "modificaNumeroSet", "Numero di set");
    // Le formazioni dei set eliminati non servono piu.
    await this.prisma.lineup.deleteMany({ where: { matchId: id, set: { gt: numeroSet } } });
    await this.prisma.substitution.deleteMany({ where: { matchId: id, set: { gt: numeroSet } } });
    await this.prisma.match.update({ where: { id }, data: { numeroSet } });
    return this.dettaglio(userId, id);
  }

  /**
   * Aggiunge un giocatore al roster della partita dal selettore delle
   * formazioni, quando non e fra quelli gia salvati.
   */
  async aggiungiGiocatore(userId: string, id: string, dto: AggiungiGiocatoreInput) {
    const { match } = await this.access.match(userId, id, true);
    this.esigi(match.stato, "modificaRoster", "Aggiunta di un giocatore");

    const esistente = await this.prisma.matchPlayer.findFirst({
      where: { matchId: id, lato: dto.lato, numeroMaglia: dto.numeroMaglia } });
    if (esistente) {
      throw new BadRequestException({ code: "CONFLITTO",
        message: `Il numero ${dto.numeroMaglia} e gia assegnato in questa squadra` });
    }

    const teamId = dto.lato === "h" ? match.homeTeamId : match.awayTeamId;

    // Persona: si riusa quella indicata, altrimenti se ne crea una nuova.
    // Senza persona il giocatore non entra nelle statistiche di stagione.
    let personId = dto.personId ?? null;
    if (!personId) {
      const p = await this.prisma.person.create({
        data: { ownerId: userId, cognome: dto.cognome, nome: dto.nome } });
      personId = p.id;
    }

    const creato = await this.prisma.matchPlayer.create({
      data: { matchId: id, lato: dto.lato, numeroMaglia: dto.numeroMaglia,
              cognome: dto.cognome, nome: dto.nome, ruolo: dto.ruolo ?? null,
              libero: dto.libero ?? false, capitano: dto.capitano ?? false, personId },
    });

    if (dto.salvaInSquadra) {
      const gia = await this.prisma.teamPlayer.findFirst({
        where: { teamId, numeroMaglia: dto.numeroMaglia } });
      if (!gia) {
        await this.prisma.teamPlayer.create({
          data: { teamId, numeroMaglia: dto.numeroMaglia, cognome: dto.cognome,
                  nome: dto.nome, ruolo: dto.ruolo ?? null, libero: dto.libero ?? false, personId },
        });
      }
    }
    return creato;
  }

  /**
   * Corregge un giocatore gia inserito: un numero sbagliato, un cognome
   * storpiato. Senza questo l'unica strada era riscrivere l'intero roster.
   */
  async modificaGiocatore(userId: string, id: string, playerId: string,
                          dto: ModificaGiocatoreInput) {
    const { match } = await this.access.match(userId, id, true);
    this.esigi(match.stato, "modificaRoster", "Correzione di un giocatore");
    const g = await this.prisma.matchPlayer.findFirst({ where: { id: playerId, matchId: id } });
    if (!g) throw new NotFoundException({ code: "NON_TROVATO", message: "Giocatore non trovato" });

    const nuovoNumero = dto.numeroMaglia ?? g.numeroMaglia;
    if (nuovoNumero !== g.numeroMaglia) {
      const occupato = await this.prisma.matchPlayer.findFirst({
        where: { matchId: id, lato: g.lato, numeroMaglia: nuovoNumero, id: { not: playerId } } });
      if (occupato) {
        throw new BadRequestException({ code: "CONFLITTO",
          message: `Il numero ${nuovoNumero} e gia assegnato a ${occupato.cognome} in questa squadra` });
      }
    }

    // Un solo capitano per squadra: nominandone uno, l'altro decade.
    if (dto.capitano === true) {
      await this.prisma.matchPlayer.updateMany({
        where: { matchId: id, lato: g.lato, id: { not: playerId } }, data: { capitano: false } });
    }

    const aggiornato = await this.prisma.matchPlayer.update({
      where: { id: playerId },
      data: {
        numeroMaglia: nuovoNumero,
        cognome: dto.cognome ?? g.cognome,
        nome: dto.nome ?? g.nome,
        ruolo: dto.ruolo === undefined ? g.ruolo : dto.ruolo,
        libero: dto.libero ?? g.libero,
        capitano: dto.capitano ?? g.capitano,
        personId: dto.personId === undefined ? g.personId : dto.personId,
      },
    });

    // Formazioni e cambi puntano al numero di maglia, non all'identificativo.
    // Correggendo il numero senza portarli dietro resterebbero a indicare un
    // giocatore che non esiste piu: la correzione va propagata.
    if (nuovoNumero !== g.numeroMaglia) {
      await this.rinumeraRiferimenti(id, g.lato, g.numeroMaglia, nuovoNumero);
    }
    return aggiornato;
  }

  /**
   * Rimuove un giocatore dal roster della partita. **Rifiuta se e ancora in
   * campo**: lasciar cadere il riferimento produrrebbe formazioni che indicano
   * un numero inesistente, e nessuna schermata saprebbe piu che cosa mostrare.
   */
  async rimuoviGiocatore(userId: string, id: string, playerId: string) {
    const { match } = await this.access.match(userId, id, true);
    this.esigi(match.stato, "modificaRoster", "Rimozione di un giocatore");
    const g = await this.prisma.matchPlayer.findFirst({ where: { id: playerId, matchId: id } });
    if (!g) throw new NotFoundException({ code: "NON_TROVATO", message: "Giocatore non trovato" });

    const usi = await this.doveCompare(id, g.lato, g.numeroMaglia);
    if (usi.length) {
      throw new BadRequestException({ code: "IN_USO",
        message: `Il numero ${g.numeroMaglia} e ancora in ${usi.join(", ")}. `
               + "Toglilo prima da li, poi rimuovilo dal roster." });
    }

    await this.prisma.matchPlayer.delete({ where: { id: playerId } });
    return { ok: true };
  }

  /** Dove un numero di maglia e ancora citato, in italiano leggibile. */
  private async doveCompare(matchId: string, lato: string, numero: number) {
    const formazioni = await this.prisma.lineup.findMany({ where: { matchId, lato } });
    const set = formazioni
      .filter((f) => [f.pos1, f.pos2, f.pos3, f.pos4, f.pos5, f.pos6, f.libero1, f.libero2]
                       .some((p) => p === numero))
      .map((f) => f.set);

    const cambi = await this.prisma.substitution.findMany({
      where: { matchId, lato, OR: [{ esce: numero }, { entra: numero }] } });

    const dove: string[] = [];
    if (set.length) {
      dove.push(set.length === 1 ? `formazione del set ${set[0]}`
                                 : `formazioni dei set ${set.sort((a, b) => a - b).join(", ")}`);
    }
    if (cambi.length) {
      dove.push(cambi.length === 1 ? "un cambio" : `${cambi.length} cambi`);
    }
    return dove;
  }

  /** Porta dietro il cambio di numero su formazioni e cambi. */
  private async rinumeraRiferimenti(matchId: string, lato: string, da: number, a: number) {
    const formazioni = await this.prisma.lineup.findMany({ where: { matchId, lato } });
    for (const f of formazioni) {
      const patch: Record<string, number> = {};
      for (const c of ["pos1", "pos2", "pos3", "pos4", "pos5", "pos6", "libero1", "libero2"]) {
        if ((f as any)[c] === da) patch[c] = a;
      }
      if (Object.keys(patch).length) {
        await this.prisma.lineup.update({ where: { id: f.id }, data: patch });
      }
    }
    await this.prisma.substitution.updateMany({
      where: { matchId, lato, esce: da }, data: { esce: a } });
    await this.prisma.substitution.updateMany({
      where: { matchId, lato, entra: da }, data: { entra: a } });
  }

  // ------------------------------------------------------------- roster
  async salvaRoster(userId: string, id: string, dto: MatchRosterInput) {
    const { match } = await this.access.match(userId, id, true);
    this.esigi(match.stato, "modificaRoster", "Riscrittura del roster");
    await this.prisma.$transaction([
      this.prisma.matchPlayer.deleteMany({ where: { matchId: id } }),
      this.prisma.matchPlayer.createMany({
        data: dto.giocatori.map((g) => ({
          matchId: id, lato: g.lato, numeroMaglia: g.numeroMaglia, cognome: g.cognome,
          nome: g.nome, ruolo: g.ruolo ?? null, libero: g.libero ?? false,
          capitano: g.capitano ?? false, personId: g.personId ?? null,
        })),
      }),
    ]);
    return this.dettaglio(userId, id);
  }

  /** Copia il roster della squadra nella partita: copia, non riferimento. */
  async importaRoster(userId: string, id: string, lato: "h" | "a") {
    const { match } = await this.access.match(userId, id, true);
    this.esigi(match.stato, "modificaRoster", "Importazione del roster");
    const teamId = lato === "h" ? match.homeTeamId : match.awayTeamId;
    const src = await this.prisma.teamPlayer.findMany({ where: { teamId } });
    await this.prisma.$transaction([
      this.prisma.matchPlayer.deleteMany({ where: { matchId: id, lato } }),
      this.prisma.matchPlayer.createMany({
        data: src.slice(0, LIMITS.maxMatchPlayers).map((g) => ({
          matchId: id, lato, numeroMaglia: g.numeroMaglia, cognome: g.cognome, nome: g.nome,
          ruolo: g.ruolo, libero: g.libero, personId: g.personId,
        })),
      }),
    ]);
    return this.dettaglio(userId, id);
  }

  // --------------------------------------------------------- formazioni
  async salvaFormazione(userId: string, id: string, set: number, dto: LineupInput) {
    const { match } = await this.access.match(userId, id, true);
    this.esigi(match.stato, "modificaFormazioni", "Modifica della formazione");
    const roster = await this.prisma.matchPlayer.findMany({ where: { matchId: id, lato: dto.lato } });
    const numeri = new Set(roster.map((r) => r.numeroMaglia));
    const usati = [dto.pos1, dto.pos2, dto.pos3, dto.pos4, dto.pos5, dto.pos6, dto.libero1, dto.libero2]
      .filter((n): n is number => n != null);
    const fuori = usati.filter((n) => !numeri.has(n));
    if (fuori.length) {
      throw new BadRequestException({ code: "VALIDAZIONE",
        message: `Giocatori non presenti nel roster della partita: ${fuori.join(", ")}` });
    }
    await this.prisma.lineup.upsert({
      where: { matchId_set_lato: { matchId: id, set, lato: dto.lato } },
      create: { matchId: id, set, lato: dto.lato, pos1: dto.pos1, pos2: dto.pos2, pos3: dto.pos3,
                pos4: dto.pos4, pos5: dto.pos5, pos6: dto.pos6,
                libero1: dto.libero1 ?? null, libero2: dto.libero2 ?? null,
                primoServizio: dto.primoServizio ?? false },
      update: { pos1: dto.pos1, pos2: dto.pos2, pos3: dto.pos3, pos4: dto.pos4,
                pos5: dto.pos5, pos6: dto.pos6, libero1: dto.libero1 ?? null,
                libero2: dto.libero2 ?? null, primoServizio: dto.primoServizio ?? false },
    });
    await this.lifecycle.valutaAvvio(id);
    return this.dettaglio(userId, id);
  }

  // ------------------------------------------------------------- cambi
  async aggiungiCambio(userId: string, id: string, dto: SubstitutionInput) {
    const { match } = await this.access.match(userId, id, true);
    const roster = await this.prisma.matchPlayer.findMany({ where: { matchId: id, lato: dto.lato } });
    const numeri = new Set(roster.map((r) => r.numeroMaglia));
    for (const n of [dto.esce, dto.entra]) {
      if (!numeri.has(n)) {
        throw new BadRequestException({ code: "VALIDAZIONE",
          message: `Il giocatore ${n} non e nel roster della partita` });
      }
    }
    // Conversione minuto -> fotogramma: possibile solo con fps noti, che
    // arrivano col pacchetto di analisi. Finche non c'e, si conserva il minuto.
    const fps = (match.video ?? []).find((v: any) => v.lato === 1)?.fps ?? null;
    const frame = dto.frame ?? (dto.minuto != null && fps ? Math.round(dto.minuto * 60 * fps) : null);
    return this.prisma.substitution.create({
      data: { matchId: id, set: dto.set, lato: dto.lato, esce: dto.esce, entra: dto.entra,
              frame, minuto: dto.minuto ?? null },
    });
  }

  async eliminaCambio(userId: string, id: string, subId: string) {
    await this.access.match(userId, id, true);
    await this.prisma.substitution.delete({ where: { id: subId } });
    return { ok: true };
  }

  /** Rielaborazione: riservata agli amministratori. */
  async rielabora(userId: string, ruolo: string, id: string) {
    if (ruolo !== "admin") {
      throw new BadRequestException({ code: "NON_AUTORIZZATO", message: "Riservato agli amministratori" });
    }
    await this.lifecycle.transizione(id, "PENDING");
    await this.audit.log(userId, "rielaborazione", "match", id);
    return this.dettaglio(userId, id);
  }
}
