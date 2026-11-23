# <!--name-->Buildkite OIDC authentication<!--/name-->

> **Note:** Some sections of this documentation are automatically generated with the retrieved content from 'action.yml'. Please do not manually edit content between HTML comment markers.

<!--description-->
Exchange a GitHub Actions OIDC token for a short-lived Buildkite REST API token using Buildkite workload identity federation.
<!--/description-->

The action requests a GitHub OIDC token for the configured audience, exchanges it at
`https://buildkite.com/oauth/token` with the workload identity's client ID, masks the resulting
Buildkite token and exposes it as the `token` output. Neither token is ever printed. It only
authenticates: polling and token refresh are left to the caller.

Calling jobs **must** set `permissions: id-token: write`, otherwise GitHub does not provide an OIDC
token and the action fails. Both inputs are shown on the workload identity's page in Buildkite and
are not secrets.

## Inputs
<!--inputs-->
| Name        | Description                                                                                                                                       | Required | Default |
|-------------|---------------------------------------------------------------------------------------------------------------------------------------------------|----------|---------|
| `client-id` | Client ID of the Buildkite workload identity. Not a secret.                                                                                       | `true`   | ` `     |
| `audience`  | OIDC audience configured on the Buildkite workload identity. Not a secret. Copy it from the workload identity's page in Buildkite.<br>            | `true`   | ` `     |
| `scope`     | Space-separated Buildkite API scopes to request, for example `read_organizations`. Required when the workload identity has no default scopes.<br> | `false`  | ` `     |
<!--/inputs-->
## Outputs
<!--outputs-->
| Name    | Description                                      |
|---------|--------------------------------------------------|
| `token` | Short-lived Buildkite API token. Masked in logs. |
<!--/outputs-->
## Usage
<!--usage action="elastic/ci-gh-actions**" version="env:VERSION"-->
```yaml
permissions:
  id-token: write
steps:
  - uses: elastic/ci-gh-actions/buildkite-oidc-auth@v1
    id: buildkite
    with:
      client-id: "<client ID from the workload identity page>"
      audience: "<OIDC audience from the workload identity page>"
      # scope: read_organizations # only needed if the identity has no default scopes

  - env:
      BUILDKITE_API_TOKEN: ${{ steps.buildkite.outputs.token }}
    run: |
      curl -sSf -H "Authorization: Bearer $BUILDKITE_API_TOKEN" \
        https://api.buildkite.com/v2/organizations
```
<!--/usage-->

The token is short-lived and is not refreshed; long-running jobs must run the action again.

## Development

Tests stub `curl` and cover success, masking, missing permissions and failure modes:

```bash
bash buildkite-oidc-auth/tests/exchange_test.sh
```
