-- CreateTable
CREATE TABLE "Calibration" (
    "id" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "dryValue" INTEGER NOT NULL,
    "wetValue" INTEGER NOT NULL,
    "effectiveAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Calibration_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Calibration_deviceId_effectiveAt_idx" ON "Calibration"("deviceId", "effectiveAt");

-- AddForeignKey
ALTER TABLE "Calibration" ADD CONSTRAINT "Calibration_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
