import { Writable } from 'node:stream';
import pino from 'pino';
import { describe, expect, it } from 'vitest';
import { createLogger, loggerOptions } from './logger';
import { requestContext } from './request-context';

function captureStream() {
  const chunks: string[] = [];
  const stream = new Writable({
    write(chunk, _encoding, callback) {
      chunks.push(chunk.toString());
      callback();
    },
  });
  return {
    stream,
    lines: () =>
      chunks
        .join('')
        .trim()
        .split('\n')
        .filter(Boolean)
        .map((line) => JSON.parse(line)),
  };
}

describe('logger redaction', () => {
  it('replaces a top-level secret-shaped field with a placeholder, never the raw value', () => {
    const { stream, lines } = captureStream();
    const testLogger = createLogger(stream);

    testLogger.info({ identifier: 'esp32-001', credential: 'super-secret-value' }, 'test event');

    const [line] = lines();
    expect(line.identifier).toBe('esp32-001');
    expect(line.credential).toBe('[Redacted]');
    expect(JSON.stringify(line)).not.toContain('super-secret-value');
  });

  it('redacts credentialHash and key fields the same way', () => {
    const { stream, lines } = captureStream();
    const testLogger = createLogger(stream);

    testLogger.info(
      { credentialHash: 'salt:derivedkey', key: 'raw-key-value' },
      'another test event',
    );

    const [line] = lines();
    expect(line.credentialHash).toBe('[Redacted]');
    expect(line.key).toBe('[Redacted]');
  });

  it('redacts a secret-shaped field nested one level deep', () => {
    const { stream, lines } = captureStream();
    const testLogger = createLogger(stream);

    testLogger.info({ device: { credential: 'nested-secret' } }, 'nested event');

    const [line] = lines();
    expect(line.device.credential).toBe('[Redacted]');
    expect(JSON.stringify(line)).not.toContain('nested-secret');
  });

  it('does not touch unrelated fields', () => {
    const { stream, lines } = captureStream();
    const testLogger = createLogger(stream);

    testLogger.info({ readingId: 'abc-123', rawMoisture: 2048 }, 'ingestion event');

    const [line] = lines();
    expect(line.readingId).toBe('abc-123');
    expect(line.rawMoisture).toBe(2048);
  });
});

describe('logger request context (mixin)', () => {
  it('includes the request ID on every log line inside a request context', () => {
    const { stream, lines } = captureStream();
    const testLogger = createLogger(stream);

    requestContext.run({ requestId: 'req-abc-123' }, () => {
      testLogger.info('inside context');
    });

    const [line] = lines();
    expect(line.requestId).toBe('req-abc-123');
  });

  it('omits the request ID field entirely outside any request context', () => {
    const { stream, lines } = captureStream();
    const testLogger = createLogger(stream);

    testLogger.info('outside any context');

    const [line] = lines();
    expect(line.requestId).toBeUndefined();
  });

  it('scopes the request ID correctly across nested async operations', async () => {
    const { stream, lines } = captureStream();
    const testLogger = createLogger(stream);

    await requestContext.run({ requestId: 'req-async-1' }, async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
      testLogger.info('after await');
    });

    const [line] = lines();
    expect(line.requestId).toBe('req-async-1');
  });
});

describe('logger level configuration', () => {
  it('suppresses log calls below the configured level', () => {
    const { stream, lines } = captureStream();
    const quietLogger = pino({ ...loggerOptions, level: 'error' }, stream);

    quietLogger.info('should not appear');
    quietLogger.warn('should not appear either');
    quietLogger.error('should appear');

    const output = lines();
    expect(output).toHaveLength(1);
    expect(output[0].msg).toBe('should appear');
  });

  it('emits log calls at or above the configured level', () => {
    const { stream, lines } = captureStream();
    const verboseLogger = pino({ ...loggerOptions, level: 'debug' }, stream);

    verboseLogger.debug('debug message');
    verboseLogger.info('info message');

    const output = lines();
    expect(output).toHaveLength(2);
  });
});
