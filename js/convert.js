/* Mise / unit conversion.
   Deterministic, offline, no network. Publisher units stay as written; the
   converted value is rendered beside the scaled amount and labelled as a
   Mise conversion, not a publisher claim. Cup → grams is only shown for the
   staples whose conversions are stable; everything else converts to ml only. */
(function (global) {
  'use strict';

  const ML_PER = { tsp: 5, tbsp: 15 }; // US customary tsp = 5 ml, tbsp = 15 ml (exact)
  const CUP_ML = 236.588;              // US customary cup in ml
  const CUP_GRAMS = {                  // staples only; anything else stays ml-only
    'all-purpose flour': 120, 'flour': 120, 'whole wheat flour': 120, 'bread flour': 130,
    'sugar': 200, 'granulated sugar': 200,
    'brown sugar': 220, 'packed brown sugar': 220, 'light brown sugar': 220, 'dark brown sugar': 220,
    'icing sugar': 120, 'powdered sugar': 120, 'confectioners sugar': 120,
    'butter': 227,
    'rice': 200, 'long grain rice': 200,
    'oats': 80, 'rolled oats': 80, 'oatmeal': 80,
    'cocoa': 100, 'unsweetened cocoa powder': 100, 'cacao': 100,
  };

  const norm = (name) => String(name || '').toLowerCase().replace(/[^a-z ]+/g, ' ').replace(/\s+/g, ' ').trim();

  function gramsForCup(item) {
    const n = norm(item);
    if (CUP_GRAMS[n] != null) return CUP_GRAMS[n];
    // "caster sugar", "raw cane sugar" reduce to their last token
    for (const key of Object.keys(CUP_GRAMS)) {
      if (n.endsWith(' ' + key)) return CUP_GRAMS[key];
    }
    for (const key of Object.keys(CUP_GRAMS)) {
      if (n.includes(key)) return CUP_GRAMS[key];
    }
    return null;
  }

  // amount: scaled quantity (number or null), unit: unit word, item: ingredient name
  // Returns a short annotation like "(10 ml)" / "(237 g)" or ''.
  function conversion(amount, unit, item) {
    const qty = Number(amount);
    if (!isFinite(qty) || qty <= 0) return '';
    const u = String(unit || '').toLowerCase();
    if (!u) return '';
    if (u === 'tsp') return '(' + Math.round(qty * ML_PER.tsp * 10) / 10 + ' ml)';
    if (u === 'tbsp') return '(' + Math.round(qty * ML_PER.tbsp * 10) / 10 + ' ml)';
    if (u === 'cup') {
      const g = gramsForCup(item);
      const ml = Math.round(qty * CUP_ML);
      return g != null ? '(' + ml + ' ml · ' + Math.round(qty * g) + ' g)' : '(' + ml + ' ml)';
    }
    if (u === 'ml') return '(' + (qty / ML_PER.tbsp).toFixed(qty % ML_PER.tbsp ? 1 : 0) + ' tbsp)';
    if (u === 'l' || u === 'litre' || u === 'liter') return '(' + Math.round(qty * 1000) + ' ml)';
    return '';
  }

  global.MISE_CONVERT = { conversion, gramsForCup, CUP_ML, ML_PER };
})(typeof window !== 'undefined' ? window : globalThis);
if (typeof module !== 'undefined' && module.exports) module.exports = globalThis.MISE_CONVERT;
