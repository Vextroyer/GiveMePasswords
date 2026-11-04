// HPG-1: stateless, client-side monthly password derivation.
// Pure ESM; uses the WebCrypto global so it runs in both Node and browsers.

const VERSION = "HPG-1";
const SALT = new TextEncoder().encode(`${VERSION}|seed`);
const LIMIT = 4_200_000_000; // unsigned 32-bit rejection bound
const MOD = 100_000_000;

/** Normalize a Uint8Array/ArrayBuffer to a Uint8Array. */
function bytes(value) {
  return value instanceof Uint8Array ? value : new Uint8Array(value);
}

/** HKDF info string for a given month, day and attempt. */
function info(month, day, attempt) {
  return new TextEncoder().encode(
    `${VERSION}|${month}|${String(day).padStart(2, "0")}|${attempt}`,
  );
}

/**
 * HKDF-SHA-256 (RFC 5869).
 *
 * WebCrypto's single `deriveBits` call with an HKDF key is spec-equivalent to
 * HKDF-Extract followed by HKDF-Expand, so no manual two-step is needed.
 */
export async function hkdf(ikm, salt, infoBytes, lengthBytes) {
  const key = await globalThis.crypto.subtle.importKey(
    "raw",
    bytes(ikm),
    "HKDF",
    false,
    ["deriveBits"],
  );
  const result = await globalThis.crypto.subtle.deriveBits(
    {
      name: "HKDF",
      hash: "SHA-256",
      salt: bytes(salt),
      info: bytes(infoBytes),
    },
    key,
    lengthBytes * 8,
  );
  return new Uint8Array(result);
}

/** Derive the 8-digit password for a single day. */
export async function derivePassword8(seed, month, day, attempt = 0) {
  const seedBytes = bytes(seed);
  if (seedBytes.length !== 16) {
    throw new TypeError("seed must be 16 bytes");
  }

  for (;;) {
    const okm = await hkdf(seedBytes, SALT, info(month, day, attempt), 64);
    // Big-endian unsigned 32-bit value from the first four bytes.
    const x =
      ((okm[0] << 24) | (okm[1] << 16) | (okm[2] << 8) | okm[3]) >>> 0;

    // Rejection sampling keeps the output uniform over [0, MOD); if the value
    // is at or above LIMIT, bump the attempt counter and try again.
    if (x < LIMIT) {
      return String(x % MOD).padStart(8, "0");
    }
    attempt += 1;
  }
}

/** Derive every day's password for a "YYYY-MM" month, in day order. */
export async function deriveMonth(seed, month) {
  const match = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(month);
  if (!match) {
    throw new RangeError("month must be in YYYY-MM format");
  }

  const year = Number(match[1]);
  const monthNumber = Number(match[2]);
  // Date.UTC(year, monthNumber, 0) is the last day of the 1-based month.
  const days = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();

  const result = [];
  for (let day = 1; day <= days; day += 1) {
    result.push(await derivePassword8(seed, month, day));
  }
  return result;
}
