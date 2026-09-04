# Architettura

## Impianto

```
packages/schema    tipi e validazioni — fonte unica, nessuna dipendenza
packages/core      motore statistiche — TypeScript puro, nessuna dipendenza da interfaccia
        |
        +--> apps/api    NestJS + Prisma
        +--> apps/web    React + Vite
```

**Regola di dipendenza**: `core` non importa da `web`; `schema` non importa da
nessuno; le applicazioni non si importano fra loro. In Fase 2 va imposta
automaticamente in fase di compilazione.

## Il livello di astrazione delle piattaforme

`apps/web/src/platform/` — sei sole responsabilita:

| Responsabilita | Browser (Fase 1) | Desktop (Fase 2) | Mobile (Fase 3) |
|---|---|---|---|
| `spazio` | stima del browser | disco reale | disco del dispositivo |
| `file` | non supportato | pacchetti locali | solo dati |
| `trasferimento` | a blocchi con ripresa, **solo a scheda aperta** | idem | idem, ma **in secondo piano**: lo porta avanti un servizio nativo |
| `rete` | tipo di connessione, se il browser lo dice | idem | idem |
| `media` | **non supportato** | protocollo con Range | **non supportato** |
| `credenziali` | memoria locale | memoria sicura | memoria sicura |

Il meccanismo di trasferimento e **uno solo**, in `platform/trasferimento.ts`:
blocchi, ripresa, ritentativi con attesa crescente. Le shell non lo riscrivono,
gli passano due parametri — dimensione massima del blocco e se il trasferimento
si ferma uscendo dal primo piano.

**L'unica eccezione e il servizio Android** (`ServizioCaricamento.java`), che
riscrive quel ciclo in Java. Non poteva riusarlo: gira quando il WebView non
esiste piu, e cio che deve sopravvivere all'uscita dall'applicazione non puo
stare dentro l'applicazione. Ma non e un secondo *protocollo*: manda gli stessi
blocchi alla stessa API e chiede al server da dove ripartire, esattamente come
l'altro. E la regola 4b che tiene insieme le due copie — **lo stato sta sul
server** — e finche resta li, due implementazioni non possono divergere sui
numeri, solo sul codice.

Dove una capacita non esiste, la funzione non e raggiungibile: non si nasconde
un pulsante, non si registra la rotta.

**Oggi esiste solo `browser.ts`.** Aggiungere una shell significa scrivere una
nuova implementazione della stessa interfaccia, non toccare i componenti.

## Perche il motore statistiche e gia scritto

`packages/core` non serve alla Fase 1. E stato scritto lo stesso perche la
regola che lo governa non si puo ritrofittare:

```ts
// SI — il numero e l'insieme di eventi che lo compone
const k = select(eventi, { skill: "A", value: "Point" });
mostra(k.length);            // il numero
alClic(() => apri(k));       // gli eventi, gratis

// NO — il numero e basta
let punti = 0; /* ... */ mostra(punti);
```

Con la seconda forma, filtri ed explainability della Fase 2 andrebbero riscritti
da capo.

## Il server come adattatore

Il fornitore dell'analisi non e selezionato. Il backend converte qualunque cosa
riceva nel formato canonico (`packages/schema/src/analysis.ts`) e i client
conoscono solo quello. Se il fornitore cambia formato si tocca un modulo; se
cambia fornitore, se ne riscrive uno.

**L'adattatore assorbe le differenze di formato, non l'assenza di informazione.**
Se il materiale video non consente la navigazione puntuale, nessuna conversione
lo ricostruisce.
