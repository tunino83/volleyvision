import { useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { API } from "../api/client";
import { Carta } from "./Ui";
import { AvatarPersonalizza } from "./AvatarPersonalizza";
import { LogoSquadra, NOMI_STILE, STILI_LOGO, scordaLogo } from "./LogoSquadra";
import { LOGO_MAX_BYTE } from "@vv/schema";
import { preparaStemma } from "./ritaglia";

/**
 * Scegliere lo stemma di una squadra: disegnarlo, oppure caricarlo.
 *
 * Le due vie **non si escludono**. L'immagine caricata ha la precedenza ma
 * non cancella il disegno: chi la toglie ritrova quello di prima invece di
 * un riquadro vuoto. E il motivo per cui i due gruppi di comandi restano
 * visibili insieme, e non dietro due schede che si escludono a vicenda.
 */
export default function StemmaPersonalizza({ squadra }: { squadra: any }) {
  const qc = useQueryClient();
  const file = useRef<HTMLInputElement>(null);

  const [stile, setStile] = useState<string>(squadra.logoStile ?? "initials");
  const [seme, setSeme] = useState<string>(squadra.logoSeme ?? "");
  const [opzioni, setOpzioni] = useState<Record<string, string[]>>(squadra.logoOpzioni ?? {});
  const [errore, setErrore] = useState<string | null>(null);

  const aggiorna = () => {
    scordaLogo(squadra.id);
    qc.invalidateQueries({ queryKey: ["squadra", squadra.id] });
    qc.invalidateQueries({ queryKey: ["squadre"] });
    // Le schede delle partite mostrano lo stemma accanto ai nomi: senza
    // questo resterebbero col vecchio finche non si ricarica la pagina.
    qc.invalidateQueries({ queryKey: ["partite"] });
  };

  const salvaDisegno = useMutation({
    mutationFn: () => API.patch(`/teams/${squadra.id}/logo`, {
      logoStile: stile,
      // Il seme vuoto non e una stringa vuota: e "nessuna scelta", e allora
      // si usa il nome della squadra. Mandarlo vuoto lo fisserebbe a "".
      logoSeme: seme.trim() || null,
      logoOpzioni: Object.keys(opzioni).length ? opzioni : null,
    }),
    onSuccess: aggiorna,
  });

  const caricaFile = useMutation({
    mutationFn: async (f: File) => {
      const dataUri = await preparaStemma(f);
      return API.put(`/teams/${squadra.id}/logo`, { dataUri });
    },
    onSuccess: aggiorna,
    onError: (e: any) => setErrore(e?.message ?? "Immagine non accettata."),
  });

  const togliFile = useMutation({
    mutationFn: () => API.del(`/teams/${squadra.id}/logo`),
    onSuccess: aggiorna,
  });

  return (
    <Carta>
      <div className="riga-sp">
        <span className="etichetta">Stemma</span>
        {squadra.logo && <span className="piccolo muto">immagine caricata</span>}
      </div>

      <div className="stemma-scelta">
        <div className="stemma-anteprima">
          {/* Quello che si vede davvero in giro per l'applicazione: se c'e
              un'immagine caricata e lei, non il disegno che si sta componendo. */}
          <LogoSquadra nome={squadra.nome} stile={stile} seme={seme || null} opzioni={opzioni}
                       teamId={squadra.id} logo={squadra.logo} d={96} />
          {squadra.logo && (
            <p className="piccolo muto" style={{ margin: "6px 0 0", textAlign: "center" }}>
              Sotto c&apos;e ancora il disegno: togliendo l&apos;immagine torna lui.
            </p>
          )}
        </div>

        <div className="stemma-comandi">
          <label className="campo">
            <span className="piccolo muto">Tipo</span>
            <select value={stile} onChange={(e) => { setStile(e.target.value); setOpzioni({}); }}>
              {STILI_LOGO.map((s) => <option key={s} value={s}>{NOMI_STILE[s]}</option>)}
            </select>
          </label>

          {/*
            * Non per le iniziali: li il seme **sono le lettere**, e cambiarlo
            * trasformerebbe "Volley Modena" in "XA". Per quello stile la
            * varieta si prende dal colore di fondo, qui sotto.
            */}
          {stile !== "initials" && <label className="campo">
            <span className="piccolo muto">Variante</span>
            {/*
              * Il seme e la manopola che cambia tutto senza spiegare niente.
              * Chiamarlo "seme" non direbbe nulla a chi lo usa: quello che fa
              * e "dammene un altro", ed e cosi che si presenta.
              */}
            <div className="riga">
              <input value={seme} placeholder={squadra.nome}
                     onChange={(e) => setSeme(e.target.value)} />
              <button type="button" onClick={() => setSeme(Math.random().toString(36).slice(2, 8))}>
                Cambia
              </button>
            </div>
          </label>}

          {/* Gli stessi comandi degli avatar: cambia solo l'insieme di stili.
              Per questi il nome dell'API e gia quello del pacchetto. */}
          <AvatarPersonalizza stile={stile} opzioni={opzioni} onCambia={setOpzioni}
                              risolviStile={(s) => s ?? "initials"} />

          <div className="riga" style={{ marginTop: "var(--sp3)" }}>
            <button className="primario" disabled={salvaDisegno.isPending}
                    onClick={() => salvaDisegno.mutate()}>
              {salvaDisegno.isPending ? "Salvataggio…" : "Salva lo stemma"}
            </button>
          </div>
        </div>
      </div>

      <hr className="separatore" />

      <div className="riga" style={{ flexWrap: "wrap" }}>
        <input ref={file} type="file" accept="image/png,image/jpeg,image/webp"
               style={{ display: "none" }}
               onChange={(e) => {
                 setErrore(null);
                 const f = e.target.files?.[0];
                 if (f) caricaFile.mutate(f);
                 // Azzerato, o riscegliere lo stesso file non scatterebbe.
                 e.target.value = "";
               }} />
        <button disabled={caricaFile.isPending} onClick={() => file.current?.click()}>
          {caricaFile.isPending ? "Caricamento…" : squadra.logo ? "Sostituisci l'immagine" : "Carica un'immagine"}
        </button>
        {squadra.logo && (
          <button disabled={togliFile.isPending} onClick={() => togliFile.mutate()}>
            Togli l&apos;immagine
          </button>
        )}
      </div>

      {errore && <div className="avviso errore piccolo" style={{ marginTop: 8 }}>{errore}</div>}

      <p className="piccolo muto" style={{ marginBottom: 0 }}>
        PNG, JPEG o WebP fino a {Math.round(LOGO_MAX_BYTE / 1024)} KB.
        L&apos;immagine viene ridotta a 512 px sul lato lungo <b>senza
        tagliarla</b>: uno stemma largo entra intero, con lo spazio attorno,
        e la trasparenza si conserva.
      </p>
    </Carta>
  );
}
