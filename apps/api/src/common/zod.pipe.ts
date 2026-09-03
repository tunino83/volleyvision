import { BadRequestException, PipeTransform } from "@nestjs/common";
import { ZodSchema } from "zod";

/** Stessa validazione del client, stesso schema: @vv/schema e la fonte unica. */
export class ZodPipe<T> implements PipeTransform {
  constructor(private readonly schema: ZodSchema<T>) {}
  transform(value: unknown): T {
    const r = this.schema.safeParse(value);
    if (r.success) return r.data;
    const details: Record<string, string[]> = {};
    for (const i of r.error.issues) {
      const k = i.path.join(".") || "_";
      (details[k] ??= []).push(i.message);
    }
    throw new BadRequestException({ code: "VALIDAZIONE", message: "Dati non validi", details });
  }
}
