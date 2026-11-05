# Verification Guide

This page explains how to check that the generator is doing what it claims,
from a five-second hash comparison to a full independent rebuild.

## 1. Verify the served artifact (two minutes)

The reviewed artifact is committed as `dist/index.html`, with its hash in
`dist/SHA256SUMS`.

```sh
# Hash the page you actually received
curl -s https://<project>.pages.dev/ | sha256sum

# Compare with the committed value
cat dist/SHA256SUMS
```

They must match exactly. If they do not, stop: you are running different code
from the reviewed build. Do not enter or use a recovery code.

The committed value at the time of writing:

```
d4b89db74d6bed04db78b7e4e48931508e46f6638800bcd1277eb790068f49c8  index.html
```

## 2. Confirm the page makes no requests

1. Open the page in a browser.
2. DevTools → Network → reload.
3. Confirm the only requests are the document itself. The favicon is a data URI
   and makes no request.
4. Create or restore a list, copy, download, and print. The Network panel must
   stay empty.

A build test also scans the artifact for `fetch`, `XMLHttpRequest`, `WebSocket`,
`sendBeacon`, dynamic imports, and external URLs; it fails the build if any are
present.

## 3. Confirm the CSP and headers

```sh
curl -sI https://<project>.pages.dev/ | grep -iE \
  'content-security-policy|strict-transport-security|referrer-policy|x-content-type-options|permissions-policy|cache-control'
```

The CSP must contain `default-src 'none'` and one `sha256-` hash for the inline
script and one for the inline style. The hashes are generated from the exact
inlined bytes, so a header mismatch means the artifact changed without a
rebuild.

In the browser console, confirm there are no CSP violations and no mixed-content
warnings.

## 4. Rebuild from source (five minutes)

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

## 5. Check the algorithm independently

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

## 6. Check the recovery code by hand

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

## 7. Verify the offline copy

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
