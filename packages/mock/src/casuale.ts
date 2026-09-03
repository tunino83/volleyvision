import { genera, type PartitaGenerata, type Profilo, type Difetti } from "./genera";

/**
 * Partita sintetica sempre diversa, a partire da un seme.
 *
 * Serve al simulatore del fornitore: ogni caricamento deve produrre dati
 * nuovi, altrimenti si collauda sempre lo stesso caso. Il seme rende la cosa
 * riproducibile quando serve indagare un difetto.
 */

/**
 * Nomi di societa verosimili, con la citta dentro come nella realta.
 *
 * Prima erano sigle di nazionali (ITA, FRA...): giuste per un mondiale,
 * fuori luogo per un'applicazione che serve campionati di provincia. E un
 * elenco di partite si legge meglio quando i nomi dicono anche dove.
 *
 * Tutti inventati: mettere societa esistenti nei dati di prova e un guaio
 * gratuito.
 */
const SQUADRE = [
  "Pallavolo Senigallia", "Volley Club Ancona", "Virtus Pesaro",
  "Libertas Fano", "Pallavolo Jesi", "Sport Center Fabriano",
  "Volley Team Macerata", "Pallavolo Civitanova Alta", "Aurora Osimo",
  "Polisportiva Falconara", "Volley Recanati", "Pallavolo San Benedetto",
  "Nuova Pallavolo Urbino", "Volley Camerino", "Atletico Ascoli",
  "Pallavolo Porto Recanati", "Sarnano Volley", "Vis Tolentino",
  "Pallavolo Chiaravalle", "Volley Corridonia",
];

class Caso {
  private s: number;
  constructor(seme: number) { this.s = seme >>> 0 || 1; }
  next() { this.s = (this.s * 1664525 + 1013904223) >>> 0; return this.s / 4294967296; }
  intero(min: number, max: number) { return min + Math.floor(this.next() * (max - min + 1)); }
  scegli<T>(v: T[]): T { return v[this.intero(0, v.length - 1)]; }
  capita(p: number) { return this.next() < p; }
}

/** Un set plausibile: a 25, oppure ai vantaggi, oppure il quinto a 15. */
function parziale(c: Caso, vinceCasa: boolean, quinto = false): [number, number] {
  const soglia = quinto ? 15 : 25;
  if (c.capita(0.18)) {
    // Ai vantaggi: si prosegue finche lo scarto non e di due.
    const extra = c.intero(1, quinto ? 5 : 8);
    const alto = soglia + extra, basso = alto - 2;
    return vinceCasa ? [alto, basso] : [basso, alto];
  }
  const perdente = c.intero(quinto ? 8 : 15, soglia - 2);
  return vinceCasa ? [soglia, perdente] : [perdente, soglia];
}

export interface OpzioniCasuale {
  seme: number;
  /** Sigle da usare al posto di quelle sorteggiate. */
  casa?: string;
  ospite?: string;
}

export function generaCasuale(o: OpzioniCasuale): PartitaGenerata {
  const c = new Caso(o.seme);

  let casa = o.casa ?? c.scegli(SQUADRE);
  let ospite = o.ospite ?? c.scegli(SQUADRE);
  while (ospite === casa) ospite = c.scegli(SQUADRE);

  // Quanti set: tre, quattro o cinque, con le frequenze di una partita vera.
  const r = c.next();
  const setTotali = r < 0.35 ? 3 : r < 0.70 ? 4 : 5;
  const vinceCasa = c.capita(0.5);

  // Chi vince prende tre set, l'altro ne prende setTotali - 3, e **l'ultimo
  // set lo vince chi vince la partita**: altrimenti si otterrebbero partite
  // impossibili, come un 4-0 che sarebbe finito al terzo set.
  // Si mescolano quindi solo i set precedenti all'ultimo.
  const precedenti: boolean[] = [
    ...Array(2).fill(vinceCasa),                    // due delle tre vittorie
    ...Array(setTotali - 3).fill(!vinceCasa),       // tutte quelle dell'altro
  ];
  for (let i = precedenti.length - 1; i > 0; i--) {
    const j = c.intero(0, i);
    [precedenti[i], precedenti[j]] = [precedenti[j], precedenti[i]];
  }
  const esiti = [...precedenti, vinceCasa];

  const parziali = esiti.map((v, i) => parziale(c, v, i === 4));

  /**
   * Profilo di difetti sorteggiato attorno a quanto osservato nei dati reali.
   * Una volta su sei le posizioni mancano del tutto: capita, e l'applicazione
   * deve reggerlo.
   */
  const difetti: Difetti = {
    giocatoriIgnoti: 0.04 + c.next() * 0.20,
    tocchiPersi: 0.08 + c.next() * 0.30,
    confiniSetSbagliati: c.capita(0.55) ? c.intero(1, 5) : 0,
    doppiaMarcatura: 0.02 + c.next() * 0.12,
    posizioniRotte: c.next() * 0.06,
    conPosizioni: !c.capita(0.17),
  };

  const profilo: Profilo = {
    chiave: `simulata-${o.seme}`,
    titolo: `${casa} - ${ospite}`,
    descrizione: "Partita prodotta dal simulatore del fornitore.",
    seme: o.seme, casa, ospite, parziali, difetti,
  };

  return genera(profilo);
}
