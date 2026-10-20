<!-- configure-ai-review:baseline:start -->
# High-signal code review policy

These rules apply only when reviewing a pull request. They do not apply to Copilot Chat or cloud agent tasks. When reviewing, default to leaving no comment. Comment only when the changed code introduces a concrete correctness, security, data-integrity, compatibility, reliability, rollout, or operability defect, or when changed material behavior has no test that would catch a regression (see "Missing tests for material behavior" below).

When multiple issues compete for attention, prioritize in this order: (1) concrete correctness, security, or data-integrity defects; (2) architectural or design problems with a concrete, describable consequence; (3) missing test coverage for changed behavior. Leave the highest-priority comments first.

Do not comment on wording, spelling, formatting, naming preferences, syntax, style, import ordering, or other concerns that a compiler, formatter, linter, schema validator, test, or CI check enabled in this repository already reports. Do not restate a failing automated check. Do not leave praise, summaries, optional refactors, generic best practices, or speculative suggestions.

Before leaving a comment, verify all of the following:

- The issue is introduced or made materially worse by this pull request.
- You can describe a specific failure scenario and its impact.
- The finding starts from the changed lines. You may read callers, tests, and configuration to confirm it, but do not report issues the diff does not introduce or make worse.
- The repository's current code and configuration support the claim.
- The comment identifies the affected path and gives an actionable correction or asks for concrete missing evidence.
- The expected value of the comment is high enough to interrupt a human reviewer.

If any condition is missing, remain silent. Express uncertainty only when the uncertainty itself is a material risk that the author can resolve with specific evidence. On a re-review after new commits, do not repeat a comment on a line that has not changed since the prior run.

Use the repository's `.github/skills/code-review/SKILL.md` for domain-specific review checks when it exists. Copilot review is advisory. Whether its approval counts toward required approvals is controlled by org and branch settings, not this file.

## Trust-boundary and supply-chain changes

Always inspect a diff that changes CI, build, release, dependency, credential,
network, or security configuration. Note: Copilot code review does not inspect
lockfiles, `requirements.txt`, or generated files — leave those to Dependabot
and human review. Leave a review comment when the change introduces or materially
broadens a capability without a concrete, repository-supported need and an
appropriate control. In particular, flag:

- broader token, role, cloud, repository, or secret permissions than the changed
  operation requires;
- new collection, copying, logging, caching, artifact upload, or persistence of
  credentials or secret-bearing worker state;
- privileged workflows that check out, download, or execute untrusted pull-
  request code, artifacts, build scripts, hooks, or dependency lifecycle scripts;
- new outbound destinations, telemetry, uploads, remote shells, or network
  services unrelated to the repository's documented responsibility;
- downloaded or remotely referenced code, actions, reusable workflows, images,
  plugins, tools, or binaries that are executed without immutable identity and
  integrity verification;
- new dependencies or build inputs that are not resolved immutably;
- weakened or bypassed tests, approval gates, secret scanning, signature or
  checksum verification, TLS verification, sandboxing, or least-privilege
  defaults;
- shared caches, workspaces, or non-ephemeral runners that allow an untrusted or
  earlier build to influence a privileged or later build;
- unexplained executable binaries, encoded or obfuscated payloads, generated
  code without a documented generator, or functionality unrelated to the
  repository's stated purpose;
- untrusted input, such as a pull-request title, branch name, or issue body,
  placed directly into a `run:` script through a `${{ }}` expression instead
  of through an environment variable.

For GitHub Actions, require third-party actions and reusable workflows to be
pinned to a full commit SHA from the intended upstream repository. Require
container images by digest when they execute in CI, build, release, or
production paths. Require downloaded executables or scripts to be pinned to an
immutable version and verified before execution with an expected cryptographic
digest, or with a signature or attestation from an expected signer. HTTPS or a
checksum downloaded from the same mutable source is not sufficient integrity
evidence. Reject pipe-to-shell execution of unverified remote content.

For package-manager dependencies, require the repository's lockfile or equivalent
immutable resolution to be committed and enforced. Do not comment on a version
range merely because it is a range when an enforced lockfile pins the resolved
artifact. Do comment when a new executable build or runtime dependency can float
without reviewed immutable resolution.

Describe the exact new trust path, the realistic abuse or compromise scenario,
and the smallest corrective control. Do not allege malicious intent; when code
appears unrelated or concealed, ask for concrete purpose and provenance and
recommend removal when neither is established.

## Missing tests for material behavior

Check whether changed behavior has meaningful deterministic coverage. Comment
when the diff adds or changes a material correctness, security, compatibility,
failure-handling, state-transition, permission, parsing, retry, concurrency,
build, or release behavior and no existing or new test would fail if that
behavior regressed. A bug fix should normally include a regression test that
fails for the original defect.

Before commenting, inspect the relevant existing tests, including higher-level
and generated-output tests. Do not request tests for documentation-only changes,
mechanical refactors with unchanged behavior, generated files whose source and
generation are already tested, or behavior already exercised at an appropriate
layer. Do not demand a unit test when an existing integration or end-to-end test
more directly covers the contract.

A missing-test comment must name the unverified behavior and a concrete scenario
and assertion that would catch a realistic regression. Do not leave a generic
"add tests" comment or prescribe test-file structure. When deterministic testing
is genuinely impractical, ask for specific reproducible verification evidence
and the reason it cannot be automated.
<!-- configure-ai-review:baseline:end -->

## Repository-specific review guidance

Two independent Node.js GitHub Actions: `fetch-github-token/` (composite action that fetches an ephemeral GitHub token from Vault via OIDC) and `with-post-step/` (`node24` action that runs a main command and registers a post command). Node version is pinned by `fetch-github-token/package.json` `engines` and `with-post-step/action.yml` `runs.using`. Bundles are produced by `@vercel/ncc`; `dist/` is generated and committed.

### Focus areas

- Token exposure: when a diff in `fetch-github-token/action.yml` echoes, logs, or writes `GITHUB_TOKEN`, `VAULT_TOKEN`, `OIDC_TOKEN`, or `GH_TOKEN` to `GITHUB_OUTPUT`, `GITHUB_ENV`, or step output before `::add-mask::` runs, or passes it through a later step's `env:` block, the runner may print it in plain text. Anyone who can read the logs of a public repo then gets a live installation token. Ask for the masking order to be preserved.
- Revocation gating: when `if:` conditions, the `skip-token-revoke` default, or the `has-vault-lease` output change, a cached token (empty `lease_id`) can get revoked. Other consumer workflows sharing that cache then fail with an invalid token until the TTL expires. Conversely, a leased token that is no longer revoked stays valid after the job ends.
- Post-step registration: when `with-post-step/main.js` changes how the `STATE_<KEY>` marker is written or read, or how the exit code is propagated, the post command can run in the main phase, run twice, or never run. A skipped post step leaves ephemeral tokens unrevoked. A non-zero exit from `revoke.cjs` fails every consumer's job, so revocation failures must stay warnings.
- Vault role derivation: when the workflow-ref hash input, hash length, or `token-policy-` prefix changes, or the `sha256sum` and `shasum` branches diverge, the generated role stops matching the consumers' `TokenPolicy` resources. Every consumer using the default role then fails Vault login. The two branches must produce identical output.
- Vault endpoints: when the `ci-dev`/`ci-prod` address mapping or the `github-oidc` login path changes, tokens may be requested from the wrong Vault instance, or the OIDC JWT may be sent to an unintended host.
- Public input and output contract: when input names, defaults, or the `token` output in either `action.yml` are renamed, removed, or changed, workflows in other Elastic repos that pin the `v1` tag break without any change on their side. Ask for a compatible alias or an explicit major-version bump.
- Stale bundles: when `with-post-step/main.js` or its `package.json` changes without a matching `with-post-step/dist/index.js` change, the published action keeps executing the old code. No pre-commit hook or CI job checks this bundle. The same applies to `fetch-github-token/revoke.cjs` without `dist/index.cjs`, which is what the post step actually runs.
- Cross-OS shell portability: the composite steps run on Linux and macOS, on both x86_64 and arm64 (see `.github/workflows/test-fetch_token.yml`). When a shell step adds GNU-only flags or tools, or a bash feature unavailable on macOS, the action fails on macOS runners.
- Retry and timeout behavior: when the Vault login/read retry loop, backoff, or curl timeouts change, a transient Vault error can either fail the consumer's job immediately or hang it until the job timeout.

### Skip list

- `actionlint` (pre-commit and CI) validates workflow syntax, structure, and expressions under `.github/workflows/` — do not comment on these.
- `pre-commit/pre-commit-hooks` (CI) enforces merge-conflict markers, YAML/XML validity, end-of-file newlines, line endings, and trailing whitespace — do not comment on these.
- `gh-action-readme` (CI) keeps the `README.md` inputs/outputs tables in sync with `action.yml` — do not comment on README table drift.
- `verify-github-actions-bundle` (CI) diffs `fetch-github-token/dist/` against a fresh build — do not comment on a stale `fetch-github-token` bundle when it runs. It does not cover `with-post-step/dist/`.
- Jest (`run-unit-tests.yml`) runs `fetch-github-token/tests/` and `test-fetch_token.yml` runs the action end-to-end on four OS/arch runners — do not re-report failures they already surface.
- Renovate (`renovate.json`) manages dependency and lockfile updates — do not comment on dependency version ranges.
