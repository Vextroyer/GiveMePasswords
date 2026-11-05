# Changelog

All notable changes to this project are recorded here. The algorithm version
(`HPG-1`) is separate from the product version and never changes in place.

## [Unreleased]

Deployment and real-world verification. No code changes are expected unless a
gate fails.

- Pending: Cloudflare Pages deployment and post-deploy header/hash checks.
- Pending: browser and device QA matrix, print test, screen-reader pass, 200%
  zoom, keyboard-only pass, Lighthouse.
- Pending: cousin usability runs and the router compatibility record.
- Pending: public/private launch decision.

## [0.1.0] — 2026-11-05

First public release candidate. Everything below is in this release; there was
no earlier public version.

### Added

- `HPG-1` derivation: HKDF-SHA-256 with salt `HPG-1|seed`, info
  `HPG-1|YYYY-MM|DD|attempt`, rejection sampling at `4_200_000_000`, and a
  zero-padded 8-digit output.
- Frozen specification ([`docs/spec-hpg-1.md`](docs/spec-hpg-1.md)) and
  published test vectors ([`test-vectors.json`](test-vectors.json)), including
  RFC 5869 A.1, a real rejection case, and full months under two seeds.
- Recovery codes: Crockford Base32, 26 seed characters plus a 2-character
  checksum, `HPG1-` prefix, 4-character grouping, a seed fingerprint, and
  forgiving normalization (case, whitespace, hyphens, `I`/`L`/`O`,
  zero-width characters).
- Two-door browser UI: create a new list, or restore one from a saved code.
  Explicit month selection, a blocking save-the-code ceremony, a full-month
  table with today highlighted, per-day and copy-all, text download, print,
  Web Share, rotate, and start over.
- A DOM-free session layer with month validation, leap-year handling, weekday
  names, and a plain-text export that preserves leading zeros and omits the
  seed and code.
- Independent Python reference implementation and `make cross-check`.
- Reproducible single-file build: inlined CSS and ES modules, CSP hashes for
  the exact inline bytes, Cloudflare Pages `_headers` (CSP, HSTS,
  `Referrer-Policy: no-referrer`, `nosniff`, frame denial, Permissions-Policy,
  Cache-Control), `SHA256SUMS`, and a policy check that refuses an artifact
  containing external URLs, `eval`, `innerHTML`, dynamic imports, storage APIs,
  or network APIs.
- Committed deployable artifact `dist/` and `make verify-build` to prove it
  matches the source.
- The page footer and meta tags show the product version and a build id (the
  first 16 hex characters of the SHA-256 of the inline script), so a user can
  confirm which release they are running.
- Threat model, privacy policy, FAQ, verification guide, QA record, UX
  checklist, router compatibility record, usability record, deployment guide,
  and this changelog.
- MIT license.

### Security

- No server, accounts, cookies, analytics, or third-party assets. No storage of
  the seed or list. No network request after the page loads.
- The list is not revealed until the user confirms the recovery code is saved.
- Printed and exported lists contain the month and fingerprint, never the seed
  or recovery code.
- Residual risks are documented plainly in
  [`docs/threat-model.md`](docs/threat-model.md), chiefly the ≈26.6-bit entropy
  of an 8-digit password and the impossibility of recovery without the code.

### Fixed during development

- Pasted recovery codes containing zero-width characters failed normalization.
  They are now stripped (`U+200B`, `U+200C`, `U+200D`, `U+FEFF`).
- The exported list text now states the day count, which makes a truncated
  share easier to spot.
