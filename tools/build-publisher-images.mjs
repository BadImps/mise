/* Mise / publisher photo backfill.
   Many Cooking with Ria and CaribbeanPot.com records carry a unique recipe
   photo — usually the page's own Open Graph / JSON-LD hero image. This tool
   fetches each publisher page once per record that lacks an image and writes
   the publisher's own image URL back into the record with a credit pointing
   at that domain. No photographs are rehosted by Mise; the credit string
   names the publisher and points back to their page. Run from the root:

     node tools/build-publisher-images.mjs [--limit N] [--offset N] [--dbg]

   Single HTTP request per record (one page per record). Multi-card posts
   get the same page hero image for every card — each record credits the
   publisher instead of implying a separate shot per card happened.
*/
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const LIMIT = (() => { const i = process.argv.indexOf('--limit'); return i > -1 ? Number(process.argv[i + 1]) : Infinity; })();
const OFFSET = (() => { const i = process.argv.indexOf('--offset'); return i > -1 ? Number(process.argv[i + 1]) : 0; })();
const DBG = process.argv.includes('--dbg');
const UA = 'MiseCollection/1.0 (recipe photo research; contact: https://github.com/BadImps/mise)';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

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
const strip = (v) => String(v || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
const pickImage = (recipe) => {
  if (!recipe) return null;
  const raw = recipe.image;
  if (typeof raw === 'string' && /^https?:\/\//i.test(raw)) return raw;
  if (raw && typeof raw === 'object') {
    if (Array.isArray(raw)) {
      for (const img of raw) {
        const url = typeof img === 'string' ? img : (img && (img.url || img.contentUrl || img['@id']));
        if (url && /^https?:\/\//i.test(url)) return url;
      }
      return null;
    }
    const url = raw.url || raw.contentUrl || raw['@id'];
    if (url && /^https?:\/\//i.test(url)) return url;
  }
  return null;
};
function pickOgImage(html) {
  const m = html.match(/<meta[^>]+property=["']og:image["'][^>]*>/i);
  if (!m) return null;
  const u = (m[0].match(/content=["']([^"']+)["']/i) || [])[1];
  return u && /^https?:\/\//i.test(u) ? u : null;
}
function absolute(u, relative) {
  if (!u) return null;
  try {
    if (/^https?:\/\//i.test(u)) return u;
    const base = new URL(relative);
    if (u.startsWith('//')) return base.protocol + u;
    if (u.startsWith('/')) return base.origin + u;
    return base.origin + '/' + u;
  } catch (_) { return u; }
}

async function fetchPage(url) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url, { headers: { 'user-agent': UA, accept: 'text/html' }, redirect: 'follow' });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return await res.text();
    } catch (err) {
      if (attempt === 2) throw err;
      await sleep(400 * (attempt + 1));
    }
  }
}

const collections = [
  { path: ['js', 'caribbean-sources.js'], global: 'window.MISE_CARIBBEAN_SOURCES' },
  { path: ['js', 'africa-sources.js'], global: 'window.MISE_AFRICA_SOURCES' },
];
const report = { searched: 0, found: 0, miss: [] };
for (const col of collections) {
  const file = path.join(ROOT, ...col.path);
  if (!fs.existsSync(file)) continue;
  const text = fs.readFileSync(file, 'utf8');
  const start = text.indexOf('= [');
  let arr;
  try { arr = JSON.parse(text.slice(start + 2).replace(/;\s*$/, '')); } catch (err) { console.error('Could not parse ' + col.path + ': ' + err.message); continue; }
  const merged = arr.slice();
  for (let i = 0; i < merged.length; i++) {
    const record = merged[i];
    if (OFFSET && i < OFFSET) continue;
    if (report.searched >= LIMIT) break;
    if (record.image) continue;
    report.searched += 1;
    let image = null;
    try {
      const html = await fetchPage(record.sourceUrl);
      const blocks = extractJsonLd(html);
      for (const block of blocks) {
        try {
          const json = JSON.parse(block);
          const recipe = findRecipe(json);
          if (recipe) {
            image = absolute(pickImage(recipe), record.sourceUrl);
            if (image) break;
          }
        } catch (_) { /* try next block */ }
      }
      if (!image) image = absolute(pickOgImage(html), record.sourceUrl);
    } catch (err) {
      report.miss.push(record.id + ' :: ' + err.message);
      continue;
    }
    if (image) {
      const host = new URL(record.sourceUrl).hostname.replace(/^www\./, '');
      merged[i] = { ...record, image, imageCredit: `${record.source || host} (${host})` };
      report.found += 1;
      if (DBG) console.log('✓ ' + record.id);
    } else {
      report.miss.push(record.id + ' :: no image in JSON-LD or og:image');
      if (DBG) console.log('✗ ' + record.id);
    }
    await sleep(150);
  }
  const stamped = text.slice(0, start) + '= ' + JSON.stringify(merged, null, 2) + ';\n';
  fs.writeFileSync(file, stamped, 'utf8');
  console.log('wrote', path.relative(ROOT, file), (fs.statSync(file).size / 1024).toFixed(0), 'KB ·', arr.length, 'records');
}
console.log(`publisher images: ${report.found}/${report.searched} found`);
if (report.miss.length) console.log('no match (' + report.miss.length + '):\n' + report.miss.join('\n'));
