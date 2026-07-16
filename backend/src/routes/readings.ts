import { Router } from 'express';
import { deviceAuthMiddleware } from '../middleware/device-auth';
import { sensorReadingSchema } from '../validation/reading';
import { recentReadingsQuerySchema } from '../validation/recent-readings-query';
import { ingestReading, listRecentReadings } from '../services/reading-service';
import { UnauthorizedError, ValidationError } from '../http/errors';

export const readingsRouter = Router();

readingsRouter.post('/', deviceAuthMiddleware, async (req, res) => {
  if (!req.device) {
    throw new UnauthorizedError('Authentication required');
  }

  const parsed = sensorReadingSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ValidationError('Invalid sensor reading payload', parsed.error.issues);
  }

  const result = await ingestReading(parsed.data, req.device);
  res.status(result.status === 'created' ? 201 : 200).json(result);
});

readingsRouter.get('/recent', async (req, res) => {
  const parsed = recentReadingsQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    throw new ValidationError('Invalid query parameters', parsed.error.issues);
  }

  const readings = await listRecentReadings(parsed.data.limit);
  res.status(200).json({ readings });
});
