import express, { Application } from 'express';
import { devicesRouter } from './routes/devices';
import { readingsRouter } from './routes/readings';
import { plantsRouter } from './routes/plants';
import { healthRouter } from './routes/health';
import { requestIdMiddleware } from './middleware/request-id';
import { errorHandler, notFoundHandler } from './middleware/error-handler';

export function createApp(): Application {
  const app = express();

  // Must run first: establishes the request ID (and its AsyncLocalStorage
  // context) before anything else — including validation/auth failures —
  // has a chance to log.
  app.use(requestIdMiddleware);

  app.use(express.json());

  app.use('/health', healthRouter);

  app.use('/devices', devicesRouter);
  app.use('/api/v1/readings', readingsRouter);
  app.use('/api/v1/plants', plantsRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
