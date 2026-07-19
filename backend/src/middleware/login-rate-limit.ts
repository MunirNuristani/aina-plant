import type { NextFunction, Request, Response } from 'express';
import { TooManyRequestsError } from '../http/errors';

// Minimal in-memory rate limiter for POST /auth/login. Known limitation:
// state resets on process restart and isn't shared across instances --
// acceptable for this app's current single-instance deployment. Revisit
// (e.g. a Redis-backed limiter) before running more than one instance.
const WINDOW_MS = 60_000;
const MAX_ATTEMPTS_PER_WINDOW = 10;

type Bucket = { count: number; resetAt: number };

const attemptsByIp = new Map<string, Bucket>();

export function loginRateLimit(req: Request, _res: Response, next: NextFunction): void {
  const key = req.ip ?? 'unknown';
  const now = Date.now();

  const bucket = attemptsByIp.get(key);

  if (!bucket || bucket.resetAt <= now) {
    attemptsByIp.set(key, { count: 1, resetAt: now + WINDOW_MS });
    next();
    return;
  }

  if (bucket.count >= MAX_ATTEMPTS_PER_WINDOW) {
    throw new TooManyRequestsError('Too many login attempts. Try again later.');
  }

  bucket.count += 1;
  next();
}
