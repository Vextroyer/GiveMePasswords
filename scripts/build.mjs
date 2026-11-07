// Reproducible single-file build for the Monthly Password Generator.
//
// - resolves the local ES-module graph and inlines it as one classic script
// - inlines the stylesheet
// - pins CSP hashes for the exact inline style and script
// - writes dist/index.html and dist/SHA256SUMS
// - refuses to emit an artifact that contains external URLs, eval, or storage
//
// No timestamps, no environment data: the same inputs produce the same bytes.

import { createHash } from "node:crypto";
import {
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, relative, resolve, sep } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "..");
const SRC = resolve(ROOT, "src");

const MODULES = ["strings.js", "derive.js", "recovery-code.js", "session.js", "app.js"];

const IMPORT_RE = /import\s+\{([\s\S]*?)\}\s+from\s+["']\.\/([a-z0-9-]+)\.js["'];?/g;
const EXPORT_FUNCTION_RE = /^export\s+(?:async\s+)?function\s+([A-Za-z_$][\w$]*)/gm;
const EXPORT_CONST_RE = /^export\s+const\s+([A-Za-z_$][\w$]*)/gm;
const EXPORT_CLASS_RE = /^export\s+class\s+([A-Za-z_$][\w$]*)/gm;

const FORBIDDEN_ARTIFACT = [
  [/\bhttps?:\/\//i, "external URL"],
  [/<script[^>]+\bsrc\s*=/i, "external script"],
  [/<link[^>]+rel=["']stylesheet/i, "external stylesheet"],
  [/\bimport\s*\(/, "dynamic import"],
  [/\beval\s*\(/, "eval"],
  [/innerHTML|outerHTML|insertAdjacentHTML/, "HTML injection sink"],
  [/new\s+Function\b/, "Function constructor"],
  [/\brequire\s*\(/, "CommonJS require"],
  [/localStorage|sessionStorage|indexedDB|document\.cookie/, "persistence API"],
  [/\bfetch\s*\(|XMLHttpRequest|WebSocket|sendBeacon|EventSource/, "network API"],
];

function sha256(value, encoding = "hex") {
  return createHash("sha256").update(value).digest(encoding);
}

function readSource(name) {
  return readFileSync(resolve(SRC, name), "utf8");
}

function parseSpecifiers(specifiers) {
  return specifiers
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => part.replace(/\s+as\s+/, ": "));
}

function collectExports(source) {
  const names = new Set();
  for (const pattern of [EXPORT_FUNCTION_RE, EXPORT_CONST_RE, EXPORT_CLASS_RE]) {
    for (const match of source.matchAll(pattern)) {
      names.add(match[1]);
    }
  }
  return [...names];
}

function parseModule(name) {
  const source = readSource(name);

  if (/export\s+default\b/.test(source)) {
    throw new Error(`${name}: default exports are not supported by this build`);
  }
  if (/export\s*\{/.test(source)) {
    throw new Error(`${name}: re-exports are not supported by this build`);
  }

  const imports = [];
  const withoutImports = source.replace(IMPORT_RE, (_, specifiers, moduleName) => {
    imports.push({
      fileName: `${moduleName}.js`,
      specifiers: parseSpecifiers(specifiers),
    });
    return "";
  });

  const exported = collectExports(source);
  const body = withoutImports.replace(/^export\s+/gm, "");
  const variable = `__m_${name.replace(/\.[^.]+$/, "").replace(/[^a-z0-9]/gi, "_")}`;

  return { name, body, imports, exported, variable };
}

function sortModules(modules) {
  const byName = new Map(modules.map((module) => [module.name, module]));
  const ordered = [];
  const visiting = new Set();
  const done = new Set();

  const visit = (module) => {
    if (done.has(module.name)) return;
    if (visiting.has(module.name)) {
      throw new Error(`circular import involving ${module.name}`);
    }
    visiting.add(module.name);
    for (const dependency of module.imports) {
      const target = byName.get(dependency.fileName);
      if (!target) throw new Error(`${module.name} imports missing module ${dependency.fileName}`);
      visit(target);
    }
    visiting.delete(module.name);
    done.add(module.name);
    ordered.push(module);
  };

  for (const module of modules) visit(module);
  return ordered;
}

function bundleModules() {
  const modules = sortModules(MODULES.map(parseModule));

  const chunks = modules.map((module) => {
    const bindings = module.imports
      .map(({ fileName, specifiers }) => {
        const target = modules.find((item) => item.name === fileName);
        return `const { ${specifiers.join(", ")} } = ${target.variable};`;
      })
      .join("\n");

    return [
      `// --- ${module.name} ---`,
      `const ${module.variable} = (() => {`,
      bindings,
      module.body.trim(),
      `return { ${module.exported.join(", ")} };`,
      `})();`,
    ]
      .filter(Boolean)
      .join("\n");
  });

  return `(() => {\n"use strict";\n\n${chunks.join("\n\n")}\n\n})();\n`;
}

function cspFor(styleHash, scriptHash) {
  return [
    "default-src 'none'",
    `script-src 'sha256-${scriptHash}'`,
    `style-src 'sha256-${styleHash}'`,
    "img-src data:",
    "base-uri 'none'",
    "form-action 'none'",
    "frame-ancestors 'none'",
    "object-src 'none'",
    "connect-src 'none'",
    "font-src 'none'",
    "manifest-src 'none'",
    "media-src 'none'",
    "worker-src 'none'",
  ].join("; ");
}

function replacePlaceholder(html, needle, replacement, label) {
  if (!html.includes(needle)) {
    throw new Error(`index.html: ${label} placeholder not found`);
  }
  return html.replace(needle, replacement);
}

function inlineHtml(csp, css, bundle, version, buildId) {
  let html = readSource("index.html");

  const styleLink = /[ \t]*<link\s+rel="stylesheet"\s+href="style\.css"\s*\/?>\s*/i;
  const scriptTag = /[ \t]*<script\s+type="module"\s+src="app\.js"\s*><\/script>\s*/i;

  if (!styleLink.test(html)) throw new Error("index.html: stylesheet link not found");
  if (!scriptTag.test(html)) throw new Error("index.html: module script tag not found");

  html = html.replace(styleLink, () => `<style>${css}</style>`);
  html = html.replace(scriptTag, () => `<script>${bundle}</script>`);

  html = replacePlaceholder(
    html,
    '<meta name="app-version" content="dev" />',
    `<meta name="app-version" content="${version}" />`,
    "app-version meta",
  );
  html = replacePlaceholder(
    html,
    '<meta name="build-id" content="dev" />',
    `<meta name="build-id" content="${buildId}" />`,
    "build-id meta",
  );
  html = replacePlaceholder(
    html,
    '<span id="app-version">dev</span>',
    `<span id="app-version">${version}</span>`,
    "app-version label",
  );
  html = replacePlaceholder(
    html,
    '<code id="build-id">dev</code>',
    `<code id="build-id">${buildId}</code>`,
    "build-id label",
  );

  return html.replace(
    /(<meta charset="utf-8"\s*\/>)/i,
    `$1\n    <meta http-equiv="Content-Security-Policy" content="${csp}" />`,
  );
}

function checkArtifact(html) {
  const violations = [];

  for (const [pattern, label] of FORBIDDEN_ARTIFACT) {
    if (pattern.test(html)) violations.push(label);
  }

  if (violations.length > 0) {
    throw new Error(`refusing to emit artifact: ${violations.join(", ")}`);
  }
}

function assertSafeOutDir(outDir) {
  const resolved = resolve(outDir);
  if (resolved === ROOT || resolved === SRC || resolved === dirname(ROOT)) {
    throw new Error(`refusing to build into ${resolved}`);
  }

  const tempRoot = resolve(tmpdir());
  const insideRepo = resolved.startsWith(ROOT + sep);
  const insideTemp = resolved !== tempRoot && resolved.startsWith(tempRoot + sep);

  if (!insideRepo && !insideTemp) {
    throw new Error(
      `build output must stay inside the repository or the temp directory: ${resolved}`,
    );
  }
  return resolved;
}

export async function build({ outDir = resolve(ROOT, "dist") } = {}) {
  const target = assertSafeOutDir(outDir);

  const { version } = JSON.parse(readFileSync(resolve(ROOT, "package.json"), "utf8"));
  const css = readSource("style.css");
  const bundle = bundleModules();
  const buildId = sha256(bundle).slice(0, 16);
  const csp = cspFor(sha256(css, "base64"), sha256(bundle, "base64"));

  const html = inlineHtml(csp, css, bundle, version, buildId);
  checkArtifact(html);

  const hash = sha256(html);

  rmSync(target, { recursive: true, force: true });
  mkdirSync(target, { recursive: true });
  writeFileSync(resolve(target, "index.html"), html);
  writeFileSync(resolve(target, "SHA256SUMS"), `${hash}  index.html\n`);

  return { outDir: target, html, hash, csp, version, buildId };
}

const isMain =
  process.argv[1] &&
  pathToFileURL(resolve(process.argv[1])).href === import.meta.url;

if (isMain) {
  const args = process.argv.slice(2);
  const outIndex = args.indexOf("--out");
  const outDir = outIndex >= 0 ? args[outIndex + 1] : "dist";

  if (outIndex >= 0 && !outDir) {
    console.error("--out needs a directory");
    process.exit(1);
  }

  try {
    const result = await build({ outDir: resolve(ROOT, outDir) });
    console.log(`built ${relative(ROOT, result.outDir)}`);
    console.log(`version ${result.version}`);
    console.log(`build ${result.buildId}`);
    console.log(`sha256 ${result.hash}`);
  } catch (error) {
    console.error(`build failed: ${error.message}`);
    process.exit(1);
  }
}
