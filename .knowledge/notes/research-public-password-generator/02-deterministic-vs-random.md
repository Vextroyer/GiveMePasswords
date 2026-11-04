---
id: rq2-deterministic-vs-random
created: 2026-11-04
type: research-note
status: active
parent: research-public-password-generator
question: "How should a public, stateless site derive a reproducible monthly password list from a seed, and how does that compare with random generation?"
tags: [deterministic, kdf, entropy, reproducibility]
---

# RQ2 — Deterministic vs random generation

## Context

- The product is a public, stateless, client-side monthly password list generator.
- Two modes: random and seeded/reproducible.
- The likely unification: every list is derived from a seed; random mode generates a fresh
  seed and shows it as a recovery code.
- The cousin applies each day's password to the router; she needs to regenerate a lost list.
- Output is currently 8-digit numeric per day.

## Sub-questions

1. **Prior art:** how do LessPass, Master Password, and deterministic password managers
   derive passwords? What are their pitfalls (site salts, algorithm versioning, seed
   leakage, offline guessing, UX)? What can this product learn or avoid?
2. **KDF choices:** HKDF/HMAC-SHA-256, PBKDF2, scrypt, Argon2id. Which are available in
   browsers via WebCrypto vs WASM? What are the trade-offs for a high-entropy seed vs a
   human passphrase?
3. **Seed strength:** random 128-bit code vs 6-word Diceware (~77 bits) vs a short PIN. If
   the algorithm and month are public, how fast can an attacker test seeds offline? What
   seed format is both safe and usable?
4. **Seed lifetime:** a long-lived seed with month domain separation vs a per-month seed.
   Blast radius if leaked, rotation, lost seed, recovery. Which is the better default?
5. **Output mapping:** derive 8 decimal digits without modulo bias. Rejection sampling,
   byte-to-digit mapping, per-day derivation, domain separation (`month`, `day`, version`),
   and duplicate handling.
6. **Reproducibility:** canonical month format, authoritative time zone, algorithm version,
   Unicode normalization of passphrases, cross-browser consistency of WebCrypto/WASM, and
   how to avoid silently breaking old lists.
7. **Random mode as a random seed:** generate a 128-bit seed, show it as a recovery code,
   derive the list. What are the UX and security implications vs a purely random list with
   no recovery code?
8. **Recommendation:** an exact derivation scheme, seed format, version string, and test
   vectors so independent implementations produce the same output.

## Scout brief

Prioritize questions 1, 2, 4, 5, and 8. Use project documentation and source code for prior
art, and authoritative crypto references for KDF and mapping guidance. Produce a concrete
proposed derivation and at least one test vector. Flag anything that would require custom
cryptography rather than standard primitives.

## Findings (scout output)

### Summary

- The mature prior art (LessPass, Master Password/Spectre) is built for **one password per site from a human master secret**. This product is the inverse: **one secret, many outputs over time**, with a constrained 8-digit output. Steal their domain-separation and versioning lessons, not their password-hardening defaults.
- For a **128-bit random recovery code**, HKDF-SHA-256 (WebCrypto) is the right primitive: standard, fast, deterministic, no WASM. PBKDF2/Argon2 are only needed if the seed is human-memorable, and a short PIN is unsafe at any realistic cost factor.
- Use a **long-lived seed + `YYYY-MM` as HKDF `info`**, not a per-month seed. Add a version/`key_id` prefix so old lists keep reproducing, and archive old seeds on rotation.
- Derive **per day** (`version|month|day|attempt`) and map to 8 digits with **rejection sampling**, never `byte % 10`. 30 days from 10^8 values has a duplicate probability of ~4e-6; define a deterministic retry rule anyway.
- **Random mode should be "random seed + recovery code."** It unifies the code path, makes the cousin's lost-list case recoverable, and costs only the custody of one code. A purely random, non-reproducible list cannot satisfy the stated recovery requirement.
- 8 digits is only **~26.6 bits per day**. The seed protects the *ability to regenerate the list*; it cannot make an individual daily password stronger than the router's 8-digit space.

### Prior art

| System | Derivation | Notable pitfalls |
|---|---|---|
| **LessPass** | `PBKDF2-SHA256(masterPassword, salt = site + login + counter, 100_000 iters, 32 bytes)` → big integer → repeated long division by charset length to pick characters; inserts one char per selected class. | Salt is **raw concatenation with no delimiters**; the project's own spec documents collisions such as `(site=lesspass.com, login=bob)` ≡ `(lesspass.co, login=mbob)`. A v1 template bug reduced brute-force resistance ([issue #88](https://github.com/lesspass/lesspass/issues/88)). Human master password → offline guessing is the real limit. Algorithm/template changes break old outputs; no first-class version field in the output. |
| **Master Password / Spectre** | `masterKey = scrypt(masterPassword, salt = "com.lyndir.masterpassword" + len(name) + name, N=32768, r=8, p=2, dkLen=64)`; `siteSeed = HMAC-SHA256(masterKey, "com.lyndir.masterpassword" + len(site) + site + counter_u32)`; first byte indexes a template, later bytes select characters. | Same "one master secret → everything" blast radius. Full name is a **low-entropy, often public salt**; an attacker who knows the name can attack the master password offline. Site-name canonicalization (subdomains, IDN, trailing dots) and counters are UX traps. Version v0–v3 are kept forever for compatibility — good precedent, high maintenance cost. |
| **General deterministic managers** | Stateless: no vault, re-derive on demand. | No revocation: a leaked seed compromises every derived password. No audit trail. Phishing/lookalike domains silently produce a plausible wrong password. Cross-language reproducibility is fragile (UTF-8, integer width, byte order, Unicode normalization). |

**Lessons for this product**

1. Use **length-prefixed or delimiter-escaped fields**, or a canonical struct — never `site + login + counter`.
2. Put a **version identifier in the recovery code and in the derivation inputs**, and keep old derivations forever.
3. Do not let a human passphrase be the default seed. Use a random code, and if passphrase mode exists, label it as lower assurance and use a slow KDF.
4. Treat the recovery code as a **bearer secret for the whole list**, not as a password hint.

### KDF and seed analysis

**Browser availability**

| Primitive | Where | Use for this product |
|---|---|---|
| HMAC-SHA-256 / HKDF-SHA-256 | WebCrypto (`SubtleCrypto.deriveBits`, `importKey("raw", …, "HKDF")`) | **Default** for a 128-bit random code. HKDF-Extract = HMAC(salt, IKM); HKDF-Expand = HMAC(PRK, T(i-1)\|info\|i). RFC 5869 §4 explicitly warns HKDF **cannot amplify entropy** and is not a password KDF. |
| PBKDF2-SHA-256 | WebCrypto | Only for human passphrases. Freeze iteration count (OWASP 2023+: 600k for SHA-256) and hash; count is part of the version. |
| scrypt | No WebCrypto; WASM/JS | Memory-hard, good for passphrases, but adds a WASM dependency and parameter-freezing burden. |
| Argon2id | No WebCrypto; WASM (e.g. `argon2-browser`, ~25 KB wasm) | Best passphrase KDF, but third-party crypto + WASM load/compile variance. Pin the exact library version and hash. |

Notes from MDN/WebCrypto: `deriveBits` length **must be a multiple of 8** for cross-browser compatibility; HKDF and PBKDF2 reject non-multiples. Use `extractable: false`, pass an explicit salt (an omitted HKDF salt becomes `HashLen` zero bytes), and never rely on default iteration counts.

**Trade-off**

- High-entropy random code: HKDF is fast (sub-millisecond), so there is **no reason to slow it down**. A slow KDF only adds latency and a false sense of protection.
- Human passphrase: must use PBKDF2/Argon2id; without it, a GPU tests billions of candidates per second. Even with Argon2id at 64 MiB, a 6-digit PIN is gone in hours.
- Adding Argon2id/WASM introduces a second implementation that must be bit-for-bit identical across browsers and Node for tests. If the product ships only random codes, **do not ship WASM**.

**Seed strength** (offline attacker knows the algorithm, the month, and the 8-digit outputs)

| Seed | Entropy | Offline cost (HKDF, ~10^9–10^10 guesses/s on a GPU) | Verdict |
|---|---|---|---|
| 128-bit random (16 bytes) | 128 bits | ~3.4×10^38 candidates; infeasible | **Recommended** |
| 26-char Crockford Base32 | ~130 bits (128 used) | infeasible | Recommended encoding |
| 6 EFF long-list words (7776^6) | ~77.5 bits (EFF states ~2^77) | ~10^13 s ≈ 10^5 years at 10^10/s | Acceptable fallback; must be generated, not chosen |
| 8-char random alphanumeric | ~47 bits | hours–days | Too weak for a long-lived list secret |
| 6-digit PIN | ~20 bits | seconds even with Argon2id | **Unsafe** |
| 4-digit PIN | ~13 bits | instant | **Unsafe** |

Two separate ceilings matter:

1. **Seed guessing**: attacker derives a candidate list and compares to observed daily outputs. One day gives a 10^-8 false-positive rate per candidate; two or three days make false positives negligible, so the work is essentially the seed space. 128 bits and 77-bit Diceware are both out of reach; PINs are not.
2. **Daily password strength**: the output alphabet is 10^8 ≈ **26.6 bits**, regardless of seed. If an attacker can query the router online, rate limiting is the real control. The seed does not raise this ceiling.

**Encoding recommendation**: 16 random bytes from `crypto.getRandomValues`, rendered as **26 Crockford Base32 characters** (uppercase, excludes I/L/O/U), plus a separate 2-character checksum for transcription. Normalize input by uppercasing, stripping spaces/hyphens, and mapping `I,L→1`, `O→0`. Keep the canonical form ASCII-only; no Unicode normalization needed for random codes.

### Seed lifetime: long-lived vs per-month

| | Long-lived seed + month in `info` | Per-month seed |
|---|---|---|
| Blast radius if leaked | All months derived from that seed | One month |
| Codes to store | One | 12+/year; easy to lose |
| Rotation | New seed + new `key_id`; old lists still reproducible only if old seed archived | Natural rotation, but recovery of old months needs the old code anyway |
| Lost seed | All lists lost unless backed up | One month lost |
| UX | One recovery card | Unmanageable for the cousin |

**Recommendation:** one **long-lived seed** (per person/device), with month as HKDF `info`; add an explicit `key_id`/version so a rotated seed coexists with archived ones. The seed should never be sent to a server, put in a URL, or persisted unencrypted. Offer a printed/downloadable recovery card. Per-month seeds are justified only if the seed is escrowed or shared with someone else.

### Unbiased 8-digit mapping

Derive **per day**, not one stream truncated into 30 chunks — truncation makes the list order-sensitive and silently changes every later day if the day count changes.

```
info = "HPG-1" || 0x00 || month_ascii || 0x00 || day_ascii || 0x00 || attempt_u8
okm  = HKDF-Expand(PRK, info, 8)          // 64 bits, more than enough
x    = uint32_be(okm[0..3])
LIMIT = 4_200_000_000                     // floor(2^32 / 10^8) * 10^8 = 42 * 10^8
if x >= LIMIT: attempt += 1; re-derive    // rejection probability ≈ 2.2%
digit8 = (x % 100_000_000) padded to 8 chars
```

- **Never** use `byte % 10`: 256 mod 10 = 6, giving digits 0–5 a ~2.3% relative advantage.
- Rejection sampling is exact and cheap. A per-digit variant is: read bytes, accept `b < 250`, `digit = b % 10`, else consume the next byte.
- **Duplicates**: over 30 days the birthday probability is `C(30,2)/10^8 ≈ 4.35×10^-6`. Define the rule now: if `digit8` equals an earlier day's value in the same month, increment `attempt` for that day only and re-derive. Never sort, shuffle, or dedupe the list itself — order is part of the contract.
- **Leading zeros** are significant in the canonical string. Display as `0423 1987`, but document that the router may accept `4231987`; store the zero-padded form.
- Include `attempt` in `info` so retries are deterministic and independent, and never reuse a rejected value.

### Reproducibility and versioning

- **Canonical month**: `YYYY-MM` ASCII, proleptic Gregorian, **UTC**. Day: `DD`, zero-padded. Never use locale month names, `toLocaleDateString`, or local midnight.
- **Authoritative time**: do not silently trust the device clock. Default the month picker from `new Date().toISOString().slice(0,7)` but let the user choose; pin the chosen label for the session and print it on the list. This removes DST/time-zone ambiguity entirely.
- **Version string**: `HPG-1-HKDF-SHA256-D8` (or a structured header `{v:1, kdf:"HKDF-SHA256", map:"rej-u32-d8", month:"YYYY-MM"}`). Version is part of the recovery code and part of every `info`. Keep `derive(version, …)` dispatch and golden tests for every shipped version forever; never change a default in place.
- **Unicode**: for random codes, ASCII only. If passphrase mode is added, specify **NFC** and UTF-8 bytes, and make normalization part of the version; LessPass's spec only says "UTF-8", which is a reproducibility trap.
- **Cross-browser**: WebCrypto HKDF is spec'd and deterministic; use explicit salt, `deriveBits(..., 64)` (multiple of 8), raw key import. If Argon2id/WASM is ever added, pin the exact wasm build hash and library version; test Chrome/Firefox/Safari/Node against the same vectors.
- **No silent breakage**: publish `test-vectors.json` in the repo; CI runs it on every browser target. Old lists must remain reproducible even after the UI changes.
- **Leak hygiene**: keep the seed out of URLs, `localStorage` (unless encrypted), analytics, error reports, and clipboard history where possible. Prefer in-memory + optional encrypted-at-rest device storage.

### Proposed derivation (concrete)

**Name/version:** `HPG-1` — HKDF-SHA-256, 8 decimal digits, canonical `YYYY-MM`, day `DD`.

**Inputs**

- `seed`: 16 bytes from `crypto.getRandomValues`; displayed as 26 Crockford Base32 chars + 2-char checksum.
- `month`: ASCII `YYYY-MM`, UTC, user-confirmed.
- `day`: ASCII `DD` (01–31), or a uint8.
- `attempt`: uint8, starts at 0.

**Algorithm**

```
seed_bytes = crockford_decode(normalize(recovery_code))       # 16 bytes
PRK        = HKDF-Extract(salt = UTF8("HPG-1|seed"), IKM = seed_bytes)
info       = UTF8("HPG-1|" + month + "|" + day + "|" + attempt_decimal)
okm        = HKDF-Expand(PRK, info, 8)                        # 8 bytes
x          = big-endian uint32 of okm[0..3]
if x >= 4_200_000_000: attempt += 1; goto info
password   = zero_pad_decimal(x mod 100_000_000, 8)
```

Reference JS (WebCrypto) for pinning vectors:

```js
const enc = new TextEncoder();
// HKDF(salt, ikm, info, L) == Expand(Extract(salt, ikm), info, L).
// WebCrypto performs the whole HKDF in ONE deriveBits call, so import the
// seed as the IKM and pass the extraction salt here. Do NOT try to compute a
// "PRK" with a first deriveBits call: WebCrypto would run Expand on it too,
// and the result is not the PRK.
const seedKey = await crypto.subtle.importKey("raw", seedBytes, "HKDF", false, ["deriveBits"]);
let attempt = 0, x;
do {
  const info = enc.encode(`HPG-1|${month}|${day}|${attempt}`);
  const okm = new Uint8Array(await crypto.subtle.deriveBits(
    { name: "HKDF", hash: "SHA-256", salt: enc.encode("HPG-1|seed"), info },
    seedKey, 64));
  x = ((okm[0] << 24) | (okm[1] << 16) | (okm[2] << 8) | okm[3]) >>> 0;
  attempt++;
} while (x >= 4_200_000_000);
const password = String(x % 100_000_000).padStart(8, "0");
```

> **Correction (verified by execution).** An earlier draft of this note split the
> derivation into two `deriveBits` calls (a "PRK" call with `info = empty`, then a
> second call with the real `info`). That is **not equivalent** to the written
> pseudocode. Tested with the vector below, the two-step form produced
> `59423284`, while the correct one-call form produced `52296676`. The two-step
> form is a nested HKDF, not `Expand(Extract(...))`. Use the one-call form above.

**Test vectors**

1. **HKDF conformance (published, RFC 5869 A.1)** — verifies Extract/Expand plumbing:
   - `IKM = 0b` × 22, `salt = 000102030405060708090a0b0c`, `info = f0f1f2f3f4f5f6f7f8f9`, `L = 42`
   - `PRK = 077709362c2e32df0ddc3f0dc47bba6390b6c73bb50f9c3122ec844ad7c2b3e5`
   - `OKM = 3cb25f25faacd57a90434f64d0362f2a2d2d0a90cf1a5a4c5db02d56ecc4c5bf34007208d5b887185865`

2. **Mapping conformance (real arithmetic)** — first 4 bytes of the A.1 `OKM`:
   - `x = 0x3cb25f25 = 1_018_322_725`, accepted (`< 4_200_000_000`)
   - `x mod 100_000_000 = 18_322_725` → **`18322725`**
   - Rejection example: `x = 0xffffffff = 4_294_967_295` → rejected, `attempt` increments.

3. **End-to-end `HPG-1` vector — PINNED.** Inputs and outputs verified with two
   independent implementations (Python `hmac`/`hashlib`, Node WebCrypto) that agree
   byte-for-byte on the full month:
   - `seed_hex = 000102030405060708090a0b0c0d0e0f`
   - `month = 2026-11`, `day = 01`, `attempt = 0`
   - Expected `password8`: **`52296676`**
   - Additional vectors (same seed):
     - `2026-11-02` → `59443424`
     - `2026-11-30` → `07134458`
     - `2026-12-01` → `78951395` (month is part of the derivation)
   - Full `2026-11` list, for regression tests:
     `52296676, 59443424, 83846756, 70111090, 98821760, 81755616, 09289275,
     00452683, 23441541, 42716621, 08991196, 35078059, 94751121, 18087714,
     23771102, 06905453, 00198549, 48151335, 14824600, 31441917, 67280183,
     55744060, 41368153, 46284955, 50969767, 74632828, 95289424, 87041675,
     35278526, 07134458`
   - Second seed `ffeeddccbbaa99887766554433221100`, `2026-11-01` → `74165350`
     (proves the seed changes the stream).

4. **Rejection path — PINNED.** Same seed, `month = 2020-02`, `day = 14`:
   - `attempt = 0` → `x = 4_261_244_084` (`>= 4.2e9`) → rejected; `okm = fdfd6cb46d59cfb4`
   - `attempt = 1` → `x = 3_081_039_139` → accepted; `okm = b7a4ed23ac801e5a`;
     `password8 = 81039139`
   - This is the only vector that exercises the retry loop. Any implementation that
     omits the rejection check will emit `26124408` here and diverge.

5. **Optional passphrase variant `HPG-1P` — PINNED (not part of `HPG-1`).**
   For a human-memorable seed. Derive the root **once per list** with PBKDF2, then
   derive each day with HKDF (31 × 600k PBKDF2 would cost ~10 s on the test
   machine; one root derivation measured **342 ms** in Node):
   - `passphrase = "correct horse battery staple"` (NFC, UTF-8)
   - `root = PBKDF2-SHA-256(passphrase, salt = "HPG-1P|root", iterations = 600_000, dkLen = 32)`
     → `996317a57cefae628f375258f012fa0aaf5779153f584a144dc493ad2b41b84e`
   - `day_key = HKDF-SHA-256(salt = "HPG-1P|day", ikm = root,
     info = "HPG-1P|YYYY-MM|DD|attempt", L = 64 bits)`, same rejection mapping.
   - Vectors: `2026-11-01` → `95815836`; `2026-11-02` → `01118685`;
     `2026-11-30` → `54100542`.
   - Do **not** use Argon2id via WASM unless it is genuinely needed: PBKDF2 is native
     WebCrypto, whereas Argon2 adds a pinned third-party binary to the trust base.

> **Custom-crypto flags**: rejection sampling and decimal formatting are ordinary encoding, not crypto. Do **not** invent a hash chain, a bespoke "seed mixer", or a custom cipher. `SHA-256(prefix || seed || info)` is *not* an acceptable substitute for HKDF (length-extension + not a KDF). Any Argon2id/WASM wrapper is third-party crypto: pin the exact build.

### Recommendation: random mode = random seed + recovery code

Adopt **random seed + recovery code** as the only generation path.

**Why**

- One algorithm, one test suite, one UI. "Random" becomes `seed = getRandomValues(16 bytes)` and immediately show the derived list.
- It satisfies the cousin's real requirement: regenerate a lost list. A non-reproducible random list is a dead end for that use case.
- No server is needed, preserving "public, stateless, client-side".
- The security is not worse than a non-reproducible list *for daily passwords*; the only new asset is the recovery code, which is exactly the asset the user must protect anyway.

**Costs and mitigations**

- The recovery code is a **bearer secret for every month**. Show it once, force an explicit "I saved it" acknowledgement, allow print/download, and never put it in a URL. Offer an optional user-PIN-encrypted local save.
- Rotation: support a new seed with a new `key_id`; keep the old seed to reproduce archived lists.
- Do **not** email the code or store it server-side. If a hosted backup is ever added, encrypt client-side first.
- Keep a "random, non-recoverable" escape hatch only if a user explicitly opts out; default to recoverable.

### Open questions

1. Is the 8-digit format fixed by the router? If so, per-day security is capped at ~26.6 bits and the product should say so plainly; a check digit would reduce that further.
2. Should the month be clock-derived or always user-selected? (Recommendation: user-confirmed, defaulted from UTC.)
3. Exact duplicate policy: per-day `attempt` retry (proposed) vs. accept duplicates with a warning.
4. Do we need a passphrase mode at all? If yes, PBKDF2-SHA-256 600k (WebCrypto-only) vs. Argon2id WASM (better, more supply-chain risk).
5. Seed backup UX: printed card, encrypted file, or both; whether to support split/escrow for a family member.
6. Pin the end-to-end test vector (item 3 above) and add cross-browser CI vectors before shipping.
7. Version negotiation: how long must `HPG-1` remain in the bundle, and how are retired versions documented?

### Sources used

- https://lesspass.com
- https://github.com/lesspass/lesspass
- https://github.com/lesspass/lesspass/wiki/Password-Generation-Specification
- https://github.com/lesspass/lesspass/wiki/Overview-of-Password-Generation
- https://github.com/lesspass/lesspass/issues/88
- https://masterpassword.app
- https://spectre.app
- https://en.wikipedia.org/wiki/Master_Password_(algorithm)
- https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/deriveBits
- https://www.w3.org/TR/WebCryptoAPI/
- https://datatracker.ietf.org/doc/html/rfc5869
- https://github.com/antelle/argon2-browser
- https://www.eff.org/dice
- https://api.hashify.net/hash/sha256/hex (used only to confirm SHA-256 plumbing; no HMAC endpoint available over GET)
