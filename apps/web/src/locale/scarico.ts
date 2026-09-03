import { API } from "../api/client";
import { piattaforma } from "../platform";
import * as dep from "./deposito";

/**
 * COSA SI PORTA IN LOCALE, E QUANDO.
 *
 * La regola nasce da una misura, non da un'intuizione: le anagrafiche sono
 * ~56 KB e un pacchetto partita 120-180 KB. **Nulla qui e grande.** Far
 * scegliere all'utente fra oggetti da 150 KB sarebbe farlo lavorare per
 * niente, quindi non gli si chiede cosa scaricare: si scarica.
 *
 * L'unica domanda che resta e **se**, e la risposta la da l'installazione:
 *
 *   installata   "questo e il mio dispositivo" -> si prende tutto
 *   in una scheda   potrebbe essere un computer condiviso, una postazione in
 *                   palestra, il portatile di un altro -> solo le anagrafiche
 *                   e cio che si apre, salvo richiesta esplicita
 *
 * Cosi il caso del computer condiviso si protegge **senza fare domande a
 * nessuno**, e chi ha installato non ne vede nemmeno una.
 *
 * Il video non entra mai: e gia sul disco dell'utente, e sono gigabyte.
 */

/** L'utente ha chiesto di tenere tutto anche stando in una scheda. */
const TUTTO_ANCHE_IN_SCHEDA = "vv.locale.tutto";
/** Ha gia risposto alla domanda sulla rete a consumo. */
const CONSENSO_A_CONSUMO = "vv.locale.consumo";

export const vuoleTutto = () => localStorage.getItem(TUTTO_ANCHE_IN_SCHEDA) === "1";
export const impostaVuoleTutto = (v: boolean) =>
  v ? localStorage.setItem(TUTTO_ANCHE_IN_SCHEDA, "1")
    : localStorage.removeItem(TUTTO_ANCHE_IN_SCHEDA);

export interface Esito {
  anagrafiche: boolean;
  /** Partite mai avute prima. E il numero che si dice all'utente. */
  nuove: number;
  /** Gia presenti, ma il fornitore ha rifatto l'analisi. */
  aggiornate: number;
  /** Non si e scaricato: perche. `null` se e andata. */
  fermato: "senza-rete" | "a-consumo" | "non-disponibile" | null;
  byteTotali: number;
}

const vuoto = (fermato: Esito["fermato"] = null): Esito =>
  ({ anagrafiche: false, nuove: 0, aggiornate: 0, fermato, byteTotali: 0 });

/**
 * Porta in locale quel che serve, e riferisce cosa ha fatto.
 *
 * `soloAnagrafiche` e il caso della scheda del browser: le anagrafiche sono
 * 56 KB e servono a far funzionare le schermate senza rete, ma la stagione
 * di qualcuno non si lascia su un computer che non e suo.
 */
export async function sincronizza(opts: { forzaTutto?: boolean } = {}): Promise<Esito> {
  if (!dep.disponibile()) return vuoto("non-disponibile");
  if (!piattaforma.installazione.inRete()) return vuoto("senza-rete");

  // Su rete a consumo paga l'utente: si chiede una volta, e la risposta resta.
  const aConsumo = piattaforma.rete.aConsumo();
  if (aConsumo === true && localStorage.getItem(CONSENSO_A_CONSUMO) !== "1") {
    return vuoto("a-consumo");
  }

  const esito = vuoto();

  // 1. Le anagrafiche: sempre, e sostituendo l'insieme intero.
  for (const [nome, rotta] of Object.entries(dep.COLLEZIONI)) {
    try {
      const dati = await API.get<unknown>(rotta);
      await dep.scriviAnagrafica(nome as dep.Collezione, dati);
      esito.anagrafiche = true;
    } catch {
      // Una collezione che non arriva non deve fermare le altre: meglio una
      // copia parziale che nessuna copia.
    }
  }

  // 2. Le partite. In una scheda del browser ci si ferma qui.
  const tutto = opts.forzaTutto || vuoleTutto()
    || piattaforma.installazione.giaInstallata();
  if (!tutto) return esito;

  let elenco: { elementi: Array<{ id: string; revisioneAnalisi: number | null }> };
  try {
    elenco = await API.get(dep.COLLEZIONI.partite);
  } catch {
    return esito;
  }

  const locali = await dep.revisioniLocali();

  for (const m of elenco.elementi) {
    // Senza analisi non c'e niente da portarsi dietro.
    if (m.revisioneAnalisi == null) continue;
    const avuta = locali.get(m.id);
    if (avuta === m.revisioneAnalisi) continue;      // gia in casa e aggiornata

    try {
      const pacchetto = await API.get<unknown>(`/matches/${m.id}/analysis`);
      const byte = JSON.stringify(pacchetto).length;
      await dep.scriviPartita({
        matchId: m.id, revisione: m.revisioneAnalisi,
        pacchetto, presaIl: Date.now(), byte,
      });
      esito.byteTotali += byte;
      if (avuta === undefined) esito.nuove++; else esito.aggiornate++;
    } catch {
      // Una partita che non arriva non ferma le altre.
    }
  }

  return esito;
}

/** L'utente ha accettato di scaricare anche a consumo. */
export const accettaAConsumo = () => localStorage.setItem(CONSENSO_A_CONSUMO, "1");

/** All'uscita: il deposito e di un utente solo. */
export async function dimenticaTutto() {
  await dep.svuota();
  localStorage.removeItem(TUTTO_ANCHE_IN_SCHEDA);
  localStorage.removeItem(CONSENSO_A_CONSUMO);
}
