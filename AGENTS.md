# AGENTS.md

## What this repo is

Public repository publishing reusable GitHub Actions consumed by workflows in
other Elastic public repos (per `catalog-info.yaml`). It contains two
independent, single-purpose Node.js actions — there is no shared build,
shared source, or shared runtime between them:

- **`fetch-github-token/`** — fetches an ephemeral GitHub token from Vault
  using OIDC authentication.
- **`with-post-step/`** — generic JS action that runs a main command and
  registers a command to run as a post step.

Each module has its own `package.json`, `action.yml`, and `README.md`. Treat
them as separate projects that happen to live in one repo; changes to one
rarely require touching the other.

## Owner

`group:ci-systems` (`@elastic/ci-systems`) owns the whole repo — stated in
both `catalog-info.yaml` and `.github/CODEOWNERS` (a single root-level `*`
rule, no per-path split).

## Build

Each module builds independently via `@vercel/ncc`, which bundles the
module's JS entrypoint into a single `dist/` file:

```bash
cd fetch-github-token && npm install && npm run build   # -> dist/index.cjs
cd with-post-step && npm install && npm run build        # -> dist/index.js
```

The two modules invoke their bundle differently: `with-post-step/action.yml`
is a `node24` action whose `runs.main`/`runs.post` point directly at
`dist/index.js`. `fetch-github-token/action.yml` is a **composite** action
(`runs.using: composite`) — its own logic is inline shell, but one of its
steps invokes `with-post-step` to register `fetch-github-token/dist/index.cjs`
as a post-step command (token revocation on exit), so `dist/index.cjs` is
still load-bearing even though it isn't referenced via `runs.main`.

There is no root-level build command — build per module.

`dist/` is committed. The pre-commit hook `build-and-stage-github-actions`
(see `.pre-commit-config.yaml`) rebuilds and re-stages
`fetch-github-token/dist/` automatically whenever `revoke.cjs`,
`package.json`, or `action.yml` in that module changes. **This automation
currently only covers `fetch-github-token`** — the hook's file trigger is
scoped to `^fetch-github-token/...`. `with-post-step` has an equivalent
`npm run build` / `npm run verify-bundle` in its own `package.json`, but
rebuilding and re-staging its `dist/` after a source change is currently a
manual step; there is no pre-commit hook or CI check wired up for it.

## Tests

Test coverage is **not uniform across the two modules**:

- `fetch-github-token` has a real Jest suite
  (`fetch-github-token/tests/revoke.test.mjs`, run via `npm test` ->
  `node --experimental-vm-modules node_modules/.bin/jest`) covering
  token-revoke success, no-token-skip, and error-handling paths. It runs in
  CI on every PR via `.github/workflows/run-unit-tests.yml` (matrix
  currently lists only `["fetch-github-token"]`) and is also exercised
  end-to-end across multiple OSes by
  `.github/workflows/test-fetch_token.yml`.
- `with-post-step` has **no `tests/` directory and no test script** — it is
  not part of `run-unit-tests.yml`'s matrix. Changes here are not covered by
  an automated test suite; rely on manual verification and the
  `verify-bundle` bundle-diff check (below) until tests are added.

## Lint / other CI checks

Lint and hygiene checks are driven by `.pre-commit-config.yaml`. Buildkite
runs the complete normal hook set on pull requests, including secret
scanning. The public GitHub Actions workflow uses
`.pre-commit-config.github-actions.yaml` to preserve the existing public-only
hooks on every PR and push to `main`; its repository-scoped token cannot read
the private Gitleaks hook repository:

- `rhysd/actionlint` — lints all GitHub Actions workflow YAML.
- `pre-commit/pre-commit-hooks` — merge-conflict markers, YAML/XML
  validation, end-of-file/whitespace fixups.
- `reakaleek/gh-action-readme` — keeps each module's `README.md`
  inputs/outputs tables in sync with its `action.yml` (edit `action.yml`,
  not the generated table markers in the README).
- `verify-github-actions-bundle` (local hook) — re-runs
  `npm run verify-bundle` in `fetch-github-token` and diffs the result
  against the committed `dist/`, failing if they differ. Scoped to
  `fetch-github-token` only, same as the build hook above; `with-post-step`
  has the equivalent `npm run verify-bundle` script available but it isn't
  wired into pre-commit or CI.

Buildkite runs all hooks. To run the same checks locally, use the Hermit-pinned
pre-commit launcher:

```bash
./bin/pre-commit run --all-files
```

The `fetch-github-token/README.md`'s "Pre-commit Hook" section additionally
notes running `npm install` inside `fetch-github-token/` — this is for the
module's own local build/verify hooks (Node-based), not for installing
`pre-commit` itself.

## Secret handling

The canonical secret-scanning hook is `gitleaks` from private
`elastic/gitleaks-hooks` release `v1.0.0`. It invokes the repository's
Hermit-pinned `./bin/gitleaks` launcher (Gitleaks 8.30.1). Developers with
access to the private hook repository can install all local hooks with
`./bin/pre-commit install`; Buildkite runs the same complete normal hook set
after Hermit provisions both pinned tools.

- Never place credentials, tokens, private keys, cookies, or production
  secret values in tracked files, examples, tests, prompts, logs, or generated
  output.
- Use the approved secret store and inject secrets only at runtime. For CI,
  follow [Vault secrets for Buildkite](https://codex.elastic.dev/r/platform-engineering-productivity/tooling-services/buildkite/vault-secrets).
- Run `./bin/pre-commit run gitleaks --all-files` before committing or pushing.
- Treat any detected secret as exposed and stop for remediation.
- Never bypass push protection or secret scanning, select a GitHub bypass
  reason, use `--no-verify` or `SKIP=gitleaks`, or add an allowlist or
  suppression unless the user explicitly requests that exact override.
- A generic request to complete, commit, push, merge, or open a pull request
  does not authorize an override.

## Making a change

1. Edit source in the relevant module (`revoke.cjs` for
   `fetch-github-token`, `main.js` for `with-post-step`), not `dist/`
   directly — `dist/` is generated.
2. If editing `fetch-github-token`, the pre-commit hook rebuilds `dist/` for
   you on commit. If editing `with-post-step`, run
   `cd with-post-step && npm run build` yourself before committing.
3. Update `action.yml` if inputs/outputs changed; `gh-action-readme` will
   sync the README tables on commit.
4. Add/update tests in `fetch-github-token/tests/` if touching that module.
   `with-post-step` has no test suite to extend yet.
