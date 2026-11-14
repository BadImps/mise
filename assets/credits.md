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

The 442 records in `js/caribbean-sources.js` preserve each publisher's published
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

Vegan versions keep the word “vegan” in their source names. The Coquito card lists
`½ ground cinnamon` without a unit; Mise preserves that gap instead of guessing a unit.

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
- Publisher-based Caribbean and African records do not bundle or hot-link publisher photographs.
- Step photographs referenced in the Food & Wine source data are by Molly Bolton; Mise does not
  re-host them.

## Typeface

- Fraunces (display) — SIL Open Font License 1.1, bundled Latin fonts in `assets/fonts/`.
- Manrope: SIL Open Font License 1.1. Latin subset bundled in `assets/manrope-latin.woff2`.
- Caveat (handwritten ingredient labels) — SIL Open Font License 1.1; bundled in `assets/fonts/`.

## Runtime data

- Live search and live recipe records come from TheMealDB's public API (`themealdb.com/api`).
- `js/caribbean.js` caches the 27 meals TheMealDB returned for Jamaica, the only Caribbean-facing
  area with results at generation time. Other queried areas returned zero **in TheMealDB**, not
  elsewhere. Together with the 442 publisher recipes, the Caribbean collection holds 469 records
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
- `tools/build-collections.mjs` regenerates the TheMealDB snapshots and publisher collections from
  the URLs above. `tools/build-cookingwithria.mjs` regenerates the Cooking with Ria records from the
  site's public WordPress REST API. Neither writes or paraphrases a recipe.
- Imported links are read in the browser from the page's own schema.org `Recipe` JSON-LD. The page's
  text, photographs and marks remain the publisher's.
