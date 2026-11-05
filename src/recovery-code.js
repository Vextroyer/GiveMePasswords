// HPG1 recovery codes: printable, checksummed backups of a 16-byte seed.
// Pure ESM; uses only TextEncoder and a small synchronous SHA-256 so the API
// stays synchronous in browsers (WebCrypto's digest is async-only).

const PREFIX = "HPG1";
const SEED_BYTES = 16;
const PAYLOAD_CHARS = 26; // 130 bits of capacity for a 128-bit seed
const CHECKSUM_CHARS = 2; // 10 bits
const CODE_CHARS = PAYLOAD_CHARS + CHECKSUM_CHARS;

// Crockford Base32: no I, L, O or U.
const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const DIGITS = new Map([...ALPHABET].map((char, index) => [char, index]));

const CHECKSUM_CONTEXT = new TextEncoder().encode("HPG1");
const FINGERPRINT_CONTEXT = new TextEncoder().encode("HPG1|fingerprint");

/** Error carrying a stable machine-readable reason. */
export class RecoveryCodeError extends Error {
  constructor(reason, message = reason) {
    super(message);
    this.name = "RecoveryCodeError";
    this.reason = reason;
  }
}

// ---------------------------------------------------------------------------
// Synchronous SHA-256 (FIPS 180-4)
// ---------------------------------------------------------------------------

const SHA256_K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1,
  0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
  0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786,
  0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147,
  0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
  0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b,
  0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a,
  0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
  0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

const SHA256_IV = new Uint32Array([
  0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c,
  0x1f83d9ab, 0x5be0cd19,
]);

const rotr = (value, bits) => (value >>> bits) | (value << (32 - bits));

/** SHA-256 digest of a byte array, returned as 32 bytes. */
function sha256(input) {
  const length = input.length;
  const bitLength = length * 8;
  // 0x80 terminator, zero padding, then the 64-bit length.
  const paddedLength = ((length + 9 + 63) >> 6) << 6;
  const buffer = new Uint8Array(paddedLength);
  buffer.set(input);
  buffer[length] = 0x80;

  const view = new DataView(buffer.buffer);
  view.setUint32(paddedLength - 8, Math.floor(bitLength / 0x100000000), false);
  view.setUint32(paddedLength - 4, bitLength >>> 0, false);

  const hash = SHA256_IV.slice();
  const words = new Uint32Array(64);

  for (let offset = 0; offset < paddedLength; offset += 64) {
    for (let i = 0; i < 16; i += 1) {
      words[i] = view.getUint32(offset + i * 4, false);
    }
    for (let i = 16; i < 64; i += 1) {
      const x = words[i - 15];
      const y = words[i - 2];
      const sigma0 = rotr(x, 7) ^ rotr(x, 18) ^ (x >>> 3);
      const sigma1 = rotr(y, 17) ^ rotr(y, 19) ^ (y >>> 10);
      words[i] =
        (words[i - 16] + sigma0 + words[i - 7] + sigma1) >>> 0;
    }

    let [a, b, c, d, e, f, g, h] = hash;

    for (let i = 0; i < 64; i += 1) {
      const sum1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const choose = (e & f) ^ (~e & g);
      const temp1 = (h + sum1 + choose + SHA256_K[i] + words[i]) >>> 0;
      const sum0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const majority = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (sum0 + majority) >>> 0;

      h = g;
      g = f;
      f = e;
      e = (d + temp1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) >>> 0;
    }

    hash[0] = (hash[0] + a) >>> 0;
    hash[1] = (hash[1] + b) >>> 0;
    hash[2] = (hash[2] + c) >>> 0;
    hash[3] = (hash[3] + d) >>> 0;
    hash[4] = (hash[4] + e) >>> 0;
    hash[5] = (hash[5] + f) >>> 0;
    hash[6] = (hash[6] + g) >>> 0;
    hash[7] = (hash[7] + h) >>> 0;
  }

  const digest = new Uint8Array(32);
  const digestView = new DataView(digest.buffer);
  for (let i = 0; i < 8; i += 1) {
    digestView.setUint32(i * 4, hash[i], false);
  }
  return digest;
}

/** Concatenate byte arrays into a fresh Uint8Array. */
function concat(...parts) {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const result = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.length;
  }
  return result;
}

// ---------------------------------------------------------------------------
// Byte / Base32 helpers
// ---------------------------------------------------------------------------

/** Validate a seed and return it as a Uint8Array. */
function assertSeed(seed) {
  if (seed instanceof Uint8Array) {
    if (seed.byteLength !== SEED_BYTES) {
      throw new TypeError(`seed must be ${SEED_BYTES} bytes`);
    }
    return seed;
  }
  if (seed instanceof ArrayBuffer) {
    if (seed.byteLength !== SEED_BYTES) {
      throw new TypeError(`seed must be ${SEED_BYTES} bytes`);
    }
    return new Uint8Array(seed);
  }
  throw new TypeError("seed must be a Uint8Array or ArrayBuffer");
}

/** Big-endian bytes to a BigInt. */
function toBigInt(bytes) {
  let value = 0n;
  for (const byte of bytes) {
    value = (value << 8n) | BigInt(byte);
  }
  return value;
}

/** BigInt to exactly `size` big-endian bytes. */
function fromBigInt(value, size) {
  const result = new Uint8Array(size);
  for (let i = size - 1; i >= 0; i -= 1) {
    result[i] = Number(value & 0xffn);
    value >>= 8n;
  }
  return result;
}

/** Encode a BigInt as exactly `length` Base32 characters, most significant first. */
function toBase32(value, length) {
  let result = "";
  for (let i = length - 1; i >= 0; i -= 1) {
    const digit = Number((value >> BigInt(5 * i)) & 31n);
    result += ALPHABET[digit];
  }
  return result;
}

/** Decode Base32 characters to a BigInt. Assumes characters are in the alphabet. */
function fromBase32(text) {
  let value = 0n;
  for (const char of text) {
    value = (value << 5n) | BigInt(DIGITS.get(char));
  }
  return value;
}

/** 10-bit checksum of a 16-byte seed. */
function checksum(seed) {
  const digest = sha256(concat(CHECKSUM_CONTEXT, seed));
  return (digest[0] << 2) | (digest[1] >> 6);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Encode a 16-byte seed as a canonical grouped recovery code. */
export function encodeRecoveryCode(seed) {
  const bytes = assertSeed(seed);
  const payload = toBase32(toBigInt(bytes), PAYLOAD_CHARS);
  const check = toBase32(BigInt(checksum(bytes)), CHECKSUM_CHARS);
  const body = payload + check;
  const groups = body.match(/.{4}/g);
  return `${PREFIX}-${groups.join("-")}`;
}

/** Normalize user input to a 28-character uppercase payload without separators. */
export function normalizeRecoveryCode(input) {
  if (typeof input !== "string") {
    throw new RecoveryCodeError("BAD_CHAR", "recovery code must be a string");
  }

  // Fold case and remove any whitespace, zero-width characters, or hyphens,
  // wherever they appear. Pasted codes often drag these in invisibly.
  let text = input.toUpperCase().replace(/[\s\u200b\u200c\u200d\ufeff-]/gu, "");

  if (text === "") {
    throw new RecoveryCodeError("EMPTY", "recovery code is empty");
  }

  if (text.startsWith(PREFIX)) {
    text = text.slice(PREFIX.length);
  } else {
    const version = /^HPG(\d)/.exec(text);
    if (version && version[1] !== "1") {
      throw new RecoveryCodeError(
        "BAD_VERSION",
        `unsupported recovery code version: ${version[1]}`,
      );
    }
  }

  // Fold the ambiguous Crockford characters.
  text = text.replace(/[IL]/gu, "1").replace(/O/gu, "0");

  if (text === "") {
    throw new RecoveryCodeError("EMPTY", "recovery code is empty");
  }

  for (const char of text) {
    if (!DIGITS.has(char)) {
      throw new RecoveryCodeError("BAD_CHAR", `invalid character: ${char}`);
    }
  }

  if (text.length !== CODE_CHARS) {
    throw new RecoveryCodeError(
      "BAD_LENGTH",
      `recovery code must contain ${CODE_CHARS} characters`,
    );
  }

  return text;
}

/** Verify and decode a recovery code into its 16-byte seed. */
export function parseRecoveryCode(input) {
  const normalized = normalizeRecoveryCode(input);
  const payload = normalized.slice(0, PAYLOAD_CHARS);
  const check = normalized.slice(PAYLOAD_CHARS);

  const value = fromBase32(payload);
  if (value >> 128n !== 0n) {
    throw new RecoveryCodeError("BAD_LENGTH", "recovery code overflows 128 bits");
  }

  const seed = fromBigInt(value, SEED_BYTES);
  const expected = checksum(seed);
  const actual = Number(fromBase32(check));

  if (actual !== expected) {
    throw new RecoveryCodeError("BAD_CHECKSUM", "recovery code checksum mismatch");
  }

  return seed;
}

/** Short stable fingerprint of a seed, for confirming a backup visually. */
export function seedFingerprint(seed) {
  const bytes = assertSeed(seed);
  const digest = sha256(concat(FINGERPRINT_CONTEXT, bytes));
  let hex = "";
  for (let i = 0; i < 4; i += 1) {
    hex += digest[i].toString(16).padStart(2, "0").toUpperCase();
  }
  return hex;
}
