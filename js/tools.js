/* Mise / kitchen tools.
   When a cook-mode step names a tool, the word is underlined and can be tapped
   to show what the tool looks like. The line art below is original to Mise,
   drawn in the house stroke style; the names match each tool in plain English.
   Aliases are ordered longest-first so a phrase like "slotted spoon" wins over
   "spoon". Matching runs on the already-escaped Html source text, word by word. */
(function (global) {
  'use strict';

  const svg = (inner) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inner}</svg>`;

  const ART = {
    pot: svg('<path d="M4.5 10.25h15v5a4.25 4.25 0 0 1-4.25 4.25h-6.5a4.25 4.25 0 0 1-4.25-4.25z"/><path d="M3 10.25h18"/><path d="M9.5 10.25V8.2h5v2.05"/><path d="M11.4 8.2v-1.5h1.2v1.5"/>'),
    bowl: svg('<path d="M4 11h16c0 4.4-3.6 7.4-8 7.4s-8-3-8-7.4z"/><path d="M9.5 21h5"/><path d="M10.5 18.4 10 16.2M13.5 18.4l.5-2.2"/>'),
    pan: svg('<circle cx="8.5" cy="15" r="5.25"/><path d="M13.8 12.3 21.5 7.6"/><circle cx="20.4" cy="8.2" r="0.5" fill="currentColor" stroke="none"/><path d="M6.5 15h4"/>'),
    saucepan: svg('<path d="M4.5 11h12v4.6a4.25 4.25 0 0 1-4.25 4.15H8.75A4.25 4.25 0 0 1 4.5 15.6z"/><path d="M16.5 12.5H22"/><path d="M8.2 11V9.4h5.6V11"/>'),
    spoon: svg('<ellipse cx="12" cy="6.2" rx="3.15" ry="3.7"/><path d="M12 9.9V21"/><path d="M10 21h4"/>'),
    slottedSpoon: svg('<ellipse cx="12" cy="6.2" rx="3.15" ry="3.7"/><path d="M12 9.9V21"/><path d="M10 21h4"/><circle cx="10.8" cy="5.2" r="0.55" fill="currentColor" stroke="none"/><circle cx="13.2" cy="5.2" r="0.55" fill="currentColor" stroke="none"/><circle cx="12" cy="7.6" r="0.55" fill="currentColor" stroke="none"/>'),
    processor: svg('<path d="M8 3h8l.9 6.2H7.1z"/><path d="M6.2 12.6h11.6v3.9a2.3 2.3 0 0 1-2.3 2.3H8.5a2.3 2.3 0 0 1-2.3-2.3z"/><path d="M9.5 21h5"/><circle cx="12" cy="16.2" r="0.7" fill="currentColor" stroke="none"/>'),
    blender: svg('<path d="M9 3h6.5l.8 8H8.2z"/><path d="M7 13.5h10.5v4a2.3 2.3 0 0 1-2.3 2.3H9.3a2.3 2.3 0 0 1-2.3-2.3z"/><circle cx="12.5" cy="16.9" r="0.75" fill="currentColor" stroke="none"/><path d="M9.5 22h6"/>'),
    whisk: svg('<path d="M12 21.5V14"/><path d="M12 14c-3.3 0-5-3.4-5-6.9C7 3.7 9 2.3 12 2.3s5 1.4 5 4.8c0 3.5-1.7 6.9-5 6.9z"/><path d="M12 14c-1.7-1.2-2.6-3.4-2.6-6"/><path d="M12 14c1.7-1.2 2.6-3.4 2.6-6"/>'),
    cleaver: svg('<path d="M3.75 8h10.5v7.6a2.9 2.9 0 0 1-2.9 2.9H7a3.25 3.25 0 0 1-3.25-3.25z"/><circle cx="7" cy="11" r="0.6" fill="currentColor" stroke="none"/><path d="M14.25 9.5h6.5M14.25 14h6.5M20.75 9.5v4.5"/>'),
    knife: svg('<path d="M4.5 17 15 5.3c1.9-1 4 .8 3 2.9L7.5 17.4l-3-.4z"/><path d="M9.5 13.4l2.7 2.7"/>'),
    paring: svg('<path d="M4.5 17 13 6.8c1.6-.9 3.3.7 2.4 2.4L7.4 17.4z"/><path d="M8.6 13.9l2 2"/>'),
    dutch: svg('<path d="M5.5 11h13v4.8a4.25 4.25 0 0 1-4.25 4.2h-4.5A4.25 4.25 0 0 1 5.5 15.8z"/><path d="M3.4 12.4h2.1M18.5 12.4h2.1"/><path d="M9 11V9h6v2"/><path d="M11.1 9V7.6h1.8V9"/>'),
    instantpot: svg('<path d="M5 10.5h14v5.2a4.1 4.1 0 0 1-4.1 4.1H9.1A4.1 4.1 0 0 1 5 15.7z"/><path d="M3.5 10.5h17"/><path d="M10.2 10.5V7.5h3.6v3"/><circle cx="12" cy="15.6" r="0.85" fill="currentColor" stroke="none"/><path d="M7.2 12.8h1.4M15.4 12.8h1.4"/>'),
    dish: svg('<path d="M4 11h16v3.6A4.3 4.3 0 0 1 15.7 19H8.3A4.3 4.3 0 0 1 4 14.6z"/><path d="M2.4 12.6H4M20 12.6h1.6"/><path d="M8.5 15.6h7"/>'),
    wok: svg('<path d="M4.5 12h15a7.5 5.75 0 0 1-15 0z"/><path d="M2.3 11.2h2.2M19.5 11.2h2.2"/>'),
    colander: svg('<path d="M4.5 9.5h15c0 4.6-3.4 7.8-7.5 7.8s-7.5-3.2-7.5-7.8z"/><path d="M9 20.5h6"/><path d="M8 12.6h2M11 12.6h2M14 12.6h2"/>'),
    rollingpin: svg('<rect x="6.25" y="10" width="11.5" height="4.6" rx="1.6"/><path d="M4 12.3h2.25M17.75 12.3H20"/><path d="M2.8 11v2.6M21.2 11v2.6"/>'),
    roasting: svg('<path d="M3.5 10.5h17v4.8a2.6 2.6 0 0 1-2.6 2.6H6.1a2.6 2.6 0 0 1-2.6-2.6z"/><path d="M2 12h1.5M20.5 12H22"/><path d="M7 14.4h10"/>'),
    spatula: svg('<path d="M12.6 5.6 18.4 11.4l-5.9 5.8-5.7-5.7z"/><path d="M8.6 15.1 3.5 20.2"/>'),
    griddle: svg('<rect x="3.5" y="12" width="17" height="3.6" rx="1.8"/><path d="M7.5 15.6v2.2M16.5 15.6v2.2"/>'),
    mortar: svg('<path d="M5 13h14c0 3.9-3 6.3-7 6.3S5 16.9 5 13z"/><path d="M9.4 12 16.8 4.3"/><circle cx="17.7" cy="3.4" r="1.15"/>'),
    sheet: svg('<path d="M3.5 9.5h17v4.6a2.1 2.1 0 0 1-2.1 2.1H5.6a2.1 2.1 0 0 1-2.1-2.1z"/><path d="M6.5 12.3h11"/>'),
    cup: svg('<path d="M7 4.5h10V13a5 5 0 0 1-10 0z"/><path d="M17 6.5h2.6v3H17"/><path d="M10 8h2M10 10.8h2M10 13.6h2"/>'),
    measuringSpoons: svg('<circle cx="5.4" cy="5" r="1.25"/><path d="M5.4 6.3 9.6 10.5"/><ellipse cx="12.5" cy="13.3" rx="2.7" ry="3.1"/><path d="M5.4 6.3 12.7 13.6"/>'),
    grater: svg('<path d="M7.4 4.5h9.2L18 18a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2z"/><circle cx="10.6" cy="9.6" r="0.62" fill="currentColor" stroke="none"/><circle cx="13.6" cy="9.6" r="0.62" fill="currentColor" stroke="none"/><circle cx="9.8" cy="13.4" r="0.62" fill="currentColor" stroke="none"/><circle cx="12.4" cy="13.4" r="0.62" fill="currentColor" stroke="none"/><circle cx="15" cy="13.4" r="0.62" fill="currentColor" stroke="none"/>'),
    ladle: svg('<circle cx="7.4" cy="16" r="3.5"/><path d="M10.7 13.5 19.6 4.6"/><circle cx="20.4" cy="3.8" r="0.85"/>'),
    sieve: svg('<circle cx="9.3" cy="12" r="5.2"/><path d="M14.5 12h7.5"/><path d="M6.8 10.3h5M6.8 13.9h5"/>'),
    airfryer: svg('<rect x="6" y="3.2" width="12" height="17.5" rx="2.1"/><path d="M9.5 10h5v5.2h-5z"/><circle cx="12" cy="6.8" r="0.8" fill="currentColor" stroke="none"/>'),
    board: svg('<rect x="4.5" y="5" width="15" height="14" rx="2"/><circle cx="16.3" cy="9" r="1.05"/>'),
    tongs: svg('<path d="M8 3.5l4.3 13M16 3.5 11.7 16.5"/><path d="M10.6 21 12.3 16M13.4 21 11.7 16"/>'),
    peeler: svg('<path d="M4 12.5h10.5a1.6 1.6 0 0 1 1.6 1.6v1.3a1.6 1.6 0 0 1-1.6 1.6H4z"/><path d="M16.1 11.2 21 8.6v6.3l-4.9-2.6z"/>'),
    kettle: svg('<path d="M6.5 11.5a5.5 5.5 0 0 1 11 0v1.5a4.5 4.5 0 0 1-4.5 4.5H11a4.5 4.5 0 0 1-4.5-4.5z"/><path d="M17.5 12h2a1.5 1.5 0 0 1 0 3h-2"/><path d="M9.5 11.5V8.8h5v2.7"/>'),
    garlicpress: svg('<path d="M9.5 3.5h5l-.6 5h-3.8z"/><path d="M9 9.5h6l-1 5.5a3 3 0 0 1-4 0z"/><path d="M12 20.5v-3.2"/>'),
  };

  const TOOLS = [
    { key: 'pot', name: 'Pot', use: 'A deep vessel for boiling, stewing and simmering soups, peas and pigtails.', aliases: ['pot', 'pots', 'soup pot', 'stock pot', 'stockpot', 'soup pots'] },
    { key: 'bowl', name: 'Bowl', use: 'For mixing, marinating and holding measured ingredients before they go in.', aliases: ['bowl', 'bowls', 'mixing bowl'] },
    { key: 'pan', name: 'Pan', use: 'A wide, shallow vessel. The step usually means a skillet; use what the size calls for.', aliases: ['pan', 'pans'] },
    { key: 'saucepan', name: 'Saucepan', use: 'A deep single-handled pan for sauces, rice, cocoa tea and melting.', aliases: ['saucepan', 'saucepans', 'sauce pan', 'saucepot'] },
    { key: 'spoon', name: 'Spoon', use: 'For stirring, folding and serving. A heatproof wooden spoon survives longer on the hob.', aliases: ['spoon', 'spoons', 'wooden spoon'] },
    { key: 'slottedSpoon', name: 'Slotted spoon', use: 'Drains liquids when lifting food out of a pot or pan.', aliases: ['slotted spoon'] },
    { key: 'processor', name: 'Food processor', use: 'Chops, grates and purées quickly; pulse rather than run it to a paste.', aliases: ['food processor', 'processor'] },
    { key: 'blender', name: 'Blender', use: 'Purées liquids and soft mixes into juices, punches and smooth purées.', aliases: ['blender'] },
    { key: 'whisk', name: 'Whisk', use: 'Beats air into eggs, batters and custards for a light, even texture.', aliases: ['whisk', 'whisks'] },
    { key: 'cleaver', name: 'Cleaver', use: 'A heavy rectangular blade for splitting bones and sectioning hard vegetables like pumpkin.', aliases: ['cleaver'] },
    { key: 'knife', name: 'Knife', use: 'A chef’s knife handles almost all the chopping and slicing here.', aliases: ['knife', 'knives', 'chef knife'] },
    { key: 'paring', name: 'Paring knife', use: 'A small blade for trimming, peeling and precision work.', aliases: ['paring knife'] },
    { key: 'dutch', name: 'Dutch oven', use: 'A heavy lidded pot that holds steady heat for braises and rice dishes.', aliases: ['dutch oven'] },
    { key: 'instantpot', name: 'Instant Pot', use: 'An electric pressure cooker. The publisher’s timings assume the proper pressure setting.', aliases: ['instant pot'] },
    { key: 'dish', name: 'Baking dish', use: 'For oven bakes, pies and casseroles served from the dish.', aliases: ['baking dish', 'casserole dish', 'casserole', 'baking dishes'] },
    { key: 'wok', name: 'Wok', use: 'A high-sided pan over fierce heat; toss, don’t stir.', aliases: ['wok'] },
    { key: 'colander', name: 'Colander', use: 'Drains pasta, boiled provisions and peas after cooking.', aliases: ['colander'] },
    { key: 'rollingpin', name: 'Rolling pin', use: 'Rolls out dough for roti, pastry and pie crusts.', aliases: ['rolling pin'] },
    { key: 'roasting', name: 'Roasting pan', use: 'A deep tray for roasting meats and vegetables in the oven.', aliases: ['roasting pan', 'roasting tin', 'baking pan'] },
    { key: 'spatula', name: 'Spatula', use: 'Flips and lifts food without tearing it. A silicone one protects pans.', aliases: ['spatula', 'spatulae'] },
    { key: 'griddle', name: 'Griddle', use: 'A broad flat plate over even heat, for callaloo, arepas and fry-bake.', aliases: ['griddle', 'griddles'] },
    { key: 'mortar', name: 'Mortar and pestle', use: 'Pounds garlic, peppers and spices for rubs and seasonings.', aliases: ['mortar', 'pestle', 'mortar and pestle'] },
    { key: 'sheet', name: 'Baking sheet', use: 'A flat tray lined or oiled, for roasting, grilling and oven baking.', aliases: ['baking sheet', 'baking tray', 'sheet pan'] },
    { key: 'cup', name: 'Measuring cup', use: 'For level cups of flour, sugar, beans and liquids.', aliases: ['measuring cup', 'measuring jug', 'measuring cups', 'measuring jugs'] },
    { key: 'measuringSpoons', name: 'Measuring spoons', use: 'For teaspoons and tablespoons of spices, salt and leavening.', aliases: ['measuring spoons'] },
    { key: 'grater', name: 'Grater', use: 'Shreds cheese, coconut and citrus zest; finest side for powdering nutmeg.', aliases: ['grater'] },
    { key: 'ladle', name: 'Ladle', use: 'Serves soup, stew and gravy straight from the pot.', aliases: ['ladle', 'ladles'] },
    { key: 'sieve', name: 'Sieve', use: 'Strains stocks, teas and smooth purées through fine mesh.', aliases: ['sieve', 'strainer'] },
    { key: 'airfryer', name: 'Air fryer', use: 'A small hot-air oven. Compare timings carefully with a real oven.', aliases: ['air fryer'] },
    { key: 'board', name: 'Cutting board', use: 'A steady board for chopping. Keep one for raw meat and one for the rest.', aliases: ['cutting board', 'chopping board'] },
    { key: 'tongs', name: 'Tongs', use: 'Grips and turns hot food without piercing it.', aliases: ['tongs'] },
    { key: 'peeler', name: 'Peeler', use: 'Strips skin off provisions cheaply and keeps fingers out of the knife path.', aliases: ['peeler'] },
    { key: 'kettle', name: 'Kettle', use: 'Boils water fast — for cocoa tea, blanching and hot water baths.', aliases: ['kettle'] },
    { key: 'garlicpress', name: 'Garlic press', use: 'Crushes cloves straight through, skin and all.', aliases: ['garlic press'] },
    { key: 'skilletCast', name: 'Cast-iron skillet', use: 'Holds and spreads heat evenly; preheat it properly for searing.', aliases: ['cast iron skillet', 'cast iron', 'cast-iron skillet'], art: 'pan' },
    { key: 'sautePan', name: 'Sauté pan', use: 'A deep straight-sided pan for quick cooking in a little oil or butter.', aliases: ['sauté pan', 'saute pan'], art: 'pan' },
    { key: 'fryingPan', name: 'Frying pan', use: 'For frying, browning and shallow-frying in batches.', aliases: ['frying pan', 'frypan', 'skillet', 'skillets'], art: 'pan' },
  ];

  // Normalize alias → tool entry. Longest alias wins at match time.
  const byKey = {};
  for (const tool of TOOLS) byKey[tool.key] = tool;

  const escapeReg = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const aliases = [];
  for (const tool of TOOLS) {
    for (const alias of tool.aliases) aliases.push(alias);
  }
  aliases.sort((a, b) => b.length - a.length);
  const aliasRegex = new RegExp('\\b(' + aliases.map(escapeReg).join('|') + ')\\b', 'gi');
  const aliasToKey = {};
  for (const tool of TOOLS) {
    for (const alias of tool.aliases) aliasToKey[alias.toLowerCase()] = tool.key;
  }

  // Runs on already-HTML-escaped text.
  function linkify(escapedText) {
    return String(escapedText).replace(aliasRegex, (match) => {
      const key = aliasToKey[match.toLowerCase()];
      if (!key) return match;
      return `<button class="tool-word" type="button" data-action="tool-info" data-tool="${key}" aria-label="${match} — what is this tool?">${match}</button>`;
    });
  }

  function defFor(key) {
    const tool = byKey[key];
    if (!tool) return null;
    return {
      key: tool.key,
      name: tool.name,
      use: tool.use,
      art: ART[tool.art || tool.key] || ART.pot,
    };
  }

  global.MiseTools = { linkify, defFor, ART };
})(typeof window !== 'undefined' ? window : this);
