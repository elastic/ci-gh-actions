const core = require('@actions/core');

async function revokeToken() {
  try {
    const githubEphemeralToken = process.env.INPUT_EPHEMERAL_TOKEN
    if (!githubEphemeralToken) {
      core.info('No GitHub ephemeral token found in inputs, skipping revoke.');
      return;
    }

    const githubRevokeUrl = `https://api.github.com/installation/token`;
    const response = await fetch(githubRevokeUrl, {
        method: 'DELETE',
        headers: {
            Authorization: `Bearer ${githubEphemeralToken}`,
            Accept: 'application/vnd.github+json'
        }
    });
    if (!response.ok) {
        const errorData = await response.json();
        core.warning(`Failed to revoke GitHub token: ${JSON.stringify(errorData)}`);
        return;
    }
    core.info('Successfully revoked GitHub ephemeral token.');
  } catch (err) {
    core.warning(`Post action error: ${err.message}`);
  }
}

module.exports = { revokeToken };

if (require.main === module) {
  revokeToken();
}
