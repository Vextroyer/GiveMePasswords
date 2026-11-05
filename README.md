# Monthly Password Generator

A public, stateless, client-side tool that turns a 16-byte seed into a month of
8-digit daily passwords. Nothing is sent to a server, nothing is stored, and the
same seed always produces the same list.

> **Status:** Phase 1 of 5 — the derivation and recovery-code format are frozen
> and tested. There is no user interface yet. See
> [`.knowledge/plans/public-monthly-password-generator.md`](.knowledge/plans/public-monthly-password-generator.md).

## What it does

- **Create a list.** The app generates a random 16-byte seed, shows it as a
  printable recovery code, and derives every day's password for a chosen month.
- **Restore a list.** Paste a saved recovery code and the same month to get the
  identical list back, with no account and no server.

## What it is not

- Not a password manager and not encrypted storage.
- Not a replacement for a long Wi-Fi passphrase or WPA3.
- Not recoverable if the recovery code is lost.
- Not resistant to host compromise, browser extensions, or a compromised device.
- Each 8-digit password has only about 26.6 bits of entropy. It is a convenience
  format, not a high-security secret.

## Specification

The frozen contract is [`docs/spec-hpg-1.md`](docs/spec-hpg-1.md). The public
vectors are [`test-vectors.json`](test-vectors.json). Do not edit existing
vectors; any change is a new algorithm version (`HPG-2`).

Recovery code example for seed `000102030405060708090a0b0c0d0e0f`:

```
HPG1-0004-1061-050R-3GG2-8A1C-60T3-GF2F
```

## Development

Requirements: Node.js 26+ (built-in test runner, global WebCrypto) and Python
3.10+ for the independent reference. No dependencies are installed.

```sh
make test          # Node implementation + published vectors (21 tests)
make cross-check   # independent Python reference vs. test-vectors.json
make check         # both
```

Repository layout:

```
src/derive.js            HPG-1 password derivation (WebCrypto)
src/recovery-code.js     HPG1 encode/decode, checksum, fingerprint
test/                    Node test runner suites
test-vectors.json        frozen public vectors
tools/reference.py       independent standard-library implementation
docs/spec-hpg-1.md       the specification
.knowledge/              research notes and the implementation plan
```

## Roadmap

| Phase | Deliverable |
|---|---|
| 1 | Derivation spec, recovery codes, vectors (this state) |
| 2 | Single-file mobile-first app and recovery ceremony |
| 3 | Hardened build, CSP headers, Cloudflare Pages, offline copy |
| 4 | Threat model, privacy/FAQ docs, usability and router verification |
| 5 | Public/private launch decision and maintenance contract |

## License

Not chosen yet; a permissive license (MIT or Apache-2.0) is planned for Phase 4.
