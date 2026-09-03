import { existsSync, mkdirSync, statSync, appendFileSync, rmSync } from "fs";
import { join, dirname } from "path";
import { CONFIG } from "../common/config";

/**
 * PUNTO DI INTERVENTO 2 — archiviazione.
 *
 * In sviluppo i blocchi si accodano su disco locale. In esercizio il client
 * NON deve passare dall'API: si emette un indirizzo di caricamento firmato e
 * i byte vanno diretti allo spazio di archiviazione (docs/03, "Regola zero").
 * L'interfaccia sotto e pensata per reggere entrambe le modalita.
 */
export interface StorageDriver {
  /** Indirizzo a cui il client invia i blocchi. Locale: passa dall'API. */
  urlCaricamento(key: string, uploadId: string): { url: string; diretto: boolean };
  appendChunk(key: string, buf: Buffer): void;
  dimensione(key: string): number;
  esiste(key: string): boolean;
  /** Byte di un caricamento abbandonato. Senza, si paga spazio per file che
      nessuno sa di avere. */
  elimina(key: string): void;
}

class LocalDriver implements StorageDriver {
  private base = CONFIG.storageLocalDir;
  private path(key: string) { return join(this.base, key); }

  urlCaricamento(_key: string, uploadId: string) {
    return { url: `/api/uploads/${uploadId}/chunk`, diretto: false };
  }
  appendChunk(key: string, buf: Buffer) {
    const p = this.path(key);
    mkdirSync(dirname(p), { recursive: true });
    appendFileSync(p, buf);
  }
  dimensione(key: string) { const p = this.path(key); return existsSync(p) ? statSync(p).size : 0; }
  esiste(key: string) { return existsSync(this.path(key)); }
  elimina(key: string) { const p = this.path(key); if (existsSync(p)) rmSync(p, { force: true }); }
}

export const storage: StorageDriver = new LocalDriver();
