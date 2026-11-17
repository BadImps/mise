import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { test } from 'node:test';

const SOURCE_URL = 'https://caribbeanpot.com/traditional-caribbean-pineapple-juice-2/';
const PHOTO_URL = 'https://caribbeanpot.com/wp-content/uploads/2018/05/pineapple-juice-8.jpg';

test('pineapple juice uses its publisher’s photograph, not a house', () => {
  const context = vm.createContext({ window: {} });
  vm.runInContext(fs.readFileSync(new URL('../js/caribbean-sources.js', import.meta.url), 'utf8'), context);
  const recipe = context.window.MISE_CARIBBEAN_SOURCES.find(r => r.sourceUrl === SOURCE_URL);
  assert.ok(recipe);
  assert.equal(recipe.image, PHOTO_URL);
  assert.match(recipe.imageCredit, /CaribbeanPot\.com/);
});

test('an existing saved copy with the old house photo displays the corrected image', () => {
  const app = fs.readFileSync(new URL('../js/app.js', import.meta.url), 'utf8');
  const start = app.indexOf('  function correctedRecipePhoto(');
  const end = app.indexOf('  imported.forEach(correctedRecipePhoto);', start);
  const context = vm.createContext({ window: {} });
  vm.runInContext((start < 0 ? '' : app.slice(start, end)) + '\nglobalThis.correctedRecipePhoto = correctedRecipePhoto;', context);
  const saved = {
    sourceUrl: SOURCE_URL,
    image: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/8/87/Traditional_Caribbean_home_architecture_with_tropical_surrounding_foliage.jpg/960px-Traditional_Caribbean_home_architecture_with_tropical_surrounding_foliage.jpg',
    imageCredit: 'Oleg Yunakov (CC BY-SA 4.0) via Wikimedia Commons',
  };
  context.correctedRecipePhoto(saved);
  assert.equal(saved.image, PHOTO_URL);
  assert.match(saved.imageCredit, /CaribbeanPot\.com/);
});

test('the image builder pins the reviewed photograph on regeneration', () => {
  const builder = fs.readFileSync(new URL('./build-images.mjs', import.meta.url), 'utf8');
  assert.ok(builder.includes(SOURCE_URL));
  assert.ok(builder.includes(PHOTO_URL));
});
