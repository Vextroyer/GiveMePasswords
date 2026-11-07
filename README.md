# Monthly Password Generator

A public, stateless, client-side tool that turns a 16-byte seed into a month of
8-digit daily passwords. Nothing is sent to a server, nothing is stored, and the
same seed always produces the same list.

> **Status:** Live at
> [`https://vextroyer.github.io/GiveMePasswords/`](https://vextroyer.github.io/GiveMePasswords/).
> The app, the hardened build, and the trust documentation are complete.
> Remaining work is real-browser/device QA and the public/private launch
> decision. See [`docs/qa-record.md`](docs/qa-record.md).

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

Read [`docs/threat-model.md`](docs/threat-model.md) before relying on it for
anything other than a home network.

## Specification

The frozen contract is [`docs/spec-hpg-1.md`](docs/spec-hpg-1.md). The public
vectors are [`test-vectors.json`](test-vectors.json). Do not edit existing
vectors; any change is a new algorithm version (`HPG-2`).

Recovery code example for seed `000102030405060708090a0b0c0d0e0f`:

```
HPG1-0004-1061-050R-3GG2-8A1C-60T3-GF2F
```

## Development

Requirements: Node.js 20+ (built-in test runner, global WebCrypto) and Python
3.10+ for the independent reference. No dependencies are installed.

```sh
make test          # derivation, vectors, recovery codes, session, policy, build (55 tests)
make cross-check   # independent Python reference vs. test-vectors.json
make check         # both
make build         # regenerate dist/index.html and dist/SHA256SUMS
make verify-build  # rebuild and prove dist/ is byte-for-byte current
```

Run the UI locally (ES modules need HTTP, not `file://`):

```sh
python3 -m http.server 8080 --directory src
# open http://localhost:8080/
```

## Verifying a deployed copy

The reviewed artifact and its hash are committed. Compare the served page with
`dist/SHA256SUMS`:

```sh
curl -s "https://vextroyer.github.io/GiveMePasswords/?$(date +%s)" | sha256sum
cat dist/SHA256SUMS
```

The page footer shows the product version and a build id (the first 16 hex
characters of the SHA-256 of the inline script). The full procedure, including
the meta-CSP and header checks, is in [`docs/verification.md`](docs/verification.md).

## Documentation

| Document | What it covers |
|---|---|
| [`docs/architecture.md`](docs/architecture.md) | Maintainer overview: layout, data flow, build, test, deploy, rationale |
| [`docs/spec-hpg-1.md`](docs/spec-hpg-1.md) | Frozen algorithm and recovery-code contract |
| [`docs/faq.md`](docs/faq.md) | Using it, security questions, router problems, offline use |
| [`docs/threat-model.md`](docs/threat-model.md) | Assets, attackers, mitigations, residual risks |
| [`docs/privacy.md`](docs/privacy.md) | What is collected (nothing), what the host logs |
| [`docs/verification.md`](docs/verification.md) | How to check the artifact, headers, and rebuild |
| [`docs/deployment.md`](docs/deployment.md) | GitHub Pages deployment, trigger paths, rollback |
| [`docs/qa-record.md`](docs/qa-record.md) | Automated evidence and pending manual checks |
| [`docs/ux-checklist.md`](docs/ux-checklist.md) | The 15 UX failure modes and their status |
| [`SECURITY.md`](SECURITY.md) | Supported versions, reporting, scope |
| [`CHANGELOG.md`](CHANGELOG.md) | Release history |
| [`LICENSE`](LICENSE) | MIT |

## Repository layout

```
src/index.html           the two-door UI and ceremony dialog
src/app.js               DOM wiring, copy/download/share/print
src/style.css            mobile-first light/dark/print styles
src/strings.js           runtime copy (translation entry point)
src/session.js           month validation and list assembly
src/derive.js            HPG-1 password derivation (WebCrypto)
src/recovery-code.js     HPG1 encode/decode, checksum, fingerprint
scripts/build.mjs        single-file bundler + CSP hashes + artifact checks
dist/index.html          committed, self-contained artifact
dist/SHA256SUMS          committed artifact hash
test/                    Node test runner suites
test-vectors.json        frozen public vectors
tools/reference.py       independent standard-library implementation
docs/                    specification, trust, QA, and operational records
.opencode/               agent framework (agents, commands, skills)
.knowledge/              agent workspace (plans and scratch; not product)
```

## Roadmap

| Phase | Deliverable |
|---|---|
| 1 | Derivation spec, recovery codes, vectors — done |
| 2 | Single-file mobile-first app and recovery ceremony — done |
| 3 | Hardened build and CSP headers — done; deployed to GitHub Pages |
| 4 | Threat model, privacy/FAQ docs — done; real-browser/device QA pending |
| 5 | Public/private launch decision and maintenance contract |

## License

[MIT](LICENSE).
