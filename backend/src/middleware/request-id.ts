import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { requestContext } from '../lib/request-context';

export const REQUEST_ID_HEADER = 'X-Request-Id';

// A client-supplied ID is only accepted if it's shaped like a UUID (fixed
// length, hex + hyphens only). Anything else — arbitrary length, control
// characters, newlines that could forge log lines — is replaced with a
// freshly generated ID instead of being trusted or echoed back.
const SAFE_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isSafeRequestId(value: string): boolean {
  return SAFE_ID_PATTERN.test(value);
}

export function requestIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  const incoming = req.header(REQUEST_ID_HEADER);
  const requestId = incoming && isSafeRequestId(incoming) ? incoming : randomUUID();

  req.id = requestId;
  res.setHeader(REQUEST_ID_HEADER, requestId);

  requestContext.run({ requestId }, next);
}
