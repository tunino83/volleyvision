import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { API, type ApiError } from "../api/client";
import { Campo, Carta, Indietro, Stato } from "../componenti/Ui";
import { Avatar, NOME_API, STILI, type Stile } from "../componenti/Avatar";
import { preparaFoto, byteDiDataUri } from "../componenti/ritaglia";
import { AvatarPersonalizza } from "../componenti/AvatarPersonalizza";
import { Stemma } from "../componenti/LogoSquadra";
import StemmaPersonalizza from "../componenti/StemmaPersonalizza";
import { useFunzioni } from "../funzioni";
import { Maglia, MagliaPiena, Persona } from "../componenti/Icone";

/**
 * Il roster come ALBUM DI FIGURINE.
 *
 * La tabella diceva le stesse cose ma le diceva come un foglio elettronico.
 * Una squadra e un gruppo di persone, e un gruppo di persone si guarda: volti,
 * numeri di maglia grandi, ruolo. Le informazioni sono identiche, il modo di
 * leggerle no.
 *
 * Si modifica una figurina per volta, aprendola. La modifica di massa che
 * c'era prima — tutte le righe insieme, un solo salvataggio — era comoda per
 * chi inserisce venti giocatori di fila e scomoda per tutto il resto, che e
 * il caso normale: si corregge un numero, si cambia un ruolo.
 */

const RUOLI = ["palleggiatore", "opposto", "schiacciatore", "centrale", "libero"];

interface Giocatore {
  id?: string;
  numeroMaglia: number; cognome: string; nome: string;
  ruolo: string | null; libero: boolean; personId: string | null;
  person?: { id: string; cognome: string; nome: string;
             avatarStile: string | null; avatarSeme: string | null;
             /** Versione della fotografia, oppure null se non c'e. */
             foto?: number | null;
             avatarOpzioni?: Record<string, string[]> | null } | null;
}

export default function SquadraDettaglio() {
  const { id } = useParams();
  const qc = useQueryClient();
  const [apre, setApre] = useState<number | null>(null);
  const [nuovo, setNuovo] = useState(false);
  const [emailCond, setEmailCond] = useState("");

  const q = useQuery({ queryKey: ["squadra", id], queryFn: () => API.get<any>(`/teams/${id}`) });
  const cond = useQuery({ queryKey: ["squadra-cond", id],
                          queryFn: () => API.get<any[]>(`/teams/${id}/shares`) });

  const ricarica = () => {
    qc.invalidateQueries({ queryKey: ["squadra", id] });
    qc.invalidateQueries({ queryKey: ["persone"] });
  };

  const condividi = useMutation({
    mutationFn: () => API.post(`/teams/${id}/shares`, { email: emailCond.trim() }),
    onSuccess: () => { setEmailCond(""); qc.invalidateQueries({ queryKey: ["squadra-cond", id] }); },
  });
  const revoca = useMutation({
    mutationFn: (s: string) => API.del(`/teams/${id}/shares/${s}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["squadra-cond", id] }),
  });

  const giocatori: Giocatore[] = q.data?.giocatori ?? [];
  const soloLettura = q.data && !q.data.proprietario;
  const senzaPersona = giocatori.filter((g) => !g.personId).length;

  return (
    <Stato caricamento={q.isLoading} errore={q.error}>
      <Indietro a="/squadre" testo="Tutte le squadre" />

      <div className="riga-sp">
        <div className="riga">
          {q.data && (
            <Stemma squadra={q.data} d={44} />
          )}
          <div>
            <h1 style={{ margin: 0 }}>{q.data?.nome}</h1>
            <p className="muto" style={{ marginTop: 0 }}>
              {q.data?.stagione} · {giocatori.length}{" "}
              {giocatori.length === 1 ? "giocatore" : "giocatori"}
              {soloLettura && " · sola lettura"}
            </p>
          </div>
        </div>
        {!soloLettura && (
          <button className="primario" onClick={() => { setNuovo(true); setApre(null); }}>
            <Maglia d={16} /> Aggiungi
          </button>
        )}
      </div>

      {/* Solo per chi la possiede: su una squadra condivisa in sola lettura,
          comandi che il server rifiuterebbe comunque (regola 2b). */}
      {q.data && !soloLettura && <StemmaPersonalizza squadra={q.data} />}

      {senzaPersona > 0 && !soloLettura && (
        <div className="avviso attenzione piccolo">
          <strong>{senzaPersona}</strong>{" "}
          {senzaPersona === 1 ? "giocatore non e collegato" : "giocatori non sono collegati"} a
          una persona: non entrano nelle statistiche di stagione e il loro avatar
          non si puo scegliere. Aprili e collegali.
        </div>
      )}

      {nuovo && (
        <Figurina squadraId={id!} nuova onFatto={() => { setNuovo(false); ricarica(); }}
                  onChiudi={() => setNuovo(false)} />
      )}

      {giocatori.length === 0 && !nuovo ? (
        <div className="vuoto">
          <Persona d={40} className="palla-vuoto" />
          <p>Nessun giocatore. L'album e vuoto.</p>
        </div>
      ) : (
        <div className="album">
          {giocatori.map((g) => (
            apre === g.numeroMaglia ? (
              <Figurina key={g.id ?? g.numeroMaglia} squadraId={id!} g={g}
                        onFatto={() => { setApre(null); ricarica(); }}
                        onChiudi={() => setApre(null)} />
            ) : (
              <Scheda key={g.id ?? g.numeroMaglia} g={g} soloLettura={!!soloLettura}
                      onApri={() => { setApre(g.numeroMaglia); setNuovo(false); }} />
            )
          ))}
        </div>
      )}

      {!soloLettura && (
        <>
          <h2>Condivisa con</h2>
          <Carta>
            {cond.data?.length === 0 && <p className="piccolo muto">Con nessuno.</p>}
            {cond.data?.map((s) => (
              <div key={s.id} className="riga-sp piccolo" style={{ marginBottom: 6 }}>
                <span>
                  {s.email}
                  {s.statoInvito === "invito" && <span className="muto"> · non ancora registrato</span>}
                </span>
                <button className="piccolo" onClick={() => revoca.mutate(s.id)}>revoca</button>
              </div>
            ))}
            <div className="riga" style={{ marginTop: 10 }}>
              <input type="email" value={emailCond} placeholder="indirizzo email"
                     style={{ maxWidth: 260 }}
                     onChange={(e) => setEmailCond(e.target.value)}
                     onKeyDown={(e) => { if (e.key === "Enter" && emailCond.trim()) condividi.mutate(); }} />
              <button className="piccolo" disabled={!emailCond.trim() || condividi.isPending}
                      onClick={() => condividi.mutate()}>Condividi</button>
            </div>
            <p className="piccolo muto" style={{ marginBottom: 0 }}>
              Sola lettura: chi la riceve vede la squadra e le sue partite, non le modifica.
            </p>
          </Carta>
        </>
      )}
    </Stato>
  );
}

/** La figurina: volto, numero grande, cognome, ruolo. */
function Scheda({ g, soloLettura, onApri }: {
  g: Giocatore; soloLettura: boolean; onApri: () => void;
}) {
  const seme = g.person?.avatarSeme || `${g.cognome} ${g.nome}`;

  return (
    <div className={`figurina ${g.libero ? "libero" : ""}`}
         onClick={soloLettura ? undefined : onApri}
         style={{ cursor: soloLettura ? "default" : "pointer" }}
         title={soloLettura ? undefined : "Modifica"}>
      <div className="figurina-numero">{g.numeroMaglia}</div>
      <Avatar seme={seme} stile={g.person?.avatarStile} d={84} className="figurina-volto"
              opzioni={g.person?.avatarOpzioni}
              personId={g.person?.id} foto={g.person?.foto} />
      <div className="figurina-nome">{g.cognome}</div>
      <div className="figurina-sottonome">{g.nome}</div>
      <div className="figurina-ruolo">
        {g.libero ? "Libero" : g.ruolo ?? "—"}
      </div>
      {/* I due esiti della stessa domanda — chi e questa persona — stanno
          nello stesso posto. Il collegamento ferma la propagazione: la
          figurina intera apre la modifica, questo porta altrove. */}
      {g.personId ? (
        <Link to={`/persone/${g.personId}`} className="figurina-scheda"
              onClick={(e) => e.stopPropagation()}
              title="Apri la scheda della persona">
          scheda
        </Link>
      ) : (
        <div className="figurina-avviso" title="Senza persona collegata non entra nelle statistiche di stagione">
          non collegato
        </div>
      )}
    </div>
  );
}

/**
 * La figurina aperta: si modifica quella e basta.
 *
 * L'avatar si sceglie qui, ed e possibile **solo con una persona collegata**:
 * senza, non ci sarebbe nessuno a cui attaccare la scelta. E l'ennesima
 * ragione concreta per collegare le persone.
 */
function Figurina({ squadraId, g, nuova, onFatto, onChiudi }: {
  squadraId: string; g?: Giocatore; nuova?: boolean;
  onFatto: () => void; onChiudi: () => void;
}) {
  const [d, setD] = useState({
    numeroMaglia: g ? String(g.numeroMaglia) : "",
    cognome: g?.cognome ?? "", nome: g?.nome ?? "",
    ruolo: g?.ruolo ?? "", libero: g?.libero ?? false,
  });
  const [stile, setStile] = useState<string | null>(g?.person?.avatarStile ?? null);
  const [seme, setSeme] = useState<string | null>(g?.person?.avatarSeme ?? null);
  const [opzioni, setOpzioni] = useState<Record<string, string[]>>(
    g?.person?.avatarOpzioni ?? {});
  /** I comandi per comporre la faccia: chiusi finche non servono. */
  const [componi, setComponi] = useState(false);
  const [err, setErr] = useState<ApiError | null>(null);
  /** La foto scelta ora e non ancora salvata; `null` significa "toglila". */
  const [fotoNuova, setFotoNuova] = useState<string | null | undefined>(undefined);
  const [fotoErr, setFotoErr] = useState<string | null>(null);
  const [preparo, setPreparo] = useState(false);
  // Le fotografie sono scritte e provate ma non in esercizio: sono dati
  // personali e prima servono informativa e consenso. Vedi `@vv/schema`.
  const { fotoPersone } = useFunzioni();

  const semeVisto = seme || `${d.cognome} ${d.nome}`;
  const personId = g?.person?.id ?? g?.personId ?? null;

  const salva = useMutation({
    mutationFn: async () => {
      const corpo = {
        numeroMaglia: Number(d.numeroMaglia), cognome: d.cognome.trim(), nome: d.nome.trim(),
        ruolo: d.ruolo || null, libero: d.libero,
      };
      if (nuova) await API.post(`/teams/${squadraId}/players`, corpo);
      else await API.patch(`/teams/${squadraId}/players/${g!.id}`, corpo);
      // L'avatar viaggia a parte: sta sulla persona, non sulla riga di roster.
      if (personId) {
        await API.patch(`/persons/${personId}/avatar`, {
          avatarStile: stile, avatarSeme: seme,
          // Oggetto vuoto significa "nessuna scelta": si manda `null`, che
          // cancella, invece di salvare un oggetto senza contenuto.
          avatarOpzioni: Object.keys(opzioni).length ? opzioni : null,
        });
        // `undefined` = non toccata. `null` = da togliere. Stringa = la nuova.
        if (fotoNuova === null) await API.del(`/persons/${personId}/foto`);
        else if (fotoNuova) await API.put(`/persons/${personId}/foto`, { dataUri: fotoNuova });
      }
    },
    onSuccess: () => { setErr(null); onFatto(); },
    onError: (e: any) => setErr(e),
  });

  const elimina = useMutation({
    mutationFn: () => API.del(`/teams/${squadraId}/players/${g!.id}`),
    onSuccess: onFatto,
    onError: (e: any) => setErr(e),
  });

  const pronto = d.numeroMaglia !== "" && d.cognome.trim() && d.nome.trim();

  return (
    <div className="figurina aperta">
      <div className="modulo-intestazione">
        <span className="etichetta">{nuova ? "Nuovo giocatore" : `Modifica ${g!.cognome}`}</span>
        <button className="piccolo" onClick={onChiudi}>Chiudi</button>
      </div>

      <div className="modulo-corpo">
        {/* A sinistra cio che si guarda, a destra cio che si compila. */}
        <div className="modulo-volto">
          {/* Cio che si vedra davvero: la foto scelta ora, quella gia salvata,
              oppure il volto disegnato. Nell'ordine in cui vincono. */}
          {fotoNuova
            ? <img src={fotoNuova} width={96} height={96} alt=""
                   style={{ borderRadius: "50%", objectFit: "cover", display: "block" }} />
            : <Avatar seme={semeVisto} stile={stile} d={96} opzioni={opzioni}
                      personId={personId ?? undefined}
                      foto={fotoNuova === null ? null : g?.person?.foto} />}

          {personId ? (
            <>
              {fotoPersone && <div className="riga modulo-facce">
                <label className="piccolo come-pulsante">
                  {preparo ? "Preparo…" : "Carica foto"}
                  {/* `capture` non e forzato: su telefono il sistema propone
                      comunque fotocamera o galleria, e imporre la fotocamera
                      impedirebbe di scegliere una foto gia scattata. */}
                  <input type="file" accept="image/*" hidden disabled={preparo}
                         onChange={async (ev) => {
                           const f = ev.target.files?.[0];
                           ev.target.value = "";     // si puo riscegliere lo stesso file
                           if (!f) return;
                           setFotoErr(null); setPreparo(true);
                           try { setFotoNuova(await preparaFoto(f)); }
                           catch (e: any) { setFotoErr(e?.message ?? "Immagine non leggibile."); }
                           finally { setPreparo(false); }
                         }} />
                </label>
                {(fotoNuova || (g?.person?.foto && fotoNuova !== null)) && (
                  <button type="button" className="piccolo"
                          onClick={() => { setFotoNuova(null); setFotoErr(null); }}>
                    Togli foto
                  </button>
                )}
              </div>}
              {fotoPersone && fotoErr && <p className="piccolo errore-riga">{fotoErr}</p>}
              {fotoPersone && fotoNuova && (
                <p className="piccolo muto modulo-nota">
                  Ritagliata al centro, {Math.round(byteDiDataUri(fotoNuova) / 1024)} KB.
                  Si salva insieme al resto.
                </p>
              )}

              {componi && (
                <AvatarPersonalizza stile={stile} opzioni={opzioni} onCambia={setOpzioni} />
              )}

              {/* Gli avatar disegnati restano: sono cio che si vede senza foto,
                  e tornano se la foto viene tolta. */}
              <div className="album-stili">
                {STILI.map((st) => (
                  <button key={st} type="button"
                          className={`stile ${NOME_API[st] === stile ? "scelto" : ""}`}
                          title={st} onClick={() => setStile(NOME_API[st])}>
                    <Avatar seme={semeVisto} stile={NOME_API[st]} d={30} opzioni={opzioni} />
                  </button>
                ))}
              </div>
              <div className="riga modulo-facce">
                <button type="button" className="piccolo"
                        onClick={() => setSeme(Math.random().toString(36).slice(2, 10))}>
                  Cambia faccia
                </button>
                {seme && (
                  <button type="button" className="piccolo" onClick={() => setSeme(null)}>
                    Dal nome
                  </button>
                )}
                <button type="button" className={`piccolo ${componi ? "attivo" : ""}`}
                        onClick={() => setComponi((v) => !v)}
                        title="Scegli capelli, occhi, incarnato invece di affidarti al caso">
                  Componi
                </button>
                {Object.keys(opzioni).length > 0 && (
                  <button type="button" className="piccolo" onClick={() => setOpzioni({})}
                          title="Torna alla faccia generata dal seme">
                    Azzera scelte
                  </button>
                )}
              </div>
            </>
          ) : (
            <p className="piccolo muto modulo-nota">
              Volto generato dal nome. Per sceglierlo serve una persona collegata.
            </p>
          )}
        </div>

        <div className="modulo-campi">
          <div className="campi-riga campi-anagrafica">
            {/* Il numero sta DENTRO una maglia: "N." puo voler dire qualsiasi
                cosa, una maglia con dentro un numero no. L'etichetta sparisce
                perche il disegno la dice gia. */}
            <div className="campo campo-maglia">
              <MagliaPiena d={62} className="campo-maglia-forma" />
              <input type="number" min={0} max={99} value={d.numeroMaglia}
                     aria-label="Numero di maglia" title="Numero di maglia"
                     onChange={(e) => setD({ ...d, numeroMaglia: e.target.value })} />
              {err?.details?.numeroMaglia && (
                <div className="errore-campo">{err.details.numeroMaglia.join(". ")}</div>
              )}
            </div>
            <Campo etichetta="Cognome" errore={err?.details?.cognome}>
              <input value={d.cognome} onChange={(e) => setD({ ...d, cognome: e.target.value })} />
            </Campo>
            <Campo etichetta="Nome" errore={err?.details?.nome}>
              <input value={d.nome} onChange={(e) => setD({ ...d, nome: e.target.value })} />
            </Campo>
          </div>

          <div className="campi-riga campi-ruolo">
            <Campo etichetta="Ruolo">
              <select value={d.ruolo} onChange={(e) => setD({ ...d, ruolo: e.target.value })}>
                <option value="">—</option>
                {RUOLI.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </Campo>
            {/* La spunta non compare quando il ruolo dice gia "libero": due
                comandi per la stessa cosa e cio che li faceva discordare. */}
            {d.ruolo !== "libero" && (
              <label className="spunta">
                <input type="checkbox" checked={d.libero}
                       onChange={(e) => setD({ ...d, libero: e.target.checked })} />
                <span>Libero</span>
              </label>
            )}
          </div>

          {err && !err.details && <div className="avviso errore piccolo">{err.message}</div>}

          <div className="modulo-comandi">
            <button className="primario piccolo" disabled={!pronto || salva.isPending}
                    onClick={() => salva.mutate()}>
              {salva.isPending ? "Salvataggio…" : "Salva"}
            </button>
            {!nuova && (
              <button className="pericolo piccolo" disabled={elimina.isPending}
                      onClick={() => elimina.mutate()}>Togli dalla rosa</button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
