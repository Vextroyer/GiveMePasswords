# QA Record

- **Build:** `HPG-1`, artifact `d4b89db74d6bed04db78b7e4e48931508e46f6638800bcd1277eb790068f49c8`
- **Date:** 2026-11-05
- **Environment:** Linux container, Node.js 26.13.0, Python 3.15.2, GNU Make 4.3.
  No Docker, no browser available in the build environment.

## Automated evidence

| Check | Command | Result |
|---|---|---|
| Derivation + vectors + session + policy + build | `make test` | 49 passing, 0 failing |
| Independent Python implementation | `make cross-check` | `test-vectors.json` reproduced |
| Reproducible artifact | `make verify-build` | no diff, same hash |
| Built bundle flow (throwaway DOM shim) | `node .playground/smoke-dom.mjs --dist` | create, ceremony gate, list, copy, restore, rotate, error all pass |
| Source flow (throwaway DOM shim) | `node .playground/smoke-dom.mjs` | same |

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
- The build: self-contained artifact, module order, CSP hash correctness, header
  presence, checksum format, and byte-for-byte determinism.

## Manual checks

These require a real browser, device, or the deployed URL. They are **pending**
and must be completed before a public launch.

| Check | Status | Notes |
|---|---|---|
| Chrome/Chromium: create → ceremony → list → restore | Pending | |
| Firefox: create → ceremony → list → restore | Pending | `input[type=month]` falls back to a text field in some versions |
| Safari iOS: create, share sheet, download | Pending | Share-sheet and download behavior differ from desktop |
| Android Chrome: create, share, download, print | Pending | |
| Zero network requests after load | Pending | Static policy test passes; needs DevTools evidence |
| No CSP violations or mixed content | Pending | Needs the deployed URL or a local server |
| Keyboard-only pass | Pending | Tab order, dialog trap, Escape, focus return |
| Screen reader pass (VoiceOver, TalkBack) | Pending | Table caption and row labels exist in markup |
| 200% zoom and 320 px viewport | Pending | |
| Lighthouse accessibility ≥ 95 | Pending | |
| A4 and Letter print, one page, leading zeros intact | Pending | Print CSS is in place |
| Offline `file://` copy in one Chromium and one WebKit browser | Pending | WebCrypto may be unavailable; the app fails closed |
| Hash of served page matches `dist/SHA256SUMS` | Pending | Deployment blocked |
| Headers returned by the host | Pending | Deployment blocked |

## Defects found and fixed during the build

| Date | Defect | Fix |
|---|---|---|
| 2026-11-05 | Pasted codes with zero-width characters failed normalization | Strip U+200B, U+200C, U+200D, U+FEFF in `normalizeRecoveryCode`; added a regression test |
| 2026-11-05 | Exported text did not state the day count, weakening the share/mangle check | Added `(N days)` to the header; added a test |
| 2026-11-05 | Build test cleanup removed the temp directory before async assertions | `withTempDir` now awaits the callback before cleanup |

## Open risks

- No real-browser or real-device testing has been performed yet.
- The cousin's router has not been tested for leading zeros, exact length, repeat
  policy, or admin-session behavior.
- Deployment is blocked on a Cloudflare account and a git remote.
- The public/private launch decision is still open (Phase 5).
