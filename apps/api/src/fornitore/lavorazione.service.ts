import { Inject, Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { PrismaService } from "../common/prisma.service";
import { AuditService } from "../common/audit.service";
import { LifecycleService } from "../matches/lifecycle.service";
import { AnalysisService } from "../analysis/analysis.service";
import { CONFIG } from "../common/config";
import { FORNITORE, type FornitoreAnalisi } from "./fornitore";

/**
 * LAVORAZIONE — il ponte fra la partita e il fornitore.
 *
 * Quando una partita ha almeno un video e le formazioni, la mette in
 * lavorazione presso il fornitore; poi controlla a intervalli se il risultato
 * e pronto e lo acquisisce.
 *
 * Lo stato sta nel DATABASE, non in memoria: un riavvio del server non perde
 * le elaborazioni in corso. E la differenza fra un simulatore giocattolo e uno
 * su cui si puo lavorare davvero.
 */
@Injectable()
export class LavorazioneService implements OnModuleInit {
  private readonly log = new Logger("Lavorazione");
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private prisma: PrismaService,
    private lifecycle: LifecycleService,
    private analisi: AnalysisService,
    private audit: AuditService,
    @Inject(FORNITORE) private fornitore: FornitoreAnalisi,
  ) {}

  onModuleInit() {
    this.log.log(`Fornitore dell'analisi: ${this.fornitore.nome}` +
      (this.fornitore.nome === "simulato"
        ? ` (ritardo ${Math.round(CONFIG.simulaRitardoMs / 1000)}s)` : ""));

    if (this.fornitore.notificaSpontanea) {
      this.log.log("Il fornitore notifica da se: nessuna interrogazione periodica.");
      return;
    }
    // Riprende anche le elaborazioni rimaste in sospeso da prima del riavvio.
    this.timer = setInterval(() => this.giro().catch((e) => this.log.error(e)),
                             CONFIG.lavorazioneIntervalloMs);
    if (typeof this.timer.unref === "function") this.timer.unref();
    setTimeout(() => this.giro().catch(() => {}), 2000);
  }

  onModuleDestroy() { if (this.timer) clearInterval(this.timer); }

  /**
   * Mette una partita in lavorazione. Richiamata quando la partita entra in
   * coda, cioe quando ha almeno un video e la formazione del set 1.
   */
  async accoda(matchId: string, richiedenteId: string) {
    const gia = await this.prisma.lavorazione.findFirst({
      where: { matchId, stato: { in: ["in_attesa", "in_corso"] } } });
    if (gia) return gia;

    const m = await this.prisma.match.findUniqueOrThrow({
      where: { id: matchId }, include: { video: true } });

    const esito = await this.fornitore.avvia({
      matchId, richiedenteId,
      video: m.video.map((v) => ({ lato: v.lato, storageKey: v.storageKey, nomeFile: v.nomeFile })),
    });

    const l = await this.prisma.lavorazione.create({
      data: { matchId, richiedenteId, fornitore: this.fornitore.nome,
              riferimento: esito.riferimento, stato: "in_corso",
              attesoPer: esito.attesoPer },
    });

    await this.lifecycle.transizione(matchId, "RUNNING");
    await this.audit.log(richiedenteId, "analisi_avviata", "match", matchId,
      `${this.fornitore.nome}, riferimento ${esito.riferimento}`);

    this.log.log(`Partita ${matchId} in lavorazione` +
      (esito.attesoPer ? `, attesa fino alle ${esito.attesoPer.toLocaleTimeString("it-IT")}` : ""));
    return l;
  }

  /** Un giro di interrogazione su tutte le elaborazioni in corso. */
  async giro() {
    const inCorso = await this.prisma.lavorazione.findMany({
      where: { stato: "in_corso" }, take: 20 });
    for (const l of inCorso) await this.controlla(l.id);
    return { controllate: inCorso.length };
  }

  private async controlla(lavorazioneId: string) {
    const l = await this.prisma.lavorazione.findUniqueOrThrow({ where: { id: lavorazioneId } });

    let r: Awaited<ReturnType<FornitoreAnalisi["ritira"]>>;
    try {
      r = await this.fornitore.ritira(l.riferimento);
    } catch (e: any) {
      this.log.warn(`Ritiro fallito per ${l.matchId}: ${e?.message ?? e}`);
      return;
    }
    if (!r.pronto) return;

    if ("errore" in r) {
      await this.prisma.lavorazione.update({
        where: { id: l.id }, data: { stato: "fallita", messaggio: r.errore, conclusaIl: new Date() } });
      await this.lifecycle.transizione(l.matchId, "ERROR", r.errore);
      this.log.warn(`Analisi fallita per ${l.matchId}: ${r.errore}`);
      return;
    }

    // Passa dal READY_FOR_PP prima di acquisire: e lo stato in cui i dati
    // esistono ma non sono ancora nostri.
    try { await this.lifecycle.transizione(l.matchId, "READY_FOR_PP"); } catch { /* gia oltre */ }

    const esito = await this.analisi.importa(l.richiedenteId, l.matchId, {
      events: r.events, videos: r.videos, frames: r.frames ?? undefined,
    });

    await this.prisma.lavorazione.update({
      where: { id: l.id },
      data: { stato: "conclusa", conclusaIl: new Date(),
              messaggio: `revisione ${esito.revisione}, ${esito.qualita.eventiTotali} eventi` },
    });
    this.log.log(`Analisi acquisita per ${l.matchId}: ${esito.qualita.eventiTotali} eventi, ` +
                 `${esito.qualita.azioni} azioni`);
  }

  async stato(matchId: string) {
    const l = await this.prisma.lavorazione.findFirst({
      where: { matchId }, orderBy: { creatoIl: "desc" } });
    if (!l) return null;
    return {
      fornitore: l.fornitore, stato: l.stato,
      attesoPer: l.attesoPer?.toISOString() ?? null,
      avviataIl: l.creatoIl.toISOString(),
      conclusaIl: l.conclusaIl?.toISOString() ?? null,
      messaggio: l.messaggio,
      /** Solo col simulatore: permette di non aspettare i cinque minuti. */
      accelerabile: l.fornitore === "simulato" && l.stato === "in_corso",
    };
  }

  /**
   * Anticipa la consegna. Esiste solo per il simulatore: durante lo sviluppo
   * aspettare cinque minuti a ogni prova non ha senso.
   */
  async accelera(matchId: string) {
    const l = await this.prisma.lavorazione.findFirst({
      where: { matchId, stato: "in_corso" }, orderBy: { creatoIl: "desc" } });
    if (!l || l.fornitore !== "simulato") return { fatto: false };

    // Il riferimento porta con se il momento di consegna: lo si sposta a ora.
    const parti = l.riferimento.split(":");
    parti[2] = String(Date.now() - 1000);
    await this.prisma.lavorazione.update({
      where: { id: l.id }, data: { riferimento: parti.join(":"), attesoPer: new Date() } });

    await this.controlla(l.id);
    return { fatto: true };
  }
}
