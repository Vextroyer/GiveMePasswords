# Verification Guide

This page explains how to check that the generator is doing what it claims,
from a five-second hash comparison to a full independent rebuild.

## 1. Verify the served artifact (two minutes)

The reviewed artifact is committed as `dist/index.html`, with its hash in
`dist/SHA256SUMS`.

```sh
# Hash the page you actually received. The cache-buster avoids a stale copy.
curl -s "https://vextroyer.github.io/GiveMePasswords/?$(date +%s)" | sha256sum

# Compare with the committed value
cat dist/SHA256SUMS
```

Do not use `curl --compressed` for this check: the hash is over the bytes as
served, and decompression changes them.

They must match exactly. If they do not, stop: you are running different code
from the reviewed build. Do not enter or use a recovery code.

The committed value at the time of writing:

```
1acaba57ed1c3f7fbfd9f1934e4e67dee560e327f1421650db7c65e808f84786  index.html
```

The footer also shows a **build id**: the first 16 hex characters of the
SHA-256 of the inline script. The current build id is `8e732a49ddd4ddb7`.
Unlike the full-file hash, the build id can be displayed inside the page because
the script cannot contain its own digest. It changes when the app logic changes,
not when only the HTML or CSS changes.

## 2. Confirm the page makes no requests

1. Open the page in a browser.
2. DevTools → Network → reload.
3. Confirm the only request is the document itself. The favicon is a data URI
   and makes no request.
4. Create or restore a list, copy, download, and print. The Network panel must
   stay empty.

A build test also scans the artifact for `fetch`, `XMLHttpRequest`, `WebSocket`,
`sendBeacon`, dynamic imports, and external URLs; it fails the build if any are
present.

## 3. Confirm the meta CSP

GitHub Pages does not send a CSP response header. The only CSP is the
`<meta http-equiv="Content-Security-Policy">` tag in the page. Check it by
extracting the inline style and script and comparing their SHA-256 hashes with
the values pinned in the meta tag:

```sh
python3 - <<'PY'
import base64, hashlib, re, time, urllib.request

url = "https://vextroyer.github.io/GiveMePasswords/?%d" % int(time.time())
html = urllib.request.urlopen(url).read().decode()
style = re.search(r"<style>(.*?)</style>", html, re.S).group(1).encode()
script = re.search(r"<script>(.*?)</script>", html, re.S).group(1).encode()
csp = re.search(
    r'http-equiv="Content-Security-Policy"[^>]+content="([^"]+)"', html
).group(1)

for label, body in (("style", style), ("script", script)):
    digest = base64.b64encode(hashlib.sha256(body).digest()).decode()
    print(label, digest, f"sha256-{digest}" in csp)
PY
```

Both lines must print `True`. The current hashes are:

- script: `sha256-jnMqSd3U3bcQ2i/XX+g/1e9LRi6ZaFMSYL3Vtvt1NiE=`
- style: `sha256-2NRCTTgpTcbKL5PAo/8xnstlhENyWSIhB1yXBembMBc=`

In the browser console, confirm there are no CSP violations and no
mixed-content warnings.

## 4. Check the actual response headers

```sh
curl -sI https://vextroyer.github.io/GiveMePasswords/ | tr -d '\r'
```

The expected header set is:

- `server: GitHub.com`
- `strict-transport-security: max-age=31556952`
- `cache-control: max-age=600`
- `access-control-allow-origin: *`

There is no CSP, `X-Frame-Options`, COOP, CORP, nosniff, `Referrer-Policy`, or
`Permissions-Policy` response header. HSTS is present, but `github.io` is not
HSTS-preloaded and the value is not guaranteed for every Pages site. Because
`frame-ancestors 'none'` in a meta CSP is ignored by browsers and no
`X-Frame-Options` is sent, the page is framable. See
[`threat-model.md`](threat-model.md).

## 5. Rebuild from source (five minutes)

Requirements: Node.js 20+, Python 3.10+ (for the cross-check), and `make`.

```sh
make test          # derivation, recovery codes, vectors, session, app policy, build
make cross-check   # Python reference vs. test-vectors.json
make build         # regenerate dist/
make verify-build  # rebuild into .build/verify and diff against dist/
```

`make verify-build` must produce no diff. The build has no timestamps or
environment-dependent values, so two runs on two machines produce identical
bytes.

## 6. Check the algorithm independently

The derivation is frozen in [`spec-hpg-1.md`](spec-hpg-1.md) and pinned in
[`test-vectors.json`](../test-vectors.json). Two independent implementations
must agree:

- `src/derive.js` — the shipped JavaScript, using WebCrypto HKDF.
- `tools/reference.py` — a standard-library Python implementation that shares no
  code with the app.

```sh
make test          # JavaScript side
make cross-check   # Python side
```

The vectors cover RFC 5869 A.1, pinned day passwords, a real rejection case
(`2020-02-14`), two full months under different seeds, and recovery-code
round-trips for edge seeds (`00…00`, `ff…ff`).

## 7. Check the recovery code by hand

For seed `000102030405060708090a0b0c0d0e0f`:

```
HPG1-0004-1061-050R-3GG2-8A1C-60T3-GF2F
```

Enter it with a different month and confirm:

- the fingerprint is `CA7EF2C3`;
- the month changes the list;
- the same month and code reproduce it byte-for-byte;
- a single changed checksum character is rejected with a checksum error;
- lowercase, spaces, hyphens, `I`/`L`, `O`, and zero-width characters are
  accepted.

## 8. Verify the offline copy

Save `dist/index.html` (or the served page) to disk and open it. Everything is
inlined. If `crypto.subtle` is unavailable on `file://` in that browser, the app
shows an error and refuses to derive rather than producing a different list.
Record which browsers worked in [`qa-record.md`](qa-record.md).

## What verification cannot prove

A hash confirms that the bytes match the reviewed build. It does not prove that
the reviewed build is free of bugs, that your device is clean, or that a
browser extension is not reading the DOM. It also cannot make an 8-digit
password strong. Read [`threat-model.md`](threat-model.md) for the limits.

## Reporting a problem

If a verification step fails, do not use the output. Preserve the URL, the
served hash, the expected hash, and the browser version, and follow
[`SECURITY.md`](../SECURITY.md).
