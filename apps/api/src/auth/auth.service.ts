import { BadRequestException, Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { randomBytes } from "crypto";
import { PrismaService } from "../common/prisma.service";
import { AuditService } from "../common/audit.service";
import { MailService } from "../common/mail.service";
import { IdentitaService, type ProfiloEsterno } from "./identita.service";
import { CONFIG } from "../common/config";
import type { LoginInput, RegisterInput } from "@vv/schema";

const MAX_TENTATIVI = 5;
const FINESTRA_MIN = 15;
const tentativi = new Map<string, { n: number; da: number }>();

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private audit: AuditService,
    private mail: MailService,
    private identita: IdentitaService,
  ) {}

  private token() { return randomBytes(32).toString("hex"); }

  /**
   * Registrazione. Se l'email esiste gia risponde ugualmente con successo:
   * il modulo non rivela mai l'esistenza di un account (docs/09, S-01).
   */
  async register(dto: RegisterInput) {
    if (CONFIG.registrazione === "invito") {
      throw new BadRequestException({ code: "REGISTRAZIONE_CHIUSA",
        message: "Le registrazioni sono su invito. Chiedi all'amministratore di essere aggiunto." });
    }
    const esistente = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (esistente) {
      await this.mail.invia(dto.email, "Tentativo di registrazione",
        "Esiste gia un account con questo indirizzo. Se sei stato tu, accedi normalmente.");
      return { ok: true };
    }
    const user = await this.prisma.user.create({
      data: { email: dto.email, nome: dto.nome, cognome: dto.cognome },
    });
    await this.identita.creaPassword(user.id, dto.email, dto.password);
    const valore = this.token();
    await this.prisma.token.create({
      data: { userId: user.id, tipo: "verifica", valore,
              scadeIl: new Date(Date.now() + 24 * 3600 * 1000) },
    });
    await this.mail.verificaEmail(user.email, valore);
    await this.audit.log(user.id, "registrazione", "user", user.id);

    // Inviti pendenti: la condivisione ricevuta prima della registrazione si attiva ora.
    await this.attivaInviti(user.id, user.email);
    return { ok: true };
  }

  private async attivaInviti(userId: string, email: string) {
    await this.prisma.teamShare.updateMany({
      where: { email, userId: null }, data: { userId, statoInvito: "attivo" } });
    await this.prisma.competitionShare.updateMany({
      where: { email, userId: null }, data: { userId, statoInvito: "attivo" } });
  }

  async verificaEmail(valore: string) {
    const t = await this.prisma.token.findUnique({ where: { valore } });
    if (!t || t.tipo !== "verifica") throw new BadRequestException({ code: "TOKEN_NON_VALIDO", message: "Collegamento non valido" });
    if (t.usatoIl) return { ok: true, gia: true };
    if (t.scadeIl < new Date()) throw new BadRequestException({ code: "TOKEN_SCADUTO", message: "Collegamento scaduto" });
    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: t.userId }, data: { emailVerificataIl: new Date() } }),
      this.prisma.token.update({ where: { id: t.id }, data: { usatoIl: new Date() } }),
    ]);
    return { ok: true };
  }

  async login(dto: LoginInput) {
    const k = dto.email;
    const t = tentativi.get(k);
    if (t && t.n >= MAX_TENTATIVI && Date.now() - t.da < FINESTRA_MIN * 60000) {
      throw new BadRequestException({ code: "TROPPI_TENTATIVI",
        message: `Troppi tentativi. Riprova fra ${FINESTRA_MIN} minuti.` });
    }
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    const ok = user && await this.identita.verificaPassword(user.id, dto.password);
    if (!user || !ok) {
      const cur = t && Date.now() - t.da < FINESTRA_MIN * 60000 ? t : { n: 0, da: Date.now() };
      tentativi.set(k, { n: cur.n + 1, da: cur.da });
      // Messaggio unico e generico: non rivela se l'email esiste.
      throw new UnauthorizedException({ code: "CREDENZIALI", message: "Email o password non corretti" });
    }
    tentativi.delete(k);
    if (user.stato === "sospeso") throw new UnauthorizedException({ code: "SOSPESO", message: "Account sospeso" });

    await this.prisma.user.update({ where: { id: user.id }, data: { ultimoAccesso: new Date() } });
    await this.audit.log(user.id, "accesso", "user", user.id);
    return this.emettiSessione(user.id, user.email, user.ruolo);
  }

  private async emettiSessione(userId: string, email: string, ruolo: string) {
    const access = await this.jwt.signAsync({ sub: userId, email, ruolo });
    const refresh = this.token();
    await this.prisma.token.create({
      data: { userId, tipo: "refresh", valore: refresh,
              scadeIl: new Date(Date.now() + CONFIG.refreshTtlDays * 86400000) },
    });
    return { access, refresh };
  }

  async refresh(valore: string) {
    const t = await this.prisma.token.findUnique({ where: { valore }, include: { user: true } });
    if (!t || t.tipo !== "refresh" || t.usatoIl || t.scadeIl < new Date()) {
      throw new UnauthorizedException({ code: "SESSIONE_SCADUTA", message: "Sessione scaduta" });
    }
    await this.prisma.token.update({ where: { id: t.id }, data: { usatoIl: new Date() } });
    return this.emettiSessione(t.user.id, t.user.email, t.user.ruolo);
  }

  async logout(userId: string) {
    await this.prisma.token.updateMany({
      where: { userId, tipo: "refresh", usatoIl: null }, data: { usatoIl: new Date() } });
    return { ok: true };
  }

  /** Risposta sempre identica, che l'email esista o meno. */
  async richiediReset(email: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (user) {
      const valore = this.token();
      await this.prisma.token.create({
        data: { userId: user.id, tipo: "reset", valore, scadeIl: new Date(Date.now() + 3600 * 1000) } });
      await this.mail.resetPassword(email, valore);
    }
    return { ok: true };
  }

  async eseguiReset(valore: string, password: string) {
    const t = await this.prisma.token.findUnique({ where: { valore } });
    if (!t || (t.tipo !== "reset" && t.tipo !== "invito") || t.usatoIl || t.scadeIl < new Date()) {
      throw new BadRequestException({ code: "TOKEN_NON_VALIDO", message: "Collegamento non valido o scaduto" });
    }
    await this.identita.cambiaPassword(t.userId, password);
    await this.prisma.$transaction([
      this.prisma.token.update({ where: { id: t.id }, data: { usatoIl: new Date() } }),
      // Tutte le sessioni attive cadono.
      this.prisma.token.updateMany({ where: { userId: t.userId, tipo: "refresh", usatoIl: null },
        data: { usatoIl: new Date() } }),
      // Chi arriva da un invito ha appena dimostrato di leggere quella casella.
      ...(t.tipo === "invito"
        ? [this.prisma.user.update({ where: { id: t.userId }, data: { emailVerificataIl: new Date() } })]
        : []),
    ]);
    await this.audit.log(t.userId, "reset_password_eseguito", "user", t.userId);
    return { ok: true };
  }

  /**
   * Accesso con un provider esterno. Oggi nessuno lo chiama: la rotta si
   * aggiunge quando il provider viene attivato. Il percorso pero e questo, ed
   * e gia completo — vedi `provider/google.ts`.
   */
  async accediConProvider(p: ProfiloEsterno) {
    const { user, creato } = await this.identita.accediConProvider(p, {
      registrazioneAperta: CONFIG.registrazione === "aperta" });
    if (user.stato === "sospeso") {
      throw new UnauthorizedException({ code: "SOSPESO", message: "Account sospeso" });
    }
    await this.prisma.user.update({ where: { id: user.id }, data: { ultimoAccesso: new Date() } });
    await this.audit.log(user.id, creato ? "registrazione" : "accesso", "user", user.id, p.provider);
    if (creato) await this.attivaInviti(user.id, user.email);
    return this.emettiSessione(user.id, user.email, user.ruolo);
  }

  scollegaIdentita(userId: string, identitaId: string) {
    return this.identita.scollega(userId, identitaId);
  }

  /** Il proprio profilo: nome e cognome. L'email non si cambia da qui. */
  async aggiornaProfilo(userId: string, nome: string, cognome: string) {
    await this.prisma.user.update({ where: { id: userId }, data: { nome, cognome } });
    return this.me(userId);
  }

  /**
   * Cambio password da dentro. Richiede quella attuale: senza, chi trovasse
   * una sessione aperta si approprierebbe dell'account per sempre.
   */
  async cambiaPassword(userId: string, attuale: string, nuova: string) {
    const ok = await this.identita.verificaPassword(userId, attuale);
    if (!ok) {
      throw new BadRequestException({ code: "CREDENZIALI",
        message: "La password attuale non e corretta", details: { attuale: ["Non corretta"] } });
    }
    await this.identita.cambiaPassword(userId, nuova);
    await this.audit.log(userId, "cambio_password", "user", userId);
    return { ok: true };
  }

  async me(userId: string) {
    const u = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    return { id: u.id, email: u.email, nome: u.nome, cognome: u.cognome,
             ruolo: u.ruolo, stato: u.stato,
             emailVerificataIl: u.emailVerificataIl?.toISOString() ?? null,
             identita: await this.identita.elenco(userId) };
  }
}
