-- CreateTable
CREATE TABLE "Plant" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "commonName" TEXT,
    "scientificName" TEXT,
    "location" TEXT,
    "notes" TEXT,
    "potSize" TEXT,
    "soilType" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Plant_pkey" PRIMARY KEY ("id")
);
