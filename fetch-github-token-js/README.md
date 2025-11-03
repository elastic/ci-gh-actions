# <!--name-->Get Ephemeral GitHub Token from CI Vault<!--/name-->
<!--description-->
Fetch an ephemeral GitHub token from Vault using OIDC authentication
<!--/description-->
## Inputs
<!--inputs-->
| Name                | Description                                      | Required | Default |
|---------------------|--------------------------------------------------|----------|---------|
| `vault-instance`    | Vault instance to connect to (ci-prod or ci-dev) | `true`   | ` `     |
| `vault-role`        | Vault role to assume for GitHub token retrieval  | `false`  | ` `     |
| `skip-token-revoke` | If true, skip revoking the Vault token on exit   | `false`  | `false` |
<!--/inputs-->
## Outputs
<!--outputs-->
| Name    | Description                           |
|---------|---------------------------------------|
| `token` | GitHub App installation access token. |
<!--/outputs-->
## Usage
<!--usage action="your/action" version="v1"-->
```yaml
on: push
steps:
  - uses: your/action@v1
```
<!--/usage-->
