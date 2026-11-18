import assert from 'node:assert/strict';
import { test } from 'node:test';
import vm from 'node:vm';
import fs from 'node:fs';

function freshStore() {
  const map = new Map();
  return {
    get(key, fallback) { return map.has(key) ? JSON.parse(map.get(key)) : fallback; },
    set(key, value) { map.set(key, JSON.stringify(value)); return true; },
    remove(key) { map.delete(key); },
    raw: map,
  };
}

function loadMiseKitchen() {
  const context = vm.createContext({ window: {}, JSON, Object, Array, String, TypeError, Error });
  vm.runInContext(fs.readFileSync(new URL('../js/kitchen-store.js', import.meta.url), 'utf8'), context);
  return context.window.MISE_KITCHEN;
}

test('a v2 array is wrapped in a v3 envelope once and kept as a frozen rollback', () => {
  const K = loadMiseKitchen();
  const store = freshStore();
  const v2 = [{ name: 'Rice and Peas', ingredients: ['rice'], instructions: ['Boil the rice.'] }];
  store.set('mise.imported.v2', v2);
  const records = K.load(store, (r) => r);
  assert.equal(records[0].name, 'Rice and Peas');
  const v3 = store.get('mise.imported.v3');
  assert.equal(v3.schemaVersion, 3);
  assert.equal(v3.records.length, 1);
  assert.deepEqual(store.get('mise.imported.v2'), v2, 'v2 must stay readable as the rollback path');
});

test('v3 is authoritative once present; v2 is ignored', () => {
  const K = loadMiseKitchen();
  const store = freshStore();
  store.set('mise.imported.v2', [{ name: 'Old import', ingredients: ['x'], instructions: ['y'] }]);
  store.set('mise.imported.v3', { schemaVersion: 3, records: [{ name: 'Current kitchen', ingredients: ['a'], instructions: ['b'] }] });
  const records = K.load(store, (r) => r);
  assert.equal(records[0].name, 'Current kitchen');
});

test('a corrupt v3 payload falls back to nothing instead of crashing', () => {
  const K = loadMiseKitchen();
  const store = freshStore();
  store.set('mise.imported.v3', { schemaVersion: 3, records: 'not-an-array' });
  const records = K.load(store, (r) => r);
  assert.equal(records.length, 0);
});

test('a v1 legacy kitchen migrates once into v3 and v1 is removed', () => {
  const K = loadMiseKitchen();
  const store = freshStore();
  store.set('mise.imported.v1', [{ name: 'Paté', ingredients: ['salmon'], steps: [{ text: 'Cake it.' }], instructions: ['Cake it.'] }]);
  const records = K.load(store, (r) => ({ ...r, migratedFrom: 'v1' }));
  assert.equal(records.length, 1);
  assert.equal(records[0].migratedFrom, 'v1');
  assert.equal(store.get('mise.imported.v1', null), null);
  const v3 = store.get('mise.imported.v3');
  assert.equal(v3.records.length, 1);
});

test('persist writes the v3 envelope; an unwritable store reports failure', () => {
  const K = loadMiseKitchen();
  const store = freshStore();
  const ok = K.persist(store, [{ name: 'Beef Patties', ingredients: [], instructions: [] }]);
  assert.equal(ok, true);
  assert.equal(store.get('mise.imported.v3').records[0].name, 'Beef Patties');
  const broken = { get: () => undefined, set: () => false, remove: () => {} };
  assert.equal(K.persist(broken, []), false);
});

test('a kitchen export round-trips through readKitchenExport', () => {
  const K = loadMiseKitchen();
  const store = freshStore();
  store.set('mise.imported.v3', { schemaVersion: 3, records: [{ name: 'Roti', ingredients: ['flour'], instructions: ['Cook.'] }] });
  store.set('mise.favorites.v1', ['a', 'b']);
  const exported = K.exportKitchen(store, '2026-11-17T00:00:00.000Z');
  const json = JSON.stringify(exported);
  const parsed = K.readKitchenExport(JSON.parse(json));
  assert.equal(parsed.imported[0].name, 'Roti');
  assert.deepEqual(parsed.prefs['mise.favorites.v1'], ['a', 'b']);
});

test('readKitchenExport rejects a foreign file and unknown settings', () => {
  const K = loadMiseKitchen();
  assert.throws(() => K.readKitchenExport({ app: 'not-mise' }), /not exported by Mise/);
  assert.throws(() => K.readKitchenExport({ app: 'mise', format: 'mise-kitchen-export', schemaVersion: 99, imported: [] }), /schema/);
  assert.throws(
    () => K.readKitchenExport({ app: 'mise', format: 'mise-kitchen-export', schemaVersion: 1, imported: [], prefs: { 'mise.future-thing.v9': true } }),
    /unknown setting/,
  );
});

test('unreadable records in an export are skipped, not fatal', () => {
  const K = loadMiseKitchen();
  const parsed = K.readKitchenExport({
    app: 'mise', format: 'mise-kitchen-export', schemaVersion: 1,
    imported: [
      { name: 'Good', ingredients: ['x'], instructions: ['y'] },
      { never: 'a recipe' },
    ],
    prefs: {},
  });
  assert.equal(parsed.imported.length, 1);
});
