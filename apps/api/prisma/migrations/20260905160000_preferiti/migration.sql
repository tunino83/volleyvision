-- Squadre e persone messe in evidenza da UN utente.
--
-- Due tabelle e non due colonne booleane: una squadra si puo condividere, e
-- una colonna su "Team" farebbe comparire la scelta del proprietario sulla
-- home di chi la riceve. Preferire e un gesto di chi guarda.
CREATE TABLE "SquadraPreferita" (
    "userId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "creatoIl" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SquadraPreferita_pkey" PRIMARY KEY ("userId","teamId")
);
CREATE INDEX "SquadraPreferita_userId_idx" ON "SquadraPreferita"("userId");

CREATE TABLE "PersonaPreferita" (
    "userId" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "creatoIl" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PersonaPreferita_pkey" PRIMARY KEY ("userId","personId")
);
CREATE INDEX "PersonaPreferita_userId_idx" ON "PersonaPreferita"("userId");

ALTER TABLE "SquadraPreferita" ADD CONSTRAINT "SquadraPreferita_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SquadraPreferita" ADD CONSTRAINT "SquadraPreferita_teamId_fkey"
    FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PersonaPreferita" ADD CONSTRAINT "PersonaPreferita_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PersonaPreferita" ADD CONSTRAINT "PersonaPreferita_personId_fkey"
    FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;
