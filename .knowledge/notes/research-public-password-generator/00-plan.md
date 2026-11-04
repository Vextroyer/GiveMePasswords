---
id: research-public-password-generator-plan
created: 2026-11-04
type: research-plan
status: completed
parent: research-public-password-generator
tags: [research, plan, password-generator, deterministic, client-side, public]
---

# Research Plan — Public Client-Side Monthly Password Generator

## Problem

The user currently generates a monthly list of 8-digit Wi-Fi passwords on a phone and sends
it to a cousin. The cousin changes the router password daily. The new proposal is a
**publicly accessible website** that renders a monthly password list **on the client side**.
The cousin can copy the list to WhatsApp, Notes, or another storage place, or generate it
again later. The same capability is available to other users.

## Clarified model (user answers)

| Question | Answer |
|---|---|
| Who sets the router password daily? | **The cousin** |
| What should regeneration do? | **Two modes:** generate a random list, or generate a reproducible list from a seed phrase/code |
| Audience | **Both** personal and general public utility |
| Storage | **None** — everything client-side, server serves static files only |
| Plan | Approved as-is |

## Design hypothesis

The two modes can be unified: **every list is derived from a seed**.

- **Random mode** = generate a fresh random seed, derive the month's list, and show the seed
  as a **recovery code** the user can save.
- **Seeded mode** = enter an existing recovery code/passphrase and derive the same list for
  the same month.

Same seed + same month = same list. This gives reproducibility without server-side storage,
and it turns "generate a new one tomorrow" into "enter the same code." It also removes the
need for accounts, auth, and a database.

## Research questions

1. **RQ1 — Product model and requirements.** Walk through the intended flow; define
   "random" and "seeded" precisely; identify requirements, edge cases, threat model,
   privacy constraints, output policy, and success criteria.

2. **RQ2 — Deterministic vs random generation.** Seed derivation, KDF choices, seed
   strength and lifetime, per-month vs long-lived seeds, unbiased 8-digit mapping,
   canonical month/time-zone handling, algorithm versioning, and prior art (LessPass,
   Master Password, deterministic password managers).

3. **RQ3 — Security of a public client-side secret generator.** Supply-chain and JS
   tampering, CSP/SRI, reproducible builds, offline/PWA, CSPRNG use, seed handling, XSS,
   hosting integrity, and how users can verify the code.

4. **RQ4 — Delivery, storage, and UX.** Copy/download/print/Web Share/QR, where the list
   lives afterward, random-vs-seeded UI, seed entry and strength feedback, month handling,
   offline access, accessibility, and privacy.

5. **RQ5 — Prior art and public-utility viability.** Existing tools and gaps; free static
   hosting; SEO/discoverability; abuse/rate limits; privacy/legal; licensing; maintenance;
   support burden for a public audience.

## Method

- One note per question in this directory, each with context and sub-questions.
- One `scout` per question, run in parallel, ~60 seconds each.
- Scouts write findings into their note. The parent synthesizes.
- Final report: `.knowledge/notes/report-public-password-generator.md`.

## Carry-over from the previous research

- 8-digit numeric = **~26.6 bits**; weak against offline WPA2 cracking. The tool should not
  pretend otherwise.
- Daily rotation has a real operational cost (device reconnection, IoT, lockout).
- Recovery is a first-class requirement; a public stateless site cannot recover a lost seed
  for the user.

## Status

- [x] Plan approved
- [x] RQ1 scout
- [x] RQ2 scout
- [x] RQ3 scout
- [x] RQ4 scout
- [x] RQ5 scout
- [x] Synthesis — `.knowledge/notes/report-public-password-generator.md`
- [x] Pin end-to-end test vectors — verified in `.playground/hpg/` (Python + Node
      WebCrypto agree; RFC 5869 A.1 reproduces; rejection and passphrase paths pinned)

## Open design questions (to resolve in research)

- Should the recovery code be a random 128-bit token, a human passphrase, or both?
- Is the seed long-lived (all months) or per-month? What is the blast radius?
- How is the derivation versioned so a future algorithm change does not silently break
  reproducibility?
- What is the canonical month representation and time zone?
- Should the tool support configurable length/charset, or only 8-digit numeric?
- How does a public tool avoid becoming a supply-chain target for seed exfiltration?
