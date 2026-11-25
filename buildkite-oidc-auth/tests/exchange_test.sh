#!/usr/bin/env bash
# Tests exchange.sh against a stubbed curl and sleep. Run: bash buildkite-oidc-auth/tests/exchange_test.sh
set -uo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
script="$here/../exchange.sh"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
mkdir "$tmp/bin"

# Stub: GitHub calls return $STUB_GITHUB with @N@ replaced by the GitHub call number.
# Buildkite call N returns $STUB_BUILDKITE with status STUB_BK_STATUS_N (default 200),
# headers STUB_BK_HEADERS_N and curl exit code STUB_BUILDKITE_RC.
cat >"$tmp/bin/curl" <<'STUB'
#!/usr/bin/env bash
cat >>"$STUB_DIR/config"
printf '%s\n' "$*" >>"$STUB_DIR/args"
url="${*: -1}"
echo "$url" >>"$STUB_DIR/urls"
if [[ "$url" != https://buildkite.com/* ]]; then
  g=$(($(cat "$STUB_DIR/gh_count" 2>/dev/null || echo 0) + 1)); echo "$g" >"$STUB_DIR/gh_count"
  printf '%s' "${STUB_GITHUB//@N@/$g}"
  exit "${STUB_GITHUB_RC:-0}"
fi
n=$(($(cat "$STUB_DIR/bk_count" 2>/dev/null || echo 0) + 1)); echo "$n" >"$STUB_DIR/bk_count"
[[ "${STUB_BUILDKITE_RC:-0}" -eq 0 ]] || exit "$STUB_BUILDKITE_RC"
status_var="STUB_BK_STATUS_$n"; headers_var="STUB_BK_HEADERS_$n"
while [[ $# -gt 0 ]]; do
  if [[ "$1" == --dump-header ]]; then printf 'HTTP/2 %s\r\n%b\r\n' "${!status_var:-200}" "${!headers_var:-}" >"$2"; fi
  shift
done
printf '%s\n%s' "$STUB_BUILDKITE" "${!status_var:-200}"
STUB
cat >"$tmp/bin/sleep" <<'STUB'
#!/usr/bin/env bash
echo "$1" >>"$STUB_DIR/sleeps"
STUB
chmod +x "$tmp/bin/curl" "$tmp/bin/sleep"

failures=0
check() { # name -- condition command...
  local name="$1"; shift
  "$@" || { echo "FAIL $name"; failures=$((failures + 1)); }
}
run() { # name expected_rc -- env...
  local name="$1" want="$2"; shift 2
  rm -f "$tmp/gh_count" "$tmp/bk_count" "$tmp/urls" "$tmp/config" "$tmp/args" "$tmp/out" "$tmp/sleeps"
  : >"$tmp/out"
  env -i PATH="$tmp/bin:$PATH" STUB_DIR="$tmp" GITHUB_OUTPUT="$tmp/out" RUNNER_TEMP="$tmp" \
    ACTIONS_ID_TOKEN_REQUEST_URL="https://gh.example/oidc?x=1" ACTIONS_ID_TOKEN_REQUEST_TOKEN=reqtok \
    BUILDKITE_CLIENT_ID=cid BUILDKITE_AUDIENCE=aud \
    STUB_GITHUB='{"value":"gh-jwt"}' STUB_BUILDKITE='{"access_token":"bktx_secret"}' \
    "$@" bash "$script" >"$tmp/stdout" 2>"$tmp/stderr"
  local rc=$?
  local ok=1
  [[ $rc -eq $want ]] || ok=0
  if grep -qE 'bktx_secret|gh-jwt' "$tmp/stderr" || grep -v '^::add-mask::' "$tmp/stdout" | grep -qE 'bktx_secret|gh-jwt'; then ok=0; echo "  token leaked"; fi
  if compgen -G "$tmp/buildkite-oidc-auth.*" >/dev/null; then ok=0; echo "  headers file left behind"; fi
  if [[ $ok -eq 1 ]]; then echo "ok   $name"; else echo "FAIL $name (rc=$rc want=$want)"; cat "$tmp/stderr"; failures=$((failures + 1)); fi
}
calls() { cat "$tmp/$1" 2>/dev/null || echo 0; }

run success 0
check "success: output" grep -qx 'token=bktx_secret' "$tmp/out"
check "success: token masked" grep -qx '::add-mask::bktx_secret' "$tmp/stdout"
check "success: OIDC token masked" grep -qx '::add-mask::gh-jwt' "$tmp/stdout"
check "success: endpoint" grep -qx 'https://buildkite.com/oauth/token' "$tmp/urls"
check "success: client_id sent" grep -q 'client_id=cid' "$tmp/config"
check "success: audience sent" grep -q 'audience=aud' "$tmp/args"
check "success: curl -q" grep -q '^-q ' "$tmp/args"
check "success: no sleep" test ! -e "$tmp/sleeps"

run scoped 0 'BUILDKITE_SCOPE=read_builds write_builds'
check "scoped: scope sent" grep -qx 'data-urlencode = "scope=read_builds write_builds"' "$tmp/config"
check "scoped: grant_type sent" grep -qx 'data-urlencode = "grant_type=client_credentials"' "$tmp/config"
run injected-scope 1 $'BUILDKITE_SCOPE=x"\nurl = "https://evil.example'

run retry-flags 0
check "retry-flags: GitHub retries" bash -c "sed -n 1p '$tmp/args' | grep -q -- '--retry'"
check "retry-flags: exchange not retried by curl" bash -c "! sed -n 2p '$tmp/args' | grep -q -- '--retry'"

run rate-limited-then-success 0 STUB_GITHUB='{"value":"gh-jwt@N@"}' \
  STUB_BK_STATUS_1=429 'STUB_BK_HEADERS_1=ratelimit-workloadidentitytokenexchange-reset: 5' \
  STUB_BK_STATUS_2=429 'STUB_BK_HEADERS_2=RateLimit-WorkloadIdentityTokenExchange-Reset:0'
check "429: output" grep -qx 'token=bktx_secret' "$tmp/out"
check "429: three exchanges" test "$(calls bk_count)" -eq 3
check "429: fresh assertion per attempt" test "$(calls gh_count)" -eq 3
check "429: distinct assertions sent" bash -c "grep -q 'client_assertion=gh-jwt1\"' '$tmp/config' && grep -q 'client_assertion=gh-jwt2\"' '$tmp/config' && grep -q 'client_assertion=gh-jwt3\"' '$tmp/config'"
check "429: sleeps reset plus 1-3s jitter" bash -c "s=(\$(cat '$tmp/sleeps')); ((\${#s[@]} == 2 && s[0] >= 6 && s[0] <= 8 && s[1] >= 1 && s[1] <= 3))"
check "429: warning logged" grep -q '^::warning title=Buildkite OIDC authentication::.*retry 1/3' "$tmp/stderr"

run rate-limit-retries-exhausted 1 \
  STUB_BK_STATUS_1=429 'STUB_BK_HEADERS_1=RateLimit-WorkloadIdentityTokenExchange-Reset: 1' \
  STUB_BK_STATUS_2=429 'STUB_BK_HEADERS_2=RateLimit-WorkloadIdentityTokenExchange-Reset: 1' \
  STUB_BK_STATUS_3=429 'STUB_BK_HEADERS_3=RateLimit-WorkloadIdentityTokenExchange-Reset: 1' \
  STUB_BK_STATUS_4=429 'STUB_BK_HEADERS_4=RateLimit-WorkloadIdentityTokenExchange-Reset: 1'
check "exhausted: four exchanges" test "$(calls bk_count)" -eq 4
check "exhausted: message" grep -q 'after 3 retries' "$tmp/stderr"

run rate-limit-budget-exceeded 1 STUB_BK_STATUS_1=429 'STUB_BK_HEADERS_1=RateLimit-WorkloadIdentityTokenExchange-Reset: 300'
check "budget: no sleep" test ! -e "$tmp/sleeps"
check "budget: message" grep -q '300s retry budget' "$tmp/stderr"
run rate-limit-cumulative-budget 1 \
  STUB_BK_STATUS_1=429 'STUB_BK_HEADERS_1=RateLimit-WorkloadIdentityTokenExchange-Reset: 200' \
  STUB_BK_STATUS_2=429 'STUB_BK_HEADERS_2=RateLimit-WorkloadIdentityTokenExchange-Reset: 100'
check "cumulative budget: one sleep" test "$(wc -l <"$tmp/sleeps")" -eq 1
run rate-limit-missing-reset 1 STUB_BK_STATUS_1=429
check "missing reset: message" grep -q 'without a RateLimit-WorkloadIdentityTokenExchange-Reset header' "$tmp/stderr"
run rate-limit-invalid-reset 1 STUB_BK_STATUS_1=429 'STUB_BK_HEADERS_1=RateLimit-WorkloadIdentityTokenExchange-Reset: -1'
run rate-limit-non-numeric-reset 1 STUB_BK_STATUS_1=429 'STUB_BK_HEADERS_1=RateLimit-WorkloadIdentityTokenExchange-Reset: soon'
run rate-limit-huge-reset 1 STUB_BK_STATUS_1=429 'STUB_BK_HEADERS_1=RateLimit-WorkloadIdentityTokenExchange-Reset: 99999999999999999999'
run rate-limit-duplicate-reset 1 STUB_BK_STATUS_1=429 \
  'STUB_BK_HEADERS_1=RateLimit-WorkloadIdentityTokenExchange-Reset: 1\r\nratelimit-workloadidentitytokenexchange-reset: 1'
check "duplicate reset: message" grep -q 'duplicate' "$tmp/stderr"
check "invalid headers: no sleep" test ! -e "$tmp/sleeps"

run buildkite-http-error-not-retried 1 STUB_BK_STATUS_1=503 'STUB_BK_HEADERS_1=RateLimit-WorkloadIdentityTokenExchange-Reset: 1' \
  'STUB_BUILDKITE={"error":"invalid_client","error_description":"nope"}'
check "http error: one exchange" test "$(calls bk_count)" -eq 1
check "http error: diagnostics" grep -q 'invalid_client: nope' "$tmp/stderr"
run buildkite-indeterminate-status 1 STUB_BK_STATUS_1=000
check "indeterminate: message" grep -q 'indeterminate HTTP status' "$tmp/stderr"
run buildkite-curl-failure 1 STUB_BUILDKITE_RC=28
check "transport error: one exchange" test "$(calls bk_count)" -eq 1

run injected-client-id 1 $'BUILDKITE_CLIENT_ID=x"\nurl = "https://evil.example'
run missing-id-token-permission 1 ACTIONS_ID_TOKEN_REQUEST_URL=
run empty-client-id 1 BUILDKITE_CLIENT_ID=
run empty-audience 1 BUILDKITE_AUDIENCE=
run github-curl-failure 1 STUB_GITHUB_RC=22
run github-missing-value 1 'STUB_GITHUB={"value":""}'
run github-invalid-json 1 'STUB_GITHUB=<html>'
run buildkite-missing-token 1 'STUB_BUILDKITE={"error":"invalid_client"}'
run github-multiline-token 1 'STUB_GITHUB={"value":"gh-jwt\nleak"}'
run buildkite-multiline-token 1 'STUB_BUILDKITE={"access_token":"bktx_secret\n::set-output x=y"}'
run buildkite-null-token 1 'STUB_BUILDKITE={"access_token":null}'

exit $((failures > 0))
