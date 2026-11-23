#!/usr/bin/env bash
# Exchanges a GitHub OIDC token for a Buildkite API token. Never prints either token.
set -euo pipefail

TOKEN_ENDPOINT="https://buildkite.com/oauth/token"

fail() {
  echo "::error title=Buildkite OIDC authentication::$*" >&2
  exit 1
}

# Config is read from stdin so tokens never appear in the process list.
# -q ignores any runner .curlrc. The single-use exchange assertion is never retried.
request() {
  curl -q --silent --show-error --fail-with-body --max-time 30 --config - "$@"
}

# Only the OAuth error fields are surfaced; they never contain tokens.
describe_error() {
  jq -r '[.error, .error_description] | map(select(type == "string")) | join(": ")' <<<"$1" 2>/dev/null || true
}

# Claims are not secret, but the token itself must never be printed.
describe_claims() {
  jq -R 'split(".")[1] | gsub("-"; "+") | gsub("_"; "/") | @base64d | fromjson | {iss, sub, aud}' <<<"$1" 2>/dev/null || true
}

[[ -n "${BUILDKITE_CLIENT_ID:-}" ]] || fail "client-id must not be empty"
[[ "$BUILDKITE_CLIENT_ID" =~ ^[A-Za-z0-9._-]+$ ]] || fail "client-id contains unexpected characters"
[[ -n "${BUILDKITE_AUDIENCE:-}" ]] || fail "audience must not be empty"
[[ "${BUILDKITE_SCOPE:-}" =~ ^[A-Za-z0-9_\ :.-]*$ ]] || fail "scope contains unexpected characters"
if [[ -z "${ACTIONS_ID_TOKEN_REQUEST_URL:-}" || -z "${ACTIONS_ID_TOKEN_REQUEST_TOKEN:-}" ]]; then
  fail "No GitHub OIDC token available. Grant the job 'permissions: id-token: write'."
fi

response="$(
  printf 'header = "Authorization: Bearer %s"\nheader = "Accept: application/json"\n' \
    "$ACTIONS_ID_TOKEN_REQUEST_TOKEN" |
    request --retry 3 --get --data-urlencode "audience=${BUILDKITE_AUDIENCE}" \
      "$ACTIONS_ID_TOKEN_REQUEST_URL"
)" || fail "Failed to request a GitHub OIDC token"

oidc_token="$(jq -er '.value | select(type == "string" and length > 0)' <<<"$response")" ||
  fail "GitHub OIDC response did not contain a token"
echo "::add-mask::${oidc_token}"

scope_config=""
if [[ -n "${BUILDKITE_SCOPE:-}" ]]; then
  scope_config="$(printf 'data-urlencode = "scope=%s"\n' "$BUILDKITE_SCOPE")"
fi

response="$(
  printf '%sdata-urlencode = "grant_type=client_credentials"\ndata-urlencode = "client_id=%s"\ndata-urlencode = "client_assertion_type=urn:ietf:params:oauth:client-assertion-type:jwt-bearer"\ndata-urlencode = "client_assertion=%s"\nheader = "Accept: application/json"\n' \
    "$scope_config" "$BUILDKITE_CLIENT_ID" "$oidc_token" |
    request "$TOKEN_ENDPOINT"
)" || {
  echo "::group::Buildkite token exchange diagnostics" >&2
  describe_error "$response" >&2
  echo "OIDC token claims sent:" >&2
  describe_claims "$oidc_token" >&2
  echo "::endgroup::" >&2
  fail "Buildkite token exchange failed; check client-id, audience and the workload identity's issuer/subject/claims"
}

token="$(jq -er '.access_token | select(type == "string" and length > 0)' <<<"$response")" ||
  fail "Buildkite token exchange response did not contain an access_token"
echo "::add-mask::${token}"

echo "token=${token}" >>"${GITHUB_OUTPUT:?GITHUB_OUTPUT is not set}"
