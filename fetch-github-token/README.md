# <!--name-->Get Ephemeral GitHub Token from CI Vault<!--/name-->

[![usages](https://img.shields.io/badge/usages-white?logo=githubactions&logoColor=blue)](https://github.com/search?q=elastic%2Fci-gh-actions%2Ffetch-github-token+%28path%3A.github%2Fworkflows+OR+path%3A**%2Faction.yml+OR+path%3A**%2Faction.yaml%29&type=code)
[![test-fetch_token](https://github.com/elastic/ci-gh-actions/actions/workflows/test-fetch_token.yml/badge.svg?branch=main)](https://github.com/elastic/ci-gh-actions/actions/workflows/test-fetch_token.yml)

> **Note:** Some sections of this documentation are automatically generated with the retrieved content from 'action.yml'. Please do not manually edit content between HTML comment markers.

<!--description-->
Fetch an ephemeral GitHub token from Vault using OIDC authentication
<!--/description-->
## Inputs
<!--inputs-->
| Name                | Description                                                                                                                                                                                                                                                | Required | Default |
|---------------------|------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|----------|---------|
| `vault-instance`    | Vault instance to connect to (ci-prod or ci-dev)                                                                                                                                                                                                           | `true`   | ` `     |
| `vault-role`        | Vault role to assume for GitHub token retrieval. If not provided, it will be generated based on the workflow ref of the GH Action. IMPORTANT: This must be used when providing a wildcard in the filename on the workflow_ref of the TokenPolicy resource. | `false`  | ` `     |
| `skip-token-revoke` | If true, skip revoking the GitHub token on exit                                                                                                                                                                                                            | `false`  | `false` |
<!--/inputs-->
## Outputs
<!--outputs-->
| Name    | Description                           |
|---------|---------------------------------------|
| `token` | GitHub App installation access token. |
<!--/outputs-->
## Usage
<!--usage action="elastic/ci-gh-actions**" version="env:VERSION"-->
```yaml
permissions:
  id-token: write
steps:
  - uses: elastic/ci-gh-actions/fetch-github-token@v1.1
    id: fetch-token
    with:
      vault-instance: "ci-prod"

  - uses: ..
    with:
      github-token: ${{ steps.fetch-token.outputs.token }}
```
<!--/usage-->

## Development

### Building

Build the action for distribution:

```bash
npm run build
```

### Pre-commit Hook

A pre-commit hook automatically rebuilds the action. Set up with:

```bash
npm install
```

The `prepare` script runs automatically and sets up Husky hooks.
