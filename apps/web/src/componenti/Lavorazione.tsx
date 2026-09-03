import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { API } from "../api/client";

/**
 * Stato dell'elaborazione presso il fornitore dell'analisi.
 *
 * Il pulsante di accelerazione compare SOLO quando il server dichiara
 * `accelerabile`, cosa che fa unicamente con il simulatore attivo
 * (`FORNITORE_ANALISI=simulato`). Col fornitore vero il campo e falso e il
 * pulsante non esiste: non c'e nulla da nascondere lato interfaccia.
 *
 * Vedi ../../docs/09-simulatore-fornitore.md
 */

interface StatoLavorazione {
  fornitore: string;
  stato: "in_corso" | "conclusa" | "fallita";
  attesoPer: string | null;
  avviataIl: string;
  conclusaIl: string | null;
  messaggio: string | null;
  accelerabile: boolean;
}

export default function Lavorazione({ matchId, statoPartita }:
  { matchId: string; statoPartita: string }) {

  const qc = useQueryClient();
  const inLavorazione = ["PENDING", "RUNNING", "READY_FOR_PP"].includes(statoPartita);

  const q = useQuery({
    queryKey: ["lavorazione", matchId],
    queryFn: () => API.get<StatoLavorazione | null>(`/matches/${matchId}/processing`),
    refetchInterval: inLavorazione ? 10_000 : false,
  });

  const accelera = useMutation({
    mutationFn: () => API.post(`/matches/${matchId}/processing/accelerate`, {}),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["partita", matchId] });
      await qc.invalidateQueries({ queryKey: ["lavorazione", matchId] });
      await qc.invalidateQueries({ queryKey: ["notifiche"] });
    },
  });

  const l = q.data;
  if (!l) return null;

  const attesa = l.attesoPer ? new Date(l.attesoPer) : null;
  const mancano = attesa ? Math.max(0, Math.round((attesa.getTime() - Date.now()) / 1000)) : null;

  return (
    <>
      {l.stato === "in_corso" && attesa && (
        <p className="piccolo muto" style={{ margin: "8px 0 0" }}>
          Elaborazione affidata al fornitore
          {mancano !== null && mancano > 0
            ? `, esito atteso fra circa ${mancano >= 60 ? `${Math.ceil(mancano / 60)} minuti` : `${mancano} secondi`}.`
            : ", esito atteso a momenti."}
        </p>
      )}

      {l.accelerabile && (
        <div style={{
          marginTop: 10, padding: "10px 12px", borderRadius: "var(--r)",
          border: "1px dashed var(--bordo)", background: "#fafbfc",
        }}>
          <div className="riga-sp">
            <span className="piccolo muto">
              <span className="grassetto">Modalità simulata.</span>{" "}
              L'analisi non è reale: i dati verranno generati al momento.
            </span>
            <button className="piccolo" disabled={accelera.isPending}
                    onClick={() => accelera.mutate()}>
              {accelera.isPending ? "Consegna in corso…" : "Consegna subito"}
            </button>
          </div>
          {accelera.isError && (
            <div className="piccolo" style={{ color: "var(--danger)", marginTop: 6 }}>
              {(accelera.error as any)?.message ?? "Non è stato possibile anticipare la consegna."}
            </div>
          )}
        </div>
      )}

      {l.stato === "conclusa" && l.messaggio && (
        <p className="piccolo muto" style={{ margin: "8px 0 0" }}>
          Analisi ricevuta: {l.messaggio}.
        </p>
      )}
    </>
  );
}
