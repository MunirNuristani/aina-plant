import { getRequestId } from './request-context';

function prefix(message: string): string {
  const requestId = getRequestId();
  return requestId ? `[${requestId}] ${message}` : message;
}

export const logger = {
  log(message: string, ...args: unknown[]): void {
    console.log(prefix(message), ...args);
  },
  warn(message: string, ...args: unknown[]): void {
    console.warn(prefix(message), ...args);
  },
  error(message: string, ...args: unknown[]): void {
    console.error(prefix(message), ...args);
  },
};
