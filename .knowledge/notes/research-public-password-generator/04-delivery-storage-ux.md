---
id: rq4-delivery-storage-ux
created: 2026-11-04
type: research-note
status: active
parent: research-public-password-generator
question: "How does the list get from the browser into the cousin's hands, where does it live, and what should the UX be?"
tags: [ux, delivery, clipboard, print, offline]
---

# RQ4 — Delivery, storage, and UX

## Context

- The cousin generates the list herself on a public site, then copies it to WhatsApp, Notes,
  a password manager, or paper, and applies each day's password to the router.
- No accounts, no server storage. The browser is the only place the list exists until she
  saves it.
- Two modes: random and seeded/reproducible.

## Sub-questions

1. **Getting the list out:** copy-all, copy per day, download TXT/CSV/PDF, print, Web Share
   API, QR code, clipboard. Which are reliable on mobile, and what are the risks?
2. **Where it lives afterward:** WhatsApp, Notes, password manager, print, screenshots.
   What are the privacy and persistence risks of each? What should the site recommend?
3. **Random vs seeded UI:** tabs or a single flow? How to explain the difference without
   confusing a non-technical user? When to show the recovery code? How to warn that a new
   random list will not match the old one?
4. **Seed entry:** show/hide, paste, strength meter, normalization (Unicode, whitespace,
   case), error handling, and what to do if the seed is wrong (you cannot know until the
   list is compared).
5. **Month handling:** month selector, default to current month, highlight today, show all
   28–31 days, handle generating mid-month, regenerating a past month, time-zone label.
6. **Offline:** PWA/service worker so the site works without a network after first load;
   what to cache and what never to cache (seeds, decrypted lists).
7. **Accessibility:** contrast, screen readers, large tap targets, keyboard navigation,
   print stylesheet, i18n and date localization.
8. **Privacy:** no analytics, no cookies, no fingerprinting, no third-party fonts or
   scripts; what the privacy policy must state.
9. **UX pitfalls:** accidentally generating a new list instead of regenerating the seeded
   one; losing the recovery code; copying the wrong month; assuming "random" is recoverable;
   the list being cut off by mobile keyboards or share sheets.
10. **Recommendation:** a mobile-first flow, a recovery-code ceremony, copy/print/download
    options, and a clear "save this now" moment.

## Scout brief

Prioritize questions 1, 3, 4, and 9. Look at comparable tools (password generators,
deterministic password managers) for flow patterns, but focus on the specific two-mode
model and the non-technical cousin. Produce a recommended screen flow and a list of UX
failure modes with mitigations.

## Findings (scout output)

### Summary

The hard constraint drives everything: **the browser is the only place the list exists, so the
"save" moment is the product.** Treat generation as cheap and delivery as the critical path.
A monthly list is 28–31 short strings — small enough to copy or print, too long to retype, and
too sensitive to leave only in a chat thread. The site should optimise for one primary path
(share/copy on mobile, print on desktop), offer one fallback (download TXT), and refuse to let
the user leave the result screen without an explicit acknowledgement that they saved it.

Two-mode design should be **two doors, not two tabs**: "Create a new list" vs "I already have a
recovery code". Tabs imply you can switch freely; in reality the modes are not interchangeable
and switching is the single most damaging mistake (a new random list silently replaces the old
one). A modal-free, one-question-at-a-time flow with the mode chosen once, up front, matches how
LessPass/Spectre frame their model ("remember one secret, math does the rest") and avoids
exposing cryptographic vocabulary.

Comparable tools (LessPass, Spectre/Master Password) validate the stateless pattern but **do not
solve the delivery problem** — they assume one password is read and used immediately. Our case is
a *batch* artefact with a month-long lifetime, which is closer to a boarding pass than to a
password manager. That is why export/print/save ceremony deserves first-class UI, not a
secondary menu.

### Recommended flow (mobile-first)

**Screen 0 — Landing**
- One sentence: "Creates the passwords for one month. Everything happens on this device."
- Two large buttons, in this order:
  1. **Create a new list** (random)
  2. **I have a recovery code** (seeded / same list as before)
- Tiny footer: "No account. No tracking. Nothing is sent anywhere." + link to "How it works".
- No month picker yet — one decision per screen.

**Screen 1 — Month**
- Month `<input type="month">` or a `<select>` of the next 12 months, **defaulted to the current
  local month**, plus prev/next arrows.
- Context line: "November 2026 · 30 days · times shown in Europe/Paris (UTC+01:00)".
- If the chosen month is the current one: "Today is the 4th — days 1–3 have already passed."
- Primary button: **Continue**; secondary text link: "Choose another month".

**Screen 2a — New list: mode**
- Radio cards (not tabs):
  - **Random list** — "New every time. If you lose it, it cannot be recreated."
  - **Recovery code** — "Recreates the same list on any device, any time."
- Selecting *Recovery code* goes to 2b; *Random* goes straight to 3.

**Screen 2b — Recovery code (seeded)**
- Label "Your recovery code", password input with show/hide toggle, `autocomplete="off"`,
  `spellcheck="false"`, `autocapitalize="none"`, paste button.
- Helper: "We ignore capitals and extra spaces. We do not ignore accents or emoji."
- Live: after 1s debounce show **seed fingerprint** (e.g. `7F3A‑K2`) — "This is how you can tell
  you typed the same code later." Never show the seed itself outside this field.
- No strength meter on the *seed* as a password (it is not a login secret); instead a
  **memorability/entropy hint**: "4+ unrelated words is strong. One word is not."
- Warning block, not a toast: "A wrong code produces a full, realistic-looking list. Nothing will
  look wrong until a password doesn't work."
- Primary: **Recreate this list**. Secondary: "Start a new random list instead" (with confirm).

**Screen 3 — Result (the save ceremony)**
- Header: `November 2026` + mode badge (`Random` / `Recovery code 7F3A‑K2`) + timezone.
- Sticky banner until dismissed: **"Save this list now — it exists only in this browser."**
- Table: Day | Date (weekday localised) | Password. Today's row highlighted and scrolled into
  view. Past days dimmed but present.
- Primary action: **Share / Save** → `navigator.share()` with a file if `canShare({files})`,
  else text; falls back to **Copy all**.
- Secondary row: `Copy all` · `Download TXT` · `Print` · (desktop) `Download CSV`.
- Per-row copy icon on each day (tap target ≥44 px), `aria-label="Copy password for Tuesday 4 November"`.
- Footer actions, visually separated and lower emphasis: "Generate another month", "Start over".

**Screen 3b — Recovery-code ceremony (seeded only, before the list is revealed)**
1. Show the code large, monospace, selectable, with **Copy code** and **Download code (.txt)**.
2. "This code is the only way to get this list again. We cannot recover it for you."
3. Checkbox/tap: "I have saved this code" → enables "Show my list".
4. Persist **nothing** server-side; keep seed only in memory. Optional same-session convenience:
   `sessionStorage` with a visible "kept until you close this tab" note (see open questions).

**Screen 4 — Done**
- "Saved to WhatsApp?" style confirmation is unverifiable — do not fake it. Just: "You can close
  this page." + "Generate next month" (carries the seed forward in memory for seeded mode) +
  "Start over (clears this device's copy)".

**Recovery-code generation rule:** generate it, don't let the user invent it. Show it as 4–6
words (wordlist) with a copy button; word-based codes survive being read over the phone and
typed on a TV remote, and are easier to verify by fingerprint than base64.

### Delivery / storage comparison

| Channel | Mobile reliability | Fidelity | Persistence | Risk | Verdict |
|---|---|---|---|---|---|
| **Copy all** (`clipboard.writeText`) | High; requires HTTPS + user gesture; iOS may re-prompt | Plain text | Clipboard is shared with all apps, may sync via Universal Clipboard | Other apps/OS clipboard history can read it; gets overwritten silently | **Primary fallback**; always available |
| **Copy per day** | High | One password | ephemeral | Easy to copy the wrong row | Good for daily use, not for archiving |
| **Web Share (text)** | High on iOS/Android; share sheet is the native "send to WhatsApp" path; requires transient activation, `navigator.share` unsupported on most desktop browsers | Text, target-dependent truncation/formatting (SMS, some targets mangle newlines/limit length) | Lands in whichever app the user picks | User may pick a target that truncates; no delivery confirmation (`AbortError` = cancel, not failure) | **Primary mobile action**, with copy fallback |
| **Web Share (file)** | Good where supported; must gate with `navigator.canShare({files})` | Exact `.txt`/`.csv` (MIME + filename preserved) | File in chat/Drive/Files | Same as text, but much less truncation risk | Best mobile path when available |
| **Download TXT** | Medium: iOS Safari opens a preview/share step rather than a Downloads folder; Android lands in Downloads | Exact | User-controlled file | User forgets where it went; file syncs to cloud backups | **Recommended durable copy** |
| **Download CSV** | Same as TXT | Exact, but spreadsheet apps may reformat/reinterpret (leading zeros, dates) | User-controlled | Excel auto-format mangling; needs UTF-8 BOM + quoting | Desktop/archival only |
| **Download PDF** | Requires bundling a PDF library (jsPDF/pdf-lib, hundreds of KB) or server rendering (forbidden) | Print-like | User-controlled | Bundle bloat + third-party code audit surface; overkill for 30 rows | **Do not build**; use Print → "Save as PDF" |
| **Print** (`window.print()`) | iOS/Android print dialog is inconsistent; "Save as PDF" is buried or absent in some Android WebViews | Excellent with a print stylesheet | Paper (best offline durability) | Paper left on a desk; wrong month printed; printer margins clip columns | **Primary desktop action**; offer on mobile with caveat |
| **QR code** | Works but awkward: 30 passwords is far too much data for one QR (dense, scan-fragile); per-day QR is plausible | Exact only if encoded losslessly | Phone camera roll / other device | Screen-scraping by anyone nearby; QR readers upload images to cloud in some apps | **Skip for the month list**; optional per-day QR is a nice-to-have |
| **Screenshot** | Universal | Image; may crop/compress | Photos app, cloud photo backup | **Silent cloud sync, indexing, OCR, visible in gallery** | Never recommend; mention as something people will do anyway |
| **WhatsApp "message yourself"** | Very high (already the cousin's habit) | Text, formatting collapses | Server-side, backed up, searchable forever, tied to phone number | Long-lived plaintext on Meta infrastructure + backups; forwarded by accident; new phone = old thread | **Accept as reality, mitigate with a file + a "delete after saving" hint** |
| **Notes app** | High | Text | iCloud/Google sync, often unencrypted at rest for notes | Syncs to cloud, searchable, appears on shared/linked devices | Acceptable if device is locked; prefer a **locked note** |
| **Password manager (secure note)** | Medium (manual paste) | Text | Encrypted, syncs | Best persistence/security trade-off; but requires the cousin to already use one | **Recommend if she has one** |
| **Paper (print)** | High | Exact | Physical | Theft/photograph, lost, household visibility | **Recommend as the offline backup**, stored away from the router |

**What the site should recommend, in order:** 1) Save as a **file** (Share → Files/WhatsApp
document, or Download TXT), 2) **print** a copy for the drawer, 3) paste into a **password
manager secure note** if she uses one, 4) WhatsApp to herself only as a convenience copy, with
the explicit note "delete it once it's saved somewhere safer". Never present screenshot as an
option. Include a one-line note that WhatsApp/Notes copies are backed up to cloud accounts.

### Random vs seeded: framing and UI

- **Two doors, not tabs.** Mode is chosen on a dedicated screen and shown as a badge thereafter.
  Tabs invite toggling and hide which mode produced the visible list.
- **Word choice:** avoid "seed", "deterministic", "hash". Use *random list* vs *recovery code*.
  One-line explanations:
  - Random: "Made once, never again. Great if you'll save it right now."
  - Recovery code: "A code that recreates the same list later. Great if you might lose the paper."
- **Recovery code visibility:** only in seeded mode, and only at two moments — right after
  generation (the ceremony) and on demand via "Show recovery code" behind a confirm ("Anyone
  looking at this screen can recreate your list"). Never in the print stylesheet, never in the
  downloaded list header, never in the URL.
- **New-random warning:** when a seeded list is on screen and the user taps "New random list",
  use a blocking confirm naming the consequence: "This replaces the list made from code
  7F3A‑K2. The old list cannot be recreated without that code." Require typing/acknowledging
  only if a list is unsaved; otherwise a single explicit confirm is enough.
- **Persist the mode across "next month":** if she generated November from a code, December must
  default to the same code, with the code prefilled (masked) and fingerprint shown. This is the
  single highest-value continuity feature and prevents the "why doesn't December's password
  work" failure.
- **Checksum instead of full comparison:** a short fingerprint of the *normalised* seed lets a
  user verify across devices in seconds. It leaks a tiny oracle about the seed (offline
  brute-force check) — acceptable if the seed is high-entropy, questionable if the cousin picks
  "hany123". Gate the fingerprint behind "Show verification code" to reduce casual exposure.

### Seed entry specifics

- **Show/hide** toggle with `aria-pressed`, label changes to "Hide code"; default **hidden** on
  first entry, **visible** during the ceremony (she must transcribe it).
- **Paste** button plus normal paste; never block paste (`autocomplete="off"` is fine,
  `onpaste` blocking is hostile and breaks password managers).
- **Normalisation, documented and versioned** (must never change after launch or old lists break):
  - Unicode **NFC** (not NFKC — NFKC folds ligatures/fullwidth chars and can surprise);
  - trim leading/trailing whitespace; collapse internal runs of whitespace to a single space;
  - **case-sensitive by default**, but state it ("Capitals matter") — silently lowercasing
    makes the fingerprint lie and hides typos. If you do fold case, say so loudly and fold in
    the fingerprint too;
  - accept emoji and non-Latin scripts; do not strip diacritics.
- **Strength meter:** use it on the *code* only as an entropy hint (word count × wordlist size),
  labelled "Hard to guess", not "Strong password"; a seeded code's security is about
  guessability, not composition rules. Do not require symbols/digits.
- **Error handling:** the only detectable errors are empty/too-short code. Everything else
  produces a valid-looking list. So: (a) require a minimum length, (b) show the fingerprint,
  (c) offer "I'm not sure this is right — compare with your saved copy" and (d) never say
  "incorrect code", because you cannot know. Copy must be: "If this doesn't match your old list,
  the code is different — check capitals, accents and spaces."
- **Wrong-seed indistinguishability** is the core hazard: the output is plausible by construction.
  Mitigations are social, not technical: fingerprint ceremony, a "verify" affordance, and telling
  her to keep the code with the printed list.

### Month handling

- Default to **current local month** and **current local day**; use `Intl.DateTimeFormat()`
  `resolvedOptions().timeZone` and the current UTC offset in the header. Never say "today" without
  a timezone context if the page might be used while travelling.
- Day count: `new Date(year, month, 0).getDate()` → 28/29/30/31, leap years included. Do **not**
  enumerate days by adding 86 400 000 ms — DST transitions produce duplicate/skipped dates. Use
  calendar arithmetic (`new Date(y, m, d)`) or plain integer day numbers.
- **Mid-month generation:** generate the whole month. Mark days < today as "past" (dimmed, with
  a note "already changed"), today as "today", future as normal. Do not default to "start from
  today" silently — she may need to re-apply earlier days after a reset, and a partial list
  invites "where are days 1–3?" support questions. Offer a filter toggle "Show only remaining
  days" that affects *display and copy*, not the underlying list.
- **Past months:** allow regeneration for any month (seeded mode is genuinely useful here for
  audit/recovery); label clearly "This month has already ended". Random mode should warn that a
  past month generated now is a *new* list, not the old one.
- **Month identity:** always print the month name **and** year and the day-of-week for each row,
  because "the 4th" is ambiguous and weekday errors are how people apply the wrong password.
  Use `Intl.DateTimeFormat(locale, {weekday:'long', day:'numeric', month:'long'})`.
- **DST:** irrelevant for date-only keys; relevant only if you ever add a "changes at HH:MM"
  feature. If you do, compute the transition per timezone rather than assuming 02:00.
- **First day of week / locale:** derive with `Intl.Locale#weekInfo` where available; do not
  hardcode Monday. Month names and weekday names come from `Intl`, never from a hand-written table.

### Offline (PWA)

- **Cache, versioned:** app shell (`/`), hashed JS/CSS, manifest, icons, self-hosted font subset
  (or use a system font stack and cache nothing). Precache on `install`, clean old caches on
  `activate`, serve navigations with a cache-first/network-update strategy so a stale deploy
  can't break the flow.
- **Never cache or persist:** the seed, the derived list, the recovery code, clipboard contents,
  any URL containing them. No `localStorage`, no `IndexedDB`, no Cache Storage for these. If you
  add same-session convenience, use `sessionStorage` (cleared on tab close) and disclose it.
- **Do not put the seed in the URL** (query or hash) to "support bookmarking": it lands in
  history, sync, screenshots, and the referrer. If shareability is needed, share a *file*, not a
  link.
- **Offline caveat:** service workers need HTTPS/localhost and don't work from `file://`; first
  load must succeed before the app is offline-capable — so don't make the first visit depend on
  a CDN. State "works offline after first visit" honestly.
- `window.print()` and `navigator.share()` are unavailable or degraded in some installed-PWA
  contexts; keep the TXT download as the always-works escape hatch.

### Accessibility & privacy notes

**Accessibility**
- Contrast: WCAG 2.2 AA — 4.5:1 body text, 3:1 for large text and UI boundaries; the "today"
  highlight must not rely on colour alone (add a label and a left border/weight change).
- Tap targets ≥ 24×24 CSS px (2.5.8 AA) and ≥ 44×44 in practice, especially per-row copy icons
  and the show/hide eye.
- Keyboard: logical tab order, visible `:focus-visible` ring, no focus traps, copy confirmation
  announced via `aria-live="polite"` ("Copied password for 4 November"). Table uses real
  `<table>` with `<th scope="col">` and a caption naming month/timezone.
- Seed field: `<label for>`, `aria-describedby` pointing at the normalisation note and warnings,
  `aria-invalid` only for empty/too-short, error text linked and focused on submit.
- Respect `prefers-reduced-motion`; no auto-advancing carousels; no time-limited toasts for
  critical warnings.
- Print stylesheet: hide nav/buttons/banner; black on white; repeat table header per page; one
  month per page; footer with site URL, month, timezone, generation date, mode + fingerprint
  (never the seed); avoid background colours (they don't print by default).
- i18n: all dates via `Intl`; no hardcoded `MM/DD`; allow long month names (German, Polish);
  avoid text baked into images; RTL-safe layout if translated; the wordlist for recovery codes
  should be language-specific or explicitly English-only.

**Privacy**
- No analytics, no cookies, no fingerprinting (no canvas/WebGL probes, no device enumeration),
  no third-party fonts, scripts, or CDNs. Self-host everything, including the QR library if ever
  added. Set CSP `default-src 'self'`, `Referrer-Policy: no-referrer`, no `Cross-Origin-*`
  surprises, and avoid `<iframe>` embeds.
- All derivation in-page via WebCrypto/JS; zero network calls after asset load. No error
  reporting/telemetry. No service-worker `fetch` beacons.
- Privacy text must state plainly: "Passwords and codes are generated in your browser and never
  sent to us. We do not use cookies or analytics. Our host may keep standard access logs
  (IP, user agent, time) like any website; we do not connect those to anything you generate."
  Also: "We cannot recover your list or your code." And a line about third parties the *user*
  chooses (WhatsApp, Notes, cloud backups) being outside the site's control.
- Do not claim "military-grade" or "unhackable"; do claim deterministic, local-only, auditable.

### UX failure modes + mitigations

| # | Failure | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| 1 | Taps "New list" thinking it regenerates the same seeded list | High | Old list irrecoverable, router locks out | Mode as two doors + persistent mode badge; destructive confirm naming the code fingerprint; never place "New list" next to "Regenerate" |
| 2 | Loses the recovery code | High | Seeded list gone forever | Blocking ceremony before reveal; copy + download both; "I have saved this code" gate; print footer includes fingerprint, not code |
| 3 | Types a different-but-valid seed | Medium | Plausible wrong list; fails only at the router | Fingerprint after entry; "compare with your saved copy" affordance; don't claim validation you can't do |
| 4 | Copies the wrong month | Medium | A day's password rejected; lockout after retries | Month name+year in every copy header, filename, share text, and printed sheet; filename `passwords-2026-11.txt`; highlight month in share sheet |
| 5 | Assumes random is recoverable ("just generate again") | High | Permanent loss | Copy on the mode card and the save banner: "A new random list will not match the old one." No "regenerate" verb in random mode — use "create another" |
| 6 | Share sheet truncates/mangles the list | Medium | Silent data loss mid-month | Prefer file sharing (`canShare({files})`); cap text length; verify by line count and show "31 of 31 days" in the share payload header; offer copy-all fallback |
| 7 | iOS opens TXT in a preview instead of saving | Medium | User thinks it failed, retries, gets confused | Label "Save file" not "Download"; post-action hint with platform-specific wording; persistent "did it save?" checklist |
| 8 | Screenshot / WhatsApp copy becomes the only copy, synced to cloud | High | Long-lived plaintext in backups | Recommend file + print; note that chat/notes are cloud-backed; suggest deleting the chat copy after saving |
| 9 | Clipboard silently overwritten or read by another app | Medium | User pastes stale/other data | Copy action shows the first and last 4 chars + day; toast with "Copied 31 days — paste into Notes now" |
| 10 | Regenerates past month in random mode believing it's the old list | Medium | Wrong passwords for days already changed | Past-month banner: "This is a new list, not the one you used." Seeded mode is the recovery path |
| 11 | Uses the site offline before first successful load | Low | Blank page | Honest copy; no CDN dependency; cache-first shell; static, tiny bundle |
| 12 | Timezone/day confusion when travelling or near midnight | Low | Applies tomorrow's password today | Show timezone + offset; mark "today" from local calendar; print weekday names |
| 13 | Seed pasted with trailing newline/zero-width char | Medium | Different list, no error | Normalise (NFC, trim, collapse spaces); strip zero-width chars; show fingerprint immediately |
| 14 | Screen reader reads password table as an undifferentiated blob | Medium | Cannot find today's password | Real table semantics + caption; per-row labelled copy buttons; `aria-live` confirmations |
| 15 | Print clips the password column or prints dark backgrounds | Low | Illegible paper backup | Dedicated print stylesheet, tested at A4/Letter, `@page` margins, no background colours, monospace password column |

**Non-goals worth stating explicitly:** no accounts, no server storage, no PDF generation, no QR
for the full month, no "email me the list", no link that encodes the seed.

### Open questions

1. **Session persistence:** is `sessionStorage` for the seed (tab-lifetime, disclosed) worth the
   convenience of "next month" continuity, or should the seed live only in memory and be retyped
   each visit? Memory-only is safer but breaks the December flow.
2. **Fingerprint exposure:** does showing a 4–6 char seed fingerprint meaningfully help
   non-technical users verify, or does it just add a new thing to lose/confuse? It is also a
   offline-guessing oracle for weak seeds.
3. **Recovery-code format:** 4–6 words from a 2048-word list (readable, phone-friendly) vs a
   compact base32 string (shorter, easier to paste, harder to read aloud). Needs a usability test
   with the actual cousin.
4. **CSV at all?** If nobody opens the list in a spreadsheet, TXT + print covers everything and
   removes the Excel-mangling failure mode.
5. **Does she want per-day delivery?** A monthly batch may be the wrong abstraction — e.g. a
   daily WhatsApp nudge would remove the "which row is today" problem but requires a backend,
   which is out of scope. Worth asking before building polish around the batch.
6. **Locale/wordlist:** is the cousin's UI language English, French, or Polish? This affects
   month names, weekday order, and the recovery-code wordlist.
7. **Print-vs-file default on mobile:** iOS share sheet can produce a PDF via "Print", which may
   be a better default than TXT; needs device testing.

**Sources consulted:** MDN Web Share API
(https://developer.mozilla.org/en-US/docs/Web/API/Web_Share_API) — secure context, transient
activation, `canShare`, no worker support, `AbortError` on cancel; MDN Clipboard API
(https://developer.mozilla.org/en-US/docs/Web/API/Clipboard_API) — secure context, write
permission/transient activation, Firefox/Safari prompt behaviour, plain-text vs multi-representation;
MDN `Window.print()`
(https://developer.mozilla.org/en-US/docs/Web/API/Window/print) — blocking dialog, baseline;
MDN Progressive Web Apps (https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps) —
service worker/Cache/offline guidance, installability, `Web Share API` for PWA sharing; LessPass
README (https://github.com/lesspass/lesspass) and https://lesspass.com (site returned no content)
— stateless model, master password + site + counter, clipboard-copy flow, "no sync needed";
Master Password / Spectre (https://masterpassword.app redirects to https://spectre.app) —
name + secret + site → password, in-page "this information never leaves this page" demo, explicit
"your secret is unrecoverable" framing. `websearch` was unavailable (HTTP 402), so no additional
secondary sources were used.
