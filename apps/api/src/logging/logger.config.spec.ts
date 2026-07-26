import { createLoggerConfig, LOGGER_REDACT_PATHS } from './logger.config';

describe('logger redaction', () => {
  it('redacts phone numbers in request bodies and log objects', () => {
    expect(LOGGER_REDACT_PATHS).toEqual(expect.arrayContaining(['req.body.phone', 'phone']));
  });
});

describe('logger transport', () => {
  it('fails with an actionable message when pretty logging is unavailable', () => {
    const missingModule = (): string => {
      throw new Error('module not found');
    };

    expect(() => createLoggerConfig('debug', false, missingModule)).toThrow(
      'Pretty logging requested with NODE_ENV!=production and LOG_LEVEL=debug, but pino-pretty is not installed.',
    );
  });
});
