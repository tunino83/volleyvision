import { BadRequestException, Injectable } from "@nestjs/common";
import * as bcrypt from "bcryptjs";
import { PrismaService } from "../common/prisma.service";

/**
 * Le identita di accesso.
 *
 * Un utente e una persona; un'identita e un modo di dimostrare di essere
 * quella persona. Oggi ce n'e una sola, `password`. Domani ce ne saranno
 * altre — Google, Apple — e **nessun'altra parte del sistema deve cambiare**:
 * il resto conosce solo `User.id`.
 *
 * Il punto d'innesto e uno solo: `accediConProvider()`. Un provider nuovo si
 * riduce a ottenere da lui `{ providerUserId, email, nome, cognome }` e
 * chiamare quel metodo. Vedi `docs/11-utenti-e-accesso.md`.
 */

export interface ProfiloEsterno {
  provider: string;
  providerUserId: string;
  email: string;
  nome?: string;
  cognome?: string;
  /** Il provider dichiara di aver verificato l'indirizzo? */
  emailVerificata?: boolean;
}

@Injectable()
export class IdentitaService {
  constructor(private prisma: PrismaService) {}

  /** Crea l'identita a password. L'unica che conserva un segreto da noi. */
  async creaPassword(userId: string, email: string, password: string) {
    return this.prisma.authIdentity.create({
      data: { userId, provider: "password", providerUserId: email.toLowerCase(),
              passwordHash: await bcrypt.hash(password, 10) },
    });
  }

  /** Verifica la password. Null se non c'e identita a password o non combacia. */
  async verificaPassword(userId: string, password: string) {
    const i = await this.prisma.authIdentity.findFirst({
      where: { userId, provider: "password" } });
    if (!i?.passwordHash) return null;
    if (!await bcrypt.compare(password, i.passwordHash)) return null;
    await this.prisma.authIdentity.update({
      where: { id: i.id }, data: { ultimoUsoIl: new Date() } });
    return i;
  }

  async cambiaPassword(userId: string, password: string) {
    const i = await this.prisma.authIdentity.findFirst({
      where: { userId, provider: "password" } });
    const passwordHash = await bcrypt.hash(password, 10);
    const u = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });

    // Chi era entrato solo con un provider esterno e ora imposta una password
    // ottiene l'identita che non aveva: e come si "aggiunge" un modo di entrare.
    if (!i) {
      await this.prisma.authIdentity.create({
        data: { userId, provider: "password", providerUserId: u.email.toLowerCase(), passwordHash } });
      return;
    }
    await this.prisma.authIdentity.update({ where: { id: i.id }, data: { passwordHash } });
  }

  /**
   * Accesso tramite un provider esterno. **E qui che si innesta Google.**
   *
   * Tre casi, nell'ordine in cui vanno provati:
   * 1. l'identita esiste gia    -> e lui, si entra
   * 2. esiste un utente con quella email -> si collega l'identita all'utente
   *    che c'e gia, altrimenti la stessa persona si ritroverebbe due account
   * 3. nessuno dei due          -> si crea l'utente, se le registrazioni sono
   *    aperte
   *
   * Il caso 2 e il motivo per cui questo metodo esiste: senza, chi si era
   * registrato con la password e poi entra con Google si vedrebbe un account
   * vuoto, e le sue partite sarebbero "sparite".
   */
  async accediConProvider(p: ProfiloEsterno, opzioni: { registrazioneAperta: boolean }) {
    const email = p.email.toLowerCase();

    const gia = await this.prisma.authIdentity.findUnique({
      where: { provider_providerUserId: { provider: p.provider, providerUserId: p.providerUserId } },
      include: { user: true },
    });
    if (gia) {
      await this.prisma.authIdentity.update({
        where: { id: gia.id }, data: { ultimoUsoIl: new Date() } });
      return { user: gia.user, creato: false };
    }

    const utente = await this.prisma.user.findUnique({ where: { email } });
    if (utente) {
      await this.collega(utente.id, p);
      return { user: utente, creato: false };
    }

    if (!opzioni.registrazioneAperta) {
      throw new BadRequestException({ code: "REGISTRAZIONE_CHIUSA",
        message: "Le registrazioni sono su invito. Chiedi all'amministratore di essere aggiunto." });
    }

    const nuovo = await this.prisma.user.create({
      data: {
        email, nome: p.nome ?? "", cognome: p.cognome ?? "",
        // Il provider ha gia verificato l'indirizzo: chiederlo di nuovo
        // sarebbe una seccatura senza contropartita.
        emailVerificataIl: p.emailVerificata ? new Date() : null,
      },
    });
    await this.collega(nuovo.id, p);
    return { user: nuovo, creato: true };
  }

  private collega(userId: string, p: ProfiloEsterno) {
    return this.prisma.authIdentity.create({
      data: {
        userId, provider: p.provider, providerUserId: p.providerUserId,
        profiloJson: JSON.stringify({ email: p.email, nome: p.nome, cognome: p.cognome }),
        ultimoUsoIl: new Date(),
      },
    });
  }

  /** Cosa mostrare nel profilo: come si puo entrare, senza segreti. */
  async elenco(userId: string) {
    const v = await this.prisma.authIdentity.findMany({
      where: { userId }, orderBy: { creatoIl: "asc" } });
    return v.map((i) => ({
      id: i.id, provider: i.provider,
      etichetta: i.provider === "password" ? i.providerUserId : i.providerUserId,
      ultimoUsoIl: i.ultimoUsoIl?.toISOString() ?? null,
      creatoIl: i.creatoIl.toISOString(),
    }));
  }

  /**
   * Scollega un provider. **Mai l'ultimo rimasto**: si resterebbe fuori dal
   * proprio account senza modo di rientrare.
   */
  async scollega(userId: string, identitaId: string) {
    const tutte = await this.prisma.authIdentity.findMany({ where: { userId } });
    if (tutte.length <= 1) {
      throw new BadRequestException({ code: "ULTIMA_IDENTITA",
        message: "E l'unico modo che hai per accedere: aggiungine un altro prima di togliere questo" });
    }
    const mia = tutte.find((i) => i.id === identitaId);
    if (!mia) {
      throw new BadRequestException({ code: "NON_TROVATO", message: "Identita non trovata" });
    }
    await this.prisma.authIdentity.delete({ where: { id: identitaId } });
    return { ok: true };
  }
}
