import { useState } from "react";
import { consegnaFile } from "../platform/nativo";
import { csv, nomeFile, xlsx, type Colonna } from "../esporta";

/**
 * I due comandi di esportazione, accanto a una tabella.
 *
 * <p>Due formati e non uno, perche rispondono a due bisogni diversi: il CSV
 * si apre ovunque e si rilegge da uno script, l'Excel arriva gia impaginato
 * a chi lo deve solo guardare — intestazione in grassetto, colonne larghe il
 * giusto, prima riga bloccata.
 *
 * <p>Entrambi si generano **nel client**, dai numeri gia calcolati: rifarli
 * sul server vorrebbe dire una seconda implementazione delle stesse metriche.
 */
export default function Esporta<T>({ colonne, righe, nome, foglio, etichetta }: {
  colonne: Colonna<T>[];
  righe: T[];
  /** Base del nome del file: ci si aggiunge la data. */
  nome: string;
  /** Nome del foglio dentro il file Excel. */
  foglio?: string;
  etichetta?: string;
}) {
  const [errore, setErrore] = useState<string | null>(null);

  // Niente da esportare, nessun comando: due pulsanti che producono un file
  // con la sola intestazione sono peggio che assenti.
  if (!righe.length) return null;

  const consegna = async (fare: () => Blob, estensione: string) => {
    setErrore(null);
    try {
      await consegnaFile(fare(), nomeFile(nome, estensione));
    } catch (e: any) {
      setErrore(e?.message ?? "Non e stato possibile salvare il file.");
    }
  };

  return (
    <div className="riga esporta">
      {etichetta && <span className="piccolo muto">{etichetta}</span>}
      <button className="piccolo"
              onClick={() => consegna(
                () => new Blob([csv(colonne, righe)], { type: "text/csv;charset=utf-8" }), "csv")}>
        CSV
      </button>
      <button className="piccolo"
              onClick={() => consegna(() => xlsx(colonne, righe, foglio ?? "Dati"), "xlsx")}>
        Excel
      </button>
      {errore && <span className="piccolo" style={{ color: "var(--pericolo)" }}>{errore}</span>}
    </div>
  );
}
