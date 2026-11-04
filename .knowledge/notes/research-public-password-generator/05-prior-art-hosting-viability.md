---
id: rq5-prior-art-hosting-viability
created: 2026-11-04
type: research-note
status: active
parent: research-public-password-generator
question: "Does this already exist, what is the gap, and what does it cost to run a public stateless tool?"
tags: [prior-art, hosting, public-utility, maintenance]
---

# RQ5 — Prior art and public-utility viability

## Context

- The product is a public, stateless, client-side monthly password list generator with
  random and seeded/reproducible modes.
- Audience: both a personal workflow and a general public utility.
- Budget: free (from the previous research); no server, no accounts, no storage.

## Sub-questions

1. **Existing tools:** LessPass, Master Password, Bitwarden's generator, browser password
   generators, deterministic password managers, password-schedule tools, printable password
   cards. What do they do, what do they not do, and what is the actual gap?
2. **Differentiation:** is "monthly schedule + 8-digit numeric + seed recovery + no storage"
   a real gap, or a thin wrapper over existing generators? Who would use it besides the
   cousin?
3. **Hosting:** Cloudflare Pages (free static, unlimited requests), GitHub Pages, Netlify,
   Surge. Which is best for a public static PWA with no backend? TLS, custom domain
   (optional), preview URLs, cache control.
4. **Discoverability vs privacy:** should the site be indexed? A public utility benefits
   from SEO; a personal tool benefits from `noindex`. Can both coexist (public landing page,
   unguessable app path)?
5. **Abuse and limits:** a static site has no server compute to abuse, but it can be used to
   generate passwords for malicious purposes. Is that a concern? DDoS is absorbed by the CDN.
   What about rate limits, bots, and scraping?
6. **Privacy/legal:** no data collection; GDPR/CCPA; cookies; analytics; a privacy policy
   and disclaimer ("we cannot recover your seed or list").
7. **Licensing:** MIT/Apache for the app; licenses of crypto libraries (WebCrypto is
   browser-native; WASM Argon2 has its own license).
8. **Maintenance:** dependency updates, algorithm versioning, browser changes, security
   disclosures, support burden, documentation, i18n.
9. **Public vs personal:** what changes when strangers use it — support, abuse reports,
   uptime expectations, trust signals, transparency.
10. **Recommendation:** MVP scope, hosting choice, licensing, and a maintenance plan.

## Scout brief

Prioritize questions 1, 2, 3, and 9. Verify current features and free-tier limits against
official pages/repositories. Be honest if the gap is thin: a public random password generator
is a commodity, and the research should say so if the monthly-schedule angle is not enough
to justify a public product.

## Findings (scout output)

### Summary

The technology is commodity; the product is a workflow. Every individual ingredient already exists: deterministic password derivation (LessPass, Spectre/Master Password), 8-digit numeric output (any generator with a digits-only charset), monthly rotation (a counter field), and printable password cards. What does **not** exist as a packaged tool is a **batch, printable, month-labelled sheet of 8-digit PINs reproducibly derived from one seed, with no storage**. That is a real but narrow gap — a presentation/workflow product, not a cryptographic one. Public-utility viability is therefore modest: cheap to host and low-abuse, but hard to differentiate and hard to earn trust. Best treated as a free, open-source niche utility or a personal tool, not a startup.

### Prior art

| Tool | What it does | Reproducible from secret? | Monthly schedule / batch | 8-digit numeric | Storage | Gap vs. us |
|---|---|---|---|---|---|---|
| **LessPass** (GPL-3.0; ~6.1k stars) | Stateless password manager. Derives one password from master password + site + login + counter; web app, extensions, CLI, mobile. | Yes — same inputs → same output. Counter can be incremented manually for rotation. | No batch/sheet; counter is per-site, not a month grid. | Yes: length and character set are configurable, including digits-only length 8. | None (server optional; new server registrations closed). | Covers most of the *single* monthly 8-digit use case already. Missing: batch list, month labels, printable artifact, seed-as-list-key. |
| **Master Password / Spectre** | Stateless "password cipher": full name + secret + site + counter → one site password. Master Password now redirects to Spectre; apps/CLI/API, free software. | Yes, by design; counter/version controls rotation. | One password per site; no batch or calendar. | Template-driven (Long/Medium/Short/Basic/PIN), not arbitrary 8-digit batches. | None. | Same conceptual gap: no monthly sheet or numbered list. |
| **Bitwarden generator** | Free web random password/passphrase generator; one at a time; funnels users into the vault. | No — random only; no seed. | No. | Possible via custom charset/length, one at a time. | Vault (optional, but product push). | No reproducibility, no schedule, no batch. |
| **Browser generators** (Chrome/Safari/Firefox/Edge) | Built-in random password suggestion, one at a time. | No. | No. | Usually configurable, one at a time. | Browser password manager. | No seed, no print, no schedule. |
| **Password cards** (e.g. passwordcard.org) | Printable grid; user follows a pattern (row/colour/column) to read a password; offline, physical. | The card itself is the secret; no digital regeneration. | No; card is static until reprinted. | Can encode digits, but lookup is manual. | Physical card. | No seed recovery, no monthly regeneration, no digital batch. Site returned 503 at research time, so current status unverified. |
| **Deterministic managers generally** | Avoid sync by deriving per-site passwords from one master secret. | Yes. | Per-site, not per-month lists. | Usually configurable per site. | None. | Same: no schedule/batch/print workflow. |

**Honest read:** LessPass with a digits-only, length-8 profile and a monthly counter already solves the cousin's core need for *one* password at a time. A new tool only wins on the *artifact*: twelve labelled PINs on one page, generated in one go from a seed, printable and reproducible next month.

### Gap analysis

- **Real gap:** the combination and the output format, not the primitive. "Generate a year of monthly 8-digit PINs from one seed, print it, store nothing, regenerate it later from the seed" is not a product I could find. It is a thin wrapper over deterministic derivation plus a counter.
- **Who else would use it:** small, specific audiences — people who manage shared low-value numeric codes (family streaming PINs, club/locker/gate codes, rental property Wi-Fi, school or hobby-group accounts), privacy-minded users who want a paper backup rather than a vault, offline/air-gapped users, and password-card users who want regeneration. This is a niche, not a mass market.
- **Who will not use it:** anyone protecting email, banking, or work accounts. An 8-digit numeric password is only ~26.6 bits of entropy (`log2(10^8)`), and a public tool asking for a seed triggers the obvious trust question: "why should I trust this site with the thing that generates all my passwords?"
- **Differentiation risk:** the feature is easy to clone; the brand/trust and the print workflow are the only moats. Do not claim cryptographic novelty.
- **Verdict on the gap:** real but thin. Justified as a free public good or portfolio piece; not justified as a venture. If the only user is the cousin, a private page is strictly better.

### Hosting recommendation

| Host | Free tier (verified) | TLS / custom domain | Previews | Header/cache control | Fit |
|---|---|---|---|---|---|
| **Cloudflare Pages** | Static asset requests **free and unlimited** on free and paid plans; 500 builds/month; 20k files; 25 MiB/file; 100 custom domains; unlimited preview deployments. | Automatic TLS; custom domains. | Yes, per-branch/PR preview URLs. | `_headers` file (≤100 rules) for CSP, HSTS, cache-control; no Functions needed. | **Best fit.** |
| **GitHub Pages** | Soft **100 GB/month** bandwidth; 1 GB site; soft 10 builds/hour (unless Actions); one user/org site per account; 429 rate limits possible. | TLS + custom domain supported. | Not native; requires separate workflow. | No custom response headers (meta tags only); weaker CSP. | Fine for personal; weak for a public utility. ToS explicitly discourages "sensitive transactions like sending passwords" and commercial SaaS. |
| **Netlify** | Free = **300 credits**; production deploy 15 credits, bandwidth 20 credits/GB, requests 2 credits/10k. Not unlimited. | TLS + custom domains; deploy previews. | Yes. | `_headers`/`_redirects`, firewall/rate limiting. | Credit model is a poor fit if the site gets real traffic. |
| **Surge** | Unlimited projects/domains; no metered bandwidth or overage; publishing rate-limited (15 min/day; per-domain/account publish caps); 450 MB / 10,100 files. | Free custom domains + auto certs. | Previews and last 100 revisions. | CLI-only; header support less clear. | Simplest deploy, but no git-native CI and a smaller ecosystem. |

**Recommendation: Cloudflare Pages**, deployed from the repo, no Pages Functions. It gives unlimited static requests, global CDN/DDoS absorption, automatic TLS, optional custom domain, preview deployments for PRs, and `_headers` for security and caching. Start on `*.pages.dev`; add a custom domain only when the project proves worth keeping. Fallback: GitHub Pages if source-adjacent simplicity matters more than limits/policy; avoid Netlify's credit model for a public utility.

Suggested cache policy: hashed assets `public, max-age=31536000, immutable`; `index.html` and service worker `no-cache`; security headers on `/*` (`X-Content-Type-Options`, `Referrer-Policy: no-referrer`, `Permissions-Policy`, CSP with `default-src 'self'` and no third-party origins, HSTS). If Argon2 WASM is used, CSP needs `'wasm-unsafe-eval'` in `script-src`; that is one more reason to start with native WebCrypto.

### Discoverability vs. privacy

They can coexist, but not through an "unguessable URL": client-side code is public, the repo is public, and any path leaks through the repo, source maps, referrers, and sharing. An unguessable path is cosmetic, not a security boundary.

- **Public utility:** index the landing page, docs, "how it works", and FAQ; publish a sitemap and canonical URLs. Because there is no per-user state in the URL, indexing is low-risk.
- **Personal tool:** `noindex` via `X-Robots-Tag`/meta, no sitemap, no external links, `robots.txt` disallow. Accept that sharing with the cousin leaks it.
- **Both:** public indexed landing page + app at `/app/`; optionally `noindex` the app route to reduce casual traffic while keeping the landing page discoverable. Never put a seed, seed hash, or generated password in a query string, fragment, or page title. Set `Referrer-Policy: no-referrer`.
- Do not use analytics that record IPs or seed-adjacent behaviour. If analytics are ever added, use a cookieless aggregate and disclose it; the cleanest trust signal is **no analytics at all**.

### Abuse, limits, and policy

- No backend, no compute, no storage, no accounts, no uploads, no URL shortener, no open redirect, no user-generated content → very small abuse surface. The CDN absorbs volumetric DDoS; Cloudflare static requests are free and unlimited.
- The tool is dual-use like every password generator (Bitwarden and browsers ship one), so "it could generate a password for a bad purpose" is not a meaningful policy concern. Avoid branding or copy that suggests bypassing someone else's account security, and include a normal acceptable-use clause.
- Bots/scraping: nothing sensitive to scrape. Bandwidth is the only cost, and Cloudflare removes it as a practical concern. No rate limiting is needed for static assets; adding Functions would create compute cost and abuse surface for no benefit.
- Domain/name risk: avoid names that look like a bank, login portal, or "account recovery" service; a phishing-lookalike domain is a real reputational risk. Prefer a neutral utility name.
- If the site ever adds sharing, URL state, or a backend, redo this analysis — those are the features that create abuse and privacy problems.

### Privacy and legal

- **Data flow:** all generation in the browser; seed and outputs never transmitted; no cookies; no localStorage/sessionStorage by default; no third-party fonts, scripts, or CDNs (self-host everything) so IPs are not leaked to third parties.
- **Hosting logs:** Cloudflare (or any host) processes IPs and request metadata in its own logs. The app collects nothing, but the privacy policy should disclose the hosting provider and link its privacy terms. This is the one place where "no data collection" needs nuance.
- **GDPR/CCPA:** with no accounts, no cookies, no analytics, and no personal data collected by the app, obligations are minimal. Still publish a short privacy policy (what is processed locally, what is not collected, hosting logs, contact) and a "do not sell" statement. No cookie banner is needed if there are truly no cookies.
- **Disclaimer:** "No recovery. If you lose the seed or the printed sheet, the list cannot be reconstructed by us. This is not a password manager. 8-digit numeric codes are low-entropy; do not use them for email, banking, or other high-value accounts. Provided as-is, no warranty." Put it on the app page, not only in a footer.
- **Trust:** state clearly "not affiliated with LessPass, Spectre, or Bitwarden", link the source, and publish a threat model. For a password tool, the privacy policy *is* the product.

### Licensing

- **App:** MIT is the simplest choice and maximizes reuse; Apache-2.0 if an explicit patent grant matters. Either is compatible with a public static site.
- **Do not copy code** from LessPass (GPL-3.0) or Spectre (free software, GPL-family) unless the whole project is GPL-compatible. Reimplement the idea from the published algorithm/spec, not the source.
- **WebCrypto** is a browser API — no license, no dependency, no supply chain. Prefer it for MVP: PBKDF2-HMAC-SHA-256 with a high iteration count (or a strong random 128-bit seed, where stretching matters less).
- **Argon2 WASM:** better for human-memorable seeds, but adds a bundled dependency, a license/NOTICE obligation, ~tens of KB, and CSP `wasm-unsafe-eval`. If used, prefer a well-maintained MIT/Apache-2.0 package (verify the actual license and pin the version with SRI); record it in `THIRD_PARTY_NOTICES`.
- **Rule:** zero runtime dependencies is a feature for a security tool. Every dependency is a license and supply-chain decision.

### Maintenance

- **Dependencies:** Renovate/Dependabot monthly, lockfile committed, CI on every PR, no auto-merge for crypto/build tooling without review.
- **Algorithm versioning:** define a spec `v1` with domain separation (`app-name`, `version`, `month`, `index`) and publish **test vectors** in the repo. Never change derivation silently; a change means `v2` plus a migration note. Display the version in the app and in exported files.
- **Browser changes:** target evergreen Chrome/Firefox/Safari/Edge; feature-detect WebCrypto, service worker, `Intl`. Keep a small support matrix in the README. Test print CSS in Chromium and Firefox at minimum.
- **Security:** `SECURITY.md`, `security.txt`, private disclosure path, best-effort 90-day fix target, no bug bounty. Publish the threat model and known limitations (low entropy, no recovery, host logs).
- **Support:** GitHub Issues/Discussions only; no email SLA. FAQ must answer "Is this safe?", "Can you recover my seed?", "Why 8 digits?", "Do you store anything?", "Is it open source?".
- **Docs/i18n:** externalize strings from day one; English first, add locales only on request. Use `Intl` for month names; plan for RTL but do not build it in MVP. Keep the derivation spec language-independent.

### What changes when strangers use it

- **Support:** you become the help desk for lost seeds, misunderstood entropy, and print layout. The FAQ and an unmissable disclaimer are load-bearing.
- **Abuse reports:** low likelihood, but you need an abuse contact and a stated acceptable-use policy. More likely are confused users and "is this a scam?" emails.
- **Uptime expectations:** strangers expect a password tool to be up. A static CDN gives high availability but no SLA; say "best effort, no warranty". Don't promise more than you can keep.
- **Trust signals:** public repo, visible commit SHA/build date, reproducible build, CSP, no analytics, no third-party requests, test vectors, threat model, third-party notices, "view source" link. These matter more than features.
- **Transparency:** publish what changed and when (CHANGELOG), and state explicitly that the seed never leaves the tab. If you ever add telemetry, announce it loudly.
- **Personal vs. public:** a personal tool needs none of this. Going public is a commitment to documentation, issue triage, and trust maintenance. Decide deliberately.

### Viability verdict

**Build it — as a free, open-source niche utility and personal tool, not as a business.** The monthly-sheet + seed-recovery + no-storage combination is a genuine workflow gap, but it is a thin layer over existing deterministic generators, and LessPass already covers the single-password version of the use case. The public version's value is the printable artifact and reproducibility; its cost is trust-building and support. If the goal is only the cousin, ship a private static page and skip the public-launch work. If going public, set a 3–6 month organic-traffic check ("monthly password sheet", "printable password list", "seeded password generator"); if it does not find a small real audience, keep it private. Success is a few hundred grateful users, not growth.

### MVP scope

**In:**
- Single-page static app; no backend, accounts, storage, cookies, or analytics.
- Two modes: random (`crypto.getRandomValues`) and seeded/reproducible.
- Seeded spec `v1`: seed input (words and/or 128-bit hex), month selector + range (1–12), count, 8-digit numeric with optional leading zeros, copy, download `.txt`/`.csv`, print.
- Printable sheet (A4/Letter) with month labels and the seed **never** printed; print CSS tested.
- PWA: installable, offline via versioned service worker; no background sync.
- Pages: landing (indexed), `/app/`, How it works, Privacy, Security/Threat model, FAQ, 404.
- Test vectors + unit tests for the derivation; a visible spec version.
- Hosting: Cloudflare Pages, optional custom domain, `_headers` CSP/HSTS/cache, `Referrer-Policy: no-referrer`.
- MIT license, `THIRD_PARTY_NOTICES`, `SECURITY.md`, issue templates, CI build/test/deploy.
- Strong disclaimer: no recovery, low entropy, not for high-value accounts.

**Out (for now):** accounts/sync/cloud backup, Argon2 WASM, browser extension/native apps, password-manager integration, i18n beyond English, analytics, custom domain, sharing/URL state, themes beyond light/dark.

### Open questions

1. Is 8-digit numeric a hard requirement, or can the default be 10–12 alphanumeric with 8-digit as an option? This is the biggest security/UX trade-off.
2. What is the real threat model: shared low-value PINs, or personal accounts? The answer changes the KDF, the warnings, and whether the public launch is responsible.
3. Does the cousin need print, phone, or both? Print layout may be the actual differentiator.
4. Seed format: word phrase, 128-bit hex, or both? Checksum? How much guidance before it becomes a support burden?
5. Is any local persistence needed (e.g., opt-in encrypted seed backup), or does "no storage" win even at the cost of usability?
6. KDF: native PBKDF2 (zero deps) vs. Argon2id WASM (better for human seeds, CSP/bundle cost)?
7. Is the app route indexed or `noindex`? (Cosmetic either way; decide for support load.)
8. Domain/name/trademark check; avoid phishing-lookalike naming.
9. Cloudflare's logging/jurisdiction is acceptable for the intended audience?
10. Which locale(s) after English, and does the print sheet need localization?

### Sources consulted

- https://github.com/lesspass/lesspass — README, features, GPL-3.0, server registration closure.
- https://lesspass.com — attempted; returned no content.
- https://spectre.app — algorithm, features, counter/version model, free-software status.
- https://masterpassword.app — redirects to Spectre.
- https://bitwarden.com/password-generator/ — free random/passphrase generator, vault funnel.
- https://developers.cloudflare.com/pages/platform/limits/ — builds, files, custom domains, previews, headers.
- https://developers.cloudflare.com/pages/functions/pricing/ — static asset requests free and unlimited.
- https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits — bandwidth, build, ToS constraints.
- https://www.netlify.com/pricing/ — 300 credits, deploy/bandwidth/request credit costs.
- https://surge.sh/pricing — free projects/domains, publishing limits, no metered bandwidth.
- https://www.passwordcard.org/ — attempted; HTTP 503, not verified.
- `websearch` — attempted; HTTP 402, unavailable.
