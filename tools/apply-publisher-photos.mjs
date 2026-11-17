/* Mise / publisher photograph backfill (general).
   Replaces every non-publisher image (Wikimedia search false positives, or a
   missing image) on publisher records in the bundled Caribbean and African
   collections with the photograph published on the record's own source page —
   JSON-LD Recipe image first, og:image second, same contract as
   tools/build-publisher-images.mjs.

   An image is kept only when it already comes from the record's own source
   host (e.g. cookingwithria.com, caribbeanpot.com, 196flavors.com). Everything
   else is backfilled from the publisher page.

   Every corrected record is also merged into js/legacy-photo-fixes.js so that
   (a) older saved copies with the old false-positive photo are corrected when
   the app loads, and (b) a rebuilt bundle re-applies the reviewed publisher
   photos (tools/build-images.mjs reads the same map).

   Page HTML is cached in .recipe-cache/ so interrupted runs can resume.

     node tools/apply-publisher-photos.mjs [--dry-run] [--limit N] [--offset N] [--dbg]
*/
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import crypto from 'node:crypto';

const ROOT = path.resolve(import.meta.dirname, '..');
const DBG = process.argv.includes('--dbg');
const DRY_RUN = process.argv.includes('--dry-run');
const LIMIT = (() => { const i = process.argv.indexOf('--limit'); return i > -1 ? Number(process.argv[i + 1]) : Infinity; })();
const OFFSET = (() => { const i = process.argv.indexOf('--offset'); return i > -1 ? Number(process.argv[i + 1]) : 0; })();
const UA = 'MiseCollection/1.0 (recipe photo research; contact: https://github.com/BadImps/mise)';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const CACHE = path.join(ROOT, '.recipe-cache', 'publisher-photos');
fs.mkdirSync(CACHE, { recursive: true });

const COLLECTIONS = [
  { file: ['js', 'caribbean-sources.js'], marker: 'window.MISE_CARIBBEAN_SOURCES' },
  { file: ['js', 'africa-sources.js'], marker: 'window.MISE_AFRICA_SOURCES' },
];

function extractJsonLd(html) {
  return [...html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)].map((m) => m[1]);
}
function findRecipe(node, depth = 0) {
  if (!node || depth > 8) return null;
  if (Array.isArray(node)) { for (const v of node) { const hit = findRecipe(v, depth + 1); if (hit) return hit; } return null; }
  if (typeof node !== 'object') return null;
  if (node['@graph']) { const hit = findRecipe(node['@graph'], depth + 1); if (hit) return hit; }
  const types = [].concat(node['@type'] || []).map(String);
  if (types.some((t) => t === 'Recipe' || t.endsWith('/Recipe'))) return node;
  for (const k of ['mainEntity', 'itemListElement', 'hasPart']) { if (node[k]) { const hit = findRecipe(node[k], depth + 1); if (hit) return hit; } }
  return null;
}
const pickImage = (recipe) => {
  if (!recipe) return null;
  const raw = recipe.image;
  const item = Array.isArray(raw) ? raw[0] : raw;
  const url = typeof item === 'string' ? item : item && (item.url || item.contentUrl || item.thumbnailUrl || item['@id']);
  return url && /^https?:\/\//i.test(url) ? url : null;
};
const pickOgImage = (html) => {
  const m = html.match(/<meta[^>]+property=["']og:image["'][^>]*>/i);
  if (!m) return null;
  const u = (m[0].match(/content=["']([^"']+)["']/i) || [])[1];
  return u && /^https?:\/\//i.test(u) ? u : null;
};
const absolute = (u, pageUrl) => {
  if (!u) return null;
  try {
    if (/^https?:\/\//i.test(u)) return u;
    const base = new URL(pageUrl);
    if (u.startsWith('//')) return base.protocol + u;
    if (u.startsWith('/')) return base.origin + u;
    return base.origin + '/' + u;
  } catch (_) { return u; }
};
const encodeImageUrl = (u) => {
  try { return encodeURI(new URL(u).href.normalize('NFD')); } catch (_) { return encodeURI(u.normalize('NFD')); }
};
const hostOf = (u) => { try { return new URL(u || '').hostname.replace(/^www\./, ''); } catch { return ''; } };
const sourceHostMatches = (imageHost, sourceHost) => imageHost === sourceHost || imageHost.endsWith('.' + sourceHost);

async function fetchPage(url) {
  const file = path.join(CACHE, crypto.createHash('sha256').update(url).digest('hex') + '.html');
  if (fs.existsSync(file)) return fs.readFileSync(file, 'utf8');
  let lastError = null;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const res = await fetch(url, { headers: { 'user-agent': UA, accept: 'text/html' }, redirect: 'follow' });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const text = await res.text();
      fs.writeFileSync(file, text, 'utf8');
      return text;
    } catch (err) {
      lastError = err;
      await sleep(400 * (attempt + 1));
    }
  }
  throw lastError;
}

// Hand-reviewed decisions win: an explicit '' in js/legacy-photo-fixes.js
// means "no usable publisher photo — prefer the illustration" and is left alone.
const fixesForRun = (() => {
  const context = vm.createContext({ window: {} });
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'js', 'legacy-photo-fixes.js'), 'utf8'), context);
  return context.window.MISE_LEGACY_PHOTO_FIXES || {};
})();

const perFile = [];
const fixes = {};
const misses = [];
let grandChanged = 0;
let grandScanned = 0;
let skippedReviewed = 0;
let skippedPublisher = 0;
let offset = OFFSET;
let remaining = LIMIT;

for (const col of COLLECTIONS) {
  const file = path.join(ROOT, ...col.file);
  const text = fs.readFileSync(file, 'utf8');
  const start = text.indexOf('= [');
  const records = JSON.parse(text.slice(start + 2).replace(/;\s*$/, ''));
  let changed = 0;
  let searched = 0;
  for (let i = 0; i < records.length; i++) {
    const record = records[i];
    if (!record || !record.sourceUrl) continue;
    if (fixesForRun[record.sourceUrl] === '') { skippedReviewed += 1; continue; }
    if (offset > 0) { offset -= 1; continue; }
    if (remaining <= 0) break;
    remaining -= 1;
    searched += 1;
    grandScanned += 1;
    const sourceHost = hostOf(record.sourceUrl);
    const currentHost = hostOf(record.image);
    if (currentHost && sourceHost && sourceHostMatches(currentHost, sourceHost)) { skippedPublisher += 1; continue; }
    let image = null;
    try {
      const html = await fetchPage(record.sourceUrl);
      for (const block of extractJsonLd(html)) {
        try {
          const recipe = findRecipe(JSON.parse(block));
          image = pickImage(recipe);
          if (image) break;
        } catch (_) { /* next block */ }
      }
      if (!image) image = pickOgImage(html);
      image = image ? encodeImageUrl(absolute(image, record.sourceUrl)) : null;
    } catch (err) {
      misses.push(record.id + ' :: ' + err.message);
      continue;
    }
    if (!image) {
      misses.push(record.id + ' :: no image in JSON-LD or og:image');
      continue;
    }
    fixes[record.sourceUrl] = image;
    if (image === record.image) { skippedPublisher += 1; continue; }
    records[i] = { ...record, image, imageCredit: `${record.source || sourceHost} (photograph on source page)` };
    changed += 1;
    if (DBG) console.log('✓', record.id, '→', image);
    await sleep(150);
  }
  grandChanged += changed;
  perFile.push({ col, text, start, records, searched, changed });
  console.log(`${path.basename(file)}: scanned ${searched}, replaced ${changed}`);
}

console.log(`total scanned: ${grandScanned}; kept publisher photos: ${skippedPublisher}; kept reviewed no-photo choices: ${skippedReviewed}; replaced: ${grandChanged}; misses: ${misses.length}`);
if (misses.length) console.log('misses:\n' + misses.join('\n'));

if (DRY_RUN) {
  console.log('--dry-run: no files written');
  process.exit(0);
}

// Merge fixes into js/legacy-photo-fixes.js textually so the hand-reviewed
// entries and their comments above are preserved exactly; new entries are
// appended at the end of the map.
const fixesPath = path.join(ROOT, 'js', 'legacy-photo-fixes.js');
const fixesText = fs.readFileSync(fixesPath, 'utf8');
const context = vm.createContext({ window: {} });
vm.runInContext(fixesText, context);
const existing = context.window.MISE_LEGACY_PHOTO_FIXES || {};
const additions = Object.entries(fixes).filter(([sourceUrl]) => !(sourceUrl in existing));
const anchor = '  };\n})(window);';
const idx = fixesText.lastIndexOf(anchor);
if (idx < 0) throw new Error('legacy-photo-fixes.js: closing anchor not found');
const newLines = additions
  .map(([sourceUrl, image]) => `    ${JSON.stringify(sourceUrl)}: ${JSON.stringify(image)},\n`)
  .join('');
fs.writeFileSync(fixesPath, fixesText.slice(0, idx) + newLines + fixesText.slice(idx), 'utf8');
console.log('wrote', path.relative(ROOT, fixesPath), '·', Object.keys(existing).length + additions.length, 'reviewed entries (' + additions.length + ' new)');

for (const { col, text, start, records } of perFile) {
  const file = path.join(ROOT, ...col.file);
  const stamped = text.slice(0, start) + '= ' + JSON.stringify(records, null, 2) + ';\n';
  fs.writeFileSync(file, stamped, 'utf8');
  console.log('wrote', path.relative(ROOT, file), (fs.statSync(file).size / 1024).toFixed(0), 'KB ·', records.length, 'records');
}
