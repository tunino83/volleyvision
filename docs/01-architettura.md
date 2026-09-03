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
| `trasferimento` | a blocchi con ripresa | idem | idem, **solo in primo piano** |
| `rete` | tipo di connessione, se il browser lo dice | idem | idem |
| `media` | **non supportato** | protocollo con Range | **non supportato** |
| `credenziali` | memoria locale | memoria sicura | memoria sicura |

Il meccanismo di trasferimento e **uno solo**, in `platform/trasferimento.ts`:
blocchi, ripresa, ritentativi con attesa crescente. Le shell non lo riscrivono,
gli passano due parametri — dimensione massima del blocco e se il trasferimento
si ferma uscendo dal primo piano. Il caso mobile non e una piattaforma diversa:
e lo stesso codice con blocchi da 2 MB invece che da 8 e la sospensione attiva.

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
