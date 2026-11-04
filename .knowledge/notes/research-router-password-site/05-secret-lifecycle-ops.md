---
id: rq5-secret-lifecycle
created: 2026-11-04
type: research-note
status: active
parent: research-router-password-site
question: "How should the passwords be generated, stored, published, delivered, rotated, and recovered?"
tags: [secrets, operations, csprng, recovery]
---

# RQ5 — Secret lifecycle and operations

## Context

- 8-digit numeric Wi-Fi passwords, generated monthly, one per day.
- The user currently sends the month's list via WhatsApp.
- Any website or vault must not leak the whole month through a single mistake.
- Budget: free only. The user may be unavailable some days.

## Sub-questions

1. **Generation:** CSPRNG use in Python and JavaScript (`secrets`, `crypto.getRandomValues`),
   modulo bias, and how to generate 8-digit PINs safely. What entropy does 8 digits give,
   and what are the router's likely constraints?
2. **Storage:** where do secrets live in each architecture — static HTML, git repo, build
   artifacts, CDN cache, logs, analytics, error tracking? Which are unacceptable?
3. **Encryption:** at rest and in transit; what does the host/CDN see; what does the
   client see after decryption?
4. **Publishing:** monthly generation workflow, one page per month, retention of old
   months, revocation of expired passwords, and rollback if a mistake is published.
5. **Exposure window:** is publishing the whole month necessary? Compare whole-month vs
   today+tomorrow vs deriving each day's password from a seed. What are the trade-offs?
6. **Delivery of the access credential:** out-of-band, in person, password manager,
   WhatsApp. What are the risks of WhatsApp history, backups, forwarding, and shoulder
   surfing? How to share a passphrase safely?
7. **Recovery and lockout:** lost phone, lost email, forgotten passphrase, the user
   unavailable, the cousin locked out of the Wi-Fi and the site at the same time.
8. Produce an operational checklist and a list of failure modes with mitigations.

## Scout brief

Prioritize questions 1, 5, 6, and 7. Use authoritative sources for crypto and password
guidance (NIST SP 800-63B, OWASP). Treat operational recovery as a first-class security
property, not an afterthought.

## Findings (scout output)

### Summary

Treat this as **two different secrets with two different threat models**:

1. **Wi-Fi passwords** — low entropy by construction if forced to 8 digits, valid for one day, and only useful to someone near the router. Their main risk is *bulk disclosure* of the published list, not online guessing of a single value.
2. **The access credential** — the passphrase/key that unlocks the published ciphertext. This is the real secret. It must be high entropy, unique, delivered out-of-band, and recoverable without the website.

Recommended default: **generate per-day random 8-digit PINs offline with a CSPRNG; publish only ciphertext for a rolling 3-day window (yesterday/today/tomorrow), one small page per day inside a month folder; decrypt client-side with a high-entropy access credential that is never stored with the ciphertext; keep an encrypted full-month copy offline; rotate the router password at the month boundary; maintain a sealed emergency kit and a backup operator.** A whole-month public ciphertext blob is acceptable only if the access credential is strong and the user accepts that one credential leak exposes the whole month.

Key numbers: 8 decimal digits = \(10^8\) values = **26.6 bits** of entropy. That is weak against offline guessing and should not be relied on as a standalone secret. A 6-word Diceware passphrase from a 7,776-word list is about **77.5 bits**; a 32-byte random token is **256 bits**.

### Guidance by question

#### 1. Generation: CSPRNG, modulo bias, 8-digit PIN entropy

**Python.** Use `secrets`, never `random` or `Math.random`. `secrets.choice`, `secrets.randbelow`, and `secrets.token_*` are backed by the OS CSPRNG and are suitable for passwords/tokens ([Python docs](https://docs.python.org/3/library/secrets.html)). A clean 8-digit generator:

```python
import secrets

def pin8() -> str:
    # randbelow is unbiased (rejection sampling inside CPython).
    return f"{secrets.randbelow(10**8):08d}"
```

Do **not** do `int.from_bytes(secrets.token_bytes(4), "big") % 10**8`; that introduces modulo bias. `secrets.randbelow(10**8)` avoids it. For a human-memorable access credential, use a Diceware-style passphrase; for a machine-stored one, `secrets.token_urlsafe(32)`.

**JavaScript.** `crypto.getRandomValues()` is a cryptographically strong PRNG seeded by the platform and is the correct browser primitive ([MDN](https://developer.mozilla.org/en-US/docs/Web/API/Crypto/getRandomValues)). It is available in insecure contexts, but the page should still be HTTPS-only. Unbiased 8-digit generation with rejection sampling:

```js
function pin8() {
  const MAX = 100_000_000;
  const LIMIT = Math.floor(0x100000000 / MAX) * MAX; // 42 * 10^8
  const buf = new Uint32Array(1);
  let x;
  do {
    crypto.getRandomValues(buf);
    x = buf[0];
  } while (x >= LIMIT);
  return String(x % MAX).padStart(8, "0");
}
```

Why rejection: \(2^{32} = 4{,}294{,}967{,}296\); \(2^{32} \bmod 10^8 = 94{,}967{,}296\). A naive `x % 10**8` gives the first ~95 million values one extra chance each (~2.2% bias). Rejecting `x >= 42 * 10^8` leaves exactly 42 full cycles. For a digit-at-a-time version, reject bytes `>= 250` before `% 10` (because \(256 \bmod 10 = 6\), otherwise digits 0–5 are ~4% more likely).

**Entropy and router constraints.** 8 digits is 26.6 bits regardless of generator quality. A WPA2/WPA3 passphrase is usually 8–63 printable ASCII characters; many routers accept 8–63, and WPA2 requires at least 8. If the router accepts longer passphrases, prefer **WPA3, then WPA2 with a 16–20+ character random passphrase** over 8 digits. If the requirement is truly 8 numeric digits (e.g., a legacy router or a UI constraint), accept that the value is weak and compensate with short validity, rate limiting, and keeping the list encrypted. NIST's older guidance allowed CSP-generated numeric PINs as short as 6 characters, but that is a *minimum*, not a recommendation for high-security use ([NIST SP 800-63B](https://pages.nist.gov/800-63-3/sp800-63b.html)). Current NIST SP 800-63-4 requires 15 characters for a single-factor password and 8 for an MFA component; those rules are for account passwords, not Wi-Fi PSKs, but they reinforce that 8 digits is not a strong standalone credential ([NIST 800-63-4 passwords](https://pages.nist.gov/800-63-4/sp800-63b/passwords/)).

**Seed derivation.** If deriving a day's password from a seed, use a real KDF/MAC, not `hash(date)`. Example: `HMAC-SHA-256(seed, "wifi-password:" + YYYY-MM-DD)`, take 8 bytes, reject values above the largest multiple of \(10^8\), then mod \(10^8\). The seed must be at least 128 bits of CSPRNG output and must be treated as a month-wide secret: leaking it reveals every day derived from it. A per-month seed limits the blast radius to one month; a single long-lived seed compromises every month.

#### 2. Where secrets can leak

| Location | Plaintext secret | Ciphertext | Notes / mitigation |
|---|---|---|---|
| Git repo / history / forks | **Never acceptable** | Acceptable | Git history is permanent in clones, forks, PR diffs, CI caches, and backups. `.gitignore` is not a control. Use secret scanning (gitleaks/trufflehog, GitHub push protection), and if a secret is committed, **rotate it**; history rewriting does not un-leak it. |
| Static HTML / JS bundle / source maps | **Never acceptable** | Acceptable with caveats | `view-source`, DevTools, source maps, and archiving expose everything shipped. If the key is in the same bundle, encryption is theater. |
| Build artifacts / CI logs / Docker layers | **Never acceptable** | Acceptable | `set -x`, verbose build logs, crash dumps, test fixtures, npm packages, and artifact retention can capture env vars. Mask secrets, disable debug output, keep artifact retention short. |
| CDN / reverse-proxy cache | **Never acceptable** | Usually acceptable | A CDN terminates TLS and sees whatever is served. Cached plaintext survives deletion; purge is not immediate everywhere. Prefer ciphertext and immutable versioned URLs; use `Cache-Control: no-store` on any credential-protected response. |
| URL query string | **Never acceptable** | Avoid | Query strings appear in access logs, `Referer`, browser history, analytics, and shared screenshots. A URL **fragment** (`#...`) is not sent to the server, but it leaks via history, screenshots, extensions, and XSS; it is not a substitute for a separate credential. |
| Analytics / session replay / error tracking | **Never acceptable** | Usually acceptable | These tools capture DOM, breadcrumbs, request bodies, localStorage, and sometimes form values. Disable them on secret pages, or use a self-hosted, scrubbed setup with no third-party JS. |
| Logs / APM / crash reports | **Never acceptable** | Usually acceptable | Never log decrypted values, keys, or full URLs containing secrets. Scrub before sending to any third party. |
| Browser localStorage / sessionStorage / service-worker cache | **Never acceptable** for long-term plaintext | Acceptable if short-lived and cleared | XSS and extensions can read them. Keep decrypted values in memory; clear on `pagehide`; avoid caching secret pages in a service worker. |
| Screenshots / clipboard / notifications | **Never acceptable** | n/a | Clipboard managers sync to cloud; notification previews show secrets; screenshots go to camera rolls/backups. Mask input and avoid clipboard where possible. |
| Paper / whiteboard / WhatsApp history | **Never acceptable** for bulk lists | n/a | Physical copies and chat history are hard to revoke. Use sealed envelopes for recovery only, and treat them as compromised if opened. |

**Rule:** the repository and the public web root may contain *ciphertext and code only*. Plaintext lives in an encrypted vault or offline medium controlled by the publisher, and in the user's browser memory after decryption.

#### 3. Encryption at rest and in transit; what the host/CDN sees

- **In transit:** HTTPS with TLS 1.2+ (prefer 1.3), HSTS, no mixed content. Without TLS, the host, ISP, and Wi-Fi network see the access credential and plaintext ([OWASP Secrets Management](https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html)).
- **At rest:** encrypt with an authenticated cipher: AES-256-GCM (WebCrypto) or XChaCha20-Poly1305 (libsodium). Use a fresh random 96-bit nonce per message and never reuse a nonce with the same key. Include associated data such as the date/month to prevent swapping ciphertexts between days.
- **Key derivation:** derive the key-encryption key from the access credential with Argon2id (preferred) or PBKDF2-SHA-256 with a cost calibrated to roughly 0.5–1 second on the target device. A high-entropy access credential makes offline guessing impractical; a short human PIN does not, no matter how expensive the KDF.
- **Key separation:** `access credential -> KDF -> KEK -> unwrap per-day data keys`. This lets you rotate the access credential by re-wrapping data keys, but it does **not** retroactively protect old ciphertext that an attacker already copied and can still decrypt with an old credential. Rotation protects future windows only.
- **What the host/CDN sees:** with **client-side decryption and a key that is never sent**, the host/CDN sees the HTML/JS, ciphertext, URLs, sizes, timestamps, and client IPs — but not the Wi-Fi passwords. It can still serve malicious JavaScript, so client-side encryption protects against passive logging/cache leaks, not against an actively malicious or compromised host. With **server-side decryption**, the host sees plaintext and may log it; that is unacceptable for this project.
- **What the client sees after decryption:** plaintext in browser memory, the DOM, and possibly DevTools, screenshots, clipboard, and extensions. The page should reveal only the current day's password, mask it by default, and offer an explicit "reveal" action. A user with the access credential can of course derive/decrypt everything the credential unlocks; design the key scope accordingly.

#### 4. Publishing workflow, retention, revocation, rollback

**Monthly batch (recommended):**

1. On a trusted offline machine, generate 28–31 independent 8-digit PINs with `secrets` (or derive per-day values from a fresh per-month 128-bit seed).
2. Record them in an encrypted vault (age/GPG, VeraCrypt, or a password manager) and optionally print a sealed copy for the publisher.
3. Encrypt each day (or each 3-day window) with AES-256-GCM under a per-day data key; wrap the data keys under the access-credential KEK. Output only ciphertext JSON/HTML.
4. Commit/deploy ciphertext and static code. Run a secret scanner on the build output and the repo before publishing.
5. At the month boundary, change the router's Wi-Fi password. Publish the new day's ciphertext **before** the router change so users are not locked out at midnight.
6. Verify from a clean browser and a second network: no plaintext in HTML/JS/source maps, correct date, decryption works, old page returns 410/404.
7. After a grace period (e.g., 3–7 days), unpublish the old month, purge the CDN, and submit search-engine removal requests. Keep the encrypted archive offline.

**One page per month vs per day:** a month folder with one page per day is easy to navigate and cache. But if all 30 ciphertexts are public, one access-credential leak exposes the month. Prefer a **rolling window**: only yesterday/today/tomorrow exist publicly; the full month exists only in the encrypted offline archive. This also limits damage from a bad deploy.

**Retention and revocation:** deleting a page does **not** revoke a Wi-Fi password. The real revocation is changing the router password (and, if possible, disconnecting/reconnecting clients or using a guest network with a separate password). Old ciphertext can remain in CDN caches, browser caches, search-engine caches, and archives; assume copies exist. Keep old ciphertext only offline and encrypted, and destroy/rotate the corresponding keys when the month ends. If a credential is compromised, rotate the access credential and the router password, re-encrypt the current window, and remove old wrapped keys.

**Rollback after a bad publish:** publish immutable, versioned artifacts (e.g., `/releases/2026-11-04-a/`) and keep the previous release. For a broken page/layout, roll back to the previous artifact, purge the CDN by URL/tag, and verify. For **wrong or leaked secrets**, rollback is not enough: generate a corrected set, update the router, publish forward, and treat the old values as compromised. Never "roll back" to a password that may have leaked just to restore availability.

#### 5. Exposure window: whole month vs today+tomorrow vs seed derivation

| Model | Blast radius if access credential leaks | Availability if publish/cron fails | Offline use | Complexity | Verdict |
|---|---|---|---|---|---|
| Whole month public ciphertext | All 28–31 days | Good; one deploy | Good | Low | Acceptable only with a very strong credential and explicit acceptance; not ideal for family opsec. |
| Today + tomorrow | 1–2 days | Poor: a missed cron locks users out | Poor | Medium | Good security, fragile operations. Add a buffer day. |
| Rolling 3-day window (yesterday/today/tomorrow) | 3 days | Good: one missed day still works | Medium | Medium | **Recommended default.** Small blast radius and operational slack. |
| Derive each day from a per-month seed | Whole month if seed leaks | Good if seed is available offline | Good | Medium–high | Useful for compact storage, but one seed is a month-wide secret; no per-day revocation. |
| Per-day random + per-day keys, rolling window | 3 days | Good | Medium | Medium–high | Best security/ops balance if the key-wrapping is implemented carefully. |

Time zone matters. Define one authoritative time zone (e.g., `Europe/Paris`) and publish yesterday/today/tomorrow in that zone, with the date printed on the page. This handles clock skew, late-night use, and travelers. A user in another time zone should see all three dates.

#### 6. Delivery of the access credential (not the Wi-Fi passwords)

The access credential should be **unique, high entropy, and never sent in the same message as the ciphertext link**. Recommended order of preference:

| Channel | Confidentiality in transit | Persistence / forwarding risk | Recommendation |
|---|---|---|---|
| In person / offline QR code | High | Low if not photographed | Best for initial issuance and recovery. Show it, let the user store it, then destroy the print. |
| Password manager share (expiring link, view limit, access password) | High if the recipient uses a reputable manager | Link can be forwarded; recipient's vault/backup may be compromised | Good for remote delivery. Send the link and its access password via **different** channels. |
| Signal / similar E2EE messenger with disappearing messages | High in transit | Recipient can screenshot/forward; device backup; notification previews | Acceptable for a short-lived pointer or one-time secret, not as long-term storage. |
| WhatsApp | E2EE in transit, but messages persist on devices, may be in cloud backups, are trivially forwarded, and appear on linked devices/desktop | High | **Do not send the access credential or the month's Wi-Fi list here.** If already used, treat the history as exposed and rotate. |
| Email / SMS | Low–medium; plaintext at rest, account takeover, forwarding | High | Do not use for secrets. Email/SMS are fine for "contact me" notifications, not the secret itself. |
| Printed sealed envelope | High physical security | Good if stored safely; can be opened secretly | Best for recovery/break-glass, not for monthly delivery. |

**Risks specific to WhatsApp:** end-to-end encryption protects the transport, not the endpoints. Messages remain in the chat history, can be restored from backups, are included in forwarded messages and group chats, can appear in notification previews, and are accessible on linked devices. A lost phone with an unlocked chat is a full disclosure. Treat any secret sent over WhatsApp as **already disclosed to anyone who later gets the phone, backup, or chat export**.

**How to share a passphrase safely:**

- Generate it with a password manager or `secrets.token_urlsafe(32)`; never reuse the Wi-Fi password or another account password.
- Deliver the **link** via one channel and the **passphrase** via another (e.g., link in Signal, passphrase in person or via a password-manager share). This "split channel" prevents one compromised channel from yielding both.
- Use an expiring, view-limited share (Bitwarden Send, 1Password item share, or similar). Set a short expiry and a maximum access count.
- Ask the recipient to store it in their password manager, confirm receipt, and delete the message. Do not put it in a group chat.
- Beware shoulder surfing: use a privacy screen, type in a private location, mask input by default, and prefer paste from a password manager over reading it aloud. Disable notification previews on the recipient's device.
- For a non-technical recipient, a printed card in a sealed envelope plus a short in-person walkthrough is more reliable than a chat message.

#### 7. Recovery and lockout

NIST SP 800-63-4 treats recovery as a first-class lifecycle event: saved recovery codes should contain at least **64 bits** from an approved random generator, be stored offline, be single-use if verification is possible, and multiple authenticators/recovery contacts are encouraged ([NIST 800-63-4 events](https://pages.nist.gov/800-63-4/sp800-63b/events/)). For this project, map that to:

- **Each authorized user gets their own access credential** (or their own wrapped copy of the current window's keys), not one shared family passphrase. This makes revocation per-person possible: remove their wrapped key and rotate.
- **Each user gets a printed 64-bit+ recovery code**, stored separately from their phone and from the published ciphertext. For a purely static site, a recovery code is effectively a second decryption key; if it leaks, it decrypts the same content. Treat it like a password, and rotate it if used.
- **Two recovery contacts / a backup operator.** One trusted person (e.g., a neighbor or relative) holds a sealed envelope with: the site URL, the current month's access credential (or a stable recovery credential), the emergency Wi-Fi password, and printed instructions. This person is the fallback when the primary user is unavailable.
- **A stable emergency guest network.** If the router supports it, create a separate guest SSID with a long random passphrase that does **not** rotate monthly. Use it only for emergencies (e.g., cousin locked out of both Wi-Fi and site). Keep it on a guest VLAN/isolated network, log/monitor it, and rotate it after any use. This deliberately trades a small permanent exposure for availability; document the trade-off.
- **Do not make email the only recovery path.** Email accounts are lost, compromised, and recovered through their own weak flows. Use printed recovery codes and a recovery contact. NIST explicitly disallows email for out-of-band authentication, though it permits email for some recovery-code delivery with short validity ([NIST 800-63-4 authenticators](https://pages.nist.gov/800-63-4/sp800-63b/authenticators/)).
- **Do not permanently lock accounts on failed attempts.** Rate-limit with backoff; permanent lockout is a denial-of-service vector ([OWASP Forgot Password](https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html)). For a static site with client-side decryption, there is no server to rate-limit, so the KDF cost and high-entropy credential are the only defenses against offline guessing.
- **Lost phone:** password manager on a second device, recovery code in a safe, or recovery contact. Do not rely on SMS 2FA.
- **Lost email:** recovery code or recovery contact; email is not the root of trust.
- **Forgotten passphrase:** use the recovery code, then re-issue a new credential and re-wrap the current window's keys. If the old credential may have leaked, rotate the router password too.
- **Cousin locked out of both Wi-Fi and site:** this is the hardest case and cannot be solved by the website alone. The workable answer is a pre-provisioned emergency envelope plus a backup operator, or the stable guest network. If neither exists, someone with physical access to the router/admin must help; document that as an accepted failure mode rather than pretending the site can recover it.

### Operational checklist

**One-time setup**

- [ ] Confirm router capabilities: WPA3/WPA2, allowed passphrase length, guest SSID/VLAN, scheduled password change, admin recovery.
- [ ] Decide the authoritative time zone and publish schedule (e.g., 00:05 local on the 1st).
- [ ] Choose architecture: static ciphertext + client-side decryption; no plaintext in repo or build.
- [ ] Set up a password manager for the publisher and for each user; enable MFA on the manager.
- [ ] Generate per-user access credentials and 64-bit+ recovery codes; print and seal recovery codes.
- [ ] Recruit a backup operator; give them a sealed envelope and a printed runbook.
- [ ] Configure repo protections: secret scanning, branch protection, signed commits/tags, no secrets in CI variables or logs.
- [ ] Configure hosting: HTTPS/HSTS, CSP, no third-party JS/analytics/session replay on secret pages, custom 404/410, cache policy, purge API if available.
- [ ] Test the full flow from a clean device and a second network.

**Every month**

- [ ] Generate 28–31 PINs offline with `secrets`; validate exactly 8 digits and no accidental duplicates.
- [ ] Encrypt per-day (or per-window) with AES-256-GCM and unique nonces; wrap keys under the access credential.
- [ ] Store plaintext only in the encrypted vault/offline copy; never commit it.
- [ ] Publish ciphertext for the rolling window (yesterday/today/tomorrow) to a versioned path.
- [ ] Run a secret scanner over the repo and built artifacts; inspect the rendered page source for plaintext.
- [ ] Purge the CDN and verify from a clean browser and a second network.
- [ ] Change the router Wi-Fi password at the boundary; confirm old password no longer works.
- [ ] Notify users via the agreed channel (access credential delivered separately); confirm at least one successful login.
- [ ] After the grace period, unpublish the old window, purge, and request search-engine removal.
- [ ] Update the sealed emergency envelope only if the recovery credential or emergency guest password changed.

**Quarterly / on change**

- [ ] Test recovery with a real device: open the envelope, decrypt, connect to Wi-Fi, re-seal.
- [ ] Review who has access; remove departed users' wrapped keys and rotate the access credential.
- [ ] Rotate the emergency guest password if it was used or exposed.
- [ ] Review logs for unexpected access to ciphertext, admin actions, or failed publishes.
- [ ] Update dependencies and re-run the secret scanner.

### Failure modes + mitigations

| Failure mode | Impact | Mitigation / detection |
|---|---|---|
| 8-digit PIN guessed or brute-forced | Wi-Fi access for that day | Short validity; WPA3/rate limiting; longer passphrase if router allows; do not reuse the PIN as the access credential. |
| Modulo bias in generator | Slightly reduced entropy / predictable digits | Use `secrets.randbelow` or rejection sampling; unit-test distribution; never `random`. |
| Plaintext committed to git | Permanent disclosure | Secret scanning + push protection; rotate immediately; assume history/forks/CI caches leaked. |
| Plaintext in static HTML/JS/source map | Public disclosure | Build-time check for 8-digit patterns; no source maps in prod; serve only ciphertext; review `view-source`. |
| CDN serves a deleted/old page | Old password remains available | Versioned URLs, purge API, short TTL, verify from multiple locations; rotate router password, not just delete. |
| Search engine/archive indexes the page | Long-lived copy | `noindex`, unguessable paths, auth if possible; request removal; assume public and encrypt. |
| Analytics/error tracker captures secret | Third-party disclosure | No third-party scripts on secret pages; scrub events; disable session replay; CSP. |
| XSS or malicious third-party JS steals key | Full decryption | CSP, self-hosted JS with SRI, no third-party scripts, strict input handling; client-side crypto cannot save a compromised page. |
| Host/CDN compromised or malicious | Backdoored JS exfiltrates key | Accept host trust or verify signed release hashes; use multiple mirrors; keep the threat model explicit. |
| Access credential sent via WhatsApp | History/backup/forwarding leak | Do not send secrets there; if done, rotate credential and Wi-Fi password; use password-manager share or in-person. |
| Shoulder surfing / notification preview | Local disclosure | Privacy screen, mask by default, private location, disable previews, paste from manager. |
| Lost phone | Lockout and possible disclosure | Password manager on second device; printed recovery code; remote wipe; rotate if unlocked. |
| Lost email | Recovery failure | Recovery code/recovery contact; email not sole root of trust. |
| Forgotten passphrase | Lockout | Recovery code; re-issue credential; re-wrap current keys. |
| User unavailable for days | Cousin locked out of both Wi-Fi and site | Sealed emergency envelope + backup operator; stable guest network; documented escalation. |
| Publish/cron failure | Users cannot get today's password | Rolling 3-day window; monitoring/alert on publish; manual backup publish procedure; offline copy for publisher. |
| Timezone/date mismatch | Wrong day's password | Fixed authoritative TZ; show yesterday/today/tomorrow; print dates; test around midnight and DST. |
| Wrong passwords published | Lockout / incident | Two-person check or checksum; verify one test client before announcing; fix forward and rotate router, do not roll back to leaked values. |
| Old month still valid at router | Old ciphertext remains useful | Change router password at boundary; confirm old password fails; guest network isolated. |
| Recovery code stored with ciphertext | Single leak decrypts everything | Store recovery codes offline, separate physical location; rotate if envelope is opened. |
| Vault/backup compromised | Full historical disclosure | Encrypt backups, MFA on vault, offline copy, minimize retention, rotate affected secrets. |
| Permanent account lockout after failed attempts | Denial of service | Rate-limit with backoff, not permanent lock; for static client-side decryption rely on KDF + strong credential. |

### Evidence

Sources actually consulted:

- Python `secrets` documentation — CSPRNG-backed generation, `randbelow`, token recipes: <https://docs.python.org/3/library/secrets.html>
- MDN `Crypto.getRandomValues()` — cryptographically strong browser randomness, secure-context notes: <https://developer.mozilla.org/en-US/docs/Web/API/Crypto/getRandomValues>
- NIST SP 800-63B (superseded by 800-63-4, but still useful for memorized-secret and lifecycle language): <https://pages.nist.gov/800-63-3/sp800-63b.html>
- NIST SP 800-63-4, Authenticator Event Management — recovery codes ≥64 bits, multiple authenticators, recovery contacts, invalidation: <https://pages.nist.gov/800-63-4/sp800-63b/events/>
- NIST SP 800-63-4, Authenticator and Verifier Requirements — password length (15 single-factor, 8 MFA), rate limiting, password managers, email prohibition for OOB: <https://pages.nist.gov/800-63-4/sp800-63b/authenticators/>
- NIST SP 800-63-4, Strength of Passwords — length/entropy discussion and why composition rules are weak: <https://pages.nist.gov/800-63-4/sp800-63b/passwords/>
- NIST 800-63 FAQ — password expiration/rotation and password-manager guidance: <https://pages.nist.gov/800-63-FAQ/>
- OWASP Secrets Management Cheat Sheet — lifecycle (creation, rotation, revocation, expiration), TLS everywhere, break-glass/backup: <https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html>
- OWASP Forgot Password Cheat Sheet — CSPRNG tokens/PINs, expiry, single use, lockout/rate-limit cautions: <https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html>

Note: WhatsApp Help Center pages did not return content in this pass, so the WhatsApp risk statements above are threat-model reasoning about client-side chat history, backups, forwarding, and linked devices rather than a quoted vendor document. Verify the recipient's backup and linked-device settings directly.

### Open questions

1. What exactly does the router support: WPA3? 8–63 character passphrase? Guest SSID/VLAN? Scheduled password change? Can it show/export the current PSK?
2. Is the site purely static, or is there a server/runtime? If server-side, who operates it, what logs does it keep, and can it rate-limit?
3. How many authorized users are there, and can each have their own credential, or is one shared family credential acceptable?
4. What is the realistic technical literacy of the cousin and other users? Will they use a password manager, or is a printed card/sealed envelope the only workable delivery?
5. Is a stable emergency guest password acceptable, or does the threat model require every Wi-Fi credential to rotate monthly?
6. Does the free host/CDN support cache purge, custom headers (`Cache-Control`, CSP), custom 404/410, and access logs? If not, the rollback/retention plan must assume caches cannot be purged promptly.
7. Is search-engine/archive indexing a concern? `noindex` is advisory; unguessable URLs plus encryption are the real controls.
8. Should the access credential be a memorized passphrase (usability, no manager) or a random token in a password manager (stronger, but recovery depends on the manager)? A hybrid — random token plus printed recovery code — may be best.
9. How should the publisher prove that the deployed ciphertext matches the offline plaintext (checksum, signed manifest, reproducible build)? This matters for detecting a bad or malicious publish.
10. What is the acceptable recovery time when the primary user is unavailable? This drives whether the backup operator holds a full credential or only a break-glass guest password.
