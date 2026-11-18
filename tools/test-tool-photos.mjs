import assert from 'node:assert/strict';
import fs from 'node:fs';
import { test } from 'node:test';

test('misidentified cooking tools keep correct photographs', () => {
  const photos = JSON.parse(fs.readFileSync(new URL('./tool-images.json', import.meta.url), 'utf8'));
  const patch = fs.readFileSync(new URL('./patch-tool-images.mjs', import.meta.url), 'utf8');
  for (const key of ['dish', 'mortar', 'airfryer', 'instantpot', 'spoon', 'board']) {
    assert.equal(photos[key], undefined, key);
    assert.ok(patch.includes(`'${key}'`), `${key} must remain removed after regeneration`);
  }
  assert.match(photos.whisk.image, /Whisk_%28IMG_0265%29/);
  assert.match(photos.fryingPan.image, /Frying_Pan_2_2019-03-21/);
  assert.match(patch, /whisk:/);
  assert.match(patch, /fryingPan:/);
});
