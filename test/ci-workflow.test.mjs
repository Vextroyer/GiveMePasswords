import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

const workflowUrl = new URL("../.github/workflows/ci.yml", import.meta.url);
const nvmrcUrl = new URL("../.nvmrc", import.meta.url);
const readWorkflow = () => readFileSync(workflowUrl, "utf8");

test("the CI workflow exists", () => {
  assert.equal(
    existsSync(workflowUrl),
    true,
    ".github/workflows/ci.yml is missing",
  );
});

test("CI runs on every push and pull request", () => {
  const yaml = readWorkflow();

  assert.match(yaml, /^on:/m);
  assert.match(yaml, /^  push:/m);
  assert.match(yaml, /^  pull_request:/m);
});

test("CI covers the supported Node versions", () => {
  const yaml = readWorkflow();

  assert.match(yaml, /node-version:\s*\[20,\s*22,\s*24,\s*26\]/);
  assert.match(yaml, /make check/);
});

test("CI proves the build is reproducible on the default Node version", () => {
  const yaml = readWorkflow();

  assert.match(yaml, /if:\s*matrix\.node-version\s*==\s*22/);
  assert.match(yaml, /make verify-build/);
});

test("CI is test-only and cannot deploy Pages", () => {
  const yaml = readWorkflow();

  assert.ok(!yaml.includes("pages: write"), "CI must not request pages: write");
  assert.ok(
    !yaml.includes("deploy-pages"),
    "CI must not run the Pages deploy action",
  );
  assert.ok(
    !yaml.includes("upload-pages-artifact"),
    "CI must not upload a Pages artifact",
  );
});

test(".nvmrc pins the default Node version", () => {
  assert.equal(existsSync(nvmrcUrl), true, ".nvmrc is missing");
  assert.equal(readFileSync(nvmrcUrl, "utf8").trim(), "22");
});
