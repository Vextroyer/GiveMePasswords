import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { build } from "../scripts/build.mjs";

const sha256 = (value, encoding = "hex") =>
  createHash("sha256").update(value).digest(encoding);

async function withTempDir(run) {
  const dir = mkdtempSync(join(tmpdir(), "hpg-build-"));
  try {
    return await run(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test("the build emits one self-contained page and a hash", () =>
  withTempDir(async (outDir) => {
    const result = await build({ outDir });

    assert.equal(existsSync(join(outDir, "index.html")), true);
    assert.equal(existsSync(join(outDir, "_headers")), false);
    assert.equal(existsSync(join(outDir, "SHA256SUMS")), true);
    assert.equal(result.hash, sha256(readFileSync(join(outDir, "index.html"))));
  }));

test("the built page inlines the stylesheet and every module", () =>
  withTempDir(async (outDir) => {
    await build({ outDir });
    const html = readFileSync(join(outDir, "index.html"), "utf8");

    assert.match(html, /<style>[\s\S]+<\/style>/);
    assert.match(html, /<script>[\s\S]+<\/script>/);

    assert.doesNotMatch(html, /<script[^>]+src=/i);
    assert.doesNotMatch(html, /<link[^>]+rel=["']stylesheet/i);
    assert.doesNotMatch(html, /\bfrom\s+["']\.\//);
    assert.doesNotMatch(html, /\bimport\s*\(/);

    // Module bodies are actually present and in dependency order.
    const order = ["const strings", "function hkdf", "function sha256", "createSession", "function init"];
    let cursor = -1;
    for (const marker of order) {
      const index = html.indexOf(marker);
      assert.ok(index > cursor, `${marker} should appear after the previous module`);
      cursor = index;
    }
  }));

test("the built page shows the package version and a script-derived build id", () =>
  withTempDir(async (outDir) => {
    const pkg = JSON.parse(
      readFileSync(new URL("../package.json", import.meta.url), "utf8"),
    );
    await build({ outDir });
    const html = readFileSync(join(outDir, "index.html"), "utf8");

    const script = /<script>([\s\S]*?)<\/script>/.exec(html);
    assert.ok(script, "inline script is present");
    const buildId = sha256(script[1]).slice(0, 16);

    assert.ok(
      html.includes(`<meta name="app-version" content="${pkg.version}"`),
      "a verifier can read the version from a meta tag",
    );
    assert.ok(
      html.includes(`<meta name="build-id" content="${buildId}"`),
      "the build id is the digest of the inline script",
    );
    assert.ok(html.includes(`<span id="app-version">${pkg.version}</span>`));
    assert.ok(html.includes(`<code id="build-id">${buildId}</code>`));
  }));

test("the built page keeps the no-storage, no-network, no-injection policy", () =>
  withTempDir(async (outDir) => {
    await build({ outDir });
    const html = readFileSync(join(outDir, "index.html"), "utf8");

    assert.doesNotMatch(html, /https?:\/\//i);
    assert.doesNotMatch(html, /\beval\s*\(/);
    assert.doesNotMatch(html, /innerHTML/);
    assert.doesNotMatch(html, /new\s+Function\b/);
    assert.doesNotMatch(html, /\brequire\s*\(/);
    assert.doesNotMatch(html, /localStorage|sessionStorage|indexedDB|document\.cookie/);
    assert.doesNotMatch(html, /\bfetch\s*\(/);
    assert.doesNotMatch(html, /XMLHttpRequest|WebSocket|sendBeacon/);
  }));

test("the CSP hashes match the exact inline style and script", () =>
  withTempDir(async (outDir) => {
    await build({ outDir });
    const html = readFileSync(join(outDir, "index.html"), "utf8");

    const style = /<style>([\s\S]*?)<\/style>/.exec(html);
    const script = /<script>([\s\S]*?)<\/script>/.exec(html);
    assert.ok(style && script, "inline style and script are present");

    const styleHash = sha256(style[1], "base64");
    const scriptHash = sha256(script[1], "base64");
    const csp = /<meta[^>]+http-equiv="Content-Security-Policy"[^>]+content="([^"]+)"/i.exec(html);

    assert.ok(csp, "a meta CSP is present");
    assert.ok(csp[1].includes(`style-src 'sha256-${styleHash}'`), "style hash is pinned");
    assert.ok(csp[1].includes(`script-src 'sha256-${scriptHash}'`), "script hash is pinned");
    assert.match(csp[1], /default-src 'none'/);
    assert.match(csp[1], /object-src 'none'/);
    assert.match(csp[1], /base-uri 'none'/);
  }));

test("SHA256SUMS uses the standard format", () =>
  withTempDir(async (outDir) => {
    const result = await build({ outDir });
    const sums = readFileSync(join(outDir, "SHA256SUMS"), "utf8");

    assert.equal(sums, `${result.hash}  index.html\n`);
  }));

test("building twice produces identical bytes", () =>
  withTempDir(async (first) =>
    withTempDir(async (second) => {
      const a = await build({ outDir: first });
      const b = await build({ outDir: second });

      assert.equal(a.hash, b.hash);
      assert.equal(
        readFileSync(join(first, "index.html"), "utf8"),
        readFileSync(join(second, "index.html"), "utf8"),
      );
    }),
  ));
