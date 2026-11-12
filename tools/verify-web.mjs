#!/usr/bin/env node
// Static checks that catch broken local references and JavaScript syntax errors
// without executing the app or requiring a browser.
import { readFile, readdir, stat } from "node:fs/promises";
import { dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const errors = [];
const checked = { html: 0, css: 0, js: 0, refs: 0 };

const localExtensions = new Set([
  ".html", ".css", ".js", ".mjs", ".json", ".svg", ".png", ".jpg", ".jpeg",
  ".webp", ".gif", ".ico", ".woff2", ".woff", ".ttf", ".otf",
]);

function isLocalReference(value) {
  if (!value) return false;
  const trimmed = value.trim().replace(/^['"]|['"]$/g, "");
  if (!trimmed) return false;
  if (/^(?:[a-z]+:)?\/\//i.test(trimmed)) return false;
  if (/^(?:data|blob|mailto|tel|javascript):/i.test(trimmed)) return false;
  if (trimmed.startsWith("#")) return false;
  return true;
}

function cleanReference(value) {
  return value
    .trim()
    .replace(/^['"]|['"]$/g, "")
    .replace(/[?#].*$/, "");
}

async function exists(path) {
  try {
    const info = await stat(path);
    return info.isFile();
  } catch {
    return false;
  }
}

async function checkReference(fromFile, reference) {
  if (!isLocalReference(reference)) return;
  const cleaned = cleanReference(reference);
  if (!cleaned || !localExtensions.has(extname(cleaned).toLowerCase())) return;
  checked.refs += 1;
  const target = cleaned.startsWith("/")
    ? join(root, cleaned.slice(1))
    : resolve(dirname(fromFile), cleaned);
  if (!target.startsWith(root)) {
    errors.push(`${fromFile.slice(root.length + 1)}: reference escapes the project: ${reference}`);
    return;
  }
  if (!(await exists(target))) {
    errors.push(`${fromFile.slice(root.length + 1)}: missing local file: ${reference}`);
  }
}

async function listFiles(directory) {
  const result = [];
  const entries = await readdir(directory, { withFileTypes: true });
  for (const entry of entries) {
    const full = join(directory, entry.name);
    if (entry.isDirectory()) result.push(...await listFiles(full));
    else if (entry.isFile()) result.push(full);
  }
  return result;
}

const htmlPath = join(root, "index.html");
const html = await readFile(htmlPath, "utf8");
checked.html += 1;

for (const match of html.matchAll(/\b(?:src|href)\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi)) {
  await checkReference(htmlPath, match[1]);
}

const cssFiles = (await listFiles(join(root, "css"))).filter((file) => file.endsWith(".css"));
for (const file of cssFiles) {
  checked.css += 1;
  const css = await readFile(file, "utf8");
  for (const match of css.matchAll(/url\(\s*("[^"]*"|'[^']*'|[^)]*)\s*\)/gi)) {
    await checkReference(file, match[1]);
  }
}

const jsFiles = (await listFiles(join(root, "js"))).filter((file) => file.endsWith(".js"));
for (const file of jsFiles) {
  checked.js += 1;
  const source = await readFile(file, "utf8");
  try {
    new vm.Script(source, { filename: file });
  } catch (error) {
    errors.push(`${file.slice(root.length + 1)}: ${error.message}`);
  }
}

for (const file of ["index.html", "css/app.css", "css/mise.css", "css/green-room.css"]) {
  if (!(await exists(join(root, file)))) errors.push(`missing required entry: ${file}`);
}

if (errors.length) {
  console.error(`verify-web: ${errors.length} problem(s)`);
  for (const error of errors) console.error(`  FAIL ${error}`);
  process.exit(1);
}

console.log(
  `verify-web: OK (${checked.html} html, ${checked.css} css, ${checked.js} js, ${checked.refs} local refs)`
);
