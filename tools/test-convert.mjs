import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs';
import vm from 'node:vm';

const context = vm.createContext({ window: {} });
vm.runInContext(fs.readFileSync(new URL('../js/convert.js', import.meta.url), 'utf8'), context);
const { conversion } = context.window.MISE_CONVERT;

test('tsp and tbsp convert to exact ml', () => {
  assert.equal(conversion(2, 'tsp', 'salt'), '(10 ml)');
  assert.equal(conversion(1, 'tbsp', 'olive oil'), '(15 ml)');
  assert.equal(conversion(0.5, 'tsp', 'pepper'), '(2.5 ml)');
});

test('cup flour converts to ml and staple grams', () => {
  assert.equal(conversion(1, 'cup', 'flour'), '(237 ml · 120 g)');
  assert.equal(conversion(1, 'cup', 'whole wheat flour'), '(237 ml · 120 g)');
  assert.equal(conversion(1, 'cup', 'caster sugar'), '(237 ml · 200 g)'); // caster → granulated family
  assert.equal(conversion(1, 'cup', 'light brown sugar'), '(237 ml · 220 g)');
  assert.equal(conversion(1, 'cup', 'butter'), '(237 ml · 227 g)');
});

test('unknown cup amounts get ml only, never invented grams', () => {
  assert.equal(conversion(1, 'cup', 'green beans, chopped'), '(237 ml)');
  assert.equal(conversion(2, 'cup', 'unknown powder'), '(473 ml)');
});

test('ml and litres convert back to ml/tbsp', () => {
  assert.equal(conversion(30, 'ml', 'water'), '(2 tbsp)');
  assert.equal(conversion(1, 'l', 'water'), '(1000 ml)');
});

test('unusable amounts render nothing', () => {
  assert.equal(conversion(0, 'tsp', 'salt'), '');
  assert.equal(conversion(NaN, 'cup', 'flour'), '');
  assert.equal(conversion(2, '', 'flour'), '');
});
