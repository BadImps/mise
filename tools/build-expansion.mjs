/* Bounded acquisition pass. Official API endpoints and publisher Recipe cards.
   Existing catalogues are never overwritten. Re-run with node tools/build-expansion.mjs.
   HTTP responses are cached outside the shipped assets to make interrupted runs resumable. */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import crypto from 'node:crypto';
import { publisherRecipe } from './build-additions.mjs';

const root = path.resolve(import.meta.dirname, '..');
const cache = path.join(root, '.recipe-cache');
fs.mkdirSync(cache, { recursive: true });
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
async function get(url, json = true) {
  const file = path.join(cache, crypto.createHash('sha256').update(url).digest('hex'));
  if (fs.existsSync(file)) return json ? JSON.parse(fs.readFileSync(file, 'utf8')) : fs.readFileSync(file, 'utf8');
  await delay(350);
  const res = await fetch(url, { signal: AbortSignal.timeout(30000), headers: { 'user-agent': 'Mise personal recipe research (https://github.com/BadImps/mise)' } });
  if (!res.ok) throw new Error(`${res.status}: ${url}`);
  const text = await res.text();
  if (json) JSON.parse(text);
  fs.writeFileSync(file, text);
  return json ? JSON.parse(text) : text;
}

const ctx = { window: {} };
vm.createContext(ctx);
for (const file of ['caribbean.js', 'caribbean-sources.js', 'africa.js', 'africa-sources.js', 'global.js', 'additions.js', 'data.js']) {
  vm.runInContext(fs.readFileSync(path.join(root, 'js', file), 'utf8'), ctx);
}
const w = ctx.window;
const existingMeals = [...w.MISE_CARIBBEAN.meals, ...w.MISE_AFRICA.meals, ...w.MISE_GLOBAL.records];
const existingSources = [...w.MISE_CARIBBEAN_SOURCES, ...w.MISE_AFRICA_SOURCES, ...w.MISE_DRINKS.records, ...w.MISE_PASTRY.records];
const canonical = url => String(url || '').replace('://www.', '://').replace(/\/$/, '').split('#')[0];
const seenUrls = new Set(existingSources.map(r => canonical(r.sourceUrl)));
const seenMeals = new Set(existingMeals.map(r => r.idMeal));
const report = { retrievedAt: new Date().toISOString(), skipped: [], countries: {}, queries: [] };
const drinks = [], caribbean = [], meals = [];
const clean = value => String(value || '').trim();
const drinkIds = new Set();
// Specific families, not a database mirror. Alcohol-free and seasonal families first.
const drinkQueries = ['lemonade', 'punch', 'smoothie', 'lassi', 'shake', 'coffee', 'tea', 'chocolate', 'eggnog', 'mulled', 'cider',
  'mojito', 'margarita', 'daiquiri', 'colada', 'mai tai', 'rum', 'dark and stormy', 'cuba libre',
  'martini', 'negroni', 'old fashioned', 'manhattan', 'sour', 'mule', 'spritz', 'sangria', 'collins',
  'gin tonic', 'paloma', 'bellini', 'mimosa', 'bloody mary', 'cosmopolitan', 'sidecar', 'caipirinha'];
for (const query of drinkQueries) {
  const url = 'https://www.thecocktaildb.com/api/json/v1/1/search.php?s=' + encodeURIComponent(query);
  report.queries.push(url);
  const data = await get(url);
  // Keep a small, balanced selection from each family.
  for (const d of (data.drinks || []).slice(0, 5)) {
    if (drinkIds.has(d.idDrink)) continue;
    const ingredients = [];
    for (let i = 1; i <= 15; i++) if (clean(d['strIngredient' + i])) {
      ingredients.push([clean(d['strMeasure' + i]), clean(d['strIngredient' + i])].filter(Boolean).join(' '));
    }
    if (!clean(d.strInstructions) || !ingredients.length) { report.skipped.push(d.strDrink); continue; }
    if (!/^https:\/\/www\.thecocktaildb\.com\/images\/media\/drink\/[^?#]+\.(?:jpe?g|png|webp)$/i.test(clean(d.strDrinkThumb))) {
      throw new Error(`Missing official photograph for ${d.strDrink} (${d.idDrink})`);
    }
    drinkIds.add(d.idDrink);
    drinks.push({
      id: 'cocktaildb-' + d.idDrink, name: d.strDrink, country: '', source: 'TheCocktailDB',
      sourceUrl: 'https://www.thecocktaildb.com/drink/' + d.idDrink,
      ingredients, instructions: [{ '@type': 'HowToStep', text: d.strInstructions }],
      yields: null, type: 'Drinks', category: d.strCategory,
      alcoholic: d.strAlcoholic || 'Unknown', glass: d.strGlass || '',
      tags: (d.strTags || '').split(',').filter(Boolean),
      // Hot-link the exact recipe's thumbnail from the official API. Do not
      // bundle third-party bytes; offline display falls back to Mise's plate.
      image: d.strDrinkThumb,
      imageCredit: d.strImageAttribution ? `${d.strImageAttribution} / TheCocktailDB` : 'TheCocktailDB',
      imageSourceUrl: 'https://www.thecocktaildb.com/drink/' + d.idDrink,
      imageSource: d.strImageSource || '', imageAttribution: d.strImageAttribution || '',
      creativeCommonsConfirmed: d.strCreativeCommonsConfirmed || '',
    });
  }
}

// Country archives provide actual discovered URLs (no guessed recipe slugs).
const countries = [
  ['haiti', 'Haiti'], ['barbados', 'Barbados'], ['dominican-republic', 'Dominican Republic'],
  ['puerto-rico', 'Puerto Rico'], ['cuba', 'Cuba'], ['bahamas', 'Bahamas'],
  ['grenada', 'Grenada'], ['saint-lucia', 'Saint Lucia'], ['antigua-and-barbuda', 'Antigua and Barbuda'],
  ['saint-kitts-and-nevis', 'Saint Kitts and Nevis'], ['dominica', 'Dominica'],
  ['jamaica', 'Jamaica'], ['trinidad-and-tobago', 'Trinidad and Tobago'],
];
for (const [slug, country] of countries) {
  let added = 0;
  for (let page = 1; page <= 3; page++) {
    const archive = `https://www.196flavors.com/category/continent/americas/caribbean/${slug}/${page === 1 ? '' : 'page/' + page + '/'}`;
    let html;
    try { html = await get(archive, false); } catch (e) { report.skipped.push(e.message); break; }
    const main = html.split('<main')[1]?.split('</main>')[0] || '';
    const urls = [...main.matchAll(/class="entry-title-link"[^>]*href="([^"]+)"|href="([^"]+)"[^>]*class="entry-title-link"/g)].map(m => m[1] || m[2]);
    if (!urls.length) { report.skipped.push('No article links: ' + archive); break; }
    for (const url of urls) {
      if (seenUrls.has(canonical(url))) continue;
      const id = 'island-' + new URL(url).pathname.split('/').filter(Boolean).pop();
      try {
        const file = path.join(cache, id + '.json');
        let record;
        if (fs.existsSync(file)) record = JSON.parse(fs.readFileSync(file, 'utf8'));
        else {
          await delay(350);
          record = await publisherRecipe(url, country, id, '196 flavors', '');
          fs.writeFileSync(file, JSON.stringify(record));
        }
        if (seenUrls.has(canonical(record.sourceUrl))) continue;
        seenUrls.add(canonical(url));
        seenUrls.add(canonical(record.sourceUrl));
        caribbean.push(record);
        added++;
      } catch (e) { report.skipped.push(id + ': ' + e.message); }
    }
    if (!html.includes(`/page/${page + 1}/`)) break;
  }
  report.countries[country] = added;
  console.log(country, added);
}

// Balanced everyday meal expansion; source API gives full records by name.
for (const query of ['chicken', 'fish', 'lentil', 'chickpea', 'vegetable', 'rice', 'pasta', 'soup', 'salad', 'egg', 'tart', 'pie', 'bread', 'curry', 'tofu', 'bean', 'potato']) {
  const url = 'https://www.themealdb.com/api/json/v1/1/search.php?s=' + encodeURIComponent(query);
  report.queries.push(url);
  const data = await get(url);
  let added = 0;
  for (const m of data.meals || []) {
    if (seenMeals.has(m.idMeal) || !clean(m.strInstructions) || !clean(m.strIngredient1)) continue;
    meals.push(m);
    seenMeals.add(m.idMeal);
    if (++added >= 12) break;
  }
}
if (drinks.length < 60 || caribbean.length < 30 || meals.length < 80) {
  throw new Error(`Incomplete acquisition: ${drinks.length} drinks, ${caribbean.length} Caribbean, ${meals.length} meals. Existing bundle untouched.`);
}
const result = { drinks, caribbean, meals };
fs.writeFileSync(path.join(root, 'js', 'expansion.js'), 'window.MISE_EXPANSION = ' + JSON.stringify(result, null, 2) + ';\n');
report.counts = { drinks: drinks.length, caribbean: caribbean.length, meals: meals.length };
fs.writeFileSync(path.join(root, 'docs', 'recipe-acquisition-report.json'), JSON.stringify(report, null, 2) + '\n');
console.log(report.counts);
