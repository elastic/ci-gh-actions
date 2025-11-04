const core = require('@actions/core');
const crypto = require('crypto');
const { Octokit } = require('@octokit/core');

async function run() {
  try {
    const vaultInstance = core.getInput('vault-instance', { required: true });
    let vaultRole = core.getInput('vault-role');
    let vaultAddr;

    // Set Vault address
    if (vaultInstance === 'ci-dev') {
      vaultAddr = 'https://vault-ci.dev.elastic.dev';
      core.info('Vault address set to CI-DEV.');
    } else if (vaultInstance === 'ci-prod') {
      vaultAddr = 'https://vault-ci-prod.elastic.dev';
      core.info('Vault address set to CI-PROD.');
    } else {
      core.setFailed(`Invalid vault instance: ${vaultInstance}. Must be 'ci-dev' or 'ci-prod'.`);
      return;
    }

    // Generate vault role if not provided
    if (!vaultRole) {
      const workflowRef = process.env.GITHUB_WORKFLOW_REF;
      if (!workflowRef) {
        core.setFailed('GITHUB_WORKFLOW_REF environment variable is not set.');
        return;
      }
      const workflowRefBase = workflowRef.split('@')[0];
      const VAULT_ROLE_HASH_LENGTH = 12; // Length of hash suffix for role name for uniqueness and brevity
      const hash = crypto.createHash('sha256').update(workflowRefBase).digest('hex').slice(0, VAULT_ROLE_HASH_LENGTH);
      vaultRole = `token-policy-${hash}`;
      core.info(`Generated role name: ${vaultRole}`);
    }

    core.info('--- Vault Action Input Parameters ---');
    core.info(`VAULT_ADDR (URL): ${vaultAddr}`);
    core.info(`VAULT_ROLE: ${vaultRole}`);
    core.info(`Vault Secrets Path Expected: github/token/${vaultRole}`);
    core.info('-------------------------------------');

    const jwt = await core.getIDToken('vault');
    const loginUrl = `${vaultAddr}/v1/auth/github-oidc/login`;
    let loginResp;
    try {
      const response = await fetch(loginUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role: vaultRole,
          jwt: jwt,
          jwt_github_audience: 'vault'
        })
      });
      if (!response.ok) {
        const errorData = await response.json();
        core.setFailed(`Vault login failed: ${JSON.stringify(errorData)}`);
        return;
      }
      loginResp = await response.json();
      core.info('Successfully logged into Vault via OIDC.');
    } catch (err) {
      core.setFailed(`Vault login failed: ${err.message}`);
      return;
    }
    const clientToken = loginResp.auth && loginResp.auth.client_token;
    if (!clientToken) {
      core.setFailed('No client token returned from Vault.');
      return;
    }

    const secretUrl = `${vaultAddr}/v1/github/token/${vaultRole}`;
    let secretResp;
    try {
      secretResp = await axios.get(secretUrl, {
        headers: { 'X-Vault-Token': clientToken }
      });
      const response = await fetch(secretUrl, {
        method: 'GET',
        headers: { 'X-Vault-Token': clientToken }
      });
      if (!response.ok) {
        const errorData = await response.json();
        core.setFailed(`Vault secret fetch failed: ${JSON.stringify(errorData)}`);
        return;
      }
      secretResp = await response.json();
    } catch (err) {
      core.setFailed(`Vault secret fetch failed: ${err.message}`);
      return;
    }

    const githubToken = secretResp.data && secretResp.data.token;
    if (!githubToken) {
      core.setFailed('No GitHub token found in Vault secret response.');
      return;
    }

    core.saveState('github-ephemeral-token', githubToken);
    core.setOutput('token', githubToken);

    try {
      const octokit = new Octokit({ auth: githubToken });
      const { data } = await octokit.request("GET /installation/repositories");
      core.info(`GitHub token has access to ${data.total_count} repositories.`);
    } catch (err) {
      core.setFailed(`GitHub token verification failed: ${err.message}`);
      return;
    }

  } catch (err) {
    core.setFailed(err.message);
  }
}
module.exports = { run }; // Needed for unit tests

run();
