import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  applyTranslations,
  catalogs,
  getLocale,
  resolveLocale,
  setLocale,
  t,
} from "../src/strings.js";
import { createSession, monthLabel, sessionToText } from "../src/session.js";

const hex = (s) => Uint8Array.from(s.match(/../g).map((h) => parseInt(h, 16)));
const SEED = hex("000102030405060708090a0b0c0d0e0f");

function flatten(tree, prefix = "", out = {}) {
  for (const [key, value] of Object.entries(tree)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === "object" && !Array.isArray(value)) {
      flatten(value, path, out);
    } else {
      out[path] = value;
    }
  }
  return out;
}

const en = flatten(catalogs.en);
const es = flatten(catalogs.es);

test("resolveLocale picks Spanish, English, or the fallback", () => {
  assert.equal(resolveLocale(["es-MX", "en-US"]), "es");
  assert.equal(resolveLocale(["en-US", "es-ES"]), "en");
  assert.equal(resolveLocale(["fr-FR", "en-US"]), "en");
  assert.equal(resolveLocale(["ES"]), "es");
  assert.equal(resolveLocale([]), "en");
});

test("Spanish has exactly the same keys and function arities as English", () => {
  assert.deepEqual(Object.keys(es).sort(), Object.keys(en).sort());

  for (const key of Object.keys(en)) {
    assert.equal(typeof es[key], typeof en[key], `${key} has a different type`);
    if (typeof en[key] === "function") {
      assert.equal(es[key].length, en[key].length, `${key} has a different arity`);
    }
  }
});

test("no Spanish user-facing value is empty or contains markup", () => {
  for (const [key, value] of Object.entries(es)) {
    const text =
      typeof value === "function"
        ? value(...Array(value.length).fill("X"))
        : value;

    assert.equal(typeof text, "string", `${key} is not a string`);
    assert.ok(text.trim().length > 0, `${key} is empty`);
    assert.doesNotMatch(text, /[<>]/, `${key} contains markup`);
  }
});

test("Spanish copy is actually translated", () => {
  // Values that are legitimately identical in both languages.
  const allow = new Set([
    "form.codePlaceholder",
    "lang.en",
    "lang.es",
    "filenames.list",
    "filenames.code",
  ]);

  for (const key of Object.keys(en)) {
    const same =
      typeof en[key] === "function"
        ? en[key]("2026-11", 1) === es[key]("2026-11", 1)
        : en[key] === es[key];

    if (same) {
      assert.ok(allow.has(key), `${key} is still English`);
    }
  }
});

test("t() falls back and interpolates dynamic entries", () => {
  setLocale("es");
  try {
    assert.equal(t("missing.key"), "missing.key");
    assert.equal(t("months.label", "noviembre", 2026), "noviembre de 2026");
  } finally {
    setLocale("en");
  }
});

test("static HTML only references known translation keys", () => {
  const html = readFileSync(new URL("../src/index.html", import.meta.url), "utf8");

  const textKeys = [...html.matchAll(/data-i18n="([^"]+)"/g)].map((match) => match[1]);
  assert.ok(textKeys.length > 20, "too few data-i18n elements");

  for (const key of textKeys) {
    assert.ok(Object.prototype.hasOwnProperty.call(en, key), `unknown data-i18n key: ${key}`);
  }

  const attrSpecs = [...html.matchAll(/data-i18n-attr="([^"]+)"/g)].map(
    (match) => match[1],
  );
  for (const spec of attrSpecs) {
    for (const pair of spec.split(/\s+/)) {
      const key = pair.slice(pair.indexOf(":") + 1);
      assert.ok(Object.prototype.hasOwnProperty.call(en, key), `unknown attr key: ${key}`);
    }
  }

  assert.match(html, /id="lang-en"/);
  assert.match(html, /id="lang-es"/);
});

test("applyTranslations hydrates text and attributes without markup", () => {
  const makeNode = (attrs) => ({
    attrs: { ...attrs },
    textContent: "",
    getAttribute(name) {
      return this.attrs[name] ?? null;
    },
    setAttribute(name, value) {
      this.attrs[name] = value;
    },
  });

  const text = [makeNode({ "data-i18n": "landing.title" })];
  const attr = [
    makeNode({ "data-i18n-attr": "aria-label:lang.label placeholder:form.codePlaceholder" }),
  ];
  const root = {
    nodeType: 1,
    ownerDocument: { documentElement: { lang: "en" } },
    text,
    attr,
    querySelectorAll(selector) {
      if (selector === "[data-i18n]") return text;
      if (selector === "[data-i18n-attr]") return attr;
      return [];
    },
  };

  setLocale("es");
  try {
    applyTranslations(root);
    assert.equal(root.text[0].textContent, "Un mes de contraseñas diarias");
    assert.equal(root.attr[0].attrs["aria-label"], "Idioma");
    assert.equal(root.attr[0].attrs.placeholder, catalogs.es.form.codePlaceholder);
    assert.equal(root.ownerDocument.documentElement.lang, "es");

    applyTranslations(root);
    assert.equal(root.text[0].textContent, "Un mes de contraseñas diarias");
  } finally {
    setLocale("en");
  }
});

test("session labels and export follow the active locale", async () => {
  setLocale("es");
  try {
    assert.equal(getLocale(), "es");
    assert.equal(monthLabel("2026-11"), "noviembre de 2026");

    const text = await sessionToText(await createSession(SEED, "2026-11"));
    assert.match(text, /Contraseñas mensuales — noviembre de 2026 \(30 días\)/);
    assert.match(text, /Día  Contraseña/);
    assert.match(text, /Fin de la lista\./);
  } finally {
    setLocale("en");
  }
});
