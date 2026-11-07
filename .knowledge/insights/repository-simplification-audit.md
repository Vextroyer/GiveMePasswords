---
id: repository-simplification-audit
created: 2026-11-07
type: audit
status: active
tags: [cleanup, repository-hygiene, docs, github-pages, tooling]
sources:
  - git ls-files (104 tracked files at 570e866)
  - README.md
  - CHANGELOG.md
  - SECURITY.md
  - docs/*.md
  - .knowledge/plans/*.md
  - .knowledge/insights/project-overview.md
  - .github/workflows/pages.yml
  - test/*.test.mjs
  - https://vextroyer.github.io/GiveMePasswords/
  - https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy/frame-ancestors
---

# Repository Simplification Audit

**Date:** 2026-11-07
**Baseline:** `master` at `570e866` (31 commits), live at
`https://vextroyer.github.io/GiveMePasswords/`.
**Goal:** reduce cognitive load and stale content before the next round of
product improvements, without touching the frozen algorithm or the reviewed
artifact.

## Executive summary

The repository is **small but noisy**, not large:

- 104 tracked files, 682 KB of tracked content, 1.29 MiB of git objects.
- **46 files (44%) are `.opencode/`**, a vendored copy of a generic agent
  framework. It is not product code and is not referenced by the product docs.
- **19 files (18%) are `.knowledge/`**, mostly research notes for two product
  concepts (one of them abandoned) plus two plans.
- Only about **36 files are the actual product** (source, build, tests, docs,
  artifact, workflow, root config).

The product itself is healthy: 56/56 tests, cross-check OK, `dist/` byte-for-byte
reproducible, live hash matches, meta CSP hashes match the deployed inline code.
**No code cleanup is required.** The cleanup is almost entirely:

1. documentation drift (Cloudflare → GitHub Pages, test counts, status);
2. superseded research and tooling that does not belong in a product repo;
3. one inert artifact file (`dist/_headers`) and two empty QA templates.

The biggest wins are structural decisions, not edits: whether `.knowledge/` and
`.opencode/` should be public parts of this repository.

## 1. What is essential (do not delete)

| Area | Files | Why |
|---|---|---|
| Frozen contract | `docs/spec-hpg-1.md`, `test-vectors.json` | Must never change in place; a change is `HPG-2` |
| Product source | `src/*.js`, `src/index.html`, `src/style.css` | The app |
| Build | `scripts/build.mjs`, `Makefile`, `package.json` | Reproducible artifact |
| Tests | `test/*.test.mjs` (8 suites, 56 tests) | Correctness and policy gates |
| Independent reference | `tools/reference.py` | Cross-implementation check |
| Reviewed artifact | `dist/index.html`, `dist/SHA256SUMS` | "Reviewed bytes are served bytes" |
| Deploy | `.github/workflows/pages.yml` | Verified-bytes deployment |
| Trust docs | `docs/threat-model.md`, `docs/privacy.md`, `docs/faq.md`, `docs/verification.md`, `docs/deployment.md`, `docs/qa-record.md` | User-facing trust surface (all need updates) |
| Legal | `LICENSE`, `SECURITY.md` | Public repo |
| Root | `README.md`, `CHANGELOG.md`, `.gitignore` | Public entry points (need updates) |

## 2. What is no longer up to date

### 2.1 Hosting and status drift (Cloudflare → GitHub Pages)

The site is live on GitHub Pages, but the docs still describe Cloudflare Pages
and a blocked deployment.

| File | Stale content | Correct state |
|---|---|---|
| `README.md:7-12` | "Phase 4 of 5 … deployment … remaining" | Live on GitHub Pages; browser/router QA and launch decision remain |
| `README.md:51` | "49 tests" | **56 tests** |
| `README.md:54` | `make build` regenerates `dist/_headers` | Still true, but `_headers` is inert on Pages |
| `README.md:71` | `https://<project>.pages.dev/` | `https://vextroyer.github.io/GiveMePasswords/` |
| `README.md:88` | "Cloudflare Pages setup" | GitHub Pages deployment |
| `README.md:109` | "committed Cloudflare Pages security headers" | Cloudflare-only fallback, inert on Pages |
| `README.md:124` | "deployment pending external access" | Done (run `42397975872`) |
| `CHANGELOG.md:8-15` | "Pending: Cloudflare Pages deployment" | Deployed; add hosting + Node 22 fix entries |
| `CHANGELOG.md:43` | Cloudflare `_headers` as the hardening story | Meta CSP is the active CSP; `_headers` is inert |
| `SECURITY.md:19` | "once it is published" | The repo and site are public now |
| `docs/deployment.md:3-13,17-30,41-50,96` | Entire Cloudflare procedure, `main` branch, blocked status | Full rewrite for GitHub Pages |
| `docs/verification.md:13,50` | `.pages.dev` URL; grep for CSP/HSTS headers | Live URL; meta CSP; actual header set |
| `docs/privacy.md:19,29` | "Cloudflare" | GitHub Pages / GitHub, Inc. |
| `docs/threat-model.md:25,30` | "Cloudflare Pages" | GitHub Pages |
| `docs/faq.md:159` | `.pages.dev` URL | Live URL |
| `docs/qa-record.md:13` | "49 passing" | **56 passing** |
| `docs/qa-record.md:55-56` | "Deployment blocked" | Live hash/headers verified; browser checks still pending |
| `docs/qa-record.md:71` | "blocked on a Cloudflare account" | Remove; deployment is done |
| `.knowledge/plans/public-monthly-password-generator.md:17,60,201-202,211,218,292` | Cloudflare locked, blocked | Superseded by the GitHub Pages plan |
| `.knowledge/insights/project-overview.md:44,57,69,92-110,121-129,138-141` | Cloudflare, 30 commits, 6 suites, `node --test test/`, deploy blocked | Live state; 31 commits; 8 suites/56 tests; `test/*.test.mjs` |

### 2.2 Test count and environment drift

- `README.md:51` and `docs/qa-record.md:13` say **49**; the suite is **56**
  (3 Pages workflow tests + 3 test-command tests were added).
- `docs/qa-record.md:6` records Node 26.13.0 / Python 3.15.2. CI uses Node
  22.23.4; both now pass 56/56. The record should say so.
- `.knowledge/insights/project-overview.md:46` says "6 Node test-runner suites,
  561 ln total"; there are **8 suites** now.
- `.knowledge/insights/project-overview.md:69` still documents
  `node --test test/`, the command that broke CI.

### 2.3 Security claims that are now wrong or incomplete

These matter because the threat model and verification guide are trust
artifacts.

1. **HSTS is present on the live site.**
   `strict-transport-security: max-age=31556952` is returned on the project
   page and its assets. The plan says HSTS is "Absent"
   (`.knowledge/plans/github-pages-deployment.md:54-55,95`). The value is not
   the `_headers` value (`31536000; includeSubDomains`) and `github.io` is not
   HSTS-preloaded, so first-visit SSL stripping is still possible; but the
   header is real and must be documented.
2. **`frame-ancestors 'none'` in the meta CSP is ignored by browsers.**
   MDN: "This directive is not supported in the `<meta>` element." The live
   site sends no `X-Frame-Options` and no CSP response header, so the page is
   **framable**. The `_headers` `X-Frame-Options: DENY` does not apply on
   GitHub Pages. This is a real residual risk (clickjacking / UI redress), not
   just a header downgrade.
3. **There is no CSP response header.** The only CSP is the
   `<meta http-equiv="Content-Security-Policy">` tag. That is expected, but
   `docs/verification.md:50` still greps for a CSP header.
4. **`access-control-allow-origin: *` is sent.** Any origin can `fetch()` the
   public page. It contains no secrets, but it is a header difference worth
   recording.
5. **Cache policy is `max-age=600`**, not the `_headers` value
   (`public, max-age=300, must-revalidate`). Verification instructions should
   use a cache-buster and warn against `curl --compressed` when hashing.
6. **`_headers` is inert and diverges from reality.** It advertises HSTS
   `31536000; includeSubDomains`, `X-Frame-Options: DENY`, COOP/CORP, nosniff,
   Permissions-Policy, and `max-age=300`. GitHub Pages sends none of those
   (except a different HSTS). Keeping it is fine only if it is clearly labelled
   as a Cloudflare-only fallback.

### 2.4 Irreproducible QA evidence

`docs/qa-record.md:16-17` cites:

```sh
node .playground/smoke-dom.mjs --dist
node .playground/smoke-dom.mjs
```

`.playground/` is gitignored and contains **zero tracked files**
(`.playground/.gitignore:1` ignores everything). A fresh clone cannot reproduce
that evidence. Options:

- commit the shim as `test/smoke-dom.mjs` (self-contained, imports only
  `node:fs`, 9.5 KB) and update the QA record; or
- mark the evidence as "local-only, not reproducible from a clone" and remove
  the claim from the QA record.

### 2.5 Superseded plans and research

- `.knowledge/plans/public-monthly-password-generator.md` still describes the
  repository as "a research workspace, not an application repository" with no
  commits, remote, CI, `package.json`, `Makefile`, or `src/` (lines 28-41).
  That was true before implementation; it is now false. Its Phase 3 checklist
  still names Cloudflare.
- `.knowledge/notes/research-router-password-site/` (6 files, 1,281 lines) and
  `.knowledge/notes/report-router-password-site.md` (293 lines) research a
  **different** concept: delivering a monthly Wi-Fi list to one person. The
  shipped product is the public generator. This is the largest removable block.
- `.knowledge/notes/opencode-framework-guide.md` (406 lines) documents the
  agent framework, not the product. It duplicates `.opencode/` documentation.

## 3. What can be safely eliminated

### 3.1 Safe, local-only (no repository impact)

| Item | Size | Notes |
|---|---|---|
| `.playground/` | **1.1 GB** | Downloaded Node binaries, logs, scratch. Ignored; not in git. Delete when done. |
| `session` | 43 B | Leftover `opencode -s ses_...` file; ignored. |
| `.build/` | empty | Ignored; `make verify-build` cleans it. |

### 3.2 Safe to remove from the repository (git history retains them)

| Item | Size | Why safe |
|---|---|---|
| `.knowledge/notes/research-router-password-site/` + `report-router-password-site.md` | 1,574 lines | Abandoned concept; not referenced by the shipped product |
| `.knowledge/notes/opencode-framework-guide.md` | 406 lines | Framework guide, not product |
| `.knowledge/notes/research-public-password-generator/` + `report-public-password-generator.md` | 2,309 lines | Historical research; useful as an archive, not day-to-day |
| `.knowledge/insights/investigations/github-actions-node-test-directory.md` | 9 KB | Resolved RCA; archive if you want the record |
| `.knowledge/plans/public-monthly-password-generator.md` | 24 KB | Superseded by the GitHub Pages plan; archive after marking done |

Deleting these from the working tree does **not** remove them from public git
history. Do not rewrite history for this; it is unnecessary and risky.

### 3.3 Safe to remove only with a decision

| Item | Cost of keeping | Cost of removing |
|---|---|---|
| `.opencode/` (46 files) | 44% of tracked files; generic framework in a product repo | Removes `/build`, `/plan`, `/research`, sandbox, etc. in this repo. Install the framework globally or keep a minimal `.opencode/opencode.json` first. |
| `dist/_headers` (796 B) | Inert on Pages; publicly downloadable; diverges from actual headers; 4 build tests depend on it | Requires editing `scripts/build.mjs`, `test/build.test.mjs`, and docs; drops the Cloudflare fallback. `dist/index.html` hash is unaffected. |
| `docs/usability-record.md` + `docs/router-compatibility.md` | Empty templates; referenced by README/FAQ/plan | Lose the ready-to-fill QA scripts if the cousin/router runs are still planned |
| `docs/ux-checklist.md` | Phase 2 artifact; partly stale | Lose the UX failure-mode map; could move to `.knowledge/` |
| `.knowledge/` as a whole | Public research/plans; 18% of files | Untrack and move to a private notes repo; update links; history stays public |

## 4. Recommended cleanup sequence

Do this in phases so each commit has one purpose and the deploy path stays
predictable. Documentation commits do **not** trigger the Pages workflow
(`docs/**`, `README.md`, `CHANGELOG.md`, `.knowledge/**` are excluded), so
Phase A is safe to push without redeploying.

### Phase A — Make the documentation true (agent, docs-only)

1. Rewrite `docs/deployment.md` for GitHub Pages: Pages source = GitHub
   Actions, workflow name, trigger paths, live URL, trailing-slash 301,
   rollback, limits, and the fact that `_headers` is inert.
2. Rewrite `docs/verification.md`: live URL, cache-buster, `--compressed`
   warning, meta-CSP hash check, actual headers, `frame-ancestors` limitation.
3. Update `README.md`: 56 tests, live URL, status, roadmap, `_headers` label,
   docs table.
4. Update `CHANGELOG.md`: deployment entry, Node 22 test-command fix, header
   delta; consider `0.1.1` if you want a release marker.
5. Update `docs/privacy.md`, `docs/threat-model.md`, `docs/faq.md`,
   `docs/qa-record.md`, `SECURITY.md`.
6. Update `.knowledge/plans/github-pages-deployment.md` (mark Phases 3-4 done,
   correct HSTS), `.knowledge/plans/public-monthly-password-generator.md`
   (mark superseded), `.knowledge/insights/project-overview.md` (live state).
7. Run the link checker; `make check`; commit `docs: align with GitHub Pages`.

### Phase B — Prune knowledge and tooling (decision-dependent)

8. Decide `.knowledge/` visibility and `.opencode/` fate (Section 6).
9. Remove/archive the superseded research and resolved RCA.
10. If untracking `.knowledge/`, `git rm -r --cached .knowledge`, add it to
    `.gitignore`, and update links in README/FAQ.
11. Commit `chore: prune superseded research and tooling`.

### Phase C — Simplify the artifact (only if dropping `_headers`)

12. Remove `headersFor()`, the `_headers` write, and the three `_headers`
    assertions in `test/build.test.mjs`; update docs.
13. `make build`; confirm `dist/index.html` still hashes to
    `1acaba57…f84786`; `dist/_headers` disappears; `SHA256SUMS` is unchanged.
14. Commit; push (this **does** trigger a deploy because `scripts/**` and
    `dist/**` changed); verify the live page hash and that `/_headers` now
    404s.

### Phase D — Local cleanup

15. Delete `.playground/` (1.1 GB), `session`, `.build/`.

### Phase E — Optional polish for future work

16. Add `.nvmrc` with `22` (align local, CI, and `engines`).
17. Add `license`, `repository`, and `homepage` to `package.json`.
18. **Split CI from deploy.** Today `test/**` is excluded from the Pages
    workflow, so a test-only push runs no tests. Add a separate `ci.yml` on
    `push`/`pull_request` with a Node matrix (`20`, `22`, `24`, `26`) running
    `make check`; keep `pages.yml` artifact-only. This would have caught the
    Node 22 failure before the first deploy.
19. Add `CONTRIBUTING.md` / issue template if public contributions are expected.
20. Add a custom `404.html` if the default GitHub 404 is unacceptable.

## 5. What not to touch

- `docs/spec-hpg-1.md`, `test-vectors.json`, and the derivation in
  `src/derive.js`: frozen `HPG-1` contract.
- `dist/index.html`: reviewed artifact; any change needs a rebuild, a new hash,
  and a redeploy.
- The verified-bytes deployment model: build, verify, upload the committed
  `dist/`.
- Do not rewrite git history to remove `.knowledge/`; just untrack it in the
  current tree if desired.

## 6. Decisions needed

1. **Is this a public product repo or a personal workspace?**
   This determines whether `.knowledge/` and `.opencode/` stay.
2. **Should `.knowledge/` remain public?**
   Keep, prune to 2-3 files, or untrack and move to a private notes repo.
3. **Should `.opencode/` stay vendored?**
   Keep (workflow convenience), remove (clean product repo), or install
   globally and keep only `opencode.json`.
4. **Drop the Cloudflare fallback and `dist/_headers`?**
   Yes = simpler build, no inert file, no misleading header policy. No = keep
   portability, but label it clearly.
5. **Keep the two empty QA templates?**
   Are the cousin usability runs and the real-router record still planned?
6. **Keep `docs/ux-checklist.md` as a public artifact, or move it to
   `.knowledge/`?**
7. **Cut a `0.1.1` release after the GitHub Pages change, or keep everything
   under `Unreleased`?**
8. **What improvements are planned next?**
   So the cleanup does not remove scaffolding they need (e.g., the QA
   templates, `.knowledge/` research).

## 7. Verification gates after each phase

| Gate | Command / check | Expected |
|---|---|---|
| Tests | `make test` | 56/56 |
| Cross-check | `make cross-check` | vectors reproduced |
| Full gate | `make check` | both green |
| Artifact | `make verify-build` | no diff |
| Live hash | `curl -s https://vextroyer.github.io/GiveMePasswords/ \| sha256sum` | `1acaba57…f84786` |
| Live CSP | meta tag hashes vs inline script/style | match |
| Live headers | `curl -sI` | `server: GitHub.com`, HSTS `31556952`, `cache-control: max-age=600`, `access-control-allow-origin: *`; no CSP/XFO/COOP/CORP/nosniff/Permissions-Policy |
| Docs-only push | GitHub Actions | no `pages` run (path filter) |
| Artifact push | GitHub Actions | `build` + `deploy` green |

## 8. Current live evidence (for the doc rewrite)

- URL: `https://vextroyer.github.io/GiveMePasswords/` (no-slash 301s here;
  HTTP 301s to HTTPS).
- Run: `https://github.com/Vextroyer/GiveMePasswords/actions/runs/42397975872`
  (`build` 17:46:48-17:46:58, `deploy` 17:47:02-17:47:13).
- Served hash: `1acaba57ed1c3f7fbfd9f1934e4e67dee560e327f1421650db7c65e808f84786`;
  byte-identical to `dist/index.html` (52,951 bytes).
- Meta CSP script hash: `sha256-jnMqSd3U3bcQ2i/XX+g/1e9LRi6ZaFMSYL3Vtvt1NiE=`;
  style hash: `sha256-2NRCTTgpTcbKL5PAo/8xnstlhENyWSIhB1yXBembMBc=`. Both match
  the deployed inline blocks (checked with `.playground/check_csp.py`).
- No external references, no inline event handlers, no `javascript:` URLs.
- `_headers` and `SHA256SUMS` are served as `application/octet-stream`; both
  byte-match the committed files. `_headers` is inert.
- HSTS is **not** universal on `github.io`: `necolas.github.io`,
  `squidfunk.github.io`, `google.github.io`, and others send none;
  `microsoft.github.io` sends the same `max-age=31556952` as this site.
  `github.io` is not HSTS-preloaded. Do not overgeneralize in the docs.
