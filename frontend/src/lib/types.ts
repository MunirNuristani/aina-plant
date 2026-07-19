export type Device = {
  id: string;
  name: string;
  identifier: string;
  enabled: boolean;
  lastSeenAt: string | null;
  reportingIntervalSeconds: number;
  firmwareVersion: string | null;
};

export type Plant = {
  id: string;
  name: string;
  commonName: string | null;
  scientificName: string | null;
  location: string | null;
  notes: string | null;
  potSize: string | null;
  soilType: string | null;
  createdAt: string;
  updatedAt: string;
  devices: Device[];
};

export type SensorReading = {
  id: string;
  deviceId: string;
  plantId: string;
  recordedAt: string;
  receivedAt: string;
  rawMoisture: number;
  moisturePercent: number;
  firmwareVersion: string | null;
  wifiRssi: number | null;
};

export type CareEvent = {
  id: string;
  type: "WATERING";
  plantId: string;
  occurredAt: string;
  createdAt: string;
  amount: number | null;
  unit: string | null;
  notes: string | null;
  deletedAt: string | null;
};

export type ApiErrorDetail = { field: string; message: string };

export type ApiError = {
  code: "VALIDATION_ERROR" | "UNAUTHORIZED" | "FORBIDDEN" | "NOT_FOUND" | "CONFLICT" | "INTERNAL_ERROR";
  message: string;
  requestId?: string;
  details?: ApiErrorDetail[] | Record<string, unknown>;
};
