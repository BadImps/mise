// One-off: replace the six weak/wrong matches with verified ones and strip
// API tracking params from every stored URL.
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
  airfryer: {
    image: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/9/97/Hamilton_Beach_Easy_Reach_Sure-Crisp_Toaster_Oven_-_08.jpg/330px-Hamilton_Beach_Easy_Reach_Sure-Crisp_Toaster_Oven_-_08.jpg',
    credit: 'Infrogmation of New Orleans (CC BY-SA 4.0) — https://commons.wikimedia.org/wiki/File:Hamilton_Beach_Easy_Reach_Sure-Crisp_Toaster_Oven_-_08.jpg',
  },
  peeler: {
    image: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/f/f9/Couteau-econome.jpg/330px-Couteau-econome.jpg',
    credit: 'Fred Klein (CC BY-SA 4.0) — https://commons.wikimedia.org/wiki/File:Couteau-econome.jpg',
  },
  skilletCast: {
    image: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/f/f7/Griswold_cast_iron_skillet.jpg/330px-Griswold_cast_iron_skillet.jpg',
    credit: 'NMorales (CC BY-SA 4.0) — https://commons.wikimedia.org/wiki/File:Griswold_cast_iron_skillet.jpg',
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
fs.writeFileSync(file, JSON.stringify(j, null, 2) + '\n', 'utf8');
console.log('patched', Object.keys(REPLACEMENTS).length, 'entries;', Object.keys(j).length, 'total');
