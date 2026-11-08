# UX Failure Modes

Maps the 15 failure modes from the design review to what the app does today.
"Verified" means covered by an automated test in `test/`; "Browser check" means
it still needs a real device or browser.

Some rows cite a local DOM smoke script. It lives in `.playground/`, is not
tracked, and is not reproducible from a clone; treat those as development notes,
not as CI evidence.

Status legend: **Mitigated** · **Partial** · **Deferred**

| # | Failure | Status | What the app does | Evidence |
|---|---|---|---|---|
| 1 | Taps "New list" thinking it regenerates the same seeded list | Mitigated | Mode is chosen once on the landing screen ("Create a new list" vs "I have a recovery code"). The result screen shows a persistent mode badge and never pairs "Start over" with a same-list action. Rotating asks for confirmation. | `test/app-policy.test.mjs`, DOM smoke |
| 2 | Loses the recovery code | Mitigated | A blocking dialog shows the code before the list exists, with Copy, Download, and an "I have saved this code" checkbox that gates the reveal. The code is shown again in a details panel on the list screen. | DOM smoke: continue stays disabled until confirmation |
| 3 | Types a different-but-valid seed | Partial | The checksum catches most typos, but a valid code for a different seed cannot be detected. No fingerprint is shown; users confirm by comparing a known day's password and checking the month. Residual risk accepted (D1=A). | `test/session.test.mjs`; `docs/threat-model.md` row 10 |
| 4 | Copies the wrong month | Mitigated | Month and year appear in the page title, table caption, text export header, share text, and download filename (`passwords-2026-11.txt`). | `test/session.test.mjs`, DOM smoke |
| 5 | Assumes random is recoverable | Mitigated | Landing copy and the create hint say a new list gets a new code and will not match an earlier list. The ceremony states the code is the only way to rebuild it. | Static copy in `src/index.html` |
| 6 | Share sheet truncates or mangles the list | Partial | File sharing is preferred when `canShare({files})` is available; otherwise copy-all is the fallback. The export header includes the day count. | DOM smoke (copy path); Browser check: real share sheet |
| 7 | iOS opens TXT in a preview instead of saving | Partial | The action is labelled "Download .txt" and a toast confirms the action. Platform-specific wording is left to a browser check. | Browser check |
| 8 | Screenshot or chat copy becomes the only copy, synced to cloud | Partial | One factual line states the limitation (“8-digit convenience code — not for high-value accounts”). The full chat/cloud risk stays in `README.md` and `docs/threat-model.md`. No screenshot option is offered. | Static copy |
| 9 | Clipboard overwritten or read by another app | Partial | Every copy action shows a toast naming what was copied (day number or "all passwords"), and the month is on screen. Per-day copy copies exactly one password. | DOM smoke |
| 10 | Regenerates a past month in random mode believing it is the old list | Partial | Random creation always produces a fresh code and the "New list" badge; there is no "regenerate" verb in the create path. A past-month banner is deferred. | Static copy |
| 11 | Uses the site offline before the first successful load | Partial | The single-file artifact and offline copy are shipped; no CDN dependencies. The `file://` behavior still needs a browser check. | Browser check |
| 12 | Timezone or midnight confusion | Partial | "Today" is highlighted from the local calendar and the derivation never reads the clock. No timezone label is shown. | DOM smoke (`currentMonth`), `test/session.test.mjs` |
| 13 | Seed pasted with whitespace or zero-width characters | Mitigated | Normalization strips Unicode whitespace, `-`, U+200B, U+200C, U+200D, U+FEFF, and folds `I`/`L`/`O`. | `test/recovery-code.test.mjs` |
| 14 | Screen reader reads the table as a blob | Mitigated | Semantic `<table>` with `<caption>`, `scope` headers, row headers for days, labelled per-row copy buttons, an `aria-live` toast, and a single `<main>` landmark with one `<h1>` per view. | `test/app-policy.test.mjs`; Browser check: real screen reader |
| 15 | Print clips the password column or prints dark backgrounds | Partial | `@media print` forces light colors, hides controls, repeats table headers, avoids row breaks, and sets `@page` margins. | `test/app-policy.test.mjs`; Browser check: A4/Letter |

## Accessibility checklist

- [x] One `<h1>` per view, with focus moved to it after navigation.
- [x] All controls have visible labels; the recovery-code field has a real `<label>`.
- [x] Buttons and inputs are at least 44 px tall.
- [x] `:focus-visible` outlines on every interactive element.
- [x] Today is marked by text ("Today") as well as background colour.
- [x] Copy confirmations use `role="status"` + `aria-live="polite"`.
- [x] The modal uses `<dialog>` for focus trapping and Escape handling.
- [x] No external fonts, images, or icon libraries.
- [x] `prefers-reduced-motion` disables transitions.
- [x] Dark mode via `prefers-color-scheme` with contrast-safe tokens.
- [ ] Screen-reader pass on iOS VoiceOver and Android TalkBack (pending browser check).
- [ ] 200% zoom and 320 px viewport pass (pending browser check).
- [ ] Lighthouse accessibility ≥ 95 (pending browser check).

## What is deliberately not built in v1

- No CSV export (avoids spreadsheet leading-zero mangling).
- No PDF generation (Print → Save as PDF covers it).
- No QR code for the whole month.
- No service worker or PWA install prompt.
- No "email me the list" and no share link that encodes the seed.
- No persistence of any kind, including `sessionStorage`.
