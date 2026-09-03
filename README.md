# Volley Vision

Piattaforma di video-analisi per la pallavolo — **Fase 1: gestionale, solo web**.

Si carica il video di una partita, un fornitore esterno lo analizza, la
piattaforma mostra i dati. Questa fase copre tutto **tranne** l'analisi:
anagrafiche, partite, formazioni, caricamento video e ciclo di elaborazione.

## Avvio rapido

```bash
npm run setup     # installa, costruisce, prepara il database con dati di esempio
npm run dev       # API su http://localhost:3001, web su http://localhost:5173
```

Accedi con `utente@volleyvision.test` / `password123`.

## Cosa c'e

- Registrazione, accesso, ruoli (admin, segreteria, utente), reimpostazione password
- Squadre con roster, campionati, persone (identita stabile fra partite)
- Condivisione via email in sola lettura
- Partite con roster, formazioni per set, sostituzioni, tag liberi
- Caricamento video a blocchi **con ripresa dopo interruzione**
- Ciclo di elaborazione e notifiche
- Amministrazione: utenti, registro operazioni, reportistica

## Cosa non c'e ancora

Riproduzione video, statistiche, applicazioni desktop e mobile: sono Fase 2 e 3.
L'elenco puntuale dei punti aperti e in [`docs/05-interventi.md`](docs/05-interventi.md).

## Struttura

```
packages/schema   tipi e validazioni condivisi (fonte unica)
packages/core     motore statistiche (pronto, usato dalla Fase 2)
apps/api          backend NestJS + Prisma
apps/web          interfaccia React + Vite
```

Documentazione tecnica in [`docs/`](docs/). L'analisi funzionale sta in `../docs/`.
