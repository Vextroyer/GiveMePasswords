---
id: report-public-password-generator
created: 2026-11-04
type: research
status: active
sources:
  - https://datatracker.ietf.org/doc/html/rfc5869
  - https://www.w3.org/TR/WebCryptoAPI/
  - https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/deriveBits
  - https://developer.mozilla.org/en-US/docs/Web/API/Crypto/getRandomValues
  - https://developer.mozilla.org/en-US/docs/Web/Security/Defenses/Secure_Contexts
  - https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CSP
  - https://developer.mozilla.org/en-US/docs/Web/Security/Defenses/Subresource_Integrity
  - https://developer.mozilla.org/en-US/docs/Web/API/Web_Share_API
  - https://developer.mozilla.org/en-US/docs/Web/API/Clipboard_API
  - https://developer.mozilla.org/en-US/docs/Web/API/Window/print
  - https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps
  - https://cheatsheetseries.owasp.org/cheatsheets/Content_Security_Policy_Cheat_Sheet.html
  - https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html
  - https://reproducible-builds.org
  - https://developers.cloudflare.com/pages/platform/limits/
  - https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits
  - https://www.netlify.com/pricing/
  - https://surge.sh/pricing
  - https://lesspass.com
  - https://github.com/lesspass/lesspass
  - https://github.com/lesspass/lesspass/blob/master/doc/algorithm.md
  - https://github.com/lesspass/lesspass/issues/88
  - https://masterpassword.app
  - https://spectre.app
  - https://bitwarden.com/password-generator/
  - https://www.passwordcard.org/
  - https://www.eff.org/dice
  - https://github.com/antelle/argon2-browser
---

# Research: A Public, Client-Side Monthly Password Generator

## Executive Summary

The proposal is coherent, but only after one correction that the research makes
unavoidable: **"random" and "seeded" must be the same engine, and the random mode must
display a recovery code.** A genuinely random list that cannot be reproduced makes
"generate a new one tomorrow" meaningless — tomorrow's list would not match the router.
If random mode instead generates a fresh 128-bit seed, derives the list from it, and shows
that seed as a recovery code, then both modes collapse into one deterministic function:
`(seed, month, version) → 30/31 eight-digit passwords`. That is the architecture the rest
of this report assumes.

The architecture is genuinely attractive because it removes the exact blocker found in the
previous research. There is **no server-side secret, no account, and no storage**, so the
site does not need Cloudflare Access (which cannot protect a free `pages.dev` hostname) and
does not need a custom domain. Everything is generated in the browser; the server only
serves a static file. "Public website" does **not** mean "public password list": the seed
is the only boundary, and anyone without it sees nothing. The trade-off is equally stark —
there is no authentication, no revocation, and no way to distinguish the cousin from
anyone else who has the seed.

The crypto is the easy part. The hard parts are **trust and UX**. A public tool that asks
users to type a seed is a perfect phishing and supply-chain target: a compromised static
host or a malicious dependency can exfiltrate every seed without breaking any cipher.
Client-side encryption does not fix that. The practical security boundary is therefore the
integrity of the domain and the auditability of a tiny, dependency-free artifact. On the
human side, the failure modes are losing the recovery code, choosing the wrong month,
mistyping a seed, and accidentally generating a new list. A product that gets the
derivation right but the ceremony wrong will still lock the cousin out of her own Wi-Fi.

The honest verdict: this is a **useful niche utility and a good personal tool**, not a
business. LessPass already covers the single-password case; the only real gap is the
**monthly batch sheet** — twelve labelled PINs, printable and reproducible from one seed,
with nothing stored. That is a thin but real workflow product. It is worth building if the
goal is to remove the user as the monthly bottleneck and to give the cousin a stable,
self-service artifact. It is not worth building as a growth product, and it does not make
8-digit Wi-Fi passwords secure.

## Key Findings

### 1. Both modes must be one deterministic engine; random mode must show a recovery code

A non-reproducible random list cannot satisfy the user's own workflow. If the cousin
generates a new list tomorrow, it will not match the passwords already applied to the
router. The only coherent model is: **random mode = app-generated seed**, displayed as a
recovery code; **seeded mode = user-supplied seed**. Both feed the same derivation. This
also means there is one algorithm, one test suite, and one UI to maintain.

- **Evidence:** RQ1 note, definitions and user-flow table; RQ2 note, recommendation
  section.
- **Implication:** do not ship a "generate a random list" button that produces an
  unrecoverable list. Label the two doors as **"Create a new list"** and **"I have a
  recovery code"**, and make the recovery code appear before the list is revealed.
- **Links:** [`01-product-model.md`](research-public-password-generator/01-product-model.md),
  [`02-deterministic-vs-random.md`](research-public-password-generator/02-deterministic-vs-random.md).

### 2. The derivation is now pinned and cross-verified

The proposed scheme is **HPG-1**: a 128-bit seed, HKDF-SHA-256, `YYYY-MM` and day as
domain-separated inputs, rejection sampling into `0..99,999,999`, and zero-padded output.
Two independent implementations (Python `hmac`/`hashlib` and Node WebCrypto) agree
byte-for-byte on full months. The RFC 5869 A.1 vector reproduces exactly, and the rejection
path is pinned with a real case (`2020-02-14`, attempt 0 rejected, attempt 1 → `81039139`).

The research also caught a real bug: the scout's two-step WebCrypto snippet is **not**
equivalent to the written pseudocode. WebCrypto's `deriveBits` performs the whole HKDF
(Extract + Expand); using a first call to compute a "PRK" and a second call for the output
produces a nested HKDF. On the pinned vector it yielded `59423284` instead of `52296676`.
The correct form is a single `deriveBits` call with the seed as IKM and `HPG-1|seed` as the
salt.

- **Evidence:** RQ2 note, corrected reference code and pinned vectors; `.playground/hpg/`
  contains the executable Python and Node references used to verify them.
- **Implication:** commit `test-vectors.json` and run it in CI on every browser target.
  The derivation is easy; silently diverging implementations are the real risk.
- **Links:** [`02-deterministic-vs-random.md`](research-public-password-generator/02-deterministic-vs-random.md);
  <https://datatracker.ietf.org/doc/html/rfc5869>.

### 3. "Public site" does not mean "public list" — the seed is the whole security boundary

The server never sees the seed, the month, or the list. What the host sees is an IP
address, a user agent, and a request for a static file. There is nothing to breach, no
database to leak, and no account to take over. That is a genuine architectural win.

But the same property means there is **no authentication and no revocation**. Anyone
holding the recovery code can regenerate every password for that seed and month. Anyone
without it sees nothing. The cousin is not "logged in"; she simply possesses the secret.
If the requirement is "only she can see it", that is satisfied in the sense that a stranger
with the URL cannot. It is not satisfied in the sense of identity, audit, or the ability to
cut off access — there is nothing to cut off except the seed itself.

- **Evidence:** RQ1 privacy and threat-model sections; RQ3 threat model (assets and
  actors); RQ4 authentication discussion.
- **Implication:** state the model plainly in the UI: *"This page is public. Your list is
  not stored here. The code is the only thing that protects it."* Do not imply that the
  site operator can recover, revoke, or identify anything.
- **Links:** [`01-product-model.md`](research-public-password-generator/01-product-model.md),
  [`03-client-side-security.md`](research-public-password-generator/03-client-side-security.md).

### 4. The dominant threat is the host and the supply chain, not the cipher

A public site that generates secrets is a high-value target. An attacker who controls the
served JavaScript can simply read the seed as it is typed and send it anywhere. CSP, SRI,
and client-side crypto do not help: the attacker controls the page that carries the policy.
The same is true of a malicious dependency, a compromised build pipeline, or a compromised
maintainer account.

The defensible answer is structural, not cryptographic: **one self-contained HTML file with
zero runtime dependencies and zero third-party requests**, built reproducibly, published
with a hash and a signed tag, and offered as a downloadable offline copy. That reduces the
attack surface to the host and the build, and gives motivated users a way to step outside
the host's trust entirely.

- **Evidence:** RQ3 note, threat model T3/T4/T11 and residual risks 1–4; RQ5 note,
  recommendation and licensing.
- **Implication:** every dependency is a security decision. Do not add analytics, remote
  fonts, a QR API, or a PDF library. Inline the CSS and JS, use system fonts, and keep the
  artifact small enough to audit in one sitting.
- **Links:** [`03-client-side-security.md`](research-public-password-generator/03-client-side-security.md),
  [`05-prior-art-hosting-viability.md`](research-public-password-generator/05-prior-art-hosting-viability.md);
  <https://reproducible-builds.org>.

### 5. Seed lifetime is the central product trade-off

A **long-lived seed** removes the monthly send entirely: the cousin keeps one code and
generates any month. If that code leaks, however, every month it can derive is exposed —
not just the current one. A **per-month seed** limits the blast radius to one month but
reintroduces a monthly exchange, which is the exact work the user wants to eliminate.

This is not a cryptographic question; it is a product decision. The previous research's
"rolling 3-day window" advice does not transfer directly, because the constraint here is
different: the whole point is to stop sending a monthly artifact. The honest options are:

| Model | Monthly work | Blast radius if leaked | Fit |
|---|---|---|---|
| One long-lived seed | None | All months derivable from it | **Best for the stated goal** |
| Per-month seed | Send a new code each month | One month | Better security, defeats the purpose |
| Long-lived seed + rotation | None until rotated | Current seed's lifetime | **Recommended default**, with a visible "rotate" action |

- **Evidence:** RQ2 note, seed lifetime and recommendation; RQ1 note, recovery and
  requirements; RQ4 note, mode UX.
- **Implication:** default to one long-lived seed, store it in a password manager rather
  than a chat, and offer an explicit rotation that invalidates the old code. If the cousin
  is willing to receive a code monthly, offer per-month seeds as an option — but be honest
  that it restores the monthly send.
- **Links:** [`02-deterministic-vs-random.md`](research-public-password-generator/02-deterministic-vs-random.md),
  [`04-delivery-storage-ux.md`](research-public-password-generator/04-delivery-storage-ux.md).

### 6. UX failure modes will cause more lockouts than cryptography

The research identified a consistent set of high-likelihood failures: the user taps "new
list" thinking it regenerates the old one; the recovery code is lost; a seed is mistyped
but still produces a plausible-looking list; the wrong month is copied; leading zeros are
dropped by a spreadsheet; WhatsApp or the share sheet truncates the list; a screenshot
becomes the only copy and syncs to the cloud. None of these are exotic. They are the normal
behaviour of a non-technical user on a phone.

The strongest mitigation is a **blocking recovery-code ceremony** before the list is
revealed: show the code, require copy or download, require an "I have saved this code"
confirmation, and only then show the list. The second strongest is to put the month and a
seed fingerprint in every copy, filename, print footer, and share payload.

- **Evidence:** RQ4 note, UX failure-mode table (15 entries) and recommended flow.
- **Implication:** treat the ceremony as a security control, not a nuisance. A tool that
  reveals 30 passwords before the user has saved the only key to them is designed to lose
  data.
- **Links:** [`04-delivery-storage-ux.md`](research-public-password-generator/04-delivery-storage-ux.md).

### 7. 8-digit numeric is weak by construction, and the product must say so

Eight digits give `10^8` values, or **≈26.6 bits**. Against an offline WPA2 handshake,
commodity hardware can exhaust that space on the order of minutes (an order-of-magnitude
estimate; the exact figure depends on the attacker's hardware and the router's WPA mode).
WPA3-SAE changes the picture because guessing requires an online exchange, but only if
every device supports it. The tool cannot fix the router, and it must not pretend that
daily rotation makes an 8-digit code strong.

This is a **rotation/convenience tool**, not a security upgrade. Its honest claim is: *"It
generates and organises the daily codes; it does not make an 8-digit Wi-Fi password safe
against a determined attacker."* The public page should also say that the tool is not for
email, banking, or account passwords.

- **Evidence:** RQ1 note, entropy and rotation; RQ3 note, residual risk 6; RQ5 note,
  "who will not use it".
- **Implication:** put the entropy warning on the page, not only in the FAQ. Recommend
  WPA3 and a longer passphrase for the main SSID as the real security improvement.
- **Links:** [`01-product-model.md`](research-public-password-generator/01-product-model.md),
  [`03-client-side-security.md`](research-public-password-generator/03-client-side-security.md).

### 8. The gap is the monthly artifact, not the derivation

LessPass already does stateless deterministic derivation with a digits-only length-8
profile and a counter. Spectre/Master Password does the same with templates. Bitwarden and
browser generators produce one random password at a time. None of them produces a
**month-labelled batch of PINs, printable on one page, reproducibly derived from one seed,
with no storage**. That is the actual product.

It is a thin gap: a workflow and presentation layer over a well-known primitive. It is easy
to clone, hard to differentiate, and unlikely to become a business. It is nonetheless
useful to a specific audience: people managing shared low-value numeric codes, rental
properties, club/gate codes, and offline/paper backups. The cousin is a real instance of
that audience.

- **Evidence:** RQ5 note, prior-art table, gap analysis, and viability verdict.
- **Implication:** do not claim cryptographic novelty. Compete on the artifact, the
  ceremony, and trust signals (open source, test vectors, no analytics). If the only user
  is the cousin, a private page is strictly simpler than a public launch.
- **Links:** [`05-prior-art-hosting-viability.md`](research-public-password-generator/05-prior-art-hosting-viability.md);
  <https://lesspass.com>, <https://spectre.app>.

### 9. Cloudflare Pages is the right free host; GitHub Pages is a policy risk

Cloudflare Pages serves static assets with free, unlimited requests, automatic TLS, a
global CDN, preview deployments, and `_headers` for CSP and cache control. It supports a
free `*.pages.dev` hostname, which is sufficient because this architecture does not need
Cloudflare Access or a custom domain. Netlify's free tier is now a 300-credit budget, not
unlimited. GitHub Pages has a 100 GB/month soft bandwidth limit and terms that explicitly
discourage using it for "sensitive transactions like sending passwords"; it is a poor fit
for a public password tool. Surge is simple but CLI-only and less transparent about
headers.

- **Evidence:** RQ5 note, hosting table; Cloudflare Pages limits; GitHub Pages limits;
  Netlify pricing.
- **Implication:** deploy the single-file artifact from a public repo to Cloudflare Pages.
  Add a custom domain later only if the tool earns real users; it is a trust signal, not a
  technical requirement.
- **Links:** [`05-prior-art-hosting-viability.md`](research-public-password-generator/05-prior-art-hosting-viability.md);
  <https://developers.cloudflare.com/pages/platform/limits/>.

### 10. The notes contain several contradictions that must be resolved before design

The scouts worked independently, and their recommendations do not fully agree. The
important conflicts are:

| Topic | One note says | Another says | Resolution |
|---|---|---|---|
| Seed size | 32 random bytes (RQ1) | 16 bytes / 128 bits (RQ2) | **16 bytes.** 128 bits is ample; a shorter code is better UX. |
| Month in the recovery code | Embed the month (RQ1) | Long-lived seed, month as HKDF input (RQ2) | **Do not embed the month** if the code is meant to be reused; the month is an explicit input. Embedding it is only right for a per-month code. |
| KDF | PBKDF2 600k or Argon2id (RQ1) | HKDF for a random code; PBKDF2 only for a passphrase (RQ2) | **HKDF for the code; PBKDF2 once per list for an optional passphrase.** Do not add Argon2/WASM in v1. |
| Unicode normalisation | NFKD (RQ1) | NFC (RQ2) | **NFC**, specified in the version. It only matters if passphrase mode ships. |
| Duplicates | Accept them; do not dedupe (RQ1) | Retry when a day repeats an earlier day (RQ2) | **Accept duplicates in v1.** A retry rule makes day N depend on days 1..N-1, breaking independent derivation for a ~4e-6 event. |
| Recovery code ceremony | Show it behind a warned affordance (RQ1) | Blocking ceremony before the list (RQ4) | **Blocking ceremony.** The code is the only recovery path. |

- **Evidence:** cross-reading of the five notes; the contradictions are visible in the
  definitions and recommendations.
- **Implication:** design must pick one answer per row and write it into the spec. The
  duplicate rule and the month-in-code rule are the two that most affect the
  implementation.
- **Links:** [`01-product-model.md`](research-public-password-generator/01-product-model.md),
  [`02-deterministic-vs-random.md`](research-public-password-generator/02-deterministic-vs-random.md).

## Recommendations

1. **Build one engine, `HPG-1`, and expose it as two doors.** Random mode generates a
   16-byte seed with `crypto.getRandomValues`, derives the list, and shows the seed as a
   recovery code. Seeded mode accepts that code. The month is always an explicit,
   user-confirmed `YYYY-MM`; never infer it from the clock in the derivation path.

2. **Ship a single self-contained HTML file with zero runtime dependencies.** Inline CSS
   and JS, system fonts, no analytics, no third-party requests, no service worker in v1.
   Serve it from Cloudflare Pages with a strict CSP (`default-src 'none'`,
   `connect-src 'none'`, hashed script), HSTS, `Referrer-Policy: no-referrer`, and
   `X-Content-Type-Options: nosniff`. Publish the SHA-256 of the artifact and offer a
   downloadable copy.

3. **Make the recovery-code ceremony blocking.** Before revealing the list, show the code,
   offer copy and download, and require an explicit "I have saved this code" confirmation.
   Put the month and a short seed fingerprint in the header, the copied text, the
   filename, and the print footer. Never put the seed itself in the printout or the share
   text unless the user explicitly chooses to.

4. **Default to one long-lived seed, with a visible rotation action.** Explain the
   trade-off in one sentence: *"One code works for every month; if it leaks, every month it
   can generate leaks with it."* Offer a per-month code as an advanced option for users who
   accept a monthly exchange. Store the code in a password manager, not in WhatsApp.

5. **Never persist the seed or the list.** Keep them in memory; do not put them in the URL,
   query string, fragment, `localStorage`, `sessionStorage`, IndexedDB, cookies, logs, or
   analytics. If you add a "remember on this device" feature, make it opt-in, encrypted
   with a passphrase, and clearly labelled as a different threat model.

6. **Design for the phone first and the failure modes first.** Two doors ("Create a new
   list" / "I have a recovery code"), a month picker with the month repeated everywhere, a
   reveal toggle on the seed, a seed fingerprint after entry, copy-all and print, and a
   `navigator.share` path that prefers a file. Offer a "today + tomorrow" view as the
   default and a full-month export as an option; a whole month in WhatsApp is a long-lived
   plaintext record.

7. **Verify the router before shipping.** Confirm that it accepts exactly eight digits,
   that it preserves leading zeros, whether it rejects repeats or the previous password,
   and whether changing the Wi-Fi password logs out the admin session. If leading zeros are
   a problem, restrict the first digit to 1–9 and document the slightly reduced entropy.

8. **Publish the trust artifacts.** A `test-vectors.json` covering the RFC vector, the
   pinned HPG-1 vectors, the rejection path, and the passphrase variant; a short threat
   model; a privacy policy that says what the host logs; a `SECURITY.md`; and a `CHANGELOG`
   with the algorithm version. Display the version and build hash in the app.

9. **Decide public vs. personal deliberately.** A personal tool needs none of the public
   machinery. A public utility needs an FAQ, a support channel, a licence (MIT or
   Apache-2.0), an acceptable-use note, and i18n from day one — including RTL/Arabic if the
   audience needs it. Public also means you will be answering "can you recover my seed?"
   forever; the answer is no.

10. **Keep the honest disclaimer on the page.** *"8-digit numeric codes are low-entropy
    (~26.6 bits). This tool organises daily Wi-Fi rotation; it does not make them safe
    against a determined attacker or a captured WPA handshake. It is not for email,
    banking, or account passwords. There is no recovery if you lose the code."*

## Further Reading

- RFC 5869, *HMAC-based Extract-and-Expand Key Derivation Function (HKDF)*:
  <https://datatracker.ietf.org/doc/html/rfc5869>
- W3C Web Cryptography API and MDN `deriveBits`:
  <https://www.w3.org/TR/WebCryptoAPI/>,
  <https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/deriveBits>
- LessPass algorithm and the project's own collision note:
  <https://github.com/lesspass/lesspass/blob/master/doc/algorithm.md>,
  <https://github.com/lesspass/lesspass/issues/88>
- Spectre / Master Password:
  <https://spectre.app>
- OWASP Content Security Policy and XSS prevention cheat sheets:
  <https://cheatsheetseries.owasp.org/cheatsheets/Content_Security_Policy_Cheat_Sheet.html>,
  <https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html>
- Reproducible Builds:
  <https://reproducible-builds.org>
- Cloudflare Pages limits:
  <https://developers.cloudflare.com/pages/platform/limits/>
- MDN Web Share, Clipboard, Print, and PWA:
  <https://developer.mozilla.org/en-US/docs/Web/API/Web_Share_API>,
  <https://developer.mozilla.org/en-US/docs/Web/API/Clipboard_API>,
  <https://developer.mozilla.org/en-US/docs/Web/API/Window/print>,
  <https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps>
- EFF Diceware (for the optional passphrase mode):
  <https://www.eff.org/dice>

## Follow-up Questions

1. **Router constraints:** does the admin UI accept exactly eight digits? Leading zeros?
   Does it reject the previous password or any repeat? Does changing the Wi-Fi password
   invalidate the admin session?
2. **Cousin's literacies and language:** does she prefer a long code, a short passphrase, or
   a printed sheet? Is the UI language English, Arabic, or both? Does she use WhatsApp
   "message yourself", Notes, or paper?
3. **Seed lifetime:** is she willing to keep one long-lived code (no monthly send), or does
   she prefer a new code every month (smaller blast radius, but the monthly exchange
   returns)?
4. **Public vs. personal:** is the public utility a real goal, or is it incidental? If it is
   real, who maintains it, answers support, and handles security reports?
5. **Custom domain:** is a `*.pages.dev` URL acceptable for trust, or does the tool need a
   neutral custom domain to avoid looking like a phishing clone?
6. **Month semantics:** does she change the password at a fixed local time, or could the
   "day" boundary drift? Does she ever skip days or change the password mid-month?
7. **Sharing:** does anyone else need the list (family, guests)? If so, should the tool
   support sharing the derived list without sharing the seed?
8. **Recovery:** if she loses both the list and the code, is "start over with a new seed and
   a new router password" acceptable? Who is the backup operator if the user is
   unavailable?
9. **Distribution:** should the tool be installable as a PWA, or is a plain static page
   enough? Is an offline single-file build required for users who do not trust the host?
10. **Scope:** should v1 stay fixed at 8 digits, or should the public utility support
    4–12 digits and alphanumeric output? Every added option must be versioned into the
    derivation.

---

## Appendix — Pinned `HPG-1` vectors (verified)

These were produced by two independent implementations and agree byte-for-byte. The
executable references are in `.playground/hpg/derive.py` and `.playground/hpg/derive.mjs`.

**Scheme.** `seed` = 16 bytes; `salt = UTF8("HPG-1|seed")`;
`info = UTF8("HPG-1|YYYY-MM|DD|attempt")`; `okm = HKDF-SHA-256(salt, seed, info, 8 bytes)`;
`x = uint32_be(okm[0..3])`; reject and increment `attempt` if `x >= 4_200_000_000`;
`password = zero_pad_decimal(x mod 100_000_000, 8)`.

| Input | Output |
|---|---|
| RFC 5869 A.1 PRK | `077709362c2e32df0ddc3f0dc47bba6390b6c73bb50f9c3122ec844ad7c2b3e5` |
| RFC 5869 A.1 OKM (42 bytes) | `3cb25f25faacd57a90434f64d0362f2a2d2d0a90cf1a5a4c5db02d56ecc4c5bf34007208d5b887185865` |
| Mapping check (`x = 1018322725`) | `18322725` |
| `seed=000102…0e0f`, `2026-11-01` | `52296676` |
| `seed=000102…0e0f`, `2026-11-02` | `59443424` |
| `seed=000102…0e0f`, `2026-11-30` | `07134458` |
| `seed=000102…0e0f`, `2026-12-01` | `78951395` |
| `seed=ffeedd…1100`, `2026-11-01` | `74165350` |
| Rejection: `seed=000102…0e0f`, `2020-02-14`, attempt 0 | `x = 4261244084` → rejected |
| Rejection: same, attempt 1 | `81039139` |
| Optional passphrase `HPG-1P`, `"correct horse battery staple"`, `2026-11-01` | `95815836` |
| Optional passphrase `HPG-1P`, `2026-11-02` | `01118685` |
| Optional passphrase `HPG-1P`, `2026-11-30` | `54100542` |

**Optional `HPG-1P` root:** `PBKDF2-SHA-256(passphrase NFC, salt = "HPG-1P|root",
iterations = 600_000, dkLen = 32)` =
`996317a57cefae628f375258f012fa0aaf5779153f584a144dc493ad2b41b84e`; per-day derivation
uses `HKDF-SHA-256(salt = "HPG-1P|day", ikm = root,
info = "HPG-1P|YYYY-MM|DD|attempt", 8 bytes)` and the same rejection mapping. Derive the
root **once per list**, not once per day: at the measured 342 ms per derivation, 31 ×
600k PBKDF2 would cost roughly 10 s. Derive the root once and reuse it.

**Correction to the scout's JS.** Do not split the derivation into two `deriveBits` calls.
WebCrypto's HKDF does Extract+Expand in one call. The correct form is:

```js
const key = await crypto.subtle.importKey("raw", seed, "HKDF", false, ["deriveBits"]);
const okm = new Uint8Array(await crypto.subtle.deriveBits(
  { name: "HKDF", hash: "SHA-256",
    salt: new TextEncoder().encode("HPG-1|seed"),
    info: new TextEncoder().encode(`HPG-1|${month}|${day}|${attempt}`) },
  key, 64));
```

The two-step form produced `59423284` on the `2026-11-01` vector; the correct form produces
`52296676`. Any implementation carrying the two-step form will silently generate a
different, unusable list.
