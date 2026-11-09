# QA Record

- **Build:** `HPG-1`, version `0.1.0`, artifact
  `7e718bbd4e8b96570981fe10cf32090fce0b199ac46b577db1c28cd5435b5071`
- **Last verified:** 2026-11-09 (static checks); live checks 2026-11-07
- **Environment:** Linux container, Node.js 22.23.4 and 26.13.0, Python 3.15.2,
  GNU Make 4.3. No Docker, no browser available in the build environment.

## Automated evidence

| Check | Command | Result |
|---|---|---|
| Derivation + vectors + session + policy + build + i18n | `make test` | 81 passing, 0 failing (Node 22.23.4 and 26.13.0) |
| Independent Python implementation | `make cross-check` | `test-vectors.json` reproduced |
| Reproducible artifact | `make verify-build` | no diff, same hash |
| Live artifact hash | `curl -s "https://vextroyer.github.io/GiveMePasswords/?$(date +%s)" \| sha256sum` | matches `dist/SHA256SUMS` |
| Live meta CSP | inline style/script hashes vs the meta tag | match |
| Live headers | `curl -sI https://vextroyer.github.io/GiveMePasswords/` | GitHub Pages header set recorded in [`verification.md`](verification.md) |

The live checks were run against
[run `42397975872`](https://github.com/Vextroyer/GiveMePasswords/actions/runs/42397975872).
A local DOM smoke script was used during development but is not tracked and is
not reproducible from a clone; it is not listed as automated evidence.

What `make test` covers:

- RFC 5869 A.1 HKDF output, via the same single-call WebCrypto form the app uses.
- Pinned HPG-1 day vectors, a full `2026-11` month, a second seed, month
  separation, and the real rejection case `2020-02-14` (attempt 0 is
  `x = 4261244084 >= 4200000000`).
- Recovery-code encoding, checksum, fingerprint, normalization (case,
  whitespace, hyphens, `I`/`L`/`O`, zero-width characters), and every failure
  reason.
- Month validation, leap years, session assembly, and text export
  (leading zeros preserved, seed and code omitted).
- The app policy: no storage, no network, no HTML-injection sinks, no URL or
  history leakage, local-only imports, semantic markup, a data-URI favicon, and
  a print stylesheet.
- The build: self-contained artifact, module order, meta CSP hash correctness,
  checksum format, and byte-for-byte determinism.

## Manual checks

These require a real browser, device, or router. They are **pending** unless
marked verified.

| Check | Status | Notes |
|---|---|---|
| Chrome/Chromium: create → ceremony → list → restore | Pending | |
| Firefox: create → ceremony → list → restore | Pending | Native month/year selects replace `input[type=month]` |
| Safari iOS: create, share sheet, download | Pending | Share-sheet and download behavior differ from desktop |
| Android Chrome: create, share, download, print | Pending | |
| Zero network requests after load | Pending | Static policy test passes; needs DevTools evidence |
| No CSP violations or mixed content | Pending | Needs a browser |
| Keyboard-only pass | Pending | Tab order, dialog trap, Escape, focus return |
| Screen reader pass (VoiceOver, TalkBack) | Pending | Table caption and row labels exist in markup |
| 200% zoom and 320 px viewport | Pending | Spanish copy expansion is the main risk |
| EN↔ES toggle, `<html lang>`, title/meta, export header | Pending | Static hydration tests pass; needs a real browser |
| Screen-reader pronunciation of “English”/“Español” | Pending | Endonyms carry `lang` attributes in markup |
| Lighthouse accessibility ≥ 95 | Pending | |
| A4 and Letter print, one page, leading zeros intact | Pending | Print CSS is in place |
| Offline `file://` copy in one Chromium and one WebKit browser | Pending | WebCrypto may be unavailable; the app fails closed |
| Hash of served page matches `dist/SHA256SUMS` | Verified 2026-11-07 | Run `42397975872` |
| Headers returned by the host | Verified 2026-11-07 | No CSP/XFO; the meta CSP is the only CSP; the page is framable |
| Router accepts exactly 8 digits | Pending | Representative consumer router |
| Router accepts a leading zero (e.g. `07134458`) | Pending | |
| Router accepts an all-digit password | Pending | |
| Router rejects a password already used recently | Pending | |
| Changing the Wi-Fi password logs out the admin session | Pending | |
| WPA2-PSK / WPA3-SAE / mixed mode behavior | Pending | |

## Phase 5 validation status (2026-11-09)

The implementation and static validation are complete. The human-facing
validation in the plan could not be executed in this environment:

- **No browser.** Chromium, Firefox, WebKit, screen readers, zoom, and print
  checks are not available in this Linux container. The DOM is exercised only by
  the fake-DOM tests; `make test` does not run the app in a real engine.
- **No participants.** The five 10-minute usability sessions and the six
  scripted tasks require people. No completion times, comprehension scores, or
  help-needed counts exist, so the plan's metrics are not claimed.
- **No deployment from here.** The repo remote is
  `https://github.com/Vextroyer/GiveMePasswords.git`, but this environment has no
  authenticated `gh` CLI and no Pages credential. The artifact is committed and
  reproducible; publishing remains a manual/CI step.
- **Live hash evidence is stale.** The last live-hash and header checks are from
  run `42397975872` (2026-11-07) and predate the simplification/localization
  changes. They must be repeated after deployment.

What *is* verified in this environment:

- `make test`: 81 passing, 0 failing, including EN/ES key parity (93/93), the
  static-HTML key audit, fake-DOM hydration/idempotence, the removal guards, and
  leading-zero preservation (`07134458`).
- `make cross-check`: Python reference matches `test-vectors.json`.
- `make build` / `make verify-build`: deterministic artifact, no diff, hash
  `7e718bbd4e8b96570981fe10cf32090fce0b199ac46b577db1c28cd5435b5071`.
- Static removal checks: no skip link, footer, build metadata, weekday, or
  fingerprint in the UI/export; month-only recovery filename; one `<main>`;
  one `<h1>` per view; `role="status"`/`role="alert"`; labelled controls;
  focus-visible styling; 44 px targets.

## Defects found and fixed during the build

| Date | Defect | Fix |
|---|---|---|
| 2026-11-05 | Pasted codes with zero-width characters failed normalization | Strip U+200B, U+200C, U+200D, U+FEFF in `normalizeRecoveryCode`; added a regression test |
| 2026-11-05 | Exported text did not state the day count, weakening the share/mangle check | Added `(N days)` to the header; added a test |
| 2026-11-05 | Build test cleanup removed the temp directory before async assertions | `withTempDir` now awaits the callback before cleanup |
| 2026-11-07 | Node 22 did not expand the `test/` directory argument | Test command is now `node --test test/*.test.mjs`; CI pins Node 22 |
| 2026-11-07 | `dist/_headers` was inert on GitHub Pages and advertised headers that were not sent | Removed the file and the fallback; the meta CSP remains |

## Open risks

- No real-browser or real-device testing has been performed yet.
- Router compatibility is untested: leading zeros, exact length, repeat policy,
  and admin-session behavior.
- The public/private launch decision is still open.
