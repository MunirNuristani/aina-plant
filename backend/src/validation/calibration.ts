import { z } from 'zod';

// Calibration reference points share the same raw-ADC domain as
// SensorReading.rawMoisture (ESP32's 12-bit ADC: 0-4095).
const RAW_ADC_MIN = 0;
const RAW_ADC_MAX = 4095;

const rawAdcValueSchema = (fieldName: string) =>
  z
    .number(`${fieldName} must be a number`)
    .int(`${fieldName} must be an integer`)
    .min(RAW_ADC_MIN, `${fieldName} must be between ${RAW_ADC_MIN} and ${RAW_ADC_MAX}`)
    .max(RAW_ADC_MAX, `${fieldName} must be between ${RAW_ADC_MIN} and ${RAW_ADC_MAX}`);

export const calibrationSchema = z
  .object({
    deviceId: z.uuid('deviceId must be a valid UUID'),
    dryValue: rawAdcValueSchema('dryValue'),
    wetValue: rawAdcValueSchema('wetValue'),
    effectiveAt: z.iso
      .datetime({ message: 'effectiveAt must be an ISO 8601 UTC timestamp' })
      .optional(),
  })
  .refine((data) => data.dryValue !== data.wetValue, {
    message: 'dryValue and wetValue must not be equal',
    path: ['wetValue'],
  });

export type CalibrationInput = z.infer<typeof calibrationSchema>;
