# QA Record

- **Build:** `HPG-1`, version `0.1.0`, build id `8e732a49ddd4ddb7`, artifact
  `1acaba57ed1c3f7fbfd9f1934e4e67dee560e327f1421650db7c65e808f84786`
- **Last verified:** 2026-11-07
- **Environment:** Linux container, Node.js 22.23.4 and 26.13.0, Python 3.15.2,
  GNU Make 4.3. No Docker, no browser available in the build environment.

## Automated evidence

| Check | Command | Result |
|---|---|---|
| Derivation + vectors + session + policy + build | `make test` | 61 passing, 0 failing (Node 22.23.4 and 26.13.0) |
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
- Month validation, leap years, weekday names, session assembly, and text export
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
| Firefox: create → ceremony → list → restore | Pending | `input[type=month]` falls back to a text field in some versions |
| Safari iOS: create, share sheet, download | Pending | Share-sheet and download behavior differ from desktop |
| Android Chrome: create, share, download, print | Pending | |
| Zero network requests after load | Pending | Static policy test passes; needs DevTools evidence |
| No CSP violations or mixed content | Pending | Needs a browser |
| Keyboard-only pass | Pending | Tab order, dialog trap, Escape, focus return |
| Screen reader pass (VoiceOver, TalkBack) | Pending | Table caption and row labels exist in markup |
| 200% zoom and 320 px viewport | Pending | |
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
