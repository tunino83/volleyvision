import type { CapacitorConfig } from "@capacitor/cli";

/**
 * L'applicazione Android.
 *
 * E la **stessa applicazione web** dentro un guscio nativo, non una riscrittura:
 * e la scelta di fondo del progetto (`docs/02b`), e regge perche il 90% di cio
 * che serve — elenchi, statistiche, dati senza rete — non ha niente di
 * specifico per piattaforma.
 *
 * ## Cosa NON c'e dentro, e non e una dimenticanza
 *
 * **La riproduzione video.** Su telefono non si guardano le partite: e la
 * decisione 9b, presa perche un video e 5 GB e nessuno lo tiene sul telefono.
 * Il telefono riprende e carica; si guarda dal computer.
 *
 * **La registrazione con la griglia di inquadratura.** E l'unica funzione
 * davvero nativa prevista, e **non e ancora scritta**. Questo guscio la
 * ospitera senza cambiare nient'altro.
 */
const config: CapacitorConfig = {
  appId: "it.volleyvision.app",
  appName: "Volley Vision",
  webDir: "dist",

  android: {
    // Il traffico in chiaro resta vietato: l'API sta su HTTPS, e permetterlo
    // "per comodita in sviluppo" e il modo in cui poi resta acceso.
    allowMixedContent: false,
  },

  server: {
    // Le pagine vengono dal pacchetto locale, non da un indirizzo remoto:
    // e cio che fa aprire l'applicazione senza rete. L'API la raggiunge
    // via HTTPS, ed e l'unica cosa che richiede connessione.
    androidScheme: "https",
  },
};

export default config;
