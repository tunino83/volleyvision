-- CreateTable
CREATE TABLE "AnalysisPosizioni" (
    "analysisId" TEXT NOT NULL,
    "datiJson" TEXT NOT NULL,
    "fotogrammi" INTEGER NOT NULL,
    "byte" INTEGER NOT NULL,

    CONSTRAINT "AnalysisPosizioni_pkey" PRIMARY KEY ("analysisId")
);

-- AddForeignKey
ALTER TABLE "AnalysisPosizioni" ADD CONSTRAINT "AnalysisPosizioni_analysisId_fkey" FOREIGN KEY ("analysisId") REFERENCES "Analysis"("id") ON DELETE CASCADE ON UPDATE CASCADE;

