# Deployment

Target: **GitHub Pages**, served from the reviewed artifact in `dist/` through
GitHub Actions. No custom domain, no Functions, and no rebuild on the host. The
committed `dist/index.html` is the published artifact; `dist/SHA256SUMS` pins
its hash.

## Live site

- URL: <https://vextroyer.github.io/GiveMePasswords/>
- First successful run:
  <https://github.com/Vextroyer/GiveMePasswords/actions/runs/42397975872>
- Served hash:
  `1acaba57ed1c3f7fbfd9f1934e4e67dee560e327f1421650db7c65e808f84786`
  (matches `dist/SHA256SUMS`).

The no-slash URL redirects to the trailing-slash URL. HTTP redirects to HTTPS.

## How deployment works

`.github/workflows/pages.yml` runs on pushes to `master` that touch an
artifact-relevant path. It also supports `workflow_dispatch`.

| Push touches | Workflow runs? | Deploys? |
|---|---|---|
| `README.md`, `docs/**`, `CHANGELOG.md`, `.knowledge/**`, `.gitignore` | No | No |
| `test/**` | No | No |
| `dist/**` | Yes | Yes |
| `src/**` or `scripts/**` without a rebuilt `dist/` | Yes | No — `make verify-build` fails and surfaces the mistake |
| `src/**` plus a rebuilt `dist/` | Yes | Yes |
| `package.json`, `Makefile` | Yes | Yes |
| `test-vectors.json`, `tools/**` | Yes | Yes (cross-check gate) |
| Manual **Run workflow** | Yes | Yes |

The watched paths are `dist/**`, `src/**`, `scripts/**`, `tools/**`,
`test-vectors.json`, `package.json`, `Makefile`, and
`.github/workflows/pages.yml`. Keep this list next to the build inputs and
extend it if `scripts/build.mjs` starts reading a new path.

The `build` job:

1. checks out the repository;
2. installs Node 22;
3. runs `make check` and `make verify-build`;
4. uploads `dist/` as the Pages artifact.

The `deploy` job publishes that artifact. There is no rebuild on the host: the
verified bytes are the served bytes.

Docs-only changes (`docs/**`, `.knowledge/**`, `README.md`, `CHANGELOG.md`) and
`test/**` do not trigger this workflow. A separate CI workflow covers tests.

## One-time setup

1. Push the repository to GitHub.
2. Open **Settings → Pages → Build and deployment** and set **Source** to
   **GitHub Actions**.
3. Push an artifact-relevant commit, or run the `pages` workflow manually.

No environment variables, secrets, functions, or bindings are required. The app
has no backend.

## Headers and caching

GitHub Pages does not support custom response headers. `dist/_headers` was
removed because it was inert on Pages. The live response includes:

- `server: GitHub.com`
- `strict-transport-security: max-age=31556952` (not HSTS-preloaded and not
  universal on `github.io`)
- `cache-control: max-age=600`
- `access-control-allow-origin: *`

It does **not** include a CSP, `X-Frame-Options`, COOP, CORP, nosniff,
`Referrer-Policy`, or `Permissions-Policy` response header. The only CSP is the
`<meta http-equiv="Content-Security-Policy">` tag in `dist/index.html`.
`frame-ancestors 'none'` in a meta CSP is ignored by browsers, so the page is
framable. This is a documented residual risk in
[`threat-model.md`](threat-model.md).

## Security header delta

GitHub Pages does not support custom response headers, so the headers that were
previously planned for Cloudflare are either absent or replaced:

| Directive | Header-capable host | GitHub Pages |
|---|---|---|
| `Content-Security-Policy` | Response header | **Survives via `<meta>`** with identical script/style hashes |
| `frame-ancestors 'none'` | Enforced | **Ignored in a meta CSP**; no `X-Frame-Options` either, so the page is framable |
| `Strict-Transport-Security` | Enforced | **Absent**; `github.io` is not preloaded, but GitHub redirects HTTP to HTTPS |
| `Referrer-Policy` | Response header | Absent as a header; `<meta name="referrer" content="no-referrer">` still applies |
| `X-Content-Type-Options` | Enforced | Absent; GitHub sends correct MIME types |
| COOP / CORP | Enforced | Absent; there are no cross-origin resources or popups |
| `Permissions-Policy` | Enforced | Absent; the app requests no permissions |
| `Cache-Control` | `max-age=300, must-revalidate` | Forced `max-age=600`; a redeploy can look stale for up to 10 minutes |

The residual risk is low for a stateless generator with no account, storage, or
cross-origin assets, but clickjacking and a possible first-visit downgrade are
real. They are recorded in [`threat-model.md`](threat-model.md), not silently
dropped.

Because the cache is `max-age=600`, use a cache-buster when verifying a fresh
deploy:

```sh
curl -s "https://vextroyer.github.io/GiveMePasswords/?$(date +%s)" | sha256sum
```

## Rollback

- **Artifact rollback:** revert the commit that changed `dist/`, run
  `make verify-build`, and push. The path-filtered workflow redeploys; allow up
  to 10 minutes for caches.
- **Redeploy a known-good run:** open the earlier successful `pages` run in
  Actions and re-run its deployment.
- **Disable the site:** in **Settings → Pages**, unpublish or disable the site.
  Public access stops immediately without changing the repository.
- **Workflow rollback:** revert `.github/workflows/pages.yml`; the next
  artifact-relevant push validates the reverted workflow.

Never hand-edit `dist/`; always regenerate it with `make build`.

## Limits

GitHub Pages' free tier is sufficient: one small HTML document, no server
compute, no storage. The soft limits are about 1 GB per site and 100 GB/month of
bandwidth. Pages for a public repository is free; a private repository needs a
paid GitHub plan. There is no server state to scale.

## Offline copy

Download the deployed page (or copy `dist/index.html`) and open it from disk.
Because everything is inlined, it should render offline. `crypto.subtle` needs a
secure context; `file://` is treated as secure by some browsers and not others.
If derivation is unavailable, the app shows the "browser cannot generate
passwords here" message rather than producing a different list.

The offline copy has the same SHA-256 as the deployed artifact:

```sh
sha256sum dist/index.html
```
