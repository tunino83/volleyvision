import { useMemo } from "react";
import * as stili from "@dicebear/collection";

/**
 * I controlli per comporre un avatar a mano.
 *
 * **Costruiti dallo schema della libreria, non scritti a mano.** Ogni stile
 * ha caratteristiche sue — `personas` ha naso e barba, `adventurer` occhiali
 * e sopracciglia — e un elenco nostro invecchierebbe al primo aggiornamento,
 * offrendo scelte che non esistono o nascondendone di nuove. Qui si legge
 * `schema.properties` a runtime: cambiando stile, cambiano i comandi.
 *
 * Le caratteristiche con valori discreti diventano un menu; quelle di colore
 * una fila di pastiglie, perche un codice esadecimale in un menu non dice
 * niente a nessuno.
 */

/** Dal nome dello stile nell'API a quello del pacchetto. */
const MAPPA: Record<string, string> = {
  "adventurer": "adventurer", "personas": "personas", "notionists": "notionists",
  "open-peeps": "openPeeps", "micah": "micah", "avataaars": "avataaars",
  "big-smile": "bigSmile", "lorelei": "lorelei",
};

/** Nomi leggibili: lo schema li da in inglese e in gergo della libreria. */
const ETICHETTE: Record<string, string> = {
  hair: "Capelli", hairColor: "Colore capelli", skinColor: "Incarnato",
  eyes: "Occhi", eyebrows: "Sopracciglia", mouth: "Bocca", nose: "Naso",
  facialHair: "Barba", glasses: "Occhiali", earrings: "Orecchini",
  clothingColor: "Maglia", body: "Corporatura", base: "Viso",
  features: "Tratti", accessories: "Accessori", clothing: "Abbigliamento",
  backgroundColor: "Sfondo", hairAccessories: "Fermagli", beard: "Barba",
  top: "Capigliatura", eyewear: "Occhiali", head: "Testa", shape: "Forma",
  style: "Tipo", face: "Viso", hat: "Cappello", hatColor: "Colore cappello",
  clothesColor: "Colore maglia", accessoriesColor: "Colore accessori",
  clothingGraphic: "Stampa", facialHairColor: "Colore barba",
};

const eColore = (k: string) => /color$/i.test(k);

/**
 * L'ordine in cui si compone una faccia: dal generale al dettaglio.
 *
 * Lo schema della libreria le elenca **in ordine alfabetico**, e cosi gli
 * orecchini finivano prima dei capelli: si sceglieva un dettaglio di una
 * faccia che non esisteva ancora. Si compone come si disegna — prima la
 * forma, poi l'incarnato, poi i capelli, poi i tratti del viso, e in fondo
 * cio che si aggiunge.
 *
 * Chi non e in elenco va in coda: se la libreria introduce una
 * caratteristica nuova deve comparire comunque, in fondo, non sparire.
 */
const ORDINE = [
  // La forma: cosa si sta guardando
  "style", "base", "body", "shape", "head", "face",
  // La pelle
  "skinColor",
  // I capelli
  "hair", "top", "hairColor", "hairAccessories",
  // I tratti del viso, dall'alto in basso
  "eyebrows", "eyes", "nose", "mouth",
  // La barba
  "facialHair", "beard", "facialHairColor",
  // Cio che si indossa
  "glasses", "eyewear", "earrings", "accessories", "accessoriesColor",
  "hat", "hatColor", "features",
  // Il contorno
  "clothing", "clothingGraphic", "clothingColor", "clothesColor",
  "backgroundColor",
];

const posizione = (k: string) => {
  const i = ORDINE.indexOf(k);
  return i === -1 ? ORDINE.length : i;
};

export function AvatarPersonalizza({ stile, opzioni, onCambia }: {
  stile: string | null;
  opzioni: Record<string, string[]>;
  onCambia: (o: Record<string, string[]>) => void;
}) {
  const proprieta = useMemo(() => {
    const chiave = MAPPA[stile ?? "personas"] ?? "personas";
    const s = (stili as any)[chiave]?.schema?.properties as
      Record<string, any> | undefined;
    if (!s) return [];

    return Object.entries(s)
      // Le probabilita sono numeri fra 0 e 100: non sono una scelta ma una
      // manopola, e in una colonna stretta non aggiungono niente.
      .filter(([k, v]) => !/Probability$/.test(k) && v.type === "array")
      .map(([k, v]) => ({
        chiave: k,
        etichetta: ETICHETTE[k] ?? k,
        colore: eColore(k),
        valori: (v.items?.enum ?? v.default ?? []) as string[],
      }))
      .filter((p) => p.valori.length > 1)
      .sort((a, b) => posizione(a.chiave) - posizione(b.chiave)
                      || a.chiave.localeCompare(b.chiave));
  }, [stile]);

  if (!proprieta.length) {
    return <p className="piccolo muto" style={{ margin: 0 }}>
      Questo stile non offre caratteristiche da comporre.
    </p>;
  }

  const imposta = (chiave: string, valore: string | null) => {
    const nuove = { ...opzioni };
    // Togliere la scelta non e lo stesso che scegliere il primo valore:
    // significa "lascia decidere al seme", ed e come sono nate le facce.
    if (valore === null) delete nuove[chiave];
    else nuove[chiave] = [valore];
    onCambia(nuove);
  };

  return (
    <div className="avatar-comporre">
      {proprieta.map((p) => {
        const scelto = opzioni[p.chiave]?.[0] ?? null;
        return (
          <div key={p.chiave} className="avatar-comporre-riga">
            <span className="piccolo muto">{p.etichetta}</span>

            {p.colore ? (
              <div className="avatar-colori">
                {p.valori.map((c) => (
                  <button key={c} type="button"
                          className={`avatar-colore ${scelto === c ? "scelto" : ""}`}
                          style={{ background: `#${c}` }}
                          title={`#${c}`}
                          onClick={() => imposta(p.chiave, scelto === c ? null : c)} />
                ))}
              </div>
            ) : (
              <select value={scelto ?? ""} className="piccolo"
                      onChange={(e) => imposta(p.chiave, e.target.value || null)}>
                {/* Il vuoto e una scelta legittima, non un segnaposto. */}
                <option value="">a caso</option>
                {p.valori.map((v) => <option key={v} value={v}>{v}</option>)}
              </select>
            )}
          </div>
        );
      })}
    </div>
  );
}
