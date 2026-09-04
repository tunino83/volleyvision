import type { CapacitorConfig } from "@capacitor/cli";

/**
 * L'applicazione Android.
 *
 * E la **stessa applicazione web** dentro un guscio nativo, non una riscrittura:
 * e la scelta di fondo del progetto (`docs/02b`), e regge perche il 90% di cio
 * che serve — elenchi, statistiche, dati senza rete — non ha niente di
 * specifico per piattaforma.
 *
 * ## Le due cose che qui sono native, e perche
 *
 * **La registrazione con la mira di inquadratura.** Non per l'anteprima — si
 * otterrebbe anche nel WebView — ma per il profilo di codifica, l'orientamento
 * bloccato e lo schermo che non si spegne. Registrando dal browser si ottiene
 * quello che decide il browser, e su un'ora di partita la differenza fra 4 e
 * 12 Mbit/s sono gigabyte.
 *
 * **Il caricamento in secondo piano.** Un video da 5 GB su rete mobile sono
 * decine di minuti; nel browser il trasferimento vive quanto la scheda aperta.
 * Un servizio nativo lo porta avanti a schermo spento (decisione 9b, rivista
 * il 2026-09-04).
 *
 * ## Cosa NON c'e dentro, e non e una dimenticanza
 *
 * **La riproduzione video.** Su telefono non si guardano le partite: e la
 * decisione 9b, presa perche un video e 5 GB e nessuno lo tiene sul telefono.
 * Il telefono riprende e carica; si guarda dal computer.
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
