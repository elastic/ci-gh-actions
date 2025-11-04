import core from '@actions/core';

export async function run() {
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
        core.warning(`Failed to revoke GitHub token: ${err.message}`);
    }
  } catch (err) {
    core.warning(`Post action error: ${err.message}`);
  }
}

run();
