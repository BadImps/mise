/* Mise / collection builder.
   Reads public recipe records and writes the bundled data files:
     js/global.js            curated TheMealDB world set
     js/africa.js            every TheMealDB meal in its African areas
     js/africa-sources.js    publisher recipes for African cuisines TheMealDB lacks
     js/caribbean-sources.js existing publisher records + new Caribbean records

   Nothing here writes a recipe. Every field comes from the publisher's own
   schema.org Recipe data or TheMealDB's public API. Run from the project root:

     node tools/build-collections.mjs
*/
import fs from 'node:fs';
import path from 'node:path';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';
const ROOT = path.resolve(import.meta.dirname, '..');
const TMD = 'https://www.themealdb.com/api/json/v1/1/';
const NOW = new Date().toISOString();
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

const clean = (value) => decodeEntities(value)
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

function decodeMeal(meal) {
  const out = { ...meal };
  for (const key of Object.keys(out)) {
    if (key === 'strMeal' || key === 'strInstructions' || key === 'strTags' || key.startsWith('strIngredient') || key.startsWith('strMeasure') || key === 'strArea' || key === 'strCategory') {
      if (typeof out[key] === 'string') out[key] = decodeEntities(out[key]).replace(/\u00a0/g, ' ');
    }
  }
  return out;
}

function cleanSourceRecord(record) {
  return {
    ...record,
    name: clean(record.name),
    country: clean(record.country),
    source: clean(record.source),
    sourceUrl: clean(record.sourceUrl),
    author: clean(record.author),
    ingredients: record.ingredients.map(clean),
    instructions: record.instructions.map((step) => ({ '@type': 'HowToStep', text: clean(step.text) })),
  };
}

const slug = (value) => clean(value).toLowerCase()
  .replace(/['\u2019]/g, '')
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')
  .slice(0, 60);

/* ---------- HTTP ---------- */
async function get(url, asJson) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url, { headers: { 'user-agent': UA, accept: asJson ? 'application/json' : 'text/html' }, redirect: 'follow' });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return asJson ? await res.json() : await res.text();
    } catch (error) {
      if (attempt === 2) throw new Error(url + ' :: ' + error.message);
      await sleep(400 * (attempt + 1));
    }
  }
}

/* ---------- schema.org recipe ---------- */
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
  return list.map((author) => (typeof author === 'string' ? author : author && author.name)).filter(Boolean).map(clean).join(', ');
}

function yieldOf(node) {
  const raw = [].concat(node.recipeYield || [])[0];
  const value = parseInt(String(raw || '').replace(/[^0-9]/g, ''), 10);
  return Number.isFinite(value) && value > 0 ? value : null;
}

async function publisherRecipe(url, country, id, source) {
  const html = await get(url, false);
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
  };
}

/* ---------- TheMealDB ---------- */
const tmdCache = new Map();

async function areaMeals(area) {
  const data = await get(TMD + 'filter.php?a=' + encodeURIComponent(area), true);
  return Array.isArray(data.meals) ? data.meals : [];
}

async function fullMeal(id) {
  if (tmdCache.has(id)) return tmdCache.get(id);
  await sleep(45);
  const data = await get(TMD + 'lookup.php?i=' + encodeURIComponent(id), true);
  const meal = Array.isArray(data.meals) ? data.meals[0] : null;
  if (!meal) throw new Error('TheMealDB returned no record for ' + id);
  const decoded = decodeMeal(meal);
  tmdCache.set(id, decoded);
  return decoded;
}

function censusOf(areas, counts) {
  return areas
    .map((area) => [area, counts[area] || 0])
    .filter(([, count]) => count > 0)
    .sort((a, b) => b[1] - a[1]);
}

/* ---------- world selection ----------
   A dish is kept when its name is one a reader is likely to recognise outside
   its home country. This is a recognition sample, not a popularity ranking. */
const WORLD = {
  British: ['52803', '52896', '52824', '53097', '52883', '52822', '52791', '52767', '52893', '52884'],
  Spanish: ['53151', '53144', '53172', '52872', '53153', '53148', '53173', '53178'],
  Turkish: ['53262', '53279', '53269', '53266', '53256', '53254', '52978', '53263'],
  Chinese: ['52945', '52949', '52947', '52951', '52954', '52955', '52948', '52952', '53367', '52953'],
  Polish: ['53019', '53018', '53021', '53020', '53298'],
  Thai: ['53191', '52827', '52814', '53194', '52774', '53207', '53192'],
  Vietnamese: ['53238', '52828', '52997', '53232', '53235', '53233'],
  Canadian: ['52804', '52927', '52924', '52923', '52926'],
  Italian: ['52844', '52982', '52770', '53064', '52810', '53014', '52811', '52823'],
  Australian: ['53104', '53111', '53099', '53103'],
  'Saudi Arabian': ['53218', '53220', '53216', '53223'],
  Japanese: ['52831', '53034', '52820', '53065', '53032', '52871'],
  Uruguayan: ['53317', '53319', '53320', '53322'],
  Croatian: ['53060', '53055', '53056', '53057'],
  Filipino: ['53071', '53070', '53068', '53069', '53075'],
  Greek: ['53006', '52764', '53012', '53009', '53008'],
  Irish: ['52781', '52998', '53036', '53035'],
  Malaysian: ['53053', '53051', '52821', '53048', '53050'],
  Portuguese: ['53039', '53046', '53045', '53042'],
  Russian: ['52834', '53080', '53077', '53081'],
  Ukrainian: ['53078', '53313', '53314', '53315'],
  Mexican: ['52826', '52819', '52765', '52870', '52830', '53067'],
  Syrian: ['53094', '53091', '53095', '53092'],
};

const AFRICA_AREAS = ['Algerian', 'Egyptian', 'Kenyan', 'Moroccan', 'Tunisian'];

/* ---------- publisher manifests ---------- */
const AFRICA_SOURCES = [
  ['https://cheflolaskitchen.com/jollof-rice/', 'Nigeria', "Chef Lola's Kitchen"],
  ['https://cheflolaskitchen.com/doro-wat-ethiopian-chicken-stew/', 'Ethiopia', "Chef Lola's Kitchen"],
  ['https://cheflolaskitchen.com/suya/', 'Nigeria', "Chef Lola's Kitchen"],
  ['https://cheflolaskitchen.com/egusi-soup-recipe/', 'Nigeria', "Chef Lola's Kitchen"],
  ['https://cheflolaskitchen.com/african-puff-puff/', 'Nigeria', "Chef Lola's Kitchen"],
  ['https://cheflolaskitchen.com/injera/', 'Ethiopia', "Chef Lola's Kitchen"],
  ['https://cheflolaskitchen.com/make-moin-moin-moi-moi/', 'Nigeria', "Chef Lola's Kitchen"],
  ['https://cheflolaskitchen.com/easy-kelewele-spicy-fried-plantains/', 'Ghana', "Chef Lola's Kitchen"],
  ['https://cheflolaskitchen.com/nyama-choma/', 'Kenya', "Chef Lola's Kitchen"],
  ['https://cheflolaskitchen.com/sweet-fried-bread-mandazi-mahamri/', 'Kenya', "Chef Lola's Kitchen"],
  ['https://cheflolaskitchen.com/east-african-chapati/', 'Kenya', "Chef Lola's Kitchen"],
  ['https://cheflolaskitchen.com/african-pepper-soup/', 'Nigeria', "Chef Lola's Kitchen"],
  ['https://cheflolaskitchen.com/efo-riro-spinach-stew/', 'Nigeria', "Chef Lola's Kitchen"],
  ['https://www.bbcgoodfood.com/recipes/bunny-chow', 'South Africa', 'BBC Good Food'],
  ['https://www.196flavors.com/bobotie/', 'South Africa', '196 Flavors'],
  ['https://www.196flavors.com/waakye/', 'Ghana', '196 Flavors'],
];

const CARIBBEAN_SOURCES = [
  ['https://thatgirlcookshealthy.com/ackee-and-saltfish/', 'Jamaica', 'That Girl Cooks Healthy'],
  ['https://thatgirlcookshealthy.com/jamaican-oxtail-stew/', 'Jamaica', 'That Girl Cooks Healthy'],
  ['https://thatgirlcookshealthy.com/jamaican-curry-goat/', 'Jamaica', 'That Girl Cooks Healthy'],
  ['https://www.bbcgoodfood.com/recipes/rice-and-peas', 'Jamaica', 'BBC Good Food'],
  ['https://thatgirlcookshealthy.com/jamaican-callaloo/', 'Jamaica', 'That Girl Cooks Healthy'],
  ['https://thatgirlcookshealthy.com/saltfish-and-callaloo/', 'Jamaica', 'That Girl Cooks Healthy'],
  ['https://thatgirlcookshealthy.com/trinidad-macaroni-pie/', 'Trinidad & Tobago', 'That Girl Cooks Healthy'],
  ['https://thatgirlcookshealthy.com/jamaican-black-cake/', 'Jamaica', 'That Girl Cooks Healthy'],
  ['https://www.196flavors.com/trinidad-and-tobago-black-cake/', 'Trinidad & Tobago', '196 Flavors'],
  ['https://thatgirlcookshealthy.com/cuban-style-picadillo/', 'Cuba', 'That Girl Cooks Healthy'],
  ['https://thatgirlcookshealthy.com/yuca-con-mojo-cuban-style/', 'Cuba', 'That Girl Cooks Healthy'],
  ['https://thatgirlcookshealthy.com/vegan-mofongo/', 'Puerto Rico', 'That Girl Cooks Healthy'],
  ['https://www.196flavors.com/haiti-soup-joumou/', 'Haiti', '196 Flavors'],
  ['https://www.196flavors.com/grenada-oil-down/', 'Grenada', '196 Flavors'],
  ['https://www.196flavors.com/suriname-pom/', 'Suriname', '196 Flavors'],
  ['https://www.196flavors.com/belize-johnny-cake/', 'Belize', '196 Flavors'],
  ['https://www.196flavors.com/barbados-salt-fish-cakes-and-sauce-marie-rose/', 'Barbados', '196 Flavors'],
  ['https://www.196flavors.com/dominican-republic-locrio-pica-pica/', 'Dominican Republic', '196 Flavors'],
  ['https://www.196flavors.com/guyana-sawine-vermicelli-cake/', 'Guyana', '196 Flavors'],
  ['https://www.196flavors.com/pernil-asado/', 'Puerto Rico', '196 Flavors'],
  ['https://www.196flavors.com/pelau/', 'Grenada', '196 Flavors'],
  ['https://www.196flavors.com/jamaican-patty/', 'Jamaica', '196 Flavors'],
  ['https://www.bbcgoodfood.com/recipes/jerk-chicken', 'Jamaica', 'BBC Good Food'],
];

/* ---------- writers ---------- */
/* ---------- build ---------- */
async function buildWorld() {
  const areas = Object.keys(WORLD);
  const counts = {};
  const records = [];
  for (const area of areas) {
    const meals = await areaMeals(area);
    counts[area] = meals.length;
    const available = new Map(meals.map((meal) => [String(meal.idMeal), meal]));
    for (const id of WORLD[area]) {
      if (!available.has(id)) throw new Error('TheMealDB no longer lists ' + id + ' under ' + area);
      records.push(await fullMeal(id));
    }
  }
  // The census is every area the audit saw, not only the picked ones.
  const allAreas = await get(TMD + 'list.php?a=list', true);
  const census = [];
  for (const entry of allAreas.meals || []) {
    const area = entry.strArea;
    const meals = await areaMeals(area);
    if (meals.length) census.push([area, meals.length]);
  }
  census.sort((a, b) => b[1] - a[1]);
  return {
    source: 'TheMealDB',
    generatedAt: NOW,
    note: 'A recognition-led cross-section of dishes the public source holds, not a ranking and not a complete map of world cooking. African and Caribbean deep dives sit in their own collections.',
    census,
    records,
  };
}

async function buildAfrica() {
  const areas = AFRICA_AREAS;
  const counts = {};
  const meals = [];
  for (const area of areas) {
    const list = await areaMeals(area);
    counts[area] = list.length;
    for (const meal of list) meals.push(await fullMeal(meal.idMeal));
  }
  return {
    source: 'TheMealDB',
    fetchedAt: NOW,
    note: 'Every meal TheMealDB returns for its five African area labels. The source has no Nigerian, Ghanaian, Ethiopian or South African area results, so those cuisines are represented by publisher records instead.',
    areas: areas.map((area) => ({ area, count: counts[area] })),
    queriedAreas: areas,
    total: meals.length,
    meals,
  };
}

async function buildPublisher(manifest, prefix) {
  const out = [];
  for (const [url, country, source] of manifest) {
    try {
      const tmpId = prefix + '-' + slug(country);
      const recipe = await publisherRecipe(url, country, tmpId, source);
      recipe.id = prefix + '-' + slug(country) + '-' + slug(recipe.name);
      out.push(cleanSourceRecord(recipe));
      console.log('  ' + country + ' · ' + recipe.name);
    } catch (error) {
      console.log('  SKIP ' + url + ' :: ' + error.message);
    }
  }
  return out;
}

/* ---------- main ---------- */
function wrapGlobal(file, globalName, value, header) {
  fs.writeFileSync(path.join(ROOT, file), '/* ' + header + ' */\nwindow.' + globalName + ' = ' + JSON.stringify(value, null, 2) + ';\n', 'utf8');
  console.log('wrote', file, (fs.statSync(path.join(ROOT, file)).size / 1024).toFixed(0) + ' KB');
}

console.log('TheMealDB world…');
const world = await buildWorld();
wrapGlobal('js/global.js', 'MISE_GLOBAL', world, 'Curated global set cached from TheMealDB (https://www.themealdb.com). Retained meal ids link every record back to its source.');

console.log('TheMealDB Africa…');
const africa = await buildAfrica();
wrapGlobal('js/africa.js', 'MISE_AFRICA', africa, 'Every TheMealDB meal in its five African area labels, cached from https://www.themealdb.com. Retained meal ids link every record back to its source.');

console.log('African publisher recipes…');
const africaSources = await buildPublisher(AFRICA_SOURCES, 'africa');
wrapGlobal('js/africa-sources.js', 'MISE_AFRICA_SOURCES', africaSources, 'African recipes read from publisher schema.org Recipe data. Each record links to its publisher page.');

console.log('Caribbean publisher recipes…');
const caribbeanPath = path.join(ROOT, 'js/caribbean-sources.js');
const existingCaribbean = JSON.parse(fs.readFileSync(caribbeanPath, 'utf8').match(/=\s*(\[[\s\S]*\]);\s*$/)[1]).map(cleanSourceRecord);
const newCaribbean = await buildPublisher(CARIBBEAN_SOURCES, 'carib');
const seen = new Set(existingCaribbean.map((record) => record.sourceUrl));
const merged = existingCaribbean.concat(newCaribbean.filter((record) => !seen.has(record.sourceUrl)));
wrapGlobal('js/caribbean-sources.js', 'MISE_CARIBBEAN_SOURCES', merged, 'Caribbean recipes read from publisher schema.org Recipe data. Each record links to its publisher page.');

console.log('\nsummary');
console.log('  world   ', world.records.length, 'records ·', world.census.length, 'areas with meals');
console.log('  africa  ', africa.total, 'TheMealDB records +', africaSources.length, 'publisher recipes');
console.log('  caribbean', merged.length, 'publisher recipes');
