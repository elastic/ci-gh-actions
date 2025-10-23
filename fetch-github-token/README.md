# <!--name-->Get Ephemeral GitHub Token from CI Vault<!--/name-->
<!--description-->
Fetch an ephemeral GitHub token from Vault using OIDC authentication
<!--/description-->
## Inputs
<!--inputs-->
| Name             | Description                                      | Required | Default |
|------------------|--------------------------------------------------|----------|---------|
| `vault-instance` | Vault instance to connect to (ci-prod or ci-dev) | `true`   | ` `     |
| `vault-role`     | Vault role to assume for GitHub token retrieval  | `false`  | ` `     |
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
on: push
steps:
permissions:
  contents: read
  id-token: write

steps:
  - uses: elastic/ci-gh-actions/fetch-github-token@v1
    id: fetch-token
    with:
      vault-instance: "ci-prod"

  - uses: ..
    with:
      github-token: ${{ steps.fetch-token.outputs.token }}
```
<!--/usage-->
