---
id: github-pages-deployment
created: 2026-11-06
modified: 2026-11-06
type: plan
status: active
expires: 2026-11-20
phases:
  - name: Preflight and decisions
    done: true
    goal: Confirm the artifact is GitHub Pages compatible, choose the deployment mechanism, and lock the trigger and header policy.
  - name: Add the Pages workflow
    done: true
    goal: Commit a workflow that verifies the reviewed artifact and publishes the committed dist/ through the Pages artifact API.
  - name: Enable Pages and run the first deploy
    done: false
    goal: Turn on GitHub Actions as the Pages source, run the workflow, and get a live URL.
  - name: Verify the live site
    done: false
    goal: Prove the served bytes match the reviewed hash, the meta CSP is intact, and no requests leave the page.
  - name: Align docs and the product plan
    done: false
    goal: Replace Cloudflare Pages as the documented target, record the header tradeoff, and update status/QA records.
  - name: QA sign-off and launch
    done: false
    goal: Complete the real-browser checks and make the public launch decision on evidence.
---

# Plan: Publish to GitHub Pages

## Problem

The repository is now public at `https://github.com/Vextroyer/GiveMePasswords`
(public, MIT, default branch `master`). The app is finished and the deployable
artifact is committed, but there is no live site. The existing deployment plan
targets Cloudflare Pages and is blocked on an account that does not exist.

Goal: publish the reviewed artifact at the **default GitHub Pages URL**

```
https://vextroyer.github.io/GiveMePasswords/
```

without introducing a second build path, a second branch of generated files, or
a deploy on every push. No custom domain.

## What the research established

| Fact | Evidence |
|---|---|
| The artifact is self-contained and subpath-safe | `dist/index.html` is 52 KB; the only `href` values are a `data:` favicon and `#main`; no `<base>`; no absolute paths |
| CSP survives on GitHub Pages | The build emits `<meta http-equiv="Content-Security-Policy">` with the same script/style hashes as `_headers`; `test/build.test.mjs` already asserts it |
| Pages cannot serve `dist/` from a branch | Branch sources only offer `/` (root) or `/docs`; the app is in `dist/` and `docs/` is Markdown |
| GitHub Pages sends no security headers | Measured on a real `*.github.io` project site: only `server` and `cache-control: max-age=600` |
| `github.io` is not HSTS-preloaded | `hstspreload.org/api/v2/status?domain=github.io` → not preloaded; no HSTS header observed |
| The repo is public, so Pages is free | `GET /repos/Vextroyer/GiveMePasswords` → `private: false`, `has_pages: false` |
| No build, source, test, or `dist/` change is needed | The artifact hash can stay `1acaba57…f84786`; all work is CI + docs + settings |

## Key decisions

| # | Decision | Choice | Why |
|---|---|---|---|
| D1 | Deployment mechanism | GitHub Actions → Pages artifact | Only mechanism that can publish `dist/` without moving files or adding a generated branch |
| D2 | Published bytes | The committed `dist/`, after `make check` + `make verify-build` | Preserves the existing "reviewed bytes are served bytes" trust model |
| D3 | Build in CI? | Verify, do not rebuild-and-publish | A rebuild would publish bytes that only match the repo if the build is deterministic; verifying first is the stronger claim |
| D4 | Trigger policy | Push to `master` filtered by artifact-relevant paths, plus `workflow_dispatch` | Docs, chores, and `.knowledge/` pushes do not deploy |
| D5 | Branch | `master` | Actual default branch; Cloudflare-era docs assumed `main` |
| D6 | Domain | Default project URL, no `CNAME` | User preference; zero DNS work |
| D7 | Header policy | Accept the loss of HSTS, XFO, COOP/CORP, nosniff, and Permissions-Policy; keep CSP via meta | GitHub Pages cannot set custom headers; the app is stateless and has no cross-origin resources |
| D8 | `_headers` | Keep generating and publishing it | No build change; it is inert on Pages and keeps the Cloudflare option open |
| D9 | Trigger paths | `dist/**`, `src/**`, `scripts/**`, `tools/**`, `test-vectors.json`, `package.json`, the workflow file | Any change that can affect the artifact; a forgotten `make build` fails verification instead of silently deploying |
| D10 | Deploy gating | No tags, no releases; path-filtered pushes + manual dispatch | Simpler than a release ceremony; a tag-based gate remains a future option |

### Trigger paths, in plain terms

| Push touches | Workflow runs? | Deploys? |
|---|---|---|
| `README.md`, `docs/**`, `CHANGELOG.md`, `.knowledge/**`, `.gitignore` | No | No |
| `dist/**` (rebuilt artifact) | Yes | Yes |
| `src/**` or `scripts/**` without a rebuilt `dist/` | Yes | No — `make verify-build` fails, surfacing the mistake |
| `src/**` plus rebuilt `dist/` | Yes | Yes |
| `package.json` (version bump) | Yes | Yes |
| `test-vectors.json`, `tools/**` | Yes | Yes (cross-check gate) |
| Manual "Run workflow" | Yes | Yes |

Excluded on purpose: `test/**`. A test-only change does not affect the page; if a
separate all-push CI is wanted later, add `ci.yml` (out of scope).

## Security delta (accepted, must be documented)

| Directive | `_headers` on Cloudflare | GitHub Pages |
|---|---|---|
| `Content-Security-Policy` | Header | **Survives via `<meta>`** (identical hashes) |
| `frame-ancestors 'none'` | Enforced | **Ignored in meta**; no `X-Frame-Options` either → clickjacking possible |
| `Strict-Transport-Security` | Enforced | **Absent**; `github.io` is not preloaded; GitHub 301s HTTP→HTTPS |
| `Referrer-Policy` | Header | Absent as a header; `<meta name="referrer" content="no-referrer">` still applies |
| `X-Content-Type-Options` | Enforced | Absent; GitHub sends correct MIME types |
| `Cross-Origin-Opener-Policy` / `-Resource-Policy` | Enforced | Absent; no cross-origin resources or popups |
| `Permissions-Policy` | Enforced | Absent; the app requests no permissions |
| `Cache-Control` | `max-age=300, must-revalidate` | Forced `max-age=600`; redeploys may appear stale for up to 10 minutes |

Residual risk is low for a stateless generator with no account, no storage, and
no cross-origin assets. The clickjacking and first-visit-downgrade risks are
real and go into `docs/threat-model.md`; they are not silently dropped.

## Phase 1 — Preflight and decisions (done)

- [x] Confirmed the artifact works from a subpath.
- [x] Confirmed the meta CSP carries the same hashes as `_headers`.
- [x] Confirmed Pages branch sources cannot serve `dist/`.
- [x] Measured GitHub Pages response headers and HSTS preload status.
- [x] Chose Actions artifact deployment, path-filtered triggers, and the default URL.
- [x] Confirmed no `src/`, `scripts/`, `test/`, or `dist/` changes are required.

## Phase 2 — Add the Pages workflow · `[AGENT]`

Create `.github/workflows/pages.yml` exactly as below.

- [x] Add the workflow file.
- [x] Sanity-check YAML (a parser if available, otherwise manual review).
- [x] Confirm `make check` and `make verify-build` still pass locally.
- [x] Commit: `ci: deploy the reviewed artifact to GitHub Pages`.
- [x] Do **not** push yet if Pages has not been enabled (Phase 3, step H1).
      Pushing after H1 lets the workflow-file change trigger the first run
      automatically. If it was pushed early, re-run from the Actions UI.

```yaml
name: pages

on:
  push:
    branches: [master]
    paths:
      - "dist/**"
      - "src/**"
      - "scripts/**"
      - "tools/**"
      - "test-vectors.json"
      - "package.json"
      - ".github/workflows/pages.yml"
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: false

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
      - name: Verify the reviewed artifact
        run: |
          make check
          make verify-build
      - uses: actions/configure-pages@v5
      - uses: actions/upload-pages-artifact@v3
        with:
          path: dist

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

Notes for the implementer:

- Action majors were current at planning time; check the Pages starter workflow
  if a major has moved.
- Keep `path: dist`. Do not add a build step that overwrites `dist/`.
- `concurrency.cancel-in-progress: false` queues deployments instead of killing
  one mid-flight.
- `configure-pages` will fail with a clear message if Pages is not enabled; that
  is the intended ordering guard.

### Phase 2 outcome (2026-11-06)

- Added `.github/workflows/pages.yml` exactly as specified; Ruby's YAML parser
  accepts it (`jobs` = `build`, `deploy`).
- Added `test/pages-workflow.test.mjs` (3 tests) as a contract test, so the
  trigger paths, permissions, verify-then-publish step, artifact path, and
  environment name are enforced by `make test`. This is the only change outside
  CI/docs; the "no test changes" finding meant the existing suites needed none.
- `make test` → **53 passing, 0 failing**.
- `make check` → green (Python cross-check reproduced all vectors).
- `make verify-build` → no diff; hash `1acaba57…f84786` (artifact untouched).
- Commits: `176b89b test: require a path-filtered GitHub Pages workflow`,
  `3978c5b ci: deploy the reviewed artifact to GitHub Pages`.
- **Not pushed.** Waiting on Phase 3 H2: Pages source must be set to
  "GitHub Actions" before the first run can succeed.

## Phase 3 — Enable Pages and first deploy · `[HUMAN]` + `[AGENT]`

### Human steps (required; the agent has no `gh` and no UI access)

- [ ] **H1. Decide the site may be public.** Enabling Pages serves the app to
      anyone and search engines may index it. The repo is already public; this
      publishes the product. Confirm this is intended.
- [ ] **H2. Enable Pages.** Open
      `https://github.com/Vextroyer/GiveMePasswords/settings/pages` →
      **Build and deployment → Source → GitHub Actions**. Do not choose
      "Deploy from a branch".
- [ ] **H3. If the first run fails with 403**, open
      **Settings → Actions → General → Workflow permissions** and allow the
      permissions the workflow requests (`pages: write`, `id-token: write`).
- [ ] **H4. Tell the agent Pages is enabled** so the push/re-run can proceed.

### Agent steps

- [ ] Push the Phase 2 commit (or ask the human to push).
- [ ] Watch the `pages` workflow: `build` must be green before `deploy`.
- [ ] If the run was triggered before H2, re-run it from the Actions UI or via
      `workflow_dispatch`.
- [ ] Capture the deployment URL from the `github-pages` environment.

## Phase 4 — Verify the live site · `[AGENT]` (automated) + `[HUMAN]` (browser)

### Automated checks (agent, via curl)

Run these and record the output in `docs/qa-record.md`:

```sh
# Canonical URL redirects to the trailing-slash form
curl -sI https://vextroyer.github.io/GiveMePasswords | sed -n '1,10p'

# Served bytes must equal the reviewed artifact
curl -s https://vextroyer.github.io/GiveMePasswords/ | sha256sum
cat dist/SHA256SUMS
# expected: 1acaba57ed1c3f7fbfd9f1934e4e67dee560e327f1421650db7c65e808f84786

# The meta CSP must be present with both hashes
curl -s https://vextroyer.github.io/GiveMePasswords/ \
  | grep -o '<meta[^>]*Content-Security-Policy[^>]*>'

# Record exactly which headers the host sends (and does not send)
curl -sI https://vextroyer.github.io/GiveMePasswords/ | sed -n '1,25p'
```

- [ ] HTTP 200 over HTTPS.
- [ ] Hash matches `dist/SHA256SUMS`.
- [ ] Meta CSP present; `default-src 'none'`; one script and one style hash.
- [ ] Response headers match the expectations in the security delta
      (`server: GitHub.com`, `cache-control: max-age=600`, no CSP/HSTS/XFO).
- [ ] No unexpected files are reachable (only `index.html`, `_headers`,
      `SHA256SUMS`).

### Browser checks (human; the sandbox has no browser)

- [ ] Console: no CSP violations, no mixed content.
- [ ] Network: only the document request; the favicon makes no request.
- [ ] Create → ceremony → list → restore in a fresh private window.
- [ ] Copy, download, share, print; leading zeros and day count intact.
- [ ] Mobile: iOS Safari and Android Chrome.
- [ ] Keyboard-only, 200% zoom, 320 px viewport.
- [ ] Hand the results to the agent for the QA record.

## Phase 5 — Align docs and the product plan · `[AGENT]`

The artifact does not change, so this is documentation only. It does not trigger
a deploy.

- [ ] `docs/deployment.md` — rewrite for GitHub Pages: source setting, workflow,
      trigger paths, URL, first deploy, rollback, limits, the inert `_headers`,
      and the removed Cloudflare account blocker.
- [ ] `docs/verification.md` — new URL; trailing-slash note; replace the header
      grep with a meta-CSP check; state that GitHub Pages sends no security
      headers; warn against `--compressed` when hashing.
- [ ] `docs/privacy.md` — host is GitHub Pages (GitHub, Inc.); link GitHub's
      privacy statement; keep the "the app sends nothing" distinction.
- [ ] `docs/threat-model.md` — replace Cloudflare references; add the accepted
      residual risks (no HSTS, no frame denial, no COOP/CORP/Permissions-Policy).
- [ ] `docs/faq.md` — update the verification URL.
- [ ] `docs/qa-record.md` — record the workflow, live hash, headers, and browser
      results; update blockers and open risks.
- [ ] `README.md` — live URL, status, verification snippet, docs table, and a
      note that `dist/_headers` is Cloudflare-only and inert on Pages.
- [ ] `CHANGELOG.md` — note the hosting change and the header difference.
- [ ] `.knowledge/plans/public-monthly-password-generator.md` — update the locked
      hosting decision, Phase 3 deliverable/done-when, Phase 3 outcome, and
      blockers. Add a decision-log entry for the switch and its rationale.
- [ ] `.knowledge/insights/project-overview.md` — deployment path, live URL,
      verified hash, and the new human-only steps.
- [ ] Commit: `docs: record GitHub Pages as the deployment target`.

Do not rewrite history: the Cloudflare references in old changelog entries and
research notes are historical and stay.

## Phase 6 — QA sign-off and launch · `[HUMAN]`

- [ ] Complete the remaining `docs/qa-record.md` manual checks against the live
      URL.
- [ ] Decide whether the site is launched publicly (it is already reachable once
      Pages is on) or kept unlisted.
- [ ] Record the decision in the product plan (Phase 5).

## Files

| File | Action | Owner |
|---|---|---|
| `.github/workflows/pages.yml` | create | agent |
| `docs/deployment.md` | rewrite | agent |
| `docs/verification.md` | edit | agent |
| `docs/privacy.md` | edit | agent |
| `docs/threat-model.md` | edit | agent |
| `docs/faq.md` | edit | agent |
| `docs/qa-record.md` | edit | agent (human supplies browser results) |
| `README.md` | edit | agent |
| `CHANGELOG.md` | edit | agent |
| `.knowledge/plans/public-monthly-password-generator.md` | edit | agent |
| `.knowledge/insights/project-overview.md` | edit | agent |
| GitHub Pages settings | change | **human** |
| Real-browser/device QA | execute | **human** |
| Launch decision | decide | **human** |
| `src/`, `scripts/`, `test/`, `dist/` | no change | — |

## Risks and mitigations

| Risk | Likelihood | Mitigation |
|---|---|---|
| First run fails because Pages is still set to "Deploy from a branch" | Medium | H2 before the push; H3 for 403s |
| Docs-only push accidentally deploys | Low | `paths` filter; verify with a docs-only commit after setup |
| Code change ships without a rebuilt `dist/` | Medium | `make verify-build` fails the workflow; no deploy |
| Header downgrade weakens the threat model | Certain | Documented in the plan and threat model; CSP remains; revisit if a header-capable host becomes required |
| Clickjacking exposure | Low | No state-changing actions; accepted; no reliable meta equivalent |
| Stale bytes after a redeploy | Medium | GitHub caches for 600 s; wait or verify with a cache-busting query in DevTools |
| Path filter misses a future build input | Low | Keep the list next to the build inputs; update if `build.mjs` starts reading new paths |
| Search engines index the site | Likely | Intended for a public utility; a `noindex`/`robots.txt` policy would require build changes and a new hash (out of scope) |
| Workflow action majors drift | Low | Pin majors; check the official Pages template when updating |

## Rollback

- **Artifact rollback:** revert the commit that changed `dist/`, push, and let
  the path-filtered workflow redeploy. Allow up to 10 minutes for caches.
- **Redeploy a known-good run:** open the earlier successful `pages` run in
  Actions and re-run its deployment.
- **Disable the site:** Settings → Pages → (unpublish/disable). This removes
  public access without touching the repo.

## Success criteria

- `https://vextroyer.github.io/GiveMePasswords/` returns 200 over HTTPS.
- The served `index.html` hash equals `dist/SHA256SUMS`
  (`1acaba57…f84786`).
- The served page contains the meta CSP with the committed script/style hashes.
- A docs-only push does not trigger a deployment.
- A code push without a rebuilt `dist/` fails verification and does not deploy.
- `make check` and `make verify-build` are green in CI.
- No tracked doc still presents Cloudflare Pages as the current target (historical
  entries excepted).
- The browser/device checks are recorded, with the header tradeoff explicit.

## Out of scope

- Custom domain, `CNAME`, DNS, or TLS setup.
- Deploying on every push or on tags/releases.
- A separate `ci.yml` for all pushes and pull requests.
- Removing Cloudflare support from the build or deleting `dist/_headers`.
- `robots.txt`/`noindex` (would change the artifact and its hash).
- Access-controlled or private Pages (not available for this repo tier).
