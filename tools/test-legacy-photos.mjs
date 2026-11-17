import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { test } from 'node:test';

test('reviewed old recipes show publisher photos rather than unrelated Commons matches', () => {
  const context = vm.createContext({ window: {} });
  for (const file of ['legacy-photo-fixes.js', 'caribbean-sources.js', 'africa-sources.js']) {
    vm.runInContext(fs.readFileSync(new URL('../js/' + file, import.meta.url), 'utf8'), context);
  }
  const all = [...context.window.MISE_CARIBBEAN_SOURCES, ...context.window.MISE_AFRICA_SOURCES];
  const fixes = context.window.MISE_LEGACY_PHOTO_FIXES;
  for (const [sourceUrl, image] of Object.entries(fixes)) {
    const recipe = all.find(r => r.sourceUrl === sourceUrl);
    assert.ok(recipe, sourceUrl);
    assert.equal(recipe.image, image, recipe.name);
    assert.equal(Boolean(recipe.imageCredit), Boolean(image), recipe.name);
  }
  assert.equal(Object.keys(fixes).length, 429);
});
