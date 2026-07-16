import { Router } from 'express';
import { getLatestReadingForPlant, listReadingsForPlant } from '../services/reading-service';
import { listReadingsQuerySchema } from '../validation/reading-query';
import { toFieldErrors, ValidationError } from '../http/errors';

export const plantsRouter = Router();

plantsRouter.get('/:plantId/readings/latest', async (req, res) => {
  const reading = await getLatestReadingForPlant(req.params.plantId);
  res.status(200).json({ reading });
});

plantsRouter.get('/:plantId/readings', async (req, res) => {
  const parsed = listReadingsQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    throw new ValidationError('Invalid query parameters', toFieldErrors(parsed.error.issues));
  }

  const readings = await listReadingsForPlant(req.params.plantId, {
    start: parsed.data.start ? new Date(parsed.data.start) : undefined,
    end: parsed.data.end ? new Date(parsed.data.end) : undefined,
    sort: parsed.data.sort,
    limit: parsed.data.limit,
  });

  res.status(200).json({ readings });
});
