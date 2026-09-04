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
  top: "Capigliatura", eyewear: "Occhiali", nose_: "Naso",
};

const eColore = (k: string) => /color$/i.test(k);

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
      .filter((p) => p.valori.length > 1);
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
