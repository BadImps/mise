import assert from 'node:assert/strict';
import fs from 'node:fs';
import { test } from 'node:test';

test('reviewed kitchen-tool photographs are present and licensed', () => {
  const photos = JSON.parse(fs.readFileSync(new URL('./tool-images.json', import.meta.url), 'utf8'));
  const patch = fs.readFileSync(new URL('./patch-tool-images.mjs', import.meta.url), 'utf8');
  const EXPECTED = {
    spoon: /Lug%C3%AB_druri/,
    instantpot: /Instant_Pot_DUO60_pressure_cooker/,
    dish: /Emile_Henry_ceramic_casserole_dish/,
    mortar: /White-Mortar-and-Pestle/,
    airfryer: /Air_Fryer_5458/,
    board: /Chopping_Board/,
  };
  for (const [key, pattern] of Object.entries(EXPECTED)) {
    assert.ok(photos[key], `${key} must carry a photograph`);
    assert.match(photos[key].image, pattern);
    // CC-BY, CC-BY-SA, CC0 or public domain only — never NC/ND
    assert.match(photos[key].credit, /CC BY(-SA)?( 2\.0| 3\.0| 4\.0)?|Public domain|CC0/);
    assert.doesNotMatch(photos[key].credit, /non-?commercial|\bNC\b|no deriv|\bND\b/i);
    assert.ok(patch.includes(`${key}: {`), `${key} must be applied by the patch script`);
  }
  assert.match(photos.whisk.image, /Whisk_%28IMG_0265%29/);
  assert.match(photos.fryingPan.image, /Frying_Pan_2_2019-03-21/);
  assert.match(photos.skilletCast.image, /Griswold_cast_iron_skillet/);
  assert.match(photos.pan.image, /Stainless_Steel_Frying_Pan/);
  assert.match(photos.pan.credit, /CC BY-SA 4\.0/);
  const TEN = {
    grater: /K%C3%BCchenreibe_1/,
    ladle: /Aluminium_ladle/,
    sieve: /Durchschlag/,
    griddle: /Griddle_%28shallow_pan%29/,
    sheet: /Vollrath_Cookie_Sheet/,
    wok: /Wok_2/,
    rollingpin: /Rolling_pin_2017/,
    blender: /Old_blender_on_shelf/,
    bowl: /Masoncash_cane_mixing_bowl/,
    saucepan: /WMF-Fusiontec-Mineral-Multipot_02/,
  };
  for (const [key, pattern] of Object.entries(TEN)) {
    assert.ok(photos[key], `${key} must carry a photograph`);
    assert.match(photos[key].image, pattern);
    assert.match(photos[key].credit, /CC BY(-SA)?( 2\.0| 2\.5| 3\.0| 4\.0)?|CC0|Public domain/);
    assert.doesNotMatch(photos[key].credit, /non-?commercial|\bNC\b|no deriv|\bND\b/i);
  }
  assert.match(patch, /whisk:/);
  assert.match(patch, /fryingPan:/);
});
