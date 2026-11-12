#!/usr/bin/env node
// Builds the GitHub release assets from one source of truth:
//   mise-<versionName>.apk
//   mise-web-<webVersionCode>.zip
//   mise-manifest.json
//   SHA256SUMS.txt
//
// The zip writer is deliberately dependency-free so the release pipeline works
// on a clean runner and locally on Windows.
import { createHash } from "node:crypto";
import { copyFile, mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { dirname, extname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { deflateRawSync } from "node:zlib";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const dist = join(root, "dist");

function arg(name, fallback = "") {
  const index = process.argv.indexOf(`--${name}`);
  if (index >= 0 && process.argv[index + 1]) return process.argv[index + 1];
  const env = `MISE_${name.replace(/-/g, "_").toUpperCase()}`;
  return process.env[env] || fallback;
}

const versionName = arg("version-name", "1.0.0").trim();
const versionCode = Number(arg("version-code", "1"));
const webVersionCode = Number(arg("web-version-code", String(versionCode)));
const tag = arg("tag", `v${versionName}`).trim();
const apkPath = resolve(root, arg("apk", "android/app/build/outputs/apk/release/app-release.apk"));
const notes = arg(
  "notes",
  `Mise ${versionName} is available. This release includes the recipe library, cook mode, tablet layouts, and update delivery.`
).trim();

if (!/^[A-Za-z0-9._-]+$/.test(versionName)) {
  throw new Error(`versionName must be filename-safe: ${versionName}`);
}
if (!/^v?[A-Za-z0-9._-]+$/.test(tag)) throw new Error(`invalid tag: ${tag}`);
if (!Number.isInteger(versionCode) || versionCode < 1) throw new Error("versionCode must be a positive integer");
if (!Number.isInteger(webVersionCode) || webVersionCode < 1) {
  throw new Error("webVersionCode must be a positive integer");
}

const apkInfo = await stat(apkPath).catch(() => null);
if (!apkInfo || !apkInfo.isFile()) {
  throw new Error(`release APK not found: ${apkPath}\nRun :app:assembleRelease first, or pass --apk <path>.`);
}
const magic = await readFile(apkPath).then((buffer) => buffer.subarray(0, 4).toString("hex"));
if (magic !== "504b0304") throw new Error(`release APK is not a ZIP package: ${apkPath}`);

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

const webFiles = [join(root, "index.html")];
for (const directory of ["css", "js", "assets"]) {
  webFiles.push(...await listFiles(join(root, directory)));
}
const included = webFiles
  .filter((file) => !file.endsWith(`${sep}credits.md`))
  .sort((a, b) => relative(root, a).localeCompare(relative(root, b)));

// --- deterministic ZIP writer -------------------------------------------------

const crcTable = new Uint32Array(256);
for (let n = 0; n < 256; n += 1) {
  let value = n;
  for (let bit = 0; bit < 8; bit += 1) {
    value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  }
  crcTable[n] = value >>> 0;
}

function crc32(buffer) {
  let value = 0xffffffff;
  for (const byte of buffer) value = crcTable[(value ^ byte) & 0xff] ^ (value >>> 8);
  return (value ^ 0xffffffff) >>> 0;
}

function buildZip(entries) {
  const localParts = [];
  const centralParts = [];
  let offset = 0;
  // 1980-01-01 keeps repeated builds byte-for-byte reproducible.
  const dosTime = 0;
  const dosDate = 0x21;

  for (const entry of entries) {
    const name = Buffer.from(entry.name.replaceAll("\\", "/"), "utf8");
    const compressed = deflateRawSync(entry.data, { level: 9 });
    const checksum = crc32(entry.data);

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6);
    local.writeUInt16LE(8, 8);
    local.writeUInt16LE(dosTime, 10);
    local.writeUInt16LE(dosDate, 12);
    local.writeUInt32LE(checksum, 14);
    local.writeUInt32LE(compressed.length, 18);
    local.writeUInt32LE(entry.data.length, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28);
    localParts.push(local, name, compressed);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(0x0314, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(8, 10);
    central.writeUInt16LE(dosTime, 12);
    central.writeUInt16LE(dosDate, 14);
    central.writeUInt32LE(checksum, 16);
    central.writeUInt32LE(compressed.length, 20);
    central.writeUInt32LE(entry.data.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt16LE(0, 30);
    central.writeUInt16LE(0, 32);
    central.writeUInt16LE(0, 34);
    central.writeUInt16LE(0, 36);
    central.writeUInt32LE(0, 38);
    central.writeUInt32LE(offset, 42);
    centralParts.push(central, name);

    offset += local.length + name.length + compressed.length;
  }

  const centralDirectory = Buffer.concat(centralParts);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralDirectory.length, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20);

  return Buffer.concat([...localParts, centralDirectory, end]);
}

function sha256(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });

const apkName = `mise-${versionName}.apk`;
const apkBytes = await readFile(apkPath);
await copyFile(apkPath, join(dist, apkName));

const entries = [];
for (const file of included) {
  entries.push({
    name: relative(root, file).replaceAll("\\", "/"),
    data: await readFile(file),
  });
}
const webZip = buildZip(entries);
const webName = `mise-web-${webVersionCode}.zip`;
await writeFile(join(dist, webName), webZip);

const base = `https://github.com/BadImps/mise/releases/download/${tag}`;
const manifest = {
  applicationId: "com.badimps.mise",
  versionCode,
  versionName,
  webVersionCode,
  publishedAt: new Date().toISOString(),
  notes,
  apk: {
    url: `${base}/${apkName}`,
    sha256: sha256(apkBytes),
    sizeBytes: apkBytes.length,
    versionCode,
  },
  web: {
    url: `${base}/${webName}`,
    sha256: sha256(webZip),
    sizeBytes: webZip.length,
    versionCode: webVersionCode,
  },
};

const manifestBytes = Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`, "utf8");
await writeFile(join(dist, "mise-manifest.json"), manifestBytes);
await writeFile(
  join(dist, "SHA256SUMS.txt"),
  [
    `${sha256(apkBytes)}  ${apkName}`,
    `${sha256(webZip)}  ${webName}`,
    `${sha256(manifestBytes)}  mise-manifest.json`,
  ].join("\n") + "\n"
);

console.log(`release assets written to ${dist}`);
for (const name of [apkName, webName, "mise-manifest.json", "SHA256SUMS.txt"]) {
  const info = await stat(join(dist, name));
  console.log(`  ${name}  ${info.size.toLocaleString("en-US")} bytes`);
}
console.log(`  web entries: ${entries.length}`);
console.log(`  manifest: ${base}/mise-manifest.json`);
