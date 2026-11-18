import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs';
import vm from 'node:vm';

const context = vm.createContext({ window: {}, URL });
vm.runInContext(fs.readFileSync(new URL('../js/parse.js', import.meta.url), 'utf8'), context);
const P = context.window.MiseParse;

const FIXTURE = {
  '@type': 'Recipe',
  name: 'Grilled Lamb Kabobs',
  recipeIngredient: ['2 lbs lamb', '1 onion'],
  recipeInstructions: [{ '@type': 'HowToStep', text: 'Grill the lamb.' }],
  recipeYield: ['6'],
  nutrition: {
    '@type': 'NutritionInformation',
    calories: '283 kcal',
    proteinContent: '32 g',
    fatContent: '16 g',
    carbohydrateContent: '1 g',
    sodiumContent: '880 mg',
    servingSize: '1 serving',
  },
};

test('JSON-LD nutrition is captured verbatim, in publisher strings', () => {
  const raw = P.recipeFromJsonLd(FIXTURE, { url: 'https://example.com/lamb', sourceName: 'Example' });
  assert.equal(JSON.stringify(raw.nutrition), JSON.stringify({
    calories: '283 kcal',
    fat: '16 g',
    carbohydrate: '1 g',
    protein: '32 g',
    sodium: '880 mg',
    'serving size': '1 serving',
  }));
});

test('nutrition passes through buildRecipe unchanged', () => {
  const raw = P.recipeFromJsonLd(FIXTURE, { url: 'https://example.com/lamb', sourceName: 'Example' });
  const recipe = P.buildRecipe(raw, {});
  assert.equal(recipe.nutrition.calories, '283 kcal');
  assert.equal(recipe.nutrition.protein, '32 g');
});

test('a source without nutrition renders no nutrition panel', () => {
  const without = P.recipeFromJsonLd({ '@type': 'Recipe', name: 'Rice and Peas', recipeIngredient: ['rice'], recipeInstructions: ['Cook.'] }, { url: 'https://example.com/rice' });
  assert.equal(without.nutrition, null);
  const recipe = P.buildRecipe(without, {});
  assert.equal(recipe.nutrition, null);
});

test('partial nutrition keeps only the listed fields', () => {
  const raw = P.recipeFromJsonLd({ '@type': 'Recipe', name: 'Tea', recipeIngredient: ['tea'], recipeInstructions: ['Steep.'], nutrition: { calories: '2 kcal' } }, {});
  assert.equal(JSON.stringify(raw.nutrition), JSON.stringify({ calories: '2 kcal' }));
});

test('over-long publisher strings are truncated, not invented', () => {
  const raw = P.recipeFromJsonLd({ '@type': 'Recipe', name: 'Odd', recipeIngredient: ['x'], recipeInstructions: ['y'], nutrition: { calories: 'x'.repeat(200) } }, {});
  assert.equal(raw.nutrition.calories.length, 60);
});
