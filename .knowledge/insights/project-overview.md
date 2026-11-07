---
id: project-overview
created: 2026-11-05
modified: 2026-11-06
type: investigation
status: active
tags: [onboarding, architecture, status]
sources:
  - README.md
  - Makefile
  - package.json
  - docs/qa-record.md
  - docs/deployment.md
  - .knowledge/plans/public-monthly-password-generator.md
---

# Project Onboarding: hany_passwords

## Purpose

A public, stateless, client-side tool that turns a 16-byte seed into a month of
8-digit daily Wi-Fi passwords. No server, no storage, no network calls. The same
seed + month always reproduces the same list. Built for a family use case (the
"cousin") and optionally as a small public utility.

Explicitly **not** a password manager, and each 8-digit password is only ~26.6
bits of entropy — a convenience format, not a high-security secret.

## Architecture & Layout

```text
hany_passwords/
├── src/                  # browser app (vanilla ES modules, no framework)
│   ├── index.html        # two-door UI + recovery ceremony dialog (224 ln)
│   ├── app.js            # DOM wiring: copy/download/share/print (506 ln)
│   ├── session.js        # month validation + list assembly (DOM-free, 124 ln)
│   ├── derive.js         # HPG-1 derivation via WebCrypto HKDF-SHA-256 (87 ln)
│   ├── recovery-code.js  # Crockford Base32 encode/decode, checksum, fingerprint (291 ln)
│   ├── strings.js        # runtime copy (translation seam, 66 ln)
│   └── style.css         # mobile-first light/dark/print (654 ln)
├── scripts/build.mjs     # bundler: inlines JS/CSS, CSP hashes, policy checks, SHA256SUMS (310 ln)
├── dist/                 # committed deployable artifact
│   ├── index.html        # self-contained, hash-pinned
│   ├── _headers          # Cloudflare Pages security headers
│   └── SHA256SUMS
├── test/                 # 6 Node test-runner suites, 561 ln total
├── tools/reference.py    # independent Python stdlib implementation (not shipped, 237 ln)
├── test-vectors.json     # frozen public vectors
├── docs/                 # spec, threat model, privacy, FAQ, verification, deployment, QA
├── .knowledge/           # research notes + active plan (not shipped)
├── .opencode/            # agent/tooling config (not shipped)
└── .playground/          # gitignored scratch
```

**Key technologies:** Vanilla JS ESM + HTML/CSS; Node >=20 (built-in `node:test`,
`node:crypto`); Python >=3.10 stdlib (reference); WebCrypto HKDF-SHA-256;
Cloudflare Pages static hosting. **Zero runtime dependencies.**

**Data flow:** `app.js` → `session.js` → (`derive.js`, `recovery-code.js`);
`build.mjs` bundles modules in fixed order `strings → derive → recovery-code →
session → app`, inlines CSS, computes CSP hashes and SHA-256.

## Workflow & Standards

| Task | Command |
|---|---|
| Install | none (no dependencies) |
| Run locally | `python3 -m http.server 8080 --directory src` → http://localhost:8080/ |
| Test | `make test` (`node --test test/`) |
| Cross-check reference | `make cross-check` (`python3 tools/reference.py`) |
| Full check | `make check` |
| Build | `make build` (`node scripts/build.mjs`) |
| Prove dist is current | `make verify-build` |

- **No CI, no linter/formatter config, no CONTRIBUTING.md, no git hooks.** Correctness
  is enforced by tests and by `scripts/build.mjs` policy checks (forbids external URLs,
  `eval`, `innerHTML`, dynamic imports, storage/network APIs).
- **Conventions:** conventional commits `type: lowercase description`; 2-space,
  double quotes, semicolons, JSDoc; kebab-case filenames; tests `*.test.mjs`.
  Agent constitution: `.opencode/AGENT.md`.
- **Frozen contract:** `docs/spec-hpg-1.md` and `test-vectors.json` must not be
  edited. Any algorithm change is a new version (`HPG-2`) with new vectors.
- **Security fixes** require regenerated `dist/SHA256SUMS`, a `CHANGELOG.md` entry,
  and green `make test` + `make verify-build`.

## Current State

- **Remote:** `origin` → https://github.com/Vextroyer/GiveMePasswords (public, MIT,
  default branch `master`). `master` tracks `origin/master` and is in sync.
  `has_pages: true`; Pages source is **GitHub Actions**; workflow
  `.github/workflows/pages.yml` is committed and pushed.
- **Branch:** `master`, clean except `.knowledge/insights/`. 30 commits, single author.
- **Phase:** 4 of 5 product-wise. The GitHub Pages migration is at Phase 2 of
  `.knowledge/plans/github-pages-deployment.md`; the first deploy is blocked on a
  green CI run after the Node 22 fix.
- **Active plans:**
  - `.knowledge/plans/public-monthly-password-generator.md` (expires 2026-11-11).
  - `.knowledge/plans/github-pages-deployment.md` (Phases 1–2 done; 3–6 open).
- **Verified 2026-11-07:**
  - `make test` → **56 passing, 0 failing** (local Node 26.13.0).
  - `make cross-check` → vectors reproduced (5 password, 2 full months, 4 codes).
  - `make verify-build` → no diff; hash `1acaba57…f84786`; build id `8e732a49ddd4ddb7`.
  - Node 22.23.4 reproduces `dist/` byte-for-byte and runs 56/56 tests, so the
    fixed CI sequence is green.
- **Current blocker:** the first `pages` run (`3a53ae7`) failed at `make test` on
  Node 22.23.4 because `node --test test/` treats the directory as a module. The
  fix is committed locally in `7450404` (`node --test test/*.test.mjs` in
  `Makefile` and `package.json`, plus `Makefile` in the workflow trigger paths).
  It is **not pushed yet**; push to trigger a new run.
  See `.knowledge/insights/investigations/github-actions-node-test-directory.md`.
- **Remaining (external/manual):**
  - Real-browser & device QA (Chrome, Firefox, Safari iOS, Android).
  - Cousin usability runs and the real-router compatibility record.
  - Public launch decision.

### Stale docs to be aware of

- `docs/qa-record.md` and `README.md` say **49 tests**; the suite now has **56**
  (three Pages workflow contract tests and three test-command contract tests
  were added).
- `docs/deployment.md` still targets Cloudflare Pages and says the git remote is
  blocked. The repo is public and the target is GitHub Pages; the doc is pending
  the Phase 5 rewrite.
- `.knowledge/plans/public-monthly-password-generator.md` still locks Cloudflare
  Pages as the host. The GitHub Pages plan supersedes that decision.
- `docs/qa-record.md` build environment says Node 26.13.0 / Python 3.15.2 —
  newer than `package.json`'s `node >=20`, so it is a valid but unusual baseline.
- `.knowledge/` (research notes, plans) and the full `dist/` artifact are tracked
  and therefore already public on GitHub.

## First Steps

1. Read `docs/spec-hpg-1.md`, then `src/derive.js` and `src/recovery-code.js`.
2. Run `make check` and `make verify-build` to confirm the green baseline.
3. Read `docs/qa-record.md` — the pending manual checks are the real backlog.
4. Skim `.knowledge/plans/public-monthly-password-generator.md` (Phases 3–5)
   before proposing any change.
5. The git-remote half of the deployment blocker is gone: Cloudflare Pages can
   now be connected to `Vextroyer/GiveMePasswords` (build `node scripts/build.mjs`,
   output `dist`, production branch **`master`**, Node 22). A Cloudflare account
   is still required.
