/* Mise / kitchen storage envelope.
   The imported kitchen (saved recipes) was historically stored as a raw array
   in mise.imported.v2, with a v1 full-recipe payload migrated on load.
   Format changes are dangerous: a bad migration silently empties someone's
   kitchen, so every stored layout carries an explicit schemaVersion and any
   payload that does not parse is rejected without touching localStorage.

   v3 envelope (this build):
     mise.imported.v3 = { schemaVersion: 3, records: [ <compact raw record> ] }
   A readable v2 array is kept untouched on the device as a frozen one-way
   fallback until a later release retires it, and is only read when v3 is
   absent — it is never written again. v1 legacy records are migrated once
   into v3 on first load and then removed from v1.

   The export/import feature uses the same compact records. */
(function (global) {
  'use strict';

  const SCHEMA_VERSION = 3;
  const KEY = {
    importedV1: 'mise.imported.v1',
    importedV2: 'mise.imported.v2',
    importedV3: 'mise.imported.v3',
  };

  const asRecords = (v) => (Array.isArray(v) ? v
    : (v && v.schemaVersion === SCHEMA_VERSION && Array.isArray(v.records) ? v.records : null));

  // migrateLegacy: rawFromRecipe in the app — converts a full-recipe payload
  // into a compact raw record. Passed in so the store stays pure and testable.
  function load(store, migrateLegacy) {
    const v3 = store.get(KEY.importedV3, undefined);
    const r3 = asRecords(v3);
    if (r3) return r3;

    const v2 = store.get(KEY.importedV2, undefined);
    if (Array.isArray(v2)) {
      // Wrap the frozen v2 array in the v3 envelope once. Keep v2 on disk as
      // a rollback path; do not delete it in this release.
      store.set(KEY.importedV3, { schemaVersion: SCHEMA_VERSION, records: v2 });
      return v2;
    }

    const legacy = store.get(KEY.importedV1, undefined);
    if (Array.isArray(legacy) && legacy.length && typeof migrateLegacy === 'function') {
      const migrated = legacy
        .filter((r) => r && r.name && Array.isArray(r.ingredients) && Array.isArray(r.steps))
        .map(migrateLegacy);
      if (store.set(KEY.importedV3, { schemaVersion: SCHEMA_VERSION, records: migrated })) store.remove(KEY.importedV1);
      return migrated;
    }
    return [];
  }

  function persist(store, records) {
    if (!Array.isArray(records)) throw new TypeError('records must be an array');
    const envelope = { schemaVersion: SCHEMA_VERSION, records };
    return !!store.set(KEY.importedV3, envelope);
  }

  /* Export payload: everything a person needs to move their kitchen.
     Prefs carry unknown keys verbatim so a restore from a newer build
     round-trips untouched. */
  const PREF_KEYS = [
    'mise.pantry.v1',
    'mise.favorites.v1',
    'mise.scale.v1',
    'mise.shopping.v1',
    'mise.recent-cooks.v1',
    'mise.lastcook.v1',
    'mise.voice.v1',
    'mise.voice-mode.v1',
    'mise.voice.engine.v1',
    'mise.voice.override.v1',
    'mise.ringtone.v1',
    'mise.auto-advance.v1',
    'mise.cook-dismissed.v1',
    'mise.last.v1',
  ];

  function exportKitchen(store, exportedAt) {
    const prefs = {};
    for (const key of PREF_KEYS) {
      const raw = store.get(key, undefined);
      if (raw !== undefined) prefs[key] = raw;
    }
    return {
      app: 'mise',
      format: 'mise-kitchen-export',
      schemaVersion: 1,
      exportedAt: exportedAt || new Date().toISOString(),
      imported: load(store, null),
      prefs,
    };
  }

  // Validates an export file without touching storage. Returns
  // { imported:[...], prefs:{...} } or throws with a human-readable reason.
  function readKitchenExport(obj) {
    if (!obj || typeof obj !== 'object') throw new Error('Not a JSON object.');
    if (obj.app !== 'mise' || obj.format !== 'mise-kitchen-export') {
      throw new Error('This file was not exported by Mise.');
    }
    if (obj.schemaVersion !== 1) {
      throw new Error(`This export uses schema ${obj.schemaVersion}; this build understands schema 1.`);
    }
    if (!Array.isArray(obj.imported)) throw new Error('The export has no recipe list.');
    const imported = obj.imported.filter((r) => r && typeof r === 'object' && r.name && Array.isArray(r.ingredients) && Array.isArray(r.instructions));
    for (const key of Object.keys(obj.prefs || {})) {
      if (!PREF_KEYS.includes(key)) {
        throw new Error(`The export carries an unknown setting (${key}); it was not written.`);
      }
    }
    return { imported, prefs: obj.prefs || {} };
  }

  global.MISE_KITCHEN = { SCHEMA_VERSION, KEY, PREF_KEYS, load, persist, exportKitchen, readKitchenExport };
})(typeof window !== 'undefined' ? window : globalThis);
