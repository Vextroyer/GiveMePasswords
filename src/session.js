// HPG-1 session assembly: month validation, labels, and printable lists.
// Pure ESM; no storage, DOM, network, or Node imports.

import { deriveMonth } from "./derive.js";
import { encodeRecoveryCode, parseRecoveryCode } from "./recovery-code.js";
import { t } from "./strings.js";

const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

/** True for a canonical "YYYY-MM" string. */
export function isValidMonth(value) {
  return typeof value === "string" && MONTH_PATTERN.test(value);
}

/** Current local month as "YYYY-MM". A UI default, never used for derivation. */
export function currentMonth(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

/** Human month label in the active locale, e.g. "November 2026". */
export function monthLabel(month) {
  if (!isValidMonth(month)) {
    throw new RangeError("month must be YYYY-MM");
  }
  const year = Number(month.slice(0, 4));
  const monthNumber = month.slice(5, 7);
  return t("months.label", t(`months.${monthNumber}`), year);
}

/** Normalize and validate a 16-byte seed without exposing it. */
function seedBytes(seed) {
  if (seed instanceof Uint8Array || seed instanceof ArrayBuffer) {
    if (seed.byteLength !== 16) {
      throw new TypeError("seed must be 16 bytes");
    }
    return seed instanceof Uint8Array ? seed : new Uint8Array(seed);
  }
  throw new TypeError("seed must be a Uint8Array or ArrayBuffer");
}

/** Build a month's full password session from a seed. */
export async function createSession(seed, month) {
  if (!isValidMonth(month)) {
    throw new RangeError("month must be YYYY-MM");
  }
  const bytes = seedBytes(seed);

  const year = Number(month.slice(0, 4));
  const monthNumber = Number(month.slice(5, 7));
  const dayCount = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  const passwords = await deriveMonth(bytes, month);

  const days = Array.from({ length: dayCount }, (_, index) => {
    const day = index + 1;
    return { day, password: passwords[index] };
  });

  return {
    month,
    monthLabel: monthLabel(month),
    recoveryCode: encodeRecoveryCode(bytes),
    days,
  };
}

/** Restore a session from a recovery code. Parse errors propagate unchanged. */
export async function restoreSession(code, month) {
  const seed = parseRecoveryCode(code);
  return createSession(seed, month);
}

/** Render a session as a plain-text table; never includes seed or code. */
export function sessionToText(session) {
  const lines = [
    t("export.title", session.monthLabel, session.days.length),
    t("export.algorithm"),
    "",
    t("export.header"),
  ];

  for (const entry of session.days) {
    lines.push(`${String(entry.day).padStart(2, "0")}   ${entry.password}`);
  }

  lines.push("", t("export.end"));
  return `${lines.join("\n")}\n`;
}
