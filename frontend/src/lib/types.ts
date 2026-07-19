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

export type MoistureTrendDirection = "INCREASING" | "DECREASING" | "STABLE" | "INSUFFICIENT_DATA";

export type MoistureReadingPoint = {
  recordedAt: string;
  moisturePercent: number;
};

export type MoistureTrendResult = {
  direction: MoistureTrendDirection;
  readingCount: number;
  // Omitted by the API when direction is INSUFFICIENT_DATA — there is no
  // fabricated change to report without enough evidence for one.
  earliest?: MoistureReadingPoint;
  latest?: MoistureReadingPoint;
  changePercent?: number;
};

export type DryingRateState = "VALID" | "LOW_CONFIDENCE" | "INSUFFICIENT_DATA" | "NOT_DRYING";

export type DryingPeriodResult = {
  state: DryingRateState;
  periodStart: string;
  periodEnd: string;
  readingCount: number;
  // Omitted unless state is VALID or LOW_CONFIDENCE.
  ratePercentPerHour?: number;
  hasGap: boolean;
};

export type DryingRateAnalysis = {
  analysisPeriodStart: string;
  analysisPeriodEnd: string;
  unit: "percent_per_hour";
  periods: DryingPeriodResult[];
};

export type ApiErrorDetail = { field: string; message: string };

export type ApiError = {
  code:
    | "VALIDATION_ERROR"
    | "UNAUTHORIZED"
    | "FORBIDDEN"
    | "NOT_FOUND"
    | "CONFLICT"
    | "TOO_MANY_REQUESTS"
    | "INTERNAL_ERROR";
  message: string;
  requestId?: string;
  details?: ApiErrorDetail[] | Record<string, unknown>;
};

export type User = {
  id: string;
  email: string;
  name: string | null;
  createdAt: string;
  updatedAt: string;
};
