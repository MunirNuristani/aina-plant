import { z } from 'zod';

// Mirrors CareEventType in prisma/schema.prisma -- only WATERING exists
// for now. Kept as its own z.enum (not derived from the Prisma enum
// directly) so this validation module has no dependency on the generated
// Prisma client, matching this project's other validation modules.
const careEventTypeSchema = z.enum(['WATERING']);

// FR-CARE-004: negative amounts are rejected -- this is the
// application-level half of the amount >= 0 rule; prisma/schema.prisma's
// CareEvent_amount_nonnegative CHECK constraint is the other half (see
// its comment for why both layers exist).
const amountSchema = z.number('amount must be a number').min(0, 'amount must not be negative');

export const createCareEventSchema = z.object({
  type: careEventTypeSchema,

  // Optional -- omitting it means "log this as having just happened"
  // (the service defaults to the current time), which matters for a
  // manually-logged event: a user watering a plant right now shouldn't
  // have to type or pick a timestamp just to record that.  When
  // provided, must be UTC ISO 8601, matching SensorReading's recordedAt
  // convention (see validation/reading.ts).
  occurredAt: z.iso
    .datetime({ message: 'occurredAt must be an ISO 8601 UTC timestamp' })
    .optional(),

  amount: amountSchema.optional(),
  unit: z.string().trim().min(1, 'unit must not be empty').optional(),
  notes: z.string().trim().optional(),
});

export type CreateCareEventInput = z.infer<typeof createCareEventSchema>;

export const updateCareEventSchema = z
  .object({
    type: careEventTypeSchema.optional(),
    occurredAt: z.iso
      .datetime({ message: 'occurredAt must be an ISO 8601 UTC timestamp' })
      .optional(),
    amount: amountSchema.optional(),
    unit: z.string().trim().min(1, 'unit must not be empty').optional(),
    notes: z.string().trim().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided',
  });

export type UpdateCareEventInput = z.infer<typeof updateCareEventSchema>;
