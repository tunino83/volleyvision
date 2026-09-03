import { useQuery } from "@tanstack/react-query";
import { API } from "../api/client";
import { Carta, Stato } from "./Ui";

/**
 * Gli eventi dietro una cella del tabellino.
 *
 * Esiste separato dal pannello degli eventi di squadra perche arriva da una
 * rotta diversa — li gli indici li ha gia il client, qui li calcola il server
 * a partire da giocatore e chiave. Il contenuto mostrato e lo stesso, e questo
 * e voluto: chi guarda non deve accorgersi di quale strada ha preso il dato.
 */

const SKILL: Record<string, string> = {
  S: "Battuta", R: "Ricezione", E: "Alzata", A: "Attacco", D: "Difesa",
  B: "Muro", C: "Copertura", F: "Free ball", "0": "Palla a terra", X: "Altro",
};
const ESITO: Record<string, string> = { Point: "Punto", Error: "Errore", Blocked: "Murato" };

export default function EventiGiocatore({ titolo, url, onChiudi }: {
  titolo: string; url: string; onChiudi: () => void;
}) {
  const q = useQuery({ queryKey: ["eventi-giocatore", url], queryFn: () => API.get<any[]>(url) });

  return (
    <Carta style={{ marginTop: 16 }}>
      <div className="riga-sp" style={{ marginBottom: 10 }}>
        <span className="grassetto">{titolo}</span>
        <button className="piccolo" onClick={onChiudi}>Chiudi</button>
      </div>

      <Stato caricamento={q.isLoading} errore={q.error} vuoto={q.data?.length === 0}
             messaggioVuoto="Nessuna azione.">
        <div className="tabella-scorrevole">
          <table>
            <thead>
              <tr><th>Set</th><th>Punteggio</th><th>Fondamentale</th>
                  <th>Esito</th><th>Fotogramma</th></tr>
            </thead>
            <tbody>
              {q.data?.map((e) => (
                <tr key={e.idx}>
                  <td className="numerico">{e.set}</td>
                  <td className="numerico muto">
                    {e.azione ? `${e.azione.hPt}-${e.azione.aPt}` : "—"}
                  </td>
                  <td>{SKILL[e.skill] ?? e.skill}</td>
                  <td className="piccolo">{e.value ? ESITO[e.value] ?? e.value : "—"}</td>
                  <td className="numerico muto">{e.frame}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Stato>

      <p className="piccolo muto" style={{ marginBottom: 0 }}>
        Il numero di fotogramma e cio che permettera, con il video, di saltare
        direttamente all'azione.
      </p>
    </Carta>
  );
}
