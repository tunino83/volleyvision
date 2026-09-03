import { useCallback, useEffect, useState } from "react";
import { Carta } from "../componenti/Ui";
import * as I from "../componenti/Icone";
import { piattaforma } from "../platform";
import { avvisa } from "../componenti/Avvisi";
import * as dep from "./deposito";
import { sincronizza, vuoleTutto, impostaVuoleTutto, dimenticaTutto } from "./scarico";

/**
 * COSA C'E SU QUESTO DISPOSITIVO.
 *
 * Senza questa scheda l'utente accumula dati che non sa di avere e non sa
 * come togliere. E il contraltare necessario di uno scaricamento che avviene
 * da solo: se non chiedo il permesso, devo almeno rendere conto.
 *
 * Sta nel profilo accanto all'installazione, perche sono la stessa domanda
 * vista da due lati: "come uso questa applicazione su questo dispositivo".
 */

const mb = (b: number) => (b / 1024 / 1024).toFixed(1);

export function SchedaLocale() {
  const [occ, setOcc] = useState<{ partite: number; byte: number } | null>(null);
  const [tutto, setTutto] = useState(vuoleTutto());
  const [inCorso, setInCorso] = useState(false);
  const installata = piattaforma.installazione.giaInstallata();

  const rileggi = useCallback(() => { void dep.occupazione().then(setOcc); }, []);
  useEffect(rileggi, [rileggi]);

  if (!dep.disponibile()) {
    return (
      <Carta className="nota-installazione">
        <h3><I.Nuvola d={17} /> Dati su questo dispositivo</h3>
        <p className="piccolo muto">
          Questo browser non consente di salvare dati in locale — succede nelle
          finestre private. L'applicazione funziona, ma solo con la rete.
        </p>
      </Carta>
    );
  }

  const scarica = async () => {
    setInCorso(true);
    try {
      const e = await sincronizza({ forzaTutto: true });
      rileggi();
      if (e.nuove > 0) {
        avvisa(e.nuove === 1
          ? "Ora 1 nuova partita e disponibile anche offline."
          : `Ora ${e.nuove} nuove partite sono disponibili anche offline.`);
      } else if (!e.fermato) {
        // Qui il "niente di nuovo" e una risposta, non rumore: l'utente ha
        // appena premuto un pulsante e merita di sapere che ha funzionato.
        avvisa("Era gia tutto sul dispositivo: niente da scaricare.");
      }
    } finally { setInCorso(false); }
  };

  return (
    <Carta className="nota-installazione">
      <h3><I.Carica d={17} /> Dati su questo dispositivo</h3>

      <p className="piccolo muto">
        {occ && occ.partite > 0
          ? <>Hai <b>{occ.partite}</b> {occ.partite === 1 ? "partita" : "partite"} disponibili
              anche senza rete, piu squadre, campionati e persone.
              Occupano <b>{mb(occ.byte)} MB</b>.</>
          : <>Squadre, campionati e persone sono sempre su questo dispositivo
              (~56 KB). Le partite non sono ancora state scaricate.</>}
      </p>

      {installata ? (
        <p className="piccolo muto">
          Hai installato l'applicazione, quindi le partite si scaricano da sole:
          installarla e gia dire che questo dispositivo e tuo.
        </p>
      ) : (
        <label className="scelta">
          <input type="checkbox" checked={tutto} onChange={(ev) => {
            impostaVuoleTutto(ev.target.checked);
            setTutto(ev.target.checked);
            if (ev.target.checked) void scarica();
          }} />
          <span>
            <b>Tieni tutte le partite su questo dispositivo</b>
            {/* Il motivo per cui NON e acceso di suo: in una scheda del
                browser questo potrebbe essere il computer di qualcun altro. */}
            <em className="piccolo muto">
              Sei in una scheda del browser: senza questa spunta si tengono solo
              le anagrafiche e le partite che apri. Non accenderla su un
              computer condiviso.
            </em>
          </span>
        </label>
      )}

      <div className="riga">
        <button className="piccolo" onClick={scarica} disabled={inCorso}>
          {inCorso ? "Scarico…" : "Scarica ora"}
        </button>
        {!!occ?.partite && (
          <button className="piccolo" onClick={async () => {
            await dimenticaTutto();
            setTutto(false); rileggi();
            avvisa("Dati locali cancellati.");
          }}>Cancella i dati locali</button>
        )}
      </div>

      <p className="piccolo muto nota-finale">
        I video non vengono mai copiati: restano dove sono sul tuo disco.
      </p>
    </Carta>
  );
}
