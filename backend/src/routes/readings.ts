import { Router } from 'express';
import { deviceAuthMiddleware } from '../middleware/device-auth';
import { sensorReadingSchema } from '../validation/reading';
import { ingestReading } from '../services/reading-service';
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
