/* Mise / kitchen-tool photographs.
   The cook-mode tool popover prefers a real photograph over line art, sourced
   from Wikimedia Commons under each file's own license (CC-BY, CC-BY-SA, CC0
   or the public domain — never NC/ND). One search + one fileinfo request per
   tool; images are hot-linked at 330 px with the author, license and file page
   credited in the popover. Tools without a confident match keep the line art.

     node tools/build-tool-images.mjs [--dbg]   # search + license-check
     node tools/patch-tool-images.mjs           # hand-verified corrections after any re-run

   Without the patch step, weak matches (industrial, museum or otherwise
   off-subject picks) come back — the corrections are part of the job, not an
   optional extra. */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const CACHE_PATH = path.join(ROOT, 'tools', 'tool-images-cache.json');
const OUT_PATH = path.join(ROOT, 'tools', 'tool-images.json');
const DBG = process.argv.includes('--dbg');
const UA = 'MiseCollection/1.0 (tool photo research; contact: https://github.com/BadImps/mise)';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// key in js/tools.js -> Commons search term, most-specific first
const TOOLS = [
  ['pot', 'stock pot'],
  ['bowl', 'mixing bowl'],
  ['pan', 'frying pan'],
  ['saucepan', 'saucepan'],
  ['spoon', 'wooden spoon'],
  ['slottedSpoon', 'slotted spoon'],
  ['processor', 'food processor'],
  ['blender', 'countertop blender'],
  ['whisk', 'whisk'],
  ['cleaver', 'cleaver knife'],
  ['knife', "chef's knife"],
  ['paring', 'paring knife'],
  ['dutch', 'dutch oven'],
  ['instantpot', 'pressure cooker'],
  ['dish', 'casserole dish'],
  ['wok', 'wok'],
  ['colander', 'colander'],
  ['rollingpin', 'rolling pin'],
  ['roasting', 'roasting pan'],
  ['spatula', 'spatula'],
  ['griddle', 'griddle'],
  ['mortar', 'mortar and pestle'],
  ['sheet', 'baking sheet'],
  ['cup', 'measuring cup'],
  ['measuringSpoons', 'measuring spoon'],
  ['grater', 'box grater'],
  ['ladle', 'ladle'],
  ['sieve', 'kitchen sieve'],
  ['airfryer', 'air fryer'],
  ['board', 'cutting board'],
  ['tongs', 'kitchen tongs'],
  ['peeler', 'vegetable peeler'],
  ['kettle', 'stovetop kettle'],
  ['garlicpress', 'garlic press'],
  ['skilletCast', 'cast iron skillet'],
  ['sautePan', 'saute pan'],
  ['fryingPan', 'frying pan'],
];

const stripQualifiers = (s) => String(s || '').toLowerCase()
  .replace(/\([^)]*\)/g, ' ').replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
const titleTokens = (title) => stripQualifiers(String(title || '').replace(/\.[^.]+$/, '')).split(' ').filter((w) => w.length > 1);

const BAD_TITLE = /(logo|diagram|icon|drawing|illustration|silhouette|render|3d|vector|map\b|stamp|poster|advertisement|cartoon|emoji|clip[- ]?art)/i;

function scoreCandidate(term, meta) {
  const t = titleTokens(meta.title);
  const phrase = stripQualifiers(term);
  let score = 0;
  for (const tk of phrase.split(' ')) {
    if (t.includes(tk)) score += 10;
    else if (t.some((tt) => tt.startsWith(tk) || tk.startsWith(tt))) score += 6;
  }
  if (phrase && t.join(' ').includes(phrase)) score += 80;
  if (/\.(jpe?g|png)$/i.test(meta.title || '')) score += 10;
  score += Math.min(Math.max(meta.width * meta.height, 100), 4000000) / 60000;
  if (BAD_TITLE.test(meta.title)) score -= 120;
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

async function api(params, timeout = 15000) {
  const qp = new URLSearchParams({ ...params, format: 'json', maxlag: '5' }).toString();
  for (let attempt = 0; attempt <= 2; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    try {
      const res = await fetch('https://commons.wikimedia.org/w/api.php?' + qp, {
        signal: controller.signal, headers: { 'user-agent': UA, accept: 'application/json' },
      });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const json = await res.json();
      if (json.error) throw new Error(json.error.info || 'API error');
      return json;
    } finally {
      clearTimeout(timer);
    }
  }
}
const stripHtml = (s) => String(s || '').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
const get = (ext, key) => (ext[key] && ext[key].value) || '';

async function photoFor(term) {
  const search = await api({
    action: 'query', list: 'search', srsearch: `${term} kitchen`, srnamespace: '6',
    srlimit: '20',
  });
  const hits = ((search.query && search.query.search) || []).map((h) => h.title);
  if (!hits.length) { console.log('no hits for', term); return null; }
  const info = await api({
    action: 'query', titles: hits.join('|'),
    prop: 'imageinfo', iiprop: 'url|size|extmetadata', iiurlwidth: '320',
  });
  const pages = Object.values(info.query && info.query.pages ? info.query.pages : {});
  const metas = pages.map((page) => {
    const ii = page.imageinfo && page.imageinfo[0];
    if (!ii) return null;
    const ext = ii.extmetadata || {};
    return {
      title: page.title,
      url: ii.url,
      thumb: ii.thumburl || ii.url,
      width: ii.width,
      height: ii.height,
      file: `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(String(page.title).replace(/^File:/, ''))}`,
      license: stripHtml(get(ext, 'LicenseShortName') || get(ext, 'License') || ''),
      artist: stripHtml(get(ext, 'Artist') || ''),
    };
  }).filter(Boolean);
  const licensed = metas.filter((m) => licenseAllowed(m) && m.width >= 400 && m.height >= 250);
  licensed.sort((a, b) => scoreCandidate(term, b) - scoreCandidate(term, a));
  const best = licensed[0];
  if (!best) { console.log('no licensed match for', term); return null; }
  if (DBG) console.log('✓', term, '->', best.title, '·', best.license);
  return {
    image: best.thumb,
    credit: `${best.artist || 'Uncredited'} (${best.license || 'unknown license'}) — ${best.file}`,
  };
}

const out = {};
for (const [key, term] of TOOLS) {
  try {
    const hit = await photoFor(term);
    if (hit) out[key] = hit;
  } catch (err) {
    console.log('error for', term, '-', err.message);
  }
  await sleep(150);
}
fs.writeFileSync(OUT_PATH, JSON.stringify(out, null, 2) + '\n', 'utf8');
console.log('wrote', path.relative(ROOT, OUT_PATH), '·', Object.keys(out).length, 'of', TOOLS.length, 'tools carried a photograph');
