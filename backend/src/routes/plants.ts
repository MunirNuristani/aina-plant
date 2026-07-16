import { Router } from 'express';
import { getLatestReadingForPlant } from '../services/reading-service';

export const plantsRouter = Router();

plantsRouter.get('/:plantId/readings/latest', async (req, res) => {
  const reading = await getLatestReadingForPlant(req.params.plantId);
  res.status(200).json({ reading });
});
