import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { strings } from "../src/strings.js";

const SRC = new URL("../src/", import.meta.url);
const read = (name) => readFileSync(new URL(name, SRC), "utf8");

const UI_FILES = ["index.html", "app.js", "style.css", "strings.js"];

function jsFiles() {
  return UI_FILES.filter((name) => name.endsWith(".js"));
}

test("the Phase 2 UI files exist", () => {
  for (const name of UI_FILES) {
    assert.ok(existsSync(new URL(name, SRC)), `${name} is missing`);
  }
});

test("the app never persists a seed or a list", () => {
  const forbidden = [
    /localStorage/,
    /sessionStorage/,
    /indexedDB/,
    /document\.cookie/,
    /caches\./,
    /navigator\.storage/,
  ];

  for (const name of jsFiles()) {
    const source = read(name);
    for (const pattern of forbidden) {
      assert.doesNotMatch(source, pattern, `${name} uses ${pattern}`);
    }
  }
});

test("the app makes no network requests of its own", () => {
  const forbidden = [
    /\bfetch\s*\(/,
    /XMLHttpRequest/,
    /WebSocket/,
    /sendBeacon/,
    /\bimport\s*\(\s*["'`]https?:/,
    /\bEventSource\b/,
  ];

  for (const name of jsFiles()) {
    const source = read(name);
    for (const pattern of forbidden) {
      assert.doesNotMatch(source, pattern, `${name} uses ${pattern}`);
    }
  }
});

test("the app loads no external assets", () => {
  for (const name of UI_FILES) {
    const source = read(name);

    assert.doesNotMatch(source, /https?:\/\//i, `${name} contains an external URL`);
    assert.doesNotMatch(source, /\bsrc\s*=\s*["']\/\//i, `${name} loads a protocol-relative URL`);
    assert.doesNotMatch(source, /@import\s+url/i, `${name} imports external CSS`);
  }
});

test("the app never writes HTML strings into the DOM", () => {
  const forbidden = [/innerHTML/, /outerHTML/, /insertAdjacentHTML/, /\beval\s*\(/, /new\s+Function\b/];

  for (const name of jsFiles()) {
    const source = read(name);
    for (const pattern of forbidden) {
      assert.doesNotMatch(source, pattern, `${name} uses ${pattern}`);
    }
  }
});

test("seeds and codes never enter the URL or history", () => {
  const forbidden = [/location\.(hash|search|href)\s*=/, /history\.(pushState|replaceState)/, /URLSearchParams/];

  for (const name of jsFiles()) {
    const source = read(name);
    for (const pattern of forbidden) {
      assert.doesNotMatch(source, pattern, `${name} uses ${pattern}`);
    }
  }
});

test("the app imports only local modules", () => {
  for (const name of jsFiles()) {
    const source = read(name);
    const specifiers = [...source.matchAll(/\bfrom\s+["']([^"']+)["']/g)].map((match) => match[1]);

    for (const specifier of specifiers) {
      assert.match(specifier, /^\.\/[a-z0-9-]+\.js$/i, `${name} imports ${specifier}`);
    }
    assert.doesNotMatch(source, /\brequire\s*\(/, `${name} uses require()`);
    assert.doesNotMatch(source, /from\s+["']node:/, `${name} imports a Node built-in`);
  }
});

test("the page declares language, viewport, and a data-URI favicon", () => {
  const html = read("index.html");

  assert.match(html, /<html[^>]*\slang="en"/i);
  assert.match(html, /<meta[^>]+name="viewport"/i);
  assert.match(html, /<link[^>]+rel="icon"[^>]+href="data:image\/svg\+xml/i);

  const hrefs = [...html.matchAll(/<(?:link|script)[^>]+(?:href|src)="([^"]+)"/gi)].map(
    (match) => match[1],
  );
  for (const href of hrefs) {
    assert.ok(
      href.startsWith("data:") || /^[a-z0-9._/-]+$/i.test(href),
      `asset must be local or a data URI, got ${href}`,
    );
  }
});

test("the page ships semantic, screen-reader-friendly structure", () => {
  const html = read("index.html");

  assert.match(html, /<main\b/i);
  assert.match(html, /<h1\b/i);
  assert.match(html, /<table\b/i);
  assert.match(html, /<caption\b/i);
  assert.match(html, /scope="col"/i);
  assert.doesNotMatch(html, /weekday/i);
  assert.match(html, /<dialog\b/i);
  assert.match(html, /aria-live="polite"/i);
  assert.doesNotMatch(html, /class="skip-link"/i);
  assert.doesNotMatch(html, /Skip to content/i);
  assert.match(html, /for="create-month"/i);
  assert.match(html, /for="restore-code"/i);
});

test("the landing copy states the limitation in one factual line", () => {
  const html = read("index.html");

  assert.match(html, /8-digit convenience code — not for high-value accounts\./);
  assert.doesNotMatch(html, /convenient, not strong/i);
  assert.doesNotMatch(html, /Wi-Fi traffic/i);
  assert.doesNotMatch(html, /Chat and notes apps/i);
  assert.doesNotMatch(html, />[^<]*\b(?:strong|secure|safer|safe)\b/i);
});

test("the print stylesheet exists and hides interactive chrome", () => {
  const css = read("style.css");

  assert.match(css, /@media\s+print/i);
  assert.match(css, /@page/i);
  assert.match(css, /min-height:\s*44px/i);
  assert.match(css, /:focus-visible/i);
  assert.match(css, /\.visually-hidden/i);
  assert.doesNotMatch(css, /\.skip-link/i);
});

test("month inputs use native month and year selects", () => {
  const html = read("index.html");
  const app = read("app.js");

  for (const id of ["create-month", "create-year", "restore-month", "restore-year"]) {
    assert.match(html, new RegExp(`<select[^>]*id="${id}"`), `${id} select is missing`);
  }
  assert.doesNotMatch(html, /type="month"/);
  assert.match(app, /create-year/);
  assert.match(app, /restore-year/);
});

test("the UI does not render weekday data", () => {
  const html = read("index.html");
  const app = read("app.js");

  assert.doesNotMatch(html, /weekday/i);
  assert.doesNotMatch(app, /weekday/i);
});

test("no fingerprint appears in the UI, runtime copy, session, or export", () => {
  const sources = {
    "index.html": read("index.html"),
    "app.js": read("app.js"),
    "strings.js": read("strings.js"),
    "session.js": read("session.js"),
  };

  for (const [name, source] of Object.entries(sources)) {
    assert.doesNotMatch(source, /fingerprint/i, `${name} mentions a fingerprint`);
  }
});

test("form controls point at their error messages", () => {
  const html = read("index.html");
  const tag = (id) => {
    const start = html.indexOf(`id="${id}"`);
    return html.slice(start, html.indexOf(">", start));
  };

  for (const id of [
    "create-month",
    "create-year",
    "restore-month",
    "restore-year",
    "restore-code",
  ]) {
    assert.match(tag(id), /aria-describedby="[^"]*error/, `${id} has no error association`);
  }
});

test("copy-failure feedback stays visible longer", () => {
  assert.match(read("app.js"), /copyFailed[^)]*6000/);
});

test("the landing and list actions have a clear hierarchy", () => {
  const html = read("index.html");
  const attrs = (id) => new RegExp(`<button id="${id}"([^>]*)>`).exec(html)[1];

  assert.match(attrs("door-create"), /\bprimary\b/);
  assert.doesNotMatch(attrs("door-restore"), /\bprimary\b/);
  assert.match(attrs("copy-all"), /\bprimary\b/);
  assert.doesNotMatch(attrs("download-txt"), /\bprimary\b/);
  assert.doesNotMatch(attrs("rotate"), /\bdanger\b/);
});

test("the ceremony omits step-count noise", () => {
  const html = read("index.html");
  const strings = read("strings.js");

  assert.doesNotMatch(html, /Step 1 of 2/);
  assert.doesNotMatch(strings, /Step 1 of 2/);
});

test("the ceremony reminds users to keep the month with the code", () => {
  const html = read("index.html");
  const strings = read("strings.js");

  assert.match(html, /id="ceremony-month-reminder"/);
  assert.match(strings, /The code alone does not include the month/);
});

test("the recovery artifact puts the month in the filename only", () => {
  assert.equal(strings.filenames.code("2026-11"), "recovery-code-2026-11.txt");
  assert.doesNotMatch(strings.filenames.code("2026-11"), /fingerprint/i);

  const header = strings.codeFile.header();
  assert.doesNotMatch(header, /fingerprint/i);
  assert.match(header, /HPG1 recovery code/);
});

test("UI copy is externalized for later translation", () => {
  const strings = read("strings.js");
  const app = read("app.js");

  assert.match(strings, /export\s+const\s+strings\b/);
  assert.match(app, /from\s+["']\.\/strings\.js["']/);
});
