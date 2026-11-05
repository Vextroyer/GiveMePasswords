import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { hkdf, derivePassword8, deriveMonth } from "../src/derive.js";
import {
  encodeRecoveryCode,
  parseRecoveryCode,
  seedFingerprint,
} from "../src/recovery-code.js";

const vectors = JSON.parse(
  readFileSync(new URL("../test-vectors.json", import.meta.url), "utf8"),
);
const hex = (s) => Uint8Array.from(s.match(/../g).map((h) => parseInt(h, 16)));
const toHex = (bytes) => Buffer.from(bytes).toString("hex");

test("published vectors declare the frozen spec version", () => {
  assert.equal(vectors.spec, "HPG-1");
});

test("published RFC 5869 A.1 vector still reproduces", async () => {
  const { ikm_hex, salt_hex, info_hex, okm_hex } = vectors.hkdf_sha256_rfc5869_a1;
  const okm = await hkdf(hex(ikm_hex), hex(salt_hex), hex(info_hex), okm_hex.length / 2);

  assert.equal(toHex(okm), okm_hex);
});

test("every published password vector reproduces", async () => {
  assert.ok(vectors.passwords.length >= 5);

  for (const vector of vectors.passwords) {
    const actual = await derivePassword8(
      hex(vector.seed_hex),
      vector.month,
      vector.day,
      vector.attempt,
    );
    assert.equal(actual, vector.password8, JSON.stringify(vector));
  }
});

test("the published rejection vector is genuinely rejected on attempt 0", async () => {
  const { seed_hex, month, day, attempt0_x, limit } = vectors.rejection;
  const info = new TextEncoder().encode(
    `HPG-1|${month}|${String(day).padStart(2, "0")}|0`,
  );
  const okm = await hkdf(hex(seed_hex), new TextEncoder().encode("HPG-1|seed"), info, 64);
  const x = ((okm[0] << 24) | (okm[1] << 16) | (okm[2] << 8) | okm[3]) >>> 0;

  assert.equal(x, attempt0_x);
  assert.ok(x >= limit, "attempt 0 must fall outside the acceptance range");
});

test("every published month reproduces in full", async () => {
  assert.ok(vectors.months.length >= 2);

  for (const { seed_hex, month, passwords } of vectors.months) {
    assert.deepEqual(await deriveMonth(hex(seed_hex), month), passwords, month);
  }
});

test("the same month under different seeds is different", () => {
  const [first, second] = vectors.months;
  assert.notDeepEqual(first.passwords, second.passwords);
});

test("every published recovery code round-trips", async () => {
  assert.ok(vectors.recovery_codes.length >= 1);

  for (const { seed_hex, code, fingerprint } of vectors.recovery_codes) {
    const seed = parseRecoveryCode(code);
    assert.equal(toHex(seed), seed_hex);
    assert.equal(encodeRecoveryCode(hex(seed_hex)), code);
    assert.equal(seedFingerprint(hex(seed_hex)), fingerprint);
  }
});
