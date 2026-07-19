-- Every Plant/Device row predates the User model and has no owner to
-- backfill onto -- this migration deliberately wipes existing data rather
-- than inventing a placeholder owner. CASCADE sidesteps hand-ordering
-- deletes around the existing FK constraints (SensorReading/CareEvent ->
-- Plant, SensorReading/Calibration -> Device). This is a one-time,
-- deliberate data-loss step tied to introducing user ownership, not a
-- pattern to repeat in later migrations.
TRUNCATE TABLE "CareEvent", "SensorReading", "Calibration", "Device", "Plant" RESTART IDENTITY CASCADE;

-- AlterTable
ALTER TABLE "Device" ADD COLUMN     "userId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Plant" ADD COLUMN     "userId" TEXT NOT NULL;

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "Device_userId_idx" ON "Device"("userId");

-- CreateIndex
CREATE INDEX "Plant_userId_idx" ON "Plant"("userId");

-- AddForeignKey
ALTER TABLE "Plant" ADD CONSTRAINT "Plant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Device" ADD CONSTRAINT "Device_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
