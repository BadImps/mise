/* Mise / addition builder.
   Reads the public recipe records used for beverage and pastry research and
   writes the bundled data file:

     js/additions.js   MISE_DRINKS and MISE_PASTRY

   Nothing here writes a recipe. Every field comes from the publisher's own
   schema.org Recipe data. Run from the project root:

     node tools/build-additions.mjs
*/
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';
const ROOT = path.resolve(import.meta.dirname, '..');
const NOW = new Date().toISOString();

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

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

const clean = (value) => decodeEntities(value)
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

const slug = (value) => {
  const out = clean(value).toLowerCase()
    .replace(/['\u2019]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return out || 'record';
};

async function get(url) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const res = await fetch(url, { headers: { 'user-agent': UA, accept: 'text/html' }, redirect: 'follow' });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return await res.text();
    } catch (error) {
      if (attempt === 2) throw error;
      await sleep(400 * (attempt + 1));
    }
  }
  throw new Error('unreachable');
}

function findRecipeNode(value, depth = 0) {
  if (!value || typeof value !== 'object' || depth > 8) return null;
  if (Array.isArray(value)) {
    for (const item of value) {
      const hit = findRecipeNode(item, depth + 1);
      if (hit) return hit;
    }
    return null;
  }
  if (value['@graph']) {
    const hit = findRecipeNode(value['@graph'], depth + 1);
    if (hit) return hit;
  }
  const types = [].concat(value['@type'] || []).map(String);
  if (types.some((type) => type === 'Recipe' || type.endsWith('/Recipe'))) return value;
  for (const key of ['mainEntity', 'itemListElement', 'hasPart']) {
    if (value[key]) {
      const hit = findRecipeNode(value[key], depth + 1);
      if (hit) return hit;
    }
  }
  return null;
}

function instructionsOf(node) {
  const raw = node.recipeInstructions || [];
  const blocks = [];
  const push = (text) => {
    const value = clean(text);
    if (value) blocks.push({ '@type': 'HowToStep', text: value });
  };
  const walk = (value) => {
    if (value == null) return;
    if (typeof value === 'string') { push(value); return; }
    if (Array.isArray(value)) { value.forEach(walk); return; }
    if (typeof value === 'object') {
      if (value.itemListElement) walk(value.itemListElement);
      if (value.text) push(value.text);
      else if (!value.itemListElement && value.name) push(value.name);
    }
  };
  walk(raw);
  return blocks;
}

function authorOf(node) {
  const list = [].concat(node.author || []);
  return list.map((author) => (typeof author === 'string' ? author : author && author.name))
    .filter(Boolean)
    .map(clean)
    .join(', ');
}

function yieldOf(node) {
  const raw = [].concat(node.recipeYield || [])[0];
  const value = parseInt(String(raw || '').replace(/[^0-9]/g, ''), 10);
  return Number.isFinite(value) && value > 0 ? value : null;
}

function imageOf(node) {
  const raw = node.image;
  const item = Array.isArray(raw) ? raw[0] : raw;
  const url = typeof item === 'string' ? item : item && (item.url || item.contentUrl || item.thumbnailUrl);
  const value = clean(url || '');
  // Some publisher file names store accents decomposed (NFD); a precomposed
  // character would percent-encode to bytes the server 404s on.
  return value ? encodeURI(value.normalize('NFD')) : '';
}

export async function publisherRecipe(url, country, id, source, type) {
  const html = await get(url);
  const blocks = [...html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)].map((m) => m[1]);
  let node = null;
  for (const block of blocks) {
    try {
      node = findRecipeNode(JSON.parse(block));
      if (node) break;
    } catch (error) { /* another block may parse */ }
  }
  if (!node) throw new Error('No schema.org Recipe at ' + url);
  const ingredients = [].concat(node.recipeIngredient || node.ingredients || [])
    .map((item) => clean(typeof item === 'string' ? item : item.name))
    .filter(Boolean);
  const instructions = instructionsOf(node);
  if (!ingredients.length || !instructions.length) throw new Error('Thin recipe at ' + url);
  const canonical = clean(node.url || url);
  return {
    id,
    country,
    name: clean(node.name),
    source,
    sourceUrl: canonical || url,
    author: authorOf(node),
    ingredients,
    instructions,
    yields: yieldOf(node),
    prepTime: clean(node.prepTime),
    cookTime: clean(node.cookTime),
    totalTime: clean(node.totalTime),
    image: imageOf(node) || undefined,
    type: type || clean([].concat(node.recipeCategory || []).join(', ')),
  };
}

const DRINKS = [
  ['https://196flavors.com/mexico-horchata/', 'Mexico', 'drink-horchata', 'Mexican'],
  ['https://196flavors.com/india-mango-lassi/', 'India', 'drink-mango-lassi', 'Indian'],
  ['https://196flavors.com/syria-doogh/', 'Syria', 'drink-doogh', 'Middle Eastern'],
  ['https://196flavors.com/egypt-sobia/', 'Egypt', 'drink-sobia', 'Egyptian'],
  ['https://196flavors.com/bissap/', 'West Africa', 'drink-bissap', 'African'],
  ['https://196flavors.com/chicha-morada/', 'Peru', 'drink-chicha-morada', 'Peruvian'],
  ['https://196flavors.com/thailand-thai-iced-tea/', 'Thailand', 'drink-thai-iced-tea', 'Thai'],
  ['https://196flavors.com/malaysia-teh-tarik/', 'Malaysia', 'drink-teh-tarik', 'Malaysian'],
  ['https://196flavors.com/tunisia-lemonade-citronnade/', 'Tunisia', 'drink-citronnade', 'Tunisian'],
  ['https://196flavors.com/sharbat/', 'Middle East', 'drink-sharbat', 'Middle Eastern'],
  ['https://196flavors.com/agua-de-panela-aguapanela/', 'Colombia', 'drink-aguapanela', 'Colombian'],
  ['https://196flavors.com/nigeria-ginger-juice-gnamakoudji/', 'Nigeria', 'drink-gnamakoudji', 'Nigerian'],
  ['https://196flavors.com/equatorial-guinea-ginger-beer-ginja-beer/', 'Equatorial Guinea', 'drink-ginja-beer', 'Central African'],
  ['https://196flavors.com/chocolate-caliente/', 'Spain', 'drink-chocolate-caliente', 'Spanish'],
  ['https://196flavors.com/argentina-el-submarino/', 'Argentina', 'drink-el-submarino', 'Argentine'],
  ['https://196flavors.com/haiti-akasan/', 'Haiti', 'drink-akasan', 'Haitian'],
  ['https://196flavors.com/puerto-rico-coquito/', 'Puerto Rico', 'drink-coquito', 'Puerto Rican'],
  ['https://196flavors.com/haiti-cremas-kremas/', 'Haiti', 'drink-cremas', 'Haitian'],
  ['https://196flavors.com/chile-cola-de-mono-colemono/', 'Chile', 'drink-cola-de-mono', 'Chilean'],
  ['https://196flavors.com/ponche-crema/', 'Venezuela', 'drink-ponche-crema', 'Venezuelan'],
  ['https://196flavors.com/bolivia-chuflay/', 'Bolivia', 'drink-chuflay', 'Bolivian'],
  ['https://196flavors.com/spain-sangria/', 'Spain', 'drink-sangria', 'Spanish'],
  ['https://196flavors.com/tinto-de-verano/', 'Spain', 'drink-tinto-de-verano', 'Spanish'],
  ['https://196flavors.com/mojito/', 'Cuba', 'drink-mojito', 'Cuban'],
].map(([url, country, id, regionHint]) => [url, country, id, '196 flavors', 'Drinks']);

const PASTRIES = [
  ['https://196flavors.com/jamaican-patty/', 'Jamaica', 'pastry-jamaican-patty'],
  ['https://196flavors.com/trinidad-and-tobago-currants-roll/', 'Trinidad and Tobago', 'pastry-currants-roll'],
  ['https://196flavors.com/saint-kitts-and-nevis-tourment-d-amour/', 'Saint Kitts and Nevis', 'pastry-tourment-d-amour'],
  ['https://196flavors.com/haiti-pate-haitien-haitian-patty/', 'Haiti', 'pastry-haitian-patty'],
  ['https://196flavors.com/colombia-empanadas/', 'Colombia', 'pastry-colombian-empanadas'],
  ['https://196flavors.com/baklava/', 'Greece', 'pastry-baklava'],
  ['https://196flavors.com/kataifi/', 'Greece', 'pastry-kataifi'],
  ['https://196flavors.com/bougatsa/', 'Greece', 'pastry-bougatsa'],
  ['https://196flavors.com/greece-galaktoboureko/', 'Greece', 'pastry-galaktoboureko'],
  ['https://196flavors.com/qatar-oum-ali/', 'Qatar', 'pastry-oum-ali'],
  ['https://196flavors.com/austria-apfelstrudel/', 'Austria', 'pastry-apfelstrudel'],
  ['https://196flavors.com/serbia-bundevara/', 'Serbia', 'pastry-bundevara'],
  ['https://196flavors.com/el-salvador-pastelitos-salvadorenos/', 'El Salvador', 'pastry-pastelitos-salvadorenos'],
  ['https://196flavors.com/algeria-makroud/', 'Algeria', 'pastry-makroud'],
  ['https://196flavors.com/tunisia-samsa/', 'Tunisia', 'pastry-samsa'],
  ['https://196flavors.com/tunisia-yoyos-youyous/', 'Tunisia', 'pastry-yoyos'],
  ['https://196flavors.com/tunisia-debla-ouedhnine-el-kadhi/', 'Tunisia', 'pastry-debla'],
  ['https://196flavors.com/pasteis-de-nata/', 'Portugal', 'pastry-pasteis-de-nata'],
  ['https://196flavors.com/maamoul/', 'Lebanon', 'pastry-maamoul'],
  ['https://196flavors.com/kanafeh/', 'Middle East', 'pastry-kanafeh'],
  ['https://196flavors.com/morocco-cornes-de-gazelle-kab-al-gazal/', 'Morocco', 'pastry-cornes-de-gazelle'],
  ['https://196flavors.com/morocco-almond-cigars-cigares-aux-amandes/', 'Morocco', 'pastry-almond-cigars'],
  ['https://196flavors.com/saltena/', 'Bolivia', 'pastry-saltena'],
  ['https://196flavors.com/argentina-el-submarino/', 'Argentina', 'pastry-el-submarino'],
].map(([url, country, id]) => [url, country, id, '196 flavors', 'Pastry']);

// Caribbean fried-pie / dumpling pastries and more global hand pastries.
// These five publisher pages ALSO ship in js/caribbean-sources.js (same URLs);
// they are kept here because they classify as 'Pastry' (their names don't
// match the course name heuristic) and the app dedupes shelf rows by
// sourceUrl, so only one row renders either way.
// Verified to exist with schema.org Recipe data at time of addition.
const PASTRIES_EXT = [
  ['https://cookingwithria.com/2011/05/trini-fried-bake/', 'Trinidad and Tobago', 'pastry-trini-fried-bake', 'Cooking with Ria'],
  ['https://cookingwithria.com/2014/08/trinidad-aloo-potato-pie/', 'Trinidad and Tobago', 'pastry-trini-aloo-pie', 'Cooking with Ria'],
  ['https://cookingwithria.com/2026/08/cheesy-aloo-pie/', 'Trinidad and Tobago', 'pastry-cheesy-aloo-pie', 'Cooking with Ria'],
  ['https://cookingwithria.com/2021/10/delicious-empanadas/', 'Trinidad and Tobago', 'pastry-trinidad-empanadas', 'Cooking with Ria'],
  ['https://cookingwithria.com/2016/12/trinidad-pasteles/', 'Trinidad and Tobago', 'pastry-caribbean-pastelles', 'Cooking with Ria'],
  ['https://196flavors.com/empanada-gallega/', 'Spain', 'pastry-empanada-gallega', '196 flavors'],
  ['https://196flavors.com/cap-verde-pastels/', 'Cape Verde', 'pastry-cape-verde-pastels', '196 flavors'],
  ['https://196flavors.com/paraguay-pastel-mandio-empanada-de-mandioca/', 'Paraguay', 'pastry-pastel-mandio', '196 flavors'],
  ['https://196flavors.com/lebanon-fatayer/', 'Lebanon', 'pastry-fatayer', '196 flavors'],
  ['https://196flavors.com/bulgaria-banitsa/', 'Bulgaria', 'pastry-banitsa', '196 flavors'],
  ['https://196flavors.com/india-samosa/', 'India', 'pastry-samosa', '196 flavors'],
  ['https://196flavors.com/sambousek/', 'Middle East', 'pastry-sambousek', '196 flavors'],
  ['https://196flavors.com/tunisia-brick-a-loeuf-egg-brick/', 'Tunisia', 'pastry-tunisian-egg-brick', '196 flavors'],
  ['https://196flavors.com/armenia-sari-burma/', 'Armenia', 'pastry-sari-burma', '196 flavors'],
].map(([url, country, id, source]) => [url, country, id, source, 'Pastry']);

// Human-reviewed photo picks where the publisher's Recipe card uses a
// different shot than the page's featured photograph.
const IMAGE_OVERRIDES = new Map([
  ['https://cookingwithria.com/2026/08/cheesy-aloo-pie/', {
    image: 'https://cookingwithria.com/wp-content/uploads/2026/08/trinidad-cheesy-aloo-pies.webp',
    imageCredit: 'Cooking with Ria / CookingwithRia',
  }],
]);

// A hot chocolate is not a pastry; keep El Submarino (and any other beverage)
// out of the pastry manifest even if a source page mentions it.
const PASTRY = PASTRIES.filter(([, , id]) => id !== 'pastry-el-submarino').concat(PASTRIES_EXT);

async function build(list) {
  const records = [];
  const failures = [];
  for (const [url, country, id, source, type] of list) {
    try {
      const record = await publisherRecipe(url, country, id, source, type);
      const override = IMAGE_OVERRIDES.get(record.sourceUrl);
      if (override) { record.image = override.image; record.imageCredit = override.imageCredit; }
      records.push(record);
      console.log('ok', record.name);
    } catch (error) {
      failures.push(`${id} :: ${error.message}`);
      console.warn('skip', id, error.message);
    }
    await sleep(120);
  }
  return { records, failures };
}

async function main() {
  const drinks = await build(DRINKS);
  const pastries = await build(PASTRY);
  if (!drinks.records.length && !pastries.records.length) {
    throw new Error('No publisher data was read; nothing was written.');
  }
  const payload = {
    drinks: { source: '196 flavors', generatedAt: NOW, records: drinks.records, skipped: drinks.failures },
    pastries: { source: '196 flavors', generatedAt: NOW, records: pastries.records, skipped: pastries.failures },
  };
  fs.writeFileSync(
    path.join(ROOT, 'js', 'additions.js'),
    'window.MISE_DRINKS = ' + JSON.stringify(payload.drinks, null, 2) + ';\n' +
    'window.MISE_PASTRY = ' + JSON.stringify(payload.pastries, null, 2) + ';\n',
    'utf8',
  );
  console.log('\ndrinks:', drinks.records.length, 'skipped:', drinks.failures.length);
  console.log('pastries:', pastries.records.length, 'skipped:', pastries.failures.length);
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) main().catch((error) => {
  console.error(error);
  process.exit(1);
});
