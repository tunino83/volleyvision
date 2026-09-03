import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { HttpErrorFilter } from "./common/error.filter";
import { json, raw } from "express";

// I conteggi di byte sono BigInt (un video da 5 GB non sta in un intero a 32 bit).
// JSON non li serializza da se: si emettono come numeri, sicuri fino a 9 PB.
(BigInt.prototype as any).toJSON = function () { return Number(this); };

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors({ origin: true, credentials: true });
  app.setGlobalPrefix("api");
  app.useGlobalFilters(new HttpErrorFilter());
  // I blocchi di caricamento arrivano come flusso binario grezzo; tutto il
  // resto e JSON. Un solo passaggio decide quale interpretazione applicare.
  const CHUNK = /^\/api\/uploads\/[^/]+\/chunk/;
  // L'acquisizione dell'analisi porta i tre file del fornitore in un solo
  // corpo: le posizioni da sole valgono una decina di megabyte.
  const IMPORT = /^\/api\/matches\/[^/]+\/analysis\/import/;
  const grezzo = raw({ type: () => true, limit: "64mb" });
  const grande = json({ limit: "96mb" });
  const strutturato = json({ limit: "2mb" });
  app.use((req: any, res: any, next: any) => {
    if (req.method !== "POST") return strutturato(req, res, next);
    if (CHUNK.test(req.url)) return grezzo(req, res, next);
    if (IMPORT.test(req.url)) return grande(req, res, next);
    return strutturato(req, res, next);
  });
  const port = Number(process.env.PORT ?? 3001);
  await app.listen(port);
  console.log(`[api] in ascolto su http://localhost:${port}/api`);
}
bootstrap();
