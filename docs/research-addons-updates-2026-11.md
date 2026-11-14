# Mise — future addons and updates (research, 2026-11-14)

_Personal, non-commercial build. No sale, no accounts, no cloud required — the offline promise stays absolute. Roadmap items are ordered accordingly._

Method: ECC-assisted research pass over the repository (as pushed at v1.9.0), a market/competitor scan
(31 sources, cited inline), and a code audit on this date. Numbers and capabilities cited as of Nov 2026.

## Executive summary

Mise's differentiating position — offline-first, honest publisher recipes, no accounts, on-device voice — is
real, but the category expects voice flow, timers, scaling, shopping and nutrition as baseline. Most of the
high-leverage next steps are **web-OTA, sub-1 MB additive changes** that reuse what already works
(Kokoro-82M voice pack + the Samsung/Google TTS engine + the recipe-to-step index). The two structural
investments are:

1. **Android's system on-device speech stack** (ML Kit GenAI ASR/TTS, Nov 2026) — free, zero-APK, quota-backed.
2. **A guarded, opt-in Gemini Nano lane** for vision import — zero-byte via AICore, Pixel/Galaxy flagships only.

Everything else is ordinary product work. Rank by feasibility below; "OTA" = web-OTA release, no APK rebuild.

## What Mise has today (v1.9.0, verified Nov 2026)

- Single-page vanilla-JS web app (hash routing), zero frame/dep injection at runtime, ~2.1 MB of JS (incl. collections).
- APK bundles the web app (WebContentStore, atomic OTA with hash verification); OTA replaces JS/CSS/assets.
- Release artifacts: APK ≈9.3 MB with **zero native dependencies** (`android/app/build.gradle`, minSdk 26 / targetSdk 36); web bundle 11.7 MB (7.5 of it pre-rendered Kokoro clips). OTA zip ≈1.3 MB today, 48 MiB cap / 1,600-entry limit, 6-hour throttle — architecture:`manifest + SHA-256 verified staged swap` (docs/OTA.md). **All native bridge calls are feature-detected** (`typeof MiseNative.x === 'function'`), so OTA can ship ahead of APK safely.
- 24 commits in 4 days; release pipeline = GitHub Actions CI + manual workflow dispatch with signed APK (versionCode 12).
- Voice: Kokoro-82M English packs (Carol = af_heart, Sean = am_michael, 0.92 rate) pre-rendered for "Step 1–40" + 2
  confirmations; native bridge speaks via Samsung/Google/system TTS (which the user can now override per-persona),
  one-supported speech service → Kokoro clips as engine-less fallback; 2-minute silence pause; voice "ready" flow;
  timer prompt with Ready/Not-ready resolution; sorted voice picker + quality ranking.
- Recipe tooling: import from TheMealDB and publisher JSON-LD (CookingwithRia, CaribbeanPot, Chef Lola's Kitchen,
  196 Flavors, Food & Wine, BBC Good Food), offline keyword Chef matcher (94 pantry chips), scales ×1/×1.5/×2,
  ~741 Caribbean + 55 African + world-collection records, favorites, recent cooks, phone-first layout.
- Android: single-activity WebView, notification channel for in-flight cooks, FLAG_KEEP_SCREEN_ON during cook,
  kokoro "probe" APK for voice-quality QA (not on the cooked path).
- **Gaps (measured):** no automated UI/visual tests (only verify-web static checks + Android lint);
  no Kokoro fitness check beyond headless audio clips; both real TTS paths still unverified on physical Samsung
  hardware this session; manifest-driven OTA but no server-side rollout gates beyond hash + version checks.

## Voice-first UX debt we bought by not doing them earlier

1. **Voice cannot control the scale** — scaling needs a tap. [OTA]
2. **No auto-narrate / lock-screen mode** — reading a recipe aloud works step-by-step but nothing drives playback
   across the whole step-to-step turn reliably (the 2-min silence pause is the only pacing tool today). [OTA + light native]
3. **Listening cadence is fragile** — the 8s forced re-arm shipped with the "ready" flow at the same time the
   recognizer work landed; behavior on a silent Samsung engine still untested. [hid in practice]
4. **No nutrition at import** — the category expects it. [OTA persistent DB, 2–20 MB]
5. **No shopping list** — Mise has favorites/recent/checked state but no export and no cross-recipe merging. [OTA]

## Market reference set (Nov 2026)

Borrowed from what's actually shipping at the incumbents: Paprika 4 (voice narrate + voice scale + Alexa integration),
Glutt (live voice cook mode, camera inspect), Samsung Food (SmartThings oven push, vision-snap, Instacart checkout,
6M installs), SideChef (18k videos + voice), Crouton (iOS-26 on-device speech/choice + Apple Design Award 2024),
Cookline/SeeMeCook (voice-first, blind-first). Yummly shut Dec 2024. Paprika 4 voice commands if matched would flip
Mise's voice story from "niche" to "in the conversation" with one OTA release.

**Design implications, not negotiation positions**
- Voice conversation = free text → structured action. The existing `parseGuideCommand` regex set is the right
  seam; replace it behind one interface so Auris slots in unchanged while an on-device LLM (Nano via AICore)
  supplies non-canonical command interpretation as a *progressive enhancement*, never a requirement.
- Camera is a first-class ingredient/cell span for recipes in this category. One camera-OK prompt at import time
  closes three purchase fences: image verify, ingredient snap, "what's-in-the-fridge" match. All opt-in, all native.
- Offline promise is the moat; any add-on that breaks it is a UX tax to pay openly, not sneakily.

## Candidate add-ons — ranked by ICE (Impact/Confidence/Ease), web-OTA or native, APK cost

Scoring: impact 5, confidence 5, ease 5 (5 = highest). OTA = ships on OTA web bundle; native = APK rebuild required.

### Tier 1 — OTA, <= ~30 KB additional payload, direct ROI
| # | Add-on | I/C/E | Notes | Effort |
|---|--------|-------|-------|--------|
| 1 | **Voice serving scaling** — "double the recipe", "half", "×1.5", spoken; UI shows the change | 5/5/5 | parseGuideCommand extension + setScale(). Absolutely table-stakes by spring 2027 | 2–3 days |
| 2 | **Auto-narrate "cook-through"** — step-to-step without requiring tap; step N → voice announce, auto on new steps; pause on long timers; lock-screen/notification controls | 5/4/4 | Reuses cookNext/timer/say pipeline; needs media-session native bits for lock-screen controls | 1–2 weeks |
| 3 | **Per-step timer prompts** — "simmer 20 min → start timer?" auto-synced from sentence regexes; already seeded by the Ready/Not-ready flow | 5/5/5 | Extend both earlier stream regex grammars to mutation tests; one CI net | 2–5 days |
| 4 | **Shopping list (local, offline)** — merge across recipes, skip checked, un-check on "cooked", shareable HTML + local file | 4/5/4 | Reuse checkbox state; new route/list; no sync, no account | 1 week |
| 5 | **Serving scaling already exists** — extend timing to whole ingredient grammars (wedge sizes, pantry items) [KB] | 4/5/5 | Existing parser support | 2–5 days |

### Tier 2 — OTA or native, 30–500 KB, meaningful differentiation
| # | Add-on | I/C/E | Notes | Effort |
|---|--------|-------|-------|--------|
| 6 | **Unit & serving conversions** — g↔oz, tsp↔ml, cup→grams for ~60–100 staples; `parse.js` already carries `UNIT_WORDS`/`roundForUnit` | 4/5/4 | Deterministic; JSON data + parser math; pure OTA | S–M |
| 7 | **Nutrition capture-when-present at import** — publisher JSON-LD often carries `NutritionInformation`; `findRecipeNode` walks JSON-LD already | 4/4/4 | Capture publisher-published data; show only when parsed; no fabrication | S–M |
| 8 | **Substitution engine — curated, not generated** — ~150–300 attributed table entries; LLM optional enrichment, never invented values (preserves the “no invented data” rule) | 4/4/4 | Deterministic JSON at OTA | M |
| 9 | **Export/import kitchen state** — one JSON via share sheet / file picker: imports + pantry/scale/favorites/voice prefs | 4/4/5 | Account-free, zero servers; prereq for any future sync | S |
| 10 | **Community read-only registry** — PR-moderated, OTA-verified, badged “Community — not publisher-verified” | 3/4/4 | Reuses GitHub Releases + hash discipline; no accounts | M |
| 11 | **On-device wake word (“Mise …”)** — sherpa-onnx KWS is feasible but replaces the working re-arm loop for speculative ambient-noise gain | 4/3/2 | Defer; revisit only as opt-in beta after voice work lands | L, defer |

### Tier 3 — native/APK, model download, strategic bets
| # | Add-on | I/C/E | Notes | Effort |
|---|--------|-------|-------|--------|
| 12 | **Pocket TTS (Kyutai, MIT)** — replace Carol/Sean generator; 4–36 MB voice packs, ~200 ms first audio, Android audio quality superior to Kokoro int8 | 5/4/2 | Bench on tablet first; Kokoro int8 is the ship-safety fallback | v1.11.0+ |
| 13 | **Gemini Nano (via ML Kit GenAI, image)** — camera recipe capture; "what's in the pan" ingredient snap; metric of 45% conversion lift measured in production (Kakao) | 4/3/2 | AICore-managed (0 MB on Pixel 9/10 + Galaxy S25/S26+); experimental behind flag; fallback to web flow | native milestone |
| 14 | **Premium online "Live Chef" lane** — Gemini Live / GPT-Realtime for open-ended questions; online-only, opt-in | 3/3/2 | Not pursued while the app stays personal/non-revenue; note only | parked |
| 14 | **Family co-cook (local sync)** — phone-to-phone WebRTC, shared timers, no accounts, no cloud | 4/3/2 | Technically straightforward; product question is whether it differentiates for Mise's likely household profile | exploration spike |
| 15 | **kokoro-android (GPU)** — [see voice-prototype.md] replace engine-bound synthesis with one Mise-native engine (GPU path); eliminates Samsung-TTS fragmentation | 5/4/2 | Milestone-level; build on current Kokoro pack + new loader APK; keep system engine as fallback | Q1 2027 |

## Maintenance and platform updates nobody should wait on

1. **Test harness gates, before vNext** — Playwright headless E2E for import → cook → scale → pantry-rank; fixture schema.org page served from `tools/serve.mjs`; a localStorage-migration test; `verify-web` + `lintDebug` already gated, add a Playwright smoke job + APK size budget check + `web_version_code` monotonicity (already enforced in `app/build.gradle`). The current risk: v1.9.0 shipped with every high-signal regression surface covered only by manual checks. **Effort: S–M unlocks everything below.**
2. **Schema envelope** — stored records carry no version key; the only migration is `mise.imported.v1 → v2` (`app.js:211–220`). Add `{schemaVersion, records:[…]}` + migration registry before any new field (nutrition, allergy tags) lands. **S–M**
3. **IndexedDB migration** — imports are already at ~5–8 MB near the localStorage quota (`IMPORTED_CAP=800`); every data add-on (nutrition, substitutions, sync) needs IndexedDB headroom first. **M–L**
4. **Export/import of kitchen state** — single JSON via share-sheet: imported recipes + pantry/scale/favorites/voice prefs. Zero servers, account-free. Ships before any sync work. **S** (WebDAV/user-own-cloud sync later, same caveat).
5. **Publisher snapshot refresh** — `build-collections.mjs` / `build-caribbeanpot/cookingwithria` are manual; add a scheduled workflow opening a PR with the diff + `verify-web` gate + credits/audit-doc update. **M**
6. **Lock-screen / media-session controls** — surface Mise as a media session during cook; medium effort; offline-safe; power-user's trick every kitchen app wants.
7. **Community registry (read-only, GitHub Releases)** — PR-moderated, verified like OTA (`applicationId`/URL prefix/SHA-256), appended to imported state as "Community — not publisher-verified". No accounts, no Mise server. **M**
8. **Storage hygiene readout in Settings** — imports vs 800-cap vs MB used; make the invisible ceiling visible.
9. **APK size budget + size gate in CI** — shipping APK today ≈9.3 MB (voiced clips + publisher photos live in `assets/`); the day someone embeds an engine this size explodes further; gate it now. Budget raised to 12 MB to match the current baseline and give headroom for deliberate changes.

## The 90-day path

**Order lock (gates first):** nothing ships in v1.10 until the gate set exists — Playwright smoke + CI gates + APK size budget + schema envelope. This unlocks every later commit.

**Weeks 1–2 (ship):** test gates green (maintenance #1); voice serving scaling (Tier1-1); per-step timer prompts (Tier1-3).
**Weeks 3–4 (ship):** shopping list v1 (Tier1-4); auto-narrate cook-through (Tier1-2) incl. lock-screen media controls (maintenance #6); schema envelope (maintenance #2).
**Weeks 5–6 (ship):** IndexedDB migration (maintenance #3) behind dual-read; export/import (maintenance #4); nutrition capture-when-present (Tier2-7).
**Weeks 7–8:** substitution engine (Tier2-8); unit conversions (Tier2-6); push E2E gate hardening.
**Weeks 9–12:** prototype Nano vision import (Tier3-13) behind a flag; Pocket TTS bake-off (Tier3-12).

## What we deliberately do not do (park)

- No accounts, no cloud sync, no telemetry during cook; no ads; no subscription of any kind — personal, non-commercial toy by design.
- No ChatGPT/LLM-as-a-backend talking via network for cook interactions; Gemini Nano is opt-in, fully local, opt-out any time.
- No GPL-3.0 Piper binaries inside the closed APK (Pocket TTS is MIT — much friendlier).

## Risks

- **Gemini Nano / ML Kit availability variance:** APIs officially scan API 31+; AICore SLA is alpha; treat as a progressive enhancement.
- **Audio quality variance across Samsung engines** — unmeasured until the tablet runs v1.9.0 build.
- **Licensing:** all current embedded Kokoro/Piper/Pocket assets (Apache-2/MIT) compatible today; re-verify when adding Nano taps (Gemma terms).
- **APK size growth**: Kokoro pack + native probe corpora; watch Android AppBundle size per release.
- **Content-only updates**: nutrition adds need a DB maintained with the same publisher discipline; don't fake it.

## Recommendation

Ship v1.10.0 as "Voice that cooks": voice scale + auto-narrate + timer prompts + shopping list — four OTA releases in two weeks, no APK rebuild. Queue Pocket-TTS bake-off and Kokoro Android probe as v1.11.0+ work. Defer Gemini Nano behind a flag, keep it as a private toy you enjoy, and never chase shoppable-storefront ambitions in a personal app.
