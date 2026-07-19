import { z } from 'zod';

// Both windows default inside their respective service (24h for trend, 7
// days for drying rate) when the query param is omitted -- these schemas
// only validate an override when the caller supplies one.
export const moistureTrendQuerySchema = z.object({
  windowHours: z.coerce
    .number('windowHours must be a number')
    .positive('windowHours must be greater than 0')
    .optional(),
});

export type MoistureTrendQuery = z.infer<typeof moistureTrendQuerySchema>;

export const dryingRateQuerySchema = z.object({
  periodDays: z.coerce
    .number('periodDays must be a number')
    .positive('periodDays must be greater than 0')
    .optional(),
});

export type DryingRateQuery = z.infer<typeof dryingRateQuerySchema>;
