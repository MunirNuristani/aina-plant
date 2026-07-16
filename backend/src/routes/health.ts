import { Router } from 'express';
import { isDatabaseHealthy } from '../db';

export const healthRouter = Router();

healthRouter.get('/', async (req, res) => {
  const databaseHealthy = await isDatabaseHealthy();

  res.status(databaseHealthy ? 200 : 503).json({
    status: databaseHealthy ? 'healthy' : 'unhealthy',
    database: databaseHealthy ? 'healthy' : 'unhealthy',
    requestId: req.id,
  });
});
