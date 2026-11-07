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

`.github/workflows/pages.yml` runs on pushes to `master` that touch:

- `dist/**`
- `src/**`
- `scripts/**`
- `tools/**`
- `test-vectors.json`
- `package.json`
- `Makefile`
- `.github/workflows/pages.yml`

It also supports `workflow_dispatch`.

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

Because the cache is `max-age=600`, use a cache-buster when verifying a fresh
deploy:

```sh
curl -s "https://vextroyer.github.io/GiveMePasswords/?$(date +%s)" | sha256sum
```

## Rollback

1. Revert to a commit with a known-good `dist/`.
2. Run `make verify-build` locally.
3. Push the revert (or re-run a previous successful `pages` workflow).

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
