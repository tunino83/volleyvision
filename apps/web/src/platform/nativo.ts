import { registerPlugin, Capacitor } from "@capacitor/core";
import { API } from "../api/client";

/**
 * Le due sole funzioni native, viste dal codice web.
 *
 * Registrare con la mira di inquadratura e caricare a schermo spento: tutto
 * il resto dell'applicazione e la stessa pagina che gira nel browser. Il
 * nativo si paga su ogni piattaforma, quindi ci va solo cio che non puo
 * stare altrove (`docs/02b`).
 *
 * Fuori dall'app Android questo modulo **non fallisce**: `disponibile()`
 * risponde di no e chi chiama nasconde i comandi. Nessun `if (Android)`
 * sparso nei componenti — quella e la regola 1.
 */

export interface EsitoRegistrazione {
  uri?: string;
  nome?: string;
  byte?: number;
  durataMs?: number;
  annullata?: boolean;
}

export interface EsitoScelta {
  uri?: string;
  nome?: string;
  byte?: number;
  annullata?: boolean;
}

export interface StatoCaricamentoNativo {
  uploadId: string | null;
  inviati: number;
  totali: number;
  errore: string | null;
  completato: boolean;
}

interface VideoNativo {
  disponibile(): Promise<{ registrazione: boolean; caricamentoInSecondoPiano: boolean }>;
  registra(): Promise<EsitoRegistrazione>;
  scegliVideo(): Promise<EsitoScelta>;
  carica(o: {
    uri: string; uploadId: string; base: string; token: string;
    titolo?: string; byteTotali?: number; chunkBytes?: number;
  }): Promise<StatoCaricamentoNativo>;
  annullaCaricamento(): Promise<void>;
  statoCaricamento(): Promise<StatoCaricamentoNativo>;
  chiediNotifiche(): Promise<{ concesso: boolean }>;
  salvaFile(o: { nome: string; mime: string; base64: string }): Promise<{ salvato: boolean }>;
  addListener(evento: "caricamento",
              f: (s: StatoCaricamentoNativo) => void): Promise<{ remove(): Promise<void> }>;
}

const Nativo = registerPlugin<VideoNativo>("VideoNativo");

/** Vero solo dentro l'applicazione Android: nel browser il plugin non esiste. */
export const nativoPresente = () =>
  Capacitor.isNativePlatform() && Capacitor.isPluginAvailable("VideoNativo");

/**
 * Cosa sa fare questo apparecchio.
 *
 * Si chiede una volta e si ricorda: la risposta non cambia durante una
 * sessione, e ogni chiamata attraversa il ponte verso il nativo.
 */
let capacita: { registrazione: boolean; caricamentoInSecondoPiano: boolean } | null = null;

export async function capacitaNative() {
  if (!nativoPresente()) return { registrazione: false, caricamentoInSecondoPiano: false };
  if (capacita) return capacita;
  try {
    capacita = await Nativo.disponibile();
  } catch {
    // Versione dell'applicazione piu vecchia del codice web: il plugin c'e
    // ma il metodo no. Meglio nascondere i comandi che mostrarne di rotti.
    capacita = { registrazione: false, caricamentoInSecondoPiano: false };
  }
  return capacita;
}

/**
 * Consegna un file all'utente, nel modo giusto per dove si sta girando.
 *
 * Nel browser un collegamento con `download`. Nell'app Android **non
 * funziona**: nel WebView quel meccanismo non salva nulla e non dice perche.
 * Li si passa dal foglio di condivisione, che e anche quello che si vuole
 * fare con un tabellino — mandarlo a qualcuno.
 *
 * Sta qui e non in un componente perche e esattamente cio che il livello di
 * piattaforma deve nascondere (regola 1): chi esporta chiede "consegna questo
 * file", non "sei su Android?".
 */
export async function consegnaFile(blob: Blob, nome: string) {
  if (nativoPresente()) {
    const base64 = await new Promise<string>((ok, ko) => {
      const l = new FileReader();
      // `readAsDataURL` da "data:tipo;base64,XXXX": al ponte serve solo la
      // coda, e passare l'intestazione farebbe scrivere byte sbagliati.
      l.onload = () => ok(String(l.result).split(",")[1] ?? "");
      l.onerror = () => ko(new Error("Non e stato possibile leggere il file."));
      l.readAsDataURL(blob);
    });
    await Nativo.salvaFile({ nome, mime: blob.type || "application/octet-stream", base64 });
    return;
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nome;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Non subito: revocare l'indirizzo prima che il browser abbia cominciato a
  // scaricare annulla il salvataggio, e succede solo su alcuni browser — cioe
  // e il tipo di difetto che non si riproduce su quello di chi sviluppa.
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

export const registraPartita = () => Nativo.registra();
export const scegliVideoNativo = () => Nativo.scegliVideo();
export const annullaCaricamentoNativo = () => Nativo.annullaCaricamento();
export const statoCaricamentoNativo = () => Nativo.statoCaricamento();
export const chiediNotifiche = () => Nativo.chiediNotifiche();
export const osservaCaricamento = (f: (s: StatoCaricamentoNativo) => void) =>
  Nativo.addListener("caricamento", f);

/**
 * Consegna il caricamento al servizio nativo.
 *
 * Due passaggi, e il primo e il motivo per cui questa funzione esiste invece
 * di essere una chiamata sola: **il servizio non riceve la sessione
 * dell'utente**. Riceve un permesso ristretto a questo caricamento e basta.
 * Il rinnovo della sessione e a uso singolo (`auth.service.ts`), quindi il
 * servizio e la scheda web che se lo passassero si scalzerebbero a vicenda —
 * l'utente si troverebbe disconnesso a meta partita.
 */
export async function caricaInSecondoPiano(o: {
  uri: string; uploadId: string; byteTotali: number; chunkBytes: number; titolo?: string;
}) {
  const { token } = await API.post<{ token: string }>(`/uploads/${o.uploadId}/delega`, {});
  return Nativo.carica({
    uri: o.uri,
    uploadId: o.uploadId,
    // Il servizio parla direttamente col server: non passa dal client
    // dell'API, e quindi non eredita ne l'indirizzo ne gli intestazioni.
    base: import.meta.env.VITE_API_URL ?? window.location.origin,
    token,
    titolo: o.titolo,
    byteTotali: o.byteTotali,
    chunkBytes: o.chunkBytes,
  });
}
