# Dati reali del fornitore — Bulgaria vs Cina

Volleyball Nations League 2021, 1 giugno 2021. Sono i **primi e unici dati
veri** ricevuti dal fornitore della computer vision: tutto il resto in
`dati-di-prova/` e sintetico.

| File | Cosa contiene |
|---|---|
| `events.json` | cosa e successo: 788 eventi, 128 azioni, 3 set |
| `videos.json` | le due telecamere: fps e **omografia** (pixel -> metri) |
| `frames.json` | dove stavano i giocatori: 21.644 fotogrammi, in **pixel** |

## Perche stanno qui

Il seed li importa per dare a ogni utente dimostrativo **una partita vera**
accanto a quelle sintetiche: e l'unica su cui il campo bidimensionale e il
salto al fotogramma si possono confrontare con un video reale.

Passano dallo stesso adattatore dell'esercizio, quindi portano con se anche i
loro difetti — confini dei set sbagliati, 15% di eventi senza giocatore — che
e esattamente cio che li rende utili: i dati sintetici sono troppo puliti.

## Attenzione

**Sono dati di un fornitore commerciale**, non materiale nostro. Se questo
repository diventa pubblico, vanno tolti o va verificato di averne il diritto.
La decisione e stata presa consapevolmente il 2026-09-04; questa nota esiste
perche non si perda.

## Il video

Il file video **non e qui** e non puo esserlo: sono gigabyte. Va procurato a
parte e collegato dall'applicazione, che lo legge dal disco senza caricarlo.
Riconoscimento: al minuto **1:55** deve esserci la battuta di apertura.
