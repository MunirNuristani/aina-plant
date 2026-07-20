import { z } from 'zod';

// FR-DEVICE-003: reporting interval must be a whole number of seconds greater than zero.
const reportingIntervalSchema = z
  .number('reportingIntervalSeconds must be a number')
  .int('reportingIntervalSeconds must be a whole number of seconds')
  .positive('reportingIntervalSeconds must be greater than 0 seconds');

export const createDeviceSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'name is required')
    .max(100, 'name must be at most 100 characters'),
  identifier: z.string().trim().min(1, 'identifier is required'),
  firmwareVersion: z.string().trim().min(1).optional(),
  reportingIntervalSeconds: reportingIntervalSchema.optional(),
});

export type CreateDeviceInput = z.infer<typeof createDeviceSchema>;

export const updateDeviceConfigSchema = z
  .object({
    name: z.string().trim().min(1).max(100, 'name must be at most 100 characters').optional(),
    firmwareVersion: z.string().trim().min(1).nullable().optional(),
    reportingIntervalSeconds: reportingIntervalSchema.optional(),
    enabled: z.boolean().optional(),
    // Deliberately z.null() only, not z.string().nullable() -- this lets a
    // caller *unassign* a device (clear plantId) through this generic
    // config update, but never *assign* one through it. Assigning to a
    // specific plant must go through POST /devices/:id/assign instead,
    // which verifies the target plant belongs to the same user; accepting
    // an arbitrary non-null plantId here would bypass that check entirely.
    plantId: z.null().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided',
  });

export type UpdateDeviceConfigInput = z.infer<typeof updateDeviceConfigSchema>;

export const assignDeviceSchema = z.object({
  plantId: z.string().trim().min(1, 'plantId is required'),
  reassign: z.boolean().optional().default(false),
});

export type AssignDeviceInput = z.infer<typeof assignDeviceSchema>;

export const deviceAuthSchema = z.object({
  identifier: z.string().trim().min(1, 'identifier is required'),
  credential: z.string().trim().min(1, 'credential is required'),
});

export type DeviceAuthInput = z.infer<typeof deviceAuthSchema>;
