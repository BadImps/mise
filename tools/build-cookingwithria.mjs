/* Mise / Cooking with Ria collection builder.
   Reads the public WordPress REST API of cookingwithria.com and writes the
   Cooking with Ria records that js/caribbean-sources.js carries alongside
   the other publisher records. Nothing here writes a recipe. Every field
   comes from the recipe-card markup the publisher serves — the same data
   served as the page's schema.org Recipe block. Run from the project root:

     node tools/build-cookingwithria.mjs

   Multi-card posts keep one anchor per recipe (#recipe-<id>-ingredients);
   single-card posts keep the canonical permalink.
*/
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const WP = 'https://cookingwithria.com/wp-json/wp/v2/posts';
const UA = 'MiseBot (recipe collection tool; contact: https://github.com/BadImps/mise)';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ---------- text ---------- */
const NAMED = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
  rsquo: '\u2019', lsquo: '\u2018', ldquo: '\u201c', rdquo: '\u201d',
  hellip: '\u2026', ndash: '\u2013', mdash: '\u2014', deg: '\u00b0',
  frac12: '\u00bd', frac14: '\u00bc', frac34: '\u00be',
};

function decodeEntities(value) {
  return String(value == null ? '' : value).replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (match, name) => {
    if (name[0] === '#') {
      const code = name[1].toLowerCase() === 'x' ? parseInt(name.slice(2), 16) : parseInt(name.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : match;
    }
    return NAMED[name.toLowerCase()] ?? match;
  });
}

const stripTags = (value) => decodeEntities(String(value || '').replace(/<[^>]+>/g, ' '))
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

const clean = (value) => decodeEntities(String(value == null ? '' : value))
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

const slug = (value) => clean(value).toLowerCase()
  .replace(/['’]/g, '')
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')
  .slice(0, 60);

/* Capture the text of the outer element that starts at `openTagEnd`,
   balancing nested <div> tags. */
function balancedDivText(html, openTagEnd) {
  let depth = 1;
  let i = openTagEnd;
  const openRe = /<div\b/gi;
  const closeRe = /<\/div>/gi;
  while (i < html.length) {
    openRe.lastIndex = i;
    closeRe.lastIndex = i;
    const open = openRe.exec(html);
    const close = closeRe.exec(html);
    if (!close) return html.slice(openTagEnd);
    if (open && open.index < close.index) { depth += 1; i = open.index + 5; continue; }
    depth -= 1;
    if (depth === 0) return html.slice(openTagEnd, close.index);
    i = close.index + 6;
  }
  return html.slice(openTagEnd);
}

function textOf(value) {
  return stripTags(value).replace(/\s{2,}/g, ' ').trim();
}

/* ---------- cuisine (publisher's frame) ---------- */
const CUISINE = [
  [/guyane?s|guyana/i, 'Guyana'],
  [/barbad/i, 'Barbados'],
  [/grenad/i, 'Grenada'],
  [/jamaic/i, 'Jamaica'],
  [/cuba|cuban/i, 'Cuba'],
  [/haiti/i, 'Haiti'],
  [/puerto ?rico|boricua/i, 'Puerto Rico'],
  [/baham/i, 'The Bahamas'],
  [/surinam/i, 'Suriname'],
  [/dominican/i, 'Dominican Republic'],
  [/belize/i, 'Belize'],
];
const cuisineOf = (post) => {
  const hay = (String(post.slug || '') + ' ' + (post.title && post.title.rendered)).toLowerCase();
  for (const [re, country] of CUISINE) if (re.test(hay)) return country;
  return 'Trinidad & Tobago';
};

/* ---------- extraction ---------- */
function recipeCards(content) {
  const nameRe = /<h[1-6][^>]*wprm-recipe-name[^>]*>([\s\S]*?)<\/h[1-6]>/gi;
  const names = [...content.matchAll(nameRe)].map((m) => ({ index: m.index, name: textOf(m[1]) }));
  const ingRe = /id="recipe-(\d+)-ingredients"/g;
  const ingredients = [...content.matchAll(ingRe)].map((m) => ({ index: m.index, id: m[1] }));
  const cards = [];
  for (let i = 0; i < ingredients.length; i++) {
    const name = names[i] ? names[i].name : '';
    if (!name) continue;
    const nextIngredient = ingredients[i + 1] ? ingredients[i + 1].index : content.length;
    const nameIndex = names[i] ? names[i].index : ingredients[i].index;
    cards.push({
      name,
      wprmId: ingredients[i].id,
      nameIndex,
      ingIndex: ingredients[i].index,
      // Times, servings, author and summary sit between the name and the ingredients.
      front: content.slice(nameIndex, ingredients[i].index),
      section: content.slice(ingredients[i].index, nextIngredient),
    });
  }
  return cards;
}

function ingredientsOf(card) {
  const instructionsIdx = card.section.indexOf('-instructions"');
  const section = instructionsIdx > -1 ? card.section.slice(0, instructionsIdx) : card.section;
  const out = [];
  for (const match of section.matchAll(/<li\s+class="wprm-recipe-ingredient"[^>]*>([\s\S]*?)<\/li>/gi)) {
    const raw = match[1];
    const amount = (raw.match(/class="wprm-recipe-ingredient-amount[^"]*"[^>]*>([\s\S]*?)<\/span>/) || [])[1];
    const unit = (raw.match(/class="wprm-recipe-ingredient-unit[^"]*"[^>]*>([\s\S]*?)<\/span>/) || [])[1];
    const name = (raw.match(/class="wprm-recipe-ingredient-name[^"]*"[^>]*>([\s\S]*?)<\/span>/) || [])[1];
    const notes = (raw.match(/class="wprm-recipe-ingredient-notes[^"]*"[^>]*>([\s\S]*?)<\/span>/) || [])[1];
    const parts = [textOf(amount), textOf(unit), textOf(name)].filter(Boolean);
    let line = parts.join(' ').replace(/\s{2,}/g, ' ').trim();
    const note = textOf(notes);
    if (note) line += ', ' + note;
    if (line) out.push(line);
  }
  return out;
}

function instructionsOf(card) {
  const section = card.section;
  const start = section.indexOf('id="recipe-' + card.wprmId + '-instructions"');
  if (start < 0) return [];
  const slice = section.slice(start);
  const end = slice.indexOf('id="recipe-' + card.wprmId + '-notes"');
  const window_ = end > -1 ? slice.slice(0, end) : slice;
  const out = [];
  const re = /<div\s+class="wprm-recipe-instruction-text"[^>]*>/gi;
  let match;
  while ((match = re.exec(window_))) {
    const inner = balancedDivText(window_, match.index + match[0].length);
    const text = stripTags(inner);
    if (text) out.push({ '@type': 'HowToStep', text });
  }
  return out;
}

function servingsOf(card) {
  const m = card.front.match(/wprm-recipe-servings-adjustable-tooltip[^>]*>\s*([^<]+)/);
  if (!m) return null;
  const n = parseInt(String(m[1]).replace(/[^\d]/g, ''), 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function timeContainer(k) {
  // kind is 'prep_time', 'cook_time' or 'total_time' -> wprm-recipe-prep-time-container
  return 'wprm-recipe-' + k.replace(/_/g, '-') + '-container';
}

function timeOf(card, kind) {
  const container = timeContainer(kind);
  const start = card.front.indexOf(container);
  if (start < 0) return null;
  const rest = card.front.slice(start);
  const others = ['prep_time', 'cook_time', 'total_time'].filter((k) => k !== kind)
    .map((k) => rest.indexOf(timeContainer(k)))
    .filter((i) => i > -1)
    .sort((a, b) => a - b);
  const end = others.length ? others[0] : rest.length;
  const slice = rest.slice(0, end);
  const re = new RegExp('wprm-recipe-details-(minutes|hours|days)\\s+wprm-recipe-' + kind + '[^>]*>\\s*(\\d+)', 'g');
  let minutes = 0;
  let matched = false;
  for (const m of slice.matchAll(re)) {
    const value = Number(m[2]);
    matched = true;
    if (m[1] === 'minutes') minutes += value;
    else if (m[1] === 'hours') minutes += value * 60;
    else minutes += value * 1440;
  }
  if (!matched || minutes <= 0) return null;
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  const mins = minutes % 60;
  return 'PT' + (days ? days + 'D' : '') + (hours ? hours + 'H' : '') + (mins ? mins + 'M' : '');
}

function summaryOf(card) {
  const m = card.front.match(/<div\s+class="wprm-recipe-summary[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
  return m ? stripTags(m[1]) : '';
}

function authorOf(card) {
  const m = card.front.match(/wprm-recipe-author\s+wprm-block-text-normal"[^>]*>([^<]+)</);
  return m ? clean(m[1]) : 'CookingwithRia';
}

/* ---------- fetch ---------- */
async function fetchPosts() {
  const out = [];
  for (let page = 1; ; page++) {
    const url = `${WP}?per_page=100&page=${page}&_fields=id,link,title,slug,content`;
    const res = await fetch(url, { headers: { 'user-agent': UA, accept: 'application/json' }, redirect: 'follow' });
    if (!res.ok) throw new Error('HTTP ' + res.status + ' at page ' + page);
    const total = Number(res.headers.get('x-wp-total') || 0);
    const posts = await res.json();
    out.push(...posts);
    console.log(`page ${page} · ${posts.length} posts (${out.length}/${total})`);
    if (posts.length < 100 || out.length >= total) break;
    await sleep(150);
  }
  return out;
}

/* ---------- build ---------- */
const posts = await fetchPosts();
const records = [];
const skipped = [];
for (const post of posts) {
  const content = (post.content && post.content.rendered) || '';
  if (!content.includes('wprm-recipe-name')) continue;
  const cards = recipeCards(content);
  const multi = cards.length > 1;
  for (const card of cards) {
    const ingredients = ingredientsOf(card);
    const instructions = instructionsOf(card);
    if (ingredients.length < 1 || instructions.length < 1) {
      skipped.push(`${post.slug} :: ingredients=${ingredients.length} steps=${instructions.length}`);
      continue;
    }
    const cuisine = cuisineOf(post);
    const link = String(post.link || '').split('#')[0];
    const baseId = 'carib-' + slug(cuisine) + '-' + slug(post.slug);
    records.push({
      id: multi ? `${baseId}-r${card.wprmId}` : baseId,
      country: cuisine,
      name: clean(card.name),
      source: 'Cooking with Ria',
      sourceUrl: multi ? `${link}#recipe-${card.wprmId}-ingredients` : link,
      author: authorOf(card),
      ingredients,
      description: summaryOf(card),
      instructions,
      yields: servingsOf(card),
      prepTime: timeOf(card, 'prep_time'),
      cookTime: timeOf(card, 'cook_time'),
      totalTime: timeOf(card, 'total_time'),
    });
  }
}

/* merge into the existing Caribbean file; Cooking with Ria records regenerate */
const caribbeanPath = path.join(ROOT, 'js/caribbean-sources.js');
const file = fs.readFileSync(caribbeanPath, 'utf8');
const all = JSON.parse(file.match(/=\s*(\[[\s\S]*\]);\s*$/)[1]);
const existing = all.filter((r) => r.source !== 'Cooking with Ria');
const stale = all.length - existing.length;
const existingIds = new Set(existing.map((r) => r.id));
const seen = new Set(existing.map((r) => r.sourceUrl));
const fresh = [];
const ids = new Set();
for (const record of records) {
  let id = record.id;
  let n = 2;
  while (existingIds.has(id) || ids.has(id)) id = `${record.id}-${n++}`;
  ids.add(id);
  if (seen.has(record.sourceUrl)) continue;
  seen.add(record.sourceUrl);
  fresh.push({ ...record, id });
}
fresh.sort((a, b) => a.name.localeCompare(b.name));
const merged = existing.concat(fresh);
const header = 'Caribbean recipes read from publisher schema.org Recipe data (That Girl Cooks Healthy, 196 Flavors, BBC Good Food) or the recipe-card markup the publisher serves (Cooking with Ria; see tools/build-cookingwithria.mjs). Each record links to its publisher page; multi-card posts link to each recipe card anchor.';
fs.writeFileSync(caribbeanPath, `/* ${header} */\nwindow.MISE_CARIBBEAN_SOURCES = ${JSON.stringify(merged, null, 2)};\n`, 'utf8');
console.log('\nsummary');
console.log('  posts fetched    ', posts.length);
console.log('  recipe cards     ', records.length);
console.log('  fresh records    ', fresh.length);
console.log('  stale replaced   ', stale);
console.log('  merged total     ', merged.length, '(was', all.length + ')');
console.log('  skipped thin     ', skipped.length);
if (skipped.length) console.log('  skipped list     ', skipped);
console.log('  file size        ', (fs.statSync(caribbeanPath).size / 1024).toFixed(0) + ' KB');
