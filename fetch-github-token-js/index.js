const core = require('@actions/core');
const crypto = require('crypto');
const axios = require('axios');
const exec = require('@actions/exec');

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
      const hash = crypto.createHash('sha256').update(workflowRefBase).digest('hex').slice(0, 12);
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
      loginResp = await axios.post(loginUrl, {
        role: vaultRole,
        jwt: jwt,
        jwt_github_audience: 'vault'
      });
    } catch (err) {
      core.setFailed(`Vault login failed: ${err.response ? JSON.stringify(err.response.data) : err.message}`);
      return;
    }

    const clientToken = loginResp.data.auth && loginResp.data.auth.client_token;
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
    } catch (err) {
      core.setFailed(`Vault secret fetch failed: ${err.response ? JSON.stringify(err.response.data) : err.message}`);
      return;
    }

    const githubToken = secretResp.data.data && secretResp.data.data.token;
    if (!githubToken) {
      core.setFailed('No GitHub token found in Vault secret response.');
      return;
    }

    core.setOutput('token', githubToken);

    try {
      await exec.exec('gh', ['auth', 'status'], {
        env: { ...process.env, GH_TOKEN: githubToken }
      });
    } catch (err) {
      core.setFailed(`GitHub token verification failed: ${err.message}`);
      return;
    }

  } catch (err) {
    core.setFailed(err.message);
  }
}

run();
