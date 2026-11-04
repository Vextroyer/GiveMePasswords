---
id: rq2-solution-space
created: 2026-11-04
type: research-note
status: active
parent: research-router-password-site
question: "Is a website the right vehicle, compared with password managers, encrypted notes, and messaging?"
tags: [alternatives, password-manager, architecture]
---

# RQ2 — Is a website the right vehicle?

## Context

- The asset is the **Wi-Fi password**, not the router admin password.
- The cousin changes it **daily**; the user generates **8-digit numeric** passwords for
  the whole month and sends the list via **WhatsApp**.
- Desired outcome: an internet-accessible page showing the month's passwords, visible
  only to her.
- Threat model: **casual neighbor/visitor** and **someone who knows her personally**.
- Budget: **free only**.
- The user is not attached to the website idea; it was an initial thought.

## Sub-questions

1. Enumerate the solution classes:
   - protected static site (auth at the edge)
   - serverless app with login
   - shared password-manager vault (Bitwarden, 1Password, Proton Pass, Vaultwarden)
   - encrypted note/file (age/GPG, StatiCrypt, CryptPad, PrivateBin)
   - scheduled or automated messaging (WhatsApp, email, Signal)
   - physical/offline (printed card, sealed envelope)
   - secret-link / one-time-secret services
   - VPN / Tailscale to a home server
2. For each: how does the cousin access it, what authenticates her, what is the monthly
   maintenance, what does it cost, and how does it fail?
3. Which options are genuinely free for one user?
4. Which best fit "one trusted, possibly non-technical user, anywhere, monthly list"?
5. What are the privacy and security trade-offs of storing a whole month of Wi-Fi
   passwords in each option?
6. Is a website actually less work than WhatsApp once a month? What work does it remove
   and what work does it add?
7. Recommend the top 2-3 options with rationale, including a "keep WhatsApp" baseline.

## Scout brief

Focus on concrete, current product capabilities and free-tier limits. Verify claims
against official pricing/feature pages. Distinguish "technically possible" from
"realistic for a non-technical user."

## Findings (scout output)

### Summary

- **A website does not remove the monthly work; it relocates it.** WhatsApp costs one action per month (paste list, send). A site costs one action per month *plus* build/encrypt/deploy, auth administration, and a recovery path. It buys **retrieval quality** (stable URL, formatted table, no scrolling) and **revocation** (change passphrase, unpublish) — not labour savings.
- With **one** recipient, the delivery savings of a site are ~zero. The case for a site is therefore about *how the list is read and withdrawn*, not about effort.
- **The asset is low-value and self-expiring.** Wi-Fi passwords are handed to visitors by design, and yesterday's password is useless once the router rotates. Only *today's* password is sensitive. Elaborate authentication is likely over-engineering for the stated threat model (casual neighbour/visitor; someone who knows her personally).
- **Genuinely free and realistic:** Bitwarden free (two users can share via a free Organization), StatiCrypt on free static hosting, CryptPad free public instance, Tailscale Personal (free up to 6 users), PrivateBin/one-time links, physical card. **Not free:** 1Password (no free plan), Proton Pass vault sharing (Pass Plus only), Vaultwarden (free software, but needs a server).
- **Best fit if persistence is wanted:** Bitwarden free shared vault — real per-user auth, no monthly re-publish, one-time onboarding. **Best fit if a page is non-negotiable:** StatiCrypt on free static hosting with a long, stable passphrase. **Baseline:** keep WhatsApp (or move to Signal).

### Comparison table

| Class | Access & authentication | Monthly maintenance | Cost for one user / free-tier reality | Failure modes | Fit for non-technical user |
|---|---|---|---|---|---|
| **Baseline: WhatsApp list** | Existing chat; auth = phone possession + WhatsApp account; E2EE in transit | Generate ~30 passwords, paste, send. ~2–5 min | $0, already installed | Message buried in scrollback; no expiry/revocation; history on device and in backups; phone unlocked/shoulder-surfed; screenshot/forward | **Excellent** — already mastered |
| **Protected static site behind auth proxy** (Cloudflare Access / Netlify Identity) | URL + email OTP or SSO at edge; page behind proxy | Build page, update list, deploy, manage allowed identity, renew config | Hosting free; edge auth free tier exists (seat cap not re-verified here) | Misconfigured policy exposes page publicly; OTP email friction; deploy forgotten; vendor free-tier change | **Poor** — setup and recovery are admin work; cousin sees a login she did not ask for |
| **Serverless app with login** (Workers/Vercel + Auth0/Clerk) | URL + account, session cookie, password reset | Deploy, rotate secrets, patch deps, manage user, monitor quota | Free tiers exist but identity vendors cap MAU and add ToS/limits | Auth outage locks her out; abandoned project bit-rot; reset flow needs email; most moving parts | **Very poor** — highest complexity, no benefit at one user |
| **Shared password-manager vault** (Bitwarden free) | Bitwarden app/web; email + master password, 2FA available free | Edit one secure note/item; no re-deploy | **$0**: free plan includes unlimited passwords/devices and sharing with one other user via a Free Organization | Master password loss is unrecoverable (zero-knowledge); invite/org confusion; she must install/learn an app | **Good after onboarding** — one-time setup, familiar "vault" model |
| **Proton Pass free** | Proton account; app/web | Edit note | Free: unlimited logins/notes/devices — but **vault sharing is Pass Plus**, so free cannot share a vault | Same as above, plus sharing gate; using one shared account is bad practice | **Poor at $0** for two people |
| **1Password** | Account + Secret Key; app/web | Edit item | **No free plan** (per Proton's comparison table) — budget excludes it | Subscription lapse; account/recovery complexity | Good UX, irrelevant on free-only budget |
| **Vaultwarden (self-hosted)** | Self-hosted Bitwarden-compatible server; own URL + account | Patch server, TLS, backups, uptime | Software free; needs VPS (not free) or already-owned always-on hardware + electricity | Server down = no access; backup loss = vault loss; TLS expiry; you are the sysadmin | **Very poor** unless a technical third party runs it |
| **Encrypted note/file: StatiCrypt** | Static HTML URL + one page passphrase; AES-256 WebCrypto, decrypted in browser | Re-encrypt and re-upload each month; keep salt stable for "remember me"; redistribute URL/passphrase | **$0** (MIT; GitHub Pages/Netlify free) | Offline brute force possible if passphrase weak (README recommends 16+ alphanum); one password per page; `--share` link embeds a password hash in the URL fragment, making the link itself a bearer credential; stale deploy | **Good for reading** (type password → page), **poor for publishing** (CLI/CI each month) |
| **Encrypted note/file: CryptPad** | Share link (key in fragment); optional account; free public instance | Edit the doc in place; link stays stable | **$0** free account on a public instance; paid plans add storage/support | Link is the secret — forwarding or shoulder-surfing exposes it; instance retention/availability not guaranteed; account recovery | **Good** — Google-Docs-like editor, no publish step |
| **Encrypted note/file: PrivateBin** | Paste URL (+ optional password); zero-knowledge AES-GCM | Create a new paste each month and send the new link | **$0** on public instances | Expiry/burn-after-read conflicts with daily lookup; instance may vanish; new link each month = same work as WhatsApp; URL fragment is the key | **Fair** — simple to read, awkward to reuse |
| **age/GPG file** | File + key/passphrase; requires tooling | Re-encrypt and resend | $0 software | Cousin must install/use CLI or a GPG-capable client; key management | **Unusable** for non-technical |
| **Scheduled/automated messaging (email)** | Inbox; email account auth | Schedule/compose once a month | $0 (Gmail/Proton free) | Passwords persist in inbox and backups; forwarding; account takeover; no revocation | **Good** — but no better than WhatsApp, and weaker privacy |
| **Scheduled/automated messaging (Signal)** | Signal app + phone number | Manual send (no official scheduled send) | $0 | Same as WhatsApp with better privacy defaults; needs app install | **Good** if she already uses it |
| **Automated WhatsApp** | WhatsApp account | Script/tooling | No official free personal automation; unofficial automation risks a ban | ToS violation, ban, breakage | **Not viable** |
| **Physical/offline (printed card, sealed envelope)** | Hand delivery / mail; auth = physical possession | Print new card, deliver | ~$0 | Lost/photographed card; not accessible while away; no revocation; manual handoff | **Excellent** if local, but fails the "anywhere" requirement |
| **Secret-link / one-time-secret** (OneTimeSecret, Yopass, Bitwarden Send) | Bearer URL, often burn-after-read | New secret + new link each month | $0 tiers exist (Bitwarden Send included in free account; file attachments are Premium) | Burn-after-read defeats daily lookup; link in chat = secret in chat; sender must re-send monthly | **Fair** for one-time handoff, **poor** for a monthly reference list |
| **VPN / Tailscale to home server** | Tailscale app + identity login (Google/email/SSO); then internal page | Keep server patched and powered; manage tailnet ACLs | **$0** Tailscale Personal: free forever, up to 6 users, unlimited user devices; server/electricity extra | Home power/internet down; app install + login is the hardest onboarding; ACL mistake exposes service; hardware failure | **Very poor** — two-layer setup for a non-technical user |

### Does a website remove work, or move it?

**It moves it, and adds some.** Concretely, per month:

| Task | WhatsApp | Static site | Serverless app | Bitwarden vault |
|---|---|---|---|---|
| Produce the 30 passwords | yes | yes | yes | yes |
| Publish/deliver | paste + send | build + encrypt + upload + maybe update link | deploy | edit one note |
| Auth administration | none | allow-list identity, OTP support | accounts, resets, secrets | none |
| Failure recovery | "resend message" | redeploy, reissue passphrase | debug deploy/auth | "resend invite" / master password (unrecoverable) |
| Reader effort | open chat, scroll | open URL, type passphrase | open URL, log in | open app, unlock vault |

The site wins on **reader effort** and **findability**, and on **revocation** (you can change the page passphrase or unpublish; you cannot un-send a WhatsApp message). It loses on **publisher effort** and **reliability surface**. For a single recipient and a monthly cadence, that trade is roughly neutral-to-negative on labour and positive only on retrieval/revocation.

A key nuance: because the router rotates daily, a leaked *past* list is nearly worthless. That argues for **proportionate** protection (a bearer link or a shared vault) rather than building an auth system. Conversely, the "someone who knows her personally" threat is mostly a **unlocked-phone** threat, which defeats WhatsApp, a remembered site login, and a bearer link equally; only a separate vault credential with its own lock/2FA meaningfully raises the bar.

### Evidence (URLs used)

Verified against official pages during this scout:

- **StatiCrypt** — <https://github.com/robinmoisson/staticrypt>: MIT; AES-256 + WebCrypto, in-browser decryption, no backend; recommends 16+ alphanumeric passphrase because the ciphertext is public and offline brute force is cheap; **one password per page**; `--remember` stores salted+hashed password in localStorage; `--share` produces `#staticrypt_pwd=<hash>` auto-decrypt links (bearer credential); works on GitHub Pages/Netlify. Verified.
- **Bitwarden pricing** — <https://bitwarden.com/pricing/>: free account includes unlimited devices/passwords, "Advanced two-step login", and "Free sharing with another user"; Premium $1.65/mo (annual), Families $3.99/mo for 6. Free Organization sharing with one other existing user is explicitly described. Verified.
- **Proton Pass** — <https://proton.me/pass>: Free = unlimited logins/notes/credit cards, unlimited devices, apps, aliases (10), passkeys; **"Secure vault sharing" and "Secure link sharing" are listed only under Pass Plus**. Verified. (Proton's own comparison table lists 1Password free plan = "No" and Bitwarden free = "Yes"; competitor claim, but consistent with 1Password's page.)
- **1Password pricing** — <https://1password.com/pricing>: page now fronts enterprise pricing; no personal free tier surfaced. Personal free plan absence corroborated by Proton's comparison table. Verified absence on this page; "no free plan" is a competitor-sourced claim.
- **CryptPad** — <https://cryptpad.org> and <https://cryptpad.org/pricing/>: E2EE, open source; free account on a public instance; paid plans add storage/support; self-hosting possible; no account needed for some sharing flows. Verified. (The often-quoted 1 GB free quota is *not* stated on the pricing page — treat as unverified.)
- **PrivateBin** — <https://privatebin.info>: zero-knowledge pastebin, AES-256-GCM in browser; optional password; expiry incl. "forever" and burn-after-read; key lives in the URL fragment; must trust the instance operator not to serve malicious JS; access logs may exist. Verified.
- **Tailscale** — <https://tailscale.com/pricing>: Personal plan $0 free forever, up to **6 users**, unlimited user devices, 3 ACL groups, Funnel available. Verified.
- **Web search** — `websearch` returned **HTTP 402**; no search results were used.

Inference (not directly verified here): Cloudflare Zero Trust / Netlify Identity free seat caps; Bitwarden Send free vs Premium file limits; WhatsApp backup encryption defaults; CryptPad per-link password protection specifics; Proton Pass free plan's exact sharing behaviour beyond the pricing page.

### Recommendation (top 2–3 + baseline)

1. **Baseline — keep WhatsApp (or switch to Signal).** Lowest total work, already installed, E2EE, adequate for "casual neighbour/visitor" if the phone has a lock screen and the chat is archived/pinned. Add a **PIN/pattern + 2FA on WhatsApp** and consider turning on E2EE chat backups. This is the honest default; a site must beat it on retrieval or revocation to be worth building.
2. **If persistent, on-demand access is the real requirement — Bitwarden free shared vault.** Create a free Organization, invite her, put the month's list in one secure note. Real per-user authentication, no monthly re-publish, works on phone and web, $0 for two users. Cost: a one-time onboarding and an unrecoverable master password (make her save a recovery kit).
3. **If a "page" is non-negotiable — StatiCrypt on free static hosting, with a long stable passphrase and "Remember me".** She gets URL + passphrase once; you re-encrypt and upload monthly. Avoid `--share` links (they embed a password hash and turn the link into the secret). CryptPad is the lower-maintenance variant of the same idea: edit in place, stable link, no deploy — at the cost of the link itself being the secret.
4. **Not recommended for this case:** serverless app with login (most moving parts, zero benefit at one user), VPN/Tailscale (hardest onboarding, home-power dependency), 1Password (no free tier), Proton Pass free (no vault sharing), Vaultwarden unless someone else administers it, and automated WhatsApp (ToS/ban risk).

### Open questions

- Is the list needed **on demand all month**, or is a single monthly delivery enough? (If the latter, WhatsApp/physical wins outright.)
- Is the cousin **local** (physical card viable) or remote? Does she need access while travelling?
- Does she already use **any password manager**, and does she have a device with a lock screen / 2FA?
- Is the monthly list **generated manually** by her, or could the router/script publish it automatically? Automation at the source would change the maintenance calculus more than any delivery channel.
- Is a **stable passphrase** acceptable, or must it rotate monthly? Rotation breaks StatiCrypt "remember me" and adds a second channel to share the new passphrase.
- Verify current free-tier caps for **Cloudflare Access**, **Netlify Identity**, and **Bitwarden Send** before committing to edge-auth or Send-based designs.
- Would a **PDF/image table in WhatsApp** capture most of the retrieval benefit (formatted, scrollable, no login) at zero added infrastructure? This is the cheapest "website-like" improvement and should be tested against the baseline.
