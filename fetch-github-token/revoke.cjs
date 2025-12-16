const core = require('@actions/core');
const fs = require('fs');

async function revokeToken() {
  try {
    // Read token from GitHub State
    const stateFile = process.env.GITHUB_STATE;
    let githubEphemeralToken = null;

    // if (stateFile && fs.existsSync(stateFile)) {
    //   const stateContent = fs.readFileSync(stateFile, 'utf8');
    //   const lines = stateContent.split('\n');

    //   for (const line of lines) {
    //     if (line.startsWith('EPHEMERAL_TOKEN=')) {
    //       githubEphemeralToken = line.substring('EPHEMERAL_TOKEN='.length).trim();
    //       break;
    //     }
    //   }
    // }

    if (!githubEphemeralToken && process.env.STATE_EPHEMERAL_TOKEN) {
      githubEphemeralToken = process.env.STATE_EPHEMERAL_TOKEN;
    }

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
