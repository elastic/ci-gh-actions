import { jest } from '@jest/globals';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

jest.mock('@actions/core', () => ({
  info: jest.fn(),
  warning: jest.fn()
}));
let revokeModule;

describe('Revoke GitHub Token', () => {
  const originalEnv = process.env;

  beforeEach(async () => {
    jest.clearAllMocks();
    process.env = { ...originalEnv };
    global.fetch = jest.fn();

    delete require.cache[require.resolve('../revoke.cjs')];
    revokeModule = require('../revoke.cjs');
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('revoke token functionality', () => {
    it('successfully revokes GitHub token', async () => {
      process.env.INPUT_EPHEMERALTOKEN = 'test-token';

      global.fetch.mockResolvedValue({
        ok: true,
        json: async () => ({})
      });

      await revokeModule.revokeToken();

      const core = require('@actions/core');
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.github.com/installation/token',
        expect.objectContaining({
          method: 'DELETE',
          headers: {
            Authorization: 'Bearer test-token',
            Accept: 'application/vnd.github+json'
          }
        })
      );
      expect(core.info).toHaveBeenCalledWith('Successfully revoked GitHub ephemeral token.');
    });

    it('skips revoke when no token provided', async () => {
      delete process.env.INPUT_EPHEMERALTOKEN;

      await revokeModule.revokeToken();

      const core = require('@actions/core');
      expect(global.fetch).not.toHaveBeenCalled();
      expect(core.info).toHaveBeenCalledWith('No GitHub ephemeral token found in inputs, skipping revoke.');
    });

    it('handles API error gracefully', async () => {
      process.env.INPUT_EPHEMERALTOKEN = 'test-token';

      global.fetch.mockResolvedValue({
        ok: false,
        json: async () => ({ message: 'Token not found' })
      });

      await revokeModule.revokeToken();

      const core = require('@actions/core');
      expect(core.warning).toHaveBeenCalledWith('Failed to revoke GitHub token: {"message":"Token not found"}');
    });

    it('handles network error gracefully', async () => {
      process.env.INPUT_EPHEMERALTOKEN = 'test-token';

      global.fetch.mockRejectedValue(new Error('Network error'));

      await revokeModule.revokeToken();

      const core = require('@actions/core');
      expect(core.warning).toHaveBeenCalledWith('Failed to revoke GitHub token: Network error');
    });
  });
});
