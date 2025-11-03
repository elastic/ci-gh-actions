const core = require('@actions/core');
const axios = require('axios');
const { Octokit } = require('@octokit/core');

jest.mock('@actions/core');
jest.mock('axios');
jest.mock('@octokit/core');

describe('Vault GitHub Token Action', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('fails if vault-instance is invalid', async () => {
    core.getInput.mockReturnValueOnce('invalid');
    const run = require('../main').run;
    await run();
    expect(core.setFailed).toHaveBeenCalledWith(expect.stringContaining('Invalid vault instance'));
  });

  it('sets output if token is retrieved', async () => {
    core.getInput.mockReturnValueOnce('ci-dev'); // vault-instance
    core.getInput.mockReturnValueOnce('test-role'); // vault-role
    core.getIDToken = jest.fn().mockResolvedValue('fake-jwt');
    axios.post.mockResolvedValue({ data: { auth: { client_token: 'vault-token' } } });
    axios.get.mockResolvedValue({ data: { data: { token: 'gh-token' } } });
    Octokit.mockImplementation(() => ({
      request: jest.fn().mockResolvedValue({ data: { total_count: 1 } })
    }));
    const run = require('../main').run;
    await run();
    expect(core.setOutput).toHaveBeenCalledWith('token', 'gh-token');
  });
});
