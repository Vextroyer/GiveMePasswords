# Security Policy

## Supported versions

| Version | Status |
|---|---|
| `HPG-1` (0.1.x) | Supported |
| Anything earlier, or a fork with modified derivation | Not supported |

The derivation is frozen. A change to the algorithm is a new version (`HPG-2`)
with new vectors; it does not patch `HPG-1` in place.

## Reporting a vulnerability

Do not open a public issue for a vulnerability that could expose seeds or
lists. Use a private channel:

1. **Preferred:** GitHub's private vulnerability reporting / security advisory
   on the repository.
2. Otherwise, contact the maintainer directly through the channel you already
   use with them.

Include:

- what you did, step by step;
- what you expected and what happened;
- the browser, OS, and device;
- the artifacts involved, with the hash from `dist/SHA256SUMS`;
- whether you believe seeds or passwords can be exposed, and how.

Never send a real recovery code or a real list. Reproduce with a throwaway seed
such as `000102030405060708090a0b0c0d0e0f`.

## What counts

In scope:

- a way to make the page transmit a seed, code, or list;
- a way to persist them without the user asking;
- a way to reveal the list before the save-code confirmation;
- a way to produce a wrong list for a given `(code, month)` that differs from
  the published vectors;
- a build that differs from the reviewed artifact while claiming to be it;
- a CSP regression that allows injected code to run;
- an injection or DOM-clobbering issue in the UI.

Out of scope, and already documented:

- **8 digits is weak.** About 26.6 bits; offline cracking and captured
  handshakes are known limits, not vulnerabilities. See
  [`docs/threat-model.md`](docs/threat-model.md).
- **No recovery.** A lost code cannot be reconstructed, by design.
- **No forward secrecy.** A leaked seed reveals past and future months.
- **Compromised host, device, browser extension, or router firmware.** The
  threat model states these as residual risks.
- **A valid code for a different seed.** The checksum is a typo detector; the
  fingerprint is the only confirmation.
- **Duplicate passwords within a month.** Accepted by design.
- **Framing / clickjacking.** GitHub Pages sends no `X-Frame-Options`, and
  `frame-ancestors` in a `<meta>` CSP is ignored by browsers, so the page can be
  framed. This is a documented residual risk; use a header-capable host if
  clickjacking becomes a real concern.

## What we will do

- Acknowledge a report as soon as practical; this is a small, unfunded project,
  so there is no guaranteed response time.
- Confirm the issue, agree on a fix, and publish a new artifact with an updated
  `SHA256SUMS` and a `CHANGELOG.md` entry.
- Credit the reporter if they want credit.

There is no bug bounty.

## Verifying a fix

Follow [`docs/verification.md`](docs/verification.md). A fixed artifact has:

- a new SHA-256 in `dist/SHA256SUMS`,
- a `CHANGELOG.md` entry naming the issue,
- `make test` and `make verify-build` green.
