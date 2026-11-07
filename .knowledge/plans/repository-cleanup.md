---
id: repository-cleanup
created: 2026-11-07
modified: 2026-11-07
type: plan
status: active
expires: 2026-11-14
phases:
  - name: Drop the Cloudflare artifact and rebuild
    done: true
    goal: Remove dist/_headers and the Cloudflare fallback with TCR, prove the reviewed index hash is unchanged, and redeploy.
  - name: Documentation truth and personal-context scrub
    done: true
    goal: Make every product doc describe the live GitHub Pages system, the real headers, and the residual risks, with no personal narrative.
  - name: Knowledge triage
    done: true
    goal: Convert durable maintainer knowledge to docs/ and delete everything in .knowledge/ that is not relevant to the current or future project.
  - name: CI hardening and repository metadata
    done: false
    goal: Add a test-only CI workflow with a Node matrix and close the small metadata gaps, without touching .opencode/.
  - name: Final verification and local cleanup
    done: false
    goal: Prove the cleaned repo still serves the reviewed bytes, confirm docs-only pushes do not deploy, and remove local build scratch while preserving .playground/.
---

# Plan: Repository Cleanup Before the Next Round of Improvements

## Context

The site is live at `https://vextroyer.github.io/GiveMePasswords/` and the served
bytes match `dist/SHA256SUMS`
(`1acaba57ed1c3f7fbfd9f1934e4e67dee560e327f1421650db7c65e808f84786`). The
product is healthy: 56/56 tests, cross-check OK, `dist/` byte-for-byte
reproducible.

The repository is **small but noisy**: 104 tracked files, 682 KB of tracked
content. 46 files are `.opencode/` (the agent framework this repository depends
on), 19 are `.knowledge/` (research for two concepts, one abandoned, plus two
plans), and only about 36 are the actual product. The cleanup is not a code
rewrite. It is:

1. removing the inert Cloudflare artifact and the stale Cloudflare story;
2. making every document describe the live GitHub Pages system;
3. removing personal context from product docs;
4. triaging `.knowledge/` by maintainer relevance;
5. adding the CI that would have caught the Node 22 failure.

Full evidence: `.knowledge/insights/repository-simplification-audit.md`.
Deployment record: `.knowledge/plans/github-pages-deployment.md`.

## Locked decisions

| Area | Decision |
|---|---|
| `.opencode/` | **Keep byte-identical.** It is the agent framework and has no product/build/test dependency. No phase may modify it. |
| `.knowledge/` | **Triage.** Durable maintainer knowledge moves to `docs/`; everything not relevant to the current or future project is deleted. `.knowledge/` stays as the agent workspace. |
| Hosting | **GitHub Pages via GitHub Actions only.** Cloudflare is discarded. |
| Personal context | **Remove the cousin narrative** from all product docs. Documentation is for future developers and maintainers; the product is for users. |
| Future features | **Out of scope.** Do not add scaffolding for them. |
| Release | **No version bump or tag now.** Keep `[Unreleased]` unless the user asks later. |
| Test command | `node --test test/*.test.mjs`; CI pins Node 22. |
| Artifact | Publish the committed `dist/` after verification; do not rebuild and publish. |

## Phases

### Phase 1: Drop the Cloudflare artifact and rebuild

**Goal:** Remove `dist/_headers`, `headersFor()`, and the Cloudflare fallback
with TCR, prove `dist/index.html` is unchanged, and redeploy.

**Deliverable:** A build that emits only `dist/index.html` and
`dist/SHA256SUMS`, plus updated `package.json` metadata, committed and deployed.

**Steps (TCR):**

1. **Test first.** In `test/build.test.mjs`, change the first test to assert that
   `_headers` is **not** emitted (remove the existence assertion at line 26 and
   add `assert.equal(existsSync(join(outDir, "_headers")), false)`). Run
   `make test`; it must fail.
2. Commit the test: `test: require the build to stop emitting _headers`.
3. **Implement.** In `scripts/build.mjs`, remove `headersFor()` (lines 168-180),
   the `const headers = headersFor(csp)` line (275), and the `_headers` write
   (280). Keep `cspFor` and the meta-CSP path. In `test/build.test.mjs`, remove
   the "headers file carries the required hardening headers" test (118-134) and
   the remaining `_headers` assertions (113-115, 155-158); rename the first test
   to "the build emits one self-contained page and a hash".
4. Run `make check` (**55/55**: the hardening test is removed, the other
   `_headers` references are assertions inside surviving tests), `make build`,
   and `make verify-build`. Confirm `sha256sum dist/index.html` is
   `1acaba57…f84786`, `dist/SHA256SUMS` is unchanged, and `dist/_headers` is
   gone.
5. Add `license`, `repository`, and `homepage` to `package.json` in this commit
   so the only `package.json` change rides the same deploy.
6. Commit: `fix: drop the inert Cloudflare _headers artifact`.
7. Push. This **does** trigger `pages.yml` (`scripts/**` and `dist/**`). Verify
   the run is green, the live index hash is unchanged, and `/_headers` returns
   404.

**Done when:**

- [ ] `dist/_headers` is no longer tracked.
- [ ] `make check` is 55/55; `make verify-build` reports no diff.
- [ ] `sha256sum dist/index.html` is `1acaba57…f84786`; `dist/SHA256SUMS` is
      unchanged.
- [ ] The Pages run is green; the live index hash is unchanged; `/_headers` is
      404.
- [ ] `package.json` has `license`, `repository`, and `homepage`, and is valid
      JSON.
- [ ] No code path writes or reads `_headers`; only historical `CHANGELOG`
      entries may mention it.

**Depends on:** none.

### Phase 2: Documentation truth and personal-context scrub

**Goal:** Every product doc describes the live GitHub Pages system, the actual
headers, and the residual risks, with no personal narrative.

**Deliverable:** Updated `README.md`, `CHANGELOG.md`, `SECURITY.md`,
`docs/deployment.md`, `docs/verification.md`, `docs/privacy.md`,
`docs/threat-model.md`, `docs/faq.md`, `docs/qa-record.md`,
`docs/ux-checklist.md`; deleted `docs/usability-record.md` and
`docs/router-compatibility.md`; all links updated.

**Content rules:**

- **Hosting:** GitHub Pages via Actions; no Cloudflare, no `.pages.dev`.
- **Live evidence:** URL, run `42397975872`, hash
  `1acaba57…f84786`, byte-identical page, meta-CSP hashes.
- **Real headers:** `server: GitHub.com`, HSTS `max-age=31556952`,
  `cache-control: max-age=600`, `access-control-allow-origin: *`; no CSP,
  XFO, COOP, CORP, nosniff, Referrer-Policy, or Permissions-Policy response
  headers.
- **Residual risk:** `frame-ancestors 'none'` in a `<meta>` CSP is ignored by
  browsers; GitHub Pages sends no `X-Frame-Options`; the page is framable.
  HSTS is present but not preloaded and not universal on `github.io`.
- **Cache:** `max-age=600`; verification uses a cache-buster and does not use
  `curl --compressed` when hashing.
- **Test count:** 55 tests in Phase 2; update again in Phase 4 if the CI test
  changes it.
- **Personal context:** remove "cousin", "her", "family", "household", and the
  usability/router templates. Generalize to "the user" or "a representative
  consumer router".

**Specific edits:**

- `README.md`: live status, 55 tests, live URL, remove `_headers` from commands
  and layout, remove cousin/usability/router rows, update roadmap and docs
  table, describe `.opencode/` and `.knowledge/` accurately.
- `CHANGELOG.md`: add `Unreleased` entries for the GitHub Pages deployment, the
  Node 22 test-command fix, the `_headers` removal, the docs cleanup, and the
  CI matrix; remove the cousin line.
- `SECURITY.md`: say the repository and site are public; keep private
  vulnerability reporting.
- `docs/deployment.md`: full GitHub Pages rewrite (Actions source, workflow,
  trigger paths, Node 22, live URL, trailing-slash 301, rollback, limits, no
  custom headers, `_headers` removed).
- `docs/verification.md`: live URL, cache-buster, `--compressed` warning, meta
  CSP hash check, actual header set, `frame-ancestors` limitation, no
  `_headers`.
- `docs/privacy.md`: GitHub Pages / GitHub, Inc. instead of Cloudflare.
- `docs/threat-model.md`: GitHub Pages; generalize the cousin references at
  lines 42, 55, 67; record the framable-page residual risk; point router
  compatibility at `docs/qa-record.md`.
- `docs/faq.md`: live URL; replace "maintenance section in the plan" with
  `SECURITY.md` and the README.
- `docs/qa-record.md`: 55 tests, Node 22.23.4 and 26.13.0, live run/hash/header
  evidence; browser/device checks remain pending; fold the router questions
  (leading zeros, exact 8 digits, all-digit acceptance, repeat policy, admin
  session, WPA mode) into the pending list; remove the untracked
  `.playground/smoke-dom.mjs` rows (the shim stays local-only in
  `.playground/`; do not delete it); remove "Deployment blocked" and the
  cousin line.
- `docs/ux-checklist.md`: retitle "UX Failure Modes"; remove the `.knowledge`
  research link and the phase language; keep the table.
- Delete `docs/usability-record.md` and `docs/router-compatibility.md`.

**Done when:**

- [ ] `git grep -nE 'Cloudflare|pages\.dev|49 (tests|passing)|Deployment blocked|blocked, external|once it is published|cousin'`
      returns only historical `CHANGELOG` entries, if any.
- [ ] `README.md` says 55 tests, uses the live URL, and contains no
      `_headers`, cousin, usability, or router-record references.
- [ ] `docs/deployment.md` and `docs/verification.md` describe only GitHub
      Pages and the real header set.
- [ ] `docs/threat-model.md` records the framable-page residual risk.
- [ ] `docs/qa-record.md` records the live evidence and the pending manual
      checks, with no claim that depends on an untracked `.playground/` file
      (the shim remains local-only).
- [ ] `docs/usability-record.md` and `docs/router-compatibility.md` are gone
      and nothing links to them.
- [ ] All relative Markdown links resolve; `make check` is green.
- [ ] The docs-only commit does **not** trigger the `pages` workflow.

**Depends on:** Phase 1.

### Phase 3: Knowledge triage

**Goal:** Convert durable maintainer knowledge to `docs/` and delete everything
in `.knowledge/` that is not relevant to the current or future project.

**Deliverable:** New `docs/architecture.md`; updated `docs/deployment.md` and
`docs/verification.md`; `.knowledge/` reduced to the working plan and audit.

**Convert:**

- `.knowledge/insights/project-overview.md` → **`docs/architecture.md`**:
  purpose and non-goals, layout, data flow, build, test, deploy, constraints,
  and design rationale. Remove the cousin text and stale status/commit counts.
- `.knowledge/plans/github-pages-deployment.md` → fold the durable operational
  content into **`docs/deployment.md`** (rollback, limits, trigger paths,
  header tradeoffs, first-run evidence).
- `.knowledge/notes/report-public-password-generator.md` and
  `.knowledge/notes/research-public-password-generator/*` → extract a
  **concise design-rationale section** into `docs/architecture.md`: why a
  deterministic seed + month, why a long-lived recovery code, why the ceremony,
  why client-side only, and why GitHub Pages. Do not copy the research.
- `.knowledge/insights/investigations/github-actions-node-test-directory.md` →
  add the prevention lesson to `docs/architecture.md`: Node 22 does not expand
  a directory argument, so the test command is
  `node --test test/*.test.mjs`, and CI pins Node 22.

**Delete after conversion:**

- `.knowledge/notes/opencode-framework-guide.md` (the framework documents
  itself).
- `.knowledge/notes/report-router-password-site.md` and
  `.knowledge/notes/research-router-password-site/` (abandoned concept).
- `.knowledge/notes/report-public-password-generator.md` and
  `.knowledge/notes/research-public-password-generator/` (after extracting the
  rationale).
- `.knowledge/insights/investigations/github-actions-node-test-directory.md`
  (after extracting the lesson).
- `.knowledge/insights/project-overview.md` (after conversion).
- `.knowledge/plans/github-pages-deployment.md` (after conversion).
- `.knowledge/plans/public-monthly-password-generator.md` (superseded; durable
  requirements live in the spec, FAQ, threat model, and UX checklist).

**Link updates:**

- `README.md`: remove any `.knowledge/` links; add `docs/architecture.md` to
  the docs table.
- `docs/ux-checklist.md`: already unlinked in Phase 2.
- `docs/faq.md`: already unlinked in Phase 2.

**Done when:**

- [ ] `docs/architecture.md` exists and covers layout, data flow, build, test,
      deploy, constraints, and the design rationale.
- [ ] `docs/deployment.md` contains the durable operational content from the
      deployment plan.
- [ ] `.knowledge/` contains only `plans/repository-cleanup.md` and
      `insights/repository-simplification-audit.md` (the working artifacts,
      removed in Phase 5).
- [ ] `git grep -nE 'research-router-password-site|research-public-password-generator|report-router-password-site|opencode-framework-guide|project-overview|github-pages-deployment|public-monthly-password-generator'`
      is clean.
- [ ] `.opencode/` is byte-identical (`git status --short .opencode` is empty).
- [ ] `make check` is green; the docs-only commit does not deploy.

**Depends on:** Phase 2.

### Phase 4: CI hardening and repository metadata

**Goal:** Catch Node-version regressions and close the small metadata gaps,
without touching `.opencode/`.

**Deliverable:**

- New `.github/workflows/ci.yml`:
  - triggers on `push` and `pull_request`;
  - matrix Node `20`, `22`, `24`, `26`;
  - runs `make check`; runs `make verify-build` on Node 22;
  - no Pages permissions, no deploy.
- New test (TCR): `test/ci-workflow.test.mjs` asserting `ci.yml` exists, runs
  on push/PR, and includes the four Node versions. Write the test first, watch
  it fail, then add the workflow.
- `.nvmrc` containing `22`.
- Keep `pages.yml` artifact-only and path-filtered. `test/**` must trigger CI,
  not Pages.
- `package.json` metadata was already added in Phase 1; do not duplicate it.

**Done when:**

- [ ] A test-only commit triggers CI and **not** Pages.
- [ ] An artifact commit triggers both CI and Pages.
- [ ] CI is green on all four Node versions.
- [ ] `make check` and `make verify-build` are green locally.
- [ ] `.nvmrc` matches the CI default; `package.json` is valid JSON.
- [ ] The test count is updated in `README.md` and `docs/qa-record.md` if the
      CI test changes it.
- [ ] `.opencode/` is untouched.

**Depends on:** Phase 1 and Phase 3.

### Phase 5: Final verification and local cleanup

**Goal:** Prove the cleaned repo still serves the reviewed bytes, confirm
docs-only pushes do not deploy, remove local build scratch without touching
`.playground/`, and close the plan.

**Deliverable:**

- Full gates: `make check`, `make verify-build`, live hash, meta-CSP hash
  audit, live header check.
- Local cleanup: delete `.build/` and any leftover `session` file. **Do not
  delete `.playground/`** — it is the intended local developer workspace and
  stays in place.
- Plan status set to `done`; remove the working audit and this plan from the
  tree (git history retains them), leaving `.knowledge/` as the empty agent
  workspace.

**Done when:**

- [ ] `make check` is green; `make verify-build` reports no diff.
- [ ] `curl -s "https://vextroyer.github.io/GiveMePasswords/?$(date +%s)" | sha256sum`
      equals `dist/SHA256SUMS`.
- [ ] The live page is byte-identical to `dist/index.html`; the meta-CSP script
      and style hashes match the deployed inline blocks.
- [ ] `/_headers` returns 404; no `_headers` exists in `dist/`.
- [ ] The final Pages run is green if the artifact changed; docs-only pushes
      produced no Pages run.
- [ ] `git status` is clean; `master` matches `origin/master`.
- [ ] `.build/` and `session` are gone; `.playground/` is preserved.
- [ ] This plan's `status` is `done`; the audit and plan are removed from the
      working tree.

**Depends on:** Phases 1-4.

## Success Criteria

- The product passes 55+ tests (final count after the CI test), the cross-check
  reproduces the vectors, and `dist/` is byte-for-byte reproducible.
- No tracked doc presents Cloudflare Pages as the current target, claims the
  deployment is blocked, says 49 tests, or contains the cousin narrative.
- The live site serves the reviewed hash and the meta CSP is intact.
- `.knowledge/` contains no abandoned research or superseded plans; durable
  knowledge is in `docs/`.
- `.opencode/` is unchanged.
- `.playground/` is preserved as the local developer workspace.
- A new maintainer can read `README.md`, `docs/architecture.md`,
  `docs/deployment.md`, and `docs/verification.md` and understand the live
  system without reading historical research.
- A test-only push runs CI without deploying; an artifact push deploys the
  reviewed bytes.

## Risks & Mitigations

| Risk | Likelihood | Mitigation |
|---|---|---|
| Removing `_headers` changes the build output and triggers a deploy | Medium | TCR; confirm `dist/index.html` hash is unchanged, `SHA256SUMS` is unchanged, `make verify-build` passes, then push and verify the live hash and `/_headers` 404 |
| Docs rewrite misses a stale reference | Medium | Run the `git grep` gates in Phase 2; check all relative links |
| Deleting `.knowledge/` breaks README or checklist links | Medium | Update links in Phase 2 before deleting in Phase 3; run the link check |
| CI matrix version unavailable on `setup-node` | Low-Medium | Use 20/22/24/26; if 26 is unavailable, drop to 20/22/24 and document |
| A docs-only push accidentally triggers Pages | Low | Keep `docs/**`, `.knowledge/**`, `README.md`, `CHANGELOG.md`, and `test/**` out of the `pages.yml` path filter; verify with the Actions tab |
| `package.json` metadata triggers an extra deploy | Medium | Add the metadata in Phase 1, alongside the artifact change, so it rides the same run |
| Personal context remains in git history | Certain | Accept; do not rewrite history. The current tree is what maintainers read |
| `.playground/` is mistakenly deleted during cleanup | Low | It is explicitly out of scope; Phase 5 removes only `.build/` and `session` |
| Future features need the removed research | Low-Medium | The durable rationale is in `docs/architecture.md`; git history retains the rest |
| Removing `_headers` leaves the page framable | Certain | Document as a residual risk; use a header-capable host if clickjacking becomes a real concern |

## Related

- Audit: `.knowledge/insights/repository-simplification-audit.md`
- Deployment plan: `.knowledge/plans/github-pages-deployment.md`
- Node 22 RCA: `.knowledge/insights/investigations/github-actions-node-test-directory.md`
- Live run: `https://github.com/Vextroyer/GiveMePasswords/actions/runs/42397975872`
- Live site: `https://vextroyer.github.io/GiveMePasswords/`
