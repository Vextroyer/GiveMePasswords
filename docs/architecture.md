# Architecture

This page is for maintainers. It describes how the product is built, tested,
and deployed, and why the design is shaped the way it is. User-facing
documentation is in [`README.md`](../README.md), [`faq.md`](faq.md), and the
other trust docs.

## Purpose and non-goals

The app turns a 16-byte seed into a month of 8-digit daily passwords. It is
stateless and client-side: no server compute, no accounts, no storage, and no
network request after the page loads. The same seed and month always reproduce
the same list.

It is not a password manager, not encrypted storage, and not a security upgrade
for Wi-Fi. An 8-digit password is about 26.6 bits; the product is a rotation and
convenience tool. See [`threat-model.md`](threat-model.md).

## Layout

| Path | Role |
|---|---|
| `src/index.html` | Two-door UI and recovery ceremony |
| `src/app.js` | DOM wiring: copy, download, share, print |
| `src/session.js` | Month validation and list assembly (DOM-free) |
| `src/derive.js` | HPG-1 derivation via WebCrypto HKDF-SHA-256 |
| `src/recovery-code.js` | Crockford Base32 encode/decode, checksum, fingerprint |
| `src/strings.js` | Runtime copy (translation seam) |
| `src/style.css` | Mobile-first light/dark/print styles |
| `scripts/build.mjs` | Single-file bundler, CSP hashes, policy checks, `SHA256SUMS` |
| `dist/index.html` | Committed, self-contained artifact |
| `dist/SHA256SUMS` | Committed artifact hash |
| `test/` | Node test-runner suites |
| `test-vectors.json` | Frozen public vectors |
| `tools/reference.py` | Independent Python standard-library implementation |
| `docs/` | Specification, trust, QA, and operational docs |
| `.opencode/` | Agent framework (agents, commands, skills) |
| `.knowledge/` | Agent workspace (plans and scratch; not product) |
| `.playground/` | Local developer scratch (gitignored) |

## Data flow

`app.js` → `session.js` → (`derive.js`, `recovery-code.js`). The build bundles
the modules in a fixed order (`strings → derive → recovery-code → session →
app`), inlines the CSS, computes the CSP hashes and the SHA-256, and writes
`dist/index.html` plus `dist/SHA256SUMS`.

The seed never leaves the tab. There is no `fetch`, `XMLHttpRequest`,
`WebSocket`, `sendBeacon`, storage API, or external URL in the artifact; the
build policy check fails if one appears.

## Build and test

Requirements: Node.js 20+ and Python 3.10+ for the cross-check. No runtime
dependencies.

| Task | Command |
|---|---|
| Test | `make test` (`node --test test/*.test.mjs`) |
| Cross-check | `make cross-check` (`python3 tools/reference.py`) |
| Full gate | `make check` |
| Build | `make build` (`node scripts/build.mjs`) |
| Prove `dist/` is current | `make verify-build` |

The build is deterministic: no timestamps or environment-dependent values. Two
runs produce identical bytes. `make verify-build` rebuilds into `.build/verify`
and diffs it against `dist/`.

### Node version gotchas

Node 22–25 do not expand a bare directory argument to `node --test`. The
supported command is `node --test test/*.test.mjs`; the shell expands the glob
before Node sees it. Node 20 and 26 happen to accept the directory form, so a
local Node 26 run does not prove that CI's Node 22 run will work. CI pins Node
22, and the CI matrix covers Node 20, 22, 24, and 26. Keep `Makefile` in the
Pages trigger paths so a build-tool change is validated.

## Deployment

The site is published from the committed `dist/` by
`.github/workflows/pages.yml` using the GitHub Pages artifact API. The workflow
verifies the artifact (`make check`, `make verify-build`) before upload, so the
reviewed bytes are the served bytes. See [`deployment.md`](deployment.md) for
the trigger paths, rollback, limits, and header behavior.

## Design rationale

- **One deterministic engine, two doors.** "Create a new list" generates a
  random 16-byte seed and shows it as a recovery code; "I have a recovery code"
  accepts a saved seed. Both feed the same `(seed, month) → list` function. A
  non-reproducible random list would not match the passwords already set on the
  router, so random mode must be recoverable.
- **The recovery code is the root secret.** It is shown before the list is
  revealed, behind a blocking "I saved it" ceremony. The code is never in the
  URL, the exported list, or the printout.
- **Client-side only.** No server secret, account, database, or storage means
  there is nothing server-side to breach. The security boundary is the integrity
  of the served artifact and the user's device.
- **UX failure modes are first-class.** The 15 failure modes and their coverage
  are in [`ux-checklist.md`](ux-checklist.md); the recovery ceremony is a
  security control, not a nuisance.
- **8 digits is a convenience format.** The router constrains the format; the
  product states the ~26.6-bit limit and does not claim to make Wi-Fi secure.
- **HPG-1 derivation:** HKDF-SHA-256 with salt `HPG-1|seed`, info
  `HPG-1|YYYY-MM|DD|attempt`, rejection sampling at `4_200_000_000`, and a
  zero-padded 8-digit output. The full contract is in
  [`spec-hpg-1.md`](spec-hpg-1.md).
- **GitHub Pages for deployment.** It publishes the committed `dist/` through
  Actions without a second build path or a generated branch. It does not support
  custom response headers, so the CSP is a `<meta>` tag and the page is
  framable. The platform's terms discourage sensitive transactions; the app is
  stateless and public, but this is a residual platform risk, not a security
  upgrade.

## Frozen contract

`docs/spec-hpg-1.md` and `test-vectors.json` must not be edited. Any algorithm
change is a new version (`HPG-2`) with new vectors. Security fixes require a
regenerated `dist/SHA256SUMS`, a `CHANGELOG.md` entry, and green `make test` and
`make verify-build`.
