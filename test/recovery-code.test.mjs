import test from "node:test";
import assert from "node:assert/strict";
import {
  encodeRecoveryCode,
  normalizeRecoveryCode,
  parseRecoveryCode,
  seedFingerprint,
} from "../src/recovery-code.js";
import { deriveMonth } from "../src/derive.js";

const hex = (s) => Uint8Array.from(s.match(/../g).map((h) => parseInt(h, 16)));
const toHex = (bytes) => Buffer.from(bytes).toString("hex");

const SEED = hex("000102030405060708090a0b0c0d0e0f");
const CODE = "HPG1-0004-1061-050R-3GG2-8A1C-60T3-GF2F";

test("recovery code encodes the pinned seed vector", () => {
  assert.equal(encodeRecoveryCode(SEED), CODE);
});

test("recovery code round-trips back to the same seed and month", async () => {
  const seed = parseRecoveryCode(CODE);

  assert.equal(toHex(seed), toHex(SEED));
  assert.equal((await deriveMonth(seed, "2026-11"))[0], "52296676");
});

test("normalization folds case, separators, and ambiguous characters", () => {
  assert.equal(
    normalizeRecoveryCode("hpg1-0004 1061 050r 3gg2 8a1c 60t3 gf2f"),
    "00041061050R3GG28A1C60T3GF2F",
  );
  assert.equal(
    normalizeRecoveryCode("OOO4-1O61-O5OR-3GG2-8A1C-6OT3-GF2F"),
    "00041061050R3GG28A1C60T3GF2F",
  );
  assert.equal(
    normalizeRecoveryCode("0004-1061-050R-3GG2-8A1C-60T3-GF2F".replaceAll("1", "I")),
    "00041061050R3GG28A1C60T3GF2F",
  );
});

test("normalization accepts a payload without the HPG1 prefix", () => {
  assert.equal(
    normalizeRecoveryCode("0004-1061-050R-3GG2-8A1C-60T3-GF2F"),
    "00041061050R3GG28A1C60T3GF2F",
  );
});

test("invalid input is rejected with a reason", () => {
  const reason = (value) => (err) => err.reason === value;

  assert.throws(() => normalizeRecoveryCode("   "), reason("EMPTY"));
  assert.throws(() => normalizeRecoveryCode(`${CODE}0`), reason("BAD_LENGTH"));
  assert.throws(() => normalizeRecoveryCode("HPG1-0004-1061-050R-3GG2-8A1C-60T3-GF2U"), reason("BAD_CHAR"));
  assert.throws(() => normalizeRecoveryCode("HPG2-0004-1061-050R-3GG2-8A1C-60T3-GF2F"), reason("BAD_VERSION"));
});

test("a mistyped checksum is detected, not silently accepted", () => {
  assert.throws(
    () => parseRecoveryCode("HPG1-0004-1061-050R-3GG2-8A1C-60T3-GF2Z"),
    (err) => err.reason === "BAD_CHECKSUM",
  );
});

test("seed fingerprint is a stable confirmation aid", () => {
  assert.equal(seedFingerprint(SEED), "CA7EF2C3");
});

test("a different seed produces a different code and fingerprint", () => {
  const other = hex("ffeeddccbbaa99887766554433221100");

  assert.notEqual(encodeRecoveryCode(other), CODE);
  assert.notEqual(seedFingerprint(other), seedFingerprint(SEED));
});

test("seeds must be 16 bytes", () => {
  assert.throws(() => encodeRecoveryCode(new Uint8Array(15)), TypeError);
  assert.throws(() => seedFingerprint(new Uint8Array(17)), TypeError);
});
