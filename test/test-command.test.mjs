import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const root = new URL("../", import.meta.url);

function read(relative) {
  return readFileSync(new URL(relative, root), "utf8");
}

test("the Makefile runs tests from an explicit file glob", () => {
  const lines = read("Makefile").split("\n");
  const target = lines.indexOf("test:");

  assert.notEqual(target, -1, "the test target is missing");
  assert.equal(
    lines[target + 1].trim(),
    "node --test test/*.test.mjs",
    "Node 22-25 do not expand a directory argument for --test",
  );
});

test("the package test script uses the same explicit glob", () => {
  const pkg = JSON.parse(read("package.json"));

  assert.equal(pkg.scripts.test, "node --test test/*.test.mjs");
});

test("the Pages workflow triggers on Makefile changes", () => {
  const workflow = read(".github/workflows/pages.yml");

  assert.ok(
    workflow.includes('- "Makefile"'),
    "Makefile must be a trigger path: the workflow runs make check and make verify-build",
  );
});
