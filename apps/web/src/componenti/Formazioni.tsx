import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { API, type ApiError } from "../api/client";
import { Campo, Carta } from "./Ui";

/**
 * Formazioni per set.
 *
 * Prima si dichiara quanti set ha avuto la partita — si sa, e gia stata
 * giocata — poi per ciascun set si compone il campo posizione per posizione.
 *
 * Il campo e disposto come quello vero:
 *     4  3  2      prima linea, verso la rete
 *     5  6  1      seconda linea
 *
 * Ogni posizione e un pulsante: mostra il giocatore, oppure un + se vuota.
 * Il selettore elenca i giocatori gia salvati per quella squadra; se manca,
 * lo si aggiunge sul momento senza uscire dalla schermata.
 */

const PRIMA = [4, 3, 2];
const SECONDA = [5, 6, 1];
const RUOLI = ["palleggiatore", "opposto", "schiacciatore", "centrale", "libero"];

export default function Formazioni({ partita }: { partita: any }) {
  const qc = useQueryClient();
  const [set, setSet] = useState(1);
  const [cambia, setCambia] = useState(false);
  const [err, setErr] = useState<ApiError | null>(null);
  const ricarica = () => qc.invalidateQueries({ queryKey: ["partita", partita.id] });

  const numeroSet = useMutation({
    mutationFn: (n: number) => API.patch(`/matches/${partita.id}/sets`, { numeroSet: n }),
    onSuccess: () => { setCambia(false); ricarica(); },
  });

  const salva = useMutation({
    mutationFn: (v: any) => API.put(`/matches/${partita.id}/lineups/${set}`, v),
    onSuccess: () => { setErr(null); ricarica(); },
    onError: (e: any) => setErr(e),
  });

  const dichiarati: number | null = partita.numeroSet ?? null;
  const cap = partita.capacita ?? {};
  const bloccate = cap.modificaFormazioni === false;

  /*
   * Quando l'analisi c'e, il numero di set lo sa lei: chiederlo sarebbe
   * assurdo. Ed e assurdo anche modificare le formazioni dopo, perche sono
   * state il dato di ingresso del calcolo.
   */
  if (bloccate) {
    return (
      <>
        <div className="riga-sp">
          <h2>Formazioni per set</h2>
          {partita.setDaAnalisi && (
            <span className="piccolo muto">{dichiarati} set, dall'analisi</span>
          )}
        </div>
        <div className="avviso info">{cap.motivoBlocco}</div>
        {dichiarati
          ? <SoloLettura partita={partita} numeroSet={dichiarati} />
          : <p className="muto">Nessuna formazione registrata per questa partita.</p>}
      </>
    );
  }

  // Primo passo: quanti set ha avuto la partita.
  if (!dichiarati || cambia) {
    return (
      <>
        <h2>Quanti set ha avuto la partita?</h2>
        <Carta>
          <p className="piccolo muto" style={{ marginTop: 0 }}>
            La partita e gia stata giocata: il numero di set e noto. Serve a sapere
            quante formazioni chiedere.
          </p>
          <div className="riga">
            {[3, 4, 5].map((n) => (
              <button key={n} className={n === dichiarati ? "" : "primario"}
                      disabled={numeroSet.isPending} onClick={() => numeroSet.mutate(n)}>
                {n} set
              </button>
            ))}
            {dichiarati && <button onClick={() => setCambia(false)}>Annulla</button>}
          </div>
          {dichiarati && (
            <p className="piccolo muto">
              Riducendo il numero di set, le formazioni dei set eliminati vengono perse.
            </p>
          )}
        </Carta>
      </>
    );
  }

  const setDisponibili = Array.from({ length: dichiarati }, (_, i) => i + 1);
  const attivo = Math.min(set, dichiarati);

  return (
    <>
      <div className="riga-sp">
        <h2>Formazioni per set</h2>
        <button className="piccolo" onClick={() => setCambia(true)}>
          {dichiarati} set · cambia
        </button>
      </div>

      <div className="avviso attenzione">
        La formazione del <strong>set 1</strong> e obbligatoria prima di caricare i video:
        e un dato di ingresso per l'analisi automatica, non una comodita dell'interfaccia.
      </div>

      <div className="riga-sp" style={{ margin: "12px 0" }}>
        <div className="riga">
          {setDisponibili.map((n) => {
            const compilati = partita.formazioni.filter(
              (f: any) => f.set === n && f.pos1 !== null).length;
            return (
              <button key={n} className={attivo === n ? "primario" : ""} onClick={() => setSet(n)}>
                Set {n}{compilati === 2 ? " ✓" : compilati === 1 ? " ·" : ""}
              </button>
            );
          })}
        </div>
        <span className="piccolo muto">
          {partita.completezza.setCompletati} di {dichiarati} set completati
        </span>
      </div>

      {err && <div className="avviso errore">{err.message}</div>}

      <div className="griglia-due">
        {(["h", "a"] as const).map((lato) => (
          <CampoSquadra key={`${lato}-${attivo}`} lato={lato} set={attivo} partita={partita}
                        onSalva={(v) => salva.mutate(v)} onRicarica={ricarica} />
        ))}
      </div>
    </>
  );
}

/** Le formazioni gia usate dall'analisi: si guardano, non si toccano. */
function SoloLettura({ partita, numeroSet }: { partita: any; numeroSet: number }) {
  const [set, setSet] = useState(1);
  const attivo = Math.min(set, numeroSet);

  return (
    <>
      <div className="riga" style={{ margin: "12px 0" }}>
        {Array.from({ length: numeroSet }, (_, i) => i + 1).map((n) => (
          <button key={n} className={attivo === n ? "primario" : ""} onClick={() => setSet(n)}>
            Set {n}
          </button>
        ))}
      </div>
      <div className="griglia-due">
        {(["h", "a"] as const).map((lato) => {
          const f = partita.formazioni.find((x: any) => x.set === attivo && x.lato === lato);
          const roster = partita.giocatori.filter((g: any) => g.lato === lato);
          const chi = (n: number | null) => {
            if (n == null) return "—";
            const g = roster.find((x: any) => x.numeroMaglia === n);
            return g ? `${n} ${g.cognome}` : String(n);
          };
          return (
            <Carta key={lato}>
              <div className="grassetto" style={{ marginBottom: 10 }}>
                <span className={`punto ${lato === "h" ? "casa" : "ospite"}`} />{" "}
                {lato === "h" ? partita.home.nome : partita.away.nome}
              </div>
              {!f ? <p className="piccolo muto">Formazione non registrata per questo set.</p> : (
                <div className="campo-terreno">
                  <div className="rete" />
                  <div className="rete-testo">rete</div>
                  <div className="campo-diagramma">
                    {PRIMA.map((p) => (
                      <div key={p} className="posizione">
                        <div className="etichetta">posizione {p}</div>
                        <div className="grassetto" style={{ marginTop: 6 }}>{chi(f[`pos${p}`])}</div>
                      </div>
                    ))}
                  </div>
                  <div className="campo-diagramma">
                    {SECONDA.map((p) => (
                      <div key={p} className="posizione">
                        <div className="etichetta">posizione {p}</div>
                        <div className="grassetto" style={{ marginTop: 6 }}>{chi(f[`pos${p}`])}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {f?.libero1 != null && (
                <div className="piccolo muto" style={{ marginTop: 10 }}>
                  Libero: <span className="grassetto">{chi(f.libero1)}</span>
                </div>
              )}
            </Carta>
          );
        })}
      </div>
    </>
  );
}

function CampoSquadra({ lato, set, partita, onSalva, onRicarica }: {
  lato: "h" | "a"; set: number; partita: any;
  onSalva: (v: any) => void; onRicarica: () => void;
}) {
  const esistente = partita.formazioni.find((f: any) => f.set === set && f.lato === lato);
  const roster = partita.giocatori.filter((g: any) => g.lato === lato);
  const nomeSquadra = lato === "h" ? partita.home.nome : partita.away.nome;

  const [v, setV] = useState<Record<string, number | null>>(() => ({
    pos1: esistente?.pos1 ?? null, pos2: esistente?.pos2 ?? null, pos3: esistente?.pos3 ?? null,
    pos4: esistente?.pos4 ?? null, pos5: esistente?.pos5 ?? null, pos6: esistente?.pos6 ?? null,
    libero1: esistente?.libero1 ?? null,
  }));
  const [primoServizio, setPrimoServizio] = useState<boolean>(esistente?.primoServizio ?? false);
  const [scelta, setScelta] = useState<string | null>(null);   // quale casella e aperta

  const usati = [1, 2, 3, 4, 5, 6].map((n) => v[`pos${n}`]).filter((x): x is number => x !== null);
  const completa = usati.length === 6;

  const giocatore = (n: number | null) => roster.find((g: any) => g.numeroMaglia === n);

  const Posizione = ({ pos }: { pos: number }) => {
    const chiave = `pos${pos}`;
    const g = giocatore(v[chiave]);
    return (
      <div className="posizione">
        <div className="etichetta">posizione {pos}</div>
        <button
          onClick={() => setScelta(scelta === chiave ? null : chiave)}
          style={{
            width: "100%", marginTop: 4, justifyContent: "center", minHeight: 40,
            borderStyle: g ? "solid" : "dashed",
            borderColor: scelta === chiave ? "var(--primary)" : undefined,
          }}
          title={g ? "Cambia giocatore" : "Scegli un giocatore"}>
          {g ? (
            <span className="riga" style={{ gap: 6 }}>
              <span className="grassetto numerico">{g.numeroMaglia}</span>
              <span className="piccolo">{g.cognome}</span>
            </span>
          ) : <span className="muto" style={{ fontSize: 18 }}>+</span>}
        </button>
      </div>
    );
  };

  /** Numero della posizione con il selettore aperto; null se e il libero o nessuna. */
  const aperta = scelta && scelta.startsWith("pos") ? Number(scelta.slice(3)) : null;

  const selettore = scelta ? (
    <Selettore
      partita={partita} lato={lato} roster={roster}
      esclusi={usati.filter((n) => n !== v[scelta])}
      soloLiberi={scelta === "libero1"}
      onScegli={(n) => { setV({ ...v, [scelta]: n }); setScelta(null); }}
      onSvuota={() => { setV({ ...v, [scelta]: null }); setScelta(null); }}
      onChiudi={() => setScelta(null)}
      onAggiunto={onRicarica}
    />
  ) : null;

  return (
    <Carta>
      <div className="grassetto" style={{ marginBottom: 10 }}>
        <span className={`punto ${lato === "h" ? "casa" : "ospite"}`} /> {nomeSquadra}
      </div>

      {roster.length === 0 && (
        <div className="avviso info piccolo">
          Nessun giocatore in questa squadra per la partita. Puoi importarli dalla
          scheda "Dati e roster", oppure aggiungerli qui uno alla volta.
        </div>
      )}

      <div className="campo-terreno">
        <div className="rete" />
        <div className="rete-testo">rete</div>
        <div className="campo-diagramma">{PRIMA.map((p) => <Posizione key={p} pos={p} />)}</div>
        {/* Il selettore si apre sotto la linea a cui appartiene la posizione
            scelta, non in fondo alla scheda: deve restare accanto al + toccato. */}
        {aperta !== null && PRIMA.includes(aperta) && selettore}
        <div className="campo-diagramma">{SECONDA.map((p) => <Posizione key={p} pos={p} />)}</div>
        {aperta !== null && SECONDA.includes(aperta) && selettore}
      </div>

      <div style={{ marginTop: 12 }}>
        <div className="etichetta piccolo muto">Libero</div>
        <button style={{ marginTop: 4, minWidth: 160,
                         borderStyle: v.libero1 ? "solid" : "dashed" }}
                onClick={() => setScelta(scelta === "libero1" ? null : "libero1")}>
          {v.libero1 !== null
            ? <span className="riga" style={{ gap: 6 }}>
                <span className="grassetto numerico">{v.libero1}</span>
                <span className="piccolo">{giocatore(v.libero1)?.cognome ?? ""}</span>
              </span>
            : <span className="muto">+ libero</span>}
        </button>
      </div>

      {scelta === "libero1" && selettore}

      <label className="riga piccolo" style={{ marginTop: 10 }}>
        <input type="checkbox" style={{ width: "auto" }} checked={primoServizio}
               onChange={(e) => setPrimoServizio(e.target.checked)} />
        Al servizio all'inizio del set
      </label>

      <div className="riga" style={{ marginTop: 14 }}>
        <button className="primario" disabled={!completa}
                onClick={() => onSalva({ lato, ...v, primoServizio })}>
          Salva set {set}
        </button>
        {!completa && (
          <span className="piccolo muto">
            {6 - usati.length} {6 - usati.length === 1 ? "posizione" : "posizioni"} da assegnare
          </span>
        )}
      </div>
    </Carta>
  );
}

/**
 * Selettore del giocatore: elenca chi e gia salvato per quella squadra e,
 * se manca, lo aggiunge senza far uscire dalla schermata.
 */
function Selettore({ partita, lato, roster, esclusi, soloLiberi, onScegli, onSvuota, onChiudi, onAggiunto }: {
  partita: any; lato: "h" | "a"; roster: any[]; esclusi: number[];
  soloLiberi: boolean;
  onScegli: (n: number) => void; onSvuota: () => void; onChiudi: () => void; onAggiunto: () => void;
}) {
  const [nuovo, setNuovo] = useState(false);
  const [d, setD] = useState({ numeroMaglia: "", cognome: "", nome: "",
                               ruolo: "", libero: soloLiberi, salvaInSquadra: true });
  const [err, setErr] = useState<ApiError | null>(null);

  const aggiungi = useMutation({
    mutationFn: () => API.post(`/matches/${partita.id}/players`, {
      lato, numeroMaglia: Number(d.numeroMaglia), cognome: d.cognome.trim(), nome: d.nome.trim(),
      ruolo: d.ruolo || null, libero: d.libero, capitano: false,
      salvaInSquadra: d.salvaInSquadra,
    }),
    onSuccess: (g: any) => {
      setNuovo(false); setErr(null);
      setD({ numeroMaglia: "", cognome: "", nome: "", ruolo: "", libero: soloLiberi, salvaInSquadra: true });
      onAggiunto();
      onScegli(g.numeroMaglia);
    },
    onError: (e: any) => setErr(e),
  });

  const disponibili = roster
    .filter((g: any) => !esclusi.includes(g.numeroMaglia))
    .filter((g: any) => (soloLiberi ? g.libero : true))
    .sort((a: any, b: any) => a.numeroMaglia - b.numeroMaglia);

  return (
    <div style={{
      marginTop: 12, border: "1px solid var(--primary)", borderRadius: "var(--r)",
      padding: 12, background: "#fbfcfe",
    }}>
      <div className="riga-sp" style={{ marginBottom: 8 }}>
        <span className="grassetto piccolo">
          {soloLiberi ? "Scegli il libero" : "Scegli il giocatore"}
        </span>
        <button className="piccolo" onClick={onChiudi}>Chiudi</button>
      </div>

      {!nuovo && (
        <>
          {disponibili.length === 0 ? (
            <p className="piccolo muto">
              {soloLiberi
                ? "Nessun libero fra i giocatori salvati."
                : "Tutti i giocatori salvati sono gia in campo."}
            </p>
          ) : (
            <div className="riga" style={{ flexWrap: "wrap", gap: 6 }}>
              {disponibili.map((g: any) => (
                <button key={g.id} onClick={() => onScegli(g.numeroMaglia)}>
                  <span className="grassetto numerico">{g.numeroMaglia}</span>
                  <span className="piccolo">{g.cognome} {g.nome}</span>
                  {g.libero && <span className="piccolo muto">· libero</span>}
                </button>
              ))}
            </div>
          )}
          <div className="riga" style={{ marginTop: 10 }}>
            <button className="primario piccolo" onClick={() => setNuovo(true)}>
              + Aggiungi un giocatore
            </button>
            <button className="piccolo" onClick={onSvuota}>Svuota la posizione</button>
          </div>
        </>
      )}

      {nuovo && (
        <div>
          <p className="piccolo muto" style={{ marginTop: 0 }}>
            Il giocatore non e fra quelli salvati: inseriscilo qui.
          </p>
          <div className="riga">
            <Campo etichetta="Numero" errore={err?.details?.numeroMaglia}>
              <input type="number" min={0} max={99} value={d.numeroMaglia} autoFocus
                     style={{ width: 90 }}
                     onChange={(e) => setD({ ...d, numeroMaglia: e.target.value })} />
            </Campo>
            <Campo etichetta="Cognome" errore={err?.details?.cognome}>
              <input value={d.cognome} onChange={(e) => setD({ ...d, cognome: e.target.value })} />
            </Campo>
            <Campo etichetta="Nome" errore={err?.details?.nome}>
              <input value={d.nome} onChange={(e) => setD({ ...d, nome: e.target.value })} />
            </Campo>
          </div>
          <div className="riga">
            <Campo etichetta="Ruolo">
              <select value={d.ruolo} onChange={(e) => setD({ ...d, ruolo: e.target.value })}>
                <option value="">—</option>
                {RUOLI.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </Campo>
            <label className="riga piccolo" style={{ whiteSpace: "nowrap", marginTop: 18 }}>
              <input type="checkbox" style={{ width: "auto" }} checked={d.libero}
                     onChange={(e) => setD({ ...d, libero: e.target.checked })} />
              e il libero
            </label>
          </div>
          <label className="riga piccolo" style={{ marginBottom: 10 }}>
            <input type="checkbox" style={{ width: "auto" }} checked={d.salvaInSquadra}
                   onChange={(e) => setD({ ...d, salvaInSquadra: e.target.checked })} />
            Salvalo anche nel roster della squadra, cosi la prossima volta c'e gia
          </label>

          {err && !err.details && <div className="avviso errore piccolo">{err.message}</div>}

          <div className="riga">
            <button className="primario" disabled={!d.numeroMaglia || !d.cognome || !d.nome || aggiungi.isPending}
                    onClick={() => aggiungi.mutate()}>
              {aggiungi.isPending ? "Aggiunta…" : "Aggiungi e metti in campo"}
            </button>
            <button onClick={() => { setNuovo(false); setErr(null); }}>Annulla</button>
          </div>
        </div>
      )}
    </div>
  );
}
