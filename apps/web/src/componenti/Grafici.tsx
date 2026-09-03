/**
 * Grafici disegnati a mano, non una libreria.
 *
 * Ne servono tre, e tutti e tre dicono una cosa sola. Una libreria di grafici
 * porterebbe assi, legende, animazioni e trenta opzioni per ognuno: peso e
 * complessita per rispondere a domande che qui non si pongono.
 *
 * Regola comune: **nessun grafico senza il numero accanto.** Una barra dice
 * "tanto" o "poco", il numero dice quanto; da soli non bastano ne l'uno ne
 * l'altra.
 */

/** Una fetta della distribuzione: cosa fa un giocatore quando tocca la palla. */
export interface Fetta { chiave: string; etichetta: string; valore: number; colore: string }

/**
 * Distribuzione dei tocchi per fondamentale, come barra unica divisa.
 *
 * Non una torta: le torte si confrontano male fra loro, e qui il confronto fra
 * giocatori e il punto. Una barra orizzontale si legge in fila con le altre.
 */
export function BarraDivisa({ fette, altezza = 26 }: { fette: Fetta[]; altezza?: number }) {
  const totale = fette.reduce((s, f) => s + f.valore, 0);
  if (!totale) return <p className="piccolo muto">Nessun tocco attribuito.</p>;

  return (
    <>
      <div className="barra-divisa" style={{ height: altezza }}>
        {fette.filter((f) => f.valore > 0).map((f) => (
          <span key={f.chiave} style={{ width: `${(f.valore / totale) * 100}%`, background: f.colore }}
                title={`${f.etichetta}: ${f.valore} (${Math.round((f.valore / totale) * 100)}%)`} />
        ))}
      </div>
      <div className="legenda">
        {fette.filter((f) => f.valore > 0).map((f) => (
          <span key={f.chiave} className="voce-legenda">
            <span className="pastiglia" style={{ background: f.colore }} />
            {f.etichetta}
            <b className="numerico">{f.valore}</b>
            <span className="muto">{Math.round((f.valore / totale) * 100)}%</span>
          </span>
        ))}
      </div>
    </>
  );
}

/**
 * Andamento nel tempo: una colonna per partita.
 *
 * Le colonne, non una spezzata: fra una partita e l'altra non c'e continuita —
 * una linea suggerirebbe che fra due partite esistano valori intermedi.
 *
 * La linea della media serve a rispondere alla domanda che ci si fa davvero:
 * "questa partita e sopra o sotto il suo solito?".
 */
export interface Colonna { etichetta: string; valore: number | null; titolo?: string }

export function Colonne({ dati, unita = "", altezza = 120, colore = "var(--palla)" }: {
  dati: Colonna[]; unita?: string; altezza?: number; colore?: string;
}) {
  const validi = dati.filter((d) => d.valore !== null) as Array<Colonna & { valore: number }>;
  if (validi.length === 0) return <p className="piccolo muto">Non ci sono ancora dati.</p>;

  const valori = validi.map((d) => d.valore);
  const max = Math.max(...valori, 0);
  const min = Math.min(...valori, 0);
  const campo = max - min || 1;
  const media = valori.reduce((s, v) => s + v, 0) / valori.length;

  // La riga dello zero sta dove sta lo zero: con valori negativi (l'efficienza
  // puo esserlo) le colonne devono scendere, non capovolgersi.
  const y = (v: number) => altezza - ((v - min) / campo) * altezza;

  return (
    <div className="grafico-colonne" style={{ height: altezza + 34 }}>
      <div className="colonne" style={{ height: altezza }}>
        {min < 0 && <span className="riga-zero" style={{ top: y(0) }} />}
        <span className="riga-media" style={{ top: y(media) }}
              title={`Media: ${Math.round(media)}${unita}`} />
        {dati.map((d, i) => {
          if (d.valore === null) {
            return <span key={i} className="colonna-grafico assente" title={`${d.etichetta}: nessun dato`} />;
          }
          const alto = Math.abs(y(d.valore) - y(0));
          const sopra = d.valore >= 0;
          return (
            <span key={i} className="colonna-grafico" title={d.titolo ?? `${d.etichetta}: ${d.valore}${unita}`}>
              <span className="valore-colonna numerico">{d.valore}{unita}</span>
              <span className="asta"
                    style={{ height: Math.max(2, alto), background: colore,
                             marginTop: sopra ? "auto" : undefined,
                             marginBottom: sopra ? y(0) - altezza + (altezza - y(0)) : undefined }} />
            </span>
          );
        })}
      </div>
      <div className="etichette-colonne">
        {dati.map((d, i) => <span key={i}>{d.etichetta}</span>)}
      </div>
    </div>
  );
}

/**
 * Confronto fra due valori affiancati, con la barra proporzionata.
 * Serve per gli esiti: quanti punti, quanti errori, quanti murati.
 */
export function Righe({ voci }: { voci: Array<{ etichetta: string; valore: number; colore?: string }> }) {
  const max = Math.max(...voci.map((v) => v.valore), 1);
  return (
    <div className="grafico-righe">
      {voci.map((v) => (
        <div key={v.etichetta} className="riga-grafico">
          <span className="etichetta-riga">{v.etichetta}</span>
          <span className="asta-riga">
            <span style={{ width: `${(v.valore / max) * 100}%`,
                           background: v.colore ?? "var(--palla)" }} />
          </span>
          <span className="numerico valore-riga">{v.valore}</span>
        </div>
      ))}
    </div>
  );
}
