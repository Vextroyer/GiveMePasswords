# Threat Model

- **Product:** Monthly Password Generator, algorithm `HPG-1`
- **Document version:** 1.0 (2026-11-05)
- **Scope:** the static page, the derivation, the recovery code, and the ways a
  user gets the list onto a phone, paper, or chat app.

## 1. What is being protected

| Asset | Where it lives | Why it matters |
|---|---|---|
| A day's Wi-Fi password | Router config, the list, chat/paper | Grants network access for that day |
| The recovery code (the seed) | The user's password manager, paper, or chat | Rebuilds every month derived from it |
| The monthly list | Browser memory, clipboard, file, print | Batch copy of the whole month |
| Router admin credentials | Router only | **Out of scope.** This tool never touches them |

The recovery code is the root secret. Anyone who has it can derive every list
for that seed, past and future, for every month.

## 2. Trust boundaries

```
[ user ] --types--> [ browser tab: HPG-1 JS ] --clipboard/file/share--> [ OS, chat, cloud, paper ]
                          ^
                          | static HTML from GitHub Pages (no server compute)
```

- The **device and browser** are trusted. A compromised device defeats this
  tool.
- **GitHub Pages** serves bytes. It never sees a seed or a derived list.
- There is **no application server**, account, session, database, or secret.
- **No third-party code** runs in the page: no fonts, analytics, CDNs, or
  libraries.
- The **host's access logs** are outside the app's control; see
  [`privacy.md`](privacy.md).
- **GitHub Pages** does not send custom response headers. The only CSP is the
  `<meta>` tag; `frame-ancestors` is ignored in a meta CSP, so the page is
  framable (see threat 18).

## 3. Attacker profiles

| Actor | Capability | Goal |
|---|---|---|
| Casual neighbor / visitor | Guesses a password at the router login, or asks for the Wi-Fi | Free network access |
| Someone who knows the user | Social access, may see a phone, a note, or a printed list | Access, curiosity, or malice |
| Network attacker | Captures a WPA handshake or observes traffic | Crack the Wi-Fi password offline |
| Shoulder surfer | Sees the screen, a printout, or a clipboard | Read a day's password or the code |
| Malicious host or dependency | Controls the served page | Exfiltrate seeds |
| Browser extension / malware | Reads the DOM, clipboard, or keystrokes | Exfiltrate seeds and lists |
| Phishing clone | Copies the UI at another URL | Collect seeds from users |

## 4. Threats and mitigations

| # | Threat | Likelihood | Impact | Mitigation in this project | Residual risk |
|---|---|---|---|---|---|
| 1 | Neighbor guesses the current Wi-Fi password online | Medium | Network access | 8 digits = 10^8 values, changed daily; the router should rate-limit or lock out. WPA3/SAE resists offline guessing better. | If the router allows unlimited online attempts, guessing is practical over time. Use a long passphrase or WPA3 with a strong key. |
| 2 | Captured WPA handshake cracked offline | Medium | Network access | None from HPG-1. The generator does not change WPA cryptography. | **High.** 26.6 bits is crackable. This tool is convenience, not strong Wi-Fi security. |
| 3 | Someone who knows the user obtains the recovery code | Medium | Every month is derivable | The code is shown only during the ceremony and behind a details panel; copy says keep it private; rotate action | Social engineering and shared devices remain. Rotation does not protect months already derived from the old seed. |
| 4 | Shoulder surfing at the ceremony, list, or printout | Medium | One day or the whole list | Ceremony is a deliberate step; print hides the code; no code in the list export | A photographed screen or paper is not detectable. |
| 5 | Host or CDN compromised and serves malicious JS | Low–Medium | Seed exfiltration | Static artifact, zero runtime dependencies, strict CSP with pinned hashes, published SHA-256, offline copy, `make verify-build` | If the host serves different bytes and the user does not verify the hash, the attacker wins. |
| 6 | Browser extension reads the DOM or clipboard | Medium | Seed/list exfiltration | None possible from inside the page | Extensions with page access can read everything. Use a clean profile or the offline copy. |
| 7 | Device malware or keylogger | Low–Medium | Everything | None | Out of scope. |
| 8 | Clipboard read by another app or synced by the OS | Medium | List/code exposure | Copy actions name what was copied; the code is copied only on request | OS clipboard history and Universal Clipboard are outside the app. |
| 9 | Chat/notes backup syncs the list to the cloud | High | Long-lived plaintext in a backup | The UI keeps one factual limitation line; the full file-or-printout guidance lives in the docs | The user may still use WhatsApp; the copy persists on Meta infrastructure. |
| 10 | Wrong-but-valid recovery code | Medium | Plausible wrong list; the router rejects passwords | Checksum detects most typos; the UI omits the fingerprint by design (D1=A); compare a known day's password and check the month | A valid code for a different seed cannot be detected from the code. Accepted residual risk. |
| 11 | Wrong month selected | Medium | Wrong day's password; possible router lockout | Month appears in the title, caption, export header, share text, and filename; today is marked | A user can still ignore the label. |
| 12 | Two days get the same password | Low (≈0.0004% per month) | Confusing but functional | Accepted and documented; no dedupe | None. Dedupe would bias the distribution. |
| 13 | Lost recovery code | High | The list cannot be rebuilt | Blocking ceremony, copy + download, an explicit "I saved it" checkbox, code shown again on the list screen | If the user loses every copy, there is no recovery. |
| 14 | Phishing clone collects seeds | Medium | Full compromise of that user's lists | Canonical URL, published hash, no analytics, verification instructions | Users who do not check the URL or hash can be fooled. |
| 15 | Router rejects leading zeros or 8 digits | Medium | A day's password cannot be set | Format pinned; router compatibility is untested; an additive "first digit 1–9" mode is a possible future change | Not yet verified on representative consumer routers. |
| 16 | Changing the Wi-Fi password logs out the router admin session | Medium | The user is locked out mid-change | Operational guidance: make the change last, keep a wired connection, or log in again | Router-specific behavior; documented in the QA record. |
| 17 | Offline copy fails because `crypto.subtle` needs a secure context | Low | No output | The app checks and fails closed with a message | Some browsers refuse WebCrypto on `file://`. Use the hosted HTTPS page or a local server. |
| 18 | Clickjacking / UI redress because the page can be framed | Low–Medium | A user could be tricked into clicking through a transparent frame | No `X-Frame-Options` is sent by GitHub Pages; `frame-ancestors 'none'` in the meta CSP is ignored by browsers | The page is framable. Use a header-capable host if clickjacking becomes a real concern. |

## 5. Security properties HPG-1 does provide

- **Determinism:** the same seed and month always produce the same list.
- **Domain separation:** month, day, and attempt are bound into the HKDF info
  string, so days and months do not collide by construction.
- **Uniformity:** rejection sampling removes modulo bias; each accepted value is
  uniform over `0..99,999,999`.
- **Typo detection:** a 10-bit checksum on the recovery code catches most
  transcription errors.
- **No transport of secrets:** the seed never leaves the tab; there is no
  network request and no storage API.
- **Reproducible artifact:** the build is deterministic, the hash is published,
  and CSP hashes pin the exact inline code.

## 6. Non-goals and honest limits

HPG-1 does **not** provide:

- Authentication of the user or the page.
- Secrecy from anyone who has the seed or the recovery code.
- Revocation. You cannot invalidate a leaked code; you can only rotate to a new
  one, which does not protect months already derived from the old seed.
- Forward secrecy. A leaked seed reveals past and future months.
- Recovery. There is no escrow, reset, or account support.
- Strong entropy. An 8-digit password has about 26.6 bits; a determined offline
  attacker can exhaust it.
- Protection from host compromise, malicious extensions, device malware, or
  router vulnerabilities.

## 7. Assumptions

1. The seed comes from `crypto.getRandomValues` (128 bits); the reference app
   never derives it from a weak passphrase.
2. The browser's CSPRNG and HKDF implementation are not backdoored or broken.
3. The user stores the recovery code somewhere they can find it, and keeps it
   away from people who should not have the Wi-Fi.
4. The router's WPA mode and password policy are configured sensibly; this tool
   does not manage the router.
5. The user verifies the artifact hash if they are relying on the public host
   for a high-value network.

## 8. Review

Re-review this model when any of the following changes: the derivation version,
the code format, the hosting provider, the build pipeline, the UI flow, or the
router. A new algorithm version requires a new threat-model entry, not an edit
to the frozen HPG-1 section.
