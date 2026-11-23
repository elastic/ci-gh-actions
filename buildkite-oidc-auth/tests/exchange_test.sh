#!/usr/bin/env bash
# Tests exchange.sh against a stubbed curl. Run: bash .github/actions/buildkite-oidc-auth/tests/exchange_test.sh
set -uo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
script="$here/../exchange.sh"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
mkdir "$tmp/bin"

# Stub: the first call (GitHub) and second call (Buildkite) return $STUB_GITHUB / $STUB_BUILDKITE.
cat >"$tmp/bin/curl" <<'STUB'
#!/usr/bin/env bash
cat >>"$STUB_DIR/config"
printf '%s\n' "$*" >>"$STUB_DIR/args"
n=$(($(cat "$STUB_DIR/count" 2>/dev/null || echo 0) + 1))
echo "$n" >"$STUB_DIR/count"
echo "${@: -1}" >>"$STUB_DIR/urls"
if [[ $n -eq 1 ]]; then body="$STUB_GITHUB"; rc="${STUB_GITHUB_RC:-0}"; else body="$STUB_BUILDKITE"; rc="${STUB_BUILDKITE_RC:-0}"; fi
printf '%s' "$body"
exit "$rc"
STUB
chmod +x "$tmp/bin/curl"

failures=0
run() { # name expected_rc -- env...
  local name="$1" want="$2"; shift 2
  rm -f "$tmp/count" "$tmp/urls" "$tmp/config" "$tmp/args" "$tmp/out"
  : >"$tmp/out"
  env -i PATH="$tmp/bin:$PATH" STUB_DIR="$tmp" GITHUB_OUTPUT="$tmp/out" \
    ACTIONS_ID_TOKEN_REQUEST_URL="https://gh.example/oidc?x=1" ACTIONS_ID_TOKEN_REQUEST_TOKEN=reqtok \
    BUILDKITE_CLIENT_ID=cid BUILDKITE_AUDIENCE=aud \
    STUB_GITHUB='{"value":"gh-jwt"}' STUB_BUILDKITE='{"access_token":"bktx_secret"}' \
    "$@" bash "$script" >"$tmp/stdout" 2>"$tmp/stderr"
  local rc=$?
  local ok=1
  [[ $rc -eq $want ]] || ok=0
  if grep -qE 'bktx_secret|gh-jwt' "$tmp/stderr" || grep -v '^::add-mask::' "$tmp/stdout" | grep -qE 'bktx_secret|gh-jwt'; then ok=0; echo "  token leaked"; fi
  if [[ $ok -eq 1 ]]; then echo "ok   $name"; else echo "FAIL $name (rc=$rc want=$want)"; cat "$tmp/stderr"; failures=$((failures + 1)); fi
}

run success 0
grep -qx 'token=bktx_secret' "$tmp/out" || { echo "FAIL success: output missing"; failures=$((failures + 1)); }
grep -qx '::add-mask::bktx_secret' "$tmp/stdout" || { echo "FAIL success: token not masked"; failures=$((failures + 1)); }
grep -qx '::add-mask::gh-jwt' "$tmp/stdout" || { echo "FAIL success: OIDC token not masked"; failures=$((failures + 1)); }
grep -qx 'https://buildkite.com/oauth/token' "$tmp/urls" || { echo "FAIL success: wrong endpoint"; failures=$((failures + 1)); }

grep -q 'client_id=cid' "$tmp/config" || { echo "FAIL success: client_id not sent"; failures=$((failures + 1)); }
grep -q 'audience=aud' "$tmp/args" || { echo "FAIL success: audience not sent"; failures=$((failures + 1)); }
grep -q '^-q ' "$tmp/args" || { echo "FAIL success: curl -q missing"; failures=$((failures + 1)); }
run injected-client-id 1 $'BUILDKITE_CLIENT_ID=x"\nurl = "https://evil.example'
run missing-id-token-permission 1 ACTIONS_ID_TOKEN_REQUEST_URL=
run empty-client-id 1 BUILDKITE_CLIENT_ID=
run empty-audience 1 BUILDKITE_AUDIENCE=
run github-curl-failure 1 STUB_GITHUB_RC=22
run github-missing-value 1 'STUB_GITHUB={"value":""}'
run github-invalid-json 1 'STUB_GITHUB=<html>'
run buildkite-curl-failure 1 STUB_BUILDKITE_RC=22
run buildkite-missing-token 1 'STUB_BUILDKITE={"error":"invalid_client"}'
run buildkite-null-token 1 'STUB_BUILDKITE={"access_token":null}'

exit $((failures > 0))
