import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

const workflowUrl = new URL("../.github/workflows/pages.yml", import.meta.url);
const readWorkflow = () => readFileSync(workflowUrl, "utf8");

test("the GitHub Pages workflow exists", () => {
  assert.equal(
    existsSync(workflowUrl),
    true,
    ".github/workflows/pages.yml is missing",
  );
});

test("the workflow deploys only artifact-relevant pushes to master", () => {
  const yaml = readWorkflow();

  assert.match(yaml, /branches:\s*\[master\]/);
  assert.match(yaml, /workflow_dispatch:/);

  for (const path of [
    "dist/**",
    "src/**",
    "scripts/**",
    "tools/**",
    "test-vectors.json",
    "package.json",
    ".github/workflows/pages.yml",
  ]) {
    assert.ok(yaml.includes(`- "${path}"`), `missing trigger path: ${path}`);
  }

  for (const path of [
    "docs/**",
    ".knowledge/**",
    "README.md",
    "CHANGELOG.md",
    "test/**",
  ]) {
    assert.ok(
      !yaml.includes(`- "${path}"`),
      `chore/docs path must not trigger a deploy: ${path}`,
    );
  }
});

test("the workflow verifies the reviewed artifact and publishes dist", () => {
  const yaml = readWorkflow();

  assert.match(yaml, /contents:\s*read/);
  assert.match(yaml, /pages:\s*write/);
  assert.match(yaml, /id-token:\s*write/);
  assert.match(yaml, /make check/);
  assert.match(yaml, /make verify-build/);
  assert.match(yaml, /path:\s*dist\b/);
  assert.match(yaml, /actions\/upload-pages-artifact@v\d+/);
  assert.match(yaml, /actions\/deploy-pages@v\d+/);
  assert.match(yaml, /name:\s*github-pages/);
  assert.match(yaml, /node-version:\s*22/);
});
