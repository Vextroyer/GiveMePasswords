# HPG-1: Monthly Password Generator Specification

- **Version:** HPG-1
- **Status:** Frozen. Published 2026-11-04.
- **Reference implementations:** `src/derive.js` (shipped, WebCrypto),
  `tools/reference.py` (independent, standard library), `src/recovery-code.js`
  (format), `tools/reference.py` (format cross-check).
- **Pinned vectors:** [`test-vectors.json`](../test-vectors.json)

This document is the contract. An independent implementer must be able to
reproduce every value in `test-vectors.json` from this text alone.

---

## 1. Purpose and scope

HPG-1 derives a deterministic sequence of 8-digit passwords from a 16-byte
**seed** and an explicit **month**. The same `(seed, month)` always produces the
same list; different months or different seeds produce unrelated lists.

HPG-1 defines **derivation and the recovery-code format only**. It does not
define how the seed is generated, stored, or transmitted, and it makes no claim
that an 8-digit password resists offline attack. See §10.

Non-goals:

- No accounts, servers, keys, or network state.
- No configurable length, alphabet, or pattern avoidance in v1.
- No clock read in the derivation path. Callers pass the month and day
  explicitly; the clock may only be used to pick a default in a UI.

## 2. Notation

| Term | Meaning |
|---|---|
| `UTF8(s)` | The bytes of string `s` in UTF-8, without a BOM or terminator. |
| `BE32(b)` | The unsigned 32-bit integer encoded big-endian in the first 4 bytes of `b`. |
| `bytes` | An octet string. Hex is lowercase with no `0x` prefix. |
| `byte[i]` | The `i`-th byte, zero-based. |
| `mod` | Non-negative remainder of integer division. |

All arithmetic on 32-bit values is unsigned. Where an implementation uses
signed integers internally, it must mask or shift to unsigned (`>>> 0` in
JavaScript).

## 3. Seed

- A seed is **exactly 16 bytes** (128 bits).
- How the seed is produced is outside HPG-1. The reference app uses
  `crypto.getRandomValues(new Uint8Array(16))`.
- The seed is the only secret input. It is never derived from a password,
  a username, a date, or the router's identity.

## 4. Constants

```
VERSION = "HPG-1"
SALT    = UTF8("HPG-1|seed")
LIMIT   = 4200000000        // 4.2e9
MOD     = 100000000         // 1e8
OKM_LEN = 64                // bytes requested from HKDF
```

Note the distinction: the **algorithm** version string is `HPG-1` (with a
hyphen); the **recovery-code** prefix is `HPG1` (without one, §7). They are
different namespaces and must not be interchanged.

## 5. Date inputs

- `month` is a string matching `^\d{4}-(0[1-9]|1[0-2])$`, for example `2026-11`.
  It is always supplied by the caller and is never inferred inside the
  derivation.
- `day` is an integer `1..N`, where `N` is the number of days in `month` in the
  proleptic Gregorian calendar (including the century leap-year rule).
- `attempt` is a non-negative integer starting at `0`.

An implementation must be able to derive a day even if that day does not exist
in the month (for example `2026-02-30`), because the derivation is a pure
function; month-length validation belongs to the list builder, not the
per-day primitive.

## 6. Password derivation

For one `(seed, month, day)`:

1. Set `attempt = 0`.
2. Build the info string:

   ```
   info = UTF8("HPG-1|" + month + "|" + DD + "|" + decimal(attempt))
   ```

   where `DD` is `day` zero-padded to exactly two decimal digits. Example:
   `HPG-1|2026-11|01|0`.

3. Compute the HKDF output:

   ```
   okm = HKDF-SHA-256(salt = SALT, IKM = seed, info = info, L = OKM_LEN)
   ```

   HKDF is defined by RFC 5869:

   ```
   PRK = HMAC-SHA-256(key = SALT, message = seed)
   OKM = HKDF-Expand(PRK, info, 64)
   ```

   A WebCrypto implementation performs both steps in one call:
   `deriveBits({name:"HKDF", hash:"SHA-256", salt: SALT, info}, key, 512)`.
   Extracting the PRK first and then expanding it with an empty salt is **not**
   equivalent and is a known bug; do not do it.

4. Read `x = BE32(okm)`.
5. If `x >= LIMIT`, increment `attempt` and go to step 2.
6. Return `x mod MOD`, formatted as a decimal string of exactly **8 ASCII
   digits**, left-padded with `0`.

Only the first four bytes of the OKM are used in v1. Requesting `L = 4` yields
the same first four bytes, but `L = 64` is the canonical form and what the
vectors pin.

### Why `LIMIT = 4_200_000_000`

The valid range is `0..99_999_999` (`10^8` values). Rejection sampling accepts
`x < 4_200_000_000`, which is exactly 42 multiples of `10^8`. Every accepted
value therefore maps uniformly, with no modulo bias. The rejection probability
is `2^32 - 4.2e9` over `2^32`, about **2.2%**, so retries are rare and bounded
in practice.

### List construction

`monthList(seed, month)` derives days `1..N` **sequentially in day order** and
returns the array. It does not deduplicate. Two identical passwords within a
month are accepted; the probability is roughly `N^2 / (2 * 10^8)` (about
`4.4e-6` for a 30-day month).

## 7. Recovery code

The recovery code is a printable backup of the seed. It is **not** a second
secret and does not change the derivation.

### 7.1 Alphabet

Crockford Base32, in this exact order:

```
0123456789ABCDEFGHJKMNPQRSTVWXYZ
```

The letters `I`, `L`, `O`, and `U` are not in the alphabet.

### 7.2 Encoding

1. Interpret the 16 seed bytes as a 128-bit unsigned integer, big-endian
   (`seed[0]` is the most significant byte).
2. Encode it as **26** Base32 characters, most significant character first,
   left-padded with `0`.
3. Compute the checksum:

   ```
   h = SHA-256(UTF8("HPG1") || seed)
   checksum10 = (h[0] << 2) | (h[1] >> 6)
   ```

   This is the first 10 bits of the digest, most significant bit first.
4. Encode `checksum10` as exactly **2** Base32 characters, most significant
   character first.
5. Concatenate: 26 seed characters followed by 2 checksum characters
   (`28` characters total).
6. Group the 28 characters into 7 groups of 4 and join with `-`, prefixed with
   `HPG1-`:

   ```
   HPG1-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX
   ```

The canonical form is uppercase with hyphens. Example for seed
`000102030405060708090a0b0c0d0e0f`:

```
HPG1-0004-1061-050R-3GG2-8A1C-60T3-GF2F
```

The month is **not** embedded in the code. One code serves every month.

### 7.3 Normalization (input)

An implementation must accept human transcription. Normalization, in order:

1. Reject non-string input (`BAD_CHAR`).
2. Uppercase the input.
3. Remove all Unicode whitespace, zero-width characters (`U+200B`, `U+200C`,
   `U+200D`, `U+FEFF`), and all `-` characters.
4. If the result is empty, fail with `EMPTY`.
5. If the result starts with `HPG1`, remove those 4 characters. Otherwise, if
   it starts with `HPG` followed by a digit other than `1`, fail with
   `BAD_VERSION`.
6. Replace every `I` and `L` with `1`, and every `O` with `0`.
7. If the result is empty, fail with `EMPTY`.
8. If any remaining character is not in the alphabet, fail with `BAD_CHAR`.
9. If the result is not exactly 28 characters, fail with `BAD_LENGTH`.
10. Return the 28-character payload without prefix or separators.

Inputs with no prefix are accepted, so a user may paste the payload alone.

### 7.4 Decoding and verification

1. Normalize the input.
2. Split into the first 26 characters (seed payload) and the last 2
   (checksum).
3. Decode the payload as a big-endian Base32 integer. If it does not fit in
   128 bits, fail with `BAD_LENGTH`.
4. Convert to 16 big-endian bytes.
5. Recompute the checksum over the decoded seed and compare with the decoded
   2-character checksum. On mismatch, fail with `BAD_CHECKSUM`.
6. Return the seed.

A wrong-but-well-formed code (valid alphabet and length) that passes the
checksum produces a plausible but different list. The checksum is a typo
detector, not authentication. A valid code for a different seed cannot be
detected from the code itself at this layer.

The UI is **not required** to display the fingerprint (§8). Implementations may
compute and display it as an optional confirmation aid, but the HPG-1 contract
does not depend on it. A UI that omits the fingerprint must not claim to detect
a valid-but-wrong code.

### 7.5 Error reasons

| Reason | Condition |
|---|---|
| `EMPTY` | Nothing left after stripping whitespace and separators. |
| `BAD_VERSION` | A non-`HPG1` prefix such as `HPG2`. |
| `BAD_CHAR` | A character outside the alphabet after folding. |
| `BAD_LENGTH` | Payload is not 28 characters, or decodes beyond 128 bits. |
| `BAD_CHECKSUM` | The 2-character checksum does not match the seed. |

Errors must carry a stable machine-readable `reason` so the UI can explain the
failure without parsing prose.

## 8. Seed fingerprint

The fingerprint is a short, non-secret confirmation aid:

```
fingerprint = lowercase_hex(SHA-256(UTF8("HPG1|fingerprint") || seed))[0:4]
```

It is rendered as **8 uppercase hex characters** (the first 4 bytes). It
reveals no useful information about the seed beyond what an 8-digit password
already reveals, and it is not a checksum of the list.

The fingerprint is part of the derivation contract: implementations must be able
to compute it, and the published vectors pin its value. Displaying it is
**optional**. The reference UI does not show, print, or export it.

Example: seed `000102030405060708090a0b0c0d0e0f` → `CA7EF2C3`.

## 9. Versioning policy

- `HPG-1` is **frozen**. The constants, the salt, the info layout, the
  rejection rule, and the code format never change under this name.
- Any behavioral change requires a new version, `HPG-2`, with its own salt and
  info strings (for example `HPG-2|seed`) and its own vectors. Old versions
  remain documented so previously issued lists stay reproducible.
- Implementations must reject unknown recovery-code prefixes with
  `BAD_VERSION` rather than guessing.
- `test-vectors.json` is append-only for a given version. Editing an existing
  value is a breaking change.

## 10. Security properties and limits

- **Determinism is the feature.** Anyone who knows the seed can derive the
  whole list. There is no server secret and no authentication.
- **Entropy is the password's, not the seed's.** A 128-bit seed prevents
  guessing across days, but each day's password has only `log2(10^8) ≈ 26.6`
  bits of entropy and can be brute-forced offline if an attacker captures a
  WPA handshake.
- **No forward secrecy.** Compromise of the seed reveals past and future
  months derived from it. Rotation only protects months derived from the new
  seed; it does not protect an attacker who already has the old one.
- **No recovery.** A lost seed cannot be reconstructed. The recovery code is
  the only backup.
- **Out of scope:** host compromise, malicious browser extensions, compromised
  devices, and router firmware attacks. HPG-1 does not make Wi-Fi safe; it makes
  a daily-changing 8-digit password practical.

## 11. Worked example

Seed: `000102030405060708090a0b0c0d0e0f`

```
month = "2026-11", day = 1, attempt = 0
info  = "HPG-1|2026-11|01|0"
okm   = HKDF-SHA-256("HPG-1|seed", seed, info, 64)
x     = 752296676             // first 4 bytes, big-endian
x < 4200000000                // accepted
password = "52296676"
```

`day = 2` gives `59443424`; `2026-11-30` gives `07134458`; `2026-12-01` gives
`78951395`.

Rejection example: `month = "2020-02", day = 14, attempt = 0` yields
`x = 4261244084`, which is `>= 4200000000`. Attempt `1` yields `81039139`.

## 12. Conformance

An implementation conforms to HPG-1 if:

1. It reproduces every entry in `test-vectors.json`.
2. It reproduces the RFC 5869 A.1 OKM using the same single-call HKDF form.
3. It fails closed with the documented reasons on malformed recovery codes.
4. It never reads the clock inside the derivation path.

Run the two independent implementations:

```sh
make test          # Node WebCrypto implementation + vector file
make cross-check   # Python standard-library implementation
```
