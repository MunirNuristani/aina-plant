import { z } from 'zod';

// ESP32 uses a 12-bit ADC: raw readings are integers in [0, 4095].
const RAW_ADC_MIN = 0;
const RAW_ADC_MAX = 4095;

// Wi-Fi RSSI is reported in dBm and is virtually always <= 0; anything
// weaker than about -100 dBm isn't a usable connection.
const WIFI_RSSI_MIN = -100;
const WIFI_RSSI_MAX = 0;

// Permissive semver-like check: MAJOR.MINOR.PATCH with an optional
// pre-release/build suffix (e.g. "1.2.3", "1.2.3-beta", "1.2.3+build.1").
const FIRMWARE_VERSION_PATTERN = /^\d+\.\d+\.\d+(?:[-+].+)?$/;

export const sensorReadingSchema = z.object({
  readingId: z.string().uuid('readingId must be a valid UUID'),
  deviceId: z.string().uuid('deviceId must be a valid UUID'),

  // Must be UTC ("Z" suffix) so every reading is stored in one consistent format.
  recordedAt: z.iso.datetime({ message: 'recordedAt must be an ISO 8601 UTC timestamp' }),

  rawMoisture: z
    .number('rawMoisture must be a number')
    .int('rawMoisture must be an integer')
    .min(RAW_ADC_MIN, `rawMoisture must be between ${RAW_ADC_MIN} and ${RAW_ADC_MAX}`)
    .max(RAW_ADC_MAX, `rawMoisture must be between ${RAW_ADC_MIN} and ${RAW_ADC_MAX}`),

  moisturePercent: z
    .number('moisturePercent must be a number')
    .min(0, 'moisturePercent must be between 0 and 100')
    .max(100, 'moisturePercent must be between 0 and 100'),

  firmwareVersion: z
    .string()
    .regex(
      FIRMWARE_VERSION_PATTERN,
      'firmwareVersion must look like a semantic version, e.g. 1.2.3',
    )
    .optional(),

  wifiRssi: z
    .number('wifiRssi must be a number')
    .int('wifiRssi must be an integer')
    .min(WIFI_RSSI_MIN, `wifiRssi must be between ${WIFI_RSSI_MIN} and ${WIFI_RSSI_MAX}`)
    .max(WIFI_RSSI_MAX, `wifiRssi must be between ${WIFI_RSSI_MIN} and ${WIFI_RSSI_MAX}`)
    .optional(),
});

export type SensorReadingInput = z.infer<typeof sensorReadingSchema>;
