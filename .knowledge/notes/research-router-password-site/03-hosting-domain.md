---
id: rq3-hosting-domain
created: 2026-11-04
type: research-note
status: active
parent: research-router-password-site
question: "What free hosting and domain options can serve a single-user page, and does edge auth work without a custom domain?"
tags: [hosting, cloudflare, free-tier, domain]
---

# RQ3 — Hosting and domain options (free only)

## Context

- Budget: **free only** — no custom domain, no paid hosting.
- The page only needs to serve a small HTML document (monthly password list) to one
  authenticated user, from anywhere.
- The user does not know how to get a domain or host a site.

## Sub-questions

1. Free static hosting options and their limits: Cloudflare Pages, Netlify, Vercel,
   GitHub Pages, GitLab Pages, Firebase Hosting, Render, Surge.
2. Free serverless/edge options: Cloudflare Workers, Deno Deploy, Vercel Functions,
   Netlify Functions. Which have a usable free tier for one user?
3. **Critical:** can Cloudflare Access protect a free `pages.dev` or `workers.dev`
   hostname **without a custom domain**? Verify against current Cloudflare docs. If not,
   what is the free workaround?
4. Custom-domain costs for reference (Cloudflare Registrar at-cost, Porkbun, Namecheap),
   even though the current budget excludes them.
5. TLS, global latency, uptime, free-tier limits, cold starts, bandwidth caps.
6. Setup complexity for a non-expert: account requirements, DNS, deploy steps,
   vendor lock-in.
7. Which combination is genuinely free, reliable, and defensible for a single-user page?
   Cite official documentation.

## Scout brief

Prioritize question 3. A wrong answer here invalidates the most promising free
architecture. Fetch Cloudflare's official docs and pricing pages directly. Also check
whether Netlify/Vercel password protection is paid-only.

## Findings (scout output)

### Summary

**Cloudflare Access cannot protect a free `*.pages.dev` or `*.workers.dev` hostname.** Every
Access "self-hosted public" application requires an **active domain/zone in your Cloudflare
account** (full or partial/CNAME DNS setup). `pages.dev` and `workers.dev` are zones owned by
Cloudflare, not by the user, so they cannot be added as a zone or given Access DNS records. The
blocker is architectural, not pricing: even the free Zero Trust tier does not help.

The free workaround is to **not rely on edge auth**. Two viable patterns:

1. **Client-side encryption on any static host** — publish an AES-256/PBKDF2-encrypted HTML
   file (StatiCrypt). No server logic, no custom domain, works on `pages.dev`. The ciphertext is
   public, so the passphrase must be long and random. This is the simplest defensible option for
   a one-page secret list.
2. **A real gate without a custom domain** — either a Cloudflare Pages Function / Worker doing
   HTTP Basic Auth (free, but homegrown and rate-limit-free), or **GitLab Pages access control**
   (free tier, real GitLab login, restricted to project members) on `*.gitlab.io`.

Recommendation: **Cloudflare Pages (static, unlimited free requests) + StatiCrypt**, with
`noindex` headers. If a server-side/SSO gate is mandatory, use **GitLab Pages access control**
instead; do not use Cloudflare Access.

### Answers by question

#### 1. Can Cloudflare Access protect `pages.dev` / `workers.dev`? (CRITICAL)

**No.** Official prerequisites for an Access self-hosted public application:

- "An **active domain on Cloudflare**"
- "Domain uses either a full setup or a partial (`CNAME`) setup"
- In the dashboard, the Domain dropdown only lists domains that "belong to an active zone in your
  Cloudflare account."

`*.pages.dev` and `*.workers.dev` are shared Cloudflare-owned zones; a user cannot add them as a
zone or create DNS records on them. Access therefore has no hostname to attach the application
to. There is no free-tier or plan workaround. Cloudflare Tunnel does not help either: a tunnel's
public hostname must still live in a zone you control, and "quick tunnels"
(`trycloudflare.com`) are ephemeral and cannot be protected by Access.

Sources:
- https://developers.cloudflare.com/cloudflare-one/applications/configure-apps/self-hosted-apps/
- https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/
- https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/self-hosted-public-app/

**Free workarounds (in order of simplicity):**

| Workaround | Auth model | Cost | Verdict |
| --- | --- | --- | --- |
| StatiCrypt-encrypted static page on Pages | AES-256 in browser; ciphertext public | Free | **Recommended**; no server to attack, but offline brute-force is possible |
| Pages Function / Worker with HTTP Basic Auth | Server-side shared credential | Free (Workers 100k req/day) | Works on `pages.dev`; homegrown, no lockout/rate limit, needs code |
| GitLab Pages access control | GitLab login, project members only | Free tier | Real auth on `*.gitlab.io`; needs private project + CI, viewer needs GitLab account |
| Netlify / Vercel / Surge password protection | Platform gate | **Paid** | Not usable on free budget |

#### 2. Free static hosting limits and suitability

| Host | Free limits (verified where cited) | Auth without custom domain | Verdict |
| --- | --- | --- | --- |
| **Cloudflare Pages** | 500 builds/mo, 20,000 files, 25 MiB/file, 100 projects; **static asset requests free and unlimited** on free and paid | None natively; pair with StatiCrypt or a Pages Function | **Best fit**: unlimited static bandwidth, global CDN, free TLS |
| **Netlify** | Credit-based Free: **300 credits/mo hard limit**; 10k web requests = 2 credits, 1 GB bandwidth = 20 credits, each production deploy = 15 credits | Password protection **not available on Free or Personal**, Pro only | Fine for a tiny page (~10+ GB equivalent), but hard cap and no auth |
| **Vercel** | Hobby tier; pricing/docs returned 404 to automated fetch — **not verified** | Password protection is a paid deployment-protection feature (Pro/Enterprise) — **confirm manually** | Viable static host, but auth is paid and numbers unverified |
| **GitHub Pages** | 1 GB site, **100 GB/mo soft bandwidth**, 10 builds/hr soft, 10-min deploy timeout | None; client-side encryption only | **Avoid for this use case**: docs explicitly say not to use Pages for "sensitive transactions like sending passwords" |
| **GitLab Pages** | Free tier on `*.gitlab.io`; CI required; site under project path | **Pages access control is Free tier**: only authenticated project members | **Best free real-auth option**; more setup |
| **Firebase Hosting** | Spark plan; docs returned HTTP 403 — **not verified** (historically 10 GB storage / 360 MB per day transfer) | Firebase Auth would require code; no built-in page password | Heavier setup, Google account, unverified limits |
| **Render** | Static sites free but count against workspace bandwidth/pipeline minutes; free web services spin down after 15 min idle, ~1 min cold start; docs say "Do not use them for production applications" | None built in | Static is okay; free web service cold starts are bad UX |
| **Surge** | Free: unlimited projects/domains, custom domains + certs free, **no metered bandwidth**; password protection only on **Pro $30/mo** | None on Free | Simple CLI publish; no free auth |

#### 3. Free serverless/edge options

- **Cloudflare Workers**: 100,000 requests/day, 10 ms CPU/request, 128 MB, 100 Workers, 1 s startup;
  static assets 20,000 files / 25 MiB each. Serves on `workers.dev` with free TLS. Good for a
  tiny Basic Auth gate; no traditional cold start (isolates), but 10 ms CPU is tight for anything
  cryptographic.
- **Cloudflare Pages Functions**: billed as Workers requests; shares the 100k/day quota. Static
  asset requests remain free/unlimited. Most convenient place for a Basic Auth middleware.
- **Deno Deploy**: free 1M requests/mo, 20 GiB egress, 10 apps, 10 h active CPU, 3 team members,
  1-day logs, no email support. Note: Deno is joining Cloudflare, Deploy Classic shuts down
  **July 20, 2026**, and the new platform lists only **2 regions** — platform-risk and latency
  concerns for a long-lived page.
- **Vercel Functions / Netlify Functions**: available on free tiers but metered (Netlify Functions
  consume credits at 10 credits per GB-hour; Vercel numbers unverified). No advantage for one
  user; more lock-in than a static file.

#### 4. Are Netlify/Vercel password protection paid-only?

- **Netlify: yes, paid-only.** The password-protection doc states basic protection is available on
  all **Pro** plans; the credit-based plan comparison shows "Password protection: N/A" for Free
  and Personal and a checkmark only for Pro. Netlify's official recommendation on Free is to make
  the project private (visible only to the Team Owner), which is not a shared-password page.
- **Vercel: paid** (Pro/Enterprise) per Vercel's deployment-protection documentation/model, but
  I could not fetch vercel.com from this environment (all pricing/docs URLs returned 404 to
  automated requests). Treat this specific claim as **needs manual confirmation**.

Sources:
- https://docs.netlify.com/manage/security/secure-access-to-sites/password-protection/
- https://docs.netlify.com/manage/accounts-and-billing/billing/billing-for-credit-based-plans/credit-based-pricing-plans/

#### 5. TLS, latency, uptime, cold starts, bandwidth, accounts

| Host | TLS | Latency / CDN | Cold start | Bandwidth | Account |
| --- | --- | --- | --- | --- | --- |
| Cloudflare Pages | Automatic | Cloudflare global anycast CDN | None (static) | **Unlimited static requests** | Cloudflare account (email) |
| Netlify | Automatic | Global CDN | None (static) | ~15 GB-equivalent before 300 credits run out | Netlify account |
| Vercel | Automatic | Global CDN | None (static) | Hobby quota (unverified) | Vercel account |
| GitHub Pages | Automatic | Fastly CDN | None | 100 GB/mo soft | GitHub account |
| GitLab Pages | Automatic | CDN-backed | None | Free tier (quota not verified) | GitLab account |
| Render static | Automatic | CDN | None (static) | Counts against workspace bandwidth | Render account |
| Render free web service | Automatic | Single region | **~1 min spin-up after 15 min idle** | Workspace quota | Render account |
| Surge | Automatic | Global network | None | Unmetered | Email + Node CLI |
| Deno Deploy | Automatic | **2 regions** (new platform) | Possible | 20 GiB/mo | Deno account |

No free tier carries an uptime SLA. All are mature enough for one user; Cloudflare, GitHub and
Netlify have the strongest operational track records. For a static file, "cold start" is a
non-issue on every host except Render's free *web services* (not static sites).

#### 6. Setup complexity and lock-in for a non-expert

| Option | Setup | Lock-in |
| --- | --- | --- |
| Cloudflare Pages + StatiCrypt | **Low**: account → run `npx staticrypt` → upload the generated HTML | **Very low**: one portable HTML file; only the `pages.dev` URL changes on migration |
| Netlify drag-and-drop + StatiCrypt | Low: account + drag folder | Low; credit cap may force migration |
| Surge + StatiCrypt | Low–medium: Node + CLI login | Low; free plan is generous |
| GitHub Pages + StatiCrypt | Medium: repo, git, Pages settings | Low technically, but policy discourages secrets |
| GitLab Pages + access control | **Medium–high**: private project, `.gitlab-ci.yml`, Pages toggle, invite the single user | Medium: auth tied to GitLab project membership |
| Pages Function Basic Auth | Medium: write middleware, Wrangler deploy, store credential in env var | Medium: Cloudflare-specific but tiny code |
| Firebase / Vercel | Medium–high: CLI/tooling and platform config | Medium |

#### 7. Recommendation

**Primary (simplest, genuinely free, reliable): Cloudflare Pages + StatiCrypt.**

- Host: Cloudflare Pages free tier — static requests are free and unlimited, automatic TLS,
  global CDN, no cold starts, no credit card.
- Protection: `staticrypt` encrypts the HTML with AES-256-CBC and PBKDF2-SHA256 (600k iterations)
  and produces a self-contained password-prompt page. Decryption happens in the browser; the host
  never sees the passphrase or plaintext.
- No custom domain required; the URL is `https://<project>.pages.dev/`.
- Add `_headers` with `X-Robots-Tag: noindex` and a `robots.txt` disallow as hygiene (not as
  security).
- Use a **20+ character random passphrase**, shared out-of-band; keep an offline copy. Because
  the ciphertext is public, passphrase strength is the entire security boundary.
- Monthly update: edit source → re-run `staticrypt` → redeploy. Re-encrypting also rotates the
  effective access secret.

**If the reviewer requires server-side authentication**, choose **GitLab Pages access control**
(free tier): private project, Pages enabled for "Only Project Members", one invited GitLab user.
This is a real login gate on a vendor subdomain. Cost: more setup and a GitLab account for the
viewer; content is not public at all. Do **not** plan around Cloudflare Access for `pages.dev` /
`workers.dev`.

**Do not** use GitHub Pages for this content: its own limits page says Pages "shouldn't be used
for sensitive transactions like sending passwords." Netlify/Vercel/Surge password protection is
paid; Netlify Free additionally has a hard 300-credit cap.

### Evidence (URLs actually used)

- https://developers.cloudflare.com/cloudflare-one/applications/configure-apps/self-hosted-apps/ — Access self-hosted app prerequisites: active domain, full/partial DNS; domain must belong to an active zone
- https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/ — public hostname apps require full or partial CNAME setup
- https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/self-hosted-public-app/ — "Domains must belong to an active zone in your Cloudflare account"
- https://developers.cloudflare.com/pages/platform/limits/ — 500 builds/mo, 20k files, 25 MiB/file, 100 projects
- https://developers.cloudflare.com/pages/functions/pricing/ — static asset requests free and unlimited; Functions count toward Workers free 100k/day
- https://developers.cloudflare.com/workers/platform/limits/ — 100k req/day, 10 ms CPU, 128 MB, 100 Workers, 1 s startup
- https://www.cloudflare.com/plans/free/ — free plan includes CDN/DDoS/SSL, Workers free tier
- https://docs.netlify.com/manage/security/secure-access-to-sites/password-protection/ — basic password protection on Pro; not available on Credit-based Free/Personal
- https://docs.netlify.com/manage/accounts-and-billing/billing/billing-for-credit-based-plans/credit-based-pricing-plans/ — 300 credits/mo hard limit; 10k requests=2 credits, 1 GB=20 credits, deploy=15 credits; password protection N/A on Free
- https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits — 1 GB site, 100 GB/mo soft bandwidth, 10 builds/hr; "shouldn't be used for sensitive transactions like sending passwords"
- https://docs.gitlab.com/user/project/pages/introduction/ — GitLab Pages on `gitlab.io`, CI required
- https://docs.gitlab.com/user/project/pages/pages_access_control/ — access control Tier: Free; only authenticated project members
- https://render.com/docs/free — static sites free; free web services spin down after 15 min, ~1 min restart; "Do not use them for production applications"
- https://surge.sh/pricing — free unlimited projects/domains, no metered bandwidth; password protection only on Pro $30/mo
- https://deno.com/deploy/pricing — free 1M req/mo, 20 GiB egress, 10 apps, 10 h CPU
- https://docs.deno.com/deploy/ — Deploy Classic sunset July 20, 2026; new platform 2 regions
- https://github.com/robinmoisson/staticrypt — AES-256/WebCrypto, PBKDF2 600k, client-side decryption; recommends 16+ char passwords
- Attempted but unavailable: https://vercel.com/pricing (404), https://vercel.com/docs/limits (404), https://vercel.com/docs/deployment-protection (404), https://firebase.google.com/docs/hosting/usage-quotas-pricing (403), websearch (HTTP 402)

### Recommended free stack

```
Cloudflare account
  └─ Cloudflare Pages (free, <project>.pages.dev, unlimited static requests, auto TLS)
       └─ single self-contained HTML file encrypted by StatiCrypt (AES-256 + PBKDF2 600k)
            ├─ _headers: X-Robots-Tag: noindex
            ├─ robots.txt: Disallow: /
            └─ passphrase (20+ random chars) shared out-of-band
```

Fallback for true server-side auth: **GitLab Pages (Free) + Pages access control ("Only Project
Members")** on `*.gitlab.io`, private project, one invited user.

### Open questions

- **Vercel**: exact Hobby bandwidth/function limits and whether production password protection is
  Pro or Enterprise only. vercel.com returned HTTP 404 to every automated fetch; needs a manual
  browser check.
- **Firebase Hosting**: current Spark quotas (historically 10 GB storage / 360 MB per day) — docs
  returned HTTP 403.
- **GitLab.com Pages**: free-tier bandwidth/storage quota and whether Pages access control is
  enabled for all new `gitlab.com` projects or requires an admin toggle; also whether the single
  viewer must be a full GitLab account (yes) and how session expiry behaves.
- **Cloudflare Pages direct upload**: whether the dashboard drag-and-drop path supports Functions
  (for the Basic Auth variant) or only static assets; Functions likely require Wrangler/Git.
- **Custom-domain costs** (note sub-question 4): not researched — out of scope for this brief and
  excluded by the free-only budget.
- **Threat model**: is offline brute-force of a publicly downloadable ciphertext acceptable? If
  not, the only free real-auth path found is GitLab Pages access control (or a homegrown Worker
  gate). This should be confirmed with the parent before committing to StatiCrypt.
