import express, { Application, NextFunction, Request, Response } from 'express';
import { devicesRouter } from './routes/devices';
import { readingsRouter } from './routes/readings';
import { plantsRouter } from './routes/plants';
import { AppError } from './http/errors';
import { requestIdMiddleware } from './middleware/request-id';
import { logger } from './lib/logger';

export function createApp(): Application {
  const app = express();

  // Must run first: establishes the request ID (and its AsyncLocalStorage
  // context) before anything else — including validation/auth failures —
  // has a chance to log.
  app.use(requestIdMiddleware);

  app.use(express.json());

  app.get('/health', (_req, res) => {
    res.status(200).json({ status: 'ok' });
  });

  app.use('/devices', devicesRouter);
  app.use('/api/v1/readings', readingsRouter);
  app.use('/api/v1/plants', plantsRouter);

  app.use((req, res) => {
    res.status(404).json({ error: { message: 'Not found', requestId: req.id } });
  });

  app.use((err: unknown, req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof AppError) {
      res.status(err.statusCode).json({
        error: {
          message: err.message,
          requestId: req.id,
          ...(err.details ? { details: err.details } : {}),
        },
      });
      return;
    }

    logger.error('Unhandled error:', err);
    res.status(500).json({ error: { message: 'Internal server error', requestId: req.id } });
  });

  return app;
}
