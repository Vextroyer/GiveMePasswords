import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

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
  assert.match(html, /<dialog\b/i);
  assert.match(html, /aria-live="polite"/i);
  assert.match(html, /class="skip-link"/i);
  assert.match(html, /for="create-month"/i);
  assert.match(html, /for="restore-code"/i);
});

test("the print stylesheet exists and hides interactive chrome", () => {
  const css = read("style.css");

  assert.match(css, /@media\s+print/i);
  assert.match(css, /@page/i);
  assert.match(css, /min-height:\s*44px/i);
  assert.match(css, /:focus-visible/i);
  assert.match(css, /\.visually-hidden/i);
});

test("UI copy is externalized for later translation", () => {
  const strings = read("strings.js");
  const app = read("app.js");

  assert.match(strings, /export\s+const\s+strings\b/);
  assert.match(app, /from\s+["']\.\/strings\.js["']/);
});
