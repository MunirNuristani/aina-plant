import { AsyncLocalStorage } from 'node:async_hooks';

export type RequestContext = { requestId: string };

// Makes the current request's ID available to code that has no access to
// `req` (e.g. service-layer logging), without threading it through every
// function signature.
export const requestContext = new AsyncLocalStorage<RequestContext>();

export function getRequestId(): string | undefined {
  return requestContext.getStore()?.requestId;
}
