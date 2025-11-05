import { jest } from '@jest/globals';

jest.mock('@actions/core', () => ({
  default: {
    getInput: jest.fn(),
    setFailed: jest.fn(),
    setOutput: jest.fn(),
    getIDToken: jest.fn(),
    info: jest.fn(),
    warning: jest.fn(),
    getState: jest.fn(),
    saveState: jest.fn()
  }
}));

jest.mock('@octokit/core', () => ({
  Octokit: jest.fn().mockImplementation(() => ({
    request: jest.fn().mockResolvedValue({ data: { total_count: 1 } })
  }))
}));

const { default: core } = await import('@actions/core');

describe('Vault GitHub Token Action', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn();

    // Re-establish core mocks after clearing
    core.getInput = jest.fn();
    core.setFailed = jest.fn();
    core.setOutput = jest.fn();
    core.getIDToken = jest.fn();
    core.info = jest.fn();
    core.warning = jest.fn();
    core.getState = jest.fn();
    core.saveState = jest.fn();
  });

  describe('getVaultAddress', () => {
    it('returns ci-dev vault address for ci-dev instance', async () => {
      const { getVaultAddress } = await import('../main.js');
      const result = getVaultAddress('ci-dev');

      expect(result).toBe('https://vault-ci.dev.elastic.dev');
      expect(core.info).toHaveBeenCalledWith('Vault address set to CI-DEV.');
    });

    it('returns ci-prod vault address for ci-prod instance', async () => {
      const { getVaultAddress } = await import('../main.js');
      const result = getVaultAddress('ci-prod');

      expect(result).toBe('https://vault-ci-prod.elastic.dev');
      expect(core.info).toHaveBeenCalledWith('Vault address set to CI-PROD.');
    });

    it('throws error for invalid vault instance', async () => {
      const { getVaultAddress } = await import('../main.js');

      expect(() => getVaultAddress('invalid')).toThrow(
        'Invalid vault instance: invalid. Must be \'ci-dev\' or \'ci-prod\'.'
      );
    });
  });

  describe('generateVaultRole', () => {
    const originalEnv = process.env;

    beforeEach(() => {
      process.env = { ...originalEnv };
    });

    afterAll(() => {
      process.env = originalEnv;
    });

    it('generates vault role from GITHUB_WORKFLOW_REF', async () => {
      process.env.GITHUB_WORKFLOW_REF = 'elastic/repo/.github/workflows/test.yml@refs/heads/main';

      const { generateVaultRole } = await import('../main.js');
      const result = generateVaultRole();

      expect(result).toMatch(/^token-policy-[a-f0-9]{12}$/);
      expect(core.info).toHaveBeenCalledWith(expect.stringMatching(/Generated role name: token-policy-[a-f0-9]{12}/));
    });

    it('throws error when GITHUB_WORKFLOW_REF is not set', async () => {
      delete process.env.GITHUB_WORKFLOW_REF;

      const { generateVaultRole } = await import('../main.js');

      expect(() => generateVaultRole()).toThrow(
        'GITHUB_WORKFLOW_REF environment variable is not set.'
      );
    });
  });

  describe('logActionParameters', () => {
    it('logs vault address and role information', async () => {
      const { logActionParameters } = await import('../main.js');

      logActionParameters('https://vault.example.com', 'test-role');

      expect(core.info).toHaveBeenCalledWith('--- Vault Action Input Parameters ---');
      expect(core.info).toHaveBeenCalledWith('VAULT_ADDR (URL): https://vault.example.com');
      expect(core.info).toHaveBeenCalledWith('VAULT_ROLE: test-role');
      expect(core.info).toHaveBeenCalledWith('Vault Secrets Path Expected: github/token/test-role');
      expect(core.info).toHaveBeenCalledWith('-------------------------------------');
    });
  });

  describe('authenticateWithVault', () => {
    it('successfully authenticates and returns client token', async () => {
      core.getIDToken.mockResolvedValue('fake-jwt');
      global.fetch.mockResolvedValue({
        ok: true,
        json: async () => ({ auth: { client_token: 'vault-token' } })
      });

      const { authenticateWithVault } = await import('../main.js');
      const result = await authenticateWithVault('https://vault.example.com', 'test-role');

      expect(result).toBe('vault-token');
      expect(core.info).toHaveBeenCalledWith('Successfully logged into Vault via OIDC.');
      expect(global.fetch).toHaveBeenCalledWith(
        'https://vault.example.com/v1/auth/github-oidc/login',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        })
      );
    });

    it('throws error when vault login fails', async () => {
      core.getIDToken.mockResolvedValue('fake-jwt');
      global.fetch.mockResolvedValue({
        ok: false,
        json: async () => ({ errors: ['Invalid credentials'] })
      });

      const { authenticateWithVault } = await import('../main.js');

      await expect(authenticateWithVault('https://vault.example.com', 'test-role'))
        .rejects.toThrow('Vault login failed');
    });

    it('throws error when no client token returned', async () => {
      core.getIDToken.mockResolvedValue('fake-jwt');
      global.fetch.mockResolvedValue({
        ok: true,
        json: async () => ({ auth: {} })
      });

      const { authenticateWithVault } = await import('../main.js');

      await expect(authenticateWithVault('https://vault.example.com', 'test-role'))
        .rejects.toThrow('No client token returned from Vault.');
    });
  });

  describe('fetchGitHubTokenFromVault', () => {
    it('successfully fetches GitHub token from vault', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        json: async () => ({ data: { token: 'gh-token' } })
      });

      const { fetchGitHubTokenFromVault } = await import('../main.js');
      const result = await fetchGitHubTokenFromVault('https://vault.example.com', 'test-role', 'vault-token');

      expect(result).toBe('gh-token');
      expect(global.fetch).toHaveBeenCalledWith(
        'https://vault.example.com/v1/github/token/test-role',
        expect.objectContaining({
          method: 'GET',
          headers: { 'X-Vault-Token': 'vault-token' }
        })
      );
    });

    it('throws error when vault secret fetch fails', async () => {
      global.fetch.mockResolvedValue({
        ok: false,
        json: async () => ({ errors: ['Permission denied'] })
      });

      const { fetchGitHubTokenFromVault } = await import('../main.js');

      await expect(fetchGitHubTokenFromVault('https://vault.example.com', 'test-role', 'vault-token'))
        .rejects.toThrow('Vault secret fetch failed');
    });

    it('throws error when no GitHub token found in response', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        json: async () => ({ data: {} })
      });

      const { fetchGitHubTokenFromVault } = await import('../main.js');

      await expect(fetchGitHubTokenFromVault('https://vault.example.com', 'test-role', 'vault-token'))
        .rejects.toThrow('No GitHub token found in Vault secret response.');
    });
  });

  describe('verifyGitHubToken', () => {
    it('verifies token successfully', async () => {
      const mockHeaders = new Map([
        ['content-type', 'application/json'],
        ['x-ratelimit-limit', '5000'],
        ['x-ratelimit-remaining', '4999']
      ]);

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: mockHeaders,
        url: 'https://api.github.com/installation/repositories',
        json: async () => ({ total_count: 1, repositories: [] }),
        text: async () => JSON.stringify({ total_count: 1, repositories: [] }),
        arrayBuffer: async () => new ArrayBuffer(0),
        blob: async () => new Blob(),
        clone: function() { return this; }
      });

      const { verifyGitHubToken } = await import('../main.js');
      await verifyGitHubToken('gh-token');

      expect(core.info).toHaveBeenCalledWith('GitHub token has access to 1 repositories.');
    });
  });

  describe('setActionOutputs', () => {
    it('sets action outputs and saves state', async () => {
      const { setActionOutputs } = await import('../main.js');

      setActionOutputs('gh-token');

      expect(core.saveState).toHaveBeenCalledWith('github-ephemeral-token', 'gh-token');
      expect(core.setOutput).toHaveBeenCalledWith('token', 'gh-token');
    });
  });

  describe('run (integration)', () => {
    it('successfully completes full workflow', async () => {
      core.getInput.mockImplementation((name) => {
        if (name === 'vault-instance') return 'ci-dev';
        if (name === 'vault-role') return 'test-role';
        return '';
      });

      core.getIDToken.mockResolvedValue('fake-jwt');

      global.fetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ auth: { client_token: 'vault-token' } })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ data: { token: 'gh-token' } })
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          headers: new Headers({ 'content-type': 'application/json' }),
          json: async () => ({ total_count: 1, repositories: [] }),
          text: async () => JSON.stringify({ total_count: 1, repositories: [] })
        });

      const { run } = await import('../main.js');
      await run();

      expect(core.setOutput).toHaveBeenCalledWith('token', 'gh-token');
      expect(core.saveState).toHaveBeenCalledWith('github-ephemeral-token', 'gh-token');
      expect(core.setFailed).not.toHaveBeenCalled();
    });

    it('handles errors and calls setFailed', async () => {
      core.getInput.mockImplementation((name) => {
        if (name === 'vault-instance') return 'invalid';
        return '';
      });

      const { run } = await import('../main.js');
      await run();

      expect(core.setFailed).toHaveBeenCalledWith(
        expect.stringContaining('Invalid vault instance')
      );
    });
  });
});
