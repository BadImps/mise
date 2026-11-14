/* Mise / photo alchemist.
   Finds a freely licensed photograph for each collection recipe that lacks one.
   Source: Wikimedia Commons API. Bitmaps only (jpg/jpeg/png/webp/gif), licenses
   CC0, CC-BY, CC-BY-SA, Public domain, plus strict query concurrency.

     node tools/build-images.mjs [--force] [--offset n] [--limit n] [--dbg]

   The collections are rewritten in place as images are found, so partial
   progress survives interruptions. Records already carrying an image are skipped.
*/
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const LIMIT = (() => { const i = process.argv.indexOf('--limit'); return i > -1 ? Number(process.argv[i + 1]) : Infinity; })();
const OFFSET = (() => { const i = process.argv.indexOf('--offset'); return i > -1 ? Number(process.argv[i + 1]) : 0; })();
const FORCE = process.argv.includes('--force');
const DBG = process.argv.includes('--dbg');
const PAR = 2; // max concurrent Commons requests
const UA = 'MiseCollection/1.0 (recipe photo research; contact: https://github.com/BadImps/mise)';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms + Math.floor(Math.random() * 120)));

const BITMAP = /\.(jpe?g|png|webp|gif)$/i;
const BAD_TITLE = /(logotype|logo|coat of arms|flag|seal|map|diagram|chart|coin|medal|stamp|cover of|advertisement|ad for|menu of|poster)/i;
const SKIP_WORDS = new Set(['recipe', 'cooking', 'with', 'and', 'the', 'of', 'a', 'an', 'for', 'style', 'quick', 'homemade', 'authentic', 'best', 'easy', 'instant', 'pot', 'pressure', 'slow', 'cooker', 'crockpot', 'minute', 'minutes', 'mins', 'min', 'from', 'one', 'pan', 'sheet', 'batch', 'small', 'large', 'family', 'size', 'serving', 'servings', 'people', 'portions', 'vegan', 'vegetarian', 'gluten', 'free', 'keto', 'paleo', 'dairy', 'whole30']);

const decodeEntities = (value) => String(value == null ? '' : value)
  .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
  .replace(/&#0?39;|&apos;/g, "'").replace(/&nbsp;/g, ' ').replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)));

const stripTags = (value) => decodeEntities(String(value || '').replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim();
const stripQualifiers = (name) => String(name || '')
  .replace(/\([^)]*\)/g, ' ').replace(/\[[^\]]*\]/g, ' ')
  .replace(/^\d+\s*[-–]?\s*/g, ' ')
  .replace(/^\d+\s*(minute|minutes|mins|min|hour|hours|day|days)\s*/i, ' ')
  .replace(/\s+/g, ' ').trim();

const singular = (w) => {
  const l = String(w).toLowerCase();
  if (l.length <= 3) return l;
  if (/ies$/.test(l) && l.length > 4) return l.slice(0, -3) + 'y';
  if (l.endsWith('es') && l.length > 4) return l.slice(0, -2);
  if (l.endsWith('s') && l.length > 3) return l.slice(0, -1);
  return l;
};

const dishTokens = (name) => stripQualifiers(name)
  .toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9]+/g, ' ').split(/\s+/).map(singular)
  .filter((w) => w.length >= 3 && !SKIP_WORDS.has(w));

const titleTokens = (title) => String(title || '')
  .toLowerCase().replace(/\.(jpe?g|png|webp|gif|tiff?)$/i, '')
  .replace(/&[^;]+;/g, ' ').replace(/[^a-z0-9]+/g, ' ').split(/\s+/).filter(Boolean);

const countHits = (cleanName, title) => {
  const dish = dishTokens(cleanName);
  const t = titleTokens(title);
  let hits = 0;
  for (const tk of dish) {
    if (t.includes(tk)) hits += 1;
    else if (t.some((tt) => tt.startsWith(tk) || tk.startsWith(tt))) hits += 1;
  }
  return hits;
};

function scoreCandidate(recipe, meta) {
  const clean = stripQualifiers(recipe.name);
  const t = titleTokens(meta.title);
  const phrase = clean.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const hits = countHits(clean, meta.title);
  let score = hits * 10 + Math.min(Math.max(meta.width * meta.height, 100), 4000000) / 40000;  if (BAD_TITLE.test(meta.title)) score -= 60;
  if (phrase && t.join(' ').includes(phrase)) score += 80;
  else if (phrase && meta.title.toLowerCase().replace(/[^a-z0-9\s]+/g, ' ').includes(phrase)) score += 80;
  if (/\.(jpe?g|png)$/i.test(meta.title)) score += 10;
  return score;
}

const licenseAllowed = (meta) => {
  const l = (meta.license || '').toLowerCase();
  if (/(non-?commercial|\bNC\b)/i.test(l)) return false;
  if (/(no deriv|\bND\b)/i.test(l)) return false;
  if (!l.trim()) return false;
  if (l.includes('public domain')) return true;
  if (l.startsWith('cc0')) return true;
  if (l.includes('cc by') || l.startsWith('attribution')) return true;
  return false;
};

const metaCache = new Map();
async function api(params, timeout = 15000) {
  const qp = new URLSearchParams({ ...params, format: 'json', maxlag: '5' }).toString();
  for (let attempt = 0; attempt <= 2; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    try {
      const res = await fetch('https://commons.wikimedia.org/w/api.php?' + qp.toString(), {
        signal: controller.signal, headers: { 'user-agent': UA, accept: 'application/json' },
      });
      clearTimeout(timer);
      if (res.status === 429 || res.status === 503) {
        const wait = (Number(res.headers.get('Retry-After')) || 2) * 1000;
        await sleep(Math.min(wait, 15000));
        continue;
      }
      if (!res.ok) return null;
      return await res.json();
    } catch (err) {
      clearTimeout(timer);
      if (attempt === 2) return null;
      await sleep(400 * (attempt + 1));
    }
  }
  return null;
}

async function searchCandidates(query, limit) {
  const json = await api({ action: 'query', list: 'search', srsearch: query, srnamespace: '6', srlimit: String(limit || 40) });
  return (json?.query?.search || []).map((r) => r.title);
}

async function batchMetadata(titles) {
  const out = [];
  for (let i = 0; i < titles.length; i += 25) {
    const batch = titles.slice(i, i + 25).filter((t) => !metaCache.has(t));
    if (batch.length) {
      const json = await api({ action: 'query', titles: batch.join('|'), prop: 'imageinfo', iiprop: 'url|size|extmetadata', iiurlwidth: '900' });
      for (const page of Object.values(json?.query?.pages || {})) {
        const info = page.imageinfo && page.imageinfo[0];
        if (!info) continue;
        const em = info.extmetadata || {};
        const get = (k) => em[k]?.value;
        metaCache.set(page.title, {
          title: page.title,
          pageId: page.pageid,
          url: (info.thumburl || info.url || '').split('?')[0],
          width: info.width,
          height: info.height,
          artist: stripTags(get('Artist') || get('Credit') || 'Uncredited'),
          license: (get('LicenseShortName') || '').trim(),
          mediaType: get('MediaType') || '',
        });
      }
    }
    for (const t of titles) if (metaCache.has(t)) out.push(metaCache.get(t));
  }
  return out;
}

async function findImage(record) {
  const clean = stripQualifiers(record.name);
  const dish = dishTokens(clean);
  const countryAdj = String(record.country || '').split('&')[0].trim();
  const top = dish.slice().sort((a, b) => b.length - a.length);
  const queries = [];
  if (top.length >= 3) {
    queries.push('intitle:' + top[0] + ' intitle:' + top[1] + ' intitle:' + top[2]);
    queries.push('intitle:' + top[0] + ' intitle:' + top[1]);
  } else if (top.length === 2) {
    queries.push('intitle:' + top[0] + ' intitle:' + top[1]);
    queries.push('intitle:' + top[0]);
  } else if (top.length === 1) {
    queries.push('intitle:' + top[0]);
  }
  queries.push(dish.slice(0, 3).join(' '));
  queries.push(dish.slice(0, 3).join(' ') + ' ' + countryAdj);
  const minHits = Math.max(1, Math.ceil(Math.min(dish.length, 6) * 0.5));
  for (const q of queries) {
    const titles = await searchCandidates(q, 40);
    if (!titles) continue;
    const bitmaps = titles.filter((t) => BITMAP.test(t));
    if (!bitmaps.length) continue;
    const metas = await batchMetadata(bitmaps);
    const licensed = metas.filter((m) => licenseAllowed(m) && m.width >= 400 && m.height >= 250);
    licensed.sort((a, b) => scoreCandidate(record, b) - scoreCandidate(record, a));
    const best = licensed[0];
    if (best && countHits(clean, best.title) >= minHits) {
      return { image: best.url, imageCredit: `${best.artist || 'Uncredited'} (${best.license || 'unknown license'}) via Wikimedia Commons` };
    }
  }
  return null;
}

async function workerPool(items, n, worker) {
  const results = new Array(items.length);
  let cursor = 0;
  await Promise.all(new Array(Math.min(n, items.length)).fill(0).map(async () => {
    while (true) {
      const i = cursor++;
      if (i >= items.length) break;
      results[i] = await worker(items[i], i);
    }
  }));
  return results;
}

const collections = [
  { path: ['js', 'caribbean-sources.js'], global: 'window.MISE_CARIBBEAN_SOURCES' },
  { path: ['js', 'africa-sources.js'], global: 'window.MISE_AFRICA_SOURCES' },
];

const report = { searched: 0, found: 0, miss: [] };
for (const col of collections) {
  const file = path.join(ROOT, ...col.path);
  const text = fs.readFileSync(file, 'utf8');
  const start = text.indexOf('= [');
  const arr = JSON.parse(text.slice(start + 2).replace(/;\s*$/, ''));
  const merged = arr.slice();
  const work = [];
  for (let i = 0; i < merged.length; i++) {
    const record = merged[i];
    if (!FORCE && record.image) continue;
    work.push({ record, index: i });
  }
  const windowSlice = work.slice(OFFSET, OFFSET + (isFinite(LIMIT) ? LIMIT : work.length));
  const found = await workerPool(windowSlice, PAR, async ({ record, index }) => {
    report.searched++;
    const hit = await findImage(record);
    if (hit) return { index, record: { ...record, image: hit.image, imageCredit: hit.imageCredit } };
    report.miss.push(record.id + ' ' + record.name);
    return null;
  });
  let changed = false;
  for (const f of found) {
    if (!f) continue;
    merged[f.index] = f.record;
    changed = true;
    report.found++;
  }
  if (changed) {
    const stamped = text.slice(0, start) + '= ' + JSON.stringify(merged, null, 2) + ';\n';
    fs.writeFileSync(file, stamped, 'utf8');
    console.log('wrote', path.relative(ROOT, file), fs.statSync(file).size / 1024, 'KB with', merged.length, 'records');
  }
}
console.log(`found ${report.found}/${report.searched}`);
if (report.miss.length) console.log('no match (' + report.miss.length + '):\n' + report.miss.join('\n'));
