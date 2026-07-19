import { PlantCard } from "@/components/plant-card";
import type { Plant, SensorReading } from "@/lib/types";

const basePlant: Plant = {
  id: "9c858901-8a57-4791-81fe-4c455b099bc9",
  name: "Balcony Fern",
  commonName: null,
  scientificName: null,
  location: "Living room window",
  notes: null,
  potSize: null,
  soilType: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  devices: [],
};

const freshReading: SensorReading = {
  id: "7c3e1a2b-4f5d-4a6e-9b8c-1d2e3f4a5b6c",
  deviceId: "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  plantId: basePlant.id,
  recordedAt: new Date(Date.now() - 8 * 60 * 1000).toISOString(),
  receivedAt: new Date().toISOString(),
  rawMoisture: 2048,
  moisturePercent: 96,
  firmwareVersion: "1.0.0",
  wifiRssi: -60,
};

// The common case: a plant with a recent reading.
export function WithReading() {
  return <PlantCard plant={basePlant} latestReading={freshReading} />;
}

// A plant with a device assigned but no reading has come in yet — the "No
// readings yet" state must show, never a fabricated moisture value.
export function NoReadingYet() {
  return (
    <PlantCard
      plant={{
        ...basePlant,
        id: "b2b6e1b0-3b0c-4a86-9e2f-2d6a2c9e4f11",
        name: "Kitchen Basil",
        location: "Kitchen counter",
      }}
      latestReading={null}
    />
  );
}

// location is optional on Plant — the card must still read well without it.
export function NoLocation() {
  return (
    <PlantCard
      plant={{
        ...basePlant,
        id: "e2a1f9d2-7c3b-4f1a-9d8e-6b5c4a3f2e1d",
        name: "Office Pothos",
        location: null,
      }}
      latestReading={{
        ...freshReading,
        moisturePercent: 62,
        recordedAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
      }}
    />
  );
}
