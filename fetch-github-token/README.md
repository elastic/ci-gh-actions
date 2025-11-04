# <!--name-->Get Ephemeral GitHub Token from CI Vault<!--/name-->

[![usages](https://img.shields.io/badge/usages-white?logo=githubactions&logoColor=blue)](https://github.com/search?q=elastic%2Foblt-actions%2Ffetch-github-token-js+%28path%3A.github%2Fworkflows+OR+path%3A**%2Faction.yml+OR+path%3A**%2Faction.yaml%29&type=code)
[![test-fetch-github-token-js](https://github.com/elastic/ci-gh-actions/actions/workflows/test-fetch-github-token-js.yml/badge.svg?branch=main)](https://github.com/elastic/ci-gh-actions/actions/workflows/fetch-github-token-js.yml)

<!--description-->
Fetch an ephemeral GitHub token from Vault using OIDC authentication
<!--/description-->
## Inputs
<!--inputs-->
| Name                | Description                                                                                                                        | Required | Default |
|---------------------|------------------------------------------------------------------------------------------------------------------------------------|----------|---------|
| `vault-instance`    | Vault instance to connect to (ci-prod or ci-dev)                                                                                   | `true`   | ` `     |
| `vault-role`        | Vault role to assume for GitHub token retrieval. If not provided, it will be generated based on the workflow ref of the GH Action. | `false`  | ` `     |
| `skip-token-revoke` | If true, skip revoking the GitHub token on exit                                                                                    | `false`  | `true`  |
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
  - uses: elastic/ci-gh-actions/fetch-github-token-js@v1
    id: fetch-token
    with:
      vault-instance: "ci-prod"

  - uses: ..
    with:
      github-token: ${{ steps.fetch-token.outputs.token }}
```
<!--/usage-->
