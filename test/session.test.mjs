import test from "node:test";
import assert from "node:assert/strict";
import {
  currentMonth,
  isValidMonth,
  monthLabel,
  createSession,
  restoreSession,
  sessionToText,
} from "../src/session.js";

const hex = (s) => Uint8Array.from(s.match(/../g).map((h) => parseInt(h, 16)));

const SEED = hex("000102030405060708090a0b0c0d0e0f");
const CODE = "HPG1-0004-1061-050R-3GG2-8A1C-60T3-GF2F";

test("month validation accepts canonical months and rejects others", () => {
  assert.equal(isValidMonth("2026-11"), true);
  assert.equal(isValidMonth("2026-13"), false);
  assert.equal(isValidMonth("2026-00"), false);
  assert.equal(isValidMonth("2026-1"), false);
  assert.equal(isValidMonth("26-11"), false);
  assert.equal(isValidMonth(undefined), false);
});

test("currentMonth uses the local date only as a UI default", () => {
  assert.equal(currentMonth(new Date(2026, 10, 5, 12, 0, 0)), "2026-11");
  assert.equal(currentMonth(new Date(2026, 0, 1, 0, 0, 0)), "2026-01");
});

test("monthLabel is stable human text", () => {
  assert.equal(monthLabel("2026-11"), "November 2026");
  assert.equal(monthLabel("2024-02"), "February 2024");
});

test("createSession builds the full pinned month", async () => {
  const session = await createSession(SEED, "2026-11");

  assert.equal(session.month, "2026-11");
  assert.equal(session.monthLabel, "November 2026");
  assert.equal(session.fingerprint, "CA7EF2C3");
  assert.equal(session.recoveryCode, CODE);
  assert.equal(session.days.length, 30);
  assert.deepEqual(session.days[0], {
    day: 1,
    weekday: "Sunday",
    password: "52296676",
  });
  assert.deepEqual(session.days[29], {
    day: 30,
    weekday: "Monday",
    password: "07134458",
  });
});

test("createSession respects leap years", async () => {
  assert.equal((await createSession(SEED, "2024-02")).days.length, 29);
  assert.equal((await createSession(SEED, "2025-02")).days.length, 28);
});

test("restoreSession reproduces the same list from a messy code", async () => {
  const original = await createSession(SEED, "2026-11");
  const restored = await restoreSession("hpg1-0004 1061 050r 3gg2 8a1c 60t3 gf2f", "2026-11");

  assert.deepEqual(
    restored.days.map((entry) => entry.password),
    original.days.map((entry) => entry.password),
  );
  assert.equal(restored.fingerprint, original.fingerprint);
});

test("restoreSession fails closed on a bad checksum", async () => {
  await assert.rejects(
    restoreSession("HPG1-0004-1061-050R-3GG2-8A1C-60T3-GF2Z", "2026-11"),
    (err) => err.reason === "BAD_CHECKSUM",
  );
});

test("createSession rejects invalid inputs", async () => {
  await assert.rejects(createSession(new Uint8Array(15), "2026-11"), TypeError);
  await assert.rejects(createSession(SEED, "2026-13"), RangeError);
});

test("the exported text keeps leading zeros, omits the seed, and names the month", async () => {
  const text = await sessionToText(await createSession(SEED, "2026-11"));

  assert.match(text, /November 2026/);
  assert.match(text, /November 2026 \(30 days\)/);
  assert.match(text, /CA7EF2C3/);
  assert.match(text, /07134458/);
  assert.match(text, /52296676/);
  assert.doesNotMatch(text, /HPG1-/);
  assert.doesNotMatch(text, /000102030405060708090a0b0c0d0e0f/i);
  assert.ok(text.endsWith("\n"));
});
