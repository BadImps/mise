/* Mise / recipe parser.
   Turns a source recipe (TheMealDB payload, schema.org Recipe data, or bundled sample)
   into one structure: parsed ingredients, ordered steps, step→ingredient links, timers,
   and a review that says honestly what the source did not give us. */
(function (global) {
  'use strict';

  /* ---------- text ---------- */

  const clean = (s) => String(s == null ? '' : s)
    .replace(/\u00a0/g, ' ')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/\s+/g, ' ')
    .trim();

  const slug = (s) => clean(s).toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '').slice(0, 48);

  const VULGAR = { '½': '1/2', '¼': '1/4', '¾': '3/4', '⅓': '1/3', '⅔': '2/3', '⅛': '1/8', '⅜': '3/8', '⅝': '5/8', '⅞': '7/8', '⅕': '1/5', '⅖': '2/5', '⅗': '3/5', '⅘': '4/5', '⅙': '1/6', '⅚': '5/6' };

  function normalizeFractions(s) {
    return s.replace(/(\d)([½¼¾⅓⅔⅛⅜⅝⅞⅕⅖⅗⅘⅙⅚])/g, (m, a, b) => a + ' ' + VULGAR[b])
      .replace(/[½¼¾⅓⅔⅛⅜⅝⅞⅕⅖⅗⅘⅙⅚]/g, (m) => VULGAR[m]);
  }

  const UNIT_WORDS = [
    ['fluid ounces', 'fl oz'], ['fluid ounce', 'fl oz'], ['fl oz', 'fl oz'],
    ['tablespoons', 'tbsp'], ['tablespoon', 'tbsp'], ['tbsps', 'tbsp'], ['tbs', 'tbsp'], ['tbls', 'tbsp'], ['tblsp', 'tbsp'], ['tbsp', 'tbsp'],
    ['teaspoons', 'tsp'], ['teaspoon', 'tsp'], ['tsps', 'tsp'], ['tsp', 'tsp'],
    ['kilograms', 'kg'], ['kilogram', 'kg'], ['kgs', 'kg'], ['kg', 'kg'],
    ['grams', 'g'], ['gram', 'g'], ['gr', 'g'], ['g', 'g'],
    ['millilitres', 'ml'], ['milliliters', 'ml'], ['millilitre', 'ml'], ['milliliter', 'ml'], ['ml', 'ml'],
    ['litres', 'l'], ['liters', 'l'], ['litre', 'l'], ['liter', 'l'], ['l', 'l'],
    ['pounds', 'lb'], ['pound', 'lb'], ['lbs', 'lb'], ['lb', 'lb'],
    ['ounces', 'oz'], ['ounce', 'oz'], ['ozs', 'oz'], ['oz', 'oz'],
    ['cups', 'cup'], ['cup', 'cup'],
    ['cloves', 'clove'], ['clove', 'clove'],
    ['cans', 'can'], ['can', 'can'],
    ['tins', 'tin'], ['tin', 'tin'],
    ['slices', 'slice'], ['slice', 'slice'],
    ['leaves', 'leaf'], ['leaf', 'leaf'],
    ['sprigs', 'sprig'], ['sprig', 'sprig'],
    ['bunches', 'bunch'], ['bunch', 'bunch'],
    ['pinches', 'pinch'], ['pinch', 'pinch'],
    ['handfuls', 'handful'], ['handful', 'handful'],
    ['pieces', 'piece'], ['piece', 'piece'],
    ['sticks', 'stick'], ['stick', 'stick'],
    ['packs', 'pack'], ['pack', 'pack'],
    ['packets', 'packet'], ['packet', 'packet'],
    ['heads', 'head'], ['head', 'head'],
    ['knobs', 'knob'], ['knob', 'knob'],
    ['dashes', 'dash'], ['dash', 'dash'],
    ['drops', 'drop'], ['drop', 'drop'],
    ['bags', 'bag'], ['bag', 'bag'],
    ['jars', 'jar'], ['jar', 'jar'],
    ['bottles', 'bottle'], ['bottle', 'bottle'],
    ['sprinkling', 'sprinkling'],
    ['drizzle', 'drizzle'],
  ];
  const UNIT_SORTED = UNIT_WORDS.slice().sort((a, b) => b[0].length - a[0].length);

  const COUNT_UNITS = new Set(['clove', 'can', 'tin', 'slice', 'leaf', 'sprig', 'bunch', 'pinch', 'handful', 'piece', 'stick', 'pack', 'packet', 'head', 'knob', 'dash', 'drop', 'bag', 'jar', 'bottle']);
  const SIZE_WORDS = new Set(['large', 'small', 'medium', 'whole', 'ripe', 'boneless', 'skinless', 'lean', 'baby', 'fresh', 'frozen', 'thick', 'thin', 'boned']);

  const DESCRIPTORS = new Set([
    'chopped', 'diced', 'minced', 'sliced', 'grated', 'shredded', 'crushed', 'ground', 'powdered', 'dried', 'fresh', 'frozen', 'canned', 'tinned', 'peeled', 'seeded', 'deseeded', 'trimmed', 'washed', 'rinsed', 'drained', 'halved', 'quartered', 'cubed', 'beaten', 'whisked', 'melted', 'softened', 'room', 'temperature', 'finely', 'roughly', 'thinly', 'coarsely', 'lightly', 'extra', 'virgin', 'extra-virgin', 'low-sodium', 'lower-sodium', 'reduced-sodium', 'unsalted', 'salted', 'sweetened', 'unsweetened', 'plain', 'all-purpose', 'self-raising', 'self-rising', 'free-range', 'organic', 'good-quality', 'quality', 'optional', 'to', 'taste', 'for', 'serving', 'serve', 'garnish', 'plus', 'more', 'about', 'or', 'and', 'of', 'the', 'a', 'an', 'in', 'into', 'with', 'from', 'at', 'on', 'up', 'your', 'favourite', 'favorite', 'desired', 'some', 'its', 'their'
  ]);

  const GENERIC_TOKENS = new Set([
    'oil', 'salt', 'pepper', 'sugar', 'water', 'flour', 'sauce', 'paste', 'powder', 'seed', 'seeds', 'flake', 'flakes', 'leaf', 'leaves', 'stock', 'broth', 'juice', 'zest', 'cheese', 'cream', 'milk', 'butter', 'egg', 'eggs', 'clove', 'cloves', 'bean', 'beans', 'tomato', 'tomatoes', 'onion', 'onions', 'garlic', 'chilli', 'chili', 'chile', 'chiles', 'chillies', 'chilies', 'large', 'small', 'medium', 'good', 'quality', 'red', 'black', 'white', 'dark', 'light', 'green', 'yellow', 'brown'
  ]);

  const SYNONYMS = {
    chilli: 'chili', chillies: 'chili', chile: 'chili', chiles: 'chili', chilies: 'chili',
    cilantro: 'coriander', aubergine: 'eggplant', courgette: 'zucchini', courgettes: 'zucchini',
    prawn: 'shrimp', prawns: 'shrimp', mince: 'ground', minced: 'ground',
    yoghurt: 'yogurt', flavour: 'flavor', colour: 'color', litre: 'liter', metre: 'meter',
    pumpkin: 'squash', chickpea: 'chickpea', chickpeas: 'chickpea', beans: 'bean',
    tomatoes: 'tomato', potatoes: 'potato', onions: 'onion', eggs: 'egg', leaves: 'leaf',
    cloves: 'clove', mushrooms: 'mushroom', peppers: 'pepper', carrots: 'carrot',
    noodles: 'noodle', lentils: 'lentil', peas: 'pea', beansprouts: 'beansprout', corn: 'sweetcorn',
  };

  const PASTA = ['penne', 'spaghetti', 'rigatoni', 'macaroni', 'linguine', 'fettuccine', 'fusilli', 'tagliatelle', 'orzo', 'lasagne', 'lasagna', 'pasta'];

  function ordinalStem(w) {
    let x = w.toLowerCase();
    if (SYNONYMS[x]) x = SYNONYMS[x];
    if (x.length > 4 && x.endsWith('ies')) return x.slice(0, -3) + 'y';
    if (x.length > 4 && x.endsWith('oes')) return x.slice(0, -2);
    if (x.length > 4 && /(?:s|x|z|ch|sh)es$/.test(x)) return x.slice(0, -2);
    if (x.length > 3 && x.endsWith('s') && !x.endsWith('ss')) return x.slice(0, -1);
    return x;
  }

  function tokens(s) {
    return clean(s).toLowerCase()
      .replace(/[^a-z0-9/.' -]/g, ' ')
      .split(/[\s/]+/)
      .map((w) => w.replace(/^[.']+|[.']+$/g, ''))
      .filter(Boolean)
      .map(ordinalStem);
  }

  /* ---------- quantities ---------- */

  const FRACTION_GLYPH = [
    [0, ''], [1 / 8, '⅛'], [1 / 4, '¼'], [1 / 3, '⅓'], [3 / 8, '⅜'],
    [1 / 2, '½'], [5 / 8, '⅝'], [2 / 3, '⅔'], [3 / 4, '¾'], [7 / 8, '⅞'],
  ];

  function formatNumber(n) {
    if (!isFinite(n)) return '';
    const neg = n < 0;
    n = Math.abs(n);
    const whole = Math.floor(n + 1e-9);
    let frac = n - whole;
    let best = FRACTION_GLYPH[0];
    let bestDiff = 9;
    for (const [v, g] of FRACTION_GLYPH) {
      const d = Math.abs(frac - v);
      if (d < bestDiff) { bestDiff = d; best = [v, g]; }
    }
    let out;
    if (bestDiff < 0.045) {
      if (best[0] === 0) out = String(whole);
      else if (whole === 0) out = best[1];
      else out = whole + best[1];
    } else {
      out = (Math.round(n * 10) / 10).toString();
    }
    return (neg ? '-' : '') + out;
  }

  function roundForUnit(value, unit) {
    if (!value) return 0;
    if (unit === 'g' || unit === 'ml') {
      if (value >= 100) return Math.round(value / 5) * 5;
      return Math.round(value);
    }
    if (unit === 'kg' || unit === 'l') return Math.round(value * 100) / 100;
    if (unit === 'oz' || unit === 'lb') return Math.round(value * 100) / 100;
    return Math.round(value * 8) / 8;
  }

  function parseFraction(w) {
    if (!w) return null;
    if (w.includes('/')) {
      const [a, b] = w.split('/').map(Number);
      if (!b) return null;
      return a / b;
    }
    const n = Number(w);
    return isFinite(n) ? n : null;
  }

  function parseIngredient(raw) {
    const original = clean(raw);
    let s = normalizeFractions(original);
    let note = '';

    // juice / zest of N item
    let qty = null, qtyMax = null, rest = s, unit = '';

    let juiced = '';
    const juice = s.match(/^(juice|zest)\s+of\s+((?:\d+\s+)?\d+(?:\s*\/\s*\d+)?|\d+(?:\.\d+)?)\s+(.+)$/i);
    if (juice) {
      qty = parseFraction(juice[2].replace(/\s+/g, ' '));
      rest = juice[3].toLowerCase();
      unit = '';
      juiced = juice[1].toLowerCase() === 'juice' ? 'juiced' : 'zested';
    } else {
      const m = s.match(/^((?:\d+\s+)?\d+\s*\/\s*\d+|\d+(?:\.\d+)?|\.\d+)(?:\s*(?:-|–|—|to)\s*((?:\d+\s+)?\d+\s*\/\s*\d+|\d+(?:\.\d+)?))?/);
      if (m) {
        qty = parseFraction(m[1].replace(/\s+/g, ' '));
        if (m[2]) qtyMax = parseFraction(m[2].replace(/\s+/g, ' '));
        rest = s.slice(m[0].length).trim();
      }
    }

    // leading unmeasured unit: "pinch Brown Sugar", "sprinkling parmesan", "to serve Sugar"
    if (qty == null) {
      const lead = rest.match(/^([a-z]+(?:\s+[a-z]+)?)\b/i);
      if (lead) {
        const phrase = lead[1].toLowerCase();
        const one = UNIT_SORTED.find(([w]) => phrase === w || phrase.startsWith(w + ' '));
        if (one && (COUNT_UNITS.has(one[1]) || one[1] === 'sprinkling' || one[1] === 'drizzle')) {
          unit = one[1];
          rest = rest.slice(one[0].length).trim();
        } else if (phrase === 'to serve' || phrase === 'for serving') {
          unit = 'to serve';
          rest = rest.slice(phrase.length).trim();
        }
      }
    }

    rest = rest.replace(/^[-–—:]\s*/, '');

    // parenthetical notes come out before the unit, so "(15-ounce) cans" reads as cans
    rest = rest.replace(/\(([^)]*)\)/g, (m, inner) => {
      const t = clean(inner);
      if (t) note = note ? note + ', ' + t : t;
      return ' ';
    }).replace(/\s+/g, ' ').trim();

    // leading unmeasured unit: "pinch Brown Sugar", "sprinkling parmesan", "to serve Sugar"
    if (qty == null) {
      const lead = rest.match(/^([a-z]+(?:\s+[a-z]+)?)\b/i);
      if (lead) {
        const phrase = lead[1].toLowerCase();
        const one = UNIT_SORTED.find(([w]) => phrase === w || phrase.startsWith(w + ' '));
        if (one && (COUNT_UNITS.has(one[1]) || one[1] === 'sprinkling' || one[1] === 'drizzle')) {
          unit = one[1];
          rest = rest.slice(one[0].length).trim();
        } else if (phrase === 'to serve' || phrase === 'for serving') {
          unit = 'to serve';
          rest = rest.slice(phrase.length).trim();
        }
      }
    }

    // unit right after quantity
    if (qty != null) {
      for (const [w, u] of UNIT_SORTED) {
        const re = new RegExp('^' + w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'i');
        const m = rest.match(re);
        if (m) { unit = u; rest = rest.slice(m[0].length).trim(); break; }
      }
    }

    rest = rest.replace(/^of\s+/i, '');

    // split a trailing note at the first comma
    const comma = rest.indexOf(',');
    if (comma > -1) {
      const head = rest.slice(0, comma).trim();
      const tail = rest.slice(comma + 1).trim();
      rest = head;
      if (tail) note = note ? note + ', ' + tail : tail;
    }

    if (juiced) note = note ? juiced + ', ' + note : juiced;

    // a measure that is really a size word: "2 large Eggs"
    let item = rest.replace(/^(large|small|medium)\s+/i, '').trim();
    if (DESCRIPTORS.has(item.toLowerCase()) && rest) item = rest;

    const itemLower = item.toLowerCase();
    const serving = /for serving|to serve|to garnish|for garnish|to finish|for the table/.test(original.toLowerCase());
    const optional = /optional/.test(original.toLowerCase());
    const matchName = item
      .toLowerCase()
      .replace(/[^a-z0-9 -]/g, ' ')
      .split(/\s+/)
      .filter((w) => w && !DESCRIPTORS.has(w) && !SIZE_WORDS.has(w))
      .join(' ') || itemLower;

    const category = classify(matchName || itemLower);

    return {
      id: '',
      raw: original,
      qty: qty != null ? qty : null,
      qtyMax: qtyMax != null ? qtyMax : null,
      unit,
      item: item || original,
      note,
      matchName,
      category,
      serving,
      optional,
      steps: [],
    };
  }

  const CATEGORY_WORDS = {
    produce: ['onion', 'garlic', 'tomato', 'basil', 'coriander', 'parsley', 'thyme', 'oregano', 'rosemary', 'mint', 'dill', 'chilli', 'chili', 'chile', 'pepper', 'lemon', 'lime', 'orange', 'apple', 'banana', 'berry', 'raspberry', 'blueberry', 'strawberry', 'potato', 'carrot', 'celery', 'mushroom', 'spinach', 'kale', 'cabbage', 'lettuce', 'cucumber', 'courgette', 'zucchini', 'aubergine', 'eggplant', 'poblano', 'jalapeno', 'radish', 'avocado', 'ginger', 'spring onion', 'scallion', 'leek', 'broccoli', 'cauliflower', 'peas', 'corn', 'sweetcorn', 'squash', 'pumpkin', 'beetroot', 'fennel', 'shallot', 'parsnip', 'fruit', 'salad'],
    protein: ['chicken', 'beef', 'pork', 'lamb', 'salmon', 'fish', 'prawn', 'shrimp', 'tuna', 'cod', 'bacon', 'ham', 'sausage', 'mince', 'minced', 'turkey', 'duck', 'egg', 'eggs', 'tofu', 'chuck', 'steak', 'anchovy', 'sardine'],
    dairy: ['milk', 'butter', 'cheese', 'cream', 'yogurt', 'yoghurt', 'parmesan', 'parmigiano', 'cheddar', 'mozzarella', 'feta', 'ricotta', 'mascarpone', 'creme', 'crème'],
    pantry: [],
  };

  function classify(name) {
    if (/\bblack pepper\b/.test(name)) return 'pantry';
    if (/\b(flakes?|powder|seasoning|dried|paste|sauce|stock|broth)\b/.test(name)) return 'pantry';
    const t = tokens(name);
    for (const [cat, words] of Object.entries(CATEGORY_WORDS)) {
      for (const w of words) {
        const wt = ordinalStem(w);
        if (t.includes(wt)) return cat;
      }
    }
    return 'pantry';
  }

  function unitLabel(unit, n) {
    if (!unit) return '';
    const plurals = {
      cup: 'cups', clove: 'cloves', can: 'cans', tin: 'tins', slice: 'slices', leaf: 'leaves',
      sprig: 'sprigs', bunch: 'bunches', pinch: 'pinches', handful: 'handfuls', piece: 'pieces',
      stick: 'sticks', pack: 'packs', packet: 'packets', head: 'heads', knob: 'knobs', dash: 'dashes',
      drop: 'drops', bag: 'bags', jar: 'jars', bottle: 'bottles', lb: 'lb', oz: 'oz',
      g: 'g', kg: 'kg', ml: 'ml', l: 'l', tsp: 'tsp', tbsp: 'tbsp',
    };
    if (n != null && n > 1 + 1e-9 && plurals[unit]) return plurals[unit];
    return unit;
  }

  function amountText(ing, factor) {
    factor = factor || 1;
    if (ing.qty == null) {
      if (ing.unit === 'to serve') return 'to serve';
      if (ing.unit) return ing.unit;
      return '';
    }
    const base = ing.qty * factor;
    const max = ing.qtyMax != null ? ing.qtyMax * factor : null;
    const step = ing.unit && COUNT_UNITS.has(ing.unit) ? 0.5 : null;
    const exact = factor === 1;
    let lo = exact ? base : roundForUnit(base, ing.unit);
    let hi = max != null ? (exact ? max : roundForUnit(max, ing.unit)) : null;
    if (step) {
      lo = Math.max(0.5, Math.round(lo / step) * step);
      if (hi != null) hi = Math.max(0.5, Math.round(hi / step) * step);
    }
    let out = formatNumber(lo);
    if (hi != null && hi !== lo) out += '–' + formatNumber(hi);
    const u = unitLabel(ing.unit, hi != null ? hi : lo);
    return (out + (u ? ' ' + u : '')).trim();
  }

  /* ---------- steps ---------- */

  function stripTags(html) {
    return clean(String(html == null ? '' : html).replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, ' '));
  }

  function cleanStep(t) {
    return clean(t)
      .replace(/^step\s*\d+\s*[:.\-–]?\s*/i, '')
      .replace(/^(\d+)\s*[.)]\s+/, '')
      .replace(/\s+([.,;:])/g, '$1')
      .trim();
  }

  function splitSentences(text) {
    const inline = stripTags(text);
    if (!inline) return [];
    const parts = inline
      .replace(/([.!?])\s+(?=[A-Z0-9"“(])/g, '$1\n')
      .split(/\n+/)
      .map(cleanStep)
      .filter(Boolean);
    const out = [];
    for (const p of parts) {
      if (/^step\s*\d+$/i.test(p)) continue;
      if (out.length && out[out.length - 1].toLowerCase() === p.toLowerCase()) continue;
      out.push(p);
    }
    return out;
  }

  function instructionBlocks(instructions) {
    const blocks = [];
    const push = (text, section, image) => {
      const t = stripTags(text);
      if (t) blocks.push({ text: t, section: section || null, image: image || null });
    };
    const walk = (node, section) => {
      if (node == null) return;
      if (typeof node === 'string') {
        const raw = String(node).replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, ' ');
        // TheMealDB style: "step 1" lines, paragraphs split by newline.
        const lines = raw.split(/\r?\n/);
        for (const line of lines) {
          const l = clean(line);
          if (!l) continue;
          if (/^step\s*\d+\s*:?$/i.test(l)) { section = section || l; continue; }
          push(l, section && !/^step\s*\d+$/i.test(section) ? section : null);
        }
        return;
      }
      if (Array.isArray(node)) { node.forEach((n) => walk(n, section)); return; }
      if (typeof node === 'object') {
        const types = [].concat(node['@type'] || []);
        if (types.includes('HowToSection') || node.itemListElement) {
          const name = clean(node.name || '');
          walk(node.itemListElement || node.steps || [], name || section);
          return;
        }
        const text = node.text || node.description || node.name;
        if (text) {
          push(text, section, node.image ? imageUrl(node.image) : null);
          return;
        }
        if (node.itemListElement) walk(node.itemListElement, section);
      }
    };
    walk(instructions, null);
    return blocks;
  }

  function buildSteps(instructions) {
    const blocks = instructionBlocks(instructions);
    const steps = [];
    blocks.forEach((b) => {
      const sentences = splitSentences(b.text);
      const list = sentences.length ? sentences : [cleanStep(b.text)];
      list.forEach((text) => {
        if (!text) return;
        if (steps.length && steps[steps.length - 1].text.toLowerCase() === text.toLowerCase()) return;
        steps.push({ id: 's' + (steps.length + 1), n: steps.length + 1, text, section: b.section, image: b.image, ingredients: [], timers: [] });
      });
    });
    return { steps, sourceBlocks: blocks.length };
  }

  /* ---------- matching ---------- */

  const SAFE_GENERIC_HEAD = new Set([
    'bean', 'noodle', 'egg', 'tomato', 'onion', 'garlic', 'cheese', 'cream', 'milk',
    'butter', 'flour', 'sugar', 'oil', 'stock', 'broth', 'basil', 'salt', 'rice', 'pasta',
  ]);

  function ingredientAliases(ing) {
    const full = ing.matchName || ing.item.toLowerCase();
    const parts = full.split(/\s+/).filter(Boolean);
    const sig = parts.filter((w) => w.length > 2 && !DESCRIPTORS.has(w) && !GENERIC_TOKENS.has(ordinalStem(w)));
    const aliases = new Set();
    if (full) aliases.add(full);
    if (sig.length >= 2) aliases.add(sig.slice(-2).join(' '));
    sig.forEach((w) => { if (w.length >= 4) aliases.add(w); });
    if (!sig.length) {
      if (full.includes(' ')) aliases.add(full);
    }
    const all = full + ' ' + ing.item.toLowerCase();
    if (PASTA.some((p) => all.includes(p))) aliases.add('pasta');
    if (/noodle/.test(all)) aliases.add('noodle');
    if (/\bbeans?\b/.test(all)) { aliases.add('beans'); aliases.add('bean'); }
    if (/stock|broth/.test(all)) { aliases.add('stock'); aliases.add('broth'); }
    if (/soy sauce/.test(all)) aliases.add('soy');
    return [...aliases].filter(Boolean).map((a) => a.toLowerCase());
  }

  function stepHasAlias(stepText, alias) {
    const t = ' ' + tokens(stepText).join(' ') + ' ';
    const a = tokens(alias).join(' ');
    if (!a) return false;
    return t.includes(' ' + a + ' ');
  }

  function ingredientHeads(ing) {
    const parts = (ing.matchName || ing.item.toLowerCase()).split(/\s+/).filter(Boolean);
    const sig = parts.filter((w) => w.length > 2 && !DESCRIPTORS.has(w) && !GENERIC_TOKENS.has(ordinalStem(w)));
    if (sig.length) return [];
    const last = parts[parts.length - 1];
    if (last && SAFE_GENERIC_HEAD.has(ordinalStem(last))) return [last.toLowerCase()];
    const first = parts[0];
    if (parts.length > 1 && first && SAFE_GENERIC_HEAD.has(ordinalStem(first))) return [first.toLowerCase()];
    return [];
  }

  function rawWords(text) {
    return ' ' + clean(text).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim() + ' ';
  }

  function matchIngredients(steps, ingredients) {
    const pool = ingredients.filter((i) => !i.serving);
    const aliases = new Map(pool.map((i) => [i.id, ingredientAliases(i)]));
    const heads = new Map(pool.map((i) => [i.id, ingredientHeads(i)]));
    const generic = new Map();
    for (const w of ['oil', 'sugar', 'butter', 'flour', 'stock', 'milk', 'cream', 'cheese', 'salt', 'pepper']) {
      const hits = ingredients.filter((i) => new RegExp('\\b' + w + '\\b').test(i.item.toLowerCase()));
      if (hits.length === 1) generic.set(w, hits[0].id);
    }
    const byId = new Map(ingredients.map((i) => [i.id, i]));

    steps.forEach((step) => {
      const hit = new Set();
      const text = step.text;
      const words = rawWords(text);
      // "tomato paste" is not "tomatoes": mask compound tomato products for non-compound ingredients
      const masked = text.replace(/\btomato\s+(paste|purée|puree|sauce|ketchup)\b/gi, ' ');
      const maskedWords = rawWords(masked);
      pool.forEach((ing) => {
        const al = aliases.get(ing.id) || [];
        const hd = heads.get(ing.id) || [];
        const compound = /paste|sauce|ketchup|pur[ée]e/.test(' ' + ing.matchName + ' ' + ing.item.toLowerCase());
        const t = compound ? text : masked;
        const w = compound ? words : maskedWords;
        const found = al.some((a) => a.length > 2 && stepHasAlias(t, a))
          || hd.some((h) => w.includes(' ' + h + ' '));
        if (found) hit.add(ing.id);
      });
      // a bare generic word ("add the oil") only when the list has exactly one of that thing
      ['oil', 'sugar', 'butter', 'flour', 'stock', 'milk', 'cream', 'cheese', 'salt', 'pepper'].forEach((w) => {
        if (!new RegExp('\\b' + w + '\\b', 'i').test(text)) return;
        if ([...hit].some((id) => new RegExp('\\b' + w + '\\b').test(byId.get(id).item.toLowerCase()))) return;
        if (generic.has(w)) hit.add(generic.get(w));
      });

      step.ingredients = [...hit];
      step.ingredients.forEach((id) => {
        const ing = byId.get(id);
        if (ing && !ing.steps.includes(step.n)) ing.steps.push(step.n);
      });
    });
    return steps;
  }

  /* ---------- timers ---------- */

  const TIMER_RE = /\b(?:about|around|approximately|roughly|up to|at least|for)?\s*(\d+(?:\.\d+)?)\s*(?:(?:-|–|to)\s*(\d+(?:\.\d+)?)\s*)?(seconds?|secs?|minutes?|mins?|hours?|hrs?)\b/gi;

  function findTimers(text) {
    const out = [];
    const seen = new Set();
    let m;
    TIMER_RE.lastIndex = 0;
    while ((m = TIMER_RE.exec(text))) {
      const raw = clean(m[0]);
      if (/^\s*for\s*$/i.test(raw)) continue;
      const a = parseFloat(m[1]);
      const b = m[2] ? parseFloat(m[2]) : null;
      const word = m[3].toLowerCase();
      const mult = /^h/.test(word) ? 3600 : /^s/.test(word) ? 1 : 60;
      const seconds = a * mult;
      const secondsMax = b != null ? b * mult : null;
      if (!seconds || seconds > 86400) continue;
      const key = seconds + ':' + (secondsMax || '');
      if (seen.has(key)) continue;
      seen.add(key);
      const tail = text.slice(m.index + m[0].length, m.index + m[0].length + 22).toLowerCase();
      const eachSide = /each side|per side/.test(tail);
      const label = eachSide ? 'each side' : '';
      out.push({ seconds, secondsMax, raw, label, kind: mult === 3600 ? 'hour' : mult === 1 ? 'second' : 'minute' });
      if (out.length >= 2) break;
    }
    return out;
  }

  function durationText(seconds) {
    if (seconds == null) return '';
    if (seconds < 60) return Math.round(seconds) + ' sec';
    const m = seconds / 60;
    if (m < 60) return formatNumber(m) + ' min';
    const h = Math.floor(m / 60);
    const rem = Math.round(m % 60);
    return h + ' hr' + (rem ? ' ' + rem + ' min' : '');
  }

  function timerText(t) {
    const a = t.seconds;
    const b = t.secondsMax;
    if (b != null && a % 60 === 0 && b % 60 === 0) {
      let s = formatNumber(a / 60) + '–' + formatNumber(b / 60) + ' min';
      if (t.label) s += ' ' + t.label;
      return s;
    }
    if (b != null && a < 60 && b < 60) {
      let s = Math.round(a) + '–' + Math.round(b) + ' sec';
      if (t.label) s += ' ' + t.label;
      return s;
    }
    let s = durationText(a);
    if (b != null && b !== a) s += '–' + durationText(b);
    if (t.label) s += ' ' + t.label;
    return s;
  }

  /* ---------- durations / images / jsonld ---------- */

  function parseISODuration(iso) {
    if (!iso) return null;
    if (typeof iso === 'number') return iso;
    const m = String(iso).match(/P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?/i);
    if (!m) return null;
    const mins = (+m[1] || 0) * 1440 + (+m[2] || 0) * 60 + (+m[3] || 0);
    return mins || null;
  }

  function imageUrl(image) {
    if (!image) return '';
    if (typeof image === 'string') return image;
    if (Array.isArray(image)) return imageUrl(image[0]);
    if (typeof image === 'object') return image.url || image.contentUrl || image['@id'] || '';
    return '';
  }

  function findRecipeNode(value, depth) {
    depth = depth || 0;
    if (!value || typeof value !== 'object' || depth > 8) return null;
    if (Array.isArray(value)) {
      for (const v of value) {
        const hit = findRecipeNode(v, depth + 1);
        if (hit) return hit;
      }
      return null;
    }
    if (value['@graph']) {
      const hit = findRecipeNode(value['@graph'], depth + 1);
      if (hit) return hit;
    }
    const types = [].concat(value['@type'] || []).map(String);
    if (types.some((t) => t === 'Recipe' || t.endsWith('/Recipe'))) return value;
    for (const k of ['mainEntity', 'itemListElement', 'hasPart']) {
      if (value[k]) {
        const hit = findRecipeNode(value[k], depth + 1);
        if (hit) return hit;
      }
    }
    return null;
  }

  function recipeFromJsonLd(node, opts) {
    opts = opts || {};
    const name = clean(node.name || node.headline || 'Imported recipe');
    const imageObject = node.image && typeof node.image === 'object' && !Array.isArray(node.image) ? node.image : null;
    const imageCredit = imageObject ? clean(imageObject.creditText || '') : '';
    const ingredients = (node.recipeIngredient || node.ingredients || []).map((i) => (typeof i === 'string' ? i : i.name || '')).filter(Boolean);
    const instructions = node.recipeInstructions || [];
    const yieldsRaw = Array.isArray(node.recipeYield) ? node.recipeYield[0] : node.recipeYield;
    const yields = parseInt(String(yieldsRaw || '').replace(/[^0-9]/g, ''), 10) || null;
    const author = Array.isArray(node.author) ? node.author.map((a) => (typeof a === 'string' ? a : a.name)).filter(Boolean).join(', ') : (typeof node.author === 'string' ? node.author : node.author && node.author.name) || '';
    const sourceName = (opts.sourceName || (node.publisher && node.publisher.name) || (opts.url ? new URL(opts.url).hostname.replace(/^www\./, '') : 'Imported recipe'));
    const totalMinutes = parseISODuration(node.totalTime) || null;
    const prepMinutes = parseISODuration(node.prepTime) || null;
    const cookMinutes = parseISODuration(node.cookTime) || null;
    return {
      id: opts.id || 'import-' + slug(name),
      name,
      source: sourceName,
      sourceUrl: opts.url || '',
      image: clean(opts.image || imageUrl(node.image)),
      imageCredit,
      cuisine: clean([].concat(node.recipeCuisine || []).join(', ')),
      category: clean([].concat(node.recipeCategory || []).join(', ')),
      tags: [],
      author,
      yields,
      totalMinutes,
      prepMinutes,
      cookMinutes,
      ingredients,
      instructions,
      kind: 'schema',
      description: clean(node.description || '').slice(0, 240),
    };
  }

  function extractFromHtml(html, url) {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const nodes = [...doc.querySelectorAll('script[type="application/ld+json"]')];
    for (const s of nodes) {
      let json;
      try { json = JSON.parse(s.textContent); } catch (e) { continue; }
      const node = findRecipeNode(json);
      if (node) {
        const canonical = doc.querySelector('link[rel="canonical"]');
        const og = doc.querySelector('meta[property="og:image"]');
        return recipeFromJsonLd(node, {
          url: (canonical && canonical.href) || url || '',
          sourceName: doc.title ? doc.title.split(/[|–—]/)[0].trim() : '',
          image: og ? og.content : '',
        });
      }
    }
    // microdata fallback
    const scope = doc.querySelector('[itemtype*="Recipe"], .recipe, [class*="recipe"]');
    if (scope) {
      const name = (scope.querySelector('[itemprop="name"]') || {}).textContent || doc.title;
      const ings = [...scope.querySelectorAll('[itemprop="recipeIngredient"], [itemprop="ingredients"] li')].map((n) => n.textContent);
      const steps = [...scope.querySelectorAll('[itemprop="recipeInstructions"] li, [itemprop="recipeInstructions"] p, .instructions li')].map((n) => n.textContent);
      if (ings.length && steps.length) {
        return {
          id: 'import-' + slug(name),
          name: clean(name),
          source: url ? new URL(url).hostname.replace(/^www\./, '') : 'Imported recipe',
          sourceUrl: url || '',
          image: (doc.querySelector('meta[property="og:image"]') || {}).content || '',
          cuisine: '', category: '', tags: [], author: '',
          yields: null, totalMinutes: null, prepMinutes: null, cookMinutes: null,
          ingredients: ings, instructions: steps, kind: 'html',
        };
      }
    }
    return null;
  }

  /* ---------- the recipe object ---------- */

  function buildRecipe(raw, opts) {
    opts = opts || {};
    const ingredients = (raw.ingredients || []).map((r, idx) => {
      const ing = parseIngredient(r);
      ing.id = 'i' + (idx + 1);
      return ing;
    });

    // serving items and everything listed after the first serving item
    let servingSeen = false;
    ingredients.forEach((ing) => {
      if (ing.serving) servingSeen = true;
      if (servingSeen) ing.serving = true;
    });

    const { steps, sourceBlocks } = buildSteps(raw.instructions || []);
    matchIngredients(steps, ingredients);

    steps.forEach((s) => { s.timers = findTimers(s.text); });

    const checked = ingredients.filter((i) => !i.serving);
    const named = checked.filter((i) => i.steps.length);
    const missing = checked.filter((i) => !i.steps.length);
    const extra = findUnlisted(steps, ingredients);
    const timers = steps.flatMap((s) => s.timers.map((t) => ({ ...t, step: s.n })));
    const timedMinutes = Math.round(timers.reduce((sum, t) => sum + t.seconds, 0) / 60);

    const recipe = {
      id: raw.id || opts.id || 'recipe-' + slug(raw.name),
      name: raw.name || 'Imported recipe',
      source: raw.source || opts.source || 'Imported',
      sourceUrl: raw.sourceUrl || opts.url || '',
      image: raw.image || '',
      imageCredit: raw.imageCredit || '',
      cuisine: raw.cuisine || '',
      category: raw.category || '',
      tags: raw.tags || [],
      author: raw.author || '',
      yields: raw.yields || null,
      totalMinutes: raw.totalMinutes || null,
      prepMinutes: raw.prepMinutes || null,
      cookMinutes: raw.cookMinutes || null,
      description: raw.description || '',
      ingredients,
      steps,
      timers,
      sourceBlocks,
      kind: raw.kind || opts.kind || 'sample',
      importedAt: opts.importedAt || null,
      stats: {
        ingredients: checked.length,
        allIngredients: ingredients.length,
        serving: ingredients.length - checked.length,
        steps: steps.length,
        named: named.length,
        missing: missing.length,
        timers: timers.length,
        timedMinutes,
      },
      review: {
        missing: missing.map((i) => i.item),
        extra,
        split: steps.length - sourceBlocks > 0 ? steps.length - sourceBlocks : 0,
        longSteps: steps.filter((s) => s.text.split(/\s+/).length > 55).map((s) => s.n),
        emptySteps: steps.filter((s) => !s.ingredients.length && !s.timers.length && !/serve|garnish|preheat|gather|rest|set aside/i.test(s.text)).map((s) => s.n),
      },
    };
    return recipe;
  }

  function findUnlisted(steps, ingredients) {
    const text = ' ' + steps.map((s) => s.text).join(' ').toLowerCase() + ' ';
    const words = ['salt', 'pepper', 'sugar', 'butter', 'flour', 'stock', 'milk', 'cream'];
    const out = [];
    for (const w of words) {
      if (!new RegExp('\\b' + w + '\\b').test(text)) continue;
      const listed = ingredients.some((i) => new RegExp('\\b' + w + '\\b').test(i.item.toLowerCase()));
      if (!listed) out.push(w);
      if (out.length >= 3) break;
    }
    return out;
  }

  function recipeFromMealDB(meal, importedAt) {
    if (!meal) return null;
    const ingredients = [];
    for (let i = 1; i <= 20; i++) {
      const ing = clean(meal['strIngredient' + i]);
      const measure = clean(meal['strMeasure' + i]);
      if (ing) ingredients.push((measure ? measure + ' ' : '') + ing);
    }
    const raw = {
      id: 'tm-' + meal.idMeal,
      name: clean(meal.strMeal),
      source: 'TheMealDB',
      sourceUrl: 'https://www.themealdb.com/meal/' + meal.idMeal,
      image: meal.strMealThumb || '',
      cuisine: meal.strArea || '',
      category: meal.strCategory || '',
      tags: clean(meal.strTags || '').split(',').map((t) => t.trim()).filter(Boolean),
      author: '',
      yields: null, totalMinutes: null,
      ingredients,
      instructions: meal.strInstructions || '',
      kind: 'api',
    };
    return buildRecipe(raw, { importedAt });
  }

  function recipeFromSample(sample) {
    return buildRecipe(sample, { importedAt: sample.importedAt || null });
  }

  function recipeFromPastedJson(text) {
    let json;
    try { json = JSON.parse(text); } catch (e) { return null; }
    const node = findRecipeNode(json);
    return node ? recipeFromJsonLd(node, {}) : null;
  }

  global.MiseParse = {
    clean, slug, parseIngredient, amountText, formatNumber, buildRecipe,
    buildSteps, findTimers, timerText, durationText, parseISODuration,
    recipeFromMealDB, recipeFromSample, recipeFromJsonLd, extractFromHtml,
    recipeFromPastedJson, findRecipeNode,
    _debug: { ingredientAliases, tokens, stepHasAlias, GENERIC_TOKENS },
  };
})(typeof window !== 'undefined' ? window : globalThis);

if (typeof module !== 'undefined' && module.exports) module.exports = globalThis.MiseParse;
