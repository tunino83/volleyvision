-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "cognome" TEXT NOT NULL,
    "ruolo" TEXT NOT NULL DEFAULT 'utente',
    "stato" TEXT NOT NULL DEFAULT 'attivo',
    "emailVerificataIl" TIMESTAMP(3),
    "ultimoAccesso" TIMESTAMP(3),
    "creatoIl" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "emailInAttesa" TEXT,
    "emailInAttesaDal" TIMESTAMP(3),
    "sospesoIl" TIMESTAMP(3),
    "sospesoMotivo" TEXT,
    "privacyAccettataIl" TIMESTAMP(3),
    "privacyVersione" TEXT,
    "cancellazioneChiestaIl" TIMESTAMP(3),

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TentativoAccesso" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "utenteId" TEXT,
    "riuscito" BOOLEAN NOT NULL,
    "ip" TEXT,
    "agente" TEXT,
    "quando" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TentativoAccesso_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuthIdentity" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerUserId" TEXT NOT NULL,
    "passwordHash" TEXT,
    "profiloJson" TEXT,
    "ultimoUsoIl" TIMESTAMP(3),
    "creatoIl" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuthIdentity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Token" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "valore" TEXT NOT NULL,
    "scadeIl" TIMESTAMP(3) NOT NULL,
    "usatoIl" TIMESTAMP(3),
    "creatoIl" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Token_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Person" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "cognome" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "dataNascita" TIMESTAMP(3),
    "avatarStile" TEXT,
    "avatarSeme" TEXT,
    "creatoIl" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Person_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PersonaFoto" (
    "personId" TEXT NOT NULL,
    "dati" BYTEA NOT NULL,
    "tipo" TEXT NOT NULL,
    "byte" INTEGER NOT NULL,
    "aggiornataIl" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PersonaFoto_pkey" PRIMARY KEY ("personId")
);

-- CreateTable
CREATE TABLE "Team" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "stagione" TEXT NOT NULL,
    "creatoIl" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Team_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeamPlayer" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "personId" TEXT,
    "numeroMaglia" INTEGER NOT NULL,
    "cognome" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "ruolo" TEXT,
    "libero" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "TeamPlayer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeamShare" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "userId" TEXT,
    "email" TEXT NOT NULL,
    "statoInvito" TEXT NOT NULL DEFAULT 'attivo',
    "creatoIl" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TeamShare_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Competition" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "stagione" TEXT NOT NULL,
    "descrizione" TEXT,
    "dataInizio" TIMESTAMP(3),
    "dataFine" TIMESTAMP(3),
    "creatoIl" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Competition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompetitionShare" (
    "id" TEXT NOT NULL,
    "competitionId" TEXT NOT NULL,
    "userId" TEXT,
    "email" TEXT NOT NULL,
    "statoInvito" TEXT NOT NULL DEFAULT 'attivo',
    "creatoIl" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CompetitionShare_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Match" (
    "id" TEXT NOT NULL,
    "competitionId" TEXT NOT NULL,
    "homeTeamId" TEXT NOT NULL,
    "awayTeamId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "data" TIMESTAMP(3) NOT NULL,
    "citta" TEXT,
    "campo" TEXT,
    "arbitri" TEXT,
    "tagJson" TEXT NOT NULL DEFAULT '[]',
    "numeroSet" INTEGER,
    "stato" TEXT NOT NULL DEFAULT 'WAITING',
    "statoAggiornatoIl" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "erroreMessaggio" TEXT,
    "revisioneAnalisi" INTEGER,
    "creatoIl" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Match_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MatchPlayer" (
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "personId" TEXT,
    "lato" TEXT NOT NULL,
    "numeroMaglia" INTEGER NOT NULL,
    "cognome" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "ruolo" TEXT,
    "libero" BOOLEAN NOT NULL DEFAULT false,
    "capitano" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "MatchPlayer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lineup" (
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "set" INTEGER NOT NULL,
    "lato" TEXT NOT NULL,
    "pos1" INTEGER,
    "pos2" INTEGER,
    "pos3" INTEGER,
    "pos4" INTEGER,
    "pos5" INTEGER,
    "pos6" INTEGER,
    "libero1" INTEGER,
    "libero2" INTEGER,
    "primoServizio" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Lineup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Substitution" (
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "set" INTEGER NOT NULL,
    "lato" TEXT NOT NULL,
    "esce" INTEGER NOT NULL,
    "entra" INTEGER NOT NULL,
    "frame" INTEGER,
    "minuto" INTEGER,
    "creatoIl" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Substitution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Video" (
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "lato" INTEGER NOT NULL,
    "stato" TEXT NOT NULL DEFAULT 'ASSENTE',
    "nomeFile" TEXT,
    "mime" TEXT,
    "dimensione" BIGINT,
    "checksum" TEXT,
    "storageKey" TEXT,
    "normalizedKey" TEXT,
    "fps" DOUBLE PRECISION,
    "frameCount" INTEGER,
    "caricatoIl" TIMESTAMP(3),

    CONSTRAINT "Video_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UploadSession" (
    "id" TEXT NOT NULL,
    "videoId" TEXT NOT NULL,
    "nomeFile" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "dimensione" BIGINT NOT NULL,
    "bytesRicevuti" BIGINT NOT NULL DEFAULT 0,
    "chunkBytes" INTEGER NOT NULL,
    "stato" TEXT NOT NULL DEFAULT 'in_corso',
    "storageKey" TEXT NOT NULL,
    "scadeIl" TIMESTAMP(3) NOT NULL,
    "creatoIl" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "aggiornatoIl" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UploadSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lavorazione" (
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "richiedenteId" TEXT NOT NULL,
    "fornitore" TEXT NOT NULL,
    "riferimento" TEXT NOT NULL,
    "stato" TEXT NOT NULL DEFAULT 'in_corso',
    "attesoPer" TIMESTAMP(3),
    "messaggio" TEXT,
    "conclusaIl" TIMESTAMP(3),
    "creatoIl" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Lavorazione_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Analysis" (
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "revision" INTEGER NOT NULL,
    "pacchettoJson" TEXT NOT NULL,
    "qualitaJson" TEXT NOT NULL,
    "framesKey" TEXT,
    "creatoIl" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "aggiornatoIl" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Analysis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "matchId" TEXT,
    "tipo" TEXT NOT NULL,
    "vistaIl" TIMESTAMP(3),
    "creatoIl" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "azione" TEXT NOT NULL,
    "oggettoTipo" TEXT,
    "oggettoId" TEXT,
    "dettaglio" TEXT,
    "creatoIl" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "TentativoAccesso_email_quando_idx" ON "TentativoAccesso"("email", "quando");

-- CreateIndex
CREATE INDEX "TentativoAccesso_ip_quando_idx" ON "TentativoAccesso"("ip", "quando");

-- CreateIndex
CREATE INDEX "AuthIdentity_userId_idx" ON "AuthIdentity"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "AuthIdentity_provider_providerUserId_key" ON "AuthIdentity"("provider", "providerUserId");

-- CreateIndex
CREATE UNIQUE INDEX "Token_valore_key" ON "Token"("valore");

-- CreateIndex
CREATE INDEX "Token_userId_tipo_idx" ON "Token"("userId", "tipo");

-- CreateIndex
CREATE INDEX "Person_ownerId_idx" ON "Person"("ownerId");

-- CreateIndex
CREATE INDEX "Team_ownerId_idx" ON "Team"("ownerId");

-- CreateIndex
CREATE UNIQUE INDEX "TeamPlayer_teamId_numeroMaglia_key" ON "TeamPlayer"("teamId", "numeroMaglia");

-- CreateIndex
CREATE UNIQUE INDEX "TeamShare_teamId_email_key" ON "TeamShare"("teamId", "email");

-- CreateIndex
CREATE INDEX "Competition_ownerId_idx" ON "Competition"("ownerId");

-- CreateIndex
CREATE UNIQUE INDEX "CompetitionShare_competitionId_email_key" ON "CompetitionShare"("competitionId", "email");

-- CreateIndex
CREATE INDEX "Match_competitionId_idx" ON "Match"("competitionId");

-- CreateIndex
CREATE INDEX "Match_stato_idx" ON "Match"("stato");

-- CreateIndex
CREATE UNIQUE INDEX "MatchPlayer_matchId_lato_numeroMaglia_key" ON "MatchPlayer"("matchId", "lato", "numeroMaglia");

-- CreateIndex
CREATE UNIQUE INDEX "Lineup_matchId_set_lato_key" ON "Lineup"("matchId", "set", "lato");

-- CreateIndex
CREATE INDEX "Substitution_matchId_set_idx" ON "Substitution"("matchId", "set");

-- CreateIndex
CREATE UNIQUE INDEX "Video_matchId_lato_key" ON "Video"("matchId", "lato");

-- CreateIndex
CREATE UNIQUE INDEX "UploadSession_videoId_key" ON "UploadSession"("videoId");

-- CreateIndex
CREATE INDEX "Lavorazione_stato_idx" ON "Lavorazione"("stato");

-- CreateIndex
CREATE INDEX "Lavorazione_matchId_idx" ON "Lavorazione"("matchId");

-- CreateIndex
CREATE UNIQUE INDEX "Analysis_matchId_key" ON "Analysis"("matchId");

-- CreateIndex
CREATE INDEX "Notification_userId_vistaIl_idx" ON "Notification"("userId", "vistaIl");

-- CreateIndex
CREATE INDEX "AuditLog_creatoIl_idx" ON "AuditLog"("creatoIl");

-- AddForeignKey
ALTER TABLE "TentativoAccesso" ADD CONSTRAINT "TentativoAccesso_utenteId_fkey" FOREIGN KEY ("utenteId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuthIdentity" ADD CONSTRAINT "AuthIdentity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Token" ADD CONSTRAINT "Token_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Person" ADD CONSTRAINT "Person_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PersonaFoto" ADD CONSTRAINT "PersonaFoto_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Team" ADD CONSTRAINT "Team_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamPlayer" ADD CONSTRAINT "TeamPlayer_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamPlayer" ADD CONSTRAINT "TeamPlayer_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamShare" ADD CONSTRAINT "TeamShare_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamShare" ADD CONSTRAINT "TeamShare_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Competition" ADD CONSTRAINT "Competition_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompetitionShare" ADD CONSTRAINT "CompetitionShare_competitionId_fkey" FOREIGN KEY ("competitionId") REFERENCES "Competition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompetitionShare" ADD CONSTRAINT "CompetitionShare_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_competitionId_fkey" FOREIGN KEY ("competitionId") REFERENCES "Competition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_homeTeamId_fkey" FOREIGN KEY ("homeTeamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_awayTeamId_fkey" FOREIGN KEY ("awayTeamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchPlayer" ADD CONSTRAINT "MatchPlayer_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchPlayer" ADD CONSTRAINT "MatchPlayer_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lineup" ADD CONSTRAINT "Lineup_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Substitution" ADD CONSTRAINT "Substitution_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Video" ADD CONSTRAINT "Video_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UploadSession" ADD CONSTRAINT "UploadSession_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "Video"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lavorazione" ADD CONSTRAINT "Lavorazione_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Analysis" ADD CONSTRAINT "Analysis_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

