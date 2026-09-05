import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Carta } from "./Ui";
import * as I from "./Icone";
import { piattaforma } from "../platform";
import { capacitaNative, nativoPresente, registraPartita } from "../platform/nativo";
import { aggiungi, daCaricare, dimentica, durata } from "../registrazioni";

/**
 * Registrare una partita senza passare da "Nuova partita".
 *
 * <p>Il gesto reale e questo: si arriva in palestra e si comincia a
 * riprendere. Compilare prima un modulo con campionato, squadre, data e
 * citta significa fare la cosa burocratica mentre la partita inizia — e in
 * palestra, spesso, senza rete.
 *
 * <p>Quindi i due gesti si separano: <b>prima si registra, poi si dice cos'e
 * stato registrato</b>. Il file resta sul telefono e viene ricordato
 * (`registrazioni.ts`); la partita si crea con calma, anche il giorno dopo.
 *
 * <p>Il caricamento non puo partire subito: la sessione si apre su una
 * partita che ancora non esiste, e il server pretende la formazione del set 1
 * prima di accettare byte. Prometterlo qui sarebbe una bugia di tre secondi.
 */
export default function RegistraPartita({ modo }: {
  /*
   * Due ruoli distinti e non un interruttore "compatto".
   *
   * `pulsante` sta nella riga dei comandi accanto a "Nuova partita";
   * `pannello` sta piu sotto e ospita cio che non e un comando — l'avviso per
   * chi non ha l'applicazione, e le registrazioni ancora da collegare.
   *
   * Se fosse un solo componente reso due volte, nell'app nativa il pulsante
   * comparirebbe due volte. Dirlo qui costa una parola e toglie un difetto.
   */
  modo: "pulsante" | "pannello";
}) {
  const nav = useNavigate();
  const [puo, setPuo] = useState<boolean | null>(null);
  const [inCorso, setInCorso] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);
  const [attesa, setAttesa] = useState(daCaricare());

  useEffect(() => { capacitaNative().then((c) => setPuo(c.registrazione)); }, []);

  const registra = async () => {
    setErrore(null);
    setInCorso(true);
    try {
      const r = await registraPartita();
      if (r.annullata || !r.uri) return;
      aggiungi({ uri: r.uri, nome: r.nome ?? "partita.mp4",
                 byte: r.byte ?? 0, durataMs: r.durataMs ?? 0 });
      setAttesa(daCaricare());
      // Subito al modulo: adesso che la partita e stata ripresa, dire cos'era
      // e il passo naturale — e finche si e ancora in palestra si ricordano
      // il campo e gli arbitri.
      nav("/partite/nuova?registrata=1");
    } catch (e: any) {
      setErrore(e?.message ?? "La registrazione non e riuscita.");
    } finally {
      setInCorso(false);
    }
  };

  /*
   * Fuori dall'applicazione Android il pulsante c'e lo stesso, e spiega.
   *
   * Nasconderlo sarebbe piu pulito e peggio: chi apre il sito dal telefono
   * cerca proprio quello, e non trovandolo conclude che non esista. Il
   * browser non puo registrare con un profilo di codifica controllato ne
   * tenere acceso lo schermo per due ore, quindi qui si dice dov'e.
   */
  if (!nativoPresente() || puo === false) {
    if (!piattaforma.mobile || modo === "pulsante") return null;
    return (
      <Carta className="nota-installazione" style={{ marginTop: 12 }}>
        <h3><I.Video d={17} /> Registrare dal telefono</h3>
        <p className="piccolo muto" style={{ marginBottom: 0 }}>
          La ripresa con la mira di inquadratura sta nell&apos;<b>applicazione
          Android</b>: serve a tenere i quattro angoli del campo dentro
          l&apos;immagine, senza i quali le posizioni dei giocatori non si
          possono ricavare. Il browser non puo ne fissare la qualita della
          registrazione ne tenere acceso lo schermo per due ore. La trovi
          dal <b>tuo profilo</b>.
        </p>
      </Carta>
    );
  }

  if (puo === null) return null;

  if (modo === "pulsante") {
    return (
      <>
        <button disabled={inCorso} onClick={registra}>
          <I.Video d={16} /> {inCorso ? "Registrazione…" : "Registra partita"}
        </button>
        {/* L'errore sta qui e non nel pannello: i due modi sono due
            componenti con stati separati, e un errore mostrato altrove non
            comparirebbe mai. */}
        {errore && <div className="avviso errore piccolo">{errore}</div>}
      </>
    );
  }

  return (
    <>
      {/* Registrazioni fatte e non ancora collegate a una partita: senza
          questo elenco resterebbero file che nessuno sa piu di avere. */}
      {attesa.length > 0 && (
        <Carta style={{ marginTop: 12 }}>
          <span className="etichetta">Registrazioni da collegare</span>
          <div className="colonna" style={{ marginTop: 8 }}>
            {attesa.map((r) => (
              <div key={r.uri} className="riga-sp">
                <div style={{ minWidth: 0 }}>
                  <div className="grassetto">{durata(r.durataMs)} · {(r.byte / 1073741824).toFixed(1)} GB</div>
                  <div className="piccolo muto">
                    {new Date(r.quando).toLocaleString("it-IT")}
                  </div>
                </div>
                <div className="riga">
                  <button className="piccolo" onClick={() => nav("/partite/nuova?registrata=1")}>
                    Crea la partita
                  </button>
                  {/* "Togli" e non "Elimina": il file resta sul telefono.
                      Buttare mezz'ora di partita per un tocco non e un'opzione. */}
                  <button className="piccolo"
                          onClick={() => { dimentica(r.uri); setAttesa(daCaricare()); }}>
                    Togli
                  </button>
                </div>
              </div>
            ))}
          </div>
          <p className="piccolo muto" style={{ marginBottom: 0 }}>
            Il file resta sul telefono. Si carica dalla scheda <b>Video</b> della
            partita, dopo aver inserito la formazione del set 1.
          </p>
        </Carta>
      )}
    </>
  );
}
