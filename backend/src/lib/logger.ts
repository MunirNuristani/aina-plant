import pino, { type DestinationStream, type LoggerOptions } from 'pino';
import { config } from '../config';
import { getRequestId } from './request-context';

// No in-process `transport` (pino-pretty) here on purpose: transports run in
// a worker thread, which writes to stdout outside this process's main
// thread — making output impossible to intercept in tests and adding
// complexity for little benefit. For a readable local stream, pipe the raw
// JSON through pino-pretty instead: `npm run dev | npx pino-pretty`.
export const loggerOptions: LoggerOptions = {
  level: config.LOG_LEVEL,

  // Defense in depth: even if a future log call accidentally includes one
  // of these fields, the actual secret value never reaches output.
  redact: {
    paths: [
      'credential',
      'credentialHash',
      'key',
      '*.credential',
      '*.credentialHash',
      '*.key',
    ],
    censor: '[Redacted]',
  },

  // Makes the current request's ID (see request-context.ts) show up on
  // every log line emitted during that request — including from code with
  // no access to `req` at all, like the device-auth service functions.
  mixin() {
    const requestId = getRequestId();
    return requestId ? { requestId } : {};
  },
};

export function createLogger(destination?: DestinationStream): pino.Logger {
  return destination ? pino(loggerOptions, destination) : pino(loggerOptions);
}

export const logger = createLogger();
