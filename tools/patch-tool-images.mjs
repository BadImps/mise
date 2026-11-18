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
    image: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/5/5a/Peeler_02_Pengo.jpg/330px-Peeler_02_Pengo.jpg',
    credit: 'Pengo (CC BY-SA 3.0) — https://commons.wikimedia.org/wiki/File:Peeler_02_Pengo.jpg',
  },
  pan: {
    image: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/e/e4/Stainless_Steel_Frying_Pan.jpg/330px-Stainless_Steel_Frying_Pan.jpg',
    credit: 'Jim Stonos (CC BY-SA 4.0) — https://commons.wikimedia.org/wiki/File:Stainless_Steel_Frying_Pan.jpg',
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
  spoon: {
    image: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/e/e3/Lug%C3%AB_druri.jpg/330px-Lug%C3%AB_druri.jpg',
    credit: 'Edukatori (CC BY 4.0) — https://commons.wikimedia.org/wiki/File:Lug%C3%AB_druri.jpg',
  },
  instantpot: {
    image: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/3/31/Instant_Pot_DUO60_pressure_cooker.jpg/330px-Instant_Pot_DUO60_pressure_cooker.jpg',
    credit: 'Your Best Digs (CC BY 2.0) — https://commons.wikimedia.org/wiki/File:Instant_Pot_DUO60_pressure_cooker.jpg',
  },
  dish: {
    image: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/a/a2/Emile_Henry_ceramic_casserole_dish.jpg/330px-Emile_Henry_ceramic_casserole_dish.jpg',
    credit: 'Cullen328 (CC BY-SA 4.0) — https://commons.wikimedia.org/wiki/File:Emile_Henry_ceramic_casserole_dish.jpg',
  },
  mortar: {
    image: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/a/af/White-Mortar-and-Pestle.jpg/330px-White-Mortar-and-Pestle.jpg',
    credit: 'Evan-Amos (Public domain) — https://commons.wikimedia.org/wiki/File:White-Mortar-and-Pestle.jpg',
  },
  airfryer: {
    image: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/0/0c/Air_Fryer_5458.jpg/330px-Air_Fryer_5458.jpg',
    credit: 'Ashley Pomeroy (CC BY 4.0) — https://commons.wikimedia.org/wiki/File:Air_Fryer_5458.jpg',
  },
  board: {
    image: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/7/74/Chopping_Board.jpg/330px-Chopping_Board.jpg',
    credit: 'Donovan Govan (CC BY-SA 3.0) — https://commons.wikimedia.org/wiki/File:Chopping_Board.jpg',
  },
  grater: {
    image: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/a/ae/K%C3%BCchenreibe_1.jpg/330px-K%C3%BCchenreibe_1.jpg',
    credit: 'Superbass (CC BY-SA 4.0) — https://commons.wikimedia.org/wiki/File:K%C3%BCchenreibe_1.jpg',
  },
  ladle: {
    image: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/e/eb/Ladle_%28spoon%29_-_%E0%A6%A1%E0%A6%BE%E0%A6%AC%E0%A7%81_-_DSC00527.jpg/330px-Ladle_%28spoon%29_-_%E0%A6%A1%E0%A6%BE%E0%A6%AC%E0%A7%81_-_DSC00527.jpg',
    credit: 'Moheen (CC BY-SA 4.0) — https://commons.wikimedia.org/wiki/File:Ladle_(spoon)_-_%E0%A6%A1%E0%A6%BE%E0%A6%AC%E0%A7%81_-_DSC00527.jpg',
  },
  sieve: {
    image: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/b/bc/Durchschlag.jpg/330px-Durchschlag.jpg',
    credit: 'EvaK (CC BY-SA 2.5) — https://commons.wikimedia.org/wiki/File:Durchschlag.jpg',
  },
  griddle: {
    image: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/a/a4/Electric_griddle.jpg/330px-Electric_griddle.jpg',
    credit: 'Jonathan Kovaciny at en.wikipedia (CC BY-SA 3.0) — https://commons.wikimedia.org/wiki/File:Electric_griddle.jpg',
  },
  sheet: {
    image: 'assets/tool-photos/baking-sheet.jpg',
    credit: 'Supplied by the owner for personal use (not from Wikimedia Commons)',
  },
  wok: {
    image: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/0/0a/Wok_2.jpg/330px-Wok_2.jpg',
    credit: 'Chris Feldmann (CC BY 2.0) — https://commons.wikimedia.org/wiki/File:Wok_2.jpg',
  },
  rollingpin: {
    image: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/b/b3/Rouleau_a_patisserie.jpg/330px-Rouleau_a_patisserie.jpg',
    credit: 'Copolycube (CC BY-SA 2.5) — https://commons.wikimedia.org/wiki/File:Rouleau_a_patisserie.jpg',
  },
  blender: {
    image: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/a/a2/Vitamix_Pro_750.JPG/330px-Vitamix_Pro_750.JPG',
    credit: 'SimonAdalbert / perfektegesundheit.de (CC BY 4.0) — https://commons.wikimedia.org/wiki/File:Vitamix_Pro_750.JPG',
  },
  knife: {
    image: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/f/f7/Kitchen_knife_by_yashima.jpg/330px-Kitchen_knife_by_yashima.jpg',
    credit: 'yashima (CC BY-SA 2.0) — https://commons.wikimedia.org/wiki/File:Kitchen_knife_by_yashima.jpg',
  },
  bowl: {
    image: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/0/00/Masoncash_cane_mixing_bowl.jpg/330px-Masoncash_cane_mixing_bowl.jpg',
    credit: 'RLiverpool2021 (CC BY-SA 4.0) — https://commons.wikimedia.org/wiki/File:Masoncash_cane_mixing_bowl.jpg',
  },
  saucepan: {
    image: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/4/4a/WMF-Fusiontec-Mineral-Multipot_02.jpg/330px-WMF-Fusiontec-Mineral-Multipot_02.jpg',
    credit: 'RuinDig / Yuki Uchida (CC BY 4.0) — https://commons.wikimedia.org/wiki/File:WMF-Fusiontec-Mineral-Multipot_02.jpg',
  },
  cleaver: {
    image: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/6/6c/Couperet_%C3%A0_d%C3%A9biter_les_lapins_05.jpg/330px-Couperet_%C3%A0_d%C3%A9biter_les_lapins_05.jpg',
    credit: 'Coyau (CC BY-SA 3.0) — https://commons.wikimedia.org/wiki/File:Couperet_%C3%A0_d%C3%A9biter_les_lapins_05.jpg',
  },
  paring: {
    image: 'assets/tool-photos/paring-knife.jpg',
    credit: 'Supplied by the owner for personal use (not from Wikimedia Commons)',
  },
  measuringSpoons: {
    image: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/3/3f/MeasuringSpoons.jpg/330px-MeasuringSpoons.jpg',
    credit: 'Arkrishna (Public domain) — https://commons.wikimedia.org/wiki/File:MeasuringSpoons.jpg',
  },
};
for (const [key, value] of Object.entries(REPLACEMENTS)) j[key] = value;
// The six weakest matches from the automated search (spoon, Instant Pot,
// casserole dish, mortar and pestle, air fryer, cutting board) were reviewed
// and replaced above on 2026-11-18 with subject-correct photographs.
//
// Second review round, same day: the seven tools whose popover photos were
// rejected as poor representations (rolling pin, roasting pan, baking sheet,
// blender, cleaver, knife, paring knife) were re-sourced from Commons
// *categories* rather than keyword search, then the owner picked from five
// lettered options each. The baking sheet and paring knife are the only two
// photos that are not hot-linked: they were supplied by the owner, so they are
// bundled from assets/tool-photos/ and stay available offline.
const WRONG_SUBJECT = [];
for (const key of WRONG_SUBJECT) delete j[key];
fs.writeFileSync(file, JSON.stringify(j, null, 2) + '\n', 'utf8');
fs.writeFileSync('js/tool-images.js',
  '/* Mise / reviewed kitchen-tool photographs. Run tools/patch-tool-images.mjs after regeneration. */\nwindow.MISE_TOOL_IMAGES = '
  + JSON.stringify(j, null, 2) + ';\n', 'utf8');
console.log('patched', Object.keys(REPLACEMENTS).length, 'entries; removed', WRONG_SUBJECT.length, 'misleading photos;', Object.keys(j).length, 'total');
