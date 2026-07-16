import express, { Application, NextFunction, Request, Response } from 'express';
import { devicesRouter } from './routes/devices';
import { readingsRouter } from './routes/readings';
import { plantsRouter } from './routes/plants';
import { AppError } from './http/errors';

export function createApp(): Application {
  const app = express();

  app.use(express.json());

  app.get('/health', (_req, res) => {
    res.status(200).json({ status: 'ok' });
  });

  app.use('/devices', devicesRouter);
  app.use('/api/v1/readings', readingsRouter);
  app.use('/api/v1/plants', plantsRouter);

  app.use((_req, res) => {
    res.status(404).json({ error: { message: 'Not found' } });
  });

  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof AppError) {
      res.status(err.statusCode).json({
        error: { message: err.message, ...(err.details ? { details: err.details } : {}) },
      });
      return;
    }

    console.error(err);
    res.status(500).json({ error: { message: 'Internal server error' } });
  });

  return app;
}
