import test from "node:test";
import assert from "node:assert/strict";
import { hkdf, derivePassword8, deriveMonth } from "../src/derive.js";

const hex = (s) => Uint8Array.from(s.match(/../g).map((h) => parseInt(h, 16)));
const toHex = (bytes) => Buffer.from(bytes).toString("hex");

const SEED = hex("000102030405060708090a0b0c0d0e0f");

test("HKDF-SHA-256 reproduces RFC 5869 A.1", async () => {
  const ikm = hex("0b".repeat(22));
  const salt = hex("000102030405060708090a0b0c");
  const info = hex("f0f1f2f3f4f5f6f7f8f9");
  const okm = await hkdf(ikm, salt, info, 42);

  assert.equal(
    toHex(okm),
    "3cb25f25faacd57a90434f64d0362f2a2d2d0a90cf1a5a4c5db02d56ecc4c5bf34007208d5b887185865",
  );
});

test("HPG-1 derives the pinned day vectors", async () => {
  assert.equal(await derivePassword8(SEED, "2026-11", 1), "52296676");
  assert.equal(await derivePassword8(SEED, "2026-11", 2), "59443424");
  assert.equal(await derivePassword8(SEED, "2026-12", 1), "78951395");
});

test("HPG-1 derives a full month in order", async () => {
  const list = await deriveMonth(SEED, "2026-11");

  assert.equal(list.length, 30);
  assert.deepEqual(list.slice(0, 4), ["52296676", "59443424", "83846756", "70111090"]);
  assert.equal(list[29], "07134458");
});

test("HPG-1 exercises the rejection path deterministically", async () => {
  assert.equal(await derivePassword8(SEED, "2020-02", 14), "81039139");
});

test("month is part of the derivation", async () => {
  assert.notEqual(
    (await deriveMonth(SEED, "2026-11"))[0],
    (await deriveMonth(SEED, "2026-12"))[0],
  );
});
