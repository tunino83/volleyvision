/**
 * Generatore di partite sintetiche nel FORMATO DEL FORNITORE.
 *
 * Genera `events-1.0.0`, `frames-1.0.0` e `videos-1.0.0` cosi come arrivano
 * davvero, difetti compresi. Serve a collaudare l'intera catena — adattatore,
 * acquisizione, metriche, schermate — senza dipendere dal fornitore.
 *
 * Il modello dei difetti non e inventato: riproduce quelli osservati nei primi
 * dati reali (vedi `docs/07-dati-fornitore.md`). Costruire l'applicazione su
 * dati perfetti significherebbe costruire l'applicazione sbagliata.
 *
 * Deterministico: stesso seme, stessi file. I test devono poter riprodurre.
 */

// --------------------------------------------------- casualita riproducibile
class Caso {
  private s: number;
  constructor(seme: number) { this.s = seme >>> 0 || 1; }
  /** Generatore congruenziale lineare: sufficiente, e riproducibile ovunque. */
  next() { this.s = (this.s * 1664525 + 1013904223) >>> 0; return this.s / 4294967296; }
  intero(min: number, max: number) { return min + Math.floor(this.next() * (max - min + 1)); }
  scegli<T>(v: T[]): T { return v[this.intero(0, v.length - 1)]; }
  capita(p: number) { return this.next() < p; }
}

// ------------------------------------------------------------------ profili
export interface Difetti {
  /** Quota di eventi con giocatore non riconosciuto (segnaposto o nullo). */
  giocatoriIgnoti: number;
  /** Quota di tocchi che la visione non rileva affatto. */
  tocchiPersi: number;
  /** Azioni della coda di un set attribuite al set successivo. */
  confiniSetSbagliati: number;
  /** Quota di scambi con doppia marcatura dell'esito. */
  doppiaMarcatura: number;
  /** Quota di rilevamenti di posizione inutilizzabili. */
  posizioniRotte: number;
  /** Se falso, il file delle posizioni non viene prodotto. */
  conPosizioni: boolean;
}

export interface Profilo {
  chiave: string;
  titolo: string;
  descrizione: string;
  seme: number;
  casa: string;
  ospite: string;
  /** Punteggi voluti, set per set. L'ultimo puo essere al quinto. */
  parziali: Array<[number, number]>;
  difetti: Difetti;
}

const PULITO: Difetti = {
  giocatoriIgnoti: 0.01, tocchiPersi: 0.02, confiniSetSbagliati: 0,
  doppiaMarcatura: 0.02, posizioniRotte: 0.01, conPosizioni: true,
};

export const PROFILI: Profilo[] = [
  {
    chiave: "pulita",
    titolo: "Partita pulita",
    descrizione: "Tre set, quasi nessun difetto. E il riferimento: se qualcosa " +
                 "non torna qui, il problema e nostro, non del dato.",
    seme: 1001, casa: "ITA", ospite: "FRA",
    parziali: [[25, 20], [23, 25], [25, 22]],
    difetti: PULITO,
  },
  {
    chiave: "realistica",
    titolo: "Difetti come nei dati reali",
    descrizione: "Riproduce il profilo osservato nella partita vera: 15% di " +
                 "eventi senza giocatore, confini dei set sbagliati, doppie marcature.",
    seme: 1002, casa: "POL", ospite: "BRA",
    parziali: [[22, 25], [25, 19], [25, 23]],
    difetti: { giocatoriIgnoti: 0.15, tocchiPersi: 0.25, confiniSetSbagliati: 4,
               doppiaMarcatura: 0.10, posizioniRotte: 0.02, conPosizioni: true },
  },
  {
    chiave: "cinque-set",
    titolo: "Cinque set con tie-break",
    descrizione: "Partita lunga fino al quinto set, che si gioca a 15 punti. " +
                 "Verifica che il conteggio dei set non presuma il 25.",
    seme: 1003, casa: "USA", ospite: "SLO",
    parziali: [[25, 23], [19, 25], [25, 21], [21, 25], [15, 13]],
    difetti: { ...PULITO, giocatoriIgnoti: 0.06, tocchiPersi: 0.10, confiniSetSbagliati: 2 },
  },
  {
    chiave: "degradata",
    titolo: "Analisi degradata",
    descrizione: "Rilevamento scarso e nessuna posizione: il campo bidimensionale " +
                 "non e disponibile. Verifica che l'applicazione degradi con garbo.",
    seme: 1004, casa: "ARG", ospite: "NED",
    parziali: [[25, 18], [25, 27], [20, 25], [25, 23], [12, 15]],
    difetti: { giocatoriIgnoti: 0.35, tocchiPersi: 0.45, confiniSetSbagliati: 6,
               doppiaMarcatura: 0.15, posizioniRotte: 0, conPosizioni: false },
  },
  {
    chiave: "limiti",
    titolo: "Casi limite",
    descrizione: "Set ai vantaggi prolungati, giocatore con il numero 0, scambi " +
                 "senza alcun tocco rilevato, un set decisamente corto.",
    seme: 1005, casa: "SRB", ospite: "JPN",
    parziali: [[32, 30], [25, 15], [34, 36]],
    difetti: { giocatoriIgnoti: 0.08, tocchiPersi: 0.30, confiniSetSbagliati: 1,
               doppiaMarcatura: 0.05, posizioniRotte: 0.06, conPosizioni: true },
  },
];

// ------------------------------------------------------------- omografia
/** Presa dai dati reali: cosi le posizioni generate si proiettano davvero. */
const H_LATO1 = [
  [0.012190151170421222, 0.004012500564145805, -5.944737656464844],
  [0.0001824755159441848, 0.06867161916699532, -32.953922501252336],
  [6.686064603495296e-6, 0.0010884333462662535, 1.0],
];
const H_LATO2 = [
  [0.011789848094278643, 0.005646716718838725, -7.96087774424939],
  [0.00046211128979452276, 0.06689060919775702, -31.246579082036185],
  [1.4297405336710569e-5, 0.0010721667347580405, 1.0],
];

/** Inverte una 3x3: serve per generare in metri ed emettere in pixel. */
function inversa(m: number[][]): number[][] {
  const [[a, b, c], [d, e, f], [g, h, i]] = m;
  const A = e * i - f * h, B = -(d * i - f * g), C = d * h - e * g;
  const det = a * A + b * B + c * C;
  return [
    [A / det, -(b * i - c * h) / det, (b * f - c * e) / det],
    [B / det, (a * i - c * g) / det, -(a * f - c * d) / det],
    [C / det, -(a * h - b * g) / det, (a * e - b * d) / det],
  ];
}
function applica(m: number[][], x: number, y: number): [number, number] {
  const w = m[2][0] * x + m[2][1] * y + m[2][2];
  return [(m[0][0] * x + m[0][1] * y + m[0][2]) / w,
          (m[1][0] * x + m[1][1] * y + m[1][2]) / w];
}

// ------------------------------------------------------- struttura squadra
const NUMERI = [1, 2, 4, 5, 6, 7, 8, 9, 10, 11, 12, 14, 16, 17, 18];
const SEGNAPOSTO = [100, 1000, 1001, 1002, -6];

/** Le sei posizioni regolamentari, in metri, per meta campo. */
const POSTI: Array<[number, number]> = [
  [6.5, 6.0], [4.5, 3.0], [2.5, 6.0],   // 4, 3, 2 — prima linea
  [6.5, 2.0], [4.5, 7.5], [2.5, 2.0],   // 5, 6, 1 — seconda linea
];

export interface PartitaGenerata {
  profilo: Profilo;
  events: unknown;
  frames: unknown | null;
  videos: unknown;
  /** Cosa ci si aspetta di leggere dopo l'adattamento: base per le asserzioni. */
  atteso: {
    set: number;
    azioni: number;
    puntiTotali: number;
    parziali: Array<[number, number]>;
    posizioniDisponibili: boolean;
  };
}

export function genera(p: Profilo): PartitaGenerata {
  const c = new Caso(p.seme);
  const fps = 30;

  const rosa = (base: number) => {
    const n = [...NUMERI].sort(() => c.next() - 0.5).slice(0, 12);
    if (p.chiave === "limiti" && base === 0) n[0] = 0;   // numero di maglia 0
    return n;
  };
  const rosaCasa = rosa(0), rosaOspite = rosa(1);

  let frame = c.intero(2000, 5000);
  const setJson: any[] = [];
  const frames: any[] = [];
  let azioniTotali = 0;

  for (let is = 0; is < p.parziali.length; is++) {
    const [ptCasa, ptOspite] = p.parziali[is];
    const inizioSet = frame;
    const azioni: any[] = [];

    // Sequenza di vincitori che porta esattamente al punteggio voluto.
    const esiti = sequenzaEsiti(c, ptCasa, ptOspite);
    let h = 0, a = 0;
    let alServizio: "h" | "a" = is % 2 === 0 ? "h" : "a";

    for (const vincitore of esiti) {
      const inizio = frame;
      const eventi = generaScambio(c, p.difetti, alServizio, vincitore, rosaCasa, rosaOspite, frame, fps);
      frame = (eventi.at(-1)?.f ?? frame) + c.intero(20, 60);
      const fine = frame;

      azioni.push({
        id: null, type: "play", fS: inizio, fE: fine,
        data: {
          hPt: h, aPt: a, hS: null, aS: null, hSP: null, aSP: null,
          hL1: rosaCasa[8], hL2: null, aL1: rosaOspite[8], aL2: null,
          hP: rosaCasa.slice(0, 6), oP: rosaOspite.slice(0, 6),
          custom: null, w: vincitore, s0: alServizio,
          ptMax: Math.max(h, a), ptMin: Math.min(h, a),
          hPR1: null, aPR1: null, hPR2: null, aPR2: null,
          isATO: null, isAVC: null, isAS: null,
        },
        events: eventi,
      });
      azioniTotali++;

      if (p.difetti.conPosizioni) {
        frames.push(...generaPosizioni(c, p.difetti, inizio, fine, rosaCasa, rosaOspite));
      }

      if (vincitore === "h") h++; else a++;
      alServizio = vincitore;
      frame += c.intero(300, 1400);   // pausa fra gli scambi
    }

    setJson.push({
      id: null, n: is + 1,
      hP: rosaCasa, aP: rosaOspite,
      custom: {}, hSide: "left", aSide: "right",
      hPt: ptCasa, aPt: ptOspite,
      w: ptCasa > ptOspite ? "h" : "a",
      s0: is % 2 === 0 ? "h" : "a",
      fs: inizioSet, fE: frame,
      actions: azioni,
    });
    frame += c.intero(3000, 9000);    // intervallo fra i set
  }

  // Difetto voluto: sposta la coda di un set all'inizio del successivo.
  // E il difetto piu insidioso osservato nei dati reali, e l'adattatore
  // deve accorgersene guardando il punteggio.
  for (let i = 0; i < setJson.length - 1 && p.difetti.confiniSetSbagliati > 0; i++) {
    const quante = Math.min(p.difetti.confiniSetSbagliati, setJson[i].actions.length - 1);
    const coda = setJson[i].actions.splice(-quante, quante);
    setJson[i + 1].actions.unshift(...coda);
  }

  const vinti = p.parziali.reduce((acc, [x, y]) => {
    if (x > y) acc[0]++; else acc[1]++; return acc;
  }, [0, 0]);

  const events = {
    version: "events-1.0.0",
    data: {
      match: {
        id: null, vId: null, cId: null,
        hRef: "left", aRef: "right",
        hT: p.casa, aT: p.ospite,
        d: "2026-11-14 20:30:00",
        hWS: vinti[0], aWS: vinti[1],
        referee: "Referee", city: "City", court: "Court",
        scoutman: "Volley Vision SRL",
        competition: "Serie di prova", season: "2026",
        hP: rosaCasa, aP: rosaOspite,
        hCoach: "Coach", aCoach: "Coach",
        custom: null,
        fS: setJson[0].fs, fE: frame,
        wT: vinti[0] > vinti[1] ? "h" : "a", wTref: null,
        hPartials: p.parziali.map((x) => x[0]),
        aPartials: p.parziali.map((x) => x[1]),
        hPt: p.parziali.reduce((s, x) => s + x[0], 0),
        aPt: p.parziali.reduce((s, x) => s + x[1], 0),
        sets: setJson,
      },
    },
  };

  const videos = {
    version: "videos-1.0.0",
    data: {
      videos: {
        id: null,
        side1: [{ path: null, fps, court: [H_LATO1], homography: H_LATO1 }],
        side2: [{ path: null, fps, court: [H_LATO2], homography: H_LATO2 }],
        frameDelta: 0,
      },
    },
  };

  return {
    profilo: p,
    events,
    videos,
    frames: p.difetti.conPosizioni
      ? { version: "frames-1.0.0", data: { mId: null, frames } }
      : null,
    atteso: {
      set: p.parziali.length,
      azioni: azioniTotali,
      puntiTotali: p.parziali.reduce((s, x) => s + x[0] + x[1], 0),
      parziali: p.parziali,
      posizioniDisponibili: p.difetti.conPosizioni,
    },
  };
}

/** Ordine dei punti che porta esattamente al punteggio voluto. */
function sequenzaEsiti(c: Caso, ptCasa: number, ptOspite: number): Array<"h" | "a"> {
  const v: Array<"h" | "a"> = [
    ...Array(ptCasa).fill("h" as const),
    ...Array(ptOspite).fill("a" as const),
  ];
  // Mescola, ma l'ultimo punto deve essere di chi vince il set.
  const vincitore: "h" | "a" = ptCasa > ptOspite ? "h" : "a";
  const i = v.lastIndexOf(vincitore);
  v.splice(i, 1);
  for (let k = v.length - 1; k > 0; k--) {
    const j = c.intero(0, k);
    [v[k], v[j]] = [v[j], v[k]];
  }
  v.push(vincitore);
  return v;
}

/**
 * Uno scambio: battuta, ricezione, alzata, attacco, e poi difesa e
 * contrattacco finche qualcuno chiude. Con i difetti applicati.
 */
function generaScambio(
  c: Caso, d: Difetti, alServizio: "h" | "a", vincitore: "h" | "a",
  rosaCasa: number[], rosaOspite: number[], frameIniziale: number, fps: number,
) {
  const eventi: any[] = [];
  let f = frameIniziale;
  const rosa = (t: "h" | "a") => (t === "h" ? rosaCasa : rosaOspite);
  const altro = (t: "h" | "a"): "h" | "a" => (t === "h" ? "a" : "h");

  const agg = (t: "h" | "a", s: string, v: string | null, salto = false) => {
    // Tocco perso dalla visione: semplicemente non compare.
    if (v === null && c.capita(d.tocchiPersi)) { f += c.intero(8, 30); return; }
    let p: number | null = c.scegli(rosa(t));
    if (c.capita(d.giocatoriIgnoti)) {
      p = c.capita(0.3) ? null : c.scegli(SEGNAPOSTO);
    }
    eventi.push({
      id: null, t, p, pId: null, s, st: null, v, c: null,
      posS: null, posE: null, f, speed: null, custom: null, prev: null,
      isAtk: null, isCtk: null, atkRec: null, atkSet: null, j: salto,
    });
    f += c.intero(8, 40);
  };

  const ricevente = altro(alServizio);

  // Come si chiude lo scambio. Le quote seguono la pallavolo vera: la maggior
  // parte dei punti nasce da un attacco vincente, non da un errore avversario.
  //   attacco punto 62% · errore d'attacco 20% · muro 10% · ace o errore in battuta 8%
  const chiusura = (() => {
    const r = c.next();
    if (r < 0.08) return "battuta";
    if (r < 0.18) return "muro";
    if (r < 0.38) return "errore";
    return "attacco";
  })();

  if (chiusura === "battuta") {
    const ace = vincitore === alServizio;
    agg(alServizio, "S", ace ? "Point" : "Error", true);
    if (ace && c.capita(d.doppiaMarcatura)) agg(ricevente, "R", "Error");
    if (c.capita(0.7)) agg(vincitore, "0", null);
    return eventi;
  }

  agg(alServizio, "S", null, true);
  agg(ricevente, "R", null);

  // Chi chiude lo scambio dipende dalla chiusura scelta: se l'attacco e
  // vincente attacca il vincitore, se e errore o muro attacca chi perde.
  const chiudeAttaccando: "h" | "a" = chiusura === "attacco" ? vincitore : altro(vincitore);

  // Numero di attacchi prima della chiusura. Il possesso si alterna, quindi
  // si sceglie una lunghezza che faccia attaccare per ultimo chi deve.
  let attacca = ricevente;
  let scambi = c.capita(0.55) ? 1 : c.intero(2, 4);
  const parita = (n: number) => (n % 2 === 0 ? ricevente : altro(ricevente));
  if (parita(scambi - 1) !== chiudeAttaccando) scambi++;

  for (let i = 0; i < scambi; i++) {
    agg(attacca, "E", null);
    const ultimo = i === scambi - 1;
    if (ultimo) {
      if (chiusura === "attacco") {
        agg(attacca, "A", "Point", true);
        if (c.capita(d.doppiaMarcatura)) agg(altro(attacca), "D", "Error");
      } else if (chiusura === "muro") {
        agg(attacca, "A", "Blocked", true);
        agg(altro(attacca), "B", "Point", true);
      } else {
        agg(attacca, "A", "Error", true);
      }
    } else {
      agg(attacca, "A", null, true);
      agg(altro(attacca), "D", null);
      if (c.capita(0.18)) agg(altro(attacca), "B", null, true);
      attacca = altro(attacca);
    }
  }
  if (c.capita(0.7)) agg(vincitore, "0", null);
  return eventi;
}

/** Posizioni durante uno scambio: una raffica continua, come nei dati reali. */
function generaPosizioni(
  c: Caso, d: Difetti, da: number, a: number, rosaCasa: number[], rosaOspite: number[],
) {
  const inv1 = inversa(H_LATO1), inv2 = inversa(H_LATO2);
  const out: any[] = [];
  const passo = 2;   // un fotogramma ogni due: raffica fitta ma non enorme

  /*
   * I giocatori si SPOSTANO, non sfarfallano.
   *
   * Prima lo scostamento dal posto in campo si ridisegnava a caso a ogni
   * fotogramma: indipendente dal precedente, fino a 1,6 m di salto in un
   * quindicesimo di secondo. Sul campo bidimensionale si vedeva quello che
   * era davvero — rumore, non movimento: velocita mediana 12 m/s, con punte
   * di 20, contro i 2-5 m/s di un pallavolista vero.
   *
   * Ora lo scostamento **persiste** fra un fotogramma e l'altro e cambia di
   * poco: un vagabondaggio lento, trattenuto entro un raggio. E la differenza
   * fra un giocatore che si muove e uno che si teletrasporta.
   */
  const PASSO_M = 0.11;    // quanto si sposta al massimo fra due rilevamenti
  const RAGGIO_M = 1.0;    // quanto puo allontanarsi dal proprio posto
  const scostamenti = new Map<string, { dx: number; dy: number }>();

  const scostamento = (chiave: string) => {
    const v = scostamenti.get(chiave) ?? { dx: 0, dy: 0 };
    const stretto = (n: number) => Math.max(-RAGGIO_M, Math.min(RAGGIO_M, n));
    const nuovo = {
      dx: stretto(v.dx + (c.next() - 0.5) * 2 * PASSO_M),
      dy: stretto(v.dy + (c.next() - 0.5) * 2 * PASSO_M),
    };
    scostamenti.set(chiave, nuovo);
    return nuovo;
  };

  for (let f = da; f <= a; f += passo) {
    const lato = (rosa: number[], inv: number[][], chiave: "g1" | "g2", offsetY: number) =>
      rosa.slice(0, 6).map((n, i) => {
        if (c.capita(d.posizioniRotte)) {
          // Rilevamento inutilizzabile: senza numero o senza coordinate.
          return c.capita(0.5)
            ? { n: null, g1: null, g2: null }
            : { n, [chiave]: [null, null], [chiave === "g1" ? "g2" : "g1"]: null };
        }
        const [mx, my] = POSTI[i];
        const d2 = scostamento(`${chiave}:${n}`);
        const [px, py] = applica(inv, mx + d2.dx, my + offsetY + d2.dy);
        return {
          n, g1: chiave === "g1" ? [Math.round(px), Math.round(py)] : null,
          g2: chiave === "g2" ? [Math.round(px), Math.round(py)] : null,
        };
      });

    out.push({
      f1: f, b: null,
      hP: lato(rosaCasa, inv1, "g1", 0),
      aP: lato(rosaOspite, inv2, "g2", 9),
    });
  }
  return out;
}
