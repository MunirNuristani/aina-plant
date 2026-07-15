-- CreateTable
CREATE TABLE "Device" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "identifier" TEXT NOT NULL,
    "credentialHash" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "reportingIntervalSeconds" INTEGER NOT NULL DEFAULT 900,
    "firmwareVersion" TEXT,
    "lastSeenAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Device_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Device_identifier_key" ON "Device"("identifier");
