import { z } from 'zod';

// A quick admin glance at recent activity, not bulk chart data — smaller
// cap than the per-plant history endpoint's.
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 500;

export const recentReadingsQuerySchema = z.object({
  limit: z.coerce
    .number('limit must be a number')
    .int('limit must be a whole number')
    .positive('limit must be greater than 0')
    .max(MAX_LIMIT, `limit must be at most ${MAX_LIMIT}`)
    .default(DEFAULT_LIMIT),
});

export type RecentReadingsQuery = z.infer<typeof recentReadingsQuerySchema>;
