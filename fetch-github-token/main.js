import core from '@actions/core';
import { Octokit } from '@octokit/core';
import crypto from 'crypto';

export function getVaultAddress(vaultInstance) {
  if (vaultInstance === 'ci-dev') {
    core.info('Vault address set to CI-DEV.');
    return 'https://vault-ci.dev.elastic.dev';
  } else if (vaultInstance === 'ci-prod') {
    core.info('Vault address set to CI-PROD.');
    return 'https://vault-ci-prod.elastic.dev';
  }

  throw new Error(`Invalid vault instance: ${vaultInstance}. Must be 'ci-dev' or 'ci-prod'.`);
}

export function generateVaultRole() {
  const workflowRef = process.env.GITHUB_WORKFLOW_REF;
  if (!workflowRef) {
    throw new Error('GITHUB_WORKFLOW_REF environment variable is not set.');
  }

  const workflowRefBase = workflowRef.split('@')[0];
  const VAULT_ROLE_HASH_LENGTH = 12; // Length of hash suffix for role name for uniqueness and brevity
  const hash = crypto.createHash('sha256').update(workflowRefBase).digest('hex').slice(0, VAULT_ROLE_HASH_LENGTH);
  const vaultRole = `token-policy-${hash}`;

  core.info(`Generated role name: ${vaultRole}`);
  return vaultRole;
}

export function logActionParameters(vaultAddr, vaultRole) {
  core.info('--- Vault Action Input Parameters ---');
  core.info(`VAULT_ADDR (URL): ${vaultAddr}`);
  core.info(`VAULT_ROLE: ${vaultRole}`);
  core.info(`Vault Secrets Path Expected: github/token/${vaultRole}`);
  core.info('-------------------------------------');
}

export async function authenticateWithVault(vaultAddr, vaultRole) {
  const jwt = await core.getIDToken('vault');
  const loginUrl = `${vaultAddr}/v1/auth/github-oidc/login`;

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
    throw new Error(`Vault login failed: ${JSON.stringify(errorData)}`);
  }

  const loginResp = await response.json();
  const clientToken = loginResp.auth?.client_token;

  if (!clientToken) {
    throw new Error('No client token returned from Vault.');
  }

  core.info('Successfully logged into Vault via OIDC.');
  return clientToken;
}

export async function fetchGitHubTokenFromVault(vaultAddr, vaultRole, clientToken) {
  const secretUrl = `${vaultAddr}/v1/github/token/${vaultRole}`;

  const response = await fetch(secretUrl, {
    method: 'GET',
    headers: { 'X-Vault-Token': clientToken }
  });
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(`Vault secret fetch failed: ${JSON.stringify(errorData)}`);
  }

  const secretResp = await response.json();
  const githubToken = secretResp.data?.token;

  if (!githubToken) {
    throw new Error('No GitHub token found in Vault secret response.');
  }

  core.setSecret(githubToken);

  return githubToken;
}

export async function verifyGitHubToken(githubToken) {
  const octokit = new Octokit({ auth: githubToken });
  const { data } = await octokit.request("GET /installation/repositories");
  core.info(`GitHub token has access to ${data.total_count} repositories.`);
}

export function setActionOutputs(githubToken) {
  core.saveState('github-ephemeral-token', githubToken);
  core.setOutput('token', githubToken);
}

export async function run() {
  try {
    const vaultInstance = core.getInput('vault-instance', { required: true });
    const inputVaultRole = core.getInput('vault-role');

    const vaultAddr = getVaultAddress(vaultInstance);
    const vaultRole = inputVaultRole || generateVaultRole();

    logActionParameters(vaultAddr, vaultRole);

    const clientToken = await authenticateWithVault(vaultAddr, vaultRole);
    const githubToken = await fetchGitHubTokenFromVault(vaultAddr, vaultRole, clientToken);

    await verifyGitHubToken(githubToken);
    setActionOutputs(githubToken);
  } catch (err) {
    core.setFailed(err.message);
  }
}

// Only run when executed directly, not when imported
if (import.meta.url === `file://${process.argv[1]}`) {
  run();
}
