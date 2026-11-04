---
id: rq1-product-model
created: 2026-11-04
type: research-note
status: active
parent: research-public-password-generator
question: "What exactly is the product, who uses it, and what must it guarantee?"
tags: [requirements, product, threat-model, edge-cases]
---

# RQ1 — Product model and requirements

## Context

- The user currently generates a monthly list of 8-digit Wi-Fi passwords and sends it to a
  cousin. The cousin changes the router password daily and now would generate the list
  herself from a public website.
- The site is **public and stateless**: everything is generated in the browser; the server
  serves static files only.
- Two modes are proposed: **random** and **seeded/reproducible**.
- Audience: both a personal workflow and a general public utility.

## Sub-questions

1. Write the intended user flow end-to-end: visit → choose month → choose random or seeded →
   generate → copy/save/print → apply each day's password to the router. Where can it break?
2. Define "random mode" precisely. Is it a fresh random seed per generation? A fresh list
   with no recovery code? Should it display a recovery code so the list can be reproduced?
3. Define "seeded mode" precisely. What does the user enter — a long code, a passphrase, a
   file? Is the seed per-month or long-lived? What happens if the month changes?
4. Must both modes produce the same list format and the same output policy (8 digits, one
   per day, 28–31 days)? Should the tool support configurable length/charset?
5. Requirements: mobile-first, no login, no storage, offline-capable, fast, accessible,
   public, no analytics, no cookies, no third-party scripts.
6. Threat model: casual visitor, someone who knows the cousin, someone who compromises the
   site's JS, someone who guesses the seed, shoulder surfing, lost phone. What is in and out
   of scope?
7. Edge cases: month boundaries, time zones, DST, leap years, 28/29/30/31 days, generating
   mid-month, regenerating an old month, changing the seed, duplicate passwords.
8. Privacy: what can the host/CDN see? What should the privacy policy say? Is any data
   collection acceptable (analytics, error tracking, logs)?
9. What does "other users" mean for support, documentation, and abuse? Is there a minimum
   viable public product, or is the public aspect incidental?
10. Success criteria: what must be true for the cousin to trust and use it, and for a
    stranger to use it safely?

## Scout brief

Turn the answers into a requirements matrix with must/should/could/won't. Mark assumptions
explicitly. Do not invent user facts; where the answer depends on the cousin's technical
literacy or the router model, list it as an open question. Research comparable tools for
flow patterns, but keep the focus on requirements.

## Findings (scout output)

### Summary

The product is best modelled as a **deterministic calendar-to-code function wrapped in a
one-page, offline-capable UI** — not as a password manager. Two user-facing modes exist, but
they are the same engine with different seed provenance:

- **Seeded mode**: user supplies the secret; the month is an input.
- **Random mode**: the app supplies a fresh CSPRNG secret once, then shows it as a **recovery
  code** so the list can be re-derived later.

The key design decision is that **month is never inferred at generation time**. `YYYY-MM` is an
explicit input; the clock only provides a default and, optionally, a "today" highlight. This
eliminates time-zone, DST and leap-year bugs from the derivation path and makes old months
regenerable forever.

The honest security claim is narrow: this is a **rotation/convenience tool for an 8-digit
numeric router code**. 8 digits ≈ 26.6 bits, so a single day's password is weak against any
offline attacker (e.g. a captured WPA handshake). The product must not market itself as
suitable for online accounts. Comparables (LessPass, Spectre) are stateless and derive from
(master secret + site/counter), which is the right pattern here with `month` as the counter.

### User flow

Primary flow (cousin, phone, monthly):

1. Opens the public URL (bookmark / WhatsApp link). Static page loads; no login, no cookie
   banner, no network calls after load.
2. Sees two choices: **"Generate a random month"** and **"I have a code"**, plus a month picker
   defaulted to the current local month.
3. Picks month (default accepted). Picks mode.
4. Random: taps Generate → list appears; app offers **"Save recovery code"** (collapsed/explicit)
   and **"Share / copy / print"**.
   Seeded: types/pastes the code or passphrase (with show/reveal toggle, no autocorrect, no
   autocapitalise), confirms, taps Generate.
5. Reviews a 28–31 row table: `Day | Weekday | Password` (and month + seed fingerprint header).
6. Exports via Web Share API → WhatsApp "message yourself", or copies all as plain text, or
   prints/PDF, or screenshots.
7. Daily: reads the row for today, opens router admin page, replaces the password, saves.
8. Next month: repeats from step 3, reusing the same seed (recommended) or the saved recovery
   code.

Where it breaks:

| # | Break point | Failure mode | Mitigation |
|---|---|---|---|
| B1 | Landing | User doesn't understand random vs seeded | One-line plain-language descriptions + recommended default; "I have a code" wording, not "seeded" |
| B2 | Month picker | Wrong month silently generates a valid-looking wrong list | Month repeated in the header, every row, the filename and the copied text; no silent default on first visit for seeded mode? (assumption: default is fine) |
| B3 | Seed entry | Typo/autocorrect/Unicode/case produces a different but plausible list | Reveal toggle, trim + Unicode NFKD normalisation documented, optional confirm field, seed fingerprint shown after generation |
| B4 | Seed entry | User pastes seed with spaces/newlines from WhatsApp | Normalise whitespace; accept grouped codes with separators |
| B5 | Export | WhatsApp/Notes mangles layout; leading zeros dropped by some apps | Plain-text block with fixed formatting, no tabs, no leading-zero dependence (see E6) |
| B6 | Export | Copy-all copies stale list after month change | Re-render/invalidate on any input change; disable export until regenerated |
| B7 | Saving | User saves neither list nor recovery code | Explicit "this cannot be recovered" warning before leaving; offer download of `.txt` |
| B8 | Daily use | Reads wrong row (weekday/date confusion, phone clock wrong) | Row keyed by day-of-month; weekday optional secondary; never rely on device clock to pick a row unattended |
| B9 | Router UI | Router rejects or truncates the value, or requires a different format | Out of app control; document "8-digit numeric" scope; open question R1 |
| B10 | Router UI | User locked out after applying a mistyped/misread password | Copy button, monospace, grouped display (`1234 5678`) while copy yields unspaced digits; keep previous password until verified |
| B11 | Mid-month start | User expects today-first list | Allow generating any month; mark past days as past but never reorder or truncate |
| B12 | Offline | First visit offline / cache evicted | Service worker precache after first load; also publish a single-file HTML download (assumption: acceptable) |
| B13 | Trust | User unsure the page is genuine (phishing clone) | Documented canonical URL, signed release, published build hash, no third-party assets |

### Definitions

**Common output contract (both modes).** For a month `M = YYYY-MM` and configuration `C`
(version, digit count = 8, alphabet = `0-9`, optional pattern exclusions), produce exactly
`daysInMonth(M)` values `p[1..N]`, `p[i] ∈ [0, 10^8)`, rendered as 8 characters with leading
zeros. Deterministic for a given `(seed, M, C, algorithmVersion)`. No deduplication across days
(see E9).

**Seeded mode.** Input: one **long-lived secret** (`seed`) — a high-entropy code (≥ 100 bits,
e.g. 20+ Crockford-base32 chars) *or* a 4–6 word passphrase. Derivation:
`p[i] = digits(KDF(seed, salt = "v1|" + M + "|" + i, params), 8)` using PBKDF2-HMAC-SHA-256
(≥ 600k iterations) or Argon2id via WASM, then unbiased rejection sampling into `0..9`.
The seed is long-lived and the **month is mixed in as the counter/salt**, so a month change
requires no new seed and old months stay reproducible. Optional per-month label (e.g. "home
router") may be mixed in if the user wants domain separation; it must then be part of the
recovery code. Seed is never stored; re-entry is the "login". Weak passphrases are the dominant
risk — hence KDF cost and a strength hint.

**Random mode.** Input: none. On Generate, draw 32 bytes from `crypto.getRandomValues()`, use
them as the seed, and derive exactly as above. It is therefore **seeded mode with an
app-generated seed**, not a separate algorithm. The seed is shown as a **recovery code** which
encodes `{algorithmVersion, month, seed}` plus a checksum, in a human-transcribable alphabet
(Crockford base32, grouped, e.g. `K7Q2-9WXM-...`), because otherwise the list is irrecoverable
once the tab closes and there is no storage by design.

**Should random mode display a recovery code? Yes — but behind an explicit, warned affordance.**
Rationale: (a) it is the only recovery path in a no-storage product; (b) it converts "lost list"
into "re-enter code", which is the main real-world failure; (c) it makes the two modes
conceptually one thing. Caveats: the code *is* the month's secret — anyone holding it can
regenerate all 31 passwords — so it must never be placed in the URL, never logged, and must
carry a "treat like the password list" warning. Do not auto-copy it; require a deliberate tap.
A code that embeds the month prevents the common "wrong month" error but is slightly longer;
embed month (recommended) and show the month back to the user.

**Do not** offer configurable length/charset in v1. It multiplies the contract, the recovery
code, and the support surface, and the router constrains it anyway. Version the algorithm so
future changes don't silently change old lists.

### Requirements matrix

Priorities: **M** must (v1), **S** should (v1 if cheap), **C** could (later), **W** won't
(explicitly excluded).

| ID | Requirement | Pri | Acceptance / notes |
|---|---|---|---|
| R1 | Static site, client-side generation only; no upload of seed/month | M | Zero requests containing user input; works with DevTools offline after load |
| R2 | No login, no account, no server-side state | M | No API endpoints beyond static files |
| R3 | No storage of seeds/lists: no cookies, localStorage, IndexedDB, Cache of user data | M | Only a static-asset service-worker cache allowed; document it |
| R4 | Two modes: random and seeded, one shared derivation engine | M | Same output for same `(seed, month, version)` |
| R5 | Month explicit `YYYY-MM`; correct 28/29/30/31 days incl. Gregorian leap rule | M | Property tests across 1900–2100 |
| R6 | 8-digit numeric output, leading zeros preserved in display and copy | M | `00000000`–`99999999`; see E6 |
| R7 | Deterministic, versioned derivation; same inputs ⇒ same list forever | M | Algorithm version in UI and recovery code |
| R8 | Recovery code in random mode, month-embedded, checksummed, transcribed easily | M | Round-trip test: code ⇒ identical list |
| R9 | Explicit "cannot be recovered" warning + recovery code prompt | M | Shown when leaving with unsaved list |
| R10 | Mobile-first, one-handed, ≤ 3 min end-to-end on a mid-range phone | M | 360 px viewport, 44 px targets, no horizontal scroll on table |
| R11 | Plain-text export with month + day + password; copy-all; print stylesheet | M | Output unambiguous in WhatsApp/Notes |
| R12 | Offline-capable after first load (service worker + precache) | S | Cache-first static assets; versioned cache busting |
| R13 | Accessible: WCAG 2.2 AA contrast, labels, keyboard, SR-friendly table, no color-only meaning | M | axe clean; table has caption/headers |
| R14 | No analytics, no cookies, no third-party scripts/fonts/CDNs, strict CSP | M | Network tab shows first-party only; CSP `default-src 'self'` |
| R15 | HTTPS only, HSTS, SRI where applicable, no `eval`/`innerHTML` for user input | M | Security headers verified |
| R16 | Public docs: what it is, what it is not, threat model, how to verify build | S | Explicit "not for online accounts" |
| R17 | Seed strength feedback + normalisation rules (NFKD, trim, case policy) | S | Documented, tested |
| R18 | Seed fingerprint (short hash) to confirm re-entry | C | Only safe for high-entropy seeds; caveat documented |
| R19 | Optional per-month label for domain separation | C | Must be encoded in recovery code |
| R20 | Today highlight using local date | C | Never used for derivation; must be manually overridable |
| R21 | Single-file offline HTML download | C | Same build hash as hosted version |
| R22 | Configurable length/charset/patterns | W | v1: fixed 8 digits |
| R23 | Accounts, sync, history, sharing links containing seed | W | Contradicts statelessness/privacy |
| R24 | Server-side generation, API, email/reminders | W | Adds state and liability |
| R25 | Password-strength claims for the router / security guarantees | W | No overclaiming; 8 digits is weak by design |
| R26 | Pattern avoidance (all-same, ascending/descending) | S | Deterministic skip; negligible entropy loss |

### Threat model

Assets, ranked: (1) the current day's router password; (2) the full month's list; (3) the seed
(compromise ⇒ all months); (4) user identity/behaviour metadata.

**In scope**

| Threat | Actor | Control |
|---|---|---|
| T1 Casual visitor / unrelated public | anonymous | No listing, no index of users, no per-user URLs; nothing to find |
| T2 Someone who knows the cousin (family, neighbour, ex) | semi-trusted | Seed never leaves device; list is the only artefact; advise not to WhatsApp to shared chats; optional PIN on phone |
| T3 Shoulder surfing while reading/typing on phone | nearby | Masked seed by default, reveal toggle, monospace + grouped password, no auto-display of recovery code |
| T4 Lost/stolen phone with the saved list in Notes/WhatsApp | thief | Out of app's control once exported; document; recommend paper or a locked notes app; next-month rotation bounds exposure to ≤ 1 month |
| T5 Network observer | ISP/Wi-Fi | HTTPS/HSTS; no secrets in URL/query/fragment sent to server |
| T6 Curious or malicious site operator | operator | Nothing to collect by design; code audit; no logs requirement; can still serve different JS (residual, T8) |
| T7 Seed guessing (offline, unlimited) | anyone with a recovery code or a few outputs | High-entropy seed requirement + costly KDF; passphrases rate-limited only by KDF cost; attested weak seeds rejected/warned |
| T8 Supply-chain / CDN JS tampering or malicious update | host, CDN, compromised dependency | No third-party runtime deps; pinned build; published hash + signed release + reproducible build; single-file mirror |
| T9 XSS/UI injection via own inputs | attacker-supplied seed string | Treat seed as data, never HTML; no `innerHTML`; strict CSP |
| T10 Malicious/compromised browser extension reading the page | local | Documented as out of control; no secret in DOM longer than needed; clear on "Done" |
| T11 Clipboard/sharing leakage | OS apps | Explicit user action only; warning that share sheet/clipboard history may retain data |

**Out of scope (say so explicitly)**

- Compromised device, keylogger, forensic memory capture, or a rooted phone.
- Router vulnerabilities, weak admin credentials, WPA handshake capture and offline cracking.
  **8 digits is ~26.6 bits — a captured handshake makes the daily password crackable in
  minutes-to-hours on a GPU.** The tool must not be sold as defending against this.
- WhatsApp/Google/Apple cloud compromise of the exported list (third-party E2E/storage).
- Targeted coercion, physical access to the router, state-level adversaries.
- Post-quantum considerations; cryptographic proof of the KDF.
- Anything requiring the operator to know who the user is.

Residual risk statement for the docs: *"The site can serve you malicious JavaScript and you
would not detect it unless you verify the build. If your threat model includes the host, use
the offline single-file build."*

### Edge cases

| ID | Case | Required behaviour |
|---|---|---|
| E1 | Month boundaries | Derivation depends only on `YYYY-MM`; no `Date.now()` in the derivation. Local midnight rollover while the page is open must not alter an already-rendered list |
| E2 | Time zones | `YYYY-MM` is a label, not an instant. No `Date` arithmetic in UTC vs local for the day mapping. Default month from device local clock only at page load, clearly labelled |
| E3 | DST | Irrelevant by construction (no times, no day-length assumptions); assert no `setDate`/`getTime` math in derivation |
| E4 | Leap years | Gregorian rule: divisible by 4, not by 100 unless by 400. Feb 2024/2028 → 29 rows; 2100 → 28. Test 2000 (29) and 1900 (28) |
| E5 | 28/29/30/31 days | `daysInMonth` from a fixed table/`Date.UTC(y, m, 0).getDate()`; never hardcode 31 |
| E6 | Leading zeros | Display and copy must preserve 8 chars (`00427193`). Warn that spreadsheets may strip them; export uses plain text, not CSV. Assumption: router accepts a leading zero — **open question** |
| E7 | Mid-month generation | Emit the full month, all days, in order. Optionally mark days < today as past; never reorder, truncate, or start at "today" |
| E8 | Old months / far future | Allow any month in a sane range (e.g. 2000–2100); generation must be identical to when it was first made. No "expired" state |
| E9 | Duplicate passwords | Allowed. Expected birthday collision within a month ≈ `C(31,2)/1e8 ≈ 4.7e-6`; across months similarly negligible. **Do not dedupe**: rejection changes the deterministic stream and adds state/complexity. Document that a repeat is not a bug (it may still alarm users — state it in the FAQ) |
| E10 | Seed changes | No stored seed ⇒ "changing" means typing a different one. Any change to seed, month, version, digit count or label yields a wholly different list; UI must invalidate the rendered list and exports on every edit |
| E11 | Seed typo (silent) | A typo yields a valid, plausible, wrong list. Mitigate with reveal, confirm field, normalisation, fingerprint/checksum, and "compare day 1 with your saved list" |
| E12 | Seed normalisation | Trim, collapse internal whitespace, Unicode NFKD, define case sensitivity (recommend case-insensitive for base32 codes via Crockford mapping, case-sensitive passphrases — must be documented). Separators (`-`, spaces) ignored on input, added on output |
| E13 | Recovery code corruption | Checksum + version + month embedded; reject with a specific message rather than generating a wrong list |
| E14 | Month with 31 days but seed code built for 30 | Not possible if month is embedded and validated; if not embedded, the month input governs — validate code/month pair |
| E15 | Clock wrong / time zone travel | Only affects the default month and today highlight, not correctness; user can override both |
| E16 | Rapid double-tap / regenerate | Disable button during generation; in random mode, confirm before discarding an unsaved list |
| E17 | Print/PDF | 31 rows fit one A4 page at readable size; month + seed fingerprint in the header; no seed itself on the printout unless explicitly chosen (recommended: fingerprint only) |
| E18 | Very slow device | KDF once per list (not per day) is acceptable; avoid 31 sequential KDF calls. Derive one 31-byte block or use a per-day counter derived from one base key |

### Privacy

What the host/CDN/network can see, by construction:

- IP address, coarse geolocation, ASN; TLS SNI (the domain); timestamps; User-Agent and
  Accept-Language headers; TLS fingerprint; requested paths and Referer; HTTP status and
  response size; possibly DNS queries (unless encrypted DNS).
- **Not** the seed, month, mode, or list — provided no user input is ever put in the URL, no
  `fetch`/`sendBeacon`/WebSocket is used, and the app makes no third-party requests.
- If the page is served through a CDN, the CDN terminates TLS and sees all of the above; it does
  not see plaintext inputs, but it can serve modified JS (see T8). Host access logs may retain
  IPs for days–months depending on provider (assumption; verify the specific host's policy).

Rules:

- Never place seed/month in query string, path, or hash. Hash is not sent to the server but is
  visible to browser history, extensions, and anyone the link is shared with — treat as unsafe.
- No cookies, no `localStorage`, no IndexedDB, no analytics, no error tracking that captures
  DOM/inputs, no third-party fonts/scripts/avatars. Self-host everything.
- Service-worker cache must be static assets only, with a clear "offline files, not your data"
  statement; provide a one-tap "clear site data".
- Privacy policy in one screen: "we collect nothing; the host sees standard request logs; the
  code is open; here is how to verify the build; here is the offline version."
- No claim of anonymity against the host/CDN — only data minimisation. Do not log IPs if the
  host allows disabling access logs.
- Referrer-Policy `no-referrer`; no outbound links that leak the page URL.

### Success criteria

For the cousin (personal workflow):

- S1 She can produce, save and start using a month's list in **under 3 minutes on a phone**, without help, on the first attempt.
- S2 On a later day she can read the correct password without ambiguity and without re-deriving anything.
- S3 If she loses the list, the recovery code (random mode) or her seed + month (seeded mode) reproduces it exactly.
- S4 She can hand the list to the person who needs it in the format they actually use (WhatsApp text / paper / screenshot) without reformatting.
- S5 Two independent generations with the same inputs produce byte-identical output (she can trust "the same code").
- S6 She never has to create an account, accept a cookie banner, or see an ad.

For a stranger (public utility):

- S7 The page states in one line what it does, what it does not do (not for online accounts), and how the seed/security works.
- S8 No network requests after load contain any input; verifiable in DevTools.
- S9 Works on a low-end Android browser and with JS enabled only; usable with a screen reader and keyboard.
- S10 The source and build are inspectable, and the hosted build hash matches the published release.
- S11 A security-literate visitor can read a threat model that accurately declines to protect against host compromise, device compromise, or handshake cracking.

Measurable gates: Lighthouse/a11y ≥ 95 (or axe clean), < 100 KB JS gzip, first load < 2 s on 3G, no console errors, deterministic test vectors published.

### Open questions

*(Do not invent answers — these need the cousin / router / host.)*

1. **Router constraints (R1):** does the admin UI accept exactly 8 numeric digits? Leading zeros?
   Any required letters/symbols or forbidden values? Does it reject repeats (e.g. same as
   previous)? Does changing it log out other devices?
2. **Cousin's literacies (R2):** comfort with a "seed/recovery code" vs a passphrase; phone OS and
   browser; does she use WhatsApp "message yourself", Notes, or paper? Does she print?
3. **Cadence (R3):** is "one password per calendar day" fixed, or does she sometimes skip days /
   change at a different time of day? Does the month always start on the 1st?
4. **Sharing (R4):** does anyone else need the list (family, guests)? If yes, is sending the
   recovery code acceptable, or only the derived list?
5. **Seed ownership (R5):** who chooses the seed — the user in this project, the cousin, or the
   app? Is a long-lived seed acceptable, or does she want a new one each month?
6. **Trust/hosting (R6):** who pays for and controls the domain/host? Is a public repo and
   published build hash acceptable? Is an offline single-file build needed?
7. **Scope of "public" (R7):** is the public site incidental (a place to host her tool) or is
   discoverability/support intended? Any abuse concerns about generating 8-digit numeric codes?
8. **Recovery expectations (R8):** if she loses both list and code, is "start over with a new
   seed" acceptable? (Assume yes unless told otherwise.)
9. **Time zone / today (R9):** should the app highlight "today", and does her router change
   happen at local midnight?
10. **Legal (R10):** any jurisdiction-specific disclaimer needed for a public password tool?

### Sources consulted

- `https://lesspass.com/` (fetch returned no content)
- `https://raw.githubusercontent.com/lesspass/lesspass/master/README.md` — stateless password manager, master password + site/counter model, offline/self-host posture
- `https://developer.mozilla.org/en-US/docs/Web/API/Crypto/getRandomValues` — CSPRNG in the browser, 65 536-byte quota, only Crypto member usable in insecure contexts
- `https://spectre.app/` — stateless derivation from name + secret + site, "information never leaves this page", open source/auditable positioning
- `https://github.com/lesspass/lesspass/blob/master/doc/algorithm.md` — 404 (path does not exist at that location)
- `https://bitwarden.com/help/generator/` — generator UX conventions: length/charset options, avoid-ambiguous, passphrase mode, generator history (a storage feature this product deliberately rejects)
- `websearch` attempted (`LessPass stateless password generator seed site counter`) → **HTTP 402**, unavailable.

*Assumptions marked in text: host log retention; router accepting leading zeros; cousin's export medium; "today" highlighting is optional. Nothing above asserts facts about the cousin or her router.*
