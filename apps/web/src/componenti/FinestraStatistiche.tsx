import { useEffect } from "react";
import Statistiche from "../pagine/Statistiche";

/**
 * Le statistiche sopra il dettaglio, senza lasciarlo.
 *
 * Prima erano una pagina a se: aprirle voleva dire navigare, e tornando
 * indietro **il video collegato spariva**. Non e un difetto della
 * navigazione ma la sua natura — il video e un `File` scelto dall'utente,
 * vive nello stato del componente, e nessuna navigazione lo puo conservare.
 * L'unico modo di non perderlo e non andarsene.
 *
 * La pagina resta raggiungibile per indirizzo: chi arriva da un collegamento
 * o da un segnalibro la vede come prima, con il "torna alla partita".
 */
export function FinestraStatistiche({ aperta, onChiudi, id, titolo }: {
  aperta: boolean; onChiudi: () => void; id: string; titolo: string;
}) {
  useEffect(() => {
    if (!aperta) return;
    const tasto = (e: KeyboardEvent) => { if (e.key === "Escape") onChiudi(); };
    window.addEventListener("keydown", tasto);
    // Il documento sotto non deve scorrere: il rotolino serve alla finestra.
    const prima = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", tasto);
      document.body.style.overflow = prima;
    };
  }, [aperta, onChiudi]);

  if (!aperta) return null;

  return (
    <div className="finestra-velo"
         // Il clic sul velo chiude, quello dentro no: si confronta il
         // bersaglio perche l'evento sale comunque dai figli.
         onClick={(e) => { if (e.target === e.currentTarget) onChiudi(); }}>
      <div className="finestra-piena" role="dialog" aria-modal="true" aria-label="Statistiche">
      <div className="finestra-piena-testa">
        <span className="etichetta">{titolo}</span>
        <button className="piccolo" onClick={onChiudi}>Chiudi</button>
      </div>
        <div className="finestra-piena-corpo">
          <Statistiche id={id} inFinestra />
        </div>
      </div>
    </div>
  );
}
