import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

export default defineConfig({
  plugins: [react()],
  server: { port: 5173 },

  resolve: {
    /*
     * I pacchetti condivisi si prendono dai SORGENTI, non dal loro `dist`.
     *
     * `@vv/core` e `@vv/schema` sono compilati in **CommonJS**, perche cosi
     * li vuole l'API sotto NestJS. Nel browser quel codice chiama `require`,
     * che non esiste: il raggruppatore lo include senza lamentarsi e
     * l'applicazione muore all'avvio con "require is not defined" — un
     * errore che la costruzione non vede, perche accade solo eseguendo.
     *
     * Puntando ai sorgenti TypeScript, Vite li compila insieme al resto e
     * produce ESM. Un solo motore delle metriche, due formati di uscita:
     * CommonJS per il server, ESM per il browser, senza duplicare nulla.
     *
     * L'alternativa sarebbe far emettere ai pacchetti entrambi i formati:
     * piu configurazione, e in un monorepo dove i sorgenti sono a portata
     * di mano non aggiunge niente.
     */
    alias: {
      "@vv/core": resolve(__dirname, "../../packages/core/src/index.ts"),
      "@vv/schema": resolve(__dirname, "../../packages/schema/src/index.ts"),
      "@vv/mock": resolve(__dirname, "../../packages/mock/src/index.ts"),
    },
  },
});
