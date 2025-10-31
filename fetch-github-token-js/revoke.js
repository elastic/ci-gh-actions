const core = require('@actions/core');
const axios = require('axios');

async function run() {
  try {
    const skipRevoke = core.getInput('skip-token-revoke') === 'true';
    if (skipRevoke) {
      core.info('Skipping Vault token revoke as requested.');
      return;
    }
    const vaultAddr = core.getState('vault-addr');
    const vaultClientToken = core.getState('vault-client-token');
    const githubEphemeralToken = core.getState('github-ephemeral-token');

    if (!vaultClientToken || !vaultAddr) {
      core.info('No Vault token or address found in state, skipping revoke.');
      return;
    }

    const githubRevokeUrl = `https://api.github.com/app/installation/token`;
    try {
        await axios.delete(githubRevokeUrl,
            {
                headers: {
                    Authorization: `Bearer ${githubEphemeralToken}`,
                    Accept: 'application/vnd.github+json'
                }
            }
        );
    } catch (err) {
        core.warning(`Failed to revoke GitHub token: ${err.response ? JSON.stringify(err.response.data) : err.message}`);
    }

    const vaultRevokeUrl = `${vaultAddr}/v1/auth/token/revoke-self`;
    try {
      await axios.post(vaultRevokeUrl, {}, {
        headers: { 'X-Vault-Token': vaultClientToken }
      });
      core.info('Vault token revoked successfully.');
    } catch (err) {
      core.warning(`Failed to revoke Vault token: ${err.response ? JSON.stringify(err.response.data) : err.message}`);
    }
  } catch (err) {
    core.warning(`Post action error: ${err.message}`);
  }
}

run();
