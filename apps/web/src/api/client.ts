import { segnalaEsito } from "../platform/installazione";

const BASE = (import.meta as any).env?.VITE_API_URL ?? "http://localhost:3001";

export interface ApiError { code: string; message: string;
  details?: Record<string, string[]>; correlationId?: string }

/**
 * La richiesta non e mai arrivata al server.
 *
 * Distinguerlo da una risposta di errore non e pedanteria: **"non ho potuto
 * chiedere" non e "la risposta e no"**. Confonderli e cio che faceva
 * cancellare la sessione a ogni singhiozzo di rete — l'utente si ritrovava
 * disconnesso per davvero, e non solo finche la rete tornava.
 */
export const ERRORE_DI_RETE = "ERRORE_DI_RETE";
export const eDiRete = (e: unknown): boolean =>
  !!e && typeof e === "object" && (e as ApiError).code === ERRORE_DI_RETE;

let access: string | null = localStorage.getItem("vv.access");
let refresh: string | null = localStorage.getItem("vv.refresh");

export function impostaSessione(a: string | null, r: string | null) {
  access = a; refresh = r;
  if (a) localStorage.setItem("vv.access", a); else localStorage.removeItem("vv.access");
  if (r) localStorage.setItem("vv.refresh", r); else localStorage.removeItem("vv.refresh");
}
export const haSessione = () => !!access;

async function esegui(percorso: string, init: RequestInit, riprova = true): Promise<Response> {
  const h = new Headers(init.headers);
  if (access) h.set("Authorization", `Bearer ${access}`);

  let res: Response;
  try {
    res = await fetch(`${BASE}/api${percorso}`, { ...init, headers: h });
    // Una risposta, anche di errore, significa che il server c'e.
    segnalaEsito(true);
  } catch (e) {
    // `fetch` solleva solo quando non c'e stata risposta: rete assente,
    // server irraggiungibile, richiesta annullata. Una risposta di errore
    // (401, 500) NON passa di qui. Chi chiama deve poterli distinguere.
    if ((e as Error)?.name === "AbortError") throw e;   // l'annullamento e voluto
    // E questo il fatto da cui l'interfaccia capisce di essere isolata:
    // `navigator.onLine` da solo non se ne accorgerebbe.
    segnalaEsito(false);
    throw { code: ERRORE_DI_RETE, message: "Il server non risponde." } as ApiError;
  }

  // Rinnovo automatico della sessione; se fallisce, ritorno al login.
  if (res.status === 401 && riprova && refresh) {
    const r = await fetch(`${BASE}/api/auth/refresh`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh }),
    });
    if (r.ok) {
      const t = await r.json();
      impostaSessione(t.access, t.refresh);
      return esegui(percorso, init, false);
    }
    impostaSessione(null, null);
    location.href = "/login";
  }
  return res;
}

async function json<T>(res: Response): Promise<T> {
  if (res.status === 204) return undefined as T;
  const corpo = await res.json().catch(() => ({ code: "ERRORE", message: res.statusText }));
  if (!res.ok) throw corpo as ApiError;
  return corpo as T;
}

export const API = {
  get: <T,>(p: string) => esegui(p, { method: "GET" }).then(json<T>),
  post: <T,>(p: string, b: unknown) => esegui(p, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(b) }).then(json<T>),
  put: <T,>(p: string, b: unknown) => esegui(p, {
    method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(b) }).then(json<T>),
  patch: <T,>(p: string, b: unknown) => esegui(p, {
    method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(b) }).then(json<T>),
  del: <T,>(p: string) => esegui(p, { method: "DELETE" }).then(json<T>),
  /** Invio di un blocco binario: usato solo dal livello di trasferimento. */
  raw: (p: string, b: Blob, segnale?: AbortSignal) =>
    esegui(p, { method: "POST", body: b, signal: segnale,
                headers: { "Content-Type": "application/octet-stream" } })
      .then(json<{ bytesRicevuti: number; completato: boolean }>),
};
