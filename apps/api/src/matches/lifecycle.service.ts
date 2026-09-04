import { BadRequestException, Injectable } from "@nestjs/common";
import { PrismaService } from "../common/prisma.service";
import type { MatchStatus } from "@vv/schema";

/**
 * Macchina a stati unica della partita (docs/08, cap. 6).
 *
 *   WAITING -> PENDING -> RUNNING -> READY_FOR_PP -> READY
 *                  \          \            \
 *                   +----------+------------+--> ERROR
 *
 * WAITING..PENDING sono nostri. Da RUNNING in poi li imposta il fornitore
 * dell'analisi tramite callback: PUNTO DI INTERVENTO 1.
 */
const TRANSIZIONI: Record<MatchStatus, MatchStatus[]> = {
  WAITING: ["PENDING"],
  PENDING: ["RUNNING", "ERROR", "WAITING"],
  RUNNING: ["READY_FOR_PP", "ERROR"],
  READY_FOR_PP: ["READY", "ERROR"],
  READY: ["PENDING"],          // rielaborazione richiesta da un amministratore
  ERROR: ["PENDING"],
};

@Injectable()
export class LifecycleService {
  constructor(private prisma: PrismaService) {}

  puo(da: MatchStatus, a: MatchStatus) { return TRANSIZIONI[da]?.includes(a) ?? false; }

  async transizione(matchId: string, a: MatchStatus, errore?: string) {
    const m = await this.prisma.match.findUniqueOrThrow({ where: { id: matchId } });
    const da = m.stato as MatchStatus;
    if (da === a) return m;
    if (!this.puo(da, a)) {
      throw new BadRequestException({ code: "TRANSIZIONE_NON_VALIDA",
        message: `Passaggio non ammesso da ${da} a ${a}` });
    }
    return this.prisma.match.update({
      where: { id: matchId },
      data: { stato: a, statoAggiornatoIl: new Date(), erroreMessaggio: errore ?? null },
    });
  }

  /**
   * Valuta se la partita puo passare in coda per l'analisi.
   *
   * Condizioni: **almeno un video** caricato, e la formazione del set 1 per
   * entrambe le squadre (e un dato di ingresso per l'analisi).
   *
   * Il secondo video e **facoltativo**. Lo era gia di fatto — il fornitore
   * analizza cio che riceve — ma richiederli entrambi bloccava chi ne ha uno
   * solo, che e il caso piu comune: una telecamera sola in tribuna. La
   * direzione e verso una ripresa unica; questa e la prima tappa.
   */
  async valutaAvvio(matchId: string) {
    const m = await this.prisma.match.findUniqueOrThrow({
      where: { id: matchId }, include: { video: true, formazioni: true } });
    if (m.stato !== "WAITING") return m;

    const caricati = m.video.filter((v) => v.stato === "CARICATO").length;
    if (caricati < 1) return m;

    const set1 = m.formazioni.filter((f) => f.set === 1);
    const completa = (f: any) => [f.pos1, f.pos2, f.pos3, f.pos4, f.pos5, f.pos6].every((p) => p !== null);
    if (set1.length < 2 || !set1.every(completa)) return m;

    return this.transizione(matchId, "PENDING");
  }
}
