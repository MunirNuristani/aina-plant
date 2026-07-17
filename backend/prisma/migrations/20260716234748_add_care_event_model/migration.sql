-- CreateEnum
CREATE TYPE "CareEventType" AS ENUM ('WATERING');

-- CreateTable
CREATE TABLE "CareEvent" (
    "id" TEXT NOT NULL,
    "type" "CareEventType" NOT NULL,
    "plantId" TEXT NOT NULL,
    "occurredAt" TIMESTAMPTZ(3) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "amount" DOUBLE PRECISION,
    "unit" TEXT,
    "notes" TEXT,
    "deletedAt" TIMESTAMPTZ(3),

    CONSTRAINT "CareEvent_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "CareEvent_amount_nonnegative" CHECK ("amount" IS NULL OR "amount" >= 0)
);

-- CreateIndex
CREATE INDEX "CareEvent_plantId_occurredAt_idx" ON "CareEvent"("plantId", "occurredAt");

-- AddForeignKey
ALTER TABLE "CareEvent" ADD CONSTRAINT "CareEvent_plantId_fkey" FOREIGN KEY ("plantId") REFERENCES "Plant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
