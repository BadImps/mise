import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs';
import vm from 'node:vm';

const app = fs.readFileSync(new URL('../js/app.js', import.meta.url), 'utf8');
const start = app.indexOf('  function nutritionPanel(');
const end = app.indexOf('  function structureCard(', start);
assert.ok(start > 0 && end > start, 'nutritionPanel found');

const context = vm.createContext({ window: {} });
vm.runInContext(
  'const esc = (s) => String(s == null ? "" : s).replace(/[&<>"\']/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;","\\"":"&quot;","\'":"&#39;"}[c]));'
  + app.slice(start, end)
  + '\nglobalThis.api = { nutritionPanel };',
  context,
);

test('the nutrition panel renders the publisher\'s figures, labelled as published', () => {
  const html = context.api.nutritionPanel({ source: 'Example', nutrition: { calories: '283 kcal', protein: '32 g' } });
  assert.match(html, /Nutrition/);
  assert.match(html, /as published by Example/);
  assert.match(html, /283 kcal/);
  assert.match(html, /32 g/);
  assert.match(html, /Not estimated/);
});

test('a record without nutrition renders nothing at all', () => {
  assert.equal(context.api.nutritionPanel({ source: 'Example', nutrition: null }), '');
  assert.equal(context.api.nutritionPanel({ source: 'Example' }), '');
  assert.equal(context.api.nutritionPanel({ source: 'Example', nutrition: {} }), '');
});
