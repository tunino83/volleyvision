import { BadRequestException, Inject, Injectable, NotFoundException, forwardRef } from "@nestjs/common";
import { PrismaService } from "../common/prisma.service";
import { AccessService } from "../common/access.service";
import { LifecycleService } from "../matches/lifecycle.service";
import { LavorazioneService } from "../fornitore/lavorazione.service";
import { CONFIG } from "../common/config";
import { storage } from "./storage";
import { capacitaPartita, LIMITS } from "@vv/schema";
import type { MatchStatus } from "@vv/schema";
import type { UploadSessionInput } from "@vv/schema";

/**
 * Caricamento riprendibile a blocchi (docs/03).
 * Il client conserva un solo identificativo di sessione: la ripresa richiede
 * una sola interrogazione, e lo stesso codice varra per tutte le shell.
 */
@Injectable()
export class UploadsService {
  constructor(private prisma: PrismaService, private access: AccessService,
              private lifecycle: LifecycleService,
              @Inject(forwardRef(() => LavorazioneService))
              private lavorazione: LavorazioneService) {}

  async apriSessione(userId: string, matchId: string, lato: number, dto: UploadSessionInput) {
    const { match } = await this.access.match(userId, matchId, true);

    // I video di una partita gia mandata all'analisi non si sostituiscono: il
    // calcolo e stato fatto su quelli.
    const cap = capacitaPartita(match.stato as MatchStatus);
    if (!cap.caricaVideo) {
      throw new BadRequestException({ code: "STATO_NON_CONSENTE",
        message: `Caricamento non possibile con la partita in stato "${match.stato}". ${cap.motivoBlocco ?? ""}`.trim() });
    }

    if (dto.dimensione > CONFIG.maxVideoBytes) {
      throw new BadRequestException({ code: "TROPPO_GRANDE",
        message: `Il file supera il limite di ${(CONFIG.maxVideoBytes / 1024 ** 3).toFixed(1)} GB` });
    }
    if (!LIMITS.acceptedMime.includes(dto.mime as any)) {
      throw new BadRequestException({ code: "FORMATO_NON_AMMESSO",
        message: "Formato non ammesso. Sono accettati MP4, MOV, MKV, AVI." });
    }

    // La formazione del set 1 e un dato di ingresso per l'analisi: obbligatoria.
    const set1 = await this.prisma.lineup.findMany({ where: { matchId, set: 1 } });
    const completa = (f: any) => [f.pos1, f.pos2, f.pos3, f.pos4, f.pos5, f.pos6].every((p) => p !== null);
    if (set1.length < 2 || !set1.every(completa)) {
      throw new BadRequestException({ code: "FORMAZIONE_MANCANTE",
        message: "Inserisci la formazione del set 1 per entrambe le squadre prima di caricare i video" });
    }

    const video = await this.prisma.video.findUnique({ where: { matchId_lato: { matchId, lato } } });
    if (!video) throw new NotFoundException({ code: "NON_TROVATO", message: "Lato non valido" });
    if (video.stato === "CARICATO" || video.stato === "NORMALIZZATO") {
      throw new BadRequestException({ code: "CONFLITTO", message: "Video gia presente su questo lato" });
    }

    /**
     * Se una sessione aperta esiste gia **per lo stesso file**, si riusa.
     * E cio che rende possibile riprendere dopo che l'applicazione e stata
     * chiusa: sul mobile il caricamento avviene solo in primo piano, quindi
     * l'interruzione non e l'eccezione ma il caso normale. Cancellare e
     * ricominciare significherebbe buttare i gigabyte gia trasferiti.
     */
    const aperta = await this.prisma.uploadSession.findFirst({
      where: { videoId: video.id, stato: "in_corso" } });
    if (aperta && aperta.scadeIl > new Date()
        && aperta.nomeFile === dto.nomeFile && Number(aperta.dimensione) === dto.dimensione) {
      const { url, diretto } = storage.urlCaricamento(aperta.storageKey, aperta.id);
      return { uploadId: aperta.id, url, diretto, chunkBytes: aperta.chunkBytes,
               bytesRicevuti: Number(aperta.bytesRicevuti), ripresa: true,
               scadeIl: aperta.scadeIl.toISOString() };
    }

    const storageKey = `matches/${matchId}/side${lato}-${Date.now()}`;
    const scadeIl = new Date(Date.now() + CONFIG.uploadTtlDays * 86400000);

    // Sessione diversa da quella aperta: i byte gia scritti non servono piu.
    for (const vecchia of await this.prisma.uploadSession.findMany({ where: { videoId: video.id } })) {
      storage.elimina(vecchia.storageKey);
    }
    await this.prisma.uploadSession.deleteMany({ where: { videoId: video.id } });
    const s = await this.prisma.uploadSession.create({
      data: { videoId: video.id, nomeFile: dto.nomeFile, mime: dto.mime, dimensione: BigInt(dto.dimensione),
              chunkBytes: CONFIG.chunkBytes, storageKey, scadeIl },
    });
    await this.prisma.video.update({
      where: { id: video.id },
      data: { stato: "IN_CARICAMENTO", nomeFile: dto.nomeFile, mime: dto.mime,
              dimensione: BigInt(dto.dimensione), storageKey },
    });

    const { url, diretto } = storage.urlCaricamento(storageKey, s.id);
    return { uploadId: s.id, url, diretto, chunkBytes: s.chunkBytes,
             bytesRicevuti: 0, ripresa: false, scadeIl: s.scadeIl.toISOString() };
  }

  /**
   * Sessione aperta per quel lato, se c'e. **Non crea e non distrugge nulla**:
   * serve alla schermata per dire "interrotto al 43%, ricarica lo stesso file"
   * quando si riapre l'applicazione. Il file non si puo riaprire da soli: il
   * browser non conserva l'accesso dopo la chiusura, quindi lo ripropone
   * l'utente e noi verifichiamo che sia lo stesso.
   */
  async sessioneAperta(userId: string, matchId: string, lato: number) {
    await this.access.match(userId, matchId, true);
    const video = await this.prisma.video.findUnique({ where: { matchId_lato: { matchId, lato } } });
    if (!video) throw new NotFoundException({ code: "NON_TROVATO", message: "Lato non valido" });

    const s = await this.prisma.uploadSession.findFirst({
      where: { videoId: video.id, stato: "in_corso" }, orderBy: { creatoIl: "desc" } });
    if (!s || s.scadeIl < new Date()) return null;

    return { uploadId: s.id, nomeFile: s.nomeFile, mime: s.mime,
             dimensione: Number(s.dimensione), bytesRicevuti: Number(s.bytesRicevuti),
             chunkBytes: s.chunkBytes, scadeIl: s.scadeIl.toISOString() };
  }

  /** Stato della sessione: e cio che permette la ripresa dopo interruzione. */
  async stato(userId: string, uploadId: string) {
    const s = await this.sessione(userId, uploadId);
    return { uploadId: s.id, bytesRicevuti: Number(s.bytesRicevuti),
             dimensione: Number(s.dimensione), chunkBytes: s.chunkBytes,
             stato: s.stato, scadeIl: s.scadeIl.toISOString() };
  }

  private async sessione(userId: string, uploadId: string) {
    const s = await this.prisma.uploadSession.findUnique({
      where: { id: uploadId }, include: { video: true } });
    if (!s) throw new NotFoundException({ code: "NON_TROVATO", message: "Sessione non trovata" });
    await this.access.match(userId, s.video.matchId, true);
    if (s.scadeIl < new Date()) {
      await this.prisma.uploadSession.update({ where: { id: s.id }, data: { stato: "scaduta" } });
      throw new BadRequestException({ code: "SESSIONE_SCADUTA",
        message: "Sessione scaduta: il caricamento va ricominciato" });
    }
    return s;
  }

  async ricevi(userId: string, uploadId: string, offset: number, buf: Buffer) {
    const s = await this.sessione(userId, uploadId);
    const gia = Number(s.bytesRicevuti);
    if (offset !== gia) {
      // Il client ha perso il filo: gli si dice da dove riprendere.
      throw new BadRequestException({ code: "OFFSET_ERRATO",
        message: `Riprendi da ${gia}`, details: { bytesRicevuti: [String(gia)] } });
    }
    storage.appendChunk(s.storageKey, buf);
    const bytesRicevuti = gia + buf.length;
    await this.prisma.uploadSession.update({
      where: { id: s.id }, data: { bytesRicevuti: BigInt(bytesRicevuti) } });
    return { bytesRicevuti, completato: bytesRicevuti >= Number(s.dimensione) };
  }

  async completa(userId: string, uploadId: string, checksum?: string | null) {
    const s = await this.sessione(userId, uploadId);
    const reale = storage.dimensione(s.storageKey);
    if (reale !== Number(s.dimensione)) {
      await this.prisma.uploadSession.update({ where: { id: s.id }, data: { stato: "fallita" } });
      throw new BadRequestException({ code: "INCOMPLETO",
        message: `Caricamento incompleto: ricevuti ${reale} di ${s.dimensione} byte` });
    }
    await this.prisma.$transaction([
      this.prisma.uploadSession.update({ where: { id: s.id }, data: { stato: "completata" } }),
      this.prisma.video.update({ where: { id: s.videoId },
        data: { stato: "CARICATO", checksum: checksum ?? null, caricatoIl: new Date() } }),
    ]);
    const m = await this.lifecycle.valutaAvvio(s.video.matchId);

    // Se la partita e passata in coda, la si mette in lavorazione presso il
    // fornitore. Chi sia il fornitore, qui, non interessa.
    if (m.stato === "PENDING") {
      try { await this.lavorazione.accoda(m.id, userId); }
      catch (e: any) { /* il fornitore non risponde: resta in coda, si ritenta */ }
    }
    return { ok: true, statoPartita: m.stato };
  }

  async annulla(userId: string, uploadId: string) {
    const s = await this.sessione(userId, uploadId);
    storage.elimina(s.storageKey);
    await this.prisma.$transaction([
      this.prisma.uploadSession.delete({ where: { id: s.id } }),
      this.prisma.video.update({ where: { id: s.videoId },
        data: { stato: "ASSENTE", nomeFile: null, dimensione: null, storageKey: null } }),
    ]);
    return { ok: true };
  }

  /**
   * Riconciliazione: sessioni ferme oltre la scadenza vengono marcate.
   * Senza questo, dopo mesi si paga l'archiviazione di file che nessuno
   * sa di avere. Va richiamata da un processo periodico.
   */
  async riconcilia() {
    const scadute = await this.prisma.uploadSession.findMany({
      where: { stato: "in_corso", scadeIl: { lt: new Date() } } });
    for (const s of scadute) {
      storage.elimina(s.storageKey);
      await this.prisma.uploadSession.update({ where: { id: s.id }, data: { stato: "scaduta" } });
      await this.prisma.video.update({ where: { id: s.videoId },
        data: { stato: "ASSENTE", nomeFile: null, dimensione: null, storageKey: null } });
    }
    return { ripulite: scadute.length };
  }
}
