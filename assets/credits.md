# Credits and sources

## Recipes

### Bundled samples

- **Spicy Arrabiata Penne**: TheMealDB, meal 52771. <https://www.themealdb.com/meal/52771>
- **Honey Teriyaki Salmon**: TheMealDB, meal 52773. <https://www.themealdb.com/meal/52773>
- **Pancakes**: TheMealDB, meal 52854. <https://www.themealdb.com/meal/52854>
- **Salmon noodle soup**: TheMealDB, meal 53234. <https://www.themealdb.com/meal/53234>
- **Classic Beef Chili**: Food & Wine, recipe by Robby Melvin.
  <https://www.foodandwine.com/recipes/classic-beef-chili>
  The bundled record is the page's schema.org `Recipe` data, captured 2026-11-10.

### Caribbean publisher recipes

The 714 records in `js/caribbean-sources.js` preserve each publisher's published
recipe text — schema.org `Recipe` JSON-LD, or the recipe-card markup the publisher
serves (the same data behind the page's Recipe block). Country labels follow the

publisher's recipe context; they are browsing labels, not claims of origin or
authenticity. An “(inspired)” suffix stays on dishes the publisher presents as inspired.

- **Pepperpot on Christmas Morning** (Guyana): Alica's Pepperpot, by Alica.
  <https://www.alicaspepperpot.com/pepperpot-on-christmas-morning/>
- **Trinidad-Style Curry Chicken** (Trinidad & Tobago): The Black Peppercorn, by Steve Cylka.
  <https://www.theblackpeppercorn.com/trinidad-style-curry-chicken/>
- **Ropa Vieja** (Cuba): Immaculate Bites, by Imma Adamu.
  <https://www.africanbites.com/ropa-viego/>
- **Coquito** (Puerto Rico): My Forking Life, by Tanya Harris.
  <https://www.myforkinglife.com/coquito/>
- **Haitian epis**, **Haitian Pikliz**, **Bahamian Conch Salad Recipe**, **Cornmeal Cou Cou**,
  **Conkies**, **Dominican Mangu**, **Green Fig Salad**, **Nutmeg Chicken**, **Jamaican Ackee and
  Saltfish**, **Jamaican Oxtail Stew**, **Jamaican Curry Goat**, **Jamaican Callaloo**,
  **Saltfish and callaloo**, **Trinidad Macaroni Pie**, **Jamaican Fruit Cake**,
  **Instant Pot Picadillo**, **Yuca Con Mojo** and **Vegan Mofongo**: That Girl Cooks Healthy, by Charla.
  <https://thatgirlcookshealthy.com>
- **Black Cake**, **Soup Joumou**, **Oil Down**, **Pom**, **Johnny Cake**, **Salt Fish Cakes**,
  **Locrio de Pica Pica**, **Sawine**, **Pernil Asado**, **Pelau** and **Jamaican Patty**:
  196 Flavors. <https://www.196flavors.com>
- **Rice & peas** and **Jerk chicken** (Jamaica): BBC Good Food.
  <https://www.bbcgoodfood.com/recipes/rice-and-peas> ·
  <https://www.bbcgoodfood.com/recipes/jerk-chicken>
- **The 406 records read from Cooking with Ria** (mostly Trinidad & Tobago, plus Jamaica,
  Guyana, Cuba, Puerto Rico, Haiti, Barbados, Dominican Republic, Grenada, The Bahamas,
  Suriname and Belize): <https://cookingwithria.com>, by CookingwithRia. The manifest
  `tools/build-cookingwithria.mjs` reads the site's public REST API and keeps every post
  whose recipe card meets the data contract (ingredients and instructions present); one
  card with no steps stays out rather than enter as an incomplete record. Multi-card
  posts link each record to its own recipe-card anchor.
  As of 2026-11-17, every Cooking with Ria record carries its own publisher page
  photograph (hot-linked, never bundled), backfilled by `tools/apply-publisher-photos.mjs`
  from each page's JSON-LD Recipe image or `og:image` — replacing earlier Wikimedia
  search matches, many of which depicted the wrong subject. Older saved copies of those
  false-positive photos are corrected when the app loads via `js/legacy-photo-fixes.js`.
  One reviewed exception keeps an illustration instead of a misleading photograph
  (the Grilled Lamb Kabobs page features a rice table-setting image). The pancake
  record is titled "Pancakes" and shows the page's blueberry pancake stack.

  The same backfill was applied to every other publisher in the bundled
  Caribbean and African collections — That Girl Cooks Healthy, Chef Lola's Kitchen,
  196 Flavors, CaribbeanPot.com, BBC Good Food, My Forking Life, Immaculate Bites,
  Alica's Pepperpot and The Black Peppercorn — replacing each record's image with
  the photograph published on its own source page (the same hot-linked,
  never-bundled policy). TheMealDB records keep the API's recipe-specific
  thumbnails. Pages with no usable photo keep the previous image and are listed
  as misses rather than invented.
- **The 273 records read from CaribbeanPot.com** (mostly Trinidadian, Jamaican and
  fusion cooking): <https://caribbeanpot.com>, by Chris De La Rosa and Sandie Markle.
  `tools/build-caribbeanpot.mjs` applies the same contract to the site's REST API.
  Six posts whose recipes publish no ingredient list anywhere — the card, the print
  view and the schema.org Recipe block — are excluded.
  Multi-card posts link each record to its own recipe-card anchor.
  **Caribbean Christmas Ham** (2026-11-18) is a hand-transcribed exception: this 2012
  page publishes no schema.org Recipe block, so its ingredients and steps were copied
  verbatim from the post body into the record (timings remain unknown, as unstated).
  Its photo comes from the same page, hot-linked, never bundled.
  **Traditional Caribbean Pineapple Juice** uses the photograph published
  on its [recipe page](https://caribbeanpot.com/traditional-caribbean-pineapple-juice-2/)
  (CaribbeanPot.com / Chris De La Rosa), hot-linked rather than bundled.
  This one reviewed exception replaces a false-positive Wikimedia search
  result showing a house.
- A further set of reviewed exceptions replaced Wikimedia search false
  positives in the legacy bundle with the publisher's own page photographs
  (hot-linked, never bundled), tracked in `js/legacy-photo-fixes.js`:
  Trinidad Fried Bake showed a restaurant storefront; Cheesy Aloo Pie showed
  an Indian aloo paratha; the Caribbean Empanadas record showed an Argentinian
  empanada from a Brighton event; other reviewed records pointed at unrelated
  subjects (a coin for sawine, a train carriage for cou cou, and more).
  Cheesy Aloo Pie shows the page's featured basket photograph, not the
  Recipe card's torn-open close-up.

Vegan versions keep the word “vegan” in their source names. The Coquito card lists
`½ ground cinnamon` without a unit; Mise preserves that gap instead of guessing a unit.

### Beverage and pastry research additions

The 24 beverage records and 37 pastry records in `js/additions.js` were read
from their publishers' public schema.org `Recipe` data by `tools/build-additions.mjs`.
Beverages cover aguas frescas, lassi/doogh, teas and coffees, hibiscus and
ginger drinks, hot chocolate, Christmas eggnog-style drinks and wine-and-beer
mixes. The pastry catalogue covers the Caribbean — Jamaican/Haitian/Trinidad
patties, Trini fry bake (floats), aloo and cheesy aloo fried pies, Trinidad empanadas,
currants roll, Tourment d'Amour, pastelles — and international hand and
festival pastries (filo, tarts, samosas, banitsa, empanada gallega, pastel
Mandi'ó, Cape Verde pastels, fatayer, sambousek, egg brick, sari burma).
Publisher wording, times and yields are preserved as published; photographs are
hot-linked, not bundled. A `No` creative-commons flag is **not** a licence to
redistribute that image.

The five Caribbean fried-pie additions (Trinidad fried bake, aloo pie, cheesy
alloo pie, Trinidad empanadas, pastelles) point at the same source URLs as
records already in the Caribbean publisher bundle; they are kept in the
additions manifest because their names don't match the Pastry course's name
heuristic, and the app dedupes catalogue rows by sourceUrl, so only one row
renders. The Caribbean bundle copies of those pages had Wikimedia search
false positives as photographs; they were corrected in this pass via
`js/legacy-photo-fixes.js` (publisher page photographs, hot-linked).

- Beverages: <https://196flavors.com/mexico-horchata/> through
  <https://196flavors.com/mojito/>
- Pastries: <https://196flavors.com/jamaican-patty/> through
  <https://196flavors.com/armenia-sari-burma/>

Note: two publishers' records are both titled "Empanadas" (196 Flavors'
Colombian page and Cooking with Ria's Trinidad page); they remain distinct
records with separate source links and photographs.

The generator skips a record whose publisher page has no usable schema.org
Recipe data instead of inventing one.

### Expansion pass (2026-11-17)

The records in `js/expansion.js` were generated by `tools/build-expansion.mjs`
from three public sources, documented and reviewed in `tools/recipe-sources.json`:

- **109 beverages from TheCocktailDB's public API** (test key, bounded
  named-family searches — mojito, margarita, colada and similar — retained only
  when the API record includes a name, ingredients and instructions). The free
  API is intended for development/education; an app-store release would need
  the paid key. The API's recipe-specific thumbnail is **hot-linked**, not
  downloaded or bundled; recipe pages credit TheCocktailDB and carry any
  supplied photographer attribution. `strCreativeCommonsConfirmed` and the
  original photo-source URL remain on each record; a `No` value is not a
  redistribution licence. Photograph loading requires a connection; offline
  displays fall back to Mise's cover illustration. Alcohol status stays as the API
  labels it — `Alcoholic` (89), `Non alcoholic` (18) and `Optional alcohol` (2)
  are all preserved and never collapsed. Distinct publishers' versions (e.g.
  Long Island Tea and Boston Sidecar) are distinct records and retained.
  Source links: <https://www.thecocktaildb.com>
- **66 Caribbean recipes from 196 Flavors' public country archives**
  (`/category/continent/americas/caribbean/<country>/`), e.g. Haiti 17, Cuba 19,
  Dominican Republic 12, Puerto Rico 4, plus smaller counts from Barbados, the
  Bahamas, Grenada, Saint Lucia, Antigua and Barbuda, Dominica, Jamaica,
  Trinidad and Tobago. Same schema.org Recipe data contract and same skip-not-
  invent rule; five pages with no usable Recipe data were skipped
  (`docs/recipe-acquisition-report.json`). Mise preserves these records under
  the same personal-use, source-attribution policy as the rest of the 196
  Flavors content — and as with the other 196 Flavors records, their copyright
  is retained by the publisher.
- **147 meals from TheMealDB's public API**, bounded searches in 17 everyday
  categories (chicken, fish, lentil, chickpea, vegetable, rice, pasta, soup,
  salad, egg, tart, pie, bread, curry, tofu, bean, potato — capped per search),
  deduplicated against the existing bundle by meal ID.

Country archive membership is a browsing association, not a claim of exclusive
origin. Missing measures, yields and times are kept missing; nothing is filled
in. Acquisition details are in `docs/recipe-acquisition-report.json` and
`docs/recipe-expansion.md`.

### African publisher recipes

The 16 records in `js/africa-sources.js` cover cuisines TheMealDB's area filter does
not list. They are read from the page's schema.org `Recipe` data and keep the
publisher's wording.

- **Nigerian Jollof Rice**, **Suya**, **Egusi Soup**, **African Puff puff**, **Moin Moin**,
  **African Pepper Soup**, **Efo Riro**, **Doro wat**, **Injera**, **Kelewele**,
  **Nyama Choma**, **Mandazi** and **East African Chapati**: Chef Lola's Kitchen.
  <https://cheflolaskitchen.com>
- **Bunny chow** (South Africa): BBC Good Food.
  <https://www.bbcgoodfood.com/recipes/bunny-chow>
- **Bobotie** (South Africa) and **Waakye** (Ghana): 196 Flavors.
  <https://www.196flavors.com/bobotie/> · <https://www.196flavors.com/waakye/>

## Photographs

- Arrabiata, teriyaki, pancakes and salmon soup: TheMealDB meal photographs.
- Classic Beef Chili: Caitlin Bensel for Food & Wine.
- Publisher-based Caribbean and African records carry the publisher's own recipe
  photo on the record, credited to the publisher on the detail view (hot-linked
  from the publisher page, `tools/build-publisher-images.mjs`). Nothing publisher-owned is bundled.
- Commons-filmed publisher records (or ones for which Commons offered a closely
  related dish that the publisher did not photograph) carry a Commons thumbnail
  credited to the Commons author with its license; those are rare, most
  records use the publisher's own photo.
- Records with no recoverable photo (publisher card without an image, or Commons
  confidence too low) carry one of Mise's own programmatic SVG cover plates —
  original line art in the house palette, drawn by `tools/build-plates.mjs`.
- Kitchen-tool line illustrations shown by the cook-mode tool popover are
  original to Mise (`js/tools.js`), drawn in the house stroke style. The Android
  status-bar pot icon (`android/app/src/main/res/drawable/ic_pot.xml`) is
  likewise original.
- The automated voice guide's fixed phrases ("Step 1"–"Step 40" and the two
  confirmations — for Carol and Sean both) are synthesized once at build time
  with Kokoro-82M (hexgrad/Kokoro-82M, Apache-2.0), voice `af_heart` (Carol)
  and `am_michael` (Sean), American English, speed 0.92; they ship as
  `assets/voice/carol/*.wav` and `assets/voice/sean/*.wav` and were rendered by
  `tools/render-voice-pack.py`. Everything else — step text and all other
  fixed lines — goes through the device's own text-to-speech engine, or the
  Web Speech API in browsers. Audio never reaches a network service; Mise
  receives only the recognized words or an error code, and no recordings are
  stored, kept or uploaded.
- Kitchen-tool photographs shown by the tool popover are hot-linked from
  Wikimedia Commons under each file's own license (CC-BY, CC-BY-SA, CC0 or the
  public domain — never NC/ND); the author, license and file page are credited
  in the popover itself. `tools/build-tool-images.mjs` searches, scores and
  licenses-checks candidates; `tools/patch-tool-images.mjs` applies the
  hand-verified corrections for weak or mismatched matches. Reviewed
  2026-11-18: the Whisk
  photo (Matti Blume, CC BY-SA 4.0,
  [Whisk (IMG 0265)](https://commons.wikimedia.org/wiki/File:Whisk_(IMG_0265).jpg))
  and the frying-pan photo (FASTILY, CC BY-SA 4.0,
  [Frying Pan 2 2019-03-21](https://commons.wikimedia.org/wiki/File:Frying_Pan_2_2019-03-21.jpg))
  were picked to replace misleading or food-heavy matches; the cast-iron
  skillet photo (NMorales (WMF), CC BY-SA 4.0,
  [Griswold cast iron skillet](https://commons.wikimedia.org/wiki/File:Griswold_cast_iron_skillet.jpg))
  teaches the cast-iron tool specifically. The remaining six tools also gained
  subject-correct photographs reviewed 2026-11-18: the wooden-spoon popover
  (Edukatori, CC BY 4.0,
  [Lugë druri](https://commons.wikimedia.org/wiki/File:Lug%C3%AB_druri.jpg)),
  the Instant Pot popover (Your Best Digs, CC BY 2.0,
  [Instant Pot DUO60 pressure cooker](https://commons.wikimedia.org/wiki/File:Instant_Pot_DUO60_pressure_cooker.jpg)),
  the baking-dish popover (Cullen328, CC BY-SA 4.0,
  [Emile Henry ceramic casserole dish](https://commons.wikimedia.org/wiki/File:Emile_Henry_ceramic_casserole_dish.jpg)),
  the mortar-and-pestle popover (Evan-Amos, public domain,
  [White-Mortar-and-Pestle](https://commons.wikimedia.org/wiki/File:White-Mortar-and-Pestle.jpg)),
  the air-fryer popover (Ashley Pomeroy, CC BY 4.0,
  [Air Fryer 5458](https://commons.wikimedia.org/wiki/File:Air_Fryer_5458.jpg))
  and the cutting-board popover (Donovan Govan, CC BY-SA 3.0,
  [Chopping Board](https://commons.wikimedia.org/wiki/File:Chopping_Board.jpg)).
  The generic Pan photo (Drmarathe, CC BY-SA 3.0, Into the frying pan — two
  pans on a stove) was also replaced with a single stainless-steel pan on an
  induction hob (Jim Stonos, CC BY-SA 4.0,
  [Stainless Steel Frying Pan](https://commons.wikimedia.org/wiki/File:Stainless_Steel_Frying_Pan.jpg)).
  Further 2026-11-18 review: Grater (Superbass, CC BY-SA 4.0,
  [Küchenreibe 1](https://commons.wikimedia.org/wiki/File:K%C3%BCchenreibe_1.jpg)),
  Ladle (Rajani Gairshail, CC BY-SA 4.0,
  [Aluminium ladle](https://commons.wikimedia.org/wiki/File:Aluminium_ladle.jpg)),
  Sieve (EvaK, CC BY-SA 2.5,
  [Durchschlag](https://commons.wikimedia.org/wiki/File:Durchschlag.jpg)),
  Griddle (Susan Slater, CC BY-SA 4.0,
  [Griddle (shallow pan)](https://commons.wikimedia.org/wiki/File:Griddle_(shallow_pan).jpg)),
  Baking sheet (Veganbaking.net from USA, CC BY-SA 2.0,
  [Vollrath Cookie Sheet](https://commons.wikimedia.org/wiki/File:Vollrath_Cookie_Sheet_(4858589805).jpg)),
  Wok (Chris Feldmann, CC BY 2.0 — no people,
  [Wok 2](https://commons.wikimedia.org/wiki/File:Wok_2.jpg)),
  Rolling pin (Fructibus, CC0,
  [Rolling pin 2017](https://commons.wikimedia.org/wiki/File:Rolling_pin_2017.jpg)),
  Blender (Infrogmation of New Orleans, CC BY-SA 4.0,
  [Old blender on shelf in New Orleans kitchen](https://commons.wikimedia.org/wiki/File:Old_blender_on_shelf_in_New_Orleans_kitchen.jpg)),
  Bowl (RLiverpool2021, CC BY-SA 4.0,
  [Masoncash cane mixing bowl](https://commons.wikimedia.org/wiki/File:Masoncash_cane_mixing_bowl.jpg))
  and Saucepan (RuinDig / Yuki Uchida, CC BY 4.0,
  [WMF-Fusiontec-Mineral-Multipot 02](https://commons.wikimedia.org/wiki/File:WMF-Fusiontec-Mineral-Multipot_02.jpg)).
- Step photographs referenced in the Food & Wine source data are by Molly Bolton; Mise does not
  re-host them.

## Typeface

- Fraunces (display) — SIL Open Font License 1.1, bundled Latin fonts in `assets/fonts/`.
- Manrope: SIL Open Font License 1.1. Latin subset bundled in `assets/manrope-latin.woff2`.
- Caveat (handwritten ingredient labels) — SIL Open Font License 1.1; bundled in `assets/fonts/`.

## Sounds

- Timer expiry ringtones are synthesized in the browser with the Web Audio API
  (`js/app.js`, `RINGTONE_DEFS`) — sine oscillators, no audio files ship in the app.
- The voice guide's fixed phrases are pre-rendered Kokoro clips; everything else
  goes through the device's own speech service (Samsung TTS on Samsung tablets,
  Google Speech Services elsewhere, or the system default).

## Runtime data

- Live search and live recipe records come from TheMealDB's public API (`themealdb.com/api`).
- `js/caribbean.js` caches the 27 meals TheMealDB returned for Jamaica, the only Caribbean-facing
  area with results at generation time. Other queried areas returned zero **in TheMealDB**, not
  elsewhere. Together with the 714 publisher recipes, the Caribbean collection holds 741 records
  across 13 places and does not claim to cover the entire Caribbean.
- `js/africa.js` caches all 39 meals TheMealDB returns for Algerian, Egyptian, Kenyan, Moroccan and
  Tunisian. The 16 publisher recipes add Nigerian, Ghanaian, Ethiopian, Kenyan and South African
  cooking. The African collection holds 55 records across 9 places; it is not a survey of the
  continent.
- `js/global.js` holds 130 recognition-led records across 23 cuisines. It is a cross-section of
  dishes a reader is likely to recognise, not a ranking of popularity, authenticity or national
  importance.
- A public-area audit on 2026-11-10 found 195 unique area labels in TheMealDB's `list.php?a=list`,
  29 areas returning meals, and 472 meal matches under `filter.php?a=`. Mise reports coverage gaps
  instead of representing the set as world-complete.
- `tools/build-cookingwithria.mjs` and `tools/build-caribbeanpot.mjs` regenerate the
  two Cooking with Ria and CaribbeanPot.com records from their public WordPress REST APIs.
  `tools/build-collections.mjs` regenerates the TheMealDB snapshots and publisher collections
  from the URLs above. None of them writes or paraphrases a recipe.
- `tools/build-plates.mjs` writes the programmatic SVG cover plates used for records
  with no publisher photograph. They are original, text-free line art in the house
  palette, not model-generated images.
- Imported links are read in the browser from the page's own schema.org `Recipe` JSON-LD. The page's
  text, photographs and marks remain the publisher's.
