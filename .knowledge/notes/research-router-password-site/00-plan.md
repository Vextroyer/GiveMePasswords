---
id: research-router-password-site-plan
created: 2026-11-04
type: research-plan
status: completed
parent: research-router-password-site
tags: [research, plan, wifi, passwords, hosting, auth]
---

# Research Plan — Monthly Wi-Fi Password Delivery

## Problem

The user's cousin changes her **Wi-Fi password daily**. The user currently generates
**8-digit numeric** passwords for the entire month and sends the list via **WhatsApp**.
The user wants an internet-accessible page that shows the month's passwords and is
visible only to the cousin, without knowing how to obtain a domain or host a site.

## Scope decisions from the user

| Question | Answer |
|---|---|
| Which password? | **Wi-Fi password** (not router admin) |
| Adversary | Casual neighbor/visitor **and** someone who knows her personally |
| Budget | **Free only** — no custom domain, no paid hosting |
| Plan | Approved as-is |

## Research questions

1. **RQ1 — Requirements, threat model, and the value of daily rotation.**
   What is really being protected, from whom, and does daily 8-digit rotation improve
   security or just add operational cost? Includes entropy analysis (10^8 ≈ 26.6 bits),
   WPA2 offline cracking, WPA3-SAE, device reconnection, and lockout risk.

2. **RQ2 — Is a website the right vehicle?**
   Compare a protected static site, a serverless app, a shared password manager, an
   encrypted note/file, scheduled messaging, and a "keep WhatsApp" baseline.

3. **RQ3 — Hosting and domain options (free only).**
   Cloudflare Pages/Workers, Netlify, Vercel, GitHub/GitLab Pages, Firebase, Render.
   Verify whether Cloudflare Access can protect a free `pages.dev` / `workers.dev`
   hostname without a custom domain. Document limits, TLS, and setup effort.

4. **RQ4 — Authentication for exactly one user.**
   Cloudflare Access (email OTP / Google), passkeys/WebAuthn, client-side encryption
   (StatiCrypt-style), magic links, basic auth, secret URLs, VPN/Tailscale, password
   managers. Security properties, UX, and recovery failure modes.

5. **RQ5 — Secret lifecycle and operations.**
   CSPRNG generation, storage/encryption, leak surfaces (static HTML, repo, logs,
   cache), publishing cadence, exposure window, revocation, delivery of the access
   credential, and emergency access if the user is unavailable.

6. **RQ6 — Reference blueprint (conditional).**
   Only if a website wins: the simplest defensible free architecture, step-by-step
   setup, cost, and maintenance.

## Method

- One note per question in this directory, each with context and sub-questions.
- One `scout` per question, run in parallel, ~60 seconds each.
- Scouts write findings into their note. The parent synthesizes.
- Follow-up scouts may be launched for gaps.
- Final report: `.knowledge/notes/report-router-password-site.md`.

## Status

- [x] Plan approved
- [x] RQ1 scout
- [x] RQ2 scout
- [x] RQ3 scout
- [x] RQ4 scout
- [x] RQ5 scout
- [x] Synthesis — `.knowledge/notes/report-router-password-site.md`
- [ ] RQ6 (conditional) — deferred; the research found no unconditional
      website recommendation. A blueprint only makes sense after the user chooses
      between StatiCrypt (free), Cloudflare Access (needs a domain), and Bitwarden.

## Operational note

`websearch` returned HTTP 402 on initial probes. Scouts should fall back to `webfetch`
against official documentation and reputable sources, and must report which URLs they
used. Claims without a source should be marked as inference.
