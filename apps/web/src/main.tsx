import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import App from "./App";
import { AuthProvider } from "./auth/AuthContext";
import { TemaProvider } from "./componenti/Tema";
import "./stile.css";
import { piattaforma } from "./platform";
import { avvisa } from "./componenti/Avvisi";

// Il guscio senza rete. Va chiesto qui, prima di React: l'evento con cui il
// browser offre l'installazione arriva presto, e chi non lo trattiene lo perde.
//
// L'aggiornamento e automatico alla riapertura. Ma chi tiene l'applicazione
// aperta per giorni resterebbe sulla versione vecchia senza saperlo: quando
// se ne pubblica una nuova, glielo si dice.
piattaforma.installazione.registraGuscio(() => {
  avvisa("E disponibile una versione aggiornata di Volley Vision. "
       + "Ricarica per usarla.", { durata: 0 });
});

const qc = new QueryClient({ defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } } });

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={qc}>
      <BrowserRouter>
        <TemaProvider>
          <AuthProvider><App /></AuthProvider>
        </TemaProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>,
);
