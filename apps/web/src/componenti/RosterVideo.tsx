import { MagliaPiena } from "./Icone";

/**
 * Il roster accanto al video: chi e in campo, per numero.
 *
 * Non e `RosterPartita`: quello serve a **compilare** la rosa, con le
 * modifiche, le importazioni e i controlli sullo stato. Qui si guarda e
 * basta, mentre scorre il video — l'unica domanda e "chi e il 18?", che
 * nell'elenco azioni compare come numero nudo.
 */
export function RosterVideo({ giocatori, nomi }: {
  giocatori: any[];
  nomi: { h: string; a: string };
}) {
  if (!giocatori?.length) {
    return <p className="piccolo muto" style={{ margin: 0 }}>
      Il roster di questa partita non e stato compilato.
    </p>;
  }

  return (
    <div className="roster-video">
      {(["h", "a"] as const).map((lato) => {
        const rosa = giocatori
          .filter((g) => g.lato === lato)
          .sort((a, b) => a.numeroMaglia - b.numeroMaglia);
        if (!rosa.length) return null;

        return (
          <div key={lato} className="roster-video-squadra">
            <span className="etichetta">{nomi[lato]}</span>
            {rosa.map((g) => (
              <div key={g.id ?? `${lato}-${g.numeroMaglia}`}
                   className={`roster-video-riga ${g.libero ? "libero" : ""}`}>
                <span className="roster-video-numero">
                  <MagliaPiena d={20} />
                  <em className="numerico">{g.numeroMaglia}</em>
                </span>
                <span className="roster-video-nome">
                  {g.cognome}
                  {/* Il nome piccolo accanto al cognome: due Rossi in una rosa
                      non sono rari, e col solo cognome non si distinguono. */}
                  {g.nome && <em>{g.nome}</em>}
                </span>
                {g.ruolo && <span className="piccolo muto">{abbrevia(g.ruolo)}</span>}
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}

/** In una colonna stretta "schiacciatore" non ci sta: si abbrevia. */
const abbrevia = (ruolo: string) => ({
  palleggiatore: "pall.", opposto: "opp.", schiacciatore: "schi.",
  centrale: "centr.", libero: "libero",
}[ruolo] ?? ruolo);
