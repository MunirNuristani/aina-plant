import type { NextFunction, ParamsDictionary, Request, Response } from 'express-serve-static-core';
import { verifyUserToken } from '../lib/jwt';
import { UnauthorizedError } from '../http/errors';

const BEARER_PREFIX = 'Bearer ';

// Generic over P (route params), like Express's own middlewares -- a
// non-generic Request type here would force TS to fall back to the
// widened ParamsDictionary (`string | string[]`) for every route this is
// combined with, instead of that route's own literal params type (e.g.
// `{ id: string }` for '/:id').
//
// Unlike deviceAuthMiddleware, this never hits the database -- the JWT's
// signature is itself the proof of identity, verified purely in-process.
export function userAuthMiddleware<P = ParamsDictionary>(
  req: Request<P>,
  _res: Response,
  next: NextFunction,
): void {
  const header = req.header('Authorization');

  if (!header || !header.startsWith(BEARER_PREFIX)) {
    throw new UnauthorizedError('Missing or invalid Authorization header');
  }

  const token = header.slice(BEARER_PREFIX.length).trim();
  const payload = verifyUserToken(token);

  req.user = { id: payload.sub, email: payload.email };
  next();
}
