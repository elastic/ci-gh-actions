import { jest } from '@jest/globals';

// Mock modules before importing them
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

// Import after mocking
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

  it('fails if vault-instance is invalid', async () => {
    // Mock getInput to return 'invalid' for vault-instance
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

  it('sets output if token is retrieved', async () => {
    // Mock all required inputs
    core.getInput.mockImplementation((name) => {
      if (name === 'vault-instance') return 'ci-dev';
      if (name === 'vault-role') return 'test-role';
      return '';
    });

    core.getIDToken.mockResolvedValue('fake-jwt');

    // Mock fetch calls for Vault login and secret fetch
    global.fetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ auth: { client_token: 'vault-token' } })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: { token: 'gh-token' } })
      });

    const { run } = await import('../main.js');
    await run();

    expect(core.setOutput).toHaveBeenCalledWith('token', 'gh-token');
    expect(core.saveState).toHaveBeenCalledWith('github-ephemeral-token', 'gh-token');
  });

  it('handles vault login failure', async () => {
    core.getInput.mockImplementation((name) => {
      if (name === 'vault-instance') return 'ci-dev';
      if (name === 'vault-role') return 'test-role';
      return '';
    });

    core.getIDToken.mockResolvedValue('fake-jwt');

    // Mock failed vault login
    global.fetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ errors: ['Invalid credentials'] })
    });

    const { run } = await import('../main.js');
    await run();

    expect(core.setFailed).toHaveBeenCalledWith(
      expect.stringContaining('Vault login failed')
    );
  });

  it('handles vault secret fetch failure', async () => {
    core.getInput.mockImplementation((name) => {
      if (name === 'vault-instance') return 'ci-dev';
      if (name === 'vault-role') return 'test-role';
      return '';
    });

    core.getIDToken.mockResolvedValue('fake-jwt');

    // Mock successful login but failed secret fetch
    global.fetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ auth: { client_token: 'vault-token' } })
      })
      .mockResolvedValueOnce({
        ok: false,
        json: async () => ({ errors: ['Permission denied'] })
      });

    const { run } = await import('../main.js');
    await run();

    expect(core.setFailed).toHaveBeenCalledWith(
      expect.stringContaining('Vault secret fetch failed')
    );
  });
});
