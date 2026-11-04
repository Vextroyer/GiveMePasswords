---
id: rq4-authentication
created: 2026-11-04
type: research-note
status: active
parent: research-router-password-site
question: "What is the best free authentication method for exactly one non-technical user?"
tags: [authentication, cloudflare-access, passkeys, encryption]
---

# RQ4 — Authentication for exactly one user

## Context

- Only the cousin should see the passwords. Threat model: casual neighbor/visitor and
  someone who knows her personally.
- She may be non-technical and may access from a phone, from anywhere.
- Budget: free only.
- The access credential (not the Wi-Fi passwords) must reach her securely.

## Sub-questions

1. **Cloudflare Access:** free-tier limits, email one-time PIN, Google login, session
   duration, single-email policies, revocation, recovery. Does it work on free
   hostnames? (Coordinate with RQ3.)
2. **Client-side encryption** (StatiCrypt/PageCrypt style): how it works, which crypto,
   passphrase strength, offline brute-force risk, UX, logout, sharing. Can it be hosted
   on any free static host?
3. **Passkeys/WebAuthn:** availability, UX, recovery, and whether free static hosting or
   Cloudflare Access can enforce them.
4. **Magic links, basic auth, secret URLs, VPN/Tailscale, password managers:** security
   properties, UX, and failure modes. Why is a secret URL not authentication?
5. **Recovery is usually the weakest link:** what happens if she loses her phone, loses
   access to her email, or someone who knows her can reset her accounts?
6. **Brute-force resistance:** rate limiting, lockout, and offline guessing for each
   option.
7. Which method gives the best security/UX trade-off for one non-technical user at zero
   cost? State the residual risks plainly.

## Scout brief

Verify current Cloudflare Access free-tier behavior from official docs. For client-side
encryption, inspect the actual project/docs (StatiCrypt or equivalent) rather than
relying on blog summaries. Be explicit about what each method does and does not protect.

## Findings (scout output)

### Summary

**Recommendation: Cloudflare Access in front of the page, with email one-time PIN as the only
login method, an Allow policy scoped to exactly one email address, and a 7-day session.**
It is the only free option here that gives server-side enforcement (the page is never served
without a valid token), Cloudflare-side abuse controls on login, real revocation, and no shared secret for her to
remember or lose. Its weak point is not the PIN — it is her email account, which becomes the
de facto password.

StatiCrypt is the best *fallback* and a good conceptual backup (works on any static host, no
account, nothing to revoke), but it is offline-crackable and has no logout, no rate limiting,
and no revocation short of re-encrypting and redistributing. Passkeys are the best *UX* but
cannot be the primary gate on free static hosting, and Cloudflare Access only offers WebAuthn
as a second factor (or via a third-party OIDC IdP such as Google).

Threat model matters: the adversary is a curious neighbour or an acquaintance, not a targeted
cracker. Both recommended options stop that adversary. The real risks are (a) her email being
compromised/reset by someone who knows her, and (b) misconfiguration or a second hostname that
bypasses the gate.

### Comparison

| Method | Actually gates content? | UX for one non-technical user | Recovery if phone/email lost | Brute-force resistance | Free-tier fit |
|---|---|---|---|---|---|
| **CF Access + email OTP** | Yes — token required before origin is reached | Enter email, get 6-char PIN, paste. Works in any browser, phone or desktop. Re-login only when session expires. | Trivial for admin: add/replace the email in the policy. Depends entirely on her mailbox security. | Online only; PIN single-use, 10-min TTL; Cloudflare-mediated, no offline attack surface | Yes on Free Zero Trust plan; requires a **custom domain on an active Cloudflare zone** |
| **CF Access + Google login** | Yes | Best UX if she already uses Gmail; can ride a passkey/Face ID | Google account recovery (same email/phone dependency) | Strong (Google-side), phishing-resistant with passkeys | Same as above; no extra cost |
| **StatiCrypt / PageCrypt** | Crypto yes; access control no — ciphertext is public | One password prompt; "Remember me" hides it after first use. Logout is an obscure `#staticrypt_logout` URL. | Passphrase lost → admin re-encrypts and re-sends. No lockout to clear. | **Offline, unlimited guessing.** Only PBKDF2 600k slows it. Passphrase is everything. | Any static host; HTTPS required for v3 (WebCrypto) |
| **Passkeys/WebAuthn** | Only if a server/IdP enforces it | Excellent where supported | Synced passkeys → Apple/Google account recovery; device-bound → lose phone, lose access | No guessing; phishing-resistant | Static hosts cannot enforce it. Access: second factor only (or Google-as-IdP) |
| **Magic links** | Yes, bearer link | One tap — but mail scanners can consume the link, and forwarding breaks the model | Email only | Link entropy high; single-use/expiry needed; no lockout | Needs a backend or IdP; not free-static |
| **HTTP basic auth** | Yes, if host supports it | Browser popup; no logout; shared password; awful on mobile | Shared password re-sent out-of-band | Weak; no per-user lockout you control | Most free static hosts don't support it (Netlify/Pages password protection is paid) |
| **Secret URL** | No — it's a capability, not authentication | Trivial | Re-share URL | URL leaks via history, chat, screenshots, logs; no revocation except changing URL | Free, but security theatre as the only control |
| **VPN / Tailscale** | Yes (network-level) | Requires install + account + device approval; heavy support burden | Re-auth/device re-approval | Strong | Free tier exists, but massive overkill for one page |
| **Password-manager item / Send** | Partly | Needs an account and a master password | Master password / account recovery | Strong crypto, but bearer links and vault access are the weak points | Good as a *delivery channel*, not as the gate |

### Evidence

**Cloudflare Access — policy model.** Access is deny-by-default: a user must match an Allow
policy. Policies combine Include (OR), Require (AND), Exclude (NOT), and selectors include
`Emails` (exact address), `Emails ending in`, `Login Methods`, `Country`, `IP ranges`. This is
what makes a single-email policy possible. Two documented misconfigurations grant the world
access: `Include Everyone` and `Include Login Methods = One-time PIN` (because OTP accepts any
valid email). Policy order matters: Bypass/Service Auth evaluate first, then Block/Allow in
order, and evaluation stops at the first Allow/Block match.
<https://developers.cloudflare.com/cloudflare-one/access-controls/policies/>

**Cloudflare Access — email OTP.** OTP is an IdP you add under Zero Trust → Integrations →
Identity providers. Behaviour verified in the docs: Cloudflare **only sends mail if the email
matches an Access policy**; the page always says "A code has been emailed to you" regardless
(so blocked users can't enumerate); the PIN **expires after 10 minutes**, is **single-use**, and
**requesting a new PIN invalidates the previous one**; blocked emails simply get nothing. Mail
security scanners that prefetch links can consume the code, producing "already used" — the fix
is a new code, not a config change. The doc does not publish a per-IP/per-account attempt
limit, so treat throttling as Cloudflare-side and undocumented rather than a guarantee.
<https://developers.cloudflare.com/cloudflare-one/identity/one-time-pin/>
(redirects to `/cloudflare-one/integrations/identity-providers/one-time-pin/`)

**Cloudflare Access — sessions, logout, revocation.** Two tokens: a *global* session token at
`<team>.cloudflareaccess.com` (15 min – 1 month, default 24 h) and a per-application token at
the app hostname (immediate – 1 month, default 24 h). When the app token expires, Access
silently reissues it if the global token is still valid and policy still matches — so the
effective re-login window is the **global** duration unless you shorten it. Logout is a URL:
`<app-domain>/cdn-cgi/access/logout` or `<team>.cloudflareaccess.com/cdn-cgi/access/logout`;
it clears the cookie immediately and issued tokens stop being accepted in 20–30 seconds.
Admins can revoke per-application ("Revoke existing tokens") or per-user (Team & Resources →
Users → Revoke), but **revocation is not the same as de-provisioning**: if her identity can
still authenticate, she can start a new session. Permanent removal = remove/deny the email in
the policy *and* revoke. There is no per-application end-user logout.
<https://developers.cloudflare.com/cloudflare-one/access-controls/access-settings/session-management/>
<https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/>

**Cloudflare Access — hostname and plan constraints.** A self-hosted Access application requires
"an active domain on Cloudflare" (full or partial/CNAME setup); the Domain dropdown only lists
zones in your account, or you can use a Cloudflare-for-SaaS custom hostname. Practical
consequence: **`*.pages.dev` and `*.workers.dev` hostnames are not zones and cannot be protected
directly** — you need a custom domain on a (free) Cloudflare zone in front of Pages/Workers/R2.
The Zero Trust **Free plan** exists and onboarding explicitly lets you select it (payment details
entered, not charged), but the plan/pricing pages I could reach did not state the seat cap. The
commonly cited "50 users free" figure is **not verified from official docs in this session** —
confirm it in the dashboard before relying on it.
<https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/self-hosted-public-app/>
<https://developers.cloudflare.com/cloudflare-one/setup/>
<https://www.cloudflare.com/plans/zero-trust-services/> (consulted; no seat numbers rendered)

**Cloudflare Access — passkeys/WebAuthn.** Access does not offer a passkey as a *primary* IdP.
It supports **independent MFA** with WebAuthn security keys and platform biometrics (Touch ID,
Face ID, Windows Hello), plus TOTP, but that is a *second* factor after the IdP login. IdP-based
MFA enforcement is only available for Okta, Entra ID, generic OIDC and generic SAML. So a
passkey-primary flow requires an external OIDC IdP (e.g. a Google account with a passkey).
Lockout recovery is admin-side deletion of the user's authenticators, then re-enrollment.
<https://developers.cloudflare.com/cloudflare-one/access-controls/access-settings/independent-mfa/>
<https://developers.cloudflare.com/cloudflare-one/access-controls/policies/mfa-requirements/>

**Cloudflare Access — "Cloudflare" IdP gotcha.** New Zero Trust orgs default to the Cloudflare
IdP with *Restrict to account members* enabled. If you leave that as the only IdP, your cousin
would need to be a member of your Cloudflare account (a seat and account access you do not
want). Add One-time PIN explicitly and disable/ignore the Cloudflare IdP for this app.
<https://developers.cloudflare.com/cloudflare-one/integrations/identity-providers/cloudflare/>

**StatiCrypt — actual crypto and model (from the project, not blogs).** AES-256 in **CBC** mode
via WebCrypto, with **PBKDF2-SHA256 at 600,000 iterations** and a random 32-hex-char salt; the
salt is public and stored in `.staticrypt.json` so re-encryption doesn't invalidate "remember
me". The output is a static HTML password prompt containing the ciphertext and the decryptor;
**all decryption is client-side**, so "brute-force/dictionary attacks would be easy to do at a
fast pace" — the maintainer's own words — and the project recommends **16+ alphanumeric
characters**. It explicitly disclaims cryptographic review ("I am not a cryptographer").
Operational details that matter for one non-technical user: "Remember me" stores the salted +
hashed password in `localStorage` with **no expiry by default**; logout is only
`https://site/#staticrypt_logout`; one password per page (per-folder trick for multiple users);
`--share` produces `#staticrypt_pwd=<hash>` which **auto-decrypts for anyone who has the link**
(a bearer credential); v3 requires HTTPS/localhost because WebCrypto is unavailable on plain
HTTP. Works on GitHub Pages/Netlify/Cloudflare Pages; no server, no rate limiting, no logs, no
revocation. PageCrypt is the older sibling with a similar model (listed by StatiCrypt as an
alternative, not vetted).
<https://github.com/robinmoisson/staticrypt>

**NIST baseline (context, not a mandate).** SP 800-63B requires verifiers to implement
**rate limiting** on failed authentication attempts (§5.1.1.2 / §5.2.2) and to store memorized
secrets salted+hashed with a cost factor — exactly the two properties StatiCrypt cannot provide
for access control (it has the KDF but no verifier to throttle). It also says verifiers should
allow long passwords and paste, and should not impose composition rules — relevant if you ever
pick a passphrase with her. Note the page itself flags that 800-63-3 was **superseded by
800-63-4 on 1 Aug 2025**; cite 800-63-4 if this becomes load-bearing.
<https://pages.nist.gov/800-63-3/sp800-63b.html>

### Recommendation + residual risks

**Primary design (recommended)**

1. Put the page on a hostname on a **custom domain in a free Cloudflare zone** (Pages/Workers
   custom domain, or a Tunnel to a local static server). Do not rely on `*.pages.dev`.
2. Create one Access application for that hostname. Policy: `Allow` / `Include` / `Emails` =
   her exact address. No `Include Everyone`, no `Include Login Methods = One-time PIN`.
3. Enable **One-time PIN** as the IdP; keep **Google** as an optional second IdP only if she
   already uses Gmail (it gives passkey/Face ID UX). Avoid the Cloudflare IdP.
4. Set global and application session duration to **7 days** (1 month if monthly friction is
   unacceptable; 24 h if the device may be shared). Tell her the logout URL, or give her a
   bookmark to `<app>/cdn-cgi/access/logout`.
5. Protect your **Cloudflare account** with a strong unique password + hardware-key 2FA, and
   her **email account** with 2FA. Those two accounts are the real keys to this system.
6. Write a one-paragraph runbook: "if she loses email → edit the policy's email value, revoke
   her user, tell her the new address; if her email is compromised → remove her email from the
   policy and revoke." Test both once.
7. Verify there is **no alternate public hostname** for the same content (deployment/preview
   URLs, R2 public bucket, old DNS record). Access only protects the hostnames it is attached to.

**Optional second layer:** keep a StatiCrypt-encrypted copy as an offline artifact, not as the
primary gate. If it sits behind Access, encryption is belt-and-braces (and protects against a
misconfigured Access policy). If it is public, treat the passphrase as the only control.

**Why not StatiCrypt as primary:** no revocation (monthly password rotation means re-encrypt +
re-send every month, and old ciphertext stays public forever unless deleted), no lockout, no
logout she will find, and a passphrase that must travel over some channel — usually the same
WhatsApp/email thread you were trying to secure. It is still a perfectly good answer if
Cloudflare's setup is judged too fragile for the person maintaining it.

**Residual risks, stated plainly**

- **Email takeover is total takeover.** Anyone who can read her inbox, or reset her email
  account (security questions, SMS port-out, a helpful relative), can request a PIN and get in.
  OTP is single-factor; the email account is the password. This is the largest risk and it is
  not fixed by anything in this document.
- **Your Cloudflare account is a single point of failure.** If it is compromised or you lose
  access, the page either leaks or disappears. Hardware-key 2FA, recovery codes offline.
- **Sessions outlive incidents.** A logged-in phone that is lost or borrowed retains access for
  up to the session duration. Shorter sessions trade convenience for this.
- **Misconfiguration is one click away** (`Include Everyone`, OTP-as-login-method, a Bypass
  policy, an unprotected preview hostname). Re-check the policy after every edit.
- **Her behaviour:** she may screenshot the list, forward the URL, or leave it open on a shared
  device. No authentication method fixes that.
- **Free-tier change risk:** Cloudflare can change plan limits/terms; the 50-seat figure is
  unverified here. The design uses one seat, so headroom is large.
- **Over-engineering risk:** the asset is a Wi-Fi password list behind a router. The neighbour
  threat does not justify a VPN or a PKI. If setup complexity causes you to abandon maintenance,
  the effective security drops to zero.

### Open questions

1. What is the actual free-tier seat cap and app limit on Zero Trust Free today? (Verify in
   dashboard → Settings → Cloudflare One plan; the public pages I reached omit it.)
2. Does a custom domain already exist (RQ3)? If the only hostname is `*.pages.dev`, Access
   cannot be attached — this decides the whole recommendation.
3. Does she have a Google/Apple account with a passkey, and does she reliably read email on her
   phone? If yes, Google-as-IdP may beat OTP on both UX and phishing resistance.
4. Is there a non-email channel you can use for break-glass (Signal, in person)? If yes, consider
   adding your own email as a second allowed address deliberately (documented admin backdoor)
   rather than relying on last-minute policy edits.
5. Can Cloudflare Pages deployment/preview URLs be disabled or are they publicly reachable?
   Same question for any R2 bucket or old DNS record.
6. Who rotates the monthly list, and does rotation need to invalidate old copies? If yes, that
   argues for Access (revoke/replace) over StatiCrypt (re-encrypt and hope).
7. Would a per-month passphrase (StatiCrypt) be acceptable operationally, or does that create
   more support burden than it removes?
