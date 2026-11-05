# Deployment

Target: **Cloudflare Pages**, free `*.pages.dev` subdomain, no Functions, no
custom domain. The shipped artifact is `dist/index.html` plus `dist/_headers`;
both are committed so the reviewed bytes are the served bytes.

## Current status

- [x] Reproducible build and `_headers` committed.
- [x] `make verify-build` reproduces `dist/` byte-for-byte.
- [ ] Cloudflare account and Pages project — **blocked, external**.
- [ ] Git remote for Pages to pull from — **blocked, external**.
- [ ] Post-deploy header and CSP check — needs the live URL.

## One-time setup

1. Push the repository to a host Cloudflare Pages can read (GitHub or GitLab).
   Use a private repository until the launch decision in Phase 5.
2. In the Cloudflare dashboard, create **Pages → Connect to Git**.
3. Build settings:

   | Setting | Value |
   |---|---|
   | Framework preset | None |
   | Build command | `node scripts/build.mjs` |
   | Build output directory | `dist` |
   | Production branch | `main` (or the branch you deploy) |
   | Node version | 22 (set `NODE_VERSION=22` if the image defaults lower) |

4. Deploy. The project URL is `https://<project>.pages.dev`.
5. Disable preview deployments, or clearly mark them as non-production. Preview
   URLs are public unless access control is configured.

No environment variables, secrets, functions, or bindings are required. The app
has no backend.

## Post-deploy verification

```sh
# Headers and CSP
curl -sI https://<project>.pages.dev/ | tee headers.txt
grep -i '^content-security-policy' headers.txt
grep -i '^strict-transport-security' headers.txt
grep -i '^referrer-policy' headers.txt
grep -i '^x-content-type-options' headers.txt
grep -i '^permissions-policy' headers.txt

# Artifact hash must match the committed SHA256SUMS
curl -s https://<project>.pages.dev/ | sha256sum
cat dist/SHA256SUMS

# There must be no other requests after the first load
# Browser DevTools → Network → reload → verify only the document (and favicon
# is a data URI, so no request), then click through create/restore and confirm
# the Network panel stays empty.
```

Also confirm:

- [ ] No CSP violations in the console.
- [ ] No mixed-content warnings.
- [ ] The served HTML hash matches `dist/SHA256SUMS`.
- [ ] The footer version and build id match the output of `make build`.
- [ ] The page works with JavaScript enabled on iOS Safari and Android Chrome.
- [ ] The offline copy opens from `file://` in one Chromium and one WebKit
      browser, or the limitation is recorded (WebCrypto may be unavailable on
      `file://`; the app fails closed with a message).
- [ ] `Cache-Control` is present and the deployed build is the current one after
      a redeploy.

## Offline copy

Download the deployed page (or copy `dist/index.html`) and open it from disk.
Because everything is inlined, it should render offline. `crypto.subtle` needs a
secure context; `file://` is treated as secure by some browsers and not others.
If derivation is unavailable, the app shows the "browser cannot generate
passwords here" message rather than producing a different list.

Publish the SHA-256 of the offline copy so a user can verify that it matches the
deployed artifact:

```sh
sha256sum dist/index.html
```

## Rollback

1. Revert to the previous commit that contains a known-good `dist/`.
2. Run `make verify-build` to confirm the artifact matches the commit.
3. Redeploy that commit through Pages (or revert on the production branch).

Never hand-edit `dist/`; always regenerate it with `make build`.

## Cost and limits

Cloudflare Pages' free tier covers this project: one small HTML document, no
Functions, no storage, no build minutes beyond a trivial Node script. There is
no server state to scale.
