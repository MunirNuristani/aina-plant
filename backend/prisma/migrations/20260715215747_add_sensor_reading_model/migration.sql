-- CreateTable
CREATE TABLE "SensorReading" (
    "id" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "plantId" TEXT NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rawMoisture" INTEGER NOT NULL,
    "moisturePercent" DOUBLE PRECISION NOT NULL,
    "firmwareVersion" TEXT,
    "wifiRssi" INTEGER,

    CONSTRAINT "SensorReading_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "SensorReading_moisturePercent_range" CHECK ("moisturePercent" >= 0 AND "moisturePercent" <= 100)
);

-- CreateIndex
CREATE INDEX "SensorReading_plantId_recordedAt_idx" ON "SensorReading"("plantId", "recordedAt");

-- CreateIndex
CREATE INDEX "SensorReading_deviceId_idx" ON "SensorReading"("deviceId");

-- AddForeignKey
ALTER TABLE "SensorReading" ADD CONSTRAINT "SensorReading_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SensorReading" ADD CONSTRAINT "SensorReading_plantId_fkey" FOREIGN KEY ("plantId") REFERENCES "Plant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
