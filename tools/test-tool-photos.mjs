import assert from 'node:assert/strict';
import fs from 'node:fs';
import { test } from 'node:test';

test('misidentified cooking tools use line art instead of a false photograph', () => {
  const photos = JSON.parse(fs.readFileSync(new URL('./tool-images.json', import.meta.url), 'utf8'));
  const patch = fs.readFileSync(new URL('./patch-tool-images.mjs', import.meta.url), 'utf8');
  for (const key of ['dish', 'whisk', 'mortar', 'airfryer', 'instantpot', 'spoon', 'board']) {
    assert.equal(photos[key], undefined, key);
    assert.ok(patch.includes(`'${key}'`), `${key} must remain removed after regeneration`);
  }
});
