import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from "@nestjs/common";
import { Response } from "express";
import { randomUUID } from "crypto";

/**
 * Errori uniformi { code, message, details, correlationId }.
 * Mai stringhe libere: vedi docs/09, 2.6.
 */
@Catch()
export class HttpErrorFilter implements ExceptionFilter {
  catch(ex: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();
    const correlationId = randomUUID().slice(0, 8);

    if (ex instanceof HttpException) {
      const status = ex.getStatus();
      const body = ex.getResponse() as any;
      return res.status(status).json({
        code: body?.code ?? httpCode(status),
        message: body?.message ?? ex.message,
        details: body?.details,
        correlationId,
      });
    }
    console.error(`[${correlationId}]`, ex);
    return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      code: "ERRORE_INTERNO",
      message: "Si e verificato un errore. Comunica il codice all'assistenza.",
      correlationId,
    });
  }
}

function httpCode(s: number) {
  return ({ 400: "VALIDAZIONE", 401: "NON_AUTENTICATO", 403: "NON_AUTORIZZATO",
            404: "NON_TROVATO", 409: "CONFLITTO", 413: "TROPPO_GRANDE",
            429: "TROPPI_TENTATIVI" } as Record<number, string>)[s] ?? "ERRORE";
}
