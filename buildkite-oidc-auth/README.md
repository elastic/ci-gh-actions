# <!--name-->Buildkite OIDC authentication<!--/name-->

[![usages](https://img.shields.io/badge/usages-white?logo=githubactions&logoColor=blue)](https://github.com/search?q=elastic%2Fci-gh-actions%2Fbuildkite-oidc-auth+%28path%3A.github%2Fworkflows+OR+path%3A**%2Faction.yml+OR+path%3A**%2Faction.yaml%29&type=code)
[![test-buildkite-oidc-auth](https://github.com/elastic/ci-gh-actions/actions/workflows/test-buildkite-oidc-auth.yml/badge.svg?branch=main)](https://github.com/elastic/ci-gh-actions/actions/workflows/test-buildkite-oidc-auth.yml)

> **Note:** Some sections of this documentation are automatically generated with the retrieved content from 'action.yml'. Please do not manually edit content between HTML comment markers.

<!--description-->
Exchange a GitHub Actions OIDC token for a short-lived Buildkite REST API token using Buildkite workload identity federation.
<!--/description-->

The action requests a GitHub OIDC token for the configured audience, exchanges it at
`https://buildkite.com/oauth/token` with the workload identity's client ID, masks the resulting
Buildkite token and exposes it as the `token` output. Neither token is ever printed. It only
authenticates: polling and token refresh are left to the caller.

If Buildkite rate limits the exchange (HTTP 429), the action retries up to three times. Before each
retry it waits for the number of seconds in the `RateLimit-WorkloadIdentityTokenExchange-Reset`
response header plus 1–3 seconds of random jitter, and requests a fresh GitHub OIDC token because
each one can only be exchanged once. It fails if that header is missing, duplicated or not a
non-negative integer, or if the total wait would exceed 300 seconds. Any other HTTP error or
network failure fails immediately.

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
      # The header goes through stdin so the token stays out of the process list.
      printf 'header = "Authorization: Bearer %s"\n' "$BUILDKITE_API_TOKEN" |
        curl -q -sSf --config - https://api.buildkite.com/v2/organizations | jq -er '.[].name'
```
<!--/usage-->

The token is short-lived and is not refreshed; long-running jobs must run the action again.

The runner needs `curl` and `jq`. GitHub-hosted Ubuntu runners include both.

## Development

Tests stub `curl` and `sleep` and cover success, masking, missing permissions, rate-limit retries and
failure modes:

```bash
bash buildkite-oidc-auth/tests/exchange_test.sh
```
