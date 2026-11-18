import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { test } from 'node:test';

const app = fs.readFileSync(new URL('../js/app.js', import.meta.url), 'utf8');
const kitchenStore = fs.readFileSync(new URL('../js/kitchen-store.js', import.meta.url), 'utf8');
function kitchen(writeOK = true) {
  const ctx = vm.createContext({ writeOK });
  vm.runInContext(`
    const KEY = { importedV2: 'imports', last: 'last' };
    let imported = Array.from({length: 800}, (_, i) => ({id: 'old-'+i, sourceUrl: 'https://example.com/'+i}));
    let importedDirty = false, chefCatalogCache = null;
    let durable = imported.slice(), messages = [];
    const rawFromRecipe = r => r;
    const store = {
      get(k, fb) { return fb; },
      set(k, v) {
        if (!writeOK) return false;
        if (k === 'mise.imported.v3') durable = v.records.slice();
        return true;
      },
      remove() {},
    };
    const uniqueId = id => id;
    const announce = msg => messages.push(msg);
    ${kitchenStore}
    window = globalThis;
    ${app.slice(app.indexOf('  function persistImported('), app.indexOf('  function knownImported('))}
    globalThis.api = { saveImported, flushImported, state: () => ({ imported, durable, messages }) };
  `, ctx);
  return ctx.api;
}

test('saving recipe 801 preserves the oldest saved recipe', () => {
  const api = kitchen();
  api.saveImported({ id: 'new', sourceUrl: 'https://example.com/new' });
  assert.equal(api.state().durable.length, 801);
  assert.ok(api.state().durable.some(r => r.id === 'old-799'));
});

test('failed storage write leaves both kitchen and durable records intact', () => {
  const api = kitchen(false);
  assert.equal(api.saveImported({ id: 'new', sourceUrl: 'https://example.com/new' }), null);
  assert.equal(api.state().imported.length, 800);
  assert.equal(api.state().durable.length, 800);
});

test('failed bulk flush restores the pre-batch kitchen', () => {
  const api = kitchen(false);
  api.saveImported({ id: 'new', sourceUrl: 'https://example.com/new' }, { flush: false });
  assert.equal(api.flushImported('new'), false);
  assert.equal(api.state().imported.length, 800);
});

function facets() {
  const context = vm.createContext({});
  const start = app.indexOf('  function drinkFacets(');
  const end = app.indexOf('  function sourceRecordFor(', start);
  vm.runInContext((start < 0 ? '' : app.slice(start, end)) + '\nglobalThis.api = { drinkFacets, matchesDrinkFacets };', context);
  return context.api;
}
test('drink filters preserve unknown alcohol status and multiple base spirits', () => {
  const { drinkFacets } = facets();
  assert.equal(drinkFacets({ name: 'Fruit punch' }).alcohol, 'unknown');
  assert.equal(drinkFacets({ alcoholic: 'Non alcoholic', ingredients: ['1 oz rum extract'] }).alcohol, 'non-alcoholic');
  const mixed = drinkFacets({ alcoholic: 'Alcoholic', ingredients: ['1 oz rum', '1 oz gin'] });
  assert.deepEqual(Array.from(mixed.spirits), ['rum', 'gin']);
});
test('drink facets intersect and clear independently', () => {
  const { drinkFacets, matchesDrinkFacets } = facets();
  const item = drinkFacets({ name: 'Christmas rum punch', alcoholic: 'Alcoholic', ingredients: ['rum'] });
  assert.equal(matchesDrinkFacets(item, { alcohol: 'alcoholic', spirit: 'rum', occasion: 'festive' }), true);
  assert.equal(matchesDrinkFacets(item, { alcohol: 'non-alcoholic', spirit: 'all', occasion: 'all' }), false);
});

test('all acquired records parse to usable recipes with unique source identities', () => {
  const context = vm.createContext({ window: {}, URL });
  for (const file of ['parse.js', 'expansion.js']) {
    vm.runInContext(fs.readFileSync(new URL('../js/' + file, import.meta.url), 'utf8'), context);
  }
  const pack = context.window.MISE_EXPANSION;
  const P = context.window.MiseParse;
  assert.ok(pack.drinks.length >= 100);
  assert.ok(pack.caribbean.length >= 50);
  assert.ok(pack.meals.length >= 140);
  const seen = new Set();
  for (const record of [...pack.drinks, ...pack.caribbean]) {
    assert.ok(!seen.has(record.sourceUrl), 'Duplicate ' + record.sourceUrl);
    seen.add(record.sourceUrl);
    const raw = P.recipeFromJsonLd({
      name: record.name, recipeIngredient: record.ingredients, recipeInstructions: record.instructions,
      recipeYield: record.yields, recipeCategory: record.type,
    }, { id: record.id, url: record.sourceUrl, sourceName: record.source });
    const recipe = P.buildRecipe(raw);
    assert.ok(recipe.ingredients.length && recipe.steps.length, record.name);
    if (record.source === 'TheCocktailDB') assert.equal(recipe.yields, null);
  }
  for (const meal of pack.meals) {
    const recipe = P.recipeFromMealDB(meal);
    assert.ok(recipe.ingredients.length && recipe.steps.length, meal.strMeal);
  }
});
