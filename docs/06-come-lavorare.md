# Come lavorare

## Avvio

```bash
npm run setup     # una volta: installa, costruisce, prepara il database
npm run dev       # API su :3001, web su :5173
```

Separatamente: `npm run dev:api`, `npm run dev:web`.

## Accessi di prova

Password `password123` per tutti.

| Email | Ruolo | Cosa vede |
|---|---|---|
| `admin@volleyvision.test` | admin | tutto, registro e reportistica |
| `segreteria@volleyvision.test` | segreteria | solo utenti e password |
| `utente@volleyvision.test` | utente | le proprie anagrafiche e partite |

I dati di esempio danno un campionato, due squadre da dodici giocatori con
persone collegate, una partita in attesa dei video e una gia pronta.

## Operazioni ricorrenti

```bash
npm run db:seed                          # ripristina i dati di esempio
npm run db:studio --workspace @vv/api    # ispeziona il database
npm run build:packages                   # dopo aver modificato schema o core
```

**Dopo ogni modifica a `packages/schema` o `packages/core` va rifatta la
costruzione dei pacchetti**: le applicazioni consumano `dist`, non il sorgente.

## Provare il caricamento a blocchi

Le email di verifica e reimpostazione **compaiono nel terminale dell'API**:
il driver di invio scrive a schermo.

Per provare la ripresa: avvia un caricamento, interrompi la rete o sospendi,
riprendi. Il server risponde con l'ultimo byte confermato e il client riparte
da li.

## Prima di considerare finita una modifica

1. `npx tsc --noEmit` nella cartella toccata
2. l'API si costruisce: `npm run build --workspace @vv/api`
3. il percorso principale funziona nel browser, non solo compila
4. gli stati vuoto ed errore sono gestiti
5. se hai chiuso un punto di `docs/05-interventi.md`, **aggiornalo**
