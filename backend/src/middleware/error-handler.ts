import type { NextFunction, Request, Response } from 'express';
import { AppError } from '../http/errors';
import { logger } from '../lib/logger';

export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    error: { code: 'NOT_FOUND', message: 'Not found', requestId: req.id },
  });
}

// Must be registered last, after every route and after notFoundHandler —
// Express only routes to a 4-arg middleware when something upstream threw.
export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      error: {
        code: err.code,
        message: err.message,
        requestId: req.id,
        ...(err.details !== undefined ? { details: err.details } : {}),
      },
    });
    return;
  }

  // Never exposed to the client: full error (including stack trace) goes
  // only to the log, keyed by requestId for correlation.
  logger.error({ err }, 'Unhandled error');

  res.status(500).json({
    error: { code: 'INTERNAL_ERROR', message: 'Internal server error', requestId: req.id },
  });
}
