import type { NextFunction, Request, Response } from 'express';
import { authenticateDevice } from '../services/device-service';
import { UnauthorizedError } from '../http/errors';

export async function deviceAuthMiddleware(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  const identifier = req.header('X-Device-Id');
  const key = req.header('X-Device-Key');

  // Never log `key` — only whether it was present.
  if (!identifier || !key) {
    console.warn('[device-auth] rejected: missing X-Device-Id or X-Device-Key header');
    throw new UnauthorizedError('Missing X-Device-Id or X-Device-Key header');
  }

  req.device = await authenticateDevice(identifier, key);
  next();
}
