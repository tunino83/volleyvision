import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { piattaforma } from "../platform";
import { dimenticaTutto } from "../locale/scarico";
import { dimenticaFoto } from "../componenti/Avatar";
import { API, impostaSessione, haSessione, eDiRete } from "../api/client";

/** Un modo di accedere: password oggi, Google domani. Mai segreti. */
export interface Identita {
  id: string; provider: string; etichetta: string;
  ultimoUsoIl: string | null; creatoIl: string;
}

export interface Utente {
  id: string; email: string; nome: string; cognome: string;
  ruolo: "admin" | "segreteria" | "utente"; stato: string;
  emailVerificataIl: string | null;
  identita: Identita[];
}

interface Ctx {
  utente: Utente | null;
  caricamento: boolean;
  /**
   * Vero quando il profilo viene dall'ultima copia locale e non dal server.
   * L'interfaccia lo usa per non offrire modifiche che non potrebbe inviare.
   */
  profiloDaCopia: boolean;
  accedi(email: string, password: string): Promise<void>;
  esci(): Promise<void>;
  ricarica(): Promise<void>;
}

const C = createContext<Ctx>(null!);
export const useAuth = () => useContext(C);

/**
 * L'ultimo profilo conosciuto, per poter entrare senza rete.
 *
 * Non e un segreto — sono nome, email e ruolo dell'utente stesso — e non da
 * accesso a nulla: **le autorizzazioni le applica il server a ogni chiamata**.
 * Un ruolo alterato qui cambierebbe solo quali voci di menu compaiono, e
 * senza rete quelle azioni non partono comunque.
 *
 * Si cancella all'uscita, insieme al deposito delle risposte.
 */
const CHIAVE_PROFILO = "vv.utente";

function profiloSalvato(): Utente | null {
  try { const g = localStorage.getItem(CHIAVE_PROFILO); return g ? JSON.parse(g) : null; }
  catch { return null; }   // scrittura corrotta: si riparte dal server
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [utente, setUtente] = useState<Utente | null>(null);
  const [caricamento, setCaricamento] = useState(true);
  const [profiloDaCopia, setProfiloDaCopia] = useState(false);

  /**
   * Tre esiti, non due. E la correzione che rende possibile l'uso senza rete:
   *
   *   il server risponde       -> profilo aggiornato, se ne tiene copia
   *   il server dice 401       -> la sessione **e** scaduta: si esce
   *   il server non risponde   -> non si sa nulla: si **tiene** la sessione
   *                               e si entra con l'ultima copia
   *
   * Il terzo caso prima finiva nel secondo, e cancellava anche il token di
   * rinnovo: un attimo di rete assente all'avvio disconnetteva per davvero.
   *
   * Non serve una scadenza inventata per la sessione senza rete: quando la
   * rete torna, il token di rinnovo o vale ancora o no. La sua durata (30
   * giorni) **e** il tempo massimo che si puo restare offline.
   */
  const ricarica = async () => {
    if (!haSessione()) { setUtente(null); setCaricamento(false); return; }
    try {
      const u = await API.get<Utente>("/auth/me");
      setUtente(u);
      setProfiloDaCopia(false);
      localStorage.setItem(CHIAVE_PROFILO, JSON.stringify(u));
    } catch (e) {
      const copia = profiloSalvato();
      if (eDiRete(e) && copia) {
        setUtente(copia);
        setProfiloDaCopia(true);
      } else {
        setUtente(null);
        setProfiloDaCopia(false);
        impostaSessione(null, null);
        localStorage.removeItem(CHIAVE_PROFILO);
      }
    } finally { setCaricamento(false); }
  };

  useEffect(() => { ricarica(); }, []);

  const accedi = async (email: string, password: string) => {
    const t = await API.post<{ access: string; refresh: string }>("/auth/login", { email, password });
    impostaSessione(t.access, t.refresh);
    const u = await API.get<Utente>("/auth/me");
    setUtente(u);
    setProfiloDaCopia(false);
    localStorage.setItem(CHIAVE_PROFILO, JSON.stringify(u));
  };

  const esci = async () => {
    try { await API.post("/auth/logout", {}); } catch { /* la sessione cade comunque */ }
    impostaSessione(null, null);
    setUtente(null);
    setProfiloDaCopia(false);
    localStorage.removeItem(CHIAVE_PROFILO);
    // Il guscio e il deposito locale riguardano l'utente che se ne va: su un
    // computer condiviso non devono sopravvivergli. Vale per entrambi.
    piattaforma.installazione.dimenticaDati();
    await dimenticaTutto();
    dimenticaFoto();
  };

  return <C.Provider value={{ utente, caricamento, profiloDaCopia, accedi, esci, ricarica }}>{children}</C.Provider>;
}
