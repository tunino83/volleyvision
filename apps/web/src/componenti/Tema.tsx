import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { Luna, Sole } from "./Icone";

/**
 * Tema chiaro e scuro.
 *
 * **Il predefinito e scuro**, non "come il sistema": questo impianto e pensato
 * per lo schermo scuro — e cosi che si guardano gli sport, ed e li che il
 * giallo del pallone funziona come accento. Chi preferisce il chiaro lo sceglie
 * dall'interruttore, e la scelta resta.
 *
 * Resta possibile seguire il dispositivo (`sistema`), ma non e il punto di
 * partenza: partire di li darebbe a meta degli utenti un'interfaccia diversa
 * da quella per cui e stata disegnata.
 *
 * Il tema si scrive su `<html data-tema>`: il CSS fa il resto senza che nessun
 * componente sappia di che colore e.
 */

type Scelta = "sistema" | "chiaro" | "scuro";
const CHIAVE = "vv.tema";

interface Ctx { scelta: Scelta; effettivo: "chiaro" | "scuro"; imposta(s: Scelta): void }
const C = createContext<Ctx>(null!);
export const useTema = () => useContext(C);

const preferenzaSistema = (): "chiaro" | "scuro" =>
  typeof matchMedia === "function" && matchMedia("(prefers-color-scheme: dark)").matches
    ? "scuro" : "chiaro";

export function TemaProvider({ children }: { children: ReactNode }) {
  const [scelta, setScelta] = useState<Scelta>(
    () => (localStorage.getItem(CHIAVE) as Scelta) ?? "scuro");
  const [sistema, setSistema] = useState<"chiaro" | "scuro">(preferenzaSistema);

  // Se il dispositivo cambia tema mentre l'applicazione e aperta, la si segue.
  useEffect(() => {
    if (typeof matchMedia !== "function") return;
    const mq = matchMedia("(prefers-color-scheme: dark)");
    const f = () => setSistema(mq.matches ? "scuro" : "chiaro");
    mq.addEventListener("change", f);
    return () => mq.removeEventListener("change", f);
  }, []);

  const effettivo = scelta === "sistema" ? sistema : scelta;

  useEffect(() => {
    document.documentElement.dataset.tema = effettivo;
    // La barra del browser su mobile segue il colore di sfondo: senza, resta
    // bianca sopra un'applicazione scura e si vede la cucitura.
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", effettivo === "scuro" ? "#080c12" : "#eeeae2");
  }, [effettivo]);

  const imposta = (s: Scelta) => {
    setScelta(s);
    if (s === "sistema") localStorage.removeItem(CHIAVE);
    else localStorage.setItem(CHIAVE, s);
  };

  return <C.Provider value={{ scelta, effettivo, imposta }}>{children}</C.Provider>;
}

/** Interruttore a due posizioni. Un terzo stato visibile confonderebbe. */
export function InterruttoreTema() {
  const { effettivo, imposta } = useTema();
  const prossimo = effettivo === "scuro" ? "chiaro" : "scuro";
  return (
    <button className="icona-solo" onClick={() => imposta(prossimo)}
            title={`Passa al tema ${prossimo}`} aria-label={`Passa al tema ${prossimo}`}>
      {effettivo === "scuro" ? <Sole d={18} /> : <Luna d={18} />}
    </button>
  );
}
