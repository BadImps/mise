# Recipe expansion — 17 November 2026

Bounded acquisition pass over drinks, Caribbean meals and everyday meals, plus
storage-cap fixes and catalogue browsing in the app. Nothing was released; no
version number was bumped.

## What was acquired (verified by `docs/recipe-acquisition-report.json`)

| Set | Count | Source | Method |
|---|---|---|---|
| Alcoholic/non-alcoholic mixes & everyday drinks | 109 | TheCocktailDB public API | 32 named-family searches, capped; `recipe-acquisition-report.json` |
| Caribbean records | 66 | 196 Flavors public country archives (13 countries) | Archive page walk, page-level cap 3, deduplicated by source URL |
| Everyday meal records | 147 | TheMealDB public API | 17 category searches capped per search, deduped by meal ID |

Totals in `js/expansion.js`: **109 drinks, 66 Caribbean, 147 meals** (~672 KB,
loaded as a static script; TheCocktailDB images are hot-linked, not bundled).
Pre-existing bundle: 978 records → **1,300 bundled records**.

TheCocktailDB alcohol labels are preserved: 89 `Alcoholic`, 18 `Non alcoholic`,
2 `Optional alcohol`. Nothing unspecified was labelled alcohol-free. Base-spirit
and occasion filters are local browsing heuristics over source ingredients and
names, not publisher claims.

The Caribbean archive dive is uneven: Haiti 17, Cuba 19, Dominican Republic 12,
Puerto Rico 4, Jamaica 3, Trinidad and Tobago 3, single-digit records from
Barbados, the Bahamas, Grenada, Saint Lucia, Antigua and Barbuda and Dominica;
Saint Kitts and Nevis returned 0 usable records. Five individual pages were
skipped for lacking schema.org Recipe data. Country archive membership is a
browsing association, not an origin claim.

Source terms review (2026-11-17) lives in `tools/recipe-sources.json`:
TheCocktailDB/TheMealDB permit API-derived copying but app-store release
requires the paid key, and third-party content (images included) has separate
rights — the CocktailDB pass hot-links the official thumbnail with attribution
but bundles no artwork. A `No` creative-commons flag is **not** a licence to
redistribute that image. The 196 Flavors acquisition is
under the same personal-use, preserve-attribution policy as the existing bundle.
Neither is permission to publish a redistributed public mirror.

## Acquisition pipeline

`node tools/build-expansion.mjs`:

- Caches HTTP responses in ignored `.recipe-cache/`, so interrupted runs resume.
- Reads existing bundles to deduplicate by meal ID and source URL; distinct
  publisher versions of the same dish are kept.
- Uses the publisher-Recipe contract from `build-additions.mjs`: skips pages
  with no usable schema.org Recipe data rather than paraphrasing.
- Refuses to write `js/expansion.js` unless minimum thresholds pass
  (≥60 drinks, ≥30 Caribbean, ≥80 meals); existing files untouched otherwise.
- Writes `docs/recipe-acquisition-report.json` with counts, queries, country
  coverage and skips.
- TheCocktailDB records carry alcohol status, glass, ingredients, instructions,
  tags, category, and image provenance. Their recipe-specific photos are
  hot-linked from the official API; images are never copied into the app.

## Browsing changes

- **My saved recipes** (`All Recipes → My saved recipes`) is the user's kitchen.
- **Full catalogue** (`All Recipes → Full catalogue`) searches every bundled
  record offline; `Read` saves one locally. Rows dedupe identical records by
  key while keeping genuinely distinct publishers' versions.
- **Drinks & Beverages** gained three filters on top of the type chips:
  alcohol (source labelled: Any / Contains alcohol / Alcohol-free (source
  labelled) / Optional alcohol / Not specified), base spirit
  (rum/gin/vodka/tequila & mezcal/whisky, bourbon & rye/brandy/cognac &
  pisco/wine & champagne & vermouth/liqueurs), and occasion
  (Christmas & festive / warming / summer / punches & parties — explicitly
  marked browsing suggestions, not source claims).
- Filtering keeps URL-matched saved recipes linked to their kitchen entries;
  nothing browses into another user's saved list.
- Toasts, imports and announced failures all return keyboard focus to harmless
  standpoints; failed saves now announce instead of silently returning.

## Storage fixes (with tests)

`tools/test-expansion.mjs` (run with `node --test tools/test-expansion.mjs`):

1. Before the fix, saving recipe 801 **evicted the oldest saved recipe**
   (the 800 cap). After: nothing is evicted (`IMPORTED_CAP` deleted).
2. Before, a failed `localStorage` write returned success and navigated into a
   recipe that was never persisted. After: save rolls the in-memory kitchen
   back to the durable snapshot and leaves `localStorage` untouched.
3. Before, a failed bulk flush left the in-memory list holding recipes the
   device did not have. After: batch rollback to the pre-batch snapshot with
   an assertive announcement.

RED: all three failed against the original code. GREEN: all pass now, along
with drink facet intersection tests and an all-records parse test (unique
source identities; TheCocktailDB records parse with `yields: null`).

This is not an IndexedDB migration: `localStorage` still has a quota. Saves
either persist fully or not at all, and the UI says so.

## Verification

- Pastry catalogue extended 2026-11-17 (same date, this session): 14 publisher
  pages added to the pastry manifest in `tools/build-additions.mjs` — five
  Caribbean fried-pie / baked pastries (Trinidad fried bake, aloo pie, cheesy
  aloo pie, Trinidad empanadas, pastelles; Cooking with Ria) and nine global
  pastries (empanada gallega, Cape Verde pastels, pastel Mandi'ó, fatayer,
  banitsa, samosa, sambousek, Tunisian egg brick, sari burma). The five
  Caribbean pages also ship in `js/caribbean-sources.js` (same URLs, so the
  app dedupes shelf rows by sourceUrl); the additions keep them typed as
  Pastry because their names don't match the course name heuristic. The
  Caribbean bundle copies had Wikimedia search false positives as photographs
  — a restaurant storefront, an aloo paratha, an Argentinian empanada, a
  salmon quiche, plus others — corrected in this pass via
  `js/legacy-photo-fixes.js`; Cheesy Aloo Pie shows the page's featured
  basket photograph instead of the Recipe card's close-up. One page
  (CaribbeanPot pastelles) had no schema.org Recipe data and was skipped in
  favour of Cooking with Ria's pastelles page, which does. `js/additions.js`
  now carries **24 drinks and 37 pastries**; every record has a hot-linked
  publisher photograph. Existing 47 records verified byte-identical after
  regeneration.
- `node --test tools/test-expansion-photos.mjs` — 2/2 pass after the initial
  RED checks found missing drink images/attribution. Every one of the 322 new
  expansion records has a source photo URL; the earlier 61 beverage/pastry
  research records also have source photos. All 383 newly gathered recipes
  therefore have a photograph when online.
- `node tools/verify-expansion-photos.mjs` — all 109 TheCocktailDB image URLs
  returned an image content type and a successful HTTP status (0 failed).
  This checks links now, not perpetual availability or offline caching.
- `node --check js/app.js` — ok.
- `node --test tools/test-expansion.mjs` — 6/6 pass.
- `node tools/verify-web.mjs` — OK (1 html, 3 css, 13 js, 24 local refs).
- Browser checks (in-app browser, cache-busted `index.html`):
  - Drinks shelf shows 162 drinks across source groups (TheCocktailDB 109 /
    Publisher 53); alcoholic + rum filter gives 34 matches and stays stable on
    re-render; console errors: none.
  - Margarita imported with `fetch` forced to reject → saved locally,
    `Start mixing` button, persisted across reload; the QA save was then
    removed from browser storage to restore its pre-test state.
  - Full catalogue view renders the offline 1,299-row deduped catalogue
    (647 KB expansion bundle is not OTA yet) with substring search.
- Impeccable detector warnings are pre-existing (`Fraunces`, side-tab borders,
  10px nav labels, 1.3:1 contrast pairing) and do not come from this pass;
  `PRODUCT.md`/`DESIGN.md` remain absent by design (narrow extensions preserved
  the incumbent visual system).
- No APK/Android build ran — no native code changed. No ANTLR release path
  touched either: nothing about this work is OTA unless a release is cut whose
  web bundle includes `js/expansion.js` (the packager ships `js/` wholesale).

## Known gaps

- Saint Kitts and Nevis yielded zero usable records; country coverage is
  whatever the public archives hold, not a complete survey.
- Country archive membership is not reviewed cuisine expertise; inspiring or
  diaspora styles can appear under a country archive.
- Recipe cards show real source photos when online. Offline recipe data remains
  usable, but hot-linked photographs may show the existing cover illustration.
- TheCocktailDB's `strCreativeCommonsConfirmed` flag does not alone establish
  redistribution permission; obtain permission/licence review before bundling.
- No automated test runs against real network. Acquisition correctness relies
  on the schema data contract and the generated report, not on unit tests
  mocking endpoints.
- `localStorage` quota remains a real limit for web saves; rollback handles
  failure honestly but cannot add space.
