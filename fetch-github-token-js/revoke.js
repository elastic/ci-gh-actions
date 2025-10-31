const core = require('@actions/core');
const axios = require('axios');

async function run() {
  try {
    const skipRevoke = core.getInput('skip-token-revoke') === 'true';
    if (skipRevoke) {
      core.info('Skipping GitHub ephemeral token revoke as requested.');
      return;
    }
    const githubEphemeralToken = core.getState('github-ephemeral-token');

    if (!githubEphemeralToken) {
      core.info('No GitHub ephemeral token found in state, skipping revoke.');
      return;
    }

    const githubRevokeUrl = `https://api.github.com/installation/token`;
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
  } catch (err) {
    core.warning(`Post action error: ${err.message}`);
  }
}

run();
