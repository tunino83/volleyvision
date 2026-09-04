import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "fs";
import { dirname, join } from "path";
import { PrismaService } from "../common/prisma.service";
import { AccessService } from "../common/access.service";
import { AuditService } from "../common/audit.service";
import { LifecycleService } from "../matches/lifecycle.service";
import { CONFIG } from "../common/config";
import { adatta, allineaEventiAiSet, type IngressoFornitore } from "./adapter";
import { riepilogo, riepilogoPerGruppi, miglioriRealizzatori, select,
         statisticheGiocatori, indiciGiocatore } from "@vv/core";
import type { AnalysisPackage } from "@vv/schema";

/**
 * Acquisizione e lettura dell'analisi.
 *
 * Il pacchetto canonico (eventi, azioni, set, qualita) e piccolo — circa
 * 1 MB — e sta nel database: e cio che serve a tutte le statistiche.
 * Le posizioni sono un ordine di grandezza piu grandi e servono solo al campo
 * bidimensionale della partita aperta: stanno in `PosizioneFrame`, una riga
 * per fotogramma, interrogate per intervallo invece che lette per intero.
 * Vedi la divisione eventi/posizioni in ../../docs/01-architettura.md.
 */
@Injectable()
export class AnalysisService {
  constructor(private prisma: PrismaService, private access: AccessService,
              private audit: AuditService, private lifecycle: LifecycleService) {}

  private percorsoFrames(matchId: string, revision: number) {
    return join(CONFIG.storageLocalDir, "analisi", matchId, `frames-r${revision}.json`);
  }

  /**
   * Acquisisce i file del fornitore. Idempotente per revisione: reimportare
   * la stessa revisione la sostituisce.
   */
  async importa(userId: string, matchId: string, ing: IngressoFornitore) {
    await this.access.match(userId, matchId, true);

    const precedente = await this.prisma.analysis.findUnique({ where: { matchId } });
    const revision = (precedente?.revision ?? 0) + 1;

    let pacchetto: AnalysisPackage;
    let frames: unknown[];
    try {
      const r = adatta(matchId, revision, ing);
      pacchetto = allineaEventiAiSet(r.pacchetto);
      frames = r.frames;
    } catch (e: any) {
      throw new BadRequestException({ code: "FORMATO_NON_RICONOSCIUTO",
        message: "I file non corrispondono al formato atteso dal fornitore",
        details: { formato: [String(e?.message ?? e).slice(0, 400)] } });
    }

    const analisi = await this.prisma.analysis.upsert({
      where: { matchId },
      create: { matchId, revision, pacchettoJson: JSON.stringify(pacchetto),
                qualitaJson: JSON.stringify(pacchetto.qualita), framesKey: null },
      update: { revision, pacchettoJson: JSON.stringify(pacchetto),
                qualitaJson: JSON.stringify(pacchetto.qualita), framesKey: null },
    });

    /*
     * Le posizioni vanno nel database, una riga per fotogramma.
     *
     * Prima finivano in un file su disco: funziona su una macchina propria,
     * non dove il filesystem e effimero — su un servizio che si riavvia, il
     * campo bidimensionale smetteva di avere dati senza che nulla lo dicesse.
     *
     * Si cancella e si riscrive: reimportare una revisione deve sostituire le
     * posizioni, non affiancarle a quelle vecchie.
     */
    if (frames.length) {
      const dati = JSON.stringify(frames);
      await this.prisma.analysisPosizioni.upsert({
        where: { analysisId: analisi.id },
        create: { analysisId: analisi.id, datiJson: dati,
                  fotogrammi: frames.length, byte: dati.length },
        update: { datiJson: dati, fotogrammi: frames.length, byte: dati.length },
      });
    } else {
      // Reimportare senza posizioni deve toglierle, non lasciare le vecchie.
      await this.prisma.analysisPosizioni.deleteMany({ where: { analysisId: analisi.id } });
    }

    await this.prisma.match.update({
      where: { id: matchId }, data: { revisioneAnalisi: revision } });

    // Il fornitore ha consegnato: la partita e pronta.
    const m = await this.prisma.match.findUniqueOrThrow({ where: { id: matchId } });
    if (m.stato !== "READY") {
      for (const passo of ["PENDING", "RUNNING", "READY_FOR_PP", "READY"] as const) {
        const cur = await this.prisma.match.findUniqueOrThrow({ where: { id: matchId } });
        if (cur.stato === passo) continue;
        try { await this.lifecycle.transizione(matchId, passo); } catch { /* gia oltre */ }
      }
      await this.prisma.notification.create({
        data: { userId, matchId, tipo: "partita_pronta" } });
    }

    await this.audit.log(userId, "importazione_analisi", "match", matchId,
      `revisione ${revision}, ${pacchetto.qualita.eventiTotali} eventi`);

    return { revisione: revision, qualita: pacchetto.qualita };
  }

  private async carica(userId: string, matchId: string): Promise<AnalysisPackage> {
    await this.access.match(userId, matchId);
    const a = await this.prisma.analysis.findUnique({ where: { matchId } });
    if (!a) {
      throw new NotFoundException({ code: "ANALISI_ASSENTE",
        message: "Per questa partita non e ancora disponibile un'analisi" });
    }
    return JSON.parse(a.pacchettoJson) as AnalysisPackage;
  }

  /**
   * Statistiche per giocatore.
   *
   * La somma delle righe **non fa** il totale di squadra, e non e un errore:
   * il fornitore non riconosce tutti i giocatori, e i tocchi senza maglia
   * finiscono nel totale ma in nessuna riga. Il numero viene restituito
   * perche la schermata lo dichiari invece di lasciarlo scoprire.
   */
  async statisticheGiocatori(userId: string, matchId: string, opts: { set?: number }) {
    const pkg = await this.carica(userId, matchId);
    const r = statisticheGiocatori(pkg.events, { set: opts.set });
    return {
      squadre: await this.nomiSquadre(matchId, pkg.squadre),
      ...r,
      /** Percentuale di tocchi non attribuibili: e il limite del dato. */
      quotaSenzaGiocatore: r.tocchiTotali
        ? Math.round((r.tocchiSenzaGiocatore / r.tocchiTotali) * 1000) / 10 : 0,
    };
  }

  /** Gli eventi dietro una cella della tabella giocatori. */
  async eventiGiocatore(userId: string, matchId: string,
                        team: "h" | "a", jersey: number, chiave: string, set?: number) {
    const pkg = await this.carica(userId, matchId);
    const indici = indiciGiocatore(pkg.events, team, jersey, chiave, { set });
    return this.eventi(userId, matchId, indici);
  }

  /**
   * I nomi delle squadre da mostrare: quelli della partita, con quelli del
   * pacchetto come ripiego. Il fornitore manda sigle; l'utente ha scritto i
   * nomi per esteso, e sono i suoi che deve rivedere.
   */
  private async nomiSquadre(matchId: string, dalPacchetto: { h: string; a: string }) {
    const m = await this.prisma.match.findUnique({
      where: { id: matchId },
      select: { homeTeam: { select: { nome: true } }, awayTeam: { select: { nome: true } } },
    });
    return {
      h: m?.homeTeam?.nome || dalPacchetto.h,
      a: m?.awayTeam?.nome || dalPacchetto.a,
    };
  }

  /** Il pacchetto completo: e cio che il client scarica per lavorare in locale. */
  async pacchetto(userId: string, matchId: string) {
    return this.carica(userId, matchId);
  }

  /**
   * Riepilogo statistico. Il calcolo passa da `packages/core`, lo stesso
   * motore che useranno i client: una definizione sola delle metriche.
   */
  async statistiche(userId: string, matchId: string, opts: { set?: number; untilFrame?: number }) {
    const pkg = await this.carica(userId, matchId);
    const f = { set: opts.set, untilFrame: opts.untilFrame };

    return {
      // I nomi che l'utente ha scelto vincono su quelli del fornitore: nel
      // pacchetto ci sono sigle ("BUL", "CHN"), nell'elenco partite i nomi per
      // esteso, e vedere due cose diverse per la stessa squadra confonde.
      squadre: await this.nomiSquadre(matchId, pkg.squadre),
      sets: pkg.sets.map((s) => ({ n: s.n, hPt: s.hPt, aPt: s.aPt })),
      qualita: pkg.qualita,
      indicatori: riepilogo(pkg.events, f).map((m) => ({
        chiave: m.chiave, etichetta: m.etichetta, formato: m.formato,
        casa: m.casa, ospite: m.ospite,
        // Gli indici degli eventi: e cio che rende gratuita l'explainability.
        eventiCasa: m.eventiCasa.map((e) => e.idx),
        eventiOspite: m.eventiOspite.map((e) => e.idx),
      })),
      /*
       * Gli stessi numeri raggruppati per fondamentale, piu quelli che prima
       * non calcolavamo pur avendone i dati: attacchi murati (che NON sono
       * errori), efficienza vera, ricezione e difesa.
       */
      gruppi: riepilogoPerGruppi(pkg.events, f).map((g) => ({
        chiave: g.chiave, titolo: g.titolo,
        metriche: g.metriche.map((m) => ({
          chiave: m.chiave, etichetta: m.etichetta, formato: m.formato,
          casa: m.casa, ospite: m.ospite,
          eventiCasa: m.eventiCasa.map((e) => e.idx),
          eventiOspite: m.eventiOspite.map((e) => e.idx),
        })),
      })),
      realizzatori: miglioriRealizzatori(pkg.events, f, 5).map((r) => ({
        team: r.team, jersey: r.jersey, punti: r.punti,
        eventi: r.eventi.map((e) => e.idx),
      })),
    };
  }

  /** Gli eventi che compongono un numero: il clic sulla statistica arriva qui. */
  async eventi(userId: string, matchId: string, indici: number[]) {
    const pkg = await this.carica(userId, matchId);
    return indici
      .map((i) => pkg.events[i])
      .filter(Boolean)
      .map((e) => {
        const a = pkg.actions[e.actionIdx];
        return { ...e, azione: a ? { hPt: a.hPt, aPt: a.aPt,
                                     frameStart: a.frameStart, frameEnd: a.frameEnd } : null };
      });
  }

  /** Elenco degli scambi con i loro eventi: la colonna destra del banco di lavoro. */
  async scambi(userId: string, matchId: string, set?: number) {
    const pkg = await this.carica(userId, matchId);
    return pkg.actions
      .filter((a) => set === undefined || a.set === set)
      .map((a) => ({
        idx: a.idx, set: a.set, hPt: a.hPt, aPt: a.aPt,
        frameStart: a.frameStart, frameEnd: a.frameEnd, winner: a.winner,
        eventi: a.eventi.map((i) => pkg.events[i]),
      }));
  }

  /**
   * Le posizioni di un intervallo di fotogrammi.
   *
   * Senza intervallo (`da` e `a` a zero) le restituisce **tutte**: e cosi che
   * le chiede il client, che se le porta in locale una volta sola. Compresse
   * dalla trasmissione HTTP sono ~1,3 MB per partita, e da quel momento il
   * campo bidimensionale funziona anche senza rete, con lo stesso codice.
   *
   * Il filtro per intervallo resta per compatibilita con chi lo usa ancora.
   */
  async posizioni(userId: string, matchId: string, daFrame: number, aFrame: number) {
    await this.access.match(userId, matchId);
    const a = await this.prisma.analysis.findUnique({ where: { matchId } });
    if (!a) return [];

    const p = await this.prisma.analysisPosizioni.findUnique({
      where: { analysisId: a.id }, select: { datiJson: true } });

    if (p) {
      const tutte = JSON.parse(p.datiJson) as Array<{ f: number }>;
      // L'intervallo si applica qui e non nel database: le posizioni stanno
      // in un blocco unico, e il client normalmente le chiede tutte. Il
      // filtro resta perche la rotta lo accetta ancora.
      return daFrame === 0 && aFrame === 0
        ? tutte
        : tutte.filter((x) => x.f >= daFrame && x.f <= aFrame);
    }

    return this.posizioniDaFile(a.framesKey, daFrame, aFrame);
  }

  /**
   * Ripiego per le analisi importate quando le posizioni stavano su disco.
   *
   * Non si cancella insieme al resto: chi ha gia importato una partita non
   * deve rifarlo per continuare a vedere il campo. Le nuove importazioni non
   * passano piu di qui.
   */
  private posizioniDaFile(chiave: string | null, daFrame: number, aFrame: number) {
    if (!chiave || !existsSync(chiave)) return [];
    const tutti = JSON.parse(readFileSync(chiave, "utf-8")) as Array<{ f: number }>;
    return tutti.filter((x) => x.f >= daFrame && x.f <= aFrame);
  }
}
