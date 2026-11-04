---
id: report-router-password-site
created: 2026-11-04
type: research
status: active
sources:
  - https://developers.cloudflare.com/cloudflare-one/applications/configure-apps/self-hosted-apps/
  - https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/self-hosted-public-app/
  - https://developers.cloudflare.com/cloudflare-one/identity/one-time-pin/
  - https://developers.cloudflare.com/cloudflare-one/access-controls/access-settings/session-management/
  - https://developers.cloudflare.com/pages/platform/limits/
  - https://developers.cloudflare.com/workers/platform/limits/
  - https://docs.netlify.com/manage/security/secure-access-to-sites/password-protection/
  - https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits
  - https://docs.gitlab.com/user/project/pages/pages_access_control/
  - https://github.com/robinmoisson/staticrypt
  - https://bitwarden.com/pricing/
  - https://proton.me/pass
  - https://1password.com/pricing
  - https://cryptpad.org/pricing/
  - https://privatebin.info
  - https://tailscale.com/pricing
  - https://pages.nist.gov/800-63-4/sp800-63b.html
  - https://pages.nist.gov/800-63-4/sp800-63b/passwords/
  - https://pages.nist.gov/800-63-4/sp800-63b/events/
  - https://www.wi-fi.org/discover-wi-fi/security
  - https://www.wi-fi.org/wpa3-resources
  - https://docs.python.org/3/library/secrets.html
  - https://developer.mozilla.org/en-US/docs/Web/API/Crypto/getRandomValues
  - https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html
  - https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html
---

# Research: Delivering a Monthly Wi-Fi Password List to One Person

## Executive Summary

The question is not really "how do I host a website." It is "how do I deliver a low-value,
daily-expiring secret to one trusted person with the least operational risk?" The asset is a
**Wi-Fi password**, not a bank credential; yesterday's password is worthless after the router
rotates. That changes the design target: availability and recovery matter more than
sophisticated authentication, and a public page listing the **whole month** is the single
biggest blast radius in the system.

The most important finding is architectural: **Cloudflare Access — the only free option with
real server-side enforcement — cannot protect a free `*.pages.dev` or `*.workers.dev`
hostname.** It requires an active custom domain on a Cloudflare zone. On a strictly free
budget, the realistic website is therefore a **StatiCrypt-encrypted static page on Cloudflare
Pages**: the ciphertext is public, the passphrase is the entire security boundary, and there
is no revocation, rate limiting, or logout. It is adequate for the stated adversary only if
the passphrase is long (20+ random characters), delivered out-of-band, and the published
window is short.

The strongest recommendation is to **fix the underlying Wi-Fi policy first** — a long stable
passphrase, WPA3 where possible, and a separate guest SSID for visitors — because daily
8-digit rotation provides only ~26.6 bits of entropy, does not stop offline WPA2 handshake
cracking, and imposes a heavy reconnection and lockout cost. Then choose a delivery vehicle
based on what you actually value: **Bitwarden's free shared vault** if you want real per-user
authentication at zero cost; **Cloudflare Pages + StatiCrypt** if a page is non-negotiable;
and **Cloudflare Access + email OTP** if you can spend ~$10/year on a domain. Keeping
WhatsApp (or moving to Signal) remains a rational baseline that a website must beat.

## Key Findings

### 1. Daily 8-digit rotation is weak security and expensive operations

An 8-digit numeric password has `10^8` values, or **≈26.6 bits**. Against an offline WPA2
handshake, commodity GPUs are commonly reported in the `10^5–10^6` guesses/second range for
WPA-PBKDF2, so the entire keyspace falls in roughly **minutes** (order-of-magnitude
inference; a fresh benchmark was not retrievable). WPA3-SAE changes the picture because
guessing requires an online exchange with the access point, but only if every device
supports it. NIST SP 800-63-4 explicitly says verifiers **SHALL NOT** require periodic
password changes, while it does require length, blocklists, and rate limiting.

Operationally, one PSK means every phone, TV, printer, camera, and IoT device must be
re-onboarded after each rotation. That creates daily support burden and a real lockout risk,
especially if the device used to administer the router loses its connection.

- **Evidence:** RQ1 note, sections 1–4; NIST SP 800-63-4; Wi-Fi Alliance security pages.
- **Implication:** do not build the system around 8-digit daily rotation. Use a long random
  passphrase on the main SSID, WPA3 where possible, and put the daily ritual on a **guest
  SSID** if it must continue.
- **Links:** [`01-requirements-threat-model.md`](research-router-password-site/01-requirements-threat-model.md);
  <https://pages.nist.gov/800-63-4/sp800-63b.html>;
  <https://www.wi-fi.org/discover-wi-fi/security>.

### 2. A website moves the monthly work; it does not remove it

With one recipient, WhatsApp costs one action per month. A static site costs the same
monthly publish **plus** encryption, deploy, auth administration, and a recovery path. The
site wins on **retrieval quality** (stable URL, formatted table, no scrolling) and
**revocation** (you can unpublish or change a passphrase; you cannot un-send a WhatsApp
message). It loses on publisher effort and reliability surface.

- **Evidence:** RQ2 note, comparison table and "does a website remove work?" table.
- **Implication:** build a site only if on-demand retrieval or revocation is the actual
  requirement. If the pain is "the list is buried in chat," a formatted image/PDF in
  WhatsApp may capture most of the benefit at zero infrastructure.
- **Links:** [`02-solution-space.md`](research-router-password-site/02-solution-space.md).

### 3. Cloudflare Access cannot protect free `pages.dev` / `workers.dev` hostnames

Every Access self-hosted application requires an **active domain/zone in your Cloudflare
account** (full or partial/CNAME setup). `pages.dev` and `workers.dev` are Cloudflare-owned
zones that a user cannot add. This is architectural, not a pricing limitation; the free
Zero Trust tier does not help, and Cloudflare Tunnel public hostnames must still live in a
zone you control.

- **Evidence:** RQ3 note, question 1; official Cloudflare docs for self-hosted Access apps.
- **Implication:** the obvious free architecture (Pages + Access) does not exist. The free
  website options are client-side encryption on any static host, a homegrown Worker with
  Basic Auth, or **GitLab Pages access control** (free tier, but the viewer needs a GitLab
  account and project membership).
- **Links:** [`03-hosting-domain.md`](research-router-password-site/03-hosting-domain.md);
  <https://developers.cloudflare.com/cloudflare-one/applications/configure-apps/self-hosted-apps/>.

### 4. The free website option is encryption, not authentication

StatiCrypt encrypts a self-contained HTML page with **AES-256-CBC** and **PBKDF2-SHA256 at
600,000 iterations**, then decrypts in the browser. The host never sees the passphrase or
plaintext, which is good. But the ciphertext is public: anyone who downloads it can guess
offline without rate limiting. The maintainer explicitly recommends 16+ alphanumeric
characters and warns that fast brute force is feasible. "Remember me" persists indefinitely,
logout is an obscure `#staticrypt_logout` URL, and `--share` links embed a password hash,
turning the URL itself into a bearer credential.

- **Evidence:** RQ3 and RQ4 notes; StatiCrypt repository.
- **Implication:** a StatiCrypt page can satisfy "only she sees it" only in the sense that a
  strong passphrase gates it. It cannot revoke access, rate-limit guesses, or distinguish
  her from anyone else who has the passphrase. Use a 20+ character random passphrase,
  deliver it out-of-band, and accept the residual risk explicitly.
- **Links:** [`03-hosting-domain.md`](research-router-password-site/03-hosting-domain.md),
  [`04-authentication.md`](research-router-password-site/04-authentication.md);
  <https://github.com/robinmoisson/staticrypt>.

### 5. At zero cost, real per-user authentication is a password manager, not a website

Bitwarden's free plan includes unlimited passwords and devices and **free sharing with one
other user via a Free Organization**. That gives real per-user authentication, a master
password, optional 2FA, and no monthly re-publish: edit one secure note and she sees it.
Proton Pass free does not include vault sharing (Pass Plus only); 1Password has no free
plan; Vaultwarden needs a server.

- **Evidence:** RQ2 note; official Bitwarden, Proton Pass, and 1Password pricing pages.
- **Implication:** if "persistent, authenticated access" is the real requirement, Bitwarden
  is the best zero-cost answer. The trade-off is a one-time onboarding and an unrecoverable
  master password (make her save a recovery kit).
- **Links:** [`02-solution-space.md`](research-router-password-site/02-solution-space.md);
  <https://bitwarden.com/pricing/>.

### 6. The whole-month list is the largest blast radius

If one credential leak exposes 30 days of passwords, the daily rotation provides little
protection. A **rolling 3-day window** (yesterday/today/tomorrow) limits the blast radius to
three days and tolerates one missed publish. A per-month seed derivation has the same
month-wide blast radius as the full list and no per-day revocation. Keep the full month only
in an encrypted offline archive.

- **Evidence:** RQ5 note, exposure-window table.
- **Implication:** publish only the rolling window; define one authoritative time zone; keep
  old ciphertext offline and rotate the router password at the month boundary.
- **Links:** [`05-secret-lifecycle-ops.md`](research-router-password-site/05-secret-lifecycle-ops.md).

### 7. Recovery is the hardest failure mode, and the website cannot solve it

The cousin can lose her phone, lose access to her email, forget the passphrase, or be locked
out of both the Wi-Fi and the site at the same time. Email OTP makes her email account the
de facto password; StatiCrypt makes the passphrase the only key. Neither survives a lost
credential without an offline recovery path.

- **Evidence:** RQ4 and RQ5 notes; NIST SP 800-63-4 recovery-code guidance (≥64 bits,
  offline, single-use).
- **Implication:** before publishing anything, prepare a sealed emergency envelope (site URL,
  current access credential or recovery code, emergency Wi-Fi password, printed
  instructions), name a backup operator, and consider a stable guest SSID for emergencies.
- **Links:** [`04-authentication.md`](research-router-password-site/04-authentication.md),
  [`05-secret-lifecycle-ops.md`](research-router-password-site/05-secret-lifecycle-ops.md).

### 8. A ~$10/year domain is the highest-leverage upgrade

If any budget is allowed, a custom domain on a free Cloudflare zone unlocks **Cloudflare
Access** in front of Cloudflare Pages. Access gives server-side enforcement (the page is
never served without a valid token), email one-time PIN or Google login, real revocation,
and configurable 7-day sessions. The single-email `Allow` policy is exactly the "only her"
control the user asked for. The free Zero Trust plan exists, but the commonly cited seat cap
was not verified from official pages; the design uses one seat, so headroom is not the
issue.

- **Evidence:** RQ3 and RQ4 notes; Cloudflare Access policy, OTP, and session docs.
- **Implication:** if "only her" must be enforced by identity rather than a shared
  passphrase, the domain purchase is the difference between encryption-as-access-control and
  actual authentication.
- **Links:** [`03-hosting-domain.md`](research-router-password-site/03-hosting-domain.md),
  [`04-authentication.md`](research-router-password-site/04-authentication.md);
  <https://developers.cloudflare.com/cloudflare-one/access-controls/policies/>.

### Options at a glance

| Option | Cost | Auth model | Monthly work | Main weakness | Verdict |
|---|---|---|---|---|---|
| Keep WhatsApp / Signal | $0 | Phone + chat account; E2EE in transit | One send | History, backups, forwarding; no revocation | Rational baseline |
| **Bitwarden free shared vault** | $0 | Per-user master password + optional 2FA | Edit one note | Onboarding; unrecoverable master password | **Best free persistent option** |
| **Cloudflare Pages + StatiCrypt** | $0 | Shared passphrase; client-side decryption | Re-encrypt + deploy | Public ciphertext; offline guessing; no revocation | **Best free "website"** |
| **Cloudflare Pages + Access + email OTP** | ~$10/yr domain | Server-side identity (email OTP/Google) | Deploy | Her email is the real password; setup complexity | **Best overall if domain allowed** |
| GitLab Pages access control | $0 | GitLab account + project membership | Deploy | Cousin needs a GitLab account; CI setup | Fallback for real auth |
| Homegrown Worker + Basic Auth | $0 | Shared password | Deploy | No rate limiting/lockout; custom code | Not recommended |
| Tailscale + home server | $0 + hardware | Tailscale identity | Patch/keep server online | Hard onboarding; home power/internet dependency | Overkill |
| Whole-month list anywhere | — | — | — | One leak = 30 days | Avoid |

## Recommendations

1. **Fix the Wi-Fi policy before building anything.** Put a long random passphrase (16+
   characters or 5–6 random words) on the main SSID, enable WPA3 if every device connects,
   disable WPS, and create a separate guest SSID for visitors. If daily rotation is a hard
   social requirement, rotate the **guest** password, not the main one. This is a larger
   security improvement than any website and removes the IoT reconnection burden.
2. **If the budget is truly zero and a page is required:** deploy **Cloudflare Pages +
   StatiCrypt** with a 20+ character random passphrase, `noindex` headers, no analytics or
   third-party scripts, and a **rolling 3-day window** rather than the whole month. Deliver
   the URL and passphrase through different channels; never use StatiCrypt `--share` links.
   Keep the full month in an encrypted offline archive.
3. **If ~$10/year is acceptable:** buy a domain, put the page on Cloudflare Pages behind
   **Cloudflare Access** with a single-email `Allow` policy and **email OTP** (or Google
   login if she uses Gmail). Set sessions to 7 days, protect your Cloudflare account and her
   email with 2FA, and verify there is no unprotected preview or alternate hostname.
4. **If zero cost and real per-user authentication are both required:** use a **Bitwarden
   free shared vault** (Free Organization, one other user) with one secure note for the
   month's list. Skip the website. Make her save a recovery kit.
5. **If none of the above is worth the effort, keep WhatsApp/Signal.** Add a lock screen and
   2FA, enable end-to-end encrypted backups, and pin or archive the chat. If retrieval is the
   pain, send a formatted image/PDF table once a month. This is the honest baseline.
6. **Design recovery before publishing.** Prepare a sealed emergency envelope (URL, access
   credential or recovery code, emergency Wi-Fi password, instructions), name a backup
   operator, and consider a stable emergency guest SSID. Test the recovery flow quarterly.
7. **Operate the publish safely.** Generate per-day PINs with `secrets.randbelow(10**8)` or
   unbiased `crypto.getRandomValues`; never commit plaintext; publish ciphertext only; purge
   the CDN; verify from a clean browser and a second network; rotate the router password at
   the month boundary; unpublish the old window after a grace period.

## Further Reading

- NIST SP 800-63-4, *Digital Identity Guidelines* — passwords, authenticators, recovery:
  <https://pages.nist.gov/800-63-4/sp800-63b.html>
- Wi-Fi Alliance, *Security* and *WPA3 resources*:
  <https://www.wi-fi.org/discover-wi-fi/security>, <https://www.wi-fi.org/wpa3-resources>
- Cloudflare Access policies, OTP, and session management:
  <https://developers.cloudflare.com/cloudflare-one/access-controls/policies/>,
  <https://developers.cloudflare.com/cloudflare-one/identity/one-time-pin/>,
  <https://developers.cloudflare.com/cloudflare-one/access-controls/access-settings/session-management/>
- Cloudflare Pages and Workers limits:
  <https://developers.cloudflare.com/pages/platform/limits/>,
  <https://developers.cloudflare.com/workers/platform/limits/>
- StatiCrypt (client-side encrypted static pages): <https://github.com/robinmoisson/staticrypt>
- Bitwarden pricing and free sharing: <https://bitwarden.com/pricing/>
- OWASP Secrets Management and Forgot Password cheat sheets:
  <https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html>,
  <https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html>
- Python `secrets` and MDN `crypto.getRandomValues`:
  <https://docs.python.org/3/library/secrets.html>,
  <https://developer.mozilla.org/en-US/docs/Web/API/Crypto/getRandomValues>

## Follow-up Questions

1. Is daily rotation a **hard requirement** from the cousin, a habit, or the user's
   assumption? What problem does she believe it solves?
2. Is the cousin **local** (physical card or in-person passphrase delivery viable) or
   remote? Does she need access while travelling?
3. Does she already use a **password manager**, a Google/Apple account, or a passkey? This
   decides whether Bitwarden or Google-as-IdP is realistic.
4. Is **$10/year** for a domain truly impossible, or would it be acceptable if it materially
   improves the "only her" guarantee?
5. What is the **router model and firmware**? Does it support WPA3, multiple SSIDs, guest
   isolation, and scheduled password changes? What is the full device inventory?
6. Does she need the **whole month** at once, or only today/tomorrow? This decides the
   exposure window and the publishing cadence.
7. Who is the **backup operator** if the user is unavailable, and where is the sealed
   emergency envelope stored?
8. Can the free host disable **preview/deployment URLs**, and does it support cache purge,
   custom headers, and `noindex`? If not, the rollback/retention plan must assume caches
   cannot be purged promptly.
9. What is the acceptable **recovery time** when the cousin is locked out of both the Wi-Fi
   and the site?
10. Is a **stable emergency guest password** acceptable, or must every Wi-Fi credential
    rotate monthly? This is the key availability-versus-exposure trade-off.

---

*Research notes: [`00-plan.md`](research-router-password-site/00-plan.md),
[`01-requirements-threat-model.md`](research-router-password-site/01-requirements-threat-model.md),
[`02-solution-space.md`](research-router-password-site/02-solution-space.md),
[`03-hosting-domain.md`](research-router-password-site/03-hosting-domain.md),
[`04-authentication.md`](research-router-password-site/04-authentication.md),
[`05-secret-lifecycle-ops.md`](research-router-password-site/05-secret-lifecycle-ops.md).*
