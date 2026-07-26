import { validateAppConfig } from './app-config';

describe('validateAppConfig', () => {
  it('reports every invalid or missing key', () => {
    expect(() => validateAppConfig({ DATABASE_URL: 'not-a-url', API_PORT: '0' })).toThrow(
      expect.objectContaining({
        message: expect.stringMatching(/API_PORT[\s\S]*DATABASE_URL[\s\S]*TEST_DATABASE_URL[\s\S]*REDIS_URL[\s\S]*JWT_ACCESS_SECRET/),
      }),
    );
  });
});
