import { z } from 'zod';

// Optional descriptive fields: trimmed for consistency, but -- unlike name
// -- explicitly allowed to be empty (no .min(1)). "Optional fields may be
// empty" is a documented acceptance criterion for plant creation, not an
// oversight.
const optionalPlantFieldSchema = z.string().trim().optional();

export const createPlantSchema = z.object({
  // .trim() runs before .min(1), so a whitespace-only name (e.g. "   ")
  // is trimmed down to "" and rejected by the same check as a missing
  // name -- one rule covers both "name is required" and "whitespace-only
  // names are rejected".
  name: z
    .string()
    .trim()
    .min(1, 'name is required')
    .max(100, 'name must be at most 100 characters'),

  commonName: optionalPlantFieldSchema,
  scientificName: optionalPlantFieldSchema,
  location: optionalPlantFieldSchema,
  notes: optionalPlantFieldSchema,
  potSize: optionalPlantFieldSchema,
  soilType: optionalPlantFieldSchema,
});

export type CreatePlantInput = z.infer<typeof createPlantSchema>;

// For POST /api/v1/plants/:plantId/device -- the plant side of assignment.
// plantId comes from the URL, not the body (contrast with device.ts's
// assignDeviceSchema, whose plantId *is* a body field for the sibling
// device-centric endpoint, POST /devices/:id/assign).
export const assignPlantDeviceSchema = z.object({
  deviceId: z.string().trim().min(1, 'deviceId is required'),
  reassign: z.boolean().optional().default(false),
});

export type AssignPlantDeviceInput = z.infer<typeof assignPlantDeviceSchema>;
