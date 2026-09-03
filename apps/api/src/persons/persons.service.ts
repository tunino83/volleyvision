import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { CONFIG } from "../common/config";
import { PrismaService } from "../common/prisma.service";
import { AuditService } from "../common/audit.service";
import type { PersonInput } from "@vv/schema";

@Injectable()
export class PersonsService {
  constructor(private prisma: PrismaService, private audit: AuditService) {}

  async elenco(userId: string, q?: string) {
    const persone = await this.prisma.person.findMany({
      where: { ownerId: userId,
        ...(q ? { OR: [{ cognome: { contains: q, mode: "insensitive" } }, { nome: { contains: q, mode: "insensitive" } }] } : {}) },
      include: { _count: { select: { matchPlayers: true } },
                 // Solo la data, MAI `dati`: i byte dell'immagine non devono
                 // entrare nell'elenco. Basta a sapere se c'e e a far scadere
                 // la copia del browser quando la foto cambia.
                 foto: { select: { aggiornataIl: true } },
                 teamPlayers: { include: { team: { select: { nome: true, stagione: true } } } } },
      orderBy: [{ cognome: "asc" }, { nome: "asc" }],
    });
    return persone.map((p) => ({
      id: p.id, cognome: p.cognome, nome: p.nome,
      dataNascita: p.dataNascita?.toISOString() ?? null,
      partite: p._count.matchPlayers,
      // La chiave compare **solo se la foto c'e**. Con 472 persone, un campo
      // sempre presente e valorizzato a `null` costa qualche decina di KB per
      // niente — e questo elenco finisce in locale su ogni dispositivo, dove
      // i KB li abbiamo contati uno per uno.
      // Con la funzione spenta la foto **non esiste** per l'API: se la si
      // dichiarasse, ogni avatar tenterebbe una richiesta destinata al 404.
      ...(CONFIG.funzioni.fotoPersone && p.foto
          ? { foto: p.foto.aggiornataIl.getTime() } : {}),
      squadre: [...new Set(p.teamPlayers.map((tp) => `${tp.team.nome} (${tp.team.stagione})`))],
    }));
  }

  /** Segnala coppie con cognome+nome simili: i duplicati arrivano subito. */
  /**
   * Coppie sospette: stesso cognome e stessa iniziale del nome. **E un
   * sospetto, non un verdetto**: due fratelli sono due persone.
   *
   * Ogni persona porta con se squadre e partite, e non per ornamento: quando i
   * due nomi coincidono davvero, e l'unico modo che ha chi guarda per capire
   * quale delle due tenere. Senza, la schermata chiederebbe di scegliere fra
   * due scritte identiche.
   */
  async possibiliDuplicati(userId: string) {
    const persone = await this.prisma.person.findMany({
      where: { ownerId: userId },
      include: { _count: { select: { matchPlayers: true } },
                 // Solo la data, MAI `dati`: i byte dell'immagine non devono
                 // entrare nell'elenco. Basta a sapere se c'e e a far scadere
                 // la copia del browser quando la foto cambia.
                 foto: { select: { aggiornataIl: true } },
                 teamPlayers: { include: { team: { select: { nome: true, stagione: true } } } } },
      orderBy: [{ cognome: "asc" }, { nome: "asc" }],
    });

    const dto = (p: (typeof persone)[number]) => ({
      id: p.id, cognome: p.cognome, nome: p.nome,
      partite: p._count.matchPlayers,
      // La chiave compare **solo se la foto c'e**. Con 472 persone, un campo
      // sempre presente e valorizzato a `null` costa qualche decina di KB per
      // niente — e questo elenco finisce in locale su ogni dispositivo, dove
      // i KB li abbiamo contati uno per uno.
      // Con la funzione spenta la foto **non esiste** per l'API: se la si
      // dichiarasse, ogni avatar tenterebbe una richiesta destinata al 404.
      ...(CONFIG.funzioni.fotoPersone && p.foto
          ? { foto: p.foto.aggiornataIl.getTime() } : {}),
      squadre: [...new Set(p.teamPlayers.map((tp) => `${tp.team.nome} (${tp.team.stagione})`))],
    });

    const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");
    const out: Array<{ a: ReturnType<typeof dto>; b: ReturnType<typeof dto> }> = [];
    for (let i = 0; i < persone.length; i++) {
      for (let j = i + 1; j < persone.length; j++) {
        const cog = norm(persone[i].cognome) === norm(persone[j].cognome);
        const iniziale = norm(persone[i].nome)[0] === norm(persone[j].nome)[0];
        if (cog && iniziale) out.push({ a: dto(persone[i]), b: dto(persone[j]) });
      }
    }
    return out;
  }

  crea(userId: string, dto: PersonInput) {
    return this.prisma.person.create({
      data: { ownerId: userId, cognome: dto.cognome, nome: dto.nome,
              dataNascita: dto.dataNascita ? new Date(dto.dataNascita) : null },
    });
  }

  async aggiorna(userId: string, id: string, dto: PersonInput) {
    await this.mia(userId, id);
    return this.prisma.person.update({
      where: { id }, data: { cognome: dto.cognome, nome: dto.nome,
        dataNascita: dto.dataNascita ? new Date(dto.dataNascita) : null } });
  }

  private async mia(userId: string, id: string) {
    const p = await this.prisma.person.findUnique({ where: { id } });
    if (!p || p.ownerId !== userId) {
      throw new NotFoundException({ code: "NON_TROVATO", message: "Persona non trovata" });
    }
    return p;
  }

  /**
   * Unione di due persone duplicate. IRREVERSIBILE: l'interfaccia chiede
   * doppia conferma. Tutti i riferimenti passano alla persona mantenuta.
   */
  /**
   * Imposta l'avatar. Nessun file: due stringhe da cui la libreria disegna.
   * Niente caricamento significa niente archiviazione, niente ritaglio,
   * niente moderazione di immagini: per una prima versione e il compromesso
   * giusto.
   */
  async impostaAvatar(userId: string, id: string,
                      d: { avatarStile: string | null; avatarSeme: string | null }) {
    await this.mia(userId, id);
    const p = await this.prisma.person.update({
      where: { id }, data: { avatarStile: d.avatarStile, avatarSeme: d.avatarSeme } });
    return { id: p.id, avatarStile: p.avatarStile, avatarSeme: p.avatarSeme };
  }

  /**
   * Salva la fotografia. Arriva gia ritagliata e ridotta dal client.
   *
   * La foto **ha la precedenza** sull'avatar disegnato, ma non lo cancella:
   * chi toglie la foto ritrova la faccia che aveva prima, invece di un
   * segnaposto grigio.
   */
  async impostaFoto(userId: string, id: string, dataUri: string) {
    await this.mia(userId, id);
    const virgola = dataUri.indexOf(",");
    const tipo = dataUri.slice(5, dataUri.indexOf(";"));
    const dati = Buffer.from(dataUri.slice(virgola + 1), "base64");

    const f = await this.prisma.personaFoto.upsert({
      where: { personId: id },
      create: { personId: id, dati, tipo, byte: dati.length },
      update: { dati, tipo, byte: dati.length, aggiornataIl: new Date() },
    });
    return { id, foto: { aggiornataIl: f.aggiornataIl, byte: f.byte } };
  }

  /** I byte, per la rotta che li serve. Nullo se non c'e. */
  async foto(userId: string, id: string) {
    await this.mia(userId, id);
    return this.prisma.personaFoto.findUnique({ where: { personId: id } });
  }

  async rimuoviFoto(userId: string, id: string) {
    await this.mia(userId, id);
    // `deleteMany` e non `delete`: togliere una foto che non c'e non e un
    // errore, e chiedere all'utente di non premere due volte sarebbe assurdo.
    await this.prisma.personaFoto.deleteMany({ where: { personId: id } });
    return { id, foto: null };
  }

  async unisci(userId: string, id: string, intoPersonId: string) {
    if (id === intoPersonId) {
      throw new BadRequestException({ code: "VALIDAZIONE", message: "Le due persone coincidono" });
    }
    await this.mia(userId, id);
    await this.mia(userId, intoPersonId);
    const [tp, mp] = await this.prisma.$transaction([
      this.prisma.teamPlayer.updateMany({ where: { personId: id }, data: { personId: intoPersonId } }),
      this.prisma.matchPlayer.updateMany({ where: { personId: id }, data: { personId: intoPersonId } }),
    ]);
    await this.prisma.person.delete({ where: { id } });
    await this.audit.log(userId, "unione_persone", "person", intoPersonId,
      `assorbita ${id}: ${tp.count} in roster, ${mp.count} in partite`);
    return { ok: true, riassegnati: { roster: tp.count, partite: mp.count } };
  }
}
