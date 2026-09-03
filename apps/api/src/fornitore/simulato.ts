import { Injectable } from "@nestjs/common";
import { createHash } from "crypto";
import { generaCasuale } from "@vv/mock";
import { CONFIG } from "../common/config";
import type { EsitoAvvio, FornitoreAnalisi, RichiestaAnalisi } from "./fornitore";

/**
 * SIMULATORE — sostituisce il fornitore finche non e ingaggiato.
 *
 * Accetta la richiesta, aspetta il tempo configurato, poi produce una partita
 * sintetica sempre diversa. Il seme deriva da identificativo della partita e
 * momento della richiesta: due caricamenti non danno mai lo stesso risultato,
 * ma lo stesso riferimento restituisce sempre gli stessi dati.
 *
 * Non tiene stato in memoria: il riferimento contiene tutto il necessario.
 * Cosi un riavvio del server non perde le elaborazioni in corso.
 *
 * PER DISATTIVARLO: FORNITORE_ANALISI=esterno. Vedi `fornitore.module.ts`.
 */
@Injectable()
export class FornitoreSimulato implements FornitoreAnalisi {
  readonly nome = "simulato";
  /** Il simulatore non richiama: si interroga. Come molti fornitori reali. */
  readonly notificaSpontanea = false;

  async avvia(r: RichiestaAnalisi): Promise<EsitoAvvio> {
    const chiestoIl = Date.now();
    const seme = semeDa(r.matchId, chiestoIl);
    const attesoPer = new Date(chiestoIl + CONFIG.simulaRitardoMs);

    // Tutto quel che serve sta nel riferimento: nessuno stato da conservare.
    const riferimento = `sim:${seme}:${attesoPer.getTime()}`;

    // Una volta su venticinque l'elaborazione fallisce: succede, e la
    // schermata deve saperlo mostrare.
    const fallisce = seme % 25 === 0;
    return { riferimento: fallisce ? `${riferimento}:ko` : riferimento, attesoPer };
  }

  async ritira(riferimento: string) {
    const [tipo, semeS, quandoS, ko] = riferimento.split(":");
    if (tipo !== "sim") return { pronto: false as const };

    const quando = Number(quandoS);
    if (Date.now() < quando) return { pronto: false as const };

    if (ko === "ko") {
      return { pronto: true as const,
               errore: "Il materiale non e risultato analizzabile: inquadratura " +
                       "non conforme o qualita insufficiente." };
    }

    const g = generaCasuale({ seme: Number(semeS) });
    return {
      pronto: true as const,
      events: g.events,
      videos: g.videos,
      frames: g.frames,
    };
  }
}

/** Seme stabile ma diverso a ogni richiesta. */
function semeDa(matchId: string, quando: number): number {
  const h = createHash("sha1").update(`${matchId}:${quando}`).digest();
  return h.readUInt32BE(0);
}
