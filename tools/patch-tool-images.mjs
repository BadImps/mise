// Reviewed replacements and removals; rerun after build-tool-images.mjs.
import fs from 'node:fs';

const file = 'tools/tool-images.json';
const j = JSON.parse(fs.readFileSync(file, 'utf8'));
const strip = (u) => u.replace(/\?utm_source=[^&]*&utm_campaign=[^&]*&utm_content=[^&]*$/, '');
for (const k of Object.keys(j)) {
  j[k].image = strip(j[k].image);
}
const REPLACEMENTS = {
  roasting: {
    image: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/0/09/Large_roasting_pan_with_rack.jpg/330px-Large_roasting_pan_with_rack.jpg',
    credit: 'OttawaAC (CC BY-SA 3.0) — https://commons.wikimedia.org/wiki/File:Large_roasting_pan_with_rack.jpg',
  },
  peeler: {
    image: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/f/f9/Couteau-econome.jpg/330px-Couteau-econome.jpg',
    credit: 'Fred Klein (CC BY-SA 4.0) — https://commons.wikimedia.org/wiki/File:Couteau-econome.jpg',
  },
  skilletCast: {
    image: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/f/f7/Griswold_cast_iron_skillet.jpg/330px-Griswold_cast_iron_skillet.jpg',
    credit: 'NMorales (CC BY-SA 4.0) — https://commons.wikimedia.org/wiki/File:Griswold_cast_iron_skillet.jpg',
  },
  whisk: {
    image: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/a/a1/Whisk_%28IMG_0265%29.jpg/330px-Whisk_%28IMG_0265%29.jpg',
    credit: 'Matti Blume (CC BY-SA 4.0) — https://commons.wikimedia.org/wiki/File:Whisk_%28IMG_0265%29.jpg',
  },
  fryingPan: {
    image: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/f/ff/Frying_Pan_2_2019-03-21.jpg/330px-Frying_Pan_2_2019-03-21.jpg',
    credit: 'FASTILY (CC BY-SA 4.0) — https://commons.wikimedia.org/wiki/File:Frying_Pan_2_2019-03-21.jpg',
  },
  processor: {
    image: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/d/d1/Food_Processor_2.jpg/330px-Food_Processor_2.jpg',
    credit: 'Donovan Govan (CC BY-SA 3.0) — https://commons.wikimedia.org/wiki/File:Food_Processor_2.jpg',
  },
  cleaver: {
    image: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/3/33/Chinese_and_old_North_American_cleavers_noBG.jpg/330px-Chinese_and_old_North_American_cleavers_noBG.jpg',
    credit: "David R. Ingham (CC BY-SA 4.0) — https://commons.wikimedia.org/wiki/File:Chinese_and_old_North_American_cleavers_noBG.jpg",
  },
};
for (const [key, value] of Object.entries(REPLACEMENTS)) j[key] = value;
// These photos depict a different object (or are too ambiguous to teach the
// tool). A missing photo intentionally uses Mise's original tool line art.
const WRONG_SUBJECT = ['dish', 'mortar', 'airfryer', 'instantpot', 'spoon', 'board'];
for (const key of WRONG_SUBJECT) delete j[key];
fs.writeFileSync(file, JSON.stringify(j, null, 2) + '\n', 'utf8');
fs.writeFileSync('js/tool-images.js',
  '/* Mise / reviewed kitchen-tool photographs. Run tools/patch-tool-images.mjs after regeneration. */\nwindow.MISE_TOOL_IMAGES = '
  + JSON.stringify(j, null, 2) + ';\n', 'utf8');
console.log('patched', Object.keys(REPLACEMENTS).length, 'entries; removed', WRONG_SUBJECT.length, 'misleading photos;', Object.keys(j).length, 'total');
