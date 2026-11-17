# Mise — beverage and pastry research (2026-11-17)

> Superseded the same day: the acquisition pass in `docs/recipe-expansion.md` adds 109 API beverages, 66 Caribbean records and 147 meals. The drinks shelf now holds 162 matches; this document remains as the record of the earlier 196-flavors additions.

_Personal, non-commercial build. No sale, no accounts, no cloud required — the offline promise stays absolute. Everything below is sourced from public recipe pages; nothing was invented._

Method: ECC-assisted web-research pass over international and Caribbean drinks and pastries, plus an audit of the bundled catalogues and TheMealDB search coverage. Every new record in `js/additions.js` was read from the publisher's own schema.org `Recipe` data by `tools/build-additions.mjs`. The generator skips a page with no usable schema.org Recipe data instead of guessing.

## Executive summary

- TheMealDB is not a useful source for beverage coverage; searching it for drink terms mostly returns steaks, salads and desserts. Its one real beverage hit is `Creamy mango smoothie` (53569). The Caribbean publisher records already hide 23 drink matches in `js/caribbean-sources.js`; international coverage was effectively absent.
- Rather than fake a “beverage category” out of mains that happen to name a drink, Mise now bundles 24 beverage records from 196 Flavors — aguas frescas, lassi/doogh, teas and coffees, hibiscus and ginger drinks, hot chocolate and the Caribbean/Christmas eggnog family — alongside the existing Caribbean drinks.
- A new **Pastry** course shelf follows the same pattern with 23 new international and Caribbean records: patties, empanadas, filo, tarts, festival pastries and turnovers. `start-cook` now reads **Start Mixing** for anything classified as a drink.

## Research: popular beverages and mixes

### Representation

Existing coverages were found in the bundled Caribbean records and in TheMealDB's dessert/sample set. International classes with no representation were the target for additions, not a rewrite of what already shipped.

| Family | Examples covered | Where it came from |
|---|---|---|
| Aguas frescas & Latin American | Horchata, Chicha Morada, Agua de Panela, Jamaican roots already present in CaribbeanPot/Ria | 196 Flavors |
| Yoghurt & cultured | Mango Lassi, Doogh (Persian yogurt drink), Akasan | 196 Flavors |
| Teas & coffees | Thai Iced Tea, Teh Tarik, existing Caribbean cocoa teas | 196 Flavors; CaribbeanPot/Ria |
| Hibiscus & ginger | Bissap (Wonjo), Ginger Juice (Gnamakoudji), Ginja Beer (Ginger Beer), existing Caribbean sorrel | 196 Flavors; CaribbeanPot/Ria |
| Hot chocolate | Chocolate Caliente, El Submarino, existing cocoa teas and cocoa drinks | 196 Flavors; CaribbeanPot/Ria |
| Christmas / winter | Coquito, Crémas, Ponche Crema, Cola de Mono | 196 Flavors |
| Wine & beer mixes | Sangria, Tinto de Verano, Mojito, Chuflay | 196 Flavors |
| Lemonades & citrus | Citronnade (Tunisian Lemonade), existing Caribbean lemonades | 196 Flavors; CaribbeanPot/Ria |
| Smoothies & shakes | Creamy mango smoothie (TheMealDB 53569), existing peanut butter and banana smoothie | TheMealDB; CaribbeanPot/Ria |

### Seasonal skew found in the research

- **Winter/Christmas:** Coquito, Crémas, Ponche Crema, Cola de Mono (all alcoholic/cream-based in the publisher's framing; Mise keeps the alcohol because it preserves the publisher's recipe as published).
- **Summer/agua fresca:** Horchata, Chicha Morada, Aguapanela, Bissap, Ginger Juice, Citronnade, Thai Iced Tea, Teh Tarik.
- **Everyday:** Mango Lassi, Doogh, Akasan, Sobia, Sharbat.

### Integration

- Drinks & Beverages shelf now includes these 24 new records; existing imported kitchen drinks open from `In your kitchen`, unimported records carry a `Read` button like any other catalogue source.
- Beverage types are categorized on the shelf by chips: `Punches`, `Smoothies`, `Sorrel & mauby`, `Teas & coffees`, `Lemonades`, `Juices`, `Other drinks`. `Cocktails` appears when a cocktail is present in the match set.
- `All Recipes → All categories` includes `Drinks & Beverages`.
- `Start cooking` becomes `Start mixing` for anything classified as a drink; no copy changes anywhere else.

### What we deliberately did not do

- **No invented flavours or variants.** If a publisher's page publishes no usable schema.org Recipe data, the record is skipped, not paraphrased.
- **No alcohol-free rewrite of published recipes that contain alcohol.** The publisher keeps its framing; Mise preserves the publisher's text.
- **No “viral” drink generated from popularity lists.** The 196 Flavors set was chosen for recognition and coverage, not for trend-chasing.
- **No nutrition charting in this pass.** Capture-when-present at import remains the untracked nutrition roadmap item for later.

## Research: pastries

TheMealDB does not carry a pastry category, and its search coverage of pastries is narrow — it has tarts/pies and a few empanadas, but nothing for the Caribbean pastry tradition outside patties and macaroni pie. “Macaroni Pie” is a baked pasta casserole, not a pastry, and stays out of the Pastry shelf.

### What was added

The 23 new pastry records cover:

- **Caribbean and Latin America:** Jamaican Patty, Trinidad Currants Roll, Saint Kitts Tourment d'Amour, Haitian Patty, Colombian Empanadas, Salvadoran Pastelitos, Bolivian Salteñas.
- **Europe:** Portuguese Pastéis de Nata, Austrian Apfelstrudel, Serbian Bundevara, Spanish Churros-adjacent style desserts are excluded because they are not pastry shells.
- **Middle East and North Africa:** Baklava, Kataifi, Kanafeh, Makroud, Samsa, Yoyos, Debla, Maamoul, Cornes de Gazelle, Moroccan Almond Cigars, Greek Galaktoboureko, Bougatsa, Oum Ali.

### Caribbean coverage review

The existing 741 Caribbean records still include:

- **Patties and empanadas:** Jamaican Beef Patties, Jamaican Patty, Cousin Maria's Extra Cheesy Macaroni Pie (macaroni pie stays out), Empanadas, Salmon Pie (Fried Bake).
- **Festival/fried dough:** Jamaican Fried Dumplings, Festival (Sweet Dumpling) — these remain in the kitchen catalogue but are not labelled pastry because they are dumplings/fritters, not laminated/shortcrust/pie pastry.
- **Tarts/pies:** Trinidad Macaroni pie stays out; Trini Custard Pie, Salmon Pie and Trini Macaroni Pie remain in the import index as casseroles, not pastry.

### Integration

- New **Pastry** course shelf in My Kitchen, grouped under Courses.
- Pastry appears in `All Recipes → All categories`, the Hub's Courses group, and imports work the same one-tap way as other source records (`import-pastry-source`).
- The Pastry shelf uses the same structure as other course shelves: source tabs, search, source-filter chips.

## Validation

- `tools/build-additions.mjs` finished with **24 drink records and 23 pastry records, zero skipped**, all with publisher-schema ingredients, instructions and yields.
- Attribution: `assets/credits.md` records the 196 Flavors source set, the generator and the manifest. No text was rewritten into Mise; the publisher's own wording is preserved.
- Visual/functional pass: Hub grouping, Pastry card, All Recipes category chips, Start Mixing label, `Read` import flow for both new kinds are covered by the normal browser QA path.

## Known gaps

- The Caribbean pastry corpus has no dedicated sweet/savoury classification beyond the existing category filters.
- TheMealDB has no beverage catalogue; future additions still need publisher-schema or manual curation, not TheMealDB search.
- Drinks is not yet sub-categorized under the Pastry shelf search; the All categories chip filters kitchens only, not unimported catalogue records.
- Import tooling can bring in the new records individually, but there is no “Import all 47” one-click button yet; add-on pack import remains a future OTA item.
