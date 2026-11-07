---
id: investigation-github-actions-node-test-directory
created: 2026-11-07
type: investigation
status: resolved
severity: high
tags: [ci, github-actions, node-test-runner, node22, deployment]
sources:
  - .playground/logs_114470768504/1_build.txt
  - Makefile
  - package.json
  - .github/workflows/pages.yml
  - https://nodejs.org/docs/latest-v22.x/api/test.html
  - https://github.com/nodejs/node/blob/v26.13.0/lib/internal/test_runner/runner.js
---

# Investigation: GitHub Actions fails at `node --test test/` on Node 22

## Problem Statement

The `pages` GitHub Actions workflow fails in the `build` job at `make check`.
The failure is deterministic and happens before `make verify-build` or any Pages
deployment step. No site is published.

The local `make test` passes on Node 26.13.0, so the failure is specific to the
CI environment.

## Symptoms

- CI log: `node --test test/` immediately fails with:

  ```
  Error: Cannot find module '/home/runner/work/GiveMePasswords/GiveMePasswords/test'
  code: 'MODULE_NOT_FOUND'
  ```

- The test runner reports one failing "test" named `test`:
  `# tests 1`, `# pass 0`, `# fail 1`.
- `make: *** [Makefile:4: test] Error 1`; the job exits 2.
- The `deploy` job never starts.
- Locally, `make test` → 53 passing, 0 failing (Node 26.13.0).
- The checkout, `setup-node`, and token permissions are all healthy
  (`Contents: read`, `Metadata: read`, `Pages: write`).

## Root Cause

`Makefile:4` and `package.json:11` invoke the test runner as:

```sh
node --test test/
```

Node's test-runner CLI treats positional arguments as **glob patterns** (this is
the documented contract in Node 22). A bare directory argument such as `test/`
matches the directory entry itself. The runner then tries to execute that
directory as a test file, which the CommonJS loader rejects with
`MODULE_NOT_FOUND`.

Node 20 still had pre-glob directory handling, and Node 26 restores it as a
compatibility behavior. Node 22, 24, and 25 do not expand the directory. The
project's local toolchain is Node 26, which is why the command works locally and
fails in CI, where the workflow pins Node 22.

The exact regression window is therefore **Node 22–25**. Node 26 is not the
problem; the directory-argument form is.

## Evidence

### 1. CI log

`.playground/logs_114470768504/1_build.txt`:

- line 123: `node: v22.23.4`
- line 114: workflow requested `node-version: 22`
- line 132: `node --test test/`
- line 137: `Cannot find module '/home/runner/work/GiveMePasswords/GiveMePasswords/test'`
- lines 149–170: TAP failure, `# tests 1`, `# fail 1`, `make: *** [Makefile:4: test] Error 1`
- lines 22–26: `GITHUB_TOKEN` has `Contents: read`, `Metadata: read`, `Pages: write`

### 2. Version matrix

Each cell is the result of running the command from the repository root against
the real 53-test suite.

| Node | `--test test/` | `--test test/*.test.mjs` | `--test "test/**/*.test.mjs"` |
|---|---|---|---|
| 20.20.2 | **pass 53** | pass 53 | **fail: "Could not find"** |
| 22.18.0 | **fail: MODULE_NOT_FOUND** | pass 53 | pass 53 |
| 22.23.4 (CI) | **fail: MODULE_NOT_FOUND** | pass 53 | pass 53 |
| 24.22.2 | **fail: MODULE_NOT_FOUND** | pass 53 | pass 53 |
| 25.9.0 | **fail: MODULE_NOT_FOUND** | pass 53 | pass 53 |
| 26.13.0 (local) | pass 53 | pass 53 | pass 53 |

Reproduce with the downloaded binaries in `.playground/node22/`:

```sh
.playground/node22/node-v22.23.4-linux-x64/bin/node --test test/
# Error: Cannot find module '.../test'

.playground/node22/node-v22.23.4-linux-x64/bin/node --test test/*.test.mjs
# # tests 53  # pass 53  # fail 0
```

`make` itself expands the glob correctly; a throwaway `.PHONY` target using
`node --test test/*.test.mjs` passes 53/53 on the local Node 26.

### 3. Node 22 documentation

`doc/api/test.md` for v22.23.4:

> Alternatively, one or more glob patterns can be provided as the final
> argument(s) to the Node.js command. … Glob patterns follow the behavior of
> `glob(7)`. … Matching files are executed as test files.

A directory path is not a documented test-file argument in the 22 line.

### 4. Node 26 source restores directory expansion

`lib/internal/test_runner/runner.js` at v26.13.0:

```js
// A directory argument is expanded to search for the default test files
// within it, matching the behavior from before glob patterns were
// supported. ...
const resolved = isAbsolute(pattern) ? pattern : resolve(cwd, pattern);
try {
  if (statSync(resolved).isDirectory()) {
    return `${...}/${kDefaultPattern}`;
  }
} catch { ... }
```

This block is absent in v22.23.4 and v24.22.2. It explains why Node 26 works
and Node 22–25 do not.

### 5. The build itself is Node 22 safe

`node scripts/build.mjs --out .playground/verify22` under Node 22.23.4 produced
`1acaba57ed1c3f7fbfd9f1934e4e67dee560e327f1421650db7c65e808f84786`, and
`diff -r .playground/verify22 dist` reported no differences. `make verify-build`
should therefore pass once the test command is fixed; the test invocation is the
only failing step.

## Impact

- **Deployment:** blocked. The build job fails before `verify-build`, so the
  `deploy` job never runs and `https://vextroyer.github.io/GiveMePasswords/`
  remains unpublished.
- **Artifact:** unaffected. No source, build, or `dist/` change is involved; the
  artifact hash remains `1acaba57…f84786`.
- **Security/data:** none.
- **Severity:** high for the deployment goal, low for product risk.

## Resolution

Make the test command version-agnostic by passing an explicit file glob instead
of a directory. Two files must change together:

1. `Makefile:4`

   ```make
   test:
   	node --test test/*.test.mjs
   ```

2. `package.json:11`

   ```json
   "test": "node --test test/*.test.mjs"
   ```

Why this form:

- It passes the full suite (56/56 after the new contract tests) on Node 20, 22,
  24, and 26 (the full supported range).
- The shell expands the glob before Node sees it, so it does not depend on the
  Node 22 glob implementation.
- The quoted `"test/**/*.test.mjs"` form is **not** suitable: Node 20.20.2
  rejects it with `Could not find`, even though Node 22+ accepts it.

Do **not** solve this only by bumping the workflow to Node 26:

- It would leave `make test` broken for Node 20–25 users, while
  `package.json` claims `engines.node >= 20`.
- It would hide the same class of bug until the next Node major.

After the change, `make check` and `make verify-build` should be re-run locally
on Node 22 (the CI version) and Node 26 (the local version). The build is
unaffected, so `dist/SHA256SUMS` must not change.

**Applied (2026-11-07):** commits `85827ab` (contract test) and `7450404`
(Makefile, `package.json`, workflow trigger). Verified on Node 22.23.4 and
26.13.0: 56/56 tests, cross-check OK, `verify-build` no diff, hash unchanged
(`1acaba57…f84786`).

## Related gap found during the investigation

The workflow trigger paths did not include `Makefile`, even though the workflow
runs `make check` and `make verify-build`. A future Makefile-only change would
not trigger the workflow. Fixed in `7450404`: `- "Makefile"` was added to
`on.push.paths`, and `test/test-command.test.mjs` pins it.

Note that the fix commit triggers the workflow anyway because `package.json` is
in the path list; the added path matters for future Makefile-only changes.

## Prevention

1. **Test on the minimum and CI-pinned Node versions.** The failure was invisible
   because local dev uses Node 26 and CI uses Node 22. A small CI matrix
   (`20`, `22`, `24`, `26`) running `make check` would catch it.
2. **Prefer explicit file globs over directory arguments** in scripts and
   Makefiles. The directory form is version-dependent; the glob form is not.
3. **Keep a `.nvmrc`/`engines` contract** and verify it. `engines.node >= 20` is
   only meaningful if at least Node 20 is exercised.
4. **Add `Makefile` to the workflow trigger paths** so build-tool changes are
   validated.
5. **Record the supported test command** in `README.md`/`docs/verification.md`
   (`node --test test/*.test.mjs`) so contributors do not reintroduce `test/`.

## Non-issues (ruled out)

- **Token permissions:** `Contents: read`, `Metadata: read`, `Pages: write` are
  correct; the failure occurs before any Pages action.
- **Checkout:** the log shows a full checkout of commit `3a53ae7`; the `test/`
  directory is present. The error is the loader trying to execute the directory,
  not a missing checkout.
- **Sparse checkout / paths filter:** `sparse-checkout disable` is logged, and
  the workflow was triggered by the workflow-file change.
- **Action versions:** the Node 20 deprecation warning for `actions/checkout@v4`
  and `actions/setup-node@v4` is unrelated; those actions ran successfully.
- **The app/artifact:** no source, build, or hash issue.

## Next steps

1. Push the fix commits (`85827ab`, `7450404`); the `package.json`/`Makefile`
   changes trigger the workflow.
2. Confirm the `build` job is green and the `deploy` job runs.
3. Verify the live URL hash and meta CSP.
4. Record the result in `docs/qa-record.md` and the GitHub Pages plan.
