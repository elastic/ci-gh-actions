# AGENTS.md

## Repository purpose

This public repository publishes two independent reusable GitHub Actions.
See the [`fetch-github-token` README](fetch-github-token/README.md) and the
[`with-post-step` README](with-post-step/README.md) for why each action exists,
who uses it, and its responsibility boundary.

Each module has its own `package.json`, `action.yml`, and `README.md`; there is
no shared build, source, or runtime between them. Treat them as separate
projects that happen to live in one repository; changes to one rarely require
touching the other.

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

Lint and hygiene checks are driven by `.pre-commit-config.yaml`, enforced in
CI via `.github/workflows/pre-commit.yml` (`elastic/oblt-actions/pre-commit`)
on every PR and push to `main`:

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

CI runs all of the above via `elastic/oblt-actions/pre-commit`. To run the
same checks locally, install the `pre-commit` tool yourself (see
[pre-commit.com](https://pre-commit.com/#install)), then:

```bash
pre-commit run --all-files
```

The `fetch-github-token/README.md`'s "Pre-commit Hook" section additionally
notes running `npm install` inside `fetch-github-token/` — this is for the
module's own local build/verify hooks (Node-based), not for installing
`pre-commit` itself.

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

## AI attribution

For every AI tool that materially contributes to code, tests, documentation,
configuration, or the substance of a change:

- Resolve the tool's runtime identity and add one unformatted trailer to the
  commit message. Use the exact model or agent slug and reasoning effort
  whenever exposed; omit unavailable components rather than guessing:

  ```text
  Assisted-by: <tool name> (<most specific verified runtime identity>)
  ```

- Repeat the same trailer in the pull-request description.
- Preserve the spelling and specificity of exposed runtime values; do not
  shorten a specific model slug to a broader model family.
- Preserve valid tool-native attribution, such as
  `Made with [Cursor](https://cursor.com)` or a genuine `Co-authored-by`
  trailer, in addition to `Assisted-by`.
- Never invent a bot identity, model name, agent identifier, or email address.
- Keep trailers on their own lines without bullets, Markdown emphasis, or
  surrounding underscores.
- Keep the human author or committer accountable for understanding and
  verifying the change.

For a squash merge, verify that the final squash commit message contains every
attribution trailer. GitHub may populate that message from the pull-request
description, commit information, or only the pull-request title depending on
repository settings, so putting attribution in the PR description improves
preservation but does not guarantee it.

When preparing a commit or pull request, offer to create it with the correct
attribution. If the user will create it manually, show the exact trailers to
copy into both places.
