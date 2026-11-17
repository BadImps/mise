import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { test } from 'node:test';

function load(file) {
  const context = vm.createContext({ window: {} });
  vm.runInContext(fs.readFileSync(new URL('../js/' + file, import.meta.url), 'utf8'), context);
  return context.window;
}

test('every expansion record has a source photograph of that exact recipe', () => {
  const { MISE_EXPANSION: expansion } = load('expansion.js');
  for (const record of [...expansion.drinks, ...expansion.caribbean, ...expansion.meals]) {
    const photo = record.image || record.strMealThumb;
    assert.match(photo || '', /^https:\/\//, `${record.name || record.strMeal} has no source photo`);
  }
});

test('cocktail images have a stable source, attribution, and licence review status', () => {
  const { MISE_EXPANSION: expansion } = load('expansion.js');
  for (const drink of expansion.drinks) {
    assert.equal(drink.imageSourceUrl, drink.sourceUrl);
    assert.ok(drink.imageCredit, `${drink.name} photo lacks credit`);
    assert.ok(['Yes', 'No'].includes(drink.creativeCommonsConfirmed));
  }
});
