---
id: public-monthly-password-generator
created: 2026-11-04
modified: 2026-11-05
type: plan
status: active
expires: 2026-11-11
phases:
  - name: Foundation and derivation spec
    done: true
    goal: Freeze HPG-1 and the recovery-code contract, bootstrap the repo, and prove the derivation with cross-implementation test vectors.
  - name: Single-file app and UX
    done: true
    goal: Implement the complete two-door flow — create a list, save the recovery code, view/copy/print/share, and regenerate from the code.
  - name: Security, build, and deployment
    done: false
    goal: Produce a hardened, reproducible single-file artifact and deploy it to Cloudflare Pages with strict headers.
  - name: Verification, docs, and trust
    done: false
    goal: Prove the product works for the cousin and publish the threat model, privacy policy, FAQ, security policy, and QA evidence.
  - name: Public launch and maintenance
    done: false
    goal: Decide public vs. private, launch deliberately, and leave an owner and schedule for maintenance and algorithm versioning.
---

# Plan: Public Client-Side Monthly Password Generator

## Context

The research is complete: `.knowledge/notes/report-public-password-generator.md`.
The product is a **public, stateless, client-side generator** that derives a month of
8-digit Wi-Fi passwords from a seed. The cousin generates the list herself, saves it to
WhatsApp/Notes/paper, and applies each day's password to her router. The site is also
intended as a small public utility.

The repository is a research workspace, not an application repository:

- No commits, no remote, no CI, no `package.json`, no `Makefile`, no `src/`.
- `node v26.13.0`, `npm 11.20.0`, and `python3 3.15.2` are available on the host.
- `.playground/` is gitignored scratch space and must not be the shipping location.
- `.knowledge/notes/` contains the research and must not be overwritten.
- `docs/` is the convention for project documentation.

The research resolved the architecture and exposed the main traps. This plan turns those
findings into a build sequence.

### Decisions locked

| Decision | Value |
|---|---|
| Product model | One engine, two doors: **"Create a new list"** (app-generated seed + recovery code) and **"I have a recovery code"** (paste it). |
| Derivation | `HPG-1`: 16-byte seed, HKDF-SHA-256, explicit `YYYY-MM`, day `DD`, `attempt`, rejection sampling into `0..99,999,999`, zero-padded 8 digits. |
| Recovery code | Crockford Base32, 26 chars for 128 bits + 2-char checksum, `HPG1-` prefix, uppercase, hyphens/spaces ignored on input. **The month is not embedded.** Checksum = first 10 bits of `SHA-256("HPG1" || seed_bytes)`, encoded as 2 Crockford chars. Normalization maps `I`/`L` → `1`, `O` → `0`, strips separators, and rejects other characters. |
| Seed fingerprint | First 4 bytes of `SHA-256("HPG1|fingerprint" || seed_bytes)`, shown as 8 uppercase hex chars. It is a confirmation aid, not a secret. |
| Seed lifetime | **Long-lived seed by default**, with an explicit rotate action. Per-month codes are a v2 option. |
| Storage | **None.** No accounts, cookies, `localStorage`, IndexedDB, server state, analytics, or third-party requests. Seeds and lists live in memory only. |
| Output | Fixed 8 digits in v1. No configurable length, charset, or pattern avoidance. |
| List view | Full month by default, with today highlighted and per-day copy. Copy-all, print, file share, and TXT download. A "today only" view is a v2 option; the full month is the requested workflow, so it is the default despite the research suggesting a shorter window. |
| Ceremony | The recovery code must be shown and explicitly saved **before** the list is revealed. |
| Hosting | Cloudflare Pages, free `*.pages.dev`, no Functions, no custom domain required. |
| Artifact | One self-contained `index.html`, zero runtime dependencies, strict CSP, published SHA-256, offline copy. |
| Ordering | Month and day are explicit inputs; never inferred from the clock in the derivation path. Duplicates are accepted and documented (≈4e-6 per month); no dedupe. |

### Open decisions (gates for Phase 1)

1. **Router constraints:** exactly eight digits? leading zeros? rejects repeats? changing
   the Wi-Fi password logs out the admin session?
2. **Language:** English only, or English + Arabic/RTL?
3. **Seed lifetime confirmation:** is one long-lived code acceptable to the cousin, or does
   she prefer a new code each month?
4. **Public vs. private:** is the public utility a real goal, or is a private page enough?

If 1 is unknown, implement conservatively: allow leading zeros in the canonical string but
add an optional "first digit 1–9" generation mode for routers that reject them.

### Phase 1 resolution (2026-11-05)

| # | Decision | Resolution |
|---|---|---|
| 1 | Router constraints | **Deferred to Phase 4.** Default: canonical 8 digits with leading zeros allowed. The per-day primitive and list builder stay fixed; a "first digit 1–9" mode is an additive UX option and must not change `HPG-1` vectors. Test the real router in Phase 4 before launch. |
| 2 | Language | **English only in v1.** All UI strings live in `src/strings.js` (Phase 2) with no RTL-specific layout assumptions, so Arabic/RTL is additive later. |
| 3 | Seed lifetime | **Long-lived seed plus an explicit rotate action** (confirmed as the v1 default; cousin confirmation is a Phase 4 usability check, not a blocker). Per-month codes remain a v2 option. |
| 4 | Public vs. private | **Deferred to Phase 5.** Build so either works: `noindex`/`robots.txt` are a deployment switch, not an architecture change. |

Phase 1 outcome:

- [x] Spec is unambiguous and independently reproducible: `docs/spec-hpg-1.md`.
- [x] `make test` passes: RFC 5869 A.1, pinned vectors, the `2020-02-14` rejection case,
      full `2026-11` month, and code round-trip (21 tests).
- [x] `node --test test/` and `python3 tools/reference.py` agree byte-for-byte
      (`make cross-check`).
- [x] A recovery code round-trips through normalize → decode → derive → same list.
- [x] The four open decisions are answered or explicitly deferred with a default (above).
- [x] `test-vectors.json` is published and machine-checked by `test/vectors.test.mjs`.
- [x] The repo has baseline and feature commits; `make test` and `make cross-check` are green.

Not in Phase 1 (moved to their phases): `make build` and `src/index.html` (Phase 3 and
Phase 2 respectively). Phase 1 ships test/derive tooling only.

## Phases

### Phase 1: Foundation and derivation spec

**Goal:** Freeze `HPG-1` and the recovery-code format, bootstrap the repository, and prove
the derivation with two independent implementations before any UI exists.

**Deliverable:**
- `docs/spec-hpg-1.md` — version string, seed format, code format, normalization rules,
  month/day/attempt inputs, rejection rule, duplicate policy, versioning policy.
- `src/derive.js` — pure, dependency-free derivation functions using WebCrypto HKDF.
- `src/recovery-code.js` — Crockford Base32 encode/decode + checksum + normalization.
- `test/derive.test.mjs` and `test/recovery-code.test.mjs` using Node's built-in test runner.
- `test-vectors.json` — RFC 5869 A.1, pinned HPG-1 vectors, rejection case, full month,
  seed/month separation, code round-trip.
- `tools/reference.py` — the Python reference kept for cross-checking (not shipped).
- `package.json` (`"type": "module"`, `test`/`build` scripts), `Makefile` (`make test`,
  `make build`), `.gitignore`, `README.md` skeleton, initial commit.

**Done when:**
- [x] The spec is unambiguous enough that an independent implementer can reproduce the
      vectors without reading the app code.
- [x] `make test` passes: RFC 5869 A.1, all pinned vectors, the `2020-02-14` rejection case,
      full `2026-11` month, and code round-trip.
- [x] `node test/derive.test.mjs` and `python3 tools/reference.py` agree byte-for-byte.
- [x] A recovery code round-trips through normalize → decode → derive → same list.
- [x] The four open decisions are answered or explicitly deferred with a default.
- [x] The repo has an initial commit and a clean `git status`.

**Depends on:** nothing.

### Phase 2: Single-file app and UX

**Goal:** Implement the complete flow in a mobile-first single-page app, with the recovery
ceremony treated as a security control rather than a notification.

**Deliverable:**
- `src/index.html`, `src/app.js`, `src/style.css`, `src/strings.js` (externalized UI
  strings, so Arabic/RTL is possible later).
- A working app with:
  - Two doors: **Create a new list** / **I have a recovery code**.
  - Month picker defaulting to the current local month, but always explicit and
    user-confirmed; the month is repeated in the header and every export.
  - Random mode: `crypto.getRandomValues(16)`, derive, show the recovery code in a
    blocking ceremony (copy + download + "I have saved this code"), then reveal the list.
  - Seeded mode: paste the code, show a seed fingerprint, derive; a wrong-but-valid code
    produces a plausible list with a warning, so the fingerprint is visible.
  - List table: day, weekday, password; today highlighted; per-day copy; copy-all; print
    stylesheet; `navigator.share` with a file when supported; TXT download.
  - A "rotate code" action that generates a new seed and warns that old lists are no longer
    derivable from the new code.
  - Empty, error, and "code checksum failed" states; no silent failures.
  - No persistence of the seed or list; clearing on "Done" and on reload.
  - An inline data-URI favicon so the page makes no favicon request.
  - Accessibility: semantic table with caption/headers, labels, keyboard navigation,
    44 px targets, visible focus, `aria-live` confirmations, no color-only meaning.

**Done when:**
- [x] On a phone-sized viewport, a first-time user can create a month and save the code in
      under 3 minutes without help. *(Implemented; human test scheduled in Phase 4.)*
- [x] Re-entering the saved code reproduces the same month byte-for-byte.
- [x] A different month with the same code produces a different list.
- [x] The list is not revealed until the recovery-code ceremony is completed.
- [x] The seed/code is never present in the URL, `localStorage`, `sessionStorage`,
      IndexedDB, cookies, or the printout (unless the user explicitly opts in).
- [x] DevTools shows **zero network requests** after the initial load, including fonts,
      images, QR services, and analytics. *(Static policy test; browser check in Phase 4.)*
- [x] The 15 UX failure modes in
      `.knowledge/notes/research-public-password-generator/04-delivery-storage-ux.md`
      are each either mitigated or explicitly accepted in a checklist.

Phase 2 outcome (2026-11-05):

- Files: `src/index.html`, `src/app.js`, `src/style.css`, `src/strings.js`, plus the
  DOM-free `src/session.js` added so the flow could be tested without a browser.
- Tests: `test/app-policy.test.mjs` enforces no storage, no network, no HTML injection,
  no URL leakage, local-only imports, semantic structure, and externalized strings;
  `test/session.test.mjs` covers month/session assembly and text export. Total suite: 42.
- A throwaway DOM shim in `.playground/smoke-dom.mjs` exercised landing → create →
  ceremony gate → list → copy/download/print → start over → restore → rotate → bad
  checksum. It is not committed; it is a development check.
- Deferred to Phase 4 (needs real browsers/devices): 3-minute usability test, screen
  reader, 200% zoom, Lighthouse, real share sheet, A4/Letter print, offline file copy.
- UX mapping: `docs/ux-checklist.md`.

**Depends on:** Phase 1.

### Phase 3: Security, build, and deployment

**Goal:** Produce a hardened, reproducible single-file artifact and put it on the public
internet with the correct headers and an offline copy.

**Deliverable:**
- `scripts/build.mjs` — inline CSS/JS into `dist/index.html`, compute CSP hashes for the
  inline script/style, compute SHA-256, write `dist/SHA256SUMS`, and fail if any external
  URL, `eval`, or `innerHTML` assignment is found in the **built artifact**.
- `dist/_headers` (or `public/_headers`) — CSP with the generated hashes, HSTS,
  `Referrer-Policy: no-referrer`, `X-Content-Type-Options: nosniff`, `Permissions-Policy`,
  `Cache-Control`.
- `dist/index.html` and `dist/SHA256SUMS` — **committed to the repo** so the served artifact
  is exactly the reviewed artifact.
- A Cloudflare Pages project connected to the repo, build command `make build`, output
  directory `dist`; production URL on `*.pages.dev`.
- `make verify-build` — rebuild from a clean checkout and diff the artifact + hash against
  the committed `dist/` copy.

**Done when:**
- [x] `make build` produces one `index.html` with no external requests and no unresolved
      placeholders.
- [x] `make verify-build` passes from a clean checkout (same bytes, same hash).
- [ ] The deployed URL serves over HTTPS and returns the expected CSP and security headers
      (`curl -I` evidence). *(Blocked: no Cloudflare account or git remote.)*
- [ ] The browser console shows no CSP violations and no mixed-content warnings. *(Needs the
      deployed URL or a local server in a real browser.)*
- [ ] The published `SHA256SUMS` matches the deployed artifact. *(Blocked with deployment.)*
- [ ] An offline copy of `index.html` works when opened from `file://` in at least one
      Chromium browser and one WebKit browser, or the limitation is documented. *(Limitation
      documented in `docs/deployment.md`; device check pending.)*
- [ ] Cloudflare preview deployments are either disabled or clearly marked as non-production.
      *(Blocked with deployment.)*

Phase 3 outcome (2026-11-05):

- `scripts/build.mjs` bundles the ES-module graph into one classic script, inlines the
  stylesheet, pins CSP hashes for the exact inline style and script, writes `_headers`
  (CSP, HSTS, `no-referrer`, `nosniff`, frame denial, Permissions-Policy, Cache-Control),
  computes `SHA256SUMS`, and refuses to emit an artifact containing external URLs,
  `eval`, `innerHTML`, dynamic imports, storage APIs, or network APIs.
- `test/build.test.mjs` (7 tests) checks self-containment, module order, the no-persistence
  and no-network policy in the artifact, CSP hash correctness, header presence, the
  checksum format, and byte-for-byte determinism. Total suite: 49 tests.
- `dist/index.html`, `dist/_headers`, and `dist/SHA256SUMS` are committed.
  Current hash: `d4b89db74d6bed04db78b7e4e48931508e46f6638800bcd1277eb790068f49c8`.
- `make verify-build` rebuilds into `.build/verify` and diffs against `dist/` successfully.
- The built bundle was exercised through the throwaway DOM shim (create → ceremony gate →
  list → restore → rotate → error), not just the source modules.
- Deployment instructions and verification commands: `docs/deployment.md`.
- Remaining work is external: create the Pages project, push to a remote, deploy, and run
  the header/console/offline checks on real devices.

**Depends on:** Phase 2.

### Phase 4: Verification, docs, and trust

**Goal:** Prove the product works for the real user and publish enough documentation that a
stranger can decide whether to trust it.

**Deliverable:**
- `docs/threat-model.md`, `docs/privacy.md`, `docs/faq.md`, `docs/verification.md`,
  `SECURITY.md`, `CHANGELOG.md`, `LICENSE` (MIT or Apache-2.0), and a finished `README.md`.
- A QA record: browser/device matrix, print test, screen-reader pass, 200% zoom, keyboard-only
  pass, Lighthouse scores.
- A cousin usability record: first run, recovery run, wrong-seed run, leading-zero run.
- A router compatibility record: 8 digits accepted, leading zero accepted or not, repeat
  policy, admin session behavior.

**Done when:**
- [ ] The cousin completes the full flow unaided and recovers a list from the code in a
      fresh browser.
- [ ] The router accepts the generated format; if leading zeros fail, the safe generation
      mode is enabled and documented.
- [ ] Print output fits one A4/Letter page, preserves leading zeros, and includes the month
      and seed fingerprint but not the seed itself.
- [ ] Keyboard-only and screen-reader passes are recorded; Lighthouse accessibility ≥ 95.
- [x] The threat model states the residual risks plainly: host compromise, browser
      extensions, device compromise, 8-digit entropy, no recovery.
- [x] The privacy policy says what the host logs and what the app does not collect.
- [x] `make test` and `make build && make verify-build` are green from a clean checkout.
- [x] No P0/P1 issues remain open in the implementation. *(No live-user or router issue can
      be known until the external checks run.)*

Phase 4 outcome (2026-11-05):

Documentation and trust artifacts are complete and committed:

- `docs/threat-model.md`, `docs/privacy.md`, `docs/faq.md`, `docs/verification.md`,
  `docs/qa-record.md`, `docs/router-compatibility.md`, `docs/usability-record.md`,
  `SECURITY.md`, `CHANGELOG.md`, `LICENSE` (MIT), and the finished `README.md`.
- `package.json` version is `0.1.0`, the first public release candidate; the changelog
  records it as the initial release (there was no earlier public version).
- The threat model and privacy policy explicitly cover host logs, chat/cloud backups,
  clipboard history, browser extensions, device compromise, the ≈26.6-bit entropy, and the
  absence of recovery or forward secrecy.
- `docs/qa-record.md` lists the automated evidence (49 tests, Python cross-check,
  byte-identical rebuild, built-bundle DOM flow) and the full pending manual matrix.
- `docs/usability-record.md` is the ready-to-run four-part test script; results, not just
  the script, are still required for sign-off.
- `docs/router-compatibility.md` is the ready-to-fill router policy and change-operation
  record, including the leading-zero and admin-logout questions.

Still external and blocking Phase 4 completion:

- Cloudflare Pages deployment (no account, no git remote) and the live header/hash checks.
- Real-browser and device QA: keyboard, screen reader, 200% zoom, Lighthouse, print,
  share sheet, offline `file://`.
- The cousin usability runs and the router record.
- The public/private launch decision is Phase 5.

**Depends on:** Phase 3.

### Phase 5: Public launch and maintenance

**Goal:** Make the public/private decision deliberately, launch only what can be maintained,
and freeze the algorithm so old lists keep working.

**Deliverable:**
- A launch decision record (public utility vs. personal/private page).
- If public: indexed landing/FAQ, canonical URL, `robots.txt`/sitemap, optional custom
  domain, support channel, `security.txt`, and i18n/RTL if the audience needs it.
- If private: `noindex`, no sitemap, and a distribution plan limited to the cousin.
- A maintenance contract: owner, quarterly browser smoke test, annual review, dependency
  policy (zero runtime dependencies), security disclosure path, and a versioning policy
  (`HPG-1` frozen forever; future changes are `HPG-2` with migration notes).
- A post-launch review date (3–6 months) and a decision rule: if there is no real audience,
  keep it private and stop investing in public-utility work.

**Done when:**
- [ ] The public/private decision is recorded with the reasoning.
- [ ] The chosen launch surface is live and the other surface is explicitly disabled.
- [ ] `HPG-1` is documented as frozen; `test-vectors.json` is part of the public repo.
- [ ] The maintenance owner, schedule, and disclosure path are written down.
- [ ] A post-launch review date is set and the success criterion is stated (a few hundred
      grateful users, not growth).
- [ ] The app displays its version and build hash, and the hash matches the release.

**Depends on:** Phase 4.

**Decision status (2026-11-05):** the public/private launch surface and the
post-launch review date are deliberately **not decided here**. They belong to a
separate research/design step after the external Phase 4 gates (deployment,
real-device QA, cousin usability, router record). Do not add indexing files,
`security.txt`, or a canonical URL until that step chooses a surface and a
canonical host.

## Success Criteria

The plan is complete when:

1. A stranger can open the public URL, create a month, save the recovery code, and
   regenerate the same list later without an account or any server-side state.
2. The cousin can do the same on her phone, unaided, in under 3 minutes, and can recover
   from a lost list using the code.
3. The deployed artifact is a single HTML file with zero runtime dependencies, zero
   third-party requests, strict CSP, a published SHA-256, and an offline copy.
4. The derivation is frozen, versioned, cross-implemented, and covered by published test
   vectors including the rejection path.
5. The documentation states the real security properties and the real limits: no server
   secret, no authentication, no revocation, no recovery, 8-digit entropy, host-compromise
   residual risk.
6. The public/private decision and the maintenance owner are explicit, and old lists remain
   reproducible.

## Out of Scope (v1)

- Accounts, sync, server-side storage, or sharing links that contain the seed.
- Configurable length, charset, or pattern avoidance (fixed 8 digits).
- Human-memorable passphrase mode (`HPG-1P`) — the 26-character recovery code is the
  "seed phrase" in v1; a passphrase mode is a v2 feature with its own version and vectors.
- Service worker/PWA, push reminders, email delivery, or native apps.
- Analytics, error tracking, third-party fonts, CDNs, QR services, or PDF libraries.
- A custom domain (optional in Phase 5, never required for the architecture).
- Claims that the tool protects against WPA handshake cracking, host compromise, device
  compromise, or browser extensions.

## Risks & Mitigations

| Risk | Likelihood | Mitigation |
|---|---|---|
| Router rejects leading zeros, 8 digits, or repeats | Medium | Test in Phase 1/4 before launch; add a "first digit 1–9" generation mode; document the router's exact behavior. |
| Cousin loses the recovery code and is locked out | High | Blocking ceremony, copy + download + print, "I have saved this code" gate, a recovery drill in Phase 4, and a recommendation to store it in a password manager. |
| Host or dependency compromise exfiltrates seeds | Medium | Zero runtime dependencies, single-file artifact, strict CSP, published hash, signed release, offline copy, no analytics. State the residual risk plainly. |
| User picks the wrong month or mistypes a seed | High | Month repeated in header/copy/filename/print; seed fingerprint after entry; checksum on the code; "compare with your saved copy" guidance. |
| UX is too complex for a non-technical user | Medium | Two doors, plain language, <3-minute usability test, no "seeded/random" jargon, no settings in v1. |
| Public utility attracts phishing clones or support burden | Medium | Canonical URL, documented verification ladder, no analytics, a clear "we cannot recover your seed" FAQ, and a deliberate public/private decision. |
| Browser differences (`crypto.subtle`, `file://`, iOS Share/Download) | Medium | Feature detection, fail closed, HTTPS-only for seeded mode, browser matrix, offline limitation documented, no service worker in v1. |
| Overclaiming security for 8-digit codes | High | On-page disclaimer, WPA3/long-passphrase recommendation, "not for email/banking", no marketing language about "secure". |
| Scope creep (configurable length, accounts, sync) | Medium | v1 is fixed 8 digits, no storage, no accounts; future features require a new version and a new research pass. |
| Stale deployments, preview URLs, or caches serve an old build | Low | Production branch only, `Cache-Control` on HTML, version + build hash in the app, `make verify-build`, previews disabled or marked. |
| Repository has no baseline commit or remote | Low | Phase 1 creates the initial commit and `.gitignore`; Phase 3 connects Cloudflare Pages; no history rewrite. |

## Related

- Research report: `.knowledge/notes/report-public-password-generator.md`
- Research notes: `.knowledge/notes/research-public-password-generator/`
- Pinned vectors and references: `.playground/hpg/` (scratch; copy the vectors into
  `test-vectors.json`, do not ship the directory)
- Prior research on the underlying Wi-Fi problem:
  `.knowledge/notes/report-router-password-site.md`
- No issue tracker exists in this repo; Phase 1 creates the initial commit and Phase 5
  records the maintenance owner.
