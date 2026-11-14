// Fetch pinned upstream assets; never execute downloaded scripts.
import { createReadStream, createWriteStream } from 'node:fs';
import { mkdir, rename, rm, access, copyFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const root = fileURLToPath(new URL('../', import.meta.url));
const cache = join(root, 'dist', 'voice-probe');
await mkdir(cache, { recursive: true });
const assets = [
  ['sherpa-onnx-1.13.8.aar', 'v1.13.8', '633c24321e06b1fe79feafa03ea16cbc0f8a286641e2da3559bac91bdb13bd96'],
  ['kokoro-multi-lang-v1_0.tar.bz2', 'tts-models', '60703707bc05ccd48d60e1eb723f38b07d6e474795a0b6a588d7220400e0f7a4'],
];
async function digest(path) {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  return hash.digest('hex');
}
for (const [name, tag, expected] of assets) {
  const dest = join(cache, name);
  let exists = false;
  try { await access(dest); exists = true; } catch {}
  if (!exists) {
    console.log('Downloading', name);
    const response = await fetch(`https://github.com/k2-fsa/sherpa-onnx/releases/download/${tag}/${name}`, {
      signal: AbortSignal.timeout(900_000),
    });
    if (!response.ok) throw new Error(`Download failed: ${response.status} ${name}`);
    const partial = dest + '.partial';
    try {
      await pipeline(Readable.fromWeb(response.body), createWriteStream(partial));
      if (await digest(partial) !== expected) throw new Error(`SHA256 mismatch: ${name}`);
      await rename(partial, dest);
    } finally { await rm(partial, { force: true }); }
  }
  if (await digest(dest) !== expected) throw new Error(`Cached asset SHA256 mismatch: ${dest}`);
  console.log('Verified', name);
}
const libs = join(root, 'android', 'voice-probe', 'libs');
await mkdir(libs, { recursive: true });
await copyFile(join(cache, assets[0][0]), join(libs, assets[0][0]));
const result = spawnSync('tar', ['-xf', join(cache, assets[1][0]), '-C', cache], { stdio: 'inherit' });
if (result.error || result.status !== 0) throw new Error('Model extraction failed', { cause: result.error });
console.log('Ready:', join(cache, 'kokoro-multi-lang-v1_0'));
