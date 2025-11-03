# <!--name-->Get Ephemeral GitHub Token from CI Vault<!--/name-->
<!--description-->
Fetch an ephemeral GitHub token from Vault using OIDC authentication
<!--/description-->
## Inputs
<!--inputs-->
| Name             | Description                                                                                                                        | Required | Default |
|------------------|------------------------------------------------------------------------------------------------------------------------------------|----------|---------|
| `vault-instance` | Vault instance to connect to (ci-prod or ci-dev)                                                                                   | `true`   | ` `     |
| `vault-role`     | Vault role to assume for GitHub token retrieval. If not provided, it will be generated based on the workflow ref of the GH Action. | `false`  | ` `     |
| `revoke`         | If true, revoke the GitHub token on exit                                                                                           | `false`  | `false` |
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
  - uses: elastic/ci-gh-actions/fetch-github-token-js@__last_commit_sha__
    id: fetch-token
    with:
      vault-instance: "ci-prod"

  - uses: ..
    with:
      github-token: ${{ steps.fetch-token.outputs.token }}
```
<!--/usage-->
