-- ===========================================================================
-- VOLLEY VISION — creazione del database
--
-- Si esegue UNA VOLTA, con un'utenza amministrativa:
--
--   mysql -h 127.0.0.1 -P 3308 -u root -p < prisma/crea-database.sql
--
-- Poi le tabelle le crea Prisma:  npx prisma migrate deploy
-- Questo file NON crea tabelle: la loro forma sta nello schema Prisma, e
-- averla scritta in due posti significa vederla divergere.
--
-- PRIMA DI ESEGUIRLO cambia la password qui sotto. E scritta in chiaro in un
-- file: usane una per lo sviluppo e una diversa, mai committata, in esercizio.
-- ===========================================================================

-- utf8mb4 e non "utf8": il vecchio utf8 di MySQL e a tre byte e **non tiene
-- le emoji** ne diversi caratteri. I nomi che scrivono gli utenti prima o poi
-- li conterranno, e la riga verrebbe rifiutata al momento sbagliato.
--
-- La collation e `_ci`, cioe insensibile alle maiuscole: e cio che fa
-- funzionare le ricerche per cognome senza scrivere codice apposta. Su
-- PostgreSQL servirebbe `mode: "insensitive"` su ogni singola query.
CREATE DATABASE IF NOT EXISTS volleyvision
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

-- Un'utenza dedicata, non root: l'applicazione non deve poter cancellare
-- altri database ne creare utenze.
CREATE USER IF NOT EXISTS 'volleyvision'@'localhost'
  IDENTIFIED BY 'cambiami_in_sviluppo';
CREATE USER IF NOT EXISTS 'volleyvision'@'127.0.0.1'
  IDENTIFIED BY 'cambiami_in_sviluppo';

-- I permessi sul solo database dell'applicazione.
-- Servono anche ALTER, CREATE, DROP, INDEX e REFERENCES: le migrazioni di
-- Prisma modificano le tabelle, e senza non potrebbero girare. In esercizio,
-- se preferisci, si toglie DROP all'utenza applicativa e si eseguono le
-- migrazioni con un'utenza separata.
GRANT SELECT, INSERT, UPDATE, DELETE,
      CREATE, ALTER, DROP, INDEX, REFERENCES,
      CREATE TEMPORARY TABLES, LOCK TABLES
  ON volleyvision.* TO 'volleyvision'@'localhost';
GRANT SELECT, INSERT, UPDATE, DELETE,
      CREATE, ALTER, DROP, INDEX, REFERENCES,
      CREATE TEMPORARY TABLES, LOCK TABLES
  ON volleyvision.* TO 'volleyvision'@'127.0.0.1';

FLUSH PRIVILEGES;

SELECT 'database creato' AS esito,
       @@version AS versione,
       DEFAULT_CHARACTER_SET_NAME AS charset,
       DEFAULT_COLLATION_NAME AS collation
  FROM information_schema.SCHEMATA
 WHERE SCHEMA_NAME = 'volleyvision';
