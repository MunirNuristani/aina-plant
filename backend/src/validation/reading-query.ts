import { z } from 'zod';

// Charts/analytics shouldn't be able to pull unbounded history in one call.
const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 1000;

export const listReadingsQuerySchema = z
  .object({
    start: z.iso.datetime({ message: 'start must be an ISO 8601 UTC timestamp' }).optional(),
    end: z.iso.datetime({ message: 'end must be an ISO 8601 UTC timestamp' }).optional(),

    // asc (oldest first) is the default since charts plot time left-to-right;
    // desc (newest first) suits inspecting the most recent entries.
    sort: z.enum(['asc', 'desc']).default('asc'),

    limit: z.coerce
      .number('limit must be a number')
      .int('limit must be a whole number')
      .positive('limit must be greater than 0')
      .max(MAX_LIMIT, `limit must be at most ${MAX_LIMIT}`)
      .default(DEFAULT_LIMIT),
  })
  .refine((data) => !data.start || !data.end || new Date(data.start) <= new Date(data.end), {
    message: 'start must not be after end',
    path: ['start'],
  });

export type ListReadingsQuery = z.infer<typeof listReadingsQuerySchema>;
