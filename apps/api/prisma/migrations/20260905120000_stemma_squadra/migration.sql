-- Lo stemma della squadra: disegnato dalle iniziali, oppure caricato.
ALTER TABLE "Team" ADD COLUMN "logoStile" TEXT;
ALTER TABLE "Team" ADD COLUMN "logoSeme" TEXT;
ALTER TABLE "Team" ADD COLUMN "logoOpzioniJson" TEXT;

-- I byte in tabella separata: l'elenco delle squadre finisce in locale su
-- ogni dispositivo, e non deve portarsi dietro le immagini.
CREATE TABLE "TeamLogo" (
    "teamId" TEXT NOT NULL,
    "dati" BYTEA NOT NULL,
    "tipo" TEXT NOT NULL,
    "byte" INTEGER NOT NULL,
    "aggiornatoIl" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TeamLogo_pkey" PRIMARY KEY ("teamId")
);

ALTER TABLE "TeamLogo" ADD CONSTRAINT "TeamLogo_teamId_fkey"
    FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;
