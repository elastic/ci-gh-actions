#!/usr/bin/env bash
# Exchanges a GitHub OIDC token for a Buildkite API token. Never prints either token.
set -euo pipefail

TOKEN_ENDPOINT="https://buildkite.com/oauth/token"
RESET_HEADER="RateLimit-WorkloadIdentityTokenExchange-Reset"
MAX_RETRIES=3
MAX_TOTAL_WAIT=300

fail() {
  echo "::error title=Buildkite OIDC authentication::$*" >&2
  exit 1
}

# Config is read from stdin so tokens never appear in the process list.
# -q ignores any runner .curlrc.
request() {
  curl -q --silent --show-error --max-time 30 --config - "$@"
}

# Rejects control characters so a malformed token can't split ::add-mask:: or GITHUB_OUTPUT lines.
is_safe_token() {
  [[ "$1" =~ ^[A-Za-z0-9._~+/=-]+$ ]]
}

# Only the OAuth error fields are surfaced; they never contain tokens.
describe_error() {
  jq -r '[.error, .error_description] | map(select(type == "string")) | join(": ")' <<<"$1" 2>/dev/null || true
}

# Claims are not secret, but the token itself must never be printed.
describe_claims() {
  jq -R 'split(".")[1] | gsub("-"; "+") | gsub("_"; "/") | @base64d | fromjson | {iss, sub, aud}' <<<"$1" 2>/dev/null || true
}

# Sets oidc_token. Assertions are single-use, so every exchange attempt needs a fresh one.
fetch_oidc_token() {
  local response status curl_status attempt delay
  for attempt in 0 1 2 3; do
    if response="$(
      printf 'header = "Authorization: Bearer %s"\nheader = "Accept: application/json"\n' \
        "$ACTIONS_ID_TOKEN_REQUEST_TOKEN" |
        request --get --data-urlencode "audience=${BUILDKITE_AUDIENCE}" \
          --write-out $'\n%{http_code}' "$ACTIONS_ID_TOKEN_REQUEST_URL"
    )"; then
      curl_status=0
    else
      curl_status=$?
    fi

    if ((curl_status != 0)); then
      case "$curl_status" in
        5|6|7|16|18|28|35|52|55|56) ;;
        *) fail "Failed to request a GitHub OIDC token (curl exit ${curl_status})" ;;
      esac
      ((attempt < 3)) || fail "Failed to request a GitHub OIDC token after 3 retries"
    else
      status="${response##*$'\n'}"
      response="${response%$'\n'*}"
      [[ "$status" =~ ^[1-5][0-9][0-9]$ ]] ||
        fail "GitHub OIDC request returned an indeterminate HTTP status"
      if [[ "$status" != 408 && "$status" != 429 && "$status" != 5?? ]]; then
        [[ "$status" == 2?? ]] || fail "GitHub OIDC request failed with HTTP ${status}"
        break
      fi
      ((attempt < 3)) || fail "GitHub OIDC request failed with HTTP ${status} after 3 retries"
    fi

    delay=$((1 << attempt))
    sleep "$delay"
  done

  oidc_token="$(jq -er '.value | select(type == "string" and length > 0)' <<<"$response")" ||
    fail "GitHub OIDC response did not contain a token"
  is_safe_token "$oidc_token" || fail "GitHub OIDC token has an unexpected format"
  echo "::add-mask::${oidc_token}"
}

# Prints the rate limit reset delay from the final response header block.
# Runs in a subshell, so fail aborts via the caller's set -e.
reset_seconds() {
  local parsed count value
  # Count before command substitution so empty duplicate values cannot disappear.
  parsed="$(awk -v h="$RESET_HEADER" '
    { sub(/\r$/, "") }
    /^HTTP\/[0-9.]+ [0-9][0-9][0-9]([ \t]|$)/ {
      count = 0; value = ""; in_headers = 1; next
    }
    /^$/ { in_headers = 0 }
    in_headers {
      i = index($0, ":")
      if (i && tolower(substr($0, 1, i - 1)) == tolower(h)) {
        count++
        value = substr($0, i + 1)
        gsub(/^[ \t]+|[ \t]+$/, "", value)
      }
    }
    END { printf "%d:%s", count, value }
  ' "$1")"
  count="${parsed%%:*}"
  value="${parsed#*:}"
  ((count > 0)) || fail "Buildkite token exchange was rate limited (HTTP 429) without a ${RESET_HEADER} header"
  ((count == 1)) || fail "Buildkite token exchange was rate limited (HTTP 429) with duplicate ${RESET_HEADER} headers"
  # Capped at 9 digits so the arithmetic below cannot overflow.
  [[ "$value" =~ ^[0-9]{1,9}$ ]] ||
    fail "Buildkite token exchange was rate limited (HTTP 429) with an invalid ${RESET_HEADER} header"
  echo "$((10#$value))"
}

[[ -n "${BUILDKITE_CLIENT_ID:-}" ]] || fail "client-id must not be empty"
[[ "$BUILDKITE_CLIENT_ID" =~ ^[A-Za-z0-9._-]+$ ]] || fail "client-id contains unexpected characters"
[[ -n "${BUILDKITE_AUDIENCE:-}" ]] || fail "audience must not be empty"
[[ "${BUILDKITE_SCOPE:-}" =~ ^[A-Za-z0-9_\ :.-]*$ ]] || fail "scope contains unexpected characters"
if [[ -z "${ACTIONS_ID_TOKEN_REQUEST_URL:-}" || -z "${ACTIONS_ID_TOKEN_REQUEST_TOKEN:-}" ]]; then
  fail "No GitHub OIDC token available. Grant the job 'permissions: id-token: write'."
fi

scope_config=""
if [[ -n "${BUILDKITE_SCOPE:-}" ]]; then
  scope_config="data-urlencode = \"scope=${BUILDKITE_SCOPE}\""$'\n'
fi

# Holds only response headers, never tokens.
headers_file="$(mktemp "${RUNNER_TEMP:-${TMPDIR:-/tmp}}/buildkite-oidc-auth.XXXXXX")"
trap 'rm -f "$headers_file"' EXIT

retries=0
waited=0
while true; do
  fetch_oidc_token
  : >"$headers_file"

  # The status code is appended on its own line so the body never touches disk.
  # curl does not retry the exchange: only HTTP 429 is retried below, with a fresh assertion.
  response="$(
    printf '%sdata-urlencode = "grant_type=client_credentials"\ndata-urlencode = "client_id=%s"\ndata-urlencode = "client_assertion_type=urn:ietf:params:oauth:client-assertion-type:jwt-bearer"\ndata-urlencode = "client_assertion=%s"\nheader = "Accept: application/json"\n' \
      "$scope_config" "$BUILDKITE_CLIENT_ID" "$oidc_token" |
      request --dump-header "$headers_file" --write-out '\n%{http_code}' "$TOKEN_ENDPOINT"
  )" || fail "Buildkite token exchange request failed"

  status="${response##*$'\n'}"
  response="${response%$'\n'*}"
  [[ "$status" =~ ^[1-5][0-9][0-9]$ ]] ||
    fail "Buildkite token exchange returned an indeterminate HTTP status"

  [[ "$status" == 429 ]] || break

  ((retries < MAX_RETRIES)) ||
    fail "Buildkite token exchange is still rate limited (HTTP 429) after ${MAX_RETRIES} retries"
  reset="$(reset_seconds "$headers_file")"
  delay=$((reset + RANDOM % 3 + 1))
  ((waited + delay <= MAX_TOTAL_WAIT)) ||
    fail "Buildkite token exchange is rate limited (HTTP 429); waiting ${delay}s would exceed the ${MAX_TOTAL_WAIT}s retry budget"
  retries=$((retries + 1))
  waited=$((waited + delay))
  echo "::warning title=Buildkite OIDC authentication::Buildkite token exchange rate limited (HTTP 429); retry ${retries}/${MAX_RETRIES} in ${delay}s" >&2
  sleep "$delay"
done

if [[ "$status" != 2?? ]]; then
  echo "::group::Buildkite token exchange diagnostics" >&2
  echo "HTTP status: ${status}" >&2
  describe_error "$response" >&2
  echo "OIDC token claims sent:" >&2
  describe_claims "$oidc_token" >&2
  echo "::endgroup::" >&2
  fail "Buildkite token exchange failed; check client-id, audience and the workload identity's issuer/subject/claims"
fi

token="$(jq -er '.access_token | select(type == "string" and length > 0)' <<<"$response")" ||
  fail "Buildkite token exchange response did not contain an access_token"
is_safe_token "$token" || fail "Buildkite access_token has an unexpected format"
echo "::add-mask::${token}"

echo "token=${token}" >>"${GITHUB_OUTPUT:?GITHUB_OUTPUT is not set}"
