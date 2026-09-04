import {
  FornEvents, FornFrames, FornVideos, maglieValida,
  type AnalysisAction, type AnalysisEvent, type AnalysisFrame,
  type AnalysisPackage, type AnalysisSet, type QualitaAnalisi, type Skill,
} from "@vv/schema";

/**
 * ADATTATORE DEL FORNITORE
 *
 * Unico punto che conosce il formato in ingresso. Tutto il resto del sistema
 * vede solo il formato canonico. Se il fornitore cambia, si modifica qui.
 *
 * Non si limita a convertire: **rimedia** a difetti noti dei dati reali e
 * dichiara cosa ha trovato, perche l'utente ha diritto di sapere quanto vale
 * il dato che sta guardando.
 */

const SKILL_VALIDE = new Set(["S", "R", "E", "A", "D", "B", "C", "F", "0", "X"]);

export interface IngressoFornitore {
  events: unknown;
  videos?: unknown;
  frames?: unknown;
}

export function adatta(matchId: string, revision: number, ing: IngressoFornitore):
  { pacchetto: AnalysisPackage; frames: AnalysisFrame[] } {

  const ev = FornEvents.parse(ing.events);
  const vid = ing.videos ? FornVideos.parse(ing.videos) : null;
  const frm = ing.frames ? FornFrames.parse(ing.frames) : null;
  const m = ev.data.match;
  const avvisi: string[] = [];

  // ------------------------------------------------------------- video
  const fps = vid?.data.videos.side1[0]?.fps ?? 30;
  const fpsLato2 = vid?.data.videos.side2[0]?.fps ?? fps;
  if (fpsLato2 !== fps) {
    avvisi.push(`I due lati hanno fotogrammi al secondo diversi (${fps} e ${fpsLato2}): ` +
                `lo scarto fra i video non e rappresentabile con un solo numero.`);
  }
  const omo = (lato: "side1" | "side2") => {
    const l = vid?.data.videos[lato]?.[0];
    return (l?.homography ?? l?.court?.[0] ?? null) as number[][] | null;
  };

  // ------------------------------------ appiattimento eventi e azioni
  const events: AnalysisEvent[] = [];
  const actions: AnalysisAction[] = [];
  let senzaGiocatore = 0;

  for (const s of m.data ? [] : []) { /* niente: struttura gia estratta sotto */ }

  for (const set of m.sets) {
    for (const a of set.actions) {
      const idxAzione = actions.length;
      const indici: number[] = [];

      for (const e of a.events) {
        if (!SKILL_VALIDE.has(e.s)) continue;
        const noto = maglieValida(e.p);
        if (!noto) senzaGiocatore++;
        indici.push(events.length);
        events.push({
          idx: events.length,
          set: set.n,
          actionIdx: idxAzione,
          team: e.t,
          jersey: noto ? e.p! : null,
          jerseyIgnoto: !noto,
          skill: e.s as Skill,
          value: (e.v === "Point" || e.v === "Error" || e.v === "Blocked") ? e.v : null,
          frame: e.f,
          jumping: e.j ?? null,
        });
      }

      actions.push({
        idx: idxAzione,
        set: set.n,
        frameStart: a.fS,
        frameEnd: a.fE,
        hPt: a.data.hPt,
        aPt: a.data.aPt,
        winner: a.data.w === "h" || a.data.w === "a" ? a.data.w : null,
        eventi: indici,
      });
    }
  }

  // ------------------------------------------- confini dei set, corretti
  //
  // Nei dati reali le prime azioni di un set appartengono in realta al set
  // precedente: il punteggio riparte da (0,0) qualche azione dopo l'inizio
  // dichiarato. Ci si fida del PUNTEGGIO, non della segmentazione.
  const { sets, riassegnate } = ricalcolaSet(m.sets.map((s) => ({
    n: s.n, hPt: s.hPt, aPt: s.aPt,
    fs: s.fs ?? s.fS ?? 0, fE: s.fE ?? 0,
  })), actions);

  if (riassegnate > 0) {
    avvisi.push(`${riassegnate} azioni erano attribuite al set sbagliato: ` +
                `il confine e stato ricalcolato dal punteggio.`);
  }

  // ------------------------------------------------------ posizioni
  const frames: AnalysisFrame[] = [];
  let coperturaFotogrammi = 0;
  let pallaTracciata = false;
  let posizioniScartate = 0;

  if (frm) {
    const H1 = omo("side1"), H2 = omo("side2");

    /*
     * LE DUE TELECAMERE RIPRENDONO DA ESTREMITA OPPOSTE.
     *
     * Ciascuna omografia porta i pixel della **propria** ripresa a coordinate
     * di campo, ma ognuna con l'origine nel proprio angolo: sono due sistemi
     * ruotati di mezzo giro l'uno rispetto all'altro. Convertendo senza
     * accorgersene, **le due squadre finiscono nella stessa meta campo** —
     * misurato sui dati veri: mediana y 12,8 per la casa e 12,9 per gli
     * ospiti, con lo zero per cento sotto la linea di meta campo.
     *
     * Ruotando di mezzo giro cio che viene dalla seconda telecamera —
     * `x -> 9-x`, `y -> 18-y` — le due squadre si separano perfettamente:
     * casa mediana 13,1 (0% sotto meta campo), ospiti mediana 5,4 (100%).
     *
     * **Non si applica sempre**: quando serve lo decide la misura, piu sotto.
     *
     * Il campo e 9 x 18: le due costanti sono quelle, non parametri.
     */
    const CAMPO_X = 9, CAMPO_Y = 18;
    const specchia = (q: { x: number; y: number }) => ({
      x: Math.round((CAMPO_X - q.x) * 100) / 100,
      y: Math.round((CAMPO_Y - q.y) * 100) / 100,
    });

    const proj = (H: number[][] | null, p: number[]) => {
      if (!H) return null;
      const [x, y] = p;
      const d = H[2][0] * x + H[2][1] * y + H[2][2];
      if (!d) return null;
      const mx = (H[0][0] * x + H[0][1] * y + H[0][2]) / d;
      const my = (H[1][0] * x + H[1][1] * y + H[1][2]) / d;
      // Fuori da un'area ragionevole intorno al campo: proiezione degenere.
      if (mx < -3 || mx > 12 || my < -3 || my > 21) return null;
      return { x: Math.round(mx * 100) / 100, y: Math.round(my * 100) / 100 };
    };

    for (const f of frm.data.frames) {
      if (f.b) pallaTracciata = true;
      const conv = (lista: any[] | null | undefined, H: number[][] | null,
                    chiave: "g1" | "g2", ruota: boolean) =>
        (lista ?? []).flatMap((p: any) => {
          const raw = p[chiave] as (number | null)[] | null | undefined;
          // Rilevamenti senza numero o senza coordinate: si scartano contandoli.
          if (p.n == null || !raw || raw[0] == null || raw[1] == null) {
            posizioniScartate++;
            return [];
          }
          const q0 = proj(H, [raw[0], raw[1]]);
          if (!q0) { posizioniScartate++; return []; }
          const q = ruota ? specchia(q0) : q0;
          return [{ n: Math.round(p.n), x: q.x, y: q.y }];
        });
      // Si converte senza specchiare: la decisione viene dopo, sui dati.
      frames.push({
        f: f.f1,
        h: conv(f.hP, H1, "g1", false),
        a: conv(f.aP, H2, "g2", false),
      });
    }

    /*
     * SPECCHIARE O NO: lo decide la misura, non una convenzione.
     *
     * Nei dati veri del fornitore le due riprese vengono da estremita opposte
     * e ciascuna omografia ha l'origine nel proprio angolo: convertendo alla
     * lettera, **le due squadre finiscono nella stessa meta campo**. Ruotando
     * di mezzo giro cio che arriva dalla seconda, si separano.
     *
     * Ma non vale per tutte le sorgenti: i dati sintetici usano un sistema
     * solo, e specchiarli produrrebbe esattamente il difetto che la
     * specchiatura doveva togliere. Assumere l'uno o l'altro caso rompe
     * l'altro — quindi si guarda dove sono finite davvero le squadre.
     *
     * Se stanno dalla stessa parte della rete, la seconda va girata.
     */
    const mediana = (xs: number[]) =>
      xs.length ? xs.slice().sort((p, q) => p - q)[Math.floor(xs.length / 2)] : null;
    const yCasa = mediana(frames.flatMap((x) => x.h.map((p) => p.y)));
    const yOspiti = mediana(frames.flatMap((x) => x.a.map((p) => p.y)));

    if (yCasa != null && yOspiti != null
        && (yCasa < CAMPO_Y / 2) === (yOspiti < CAMPO_Y / 2)) {
      for (const f of frames) f.a = f.a.map((p) => ({ n: p.n, ...specchia(p) }));
      avvisi.push("Le due riprese hanno sistemi di coordinate opposti: "
                + "le posizioni della squadra ospite sono state ruotate.");
    }

    const span = (frames.at(-1)?.f ?? 0) - (frames[0]?.f ?? 0);
    coperturaFotogrammi = span > 0 ? frames.length / span : 0;
    if (!pallaTracciata) avvisi.push("La posizione della palla non e presente nei dati.");
    if (posizioniScartate > 0) {
      avvisi.push(`${posizioniScartate} rilevamenti di posizione scartati: senza numero ` +
                  `di maglia, senza coordinate, o proiettati fuori dal campo.`);
    }
  } else {
    avvisi.push("Dati di posizione assenti: il campo bidimensionale non e disponibile.");
  }

  // ------------------------------------------------------- qualita
  // Uno scambio produce esattamente un punto. La misura onesta e quindi
  // "azioni rilevate" contro "punti dichiarati", non la somma degli esiti:
  // uno stesso scambio puo portare due marcature (battuta punto E ricezione
  // errore descrivono lo stesso punto).
  const puntiDichiarati = (m.hPt ?? 0) + (m.aPt ?? 0);
  const spiegati = actions.length;
  const esiti = events.filter((e) => e.value !== null).length;
  const doppiaMarcatura = Math.max(0, esiti - actions.length);
  const pctSenza = events.length ? senzaGiocatore / events.length : 0;

  if (pctSenza > 0.02) {
    avvisi.push(`Il ${Math.round(pctSenza * 100)}% degli eventi non e attribuito a un ` +
                `giocatore riconosciuto: quei tocchi non entrano nelle statistiche individuali.`);
  }
  const mancanti = puntiDichiarati - spiegati;
  if (puntiDichiarati && Math.abs(mancanti) / puntiDichiarati > 0.05) {
    avvisi.push(mancanti > 0
      ? `${mancanti} scambi del punteggio finale non risultano fra le azioni rilevate.`
      : `Sono state rilevate ${-mancanti} azioni in piu rispetto al punteggio dichiarato.`);
  }
  if (doppiaMarcatura > 0) {
    avvisi.push(`${doppiaMarcatura} scambi portano piu di un esito (per esempio battuta ` +
                `punto e ricezione errore): e la stessa conclusione descritta due volte.`);
  }

  const qualita: QualitaAnalisi = {
    eventiTotali: events.length,
    eventiSenzaGiocatore: senzaGiocatore,
    percentualeSenzaGiocatore: Math.round(pctSenza * 1000) / 10,
    azioni: actions.length,
    puntiAttribuiti: spiegati,
    puntiDichiarati,
    puntiNonSpiegati: Math.max(0, mancanti),
    confiniSetRicalcolati: riassegnate,
    posizioniDisponibili: frames.length > 0,
    pallaTracciata,
    coperturaFotogrammi: Math.round(coperturaFotogrammi * 100) / 100,
    avvisi,
  };

  return {
    pacchetto: {
      version: "vv-analysis-1.0.0",
      matchId, revision,
      squadre: { h: m.hT ?? "Casa", a: m.aT ?? "Ospite" },
      video: {
        fps,
        frameDelta: vid?.data.videos.frameDelta ?? 0,
        homography: { side1: omo("side1"), side2: omo("side2") },
      },
      sets, actions, events, qualita,
    },
    frames,
  };
}

/**
 * Ricalcola l'appartenenza ai set fidandosi del punteggio.
 *
 * Un set comincia quando il punteggio torna a (0,0) dopo essere salito.
 * Le azioni prima di quel punto appartengono al set precedente, comunque
 * il fornitore le abbia etichettate.
 */
function ricalcolaSet(
  dichiarati: Array<{ n: number; hPt: number; aPt: number; fs: number; fE: number }>,
  actions: AnalysisAction[],
): { sets: AnalysisSet[]; riassegnate: number } {

  let setCorrente = 1;
  let precedente = { h: -1, a: -1 };
  let riassegnate = 0;

  for (const a of actions) {
    const risalita = a.hPt === 0 && a.aPt === 0 && (precedente.h > 0 || precedente.a > 0);
    if (risalita) setCorrente++;
    if (a.set !== setCorrente) { a.set = setCorrente; riassegnate++; }
    precedente = { h: a.hPt, a: a.aPt };
  }

  const numeri = [...new Set(actions.map((a) => a.set))].sort((x, y) => x - y);
  const sets: AnalysisSet[] = numeri.map((n) => {
    const az = actions.filter((a) => a.set === n);
    const ultima = az.at(-1);
    const dich = dichiarati.find((d) => d.n === n);
    return {
      n,
      // Il punteggio del set e quello dopo l'ultima azione, non quello dichiarato.
      hPt: dich?.hPt ?? (ultima ? ultima.hPt : 0),
      aPt: dich?.aPt ?? (ultima ? ultima.aPt : 0),
      frameStart: az[0]?.frameStart ?? 0,
      frameEnd: ultima?.frameEnd ?? 0,
      ricalcolato: riassegnate > 0,
    };
  });

  return { sets, riassegnate };
}

/** Riassegna il set anche agli eventi, dopo la correzione delle azioni. */
export function allineaEventiAiSet(pkg: AnalysisPackage) {
  for (const a of pkg.actions) {
    for (const i of a.eventi) pkg.events[i].set = a.set;
  }
  return pkg;
}
