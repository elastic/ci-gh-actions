const core = require('@actions/core');
const exec = require('@actions/exec');
const crypto = require('crypto');

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

    // Authenticate with Vault and fetch token
    let token = '';
    await exec.exec('vault', [
      'login',
      '-method=jwt',
      `-path=github-oidc`,
      `role=${vaultRole}`,
      `jwtGithubAudience=vault`,
      `url=${vaultAddr}`
    ], {
      listeners: {
        stdout: (data) => {
          const output = data.toString();
          // Parse token from output if needed
          // Example: token = parseToken(output);
        }
      }
    });

    core.setOutput('token', token);

    // Optionally, check token status with GitHub CLI
    await exec.exec('gh', ['auth', 'status'], { env: { GITHUB_TOKEN: token } });

  } catch (error) {
    core.setFailed(error.message);
  }
}

run();
