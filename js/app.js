/* Mise / app.
   One job per screen: read a recipe's own data, show what the steps actually name,
   then cook it one step at a time with timers. Nothing here invents a step. */
(function () {
  'use strict';

  const P = window.MiseParse;
  const SAMPLES = (window.MISE_SAMPLES || []).slice();
  const GLOBAL = window.MISE_GLOBAL || { source: 'TheMealDB', generatedAt: '', note: '', records: [] };
  const CARIBBEAN = window.MISE_CARIBBEAN || { source: 'TheMealDB', fetchedAt: '', areas: [], queriedAreas: [], total: 0, meals: [] };
  const CARIBBEAN_SOURCES = window.MISE_CARIBBEAN_SOURCES || [];
  const AFRICA = window.MISE_AFRICA || { source: 'TheMealDB', fetchedAt: '', areas: [], queriedAreas: [], total: 0, meals: [] };
  const AFRICA_SOURCES = window.MISE_AFRICA_SOURCES || [];
  const FALLBACK_CENSUS = [
    ['British', 60], ['Spanish', 48], ['Turkish', 30], ['Chinese', 27], ['Jamaican', 27], ['Polish', 27],
    ['Thai', 27], ['Vietnamese', 27], ['Canadian', 22], ['Italian', 21], ['Australian', 13], ['Algerian', 12],
    ['Saudi Arabian', 12], ['Japanese', 9], ['Uruguayan', 9], ['Croatian', 8], ['Egyptian', 8], ['Filipino', 8],
    ['Greek', 8], ['Irish', 8], ['Malaysian', 8], ['Portuguese', 8], ['Tunisian', 8], ['Russian', 7],
    ['Ukrainian', 7], ['Mexican', 6], ['Moroccan', 6], ['Syrian', 6], ['Kenyan', 5],
  ];
  const GLOBAL_CENSUS = Array.isArray(GLOBAL.census) && GLOBAL.census.length ? GLOBAL.census : FALLBACK_CENSUS;

  /* ---------- storage ---------- */
  const KEY = {
    imported: 'mise.imported.v1',
    last: 'mise.last.v1',
    session: 'mise.session.v1',
    lastcook: 'mise.lastcook.v1',
    timer: 'mise.timer.v1',
    scale: 'mise.scale.v1',
  };

  const store = {
    get(key, fallback) {
      try {
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : fallback;
      } catch (e) { return fallback; }
    },
    set(key, value) {
      try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* private mode */ }
    },
  };

  /* ---------- helpers ---------- */
  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const icon = (name, cls) => `<svg class="i${cls ? ' ' + cls : ''}" aria-hidden="true"><use href="#i-${name}"/></svg>`;
  const pad = (n) => String(n).padStart(2, '0'); // taste-skill-ignore: clock
  const dash = '<span class="dash">–</span>';

  function safeUrl(url) {
    const u = String(url || '').trim();
    return /^https?:\/\//i.test(u) ? u : '';
  }

  function imgSrc(src) {
    const u = String(src || '').trim();
    if (!u) return '';
    if (/^[a-z][a-z0-9+.-]*:/i.test(u)) return /^https?:/i.test(u) ? u : '';
    return u;
  }

  function host(url) {
    const u = safeUrl(url);
    if (!u) return '';
    try { return new URL(u).hostname.replace(/^www\./, ''); } catch (e) { return ''; }
  }

  function formatDate(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  function clock(ms) {
    const total = Math.max(0, Math.ceil(ms / 1000));
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    return h > 0 ? h + ':' + pad(m) + ':' + pad(s) : pad(m) + ':' + pad(s);
  }

  function timerDigits(value) {
    return `<span class="timer-digits" aria-label="${esc(value)}" role="timer">${[...String(value)].map((char) => char === ':'
      ? '<span class="timer-colon" aria-hidden="true">:</span>'
      : `<span class="timer-digit" data-ui="timer-digit" aria-hidden="true">${esc(char)}</span>`).join('')}</span>`;
  }

  function updateTimerDigits(node, value) {
    if (!node) return;
    const digits = node.querySelector('.timer-digits');
    if (!digits || digits.getAttribute('aria-label') !== String(value)) node.innerHTML = timerDigits(value);
    node.classList.toggle('done', !!(timerState && timerState.done));
  }

  function elapsedText(ms) {
    if (!ms || ms < 0) return '–';
    if (ms < 60000) return 'under a minute';
    return P.durationText(ms / 1000);
  }

  function minutesText(min) {
    if (!min) return '';
    const h = Math.floor(min / 60);
    const m = min % 60;
    if (!h) return m + ' min';
    return h + ' hr' + (m ? ' ' + m + ' min' : '');
  }

  function announce(text, assertive) {
    const node = document.getElementById(assertive ? 'alert' : 'live');
    if (!node) return;
    node.textContent = '';
    window.setTimeout(() => { node.textContent = text; }, 30);
  }

  function imgWrap(src, alt, cls) {
    const url = imgSrc(src);
    return `<span class="${cls}" data-img>
      <span class="img-fallback" aria-hidden="true">${icon('pot')}</span>
      ${url ? `<img src="${esc(url)}" alt="${esc(alt)}" loading="lazy">` : ''}
    </span>`;
  }

  /* ---------- recipes ---------- */
  const sampleCache = new Map();
  let imported = store.get(KEY.imported, []);
  if (!Array.isArray(imported)) imported = [];

  function sampleRecipe(sample) {
    if (!sampleCache.has(sample.id)) sampleCache.set(sample.id, P.recipeFromSample(sample));
    return sampleCache.get(sample.id);
  }

  function allRecipes() {
    const map = new Map();
    SAMPLES.forEach((s) => map.set(s.id, sampleRecipe(s)));
    imported.forEach((r) => { if (r && r.id && r.steps) map.set(r.id, r); });
    return Array.from(map.values());
  }

  function getRecipe(id) {
    return allRecipes().find((r) => r.id === id) || null;
  }

  function storedLastRecipe() {
    const id = store.get(KEY.last, '');
    return id ? getRecipe(id) : null;
  }

  function lastRecipe() {
    return storedLastRecipe() || getRecipe('chili') || allRecipes()[0] || null;
  }

  function sourceGroup(recipe) {
    if (recipe.source === 'TheMealDB') return 'TheMealDB';
    if (recipe.source === 'Food & Wine') return 'Food & Wine';
    if (recipe.kind === 'sample') return 'Bundled sample';
    return 'Imported';
  }

  function coverStats(recipe) {
    const checked = recipe.stats.ingredients;
    const named = recipe.stats.named;
    return {
      checked,
      named,
      pct: checked ? Math.round((named / checked) * 100) : 0,
      missing: recipe.stats.missing,
      serving: recipe.stats.serving,
    };
  }

  function coverageLine(recipe) {
    const c = coverStats(recipe);
    if (!c.checked) return 'The source lists no usable ingredients.';
    if (!c.missing) return `All ${c.checked} listed ingredients are named in a step.`;
    return `${c.missing} listed ingredient${c.missing === 1 ? ' is' : 's are'} never named in a step.`;
  }

  function descriptionFor(recipe) {
    if (recipe.description) return recipe.description;
    const c = coverStats(recipe);
    return `${recipe.source} publishes ${recipe.stats.steps} steps for this recipe. Mise traced ${c.named} of ${c.checked} listed ingredients into them and kept the rest as written.`;
  }

  function usageTrack(recipe, ing) {
    const n = recipe.steps.length;
    if (!n) return '<div class="usage none"><span class="usage-steps">–</span></div>';
    const pos = (i) => (n === 1 ? 50 : (i / (n - 1)) * 100);
    const ticks = recipe.steps.map((s, i) => `<span class="usage-tick" style="left:${pos(i)}%"></span>`).join('');
    const dots = (ing.steps || []).map((k) => `<span class="usage-dot" style="left:${pos(k - 1)}%"></span>`).join('');
    const used = (ing.steps || []).join(', ');
    return `<div class="usage${ing.steps && ing.steps.length ? '' : ' none'}">
      <span class="usage-track" aria-hidden="true">${ticks}${dots}</span>
      <span class="usage-steps">${used || '–'}</span>
    </div>`;
  }

  function catMeta(ing) {
    if (ing.serving) return { key: 'serve', label: 'For serving', cls: 'cat-serve' };
    const key = ing.category || 'pantry';
    const labels = { produce: 'Produce', protein: 'Protein', dairy: 'Dairy', pantry: 'Pantry' };
    return { key, label: labels[key] || 'Pantry', cls: 'cat-' + key };
  }

  function ingredientGroups(recipe) {
    const order = ['produce', 'protein', 'dairy', 'pantry', 'serve'];
    const groups = new Map();
    recipe.ingredients.forEach((ing) => {
      const key = ing.serving ? 'serve' : (ing.category || 'pantry');
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(ing);
    });
    return order.filter((k) => groups.has(k)).map((k) => ({ key: k, items: groups.get(k) }));
  }

  function scaleFor(recipe) {
    if (!recipe.yields) return 1;
    const scales = store.get(KEY.scale, {});
    const v = Number(scales[recipe.id]);
    return v === 1.5 || v === 2 ? v : 1;
  }

  function setScale(recipe, v) {
    const scales = store.get(KEY.scale, {});
    scales[recipe.id] = v;
    store.set(KEY.scale, scales);
  }

  function uniqueId(base) {
    const taken = new Set(allRecipes().map((r) => r.id));
    if (!taken.has(base)) return base;
    let i = 2;
    while (taken.has(base + '-' + i)) i++;
    return base + '-' + i;
  }

  function saveImported(recipe) {
    const same = imported.findIndex((r) => r.sourceUrl && recipe.sourceUrl && r.sourceUrl === recipe.sourceUrl);
    if (same > -1) {
      recipe.id = imported[same].id;
      imported[same] = recipe;
    } else {
      recipe.id = uniqueId(recipe.id);
      imported.unshift(recipe);
    }
    if (imported.length > 400) imported = imported.slice(0, 400);
    store.set(KEY.imported, imported);
    store.set(KEY.last, recipe.id);
    return recipe;
  }

  function knownImported(url) {
    if (!url) return null;
    return imported.find((r) => r.sourceUrl === url) || null;
  }

  /* ---------- routing ---------- */
  let lastPath = '';

  function parseRoute() {
    const raw = (location.hash || '#/').replace(/^#/, '') || '/';
    const [path, query] = raw.split('?');
    const parts = path.split('/').filter(Boolean);
    return { path, parts, params: new URLSearchParams(query || '') };
  }

  function navigate(hash) {
    if (location.hash === hash) { render(); return; }
    location.hash = hash;
  }

  function setChrome(route) {
    const nav = route.parts[0] === 'library' ? 'library'
      : route.parts[0] === 'research' ? 'research'
        : (route.parts[0] === 'cook' || route.parts[0] === 'done') ? 'cook'
          : route.parts[0] === 'recipe' ? 'library' : 'home';
    $$('[data-nav]').forEach((a) => {
      if (a.dataset.nav === nav) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    });
    document.body.classList.toggle('route-cook', route.parts[0] === 'cook');
  }

  function render() {
    const route = parseRoute();
    const key = route.path;
    setChrome(route);

    const view = $('#view');
    let title = 'Mise · a recipe, taken apart and put in order';

    try {
      if (!route.parts.length) {
        view.innerHTML = homeView();
        title = 'Your kitchen · Mise';
      } else if (route.parts[0] === 'library') {
        view.innerHTML = libraryView(route.params.get('tab') || 'kitchen');
        title = 'Library · Mise';
      } else if (route.parts[0] === 'research') {
        view.innerHTML = researchView();
        title = 'Global research · Mise';
      } else if (route.parts[0] === 'recipe') {
        const recipe = getRecipe(route.parts[1] || '');
        view.innerHTML = recipe ? detailView(recipe) : missingView('recipe');
        if (recipe) title = recipe.name + ' · Mise';
      } else if (route.parts[0] === 'cook') {
        const recipe = getRecipe(route.parts[1] || '') || (route.parts.length === 1 ? lastRecipe() : null);
        if (recipe) {
          const stepParam = parseInt(route.params.get('step') || '', 10);
          view.innerHTML = cookView(recipe, stepParam);
          title = 'Cook ' + recipe.name + ' · Mise';
        } else {
          view.innerHTML = missingView('cook');
        }
      } else if (route.parts[0] === 'done') {
        const recipe = getRecipe(route.parts[1] || '');
        view.innerHTML = recipe ? doneView(recipe) : missingView('done');
        if (recipe) title = recipe.name + ' cooked · Mise';
      } else {
        view.innerHTML = missingView('page');
      }
    } catch (err) {
      view.innerHTML = `<div class="page"><div class="panel state-panel"><h2>Something in that view broke</h2><p>${esc(err && err.message ? err.message : 'Unknown error')}</p><div class="actions"><a class="btn primary" href="#/">Back to your kitchen</a></div></div></div>`;
    }

    document.title = title;
    if (route.parts[0] === 'library') {
      if (libraryState.tab === 'kitchen') refreshLibraryRows();
      else if (libraryState.tab === 'caribbean') refreshCaribbeanRows();
      else if (libraryState.tab === 'africa') refreshAfricaRows();
      else if (libraryState.tab === 'global') refreshGlobalRows();
    }
    observeTimerCard();
    renderTimerDock();
    if (key !== lastPath) {
      window.scrollTo(0, 0);
      lastPath = key;
    }
    syncCookClock();
  }

  /* ---------- home ---------- */
  const legendDots = (n, used) => {
    const pos = (i) => (n === 1 ? 50 : (i / (n - 1)) * 100);
    const ticks = Array.from({ length: n }, (_, i) => `<span class="usage-tick" style="left:${pos(i)}%"></span>`).join('');
    const dots = used.map((k) => `<span class="usage-dot" style="left:${pos(k - 1)}%"></span>`).join('');
    return `<span class="usage-track" aria-hidden="true">${ticks}${dots}</span>`;
  };

  function homeView() {
    const all = allRecipes();
    const featured = lastRecipe();
    const recent = storedLastRecipe();
    const recentlyOpened = !!featured && !!recent && recent.id === featured.id;
    const totalChecked = all.reduce((s, r) => s + r.stats.ingredients, 0);
    const totalNamed = all.reduce((s, r) => s + r.stats.named, 0);
    const gapRecipe = all.find((r) => r.stats.missing > 0);
    const finding = `${all.length} recipes read. ${totalNamed} of ${totalChecked} listed ingredients are named in a step`
      + (gapRecipe ? `; ${gapRecipe.name} leaves ${gapRecipe.stats.missing} unnamed.` : '.');

    return `<div class="page">
      <div class="title-row">
        <div>
          <h1>Your kitchen</h1>
          <p class="sub">${esc(finding)}</p>
        </div>
        <div class="title-actions">
          <button class="btn ghost" type="button" data-action="focus-import">${icon('import')}Import a recipe</button>
          <a class="btn ghost" href="#/library">Open library ${icon('arrow-right')}</a>
        </div>
      </div>

      <div class="home-grid">
        <div class="home-main">
          ${featured ? featuredHero(featured, recentlyOpened) : ''}
          ${kitchenPanel(all)}
        </div>
        <aside class="home-side">
          ${importCard()}
          ${legendCard()}
        </aside>
      </div>
    </div>`;
  }

  function featuredHero(recipe, recentlyOpened) {
    const c = coverStats(recipe);
    const total = recipe.totalMinutes;
    return `<section class="panel hero" aria-labelledby="hero-name">
      <div class="panel-head">
        <h2 class="sr-only" id="hero-title">Featured recipe</h2>
        <div class="meta-line">${icon('flame')}${recentlyOpened ? 'Last opened' : 'Start here'}</div>
        <a class="section-link" href="#/library">All recipes ${icon('arrow-right')}</a>
      </div>
      <div class="hero-body">
        ${imgWrap(recipe.image, recipe.name, 'hero-photo')}
        <div class="hero-copy">
          <div class="source-line">
            <span class="src">${esc(recipe.source)}</span>
            <span class="sep">/</span>
            <span>${esc(recipe.cuisine || 'Cuisine not given')}</span>
            ${recipe.category ? `<span class="sep">/</span><span>${esc(recipe.category)}</span>` : ''}
          </div>
          <h2 class="hero-name" id="hero-name"><a href="#/recipe/${esc(recipe.id)}">${esc(recipe.name)}</a></h2>
          <p class="hero-desc">${esc(descriptionFor(recipe))}</p>
          <div class="meter-line hero-structure ${c.missing ? 'gap' : ''}">
            <span class="meter"><span style="width:${c.pct}%"></span></span>
            <span class="ratio"><b>${c.named}</b><span> / ${c.checked} named</span></span>
          </div>
          <div class="facts">
            <div class="fact"><div class="flabel">Steps</div><div class="fvalue">${recipe.stats.steps}</div></div>
            <div class="fact"><div class="flabel">Ingredients</div><div class="fvalue">${c.checked}</div></div>
            <div class="fact"><div class="flabel">Timers</div><div class="fvalue">${recipe.stats.timers}</div></div>
            <div class="fact"><div class="flabel">Total time</div><div class="fvalue${total ? '' : ' dash'}"${total ? '' : ' title="The source gives no total time"'}>${total ? esc(minutesText(total)) : '–'}</div></div>
          </div>
          <div class="hero-actions">
            <a class="btn primary" href="#/cook/${esc(recipe.id)}">${icon('play')}Start cooking</a>
            <a class="btn" href="#/recipe/${esc(recipe.id)}">See the breakdown</a>
          </div>
        </div>
      </div>
    </section>`;
  }

  function kitchenPanel(all) {
    const rows = all.slice(0, 6).map((recipe) => {
      const c = coverStats(recipe);
      return `<a class="rrow" href="#/recipe/${esc(recipe.id)}">
        ${imgWrap(recipe.image, recipe.name, 'rthumb')}
        <span>
          <span class="rname">${esc(recipe.name)}</span>
          <span class="rsub">${esc(recipe.source)} / ${esc(recipe.cuisine || recipe.category || 'No cuisine given')}</span>
        </span>
        <span class="meter-line ${c.missing ? 'gap' : ''}">
          <span class="meter"><span style="width:${c.pct}%"></span></span>
          <span class="ratio"><b>${c.named}</b><span>/${c.checked}</span></span>
        </span>
        <span class="rnum">${recipe.stats.steps} <span>steps</span></span>
        <span class="rgo">${icon('arrow-right')}</span>
      </a>`;
    }).join('');

    return `<section class="panel list-block" aria-labelledby="kitchen-title">
      <div class="panel-head">
        <h2 id="kitchen-title">My kitchen</h2>
        <a class="section-link" href="#/library">${all.length} recipes ${icon('arrow-right')}</a>
      </div>
      <div class="recipe-rows">${rows}</div>
    </section>`;
  }

  function importCard() {
    return `<section class="panel import-card" aria-labelledby="import-title">
      <div class="panel-head">
        <h2 id="import-title">Import a recipe</h2>
        <span class="meta">Link or source</span>
      </div>
      <form id="import-form" novalidate>
        <div class="field">
          <label for="recipe-url">Recipe URL</label>
          <input class="input" id="recipe-url" name="url" type="url" inputmode="url" autocomplete="url" placeholder="https://www.foodandwine.com/recipes/classic-beef-chili">
          <span class="hint">Mise reads the page's own schema.org Recipe data. Nothing is retyped by hand.</span>
        </div>
        <button class="btn primary" type="submit">${icon('import')}Read the recipe</button>
      </form>
      <div class="import-alt">
        <button class="btn ghost" type="button" data-action="paste">${icon('paste')}Paste page source</button>
        <span class="meta">or</span>
        <a class="btn ghost" href="#/library?tab=live">${icon('search')}Search TheMealDB</a>
      </div>
      <div class="import-status" id="import-status" aria-live="polite"></div>
      <div class="quiet-note" style="margin-top:14px">
        ${icon('info')}
        <span>Live links are fetched in this browser. A site that blocks cross-origin reads can be pasted instead. ${allRecipes().length} recipes are already here.</span>
      </div>
    </section>`;
  }

  function legendCard() {
    return `<section class="panel legend-card" aria-labelledby="legend-title">
      <div class="panel-head">
        <h2 id="legend-title">The usage track</h2>
        <span class="meta">Read it in one glance</span>
      </div>
      <p class="meta">Each ingredient carries the step numbers where a step actually names it. A faint tick is a step that does not.</p>
      <ul class="legend-list">
        <li>
          ${legendDots(9, [2, 5, 9])}
          <span class="llabel"><b>Named in 3 steps</b>2, 5 and 9 are dotted</span>
        </li>
        <li>
          ${legendDots(9, [])}
          <span class="llabel"><b>Never named</b>Kept as a source gap, not guessed in</span>
        </li>
        <li>
          ${legendDots(9, [1])}
          <span class="llabel"><b>Added early</b>One dot, at step 1</span>
        </li>
      </ul>
      <p class="foot">Serving items are listed but kept out of the count. Steps split from a long paragraph are disclosed, never invented.</p>
    </section>`;
  }

  /* ---------- library ---------- */
  const libraryState = { tab: 'kitchen', q: '', source: 'all', status: 'idle', results: [], error: '' };
  const caribbeanState = { q: '' };
  const africaState = { q: '' };
  const globalState = { q: '' };

  function libraryView(tab) {
    libraryState.tab = ['kitchen', 'live', 'caribbean', 'africa', 'global'].includes(tab) ? tab : libraryState.tab;
    const all = allRecipes();
    const importedCount = imported.length;
    const caribbeanCount = (Array.isArray(CARIBBEAN.meals) ? CARIBBEAN.meals.length : 0) + CARIBBEAN_SOURCES.length;
    const africaCount = (Array.isArray(AFRICA.meals) ? AFRICA.meals.length : 0) + AFRICA_SOURCES.length;
    const globalCount = Array.isArray(GLOBAL.records) ? GLOBAL.records.length : 0;
    const finding = `${all.length} recipes in the kitchen${importedCount ? `, ${importedCount} imported here` : ''}. ${all.reduce((s, r) => s + r.stats.named, 0)} of ${all.reduce((s, r) => s + r.stats.ingredients, 0)} listed ingredients are named in a step.`;

    return `<div class="page">
      <div class="title-row">
        <div>
          <h1>Library</h1>
          <p class="sub">${esc(finding)}</p>
        </div>
        <div class="title-actions">
          <a class="btn primary" href="#/">${icon('import')}Import a recipe</a>
        </div>
      </div>

      <div class="segmented" role="group" aria-label="Recipe source" style="margin-bottom:20px">
        <button type="button" data-action="library-tab" data-tab="kitchen" aria-pressed="${libraryState.tab === 'kitchen'}">My kitchen <span class="n">${all.length}</span></button>
        <button type="button" data-action="library-tab" data-tab="live" aria-pressed="${libraryState.tab === 'live'}">TheMealDB live</button>
        <button type="button" data-action="library-tab" data-tab="caribbean" aria-pressed="${libraryState.tab === 'caribbean'}">Caribbean <span class="n">${caribbeanCount}</span></button>
        <button type="button" data-action="library-tab" data-tab="africa" aria-pressed="${libraryState.tab === 'africa'}">Africa <span class="n">${africaCount}</span></button>
        <button type="button" data-action="library-tab" data-tab="global" aria-pressed="${libraryState.tab === 'global'}">The world <span class="n">${globalCount}</span></button>
      </div>

      ${libraryState.tab === 'live' ? livePanel() : libraryState.tab === 'caribbean' ? caribbeanPanel() : libraryState.tab === 'africa' ? africaPanel() : libraryState.tab === 'global' ? globalPanel() : kitchenLibrary(all)}
    </div>`;
  }

  function kitchenLibrary(all) {
    const sources = ['all', ...Array.from(new Set(all.map(sourceGroup)))];
    const filters = sources.map((s) => `<button class="chipbtn" type="button" data-action="filter-source" data-source="${esc(s)}" aria-pressed="${libraryState.source === s}">${s === 'all' ? 'All' : esc(s)} <span class="n">${s === 'all' ? all.length : all.filter((r) => sourceGroup(r) === s).length}</span></button>`).join('');

    return `<div class="library-toolbar">
      <label class="search">
        <span class="sr-only">Search recipes</span>
        ${icon('search')}
        <input class="input" id="lib-search" type="search" placeholder="Search name, cuisine or source" value="${esc(libraryState.q)}" autocomplete="off">
      </label>
      <div class="filters">${filters}</div>
      <span class="result-count" id="lib-count"></span>
    </div>
    <section class="panel table-panel" aria-label="Recipes">
      <div class="table-head">
        <span>Recipe</span>
        <span class="col-source">Source</span>
        <span class="n col-steps">Steps</span>
        <span class="n col-ings">Ingredients</span>
        <span class="n col-timers">Timers</span>
        <span class="col-struct">Ingredients named in a step</span>
        <span></span>
      </div>
      <div class="lrows" id="lib-rows"></div>
    </section>
    ${libraryFoot(all)}`;
  }

  function libraryFoot(all) {
    const gapRecipes = all.filter((r) => r.stats.missing > 0);
    const checked = all.reduce((s, r) => s + r.stats.ingredients, 0);
    const named = all.reduce((s, r) => s + r.stats.named, 0);
    const serving = all.reduce((s, r) => s + r.stats.serving, 0);
    const extra = all.reduce((s, r) => s + (r.review.extra || []).length, 0);
    const passed = all.filter((r) => !r.stats.missing);
    const passedHtml = passed.length ? `<div class="gap-divider">Passed the check</div>${passed.map((recipe) => `<a class="pass-row" href="#/recipe/${esc(recipe.id)}">
      <span class="dot ok"></span>
      <span class="pass-name">${esc(recipe.name)}</span>
      <span class="pass-ratio">${coverStats(recipe).named} / ${coverStats(recipe).checked}</span>
    </a>`).join('')}` : '';
    let gaps = gapRecipes.length ? gapRecipes.map((recipe) => `<a class="gap-row" href="#/recipe/${esc(recipe.id)}">
      <span class="dot warn"></span>
      <span><b>${esc(recipe.name)}</b><span class="gap-detail">${esc(recipe.review.missing.join(', '))} ${recipe.review.missing.length === 1 ? 'is' : 'are'} listed but no step names ${recipe.review.missing.length === 1 ? 'it' : 'them'}.</span></span>
      ${icon('arrow-right')}
    </a>`).join('') : `<div class="empty-inline">No hidden ingredient in the current list. Every listed ingredient is named in at least one step.</div>`;
    gaps += passedHtml;

    return `<div class="library-foot">
      <section class="panel gaps-panel" aria-labelledby="gaps-title">
        <div class="panel-head"><h2 id="gaps-title">Open gaps</h2><span class="meta">${gapRecipes.length} recipe${gapRecipes.length === 1 ? '' : 's'}</span></div>
        <div class="gap-list">${gaps}</div>
      </section>
      <section class="panel coverage-panel" aria-labelledby="coverage-title">
        <div class="panel-head"><h2 id="coverage-title">Coverage in the kitchen</h2><span class="meta">${checked} counted</span></div>
        <div class="coverage-big">${named}<span> / ${checked}</span></div>
        <p class="lede">Listed ingredients named in a step across every recipe here.</p>
        <dl class="kv">
          <dt>Serving items</dt><dd>${serving}</dd>
          <dt>Named but unlisted</dt><dd>${extra}</dd>
          <dt>Source blocks</dt><dd>${all.reduce((s, r) => s + r.sourceBlocks, 0)}</dd>
        </dl>
      </section>
    </div>`;
  }

  function libraryRows() {
    const q = libraryState.q.trim().toLowerCase();
    const source = libraryState.source;
    const rows = allRecipes().filter((r) => {
      if (source !== 'all' && sourceGroup(r) !== source) return false;
      if (!q) return true;
      const hay = [r.name, r.source, r.cuisine, r.category, ...(r.tags || [])].join(' ').toLowerCase();
      return hay.includes(q);
    });

    const body = rows.length ? rows.map((recipe) => {
      const c = coverStats(recipe);
      return `<a class="lrow" href="#/recipe/${esc(recipe.id)}">
        <span class="lrecipe">
          ${imgWrap(recipe.image, recipe.name, 'rthumb')}
          <span class="lname-wrap">
            <span class="lname">${esc(recipe.name)}</span>
            <span class="lsub">${esc(recipe.cuisine || 'Cuisine not given')} / ${esc(recipe.category || 'No category')}</span>
          </span>
        </span>
        <span class="lcell col-source">${esc(recipe.source)}</span>
        <span class="lcell n col-steps">${recipe.stats.steps}</span>
        <span class="lcell n col-ings">${c.named}<span class="muted"> / ${c.checked}</span></span>
        <span class="lcell n col-timers">${recipe.stats.timers}</span>
        <span class="lstruct col-struct">
          <span class="meter-line ${c.missing ? 'gap' : ''}">
            <span class="meter"><span style="width:${c.pct}%"></span></span>
            <span class="ratio"><b>${c.named}</b><span>/${c.checked}</span></span>
          </span>
        </span>
        <span class="rgo">${icon('arrow-right')}</span>
      </a>`;
    }).join('') : `<div style="padding:20px 12px"><div class="live-empty">No recipe here matches “${esc(libraryState.q)}”${source !== 'all' ? ` in ${esc(source)}` : ''}. <button class="link-action" type="button" data-action="clear-library">Clear the search</button></div></div>`;

    const count = `${rows.length} of ${allRecipes().length} recipes`;
    return { body, count };
  }

  function refreshLibraryRows() {
    const slot = $('#lib-rows');
    if (!slot) return;
    const { body, count } = libraryRows();
    slot.innerHTML = body;
    const counter = $('#lib-count');
    if (counter) counter.textContent = count;
  }

  function livePanel() {
    const suggestions = ['Chicken', 'Beef', 'Pasta', 'Salmon', 'Vegetarian', 'Dessert'];
    return `<div class="live-search">
      <form class="search" id="live-form" role="search">
        <span class="sr-only">Search TheMealDB</span>
        ${icon('search')}
        <input class="input" id="live-q" type="search" placeholder="Search a dish by name" value="${esc(libraryState.q)}" autocomplete="off" aria-label="Search TheMealDB by dish name">
      </form>
      <button class="btn" type="button" data-action="live-search">${icon('search')}Search live</button>
    </div>
    <div class="suggestions">
      <span class="label">Try</span>
      ${suggestions.map((s) => `<button class="chipbtn" type="button" data-action="live-suggest" data-q="${esc(s)}">${esc(s)}</button>`).join('')}
    </div>
    <section class="panel table-panel" aria-label="TheMealDB results" id="live-results">
      ${liveResultsHtml()}
    </section>
    <p class="live-note">${icon('info')}Live search reads TheMealDB's public API. Every imported recipe keeps its meal id and links back to its page. TheMealDB gives no total time or yield; those fields stay blank.</p>`;
  }

  function liveResultsHtml() {
    if (libraryState.status === 'loading') {
      return `<div class="loading-rows">${Array.from({ length: 3 }, () => `<div class="live-row"><span class="skeleton" style="width:56px;height:56px;border-radius:8px"></span><span class="lines" style="display:grid;gap:8px"><span class="skeleton" style="width:34%;height:12px"></span><span class="skeleton" style="width:22%;height:10px"></span></span><span class="skeleton" style="width:72px;height:32px;border-radius:8px"></span></div>`).join('')}</div>`;
    }
    if (libraryState.status === 'error') {
      return `<div class="live-empty">${esc(libraryState.error)} <button class="link-action" type="button" data-action="live-search">Try again</button></div>`;
    }
    if (libraryState.status === 'done' && !libraryState.results.length) {
      return `<div class="live-empty">TheMealDB returned no meal for “${esc(libraryState.q)}”. Try a shorter dish name.</div>`;
    }
    if (libraryState.status === 'idle') {
      return `<div class="live-empty">Search TheMealDB by name. Mise will read the meal's own ingredients and instructions, then trace them like any other recipe.</div>`;
    }
    return `<div class="live-rows">${libraryState.results.map((meal) => {
      const here = knownImported('https://www.themealdb.com/meal/' + meal.idMeal);
      return `<div class="live-row">
        ${imgWrap(meal.strMealThumb, meal.strMeal, 'live-thumb')}
        <span>
          <span class="live-name">${esc(meal.strMeal)}</span>
          <span class="live-sub">${esc([meal.strArea, meal.strCategory].filter(Boolean).join(' / ') || 'No area or category')} / meal ${esc(meal.idMeal)}</span>
        </span>
        ${here
          ? `<a class="btn sm" href="#/recipe/${esc(here.id)}">Open ${icon('arrow-right')}</a>`
          : `<button class="btn sm" type="button" data-action="import-meal" data-id="${esc(meal.idMeal)}">Read ${icon('arrow-right')}</button>`}
      </div>`;
    }).join('')}</div>`;
  }

  function caribbeanPanel() {
    const meals = Array.isArray(CARIBBEAN.meals) ? CARIBBEAN.meals : [];
    const nonZero = (CARIBBEAN.areas || []).filter((entry) => entry.count > 0);
    const areasQueried = (CARIBBEAN.queriedAreas || []).length || (CARIBBEAN.areas || []).length;
    const total = meals.length + CARIBBEAN_SOURCES.length;
    const places = new Set(['Jamaica', ...CARIBBEAN_SOURCES.map((record) => record.country.replace(/ \(inspired\)$/, ''))]);
    const publishers = new Set(['TheMealDB', ...CARIBBEAN_SOURCES.map((record) => record.source)]);
    const importedCount = meals.filter((meal) => knownImported('https://www.themealdb.com/meal/' + meal.idMeal)).length
      + CARIBBEAN_SOURCES.filter((record) => knownImported(record.sourceUrl)).length;
    return `<section class="panel caribbean-panel" aria-labelledby="caribbean-title">
      <div class="panel-head">
        <span>
          <h2 id="caribbean-title">Caribbean recipes</h2>
          <p class="meta">A small, source-attributed collection of dishes from across the Caribbean, including recipes inspired by Grenada and Saint Lucia; not a complete survey.</p>
        </span>
        <button class="btn" type="button" data-action="import-all-caribbean">${icon('import')}Import all ${total}</button>
      </div>
      <div class="caribbean-summary" aria-label="Caribbean collection coverage">
        <div class="fact"><div class="flabel">Curated records</div><div class="fvalue">${total}</div></div>
        <div class="fact"><div class="flabel">Places represented or inspiring</div><div class="fvalue">${places.size}</div></div>
        <div class="fact"><div class="flabel">Already in your kitchen</div><div class="fvalue">${importedCount}</div></div>
        <div class="fact"><div class="flabel">Publishers</div><div class="fvalue">${publishers.size}</div></div>
      </div>
      <p class="caribbean-note">${icon('info')}<span>${meals.length} Jamaican records come from TheMealDB${CARIBBEAN.fetchedAt ? ` (cached ${esc(formatDate(CARIBBEAN.fetchedAt))})` : ''}; its ${areasQueried}-area query returned meals in ${nonZero.length} area. ${CARIBBEAN_SOURCES.length} more recipes come from ${publishers.size - 1} other publishers. TheMealDB's zero results say nothing about the availability of Caribbean recipes elsewhere. Each record links to its publisher; inspired dishes are labeled.</span></p>
      <div class="live-search" style="margin-bottom:10px">
        <label class="search">
          <span class="sr-only">Search the Caribbean database</span>
          ${icon('search')}
          <input class="input" id="caribbean-q" type="search" placeholder="Search ${total} recipes by dish, place or publisher" value="${esc(caribbeanState.q)}" autocomplete="off">
        </label>
      </div>
      <div class="result-count" id="caribbean-count" style="margin:0 0 10px">${total} records</div>
      <div class="live-rows" id="caribbean-rows"></div>
      <p class="live-note">${icon('link')}TheMealDB photographs are hot-linked. Other publishers’ recipes use captured recipe-card data without re-hosting photographs. Read the publisher’s page for corrections and context. See Sources, credits and limits.</p>
    </section>`;
  }

  function caribbeanRows() {
    const q = caribbeanState.q.trim().toLowerCase();
    const meals = Array.isArray(CARIBBEAN.meals) ? CARIBBEAN.meals : [];
    const total = meals.length + CARIBBEAN_SOURCES.length;
    const sourceRows = CARIBBEAN_SOURCES.filter((record) => [record.name, record.country, record.source, record.author].join(' ').toLowerCase().includes(q));
    const rows = meals.filter((meal) => {
      if (!q) return true;
      const hay = [meal.strMeal, meal.strArea, meal.strCategory, meal.strTags].join(' ').toLowerCase();
      return hay.includes(q);
    });
    const publisherRows = sourceRows.map((record) => {
      const here = knownImported(record.sourceUrl);
      return `<div class="live-row">
        <span class="live-thumb source-thumb" aria-hidden="true">${esc(record.country.slice(0, 2).toUpperCase())}</span>
        <span><span class="live-name">${esc(record.name)}</span>
          <span class="live-sub">${esc(record.country)} / ${esc(record.source)}${record.author ? ` / ${esc(record.author)}` : ''} · <a href="${esc(record.sourceUrl)}" target="_blank" rel="noopener noreferrer">Publisher page</a></span></span>
        ${here ? `<a class="btn sm" href="#/recipe/${esc(here.id)}">Open ${icon('arrow-right')}</a>`
          : `<button class="btn sm" type="button" data-action="import-caribbean-source" data-id="${esc(record.id)}">Read ${icon('arrow-right')}</button>`}
      </div>`;
    });
    const mealRows = rows.map((meal) => {
      const here = knownImported('https://www.themealdb.com/meal/' + meal.idMeal);
      return `<div class="live-row">
        ${imgWrap(meal.strMealThumb, meal.strMeal, 'live-thumb')}
        <span>
          <span class="live-name">${esc(meal.strMeal)}</span>
          <span class="live-sub">${esc(meal.strArea || 'Area not given')} / TheMealDB / meal ${esc(meal.idMeal)}</span>
        </span>
        ${here
          ? `<a class="btn sm" href="#/recipe/${esc(here.id)}">Open ${icon('arrow-right')}</a>`
          : `<button class="btn sm" type="button" data-action="import-meal" data-id="${esc(meal.idMeal)}">Read ${icon('arrow-right')}</button>`}
      </div>`;
    });
    const body = [...publisherRows, ...mealRows].join('') || `<div class="live-empty">No Caribbean record matches “${esc(caribbeanState.q)}”. Clear the search to see all ${total}.</div>`;
    return { body, count: `${rows.length + sourceRows.length} of ${total} records` };
  }

  function refreshCaribbeanRows() {
    const slot = $('#caribbean-rows');
    if (!slot) return;
    const { body, count } = caribbeanRows();
    slot.innerHTML = body;
    const counter = $('#caribbean-count');
    if (counter) counter.textContent = count;
  }

  const AFRICA_PLACES = {
    Algerian: 'Algeria', Egyptian: 'Egypt', Kenyan: 'Kenya', Moroccan: 'Morocco', Tunisian: 'Tunisia',
  };

  function africaPlaces() {
    const places = new Set((AFRICA.areas || []).filter((entry) => entry.count > 0).map((entry) => AFRICA_PLACES[entry.area] || entry.area));
    AFRICA_SOURCES.forEach((record) => places.add(record.country.replace(/ \(inspired\)$/, '')));
    return places;
  }

  function africaPanel() {
    const meals = Array.isArray(AFRICA.meals) ? AFRICA.meals : [];
    const areasWithMeals = (AFRICA.areas || []).filter((entry) => entry.count > 0);
    const publishers = new Set(['TheMealDB', ...AFRICA_SOURCES.map((record) => record.source)]);
    const importedCount = meals.filter((meal) => knownImported('https://www.themealdb.com/meal/' + meal.idMeal)).length
      + AFRICA_SOURCES.filter((record) => knownImported(record.sourceUrl)).length;
    const total = meals.length + AFRICA_SOURCES.length;
    return `<section class="panel africa-panel" aria-labelledby="africa-title">
      <div class="panel-head">
        <span>
          <h2 id="africa-title">African recipes</h2>
          <p class="meta">Deep dives into ${africaPlaces().size} places, with publisher recipes standing in where TheMealDB's area filter has no results. Not a complete survey.</p>
        </span>
        <button class="btn" type="button" data-action="import-all-africa">${icon('import')}Import all ${total}</button>
      </div>
      <div class="caribbean-summary" aria-label="African collection coverage">
        <div class="fact"><div class="flabel">Curated records</div><div class="fvalue">${total}</div></div>
        <div class="fact"><div class="flabel">Places represented</div><div class="fvalue">${africaPlaces().size}</div></div>
        <div class="fact"><div class="flabel">Already in your kitchen</div><div class="fvalue">${importedCount}</div></div>
        <div class="fact"><div class="flabel">Publishers</div><div class="fvalue">${publishers.size}</div></div>
      </div>
      <p class="caribbean-note">${icon('info')}<span>${meals.length} records come from TheMealDB across its ${areasWithMeals.length} African area labels${AFRICA.fetchedAt ? ` (cached ${esc(formatDate(AFRICA.fetchedAt))})` : ''}. ${AFRICA_SOURCES.length} more come from ${publishers.size - 1} publishers, covering Nigerian, Ghanaian, Ethiopian, Kenyan and South African cooking. A zero result in TheMealDB is a limit of the source, not a verdict on the cuisine. Each record links to its publisher; inspired or vegan dishes are labelled by name.</span></p>
      <div class="live-search" style="margin-bottom:10px">
        <label class="search">
          <span class="sr-only">Search the African database</span>
          ${icon('search')}
          <input class="input" id="africa-q" type="search" placeholder="Search ${total} recipes by dish, place or publisher" value="${esc(africaState.q)}" autocomplete="off">
        </label>
      </div>
      <div class="result-count" id="africa-count" style="margin:0 0 10px">${total} records</div>
      <div class="live-rows" id="africa-rows"></div>
      <p class="live-note">${icon('link')}TheMealDB photographs are hot-linked. Publisher recipes use captured recipe-card data without re-hosting photographs. Read the publisher's page for corrections and context. See Sources, credits and limits.</p>
    </section>`;
  }

  function africaRows() {
    const q = africaState.q.trim().toLowerCase();
    const meals = Array.isArray(AFRICA.meals) ? AFRICA.meals : [];
    const total = meals.length + AFRICA_SOURCES.length;
    const sourceRows = AFRICA_SOURCES.filter((record) => [record.name, record.country, record.source, record.author].join(' ').toLowerCase().includes(q));
    const rows = meals.filter((meal) => {
      if (!q) return true;
      const hay = [meal.strMeal, meal.strArea, meal.strCategory, meal.strTags].join(' ').toLowerCase();
      return hay.includes(q);
    });
    const publisherRows = sourceRows.map((record) => {
      const here = knownImported(record.sourceUrl);
      return `<div class="live-row">
        <span class="live-thumb source-thumb" aria-hidden="true">${esc(record.country.slice(0, 2).toUpperCase())}</span>
        <span><span class="live-name">${esc(record.name)}</span>
          <span class="live-sub">${esc(record.country)} / ${esc(record.source)}${record.author ? ` / ${esc(record.author)}` : ''} · <a href="${esc(record.sourceUrl)}" target="_blank" rel="noopener noreferrer">Publisher page</a></span></span>
        ${here ? `<a class="btn sm" href="#/recipe/${esc(here.id)}">Open ${icon('arrow-right')}</a>`
          : `<button class="btn sm" type="button" data-action="import-africa-source" data-id="${esc(record.id)}">Read ${icon('arrow-right')}</button>`}
      </div>`;
    });
    const mealRows = rows.map((meal) => {
      const here = knownImported('https://www.themealdb.com/meal/' + meal.idMeal);
      return `<div class="live-row">
        ${imgWrap(meal.strMealThumb, meal.strMeal, 'live-thumb')}
        <span>
          <span class="live-name">${esc(meal.strMeal)}</span>
          <span class="live-sub">${esc(meal.strArea || 'Area not given')} / TheMealDB / meal ${esc(meal.idMeal)}</span>
        </span>
        ${here
          ? `<a class="btn sm" href="#/recipe/${esc(here.id)}">Open ${icon('arrow-right')}</a>`
          : `<button class="btn sm" type="button" data-action="import-meal" data-id="${esc(meal.idMeal)}">Read ${icon('arrow-right')}</button>`}
      </div>`;
    });
    const body = [...publisherRows, ...mealRows].join('') || `<div class="live-empty">No African record matches “${esc(africaState.q)}”. Clear the search to see all ${total}.</div>`;
    return { body, count: `${rows.length + sourceRows.length} of ${total} records` };
  }

  function refreshAfricaRows() {
    const slot = $('#africa-rows');
    if (!slot) return;
    const { body, count } = africaRows();
    slot.innerHTML = body;
    const counter = $('#africa-count');
    if (counter) counter.textContent = count;
  }

  function globalPanel() {
    const meals = Array.isArray(GLOBAL.records) ? GLOBAL.records : [];
    const cuisines = new Set(meals.map((meal) => meal.strArea)).size;
    const importedCount = meals.filter((meal) => knownImported('https://www.themealdb.com/meal/' + meal.idMeal)).length;
    return `<section class="panel global-panel" aria-labelledby="global-title">
      <div class="panel-head">
        <span>
          <h2 id="global-title">The world kitchen</h2>
          <p class="meta">A recognition-led cross-section across ${cuisines} cuisines TheMealDB represents. It is not a ranking and does not claim authenticity.</p>
        </span>
        <span class="global-actions">
          <a class="btn sm brand-ring" href="#/research">${icon('globe')}Research</a>
          <button class="btn" type="button" data-action="import-all-global">${icon('import')}Import all ${meals.length}</button>
        </span>
      </div>
      <div class="live-search" style="margin-bottom:8px">
        <label class="search">
          <span class="sr-only">Search the global set</span>
          ${icon('search')}
          <input class="input" id="global-q" type="search" placeholder="Search ${meals.length} global records by dish or cuisine" value="${esc(globalState.q)}" autocomplete="off">
        </label>
      </div>
      <div class="result-count" id="global-count" style="margin:0 0 10px">${meals.length} records${importedCount ? ` · ${importedCount} in your kitchen` : ''}</div>
      <div class="world-grid" id="global-rows"></div>
      <p class="live-note">${icon('link')}Source: TheMealDB public API${GLOBAL.generatedAt ? `, cached ${esc(formatDate(GLOBAL.generatedAt))}` : ''}. Photographs remain TheMealDB's and are hot-linked. African and Caribbean deep dives sit in their own collections. No cuisine is presented as more important or more authentic than another in this sample. See <a href="#/research">Global research</a>.</p>
    </section>`;
  }

  function globalRows() {
    const q = globalState.q.trim().toLowerCase();
    const records = Array.isArray(GLOBAL.records) ? GLOBAL.records : [];
    const rows = records.filter((meal) => {
      if (!q) return true;
      const hay = [meal.strMeal, meal.strArea, meal.strCategory, meal.strTags].join(' ').toLowerCase();
      return hay.includes(q);
    });
    const body = rows.length ? rows.map((meal) => {
      const here = knownImported('https://www.themealdb.com/meal/' + meal.idMeal);
      return `<article class="world-card">
        ${imgWrap(meal.strMealThumb, meal.strMeal, 'world-photo')}
        <div class="world-body">
          <div class="source-line"><span class="src">${esc(meal.strArea)}</span><span class="sep">/</span><span>${esc(meal.strCategory)}</span></div>
          <h3>${esc(meal.strMeal)}</h3>
          <p>meal ${esc(meal.idMeal)}${meal.strTags ? ' / ' + esc(meal.strTags) : ''}</p>
          ${here
            ? `<a class="link-action world-link" href="#/recipe/${esc(here.id)}">Open in kitchen ${icon('arrow-right')}</a>`
            : `<button class="link-action world-link" type="button" data-action="import-meal" data-id="${esc(meal.idMeal)}">Read and import ${icon('arrow-right')}</button>`}
        </div>
      </article>`;
    }).join('') : `<div class="live-empty">No global record matches “${esc(globalState.q)}”. Clear the search to see all ${records.length}.</div>`;
    return { body, count: `${rows.length} of ${records.length} records` };
  }

  function refreshGlobalRows() {
    const slot = $('#global-rows');
    if (!slot) return;
    const { body, count } = globalRows();
    slot.innerHTML = body;
    const counter = $('#global-count');
    if (counter) counter.textContent = count;
  }

  function researchView() {
    const censusMax = Math.max(...GLOBAL_CENSUS.map((entry) => entry[1]));
    const censusTotal = GLOBAL_CENSUS.reduce((sum, entry) => sum + entry[1], 0);
    const bars = GLOBAL_CENSUS.map(([area, count]) => `<div class="census-row">
      <span class="census-area">${esc(area)}</span>
      <span class="census-track"><span style="width:${Math.round((count / censusMax) * 100)}%"></span></span>
      <span class="census-n">${count}</span>
    </div>`).join('');
    const worldAreas = new Set((GLOBAL.records || []).map((meal) => meal.strArea)).size;
    const caribbeanTotal = (CARIBBEAN.meals || []).length + CARIBBEAN_SOURCES.length;
    const caribbeanPlaces = new Set(['Jamaica', ...CARIBBEAN_SOURCES.map((record) => record.country.replace(/ \(inspired\)$/, ''))]).size;
    const africaTotal = (AFRICA.meals || []).length + AFRICA_SOURCES.length;
    const collections = [
      ['The world', `${GLOBAL.records.length} records · ${worldAreas} cuisines`],
      ['Africa', `${africaTotal} records · ${africaPlaces().size} places`],
      ['Caribbean', `${caribbeanTotal} records · ${caribbeanPlaces} places`],
      ['Bundled samples', `${SAMPLES.length} recipes · 2 publishers`],
    ];

    return `<div class="page research-page">
      <div class="title-row research-title">
        <div>
          <h1>Global research</h1>
          <p class="sub">TheMealDB is global, but its public area index is not evenly world-sized. Mise records that shape instead of pretending a small database is universal.</p>
        </div>
        <div class="title-actions">
          <a class="btn primary" href="#/library?tab=global">${icon('arrow-right')}Open the world kitchen</a>
        </div>
      </div>

      <section class="panel research-feature" aria-labelledby="research-feature-title">
        <div class="research-copy">
          <h2 id="research-feature-title">Evidence before flavour</h2>
          <p>Before adding more “global” recipes, Mise audited what the public source actually offers. The result is useful, geographically skewed and therefore honest about what it cannot represent.</p>
        </div>
        <dl class="research-facts">
          <div><dt>Unique area labels</dt><dd>195</dd></div>
          <div><dt>Areas with meals</dt><dd>${GLOBAL_CENSUS.length}</dd></div>
          <div><dt>Area matches</dt><dd>${censusTotal}</dd></div>
          <div><dt>World records kept</dt><dd>${GLOBAL.records.length}</dd></div>
        </dl>
      </section>

      <div class="research-grid">
        <section class="panel census-panel" aria-labelledby="census-title">
          <div class="panel-head"><h2 id="census-title">Area coverage in TheMealDB</h2><span class="meta">${censusTotal} results · ${GLOBAL_CENSUS.length} areas</span></div>
          <div class="census-list" aria-label="Area result counts">${bars}</div>
          <p class="census-foot">Bar length is the number of meals the area filter returns, not a quality score. ${195 - GLOBAL_CENSUS.length} of 195 area labels return no meals; that is a gap in the source, not evidence of absence.</p>
        </section>

        <aside class="research-side">
          <section class="panel atlas-panel" aria-labelledby="atlas-title">
            <div class="panel-head"><h2 id="atlas-title">The collections</h2><span class="meta">What is bundled</span></div>
            <ol class="atlas-list">${collections.map(([label, detail]) => `<li><span>${esc(label)}</span><b>${esc(detail)}</b></li>`).join('')}</ol>
          </section>
          <section class="panel method-panel" aria-labelledby="method-title">
            <div class="panel-head"><h2 id="method-title">What Mise can honestly claim</h2><span class="meta">Method</span></div>
            <ul class="method-list">
              <li>Every TheMealDB meal was read from its own record; meal ids link through to the source.</li>
              <li>Publisher recipes were read from the page's schema.org Recipe data. Publisher, author and URL stay on the record; photographs are not re-hosted.</li>
              <li>Indian, Indonesian, Ethiopian, Nigerian and Brazilian area filters returned no meals at the time of audit, so those cuisines are not substituted. The African and Caribbean collections add named publisher recipes instead.</li>
              <li>Photographs belong to TheMealDB and are hot-linked; Mise does not imply they were shot for it.</li>
              <li>Selection favours recognition and spread, not ratings, popularity or national rank.</li>
            </ul>
          </section>
        </aside>
      </div>
      <p class="research-foot">Source: TheMealDB public API and the publishers named on each record, audited 10 Nov 2026. Unlisted areas are not inferred to have no cuisine; they are absent from this source. Future recipe imports should preserve source URL and licence.</p>
    </div>`;
  }

  function refreshLiveResults() {
    const slot = $('#live-results');
    if (slot) slot.innerHTML = liveResultsHtml();
  }

  async function runLiveSearch() {
    const q = (libraryState.q || '').trim();
    if (!q) {
      libraryState.status = 'error';
      libraryState.error = 'Type a dish name first.';
      refreshLiveResults();
      return;
    }
    libraryState.status = 'loading';
    libraryState.results = [];
    libraryState.error = '';
    refreshLiveResults();
    try {
      const res = await fetch('https://www.themealdb.com/api/json/v1/1/search.php?s=' + encodeURIComponent(q), { cache: 'no-store' });
      if (!res.ok) throw new Error('TheMealDB answered ' + res.status);
      const data = await res.json();
      libraryState.results = Array.isArray(data.meals) ? data.meals : [];
      libraryState.status = 'done';
      announce(libraryState.results.length + ' meals found for ' + q);
    } catch (err) {
      libraryState.status = 'error';
      libraryState.error = 'TheMealDB did not answer from this network. The public API may be rate-limited; try again.';
    }
    refreshLiveResults();
  }

  /* ---------- detail ---------- */
  function detailView(recipe) {
    const c = coverStats(recipe);
    const scale = scaleFor(recipe);
    const serves = recipe.yields ? Math.round(recipe.yields * scale * 10) / 10 : null;
    const total = recipe.totalMinutes;

    return `<div class="page">
      <div class="crumbs">
        <a href="#/library">Library</a><span class="sep">/</span><span>${esc(recipe.source)}</span>
      </div>
      <div class="title-row detail-title">
        <div>
          <h1>${esc(recipe.name)}</h1>
          <p class="sub">${esc(descriptionFor(recipe))}</p>
        </div>
        <div class="title-actions">
          ${recipe.sourceUrl ? `<a class="btn" href="${esc(safeUrl(recipe.sourceUrl))}" target="_blank" rel="noopener noreferrer">${icon('external')}Source</a>` : ''}
          <a class="btn primary" href="#/cook/${esc(recipe.id)}">${icon('play')}Start cooking</a>
        </div>
      </div>

      <section class="detail-hero" aria-label="${esc(recipe.name)} at a glance">
        <div class="detail-hero-img${imgSrc(recipe.image) ? '' : ' noimg'}" data-img>
          <span class="img-fallback" aria-hidden="true">${icon('pot')}</span>
          ${imgSrc(recipe.image) ? `<img src="${esc(imgSrc(recipe.image))}" alt="${esc(recipe.name)}" loading="lazy">` : ''}
        </div>
        <div class="detail-copy">
          <div class="source-line">
            <span class="src">${esc(recipe.source)}</span>
            ${recipe.author ? `<span class="sep">/</span><span>${esc(recipe.author)}</span>` : ''}
            ${recipe.cuisine ? `<span class="sep">/</span><span>${esc(recipe.cuisine)}</span>` : ''}
            ${recipe.category ? `<span class="sep">/</span><span>${esc(recipe.category)}</span>` : ''}
          </div>
          <div class="structure-hero">
            <div class="structure-hero-top">
              <div>
                <div class="ratio">${c.named}<span> / ${c.checked}</span></div>
                <div class="ratio-label">listed ingredients named in a step</div>
              </div>
              <span class="pill ${c.missing ? 'warn' : 'pos'}">${c.missing ? c.missing + ' source gap' + (c.missing === 1 ? '' : 's') : 'No gaps'}</span>
            </div>
            <div class="meter ${c.missing ? 'warn' : ''}"><span style="width:${c.pct}%"></span></div>
            <div class="detail-facts">
              <div class="fact"><div class="flabel">Steps</div><div class="fvalue">${recipe.stats.steps}</div></div>
              <div class="fact"><div class="flabel">Timers</div><div class="fvalue">${recipe.stats.timers}</div></div>
              <div class="fact"><div class="flabel">Timer time</div><div class="fvalue">${recipe.stats.timedMinutes ? recipe.stats.timedMinutes + ' <small>min</small>' : dash}</div></div>
              <div class="fact"><div class="flabel">Total time</div><div class="fvalue${total ? '' : ' dash'}">${total ? esc(minutesText(total)) : '–'}</div></div>
            </div>
            <p class="detail-credit">${photoCredit(recipe)}</p>
          </div>
        </div>
      </section>

      <div class="detail-grid">
        <div class="detail-main">
          ${ingredientsPanel(recipe, scale, serves)}
        </div>
        <aside class="detail-side">
          ${structureCard(recipe)}
          ${timersCard(recipe)}
          ${sourceCard(recipe)}
        </aside>
      </div>
      <div class="method-full">
        ${stepsPanel(recipe, scale)}
      </div>
    </div>`;
  }

  function photoCredit(recipe) {
    if (recipe.imageCredit) return `Photograph: ${recipe.imageCredit}${recipe.source ? ' / ' + recipe.source : ''}.`;
    if (recipe.source === 'TheMealDB') return 'Photograph: TheMealDB.';
    if (recipe.sourceUrl) return 'Photograph: the publisher, linked from the source page.';
    return 'No photograph in the source record.';
  }

  function ingredientsPanel(recipe, scale, serves) {
    const groups = ingredientGroups(recipe);
    const body = groups.map((group) => {
      const meta = group.key === 'serve'
        ? { label: 'For serving', cls: 'cat-serve' }
        : catMeta(group.items[0]);
      const rows = group.items.map((ing) => {
        const amount = P.amountText(ing, scale);
        return `<div class="ing-row${ing.serving ? ' is-serve' : ''}">
          <div class="ing-amount">${amount ? esc(amount) : '<span class="none">No measure</span>'}</div>
          <div class="ing-name">${esc(ing.item)}${ing.note ? `<span class="ing-note">${esc(ing.note)}</span>` : ''}${!ing.serving && !ing.steps.length ? `<span class="ing-note">No step names this</span>` : ''}</div>
          ${ing.serving ? '<div class="usage none"><span class="usage-steps">Serve</span></div>' : usageTrack(recipe, ing)}
        </div>`;
      }).join('');
      return `<div class="cat-head"><span class="cat-pill ${meta.cls}">${esc(meta.label)} <span class="n">${group.items.length}</span></span></div>${rows}`;
    }).join('');

    const scaler = recipe.yields ? `<div class="scaler">
      <span class="slabel">Batch</span>
      <div class="segmented" role="group" aria-label="Scale the batch">
        ${[1, 1.5, 2].map((v) => `<button type="button" data-action="scale" data-scale="${v}" aria-pressed="${scale === v}">${v === 1 ? '×1' : '×' + String(v).replace('.', '.')}</button>`).join('')}
      </div>
    </div>` : `<span class="meta">Source gives no yield</span>`;

    return `<section class="panel" aria-labelledby="ing-title">
      <div class="panel-head">
        <h2 id="ing-title">Ingredients</h2>
        ${scaler}
      </div>
      ${recipe.yields ? `<div class="scale-note" style="margin-bottom:12px">
        ${icon('info')}
        <span>${scale === 1
          ? `Amounts as written, for ${recipe.yields} servings.`
          : `Scaled ×${scale} for ${serves} servings; amounts rounded to the nearest 1/8.`}</span>
      </div>` : `<p class="meta" style="margin-bottom:12px">The source lists no yield, so these amounts stay as written.</p>`}
      <div class="ing-cols"><span>Amount</span><span>Ingredient</span><span class="r">Used in step</span></div>
      ${body}
    </section>`;
  }

  function stepsPanel(recipe, scale) {
    const split = recipe.review.split;
    const steps = recipe.steps.map((step) => {
      const chips = step.ingredients.map((id) => {
        const ing = recipe.ingredients.find((i) => i.id === id);
        if (!ing) return '';
        const amount = P.amountText(ing, scale);
        return `<span class="chip">${amount ? `<b>${esc(amount)}</b>` : ''}${esc(ing.item)}</span>`;
      }).join('');
      const timers = step.timers.map((t, idx) => `<button class="chip time" type="button" data-action="start-timer" data-step="${step.n}" data-timer="${idx}" title="Start this timer">${icon('clock')}${esc(P.timerText(t))}</button>`).join('');
      return `<div class="step-row" id="step-${step.n}">
        <a class="step-num" href="#/cook/${esc(recipe.id)}?step=${step.n}" aria-label="Cook from step ${step.n}">${step.n}</a>
        <div>
          <p class="step-text">${esc(step.text)}</p>
          ${chips ? `<div class="step-chips">${chips}${timers}</div>` : (timers ? `<div class="step-chips">${timers}</div>` : '')}
          ${!step.ingredients.length ? `<span class="step-note">No listed ingredient is named in this step.</span>` : ''}
        </div>
      </div>`;
    }).join('');

    return `<section class="panel" aria-labelledby="steps-title">
      <div class="panel-head">
        <h2 id="steps-title">Method</h2>
        <span class="meta">${recipe.stats.steps} steps${split ? ` / split from ${recipe.sourceBlocks} source blocks` : ''}</span>
      </div>
      <div class="step-list">${steps}</div>
    </section>`;
  }

  function structureCard(recipe) {
    const c = coverStats(recipe);
    const extra = recipe.review.extra || [];
    const missing = recipe.review.missing || [];
    return `<section class="panel structure-card" aria-labelledby="struct-title">
      <div class="panel-head">
        <h2 id="struct-title">Structure check</h2>
        <span class="meta">${c.pct}%</span>
      </div>
      <div class="big">${c.named}<span> / ${c.checked}</span></div>
      <p class="lede">${esc(coverageLine(recipe))}</p>
      <div class="meter ${c.missing ? 'warn' : ''}"><span style="width:${c.pct}%"></span></div>
      <ul class="checks">
        <li><span class="dot ${c.missing ? 'warn' : 'ok'}"></span><span class="lab">Named in a step</span><b>${c.named} <span class="sub">of ${c.checked}</span></b></li>
        <li><span class="dot ${c.missing ? 'warn' : 'ok'}"></span><span class="lab">Left as a source gap</span><b>${c.missing}${missing.length ? `<span class="sub">${esc(missing.join(', '))}</span>` : '<span class="sub">none</span>'}</b></li>
        <li><span class="dot note"></span><span class="lab">Serving items</span><b>${c.serving}<span class="sub">not counted</span></b></li>
        <li><span class="dot note"></span><span class="lab">Steps</span><b>${recipe.stats.steps}<span class="sub">from ${recipe.sourceBlocks} source blocks</span></b></li>
        <li><span class="dot note"></span><span class="lab">Timers found</span><b>${recipe.stats.timers}<span class="sub">${recipe.stats.timedMinutes} min counted</span></b></li>
        <li><span class="dot ${extra.length ? 'warn' : 'note'}"></span><span class="lab">Named in steps, unlisted</span><b>${extra.length || 0}${extra.length ? `<span class="sub">${esc(extra.join(', '))}</span>` : '<span class="sub">none</span>'}</b></li>
      </ul>
      ${missing.length ? `<div class="notice">${icon('info')}<span>The source lists ${esc(missing.join(', '))} but no step names ${missing.length === 1 ? 'it' : 'them'}. Mise leaves the step text alone and shows the gap here.</span></div>` : ''}
      ${extra.length ? `<div class="notice quiet">${icon('info')}<span>The steps name ${esc(extra.join(', '))} without listing ${extra.length === 1 ? 'it' : 'them'}. It is not added to the ingredient list.</span></div>` : ''}
      <p class="structure-foot">A dot is a step that names the ingredient. Nothing is moved into a step by inference.</p>
    </section>`;
  }

  function timersCard(recipe) {
    const rows = recipe.timers.length ? recipe.timers.map((t, idx) => {
      const active = timerState && timerState.recipeId === recipe.id && timerState.step === t.step && timerState.index === idx;
      return `<li>
        <span class="tl">${esc(P.timerText(t))}<span class="s">Step ${t.step}${t.label ? ' / ' + esc(t.label) : ''}</span></span>
        ${active
          ? `<span class="running"><span class="dot"></span>${timerState.done ? 'Finished' : timerState.running ? 'Running' : 'Paused'}</span>`
          : `<button class="btn sm" type="button" data-action="start-timer" data-step="${t.step}" data-timer="${idx}">Start</button>`}
      </li>`;
    }).join('') : `<li><span class="tl">No timer in this source<span class="s">The step text gives no duration.</span></span></li>`;

    return `<section class="panel" aria-labelledby="timers-title">
      <div class="panel-head">
        <h2 id="timers-title">Timers</h2>
        <span class="meta">${recipe.timers.length} found</span>
      </div>
      <ul class="timer-list">${rows}</ul>
    </section>`;
  }

  function sourceCard(recipe) {
    return `<section class="panel source-card" aria-labelledby="source-title">
      <div class="panel-head">
        <h2 id="source-title">Source</h2>
        <span class="meta">${recipe.kind === 'api' ? 'API record' : recipe.kind === 'schema' ? 'Schema.org' : 'Bundled'}</span>
      </div>
      <dl class="kv">
        <dt>Publisher</dt><dd>${esc(recipe.source)}</dd>
        <dt>Author</dt><dd>${recipe.author ? esc(recipe.author) : dash}</dd>
        <dt>Serves</dt><dd>${recipe.yields ? recipe.yields : dash}</dd>
        <dt>Total time</dt><dd>${recipe.totalMinutes ? esc(minutesText(recipe.totalMinutes)) : dash}</dd>
        <dt>Added</dt><dd>${recipe.importedAt ? esc(formatDate(recipe.importedAt)) : recipe.kind === 'api' ? 'Bundled' : dash}</dd>
        <dt>Link</dt><dd>${recipe.sourceUrl ? `<a href="${esc(safeUrl(recipe.sourceUrl))}" target="_blank" rel="noopener noreferrer">${esc(host(recipe.sourceUrl) || 'Open')}</a>` : dash}</dd>
      </dl>
      ${recipe.kind === 'api' ? `<p class="meta" style="margin-top:12px">TheMealDB gives no yield and no total time. Both stay blank rather than being estimated.</p>` : ''}
      <div class="source-actions">
        <button class="link-action" type="button" data-action="sources">Sources, credits and limits</button>
      </div>
    </section>`;
  }

  /* ---------- cook ---------- */
  let session = null;

  function getSession(recipe, stepParam) {
    let s = store.get(KEY.session, null);
    const stale = s && s.startedAt && Date.now() - s.startedAt > 12 * 60 * 60 * 1000;
    if (!s || s.recipeId !== recipe.id || s.complete || stale) {
      s = { recipeId: recipe.id, step: 1, done: [], checks: {}, all: {}, startedAt: Date.now(), complete: false };
    }
    if (!Array.isArray(s.done)) s.done = [];
    if (!s.checks) s.checks = {};
    if (!s.all) s.all = {};
    if (stepParam && stepParam >= 1 && stepParam <= recipe.steps.length) s.step = stepParam;
    s.step = Math.min(Math.max(1, s.step || 1), Math.max(1, recipe.steps.length));
    store.set(KEY.session, s);
    session = s;
    return s;
  }

  function cookView(recipe, stepParam) {
    const s = getSession(recipe, stepParam);
    if (!recipe.steps.length) return `<div class="page"><div class="panel state-panel"><h2>No steps in this record</h2><p>${esc(recipe.source)} supplied ingredients but no method text, so there is nothing honest to cook from.</p><div class="actions"><a class="btn primary" href="#/recipe/${esc(recipe.id)}">Back to the recipe</a></div></div></div>`;

    const step = recipe.steps[s.step - 1];
    const scale = scaleFor(recipe);
    const items = step.ingredients.map((id) => recipe.ingredients.find((i) => i.id === id)).filter(Boolean);
    const checked = s.checks[s.step] || {};
    const donePct = Math.round((s.done.length / recipe.steps.length) * 100);
    const timers = step.timers.map((t, idx) => {
      const active = timerState && timerState.recipeId === recipe.id && timerState.step === step.n && timerState.index === idx;
      return `<button class="timer-btn" type="button" data-action="start-timer" data-step="${step.n}" data-timer="${idx}" data-timer-start>
        <span class="ticon">${icon('clock')}</span>
        <span class="tcopy"><b>${esc(P.timerText(t))}${t.label ? ' / ' + esc(t.label) : ''}</b><span>${active ? (timerState.done ? 'Finished, start again' : 'Running in the timer dock') : 'Start timer'}</span></span>
      </button>`;
    }).join('');

    const stepList = recipe.steps.map((st) => {
      const current = st.n === s.step;
      const done = s.done.includes(st.n);
      const stepTimers = current ? timers : '';
      return `<li class="cook-step-card${current ? ' current' : ''}${done ? ' done' : ''}" ${current ? 'aria-current="step"' : ''}>
        <button class="cook-step-select" type="button" data-action="cook-step" data-step="${st.n}" aria-label="Go to step ${st.n}${done ? ', completed' : ''}">
          <span class="cook-step-number">${done ? icon('check') : st.n}</span>
          <span class="cook-step-label">Step ${st.n}${st.section ? ` <span>/ ${esc(st.section)}</span>` : ''}</span>
          <span class="cook-step-state">${current ? 'Current step' : done ? 'Completed' : 'Go to step'}</span>
        </button>
        <p class="cook-step-text">${esc(st.text)}</p>
        ${stepTimers ? `<div class="cook-timers">${stepTimers}</div>` : ''}
      </li>`;
    }).join('');

    const missNote = stepNote(recipe, step);
    const last = s.step === recipe.steps.length;
    return `<div class="page cook-page">
      <div class="cook-top">
        <a class="cook-back" href="#/recipe/${esc(recipe.id)}">${icon('arrow-left')}<span>${esc(recipe.name)}</span></a>
        <span class="cook-context">${esc(recipe.source)}${recipe.author ? ' / ' + esc(recipe.author) : ''} / ${recipe.stats.steps} steps</span>
         <span class="cook-clock">${icon('clock')}Time Elapsed <b data-elapsed>00:00</b></span>
        <a class="btn sm" href="#/recipe/${esc(recipe.id)}">Exit</a>
      </div>
      <div class="cook-progress" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${donePct}" aria-label="Steps marked done"><span style="width:${donePct}%"></span></div>
      <div class="cook-grid">
         <main class="cook-main">
           <div class="cook-meta">${icon('flame')}${s.done.length} of ${recipe.steps.length} Steps Complete</div>
           <h1>Cooking Instructions</h1>
           <p class="cook-sub">All ${recipe.steps.length} steps are shown in full, in the publisher’s order. Select a step to make it current and see its ingredients and timers.</p>
           ${missNote ? `<div class="notice quiet cook-gap-note">${icon('info')}<span>${esc(missNote)}</span></div>` : ''}
           <ol class="cook-steps">${stepList}</ol>
           <div class="cook-actions">
            <button class="btn ghost" type="button" data-action="cook-back" ${s.step === 1 ? 'disabled' : ''}>${icon('arrow-left')}Back</button>
             <button class="btn primary" type="button" data-action="cook-next">${last ? 'Finish Cooking' : 'Next Step'}${icon('arrow-right')}</button>
             <button class="btn ghost" type="button" data-action="start-over">Start Over</button>
          </div>
          <p class="keys"><kbd>←</kbd> <kbd>→</kbd> move between steps. <kbd>T</kbd> starts the step's first timer. <kbd>Esc</kbd> leaves.</p>
        </main>

        <aside class="cook-side">
          <section class="panel mise" data-ui="binder-page" aria-labelledby="mise-title">
            <div class="binder-holes" data-ui="binder-punch" aria-hidden="true"><span></span><span></span><span></span></div>
            <div class="panel-head">
               <h2 id="mise-title">Ingredients For This Step</h2>
              <span class="meta">${items.length} item${items.length === 1 ? '' : 's'}</span>
            </div>
            ${items.length ? `<div class="check-list">${items.map((ing) => {
              const amount = P.amountText(ing, scale);
              return `<label class="check-row" data-ui="binder-line-item">
                <input class="check-box" type="checkbox" data-action="check-ing" data-step="${step.n}" data-ing="${esc(ing.id)}" ${checked[ing.id] ? 'checked' : ''}>
                <span class="check-amount">${amount ? esc(amount) : '–'}</span>
                <span class="check-name">${esc(ing.item)}${ing.note ? `<span class="ing-note">${esc(ing.note)}</span>` : ''}</span>
              </label>`;
            }).join('')}</div>` : `<div class="empty-inline">The source step does not name an ingredient from the list. Check the method before you start it.</div>`}
            <p class="meta note">${scale !== 1 ? `Amounts at ×${scale}. ` : ''}Crossed-off items are kept for this cook only.</p>
          </section>

          ${cookTimerCard(recipe)}
          ${fullMiseCard(recipe, scale)}
        </aside>
      </div>
    </div>`;
  }

  function shortStep(text) {
    const t = String(text || '').replace(/\s+/g, ' ').trim();
    return t.length > 54 ? t.slice(0, 52).replace(/[,;:. ]+\S*$/, '') + '…' : t;
  }

  function stepNote(recipe, step) {
    const extra = recipe.review.extra || [];
    if (!extra.length) return '';
    const found = extra.filter((w) => new RegExp('\\b' + w + '\\b', 'i').test(step.text));
    if (!found.length) return '';
    return `The step also names ${found.join(' and ')}, which the source's ingredient list does not. It is left out of the mise.`;
  }

  function upNextCard(recipe, s) {
    const next = recipe.steps[s.step];
    if (!next) {
      return `<section class="panel up-next" aria-labelledby="up-next-title">
        <div class="panel-head"><h2 id="up-next-title">Last step</h2><span class="meta">Finish when it is out of the pan</span></div>
        <p class="up-next-text">Mise will record the steps you mark done, your checks and your elapsed time. Nothing leaves this browser.</p>
      </section>`;
    }
    const nextItems = next.ingredients.map((id) => recipe.ingredients.find((i) => i.id === id)).filter(Boolean);
    const chips = nextItems.map((ing) => `<span class="chip">${esc(ing.item)}</span>`).join('');
    return `<section class="panel up-next" aria-labelledby="up-next-title">
       <div class="panel-head"><h2 id="up-next-title">Up Next · Step ${next.n}</h2><span class="meta">${nextItems.length} Ingredient${nextItems.length === 1 ? '' : 's'}${next.timers.length ? ` · ${next.timers.length} Timer${next.timers.length === 1 ? '' : 's'}` : ''}</span></div>
      <p class="up-next-text">${esc(next.text)}</p>
      ${chips ? `<div class="step-chips">${chips}</div>` : ''}
    </section>`;
  }

  function fullMiseCard(recipe, scale) {
    const all = recipe.ingredients.filter((ing) => !ing.serving);
    const checks = session && session.recipeId === recipe.id ? (session.all || {}) : {};
    const rows = all.map((ing) => {
      const amount = P.amountText(ing, scale);
      return `<label class="full-row">
        <input class="check-box" type="checkbox" data-action="check-mise" data-ing="${esc(ing.id)}" ${checks[ing.id] ? 'checked' : ''}>
        <span class="check-amount">${amount ? esc(amount) : '–'}</span>
        <span class="check-name">${esc(ing.item)}</span>
      </label>`;
    }).join('');
    return `<section class="panel full-mise" aria-labelledby="full-mise-title">
       <div class="panel-head"><h2 id="full-mise-title">All Ingredients</h2><span class="meta">${all.length} Items</span></div>
      <div class="full-mise-list">${rows}</div>
       <p class="meta" style="margin-top:10px">Crossed-off items stay marked throughout this cook. Serving items stay on the recipe page.</p>
    </section>`;
  }

  function cookTimerCard(recipe) {
    const t = timerState;
    if (!t) {
      return `<section class="panel timer-card" aria-labelledby="cook-timer-title">
        <div class="panel-head"><h2 id="cook-timer-title">Timer</h2><span class="meta">One at a time</span></div>
        <div class="tdisplay" data-ui="timer-bezel">${timerDigits('00:00')}</div>
        <div class="tlabel">No timer set · Start one from any step</div>
      </section>`;
    }
    const state = t.done ? 'Finished' : t.running ? 'Running' : 'Paused';
    return `<section class="panel timer-card" aria-labelledby="cook-timer-title">
      <div class="panel-head"><h2 id="cook-timer-title">Timer</h2><span class="pill ${t.done ? 'soft' : ''}">${state}</span></div>
      <div class="tdisplay" data-ui="timer-bezel"><span class="timer-display-value${t.done ? ' done' : ''}" data-timer-display>${timerDigits(clock(remainingMs(t)))}</span></div>
      <div class="tlabel" data-timer-label>${esc(t.sub)} / step ${t.step}</div>
      <div class="tcontrols">
        <button class="btn sm" type="button" data-action="${t.done || !t.running ? 'timer-resume' : 'timer-pause'}">${icon(t.done || !t.running ? 'play' : 'pause')}${t.done ? 'Again' : t.running ? 'Pause' : 'Resume'}</button>
        <button class="btn sm ghost" type="button" data-action="timer-reset">${icon('reset')}Reset</button>
        <button class="btn sm ghost" type="button" data-action="timer-close">${icon('x')}Clear</button>
      </div>
    </section>`;
  }

  /* ---------- done ---------- */
  function doneView(recipe) {
    const cooked = store.get(KEY.lastcook, null);
    const mine = cooked && cooked.recipeId === recipe.id ? cooked : null;
    const doneCount = mine ? (mine.done || []).length : 0;
    const checks = mine && mine.checks ? mine.checks : {};
    const checkedIds = new Set();
    Object.keys(checks).forEach((step) => Object.keys(checks[step] || {}).forEach((id) => { if (checks[step][id]) checkedIds.add(id); }));
    const checkedItems = recipe.ingredients.filter((i) => checkedIds.has(i.id));
    const scale = scaleFor(recipe);

    return `<div class="page done-page">
      <div class="title-row">
        <div>
          <div class="meta-line">${icon('check')}Cooked</div>
          <h1>${esc(recipe.name)}</h1>
          <p class="sub">${mine
            ? `${doneCount} of ${recipe.stats.steps} steps marked done${mine.elapsedMs ? ` in ${esc(elapsedText(mine.elapsedMs))}` : ''}. ${checkedItems.length} ingredient${checkedItems.length === 1 ? '' : 's'} checked off.`
            : 'This cook is finished. Open the recipe to see its structure again.'}</p>
        </div>
        <div class="title-actions">
          <a class="btn primary" href="#/library">Back to library</a>
        </div>
      </div>

      <div class="done-grid">
        <section class="panel" aria-labelledby="done-recipe-title">
          <div class="panel-head"><h2 id="done-recipe-title">What you cooked</h2><span class="meta">${esc(recipe.source)}</span></div>
          <div class="done-recipe">
            ${imgWrap(recipe.image, recipe.name, 'done-thumb')}
            <div>
              <div class="done-name">${esc(recipe.name)}</div>
              <div class="done-src">${esc(recipe.source)}${recipe.author ? ' / ' + esc(recipe.author) : ''}${recipe.yields ? ' / serves ' + recipe.yields : ''}</div>
              <div class="done-actions">
                <a class="btn" href="#/cook/${esc(recipe.id)}">${icon('reset')}Cook it again</a>
                <a class="btn ghost" href="#/recipe/${esc(recipe.id)}">Open the recipe</a>
              </div>
            </div>
          </div>
          <div class="done-facts">
            <div class="fact"><div class="flabel">Steps done</div><div class="fvalue">${doneCount} <small>of ${recipe.stats.steps}</small></div></div>
            <div class="fact"><div class="flabel">At the stove</div><div class="fvalue">${mine && mine.elapsedMs ? esc(elapsedText(mine.elapsedMs)) : dash}</div></div>
            <div class="fact"><div class="flabel">Timers set</div><div class="fvalue">${timerState ? 1 : 0} <small>${timerState ? 'still on the clock' : 'none now'}</small></div></div>
          </div>
        </section>

        <section class="panel" aria-labelledby="done-mise-title">
          <div class="panel-head"><h2 id="done-mise-title">The mise</h2><span class="meta">${checkedItems.length} of ${recipe.stats.ingredients}</span></div>
          ${checkedItems.length ? `<ul class="done-list">${checkedItems.map((ing) => `<li>
            <span class="dot ok"></span>
            <span>${esc(ing.item)}</span>
            <span class="amount">${esc(P.amountText(ing, scale) || '–')}</span>
          </li>`).join('')}</ul>` : `<div class="empty-inline">Nothing was checked during this cook. The ticks are optional; the steps still stand.</div>`}
          <p class="meta" style="margin-top:12px">Serving items are left off this list. Source gaps stay gaps.</p>
        </section>
      </div>
      ${nextKitchenPanel(recipe)}
    </div>`;
  }

  function nextKitchenPanel(recipe) {
    const next = allRecipes().filter((r) => r.id !== recipe.id).slice(0, 3);
    if (!next.length) return '';
    return `<section class="panel done-next" aria-labelledby="done-next-title">
      <div class="panel-head"><h2 id="done-next-title">What you can cook next</h2><a class="section-link" href="#/library">All recipes ${icon('arrow-right')}</a></div>
      <div class="recipe-rows next-list">${next.map((item) => {
        const c = coverStats(item);
        return `<a class="rrow" href="#/recipe/${esc(item.id)}">
          ${imgWrap(item.image, item.name, 'rthumb')}
          <span>
            <span class="rname">${esc(item.name)}</span>
            <span class="rsub">${esc(item.source)} / ${esc(item.cuisine || item.category || 'No cuisine given')}</span>
          </span>
          <span class="meter-line ${c.missing ? 'gap' : ''}">
            <span class="meter"><span style="width:${c.pct}%"></span></span>
            <span class="ratio"><b>${c.named}</b><span>/${c.checked}</span></span>
          </span>
          <span class="rnum">${item.stats.steps} <span>steps</span></span>
          <span class="rgo">${icon('arrow-right')}</span>
        </a>`;
      }).join('')}</div>
    </section>`;
  }

  /* ---------- missing route ---------- */
  function missingView(kind) {
    const text = kind === 'recipe'
      ? 'That recipe is not in this browser. It may have been imported in another browser profile.'
      : kind === 'cook'
        ? 'There is no recipe to cook yet. Import one or choose a sample, then start cooking.'
        : kind === 'done'
          ? 'There is no finished cook for that recipe in this browser.'
          : 'That address does not point to a screen in Mise.';
    return `<div class="page"><div class="panel state-panel">
      <h1>${kind === 'page' ? 'That page is not here' : 'Nothing to open'}</h1>
      <p>${esc(text)}</p>
      <div class="actions">
        <a class="btn primary" href="#/">${icon('import')}Import a recipe</a>
        <a class="btn" href="#/library">Open the library</a>
      </div>
    </div></div>`;
  }

  /* ---------- timer ---------- */
  let timerState = store.get(KEY.timer, null);
  let timerCardObserver = null;
  let timerCardVisible = false;
  let timerAnnounced = false;

  function remainingMs(t) {
    if (!t) return 0;
    if (!t.running) return Math.max(0, t.remaining || 0);
    return Math.max(0, t.endsAt - Date.now());
  }

  function saveTimer() {
    timerState = timerState && timerState.id ? timerState : null;
    store.set(KEY.timer, timerState);
  }

  function startTimer(recipe, stepNumber, idx) {
    const step = recipe.steps[stepNumber - 1];
    if (!step || !step.timers[idx]) return;
    const t = step.timers[idx];
    timerState = {
      id: recipe.id + ':' + stepNumber + ':' + idx + ':' + Date.now(),
      recipeId: recipe.id,
      recipeName: recipe.name,
      step: stepNumber,
      index: idx,
      sub: P.timerText(t),
      total: t.seconds * 1000,
      remaining: t.seconds * 1000,
      endsAt: Date.now() + t.seconds * 1000,
      running: true,
      done: false,
    };
    timerAnnounced = false;
    saveTimer();
    renderTimerDock();
    render();
    announce('Timer started: ' + P.timerText(t) + (timerState.total > 0 ? ', step ' + stepNumber : ''));
  }

  function pauseTimer() {
    if (!timerState || timerState.done) return;
    timerState.remaining = remainingMs(timerState);
    timerState.running = false;
    timerState.endsAt = 0;
    saveTimer();
    render();
  }

  function resumeTimer() {
    if (!timerState) return;
    if (timerState.done || (timerState.remaining || 0) <= 0) {
      timerState.remaining = timerState.total;
    }
    timerState.done = false;
    timerState.running = true;
    timerState.endsAt = Date.now() + timerState.remaining;
    timerAnnounced = false;
    saveTimer();
    render();
    announce('Timer running again.');
  }

  function resetTimer() {
    if (!timerState) return;
    timerState.remaining = timerState.total;
    timerState.endsAt = Date.now() + timerState.total;
    timerState.running = true;
    timerState.done = false;
    timerAnnounced = false;
    saveTimer();
    render();
    announce('Timer reset.');
  }

  function closeTimer() {
    timerState = null;
    saveTimer();
    renderTimerDock();
    render();
    announce('Timer cleared.');
  }

  function finishTimer() {
    if (!timerState) return;
    timerState.running = false;
    timerState.remaining = 0;
    timerState.endsAt = 0;
    timerState.done = true;
    saveTimer();
    if (!timerAnnounced) {
      timerAnnounced = true;
      announce('Timer finished. ' + timerState.sub + ', step ' + timerState.step + '.', true);
    }
    renderTimerDock();
    updateTimerDigits(document.querySelector('[data-timer-display]'), '00:00');
  }

  function renderTimerDock() {
    const dock = $('#timer-dock');
    if (!dock) return;
    if (!timerState) {
      dock.hidden = true;
      dock.innerHTML = '';
      return;
    }
    const t = timerState;
    const state = t.done ? 'Finished' : t.running ? 'Running' : 'Paused';
    const hasTimerCard = document.body.classList.contains('route-cook') && $('#view .timer-card');
    dock.hidden = !!(hasTimerCard && timerCardVisible);
    dock.classList.toggle('done', !!t.done);
    dock.innerHTML = `
      <span class="td-clock" data-timer-clock>${clock(remainingMs(t))}</span>
      <span class="td-copy">
        <span class="td-label">${esc(t.sub)} / ${esc(t.recipeName)} / step ${t.step}</span>
        <span class="td-state"><span class="dot ${t.done ? 'ok' : ''}"></span>${state}</span>
      </span>
      <span class="td-actions">
        <button class="btn icon" type="button" data-action="${t.done || !t.running ? 'timer-resume' : 'timer-pause'}" aria-label="${t.done || !t.running ? 'Resume timer' : 'Pause timer'}" title="${t.done || !t.running ? 'Resume' : 'Pause'}">${icon(t.done || !t.running ? 'play' : 'pause')}</button>
        <button class="btn icon" type="button" data-action="timer-reset" aria-label="Reset timer" title="Reset">${icon('reset')}</button>
        <button class="btn icon" type="button" data-action="timer-close" aria-label="Clear timer" title="Clear">${icon('x')}</button>
      </span>`;
  }

  function observeTimerCard() {
    if (timerCardObserver) timerCardObserver.disconnect();
    timerCardObserver = null;
    const card = $('#view .timer-card');
    if (!document.body.classList.contains('route-cook') || !card) {
      timerCardVisible = false;
      return;
    }
    const rect = card.getBoundingClientRect();
    const visibleHeight = Math.max(0, Math.min(rect.bottom, window.innerHeight) - Math.max(rect.top, 0));
    timerCardVisible = rect.height > 0 && visibleHeight / rect.height >= 0.25;
    if ('IntersectionObserver' in window) {
      timerCardObserver = new IntersectionObserver((entries) => {
        timerCardVisible = entries.some((entry) => entry.intersectionRatio >= 0.25);
        renderTimerDock();
      }, { threshold: [0, 0.25, 0.5] });
      timerCardObserver.observe(card);
    }
  }

  function syncCookClock() {
    const node = document.querySelector('[data-elapsed]');
    if (!node || !session) return;
    node.textContent = elapsedText(Date.now() - session.startedAt);
  }

  function tick() {
    if (timerState) {
      const rem = remainingMs(timerState);
      const dockClock = document.querySelector('#timer-dock [data-timer-clock]');
      if (dockClock) dockClock.textContent = clock(rem);
      const cardDisplay = document.querySelector('[data-timer-display]');
      if (cardDisplay) {
        updateTimerDigits(cardDisplay, clock(rem));
      }
      if (timerState.running && rem <= 0) finishTimer();
    }
    syncCookClock();
  }
  window.setInterval(tick, 250);

  /* ---------- session actions ---------- */
  function showCookStep(recipe) {
    navigate('#/cook/' + recipe.id + '?step=' + session.step);
  }

  function cookStep(routeRecipe, n) {
    if (!session || session.recipeId !== routeRecipe.id) session = getSession(routeRecipe);
    session.step = Math.min(Math.max(1, n), routeRecipe.steps.length);
    store.set(KEY.session, session);
    showCookStep(routeRecipe);
    announce('Step ' + session.step + ' of ' + routeRecipe.steps.length);
  }

  function cookNext(recipe) {
    if (!session || session.recipeId !== recipe.id) session = getSession(recipe);
    if (!session.done.includes(session.step)) session.done.push(session.step);
    if (session.step >= recipe.steps.length) {
      finishCook(recipe);
      return;
    }
    session.step += 1;
    store.set(KEY.session, session);
    showCookStep(recipe);
  }

  function cookBack(recipe) {
    if (!session) return;
    if (session.step > 1) {
      session.step -= 1;
      store.set(KEY.session, session);
      showCookStep(recipe);
    }
  }

  function finishCook(recipe) {
    const finishedAt = Date.now();
    const startedAt = session ? session.startedAt : finishedAt;
    store.set(KEY.lastcook, {
      recipeId: recipe.id,
      startedAt,
      finishedAt,
      elapsedMs: Math.max(0, finishedAt - startedAt),
      done: session ? session.done.slice() : [],
      checks: session ? session.checks : {},
    });
    if (session) {
      session.complete = true;
      store.set(KEY.session, session);
    }
    announce('Finished cooking ' + recipe.name + '.');
    navigate('#/done/' + recipe.id);
  }

  function checksFor(recipe) {
    if (!session || session.recipeId !== recipe.id) return;
    const boxes = $$('.check-box[data-action="check-ing"]');
    const map = {};
    boxes.forEach((box) => { map[box.dataset.ing] = box.checked; });
    session.checks[session.step] = map;
    store.set(KEY.session, session);
  }

  /* ---------- import ---------- */
  function setImportStatus(html, error) {
    const node = $('#import-status');
    if (!node) return;
    node.innerHTML = `<div class="status-line${error ? ' error' : ''}">${icon(error ? 'info' : 'link')}<span>${html}</span></div>`;
  }

  function setImportBusy(text) {
    const node = $('#import-status');
    if (!node) return;
    node.innerHTML = `<div class="status-line">${icon('link')}<span>${esc(text)}</span></div><div class="import-skeletons"><div class="skeleton-row"><span class="skeleton thumb"></span><span class="lines"><span class="skeleton l1"></span><span class="skeleton l2"></span></span></div></div>`;
  }

  function normalizeUrl(value) {
    let u = String(value || '').trim();
    if (!u) return '';
    if (!/^https?:\/\//i.test(u)) {
      if (/^[\w-]+(\.[\w-]+)+([/?#].*)?$/.test(u)) u = 'https://' + u;
      else return '';
    }
    try { return new URL(u).href; } catch (e) { return ''; }
  }

  function withTimeout(url, ms) {
    const controller = new AbortController();
    const id = window.setTimeout(() => controller.abort(), ms);
    return fetch(url, { signal: controller.signal, redirect: 'follow', cache: 'no-store' })
      .then((res) => {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.text();
      })
      .finally(() => window.clearTimeout(id));
  }

  function proxyUrls(url) {
    return [
      'https://api.allorigins.win/raw?url=' + encodeURIComponent(url),
      'https://api.codetabs.com/v1/proxy?quest=' + encodeURIComponent(url),
    ];
  }

  async function importFromUrl(url) {
    setImportBusy('Reading ' + host(url) + ' and looking for its Recipe data…');
    const attempts = [url].concat(proxyUrls(url)).map(async (target) => {
      const html = await withTimeout(target, 11000);
      const raw = P.extractFromHtml(html, url);
      if (!raw) throw new Error('No Recipe data');
      return raw;
    });

    try {
      const raw = await Promise.any(attempts);
      const recipe = P.buildRecipe(raw, { importedAt: new Date().toISOString() });
      if (!recipe.steps.length || !recipe.ingredients.length) throw new Error('Recipe data was incomplete');
      saveImported(recipe);
      setImportStatus('Read ' + esc(recipe.name) + ' from ' + esc(recipe.source) + '. Opening the breakdown.');
      announce('Imported ' + recipe.name);
      navigate('#/recipe/' + recipe.id);
    } catch (err) {
      const msg = 'No Recipe data could be read from that address. The site may block cross-origin reads, or the page may not publish schema.org Recipe data.';
      setImportStatus(`${esc(msg)} <span class="status-actions"><button class="link-action" type="button" data-action="paste" data-url="${esc(url)}">Paste the page source</button><a class="link-action" href="#/library?tab=live">Search TheMealDB</a></span>`, true);
      announce('Import failed. Paste the page source or search TheMealDB.', true);
    }
  }

  function openPaste(url) {
    const source = url || ($('#recipe-url') ? $('#recipe-url').value.trim() : '');
    modalBody.innerHTML = `<div class="modal-body">
      <button class="btn icon ghost modal-close" type="button" data-action="close-modal" aria-label="Close">${icon('x')}</button>
      <h2 id="modal-title">Paste the page source</h2>
      <p class="lede">On the recipe page, choose View Source (or save the page) and copy the HTML. Mise looks only for the page's schema.org Recipe block; it does not run the page's scripts.</p>
      <div class="field">
        <label for="paste-source">Page HTML or Recipe JSON</label>
        <textarea class="input" id="paste-source" spellcheck="false" placeholder="Paste the whole page, or just the JSON-LD script contents…"></textarea>
        <span class="hint">If the page publishes a Recipe block, its name, ingredients and steps arrive exactly as written.</span>
      </div>
      <p class="err" id="paste-err" role="alert"></p>
      <div class="modal-foot">
        <button class="btn" type="button" data-action="close-modal">Cancel</button>
        <button class="btn primary" type="button" data-action="paste-parse" data-url="${esc(url || '')}">Read the source</button>
      </div>
    </div>`;
    openModal();
    const ta = $('#paste-source');
    if (ta) ta.focus();
  }

  function parsePasted(url) {
    const ta = $('#paste-source');
    const err = $('#paste-err');
    if (!ta) return;
    const text = ta.value.trim();
    if (!text) {
      if (err) err.textContent = 'Paste the page HTML or its Recipe JSON first.';
      return;
    }
    let raw = null;
    if (/<script|<html|<body|<div/i.test(text)) {
      raw = P.extractFromHtml(text, url || '');
    } else {
      raw = P.recipeFromPastedJson(text);
    }
    if (!raw) {
      if (err) err.textContent = 'No schema.org Recipe block was found in that text. Copy the whole page, including its script tags.';
      return;
    }
    const recipe = P.buildRecipe(raw, { importedAt: new Date().toISOString() });
    if (!recipe.steps.length || !recipe.ingredients.length) {
      if (err) err.textContent = 'That Recipe block has no usable ingredients or steps.';
      return;
    }
    saveImported(recipe);
    closeModal();
    announce('Imported ' + recipe.name);
    navigate('#/recipe/' + recipe.id);
  }

  function importMeal(id) {
    const meal = (libraryState.results || []).find((m) => String(m.idMeal) === String(id))
      || (CARIBBEAN.meals || []).find((m) => String(m.idMeal) === String(id))
      || (GLOBAL.records || []).find((m) => String(m.idMeal) === String(id));
    if (!meal) return;
    const recipe = P.recipeFromMealDB(meal, new Date().toISOString());
    if (!recipe || !recipe.steps.length) {
      announce('That meal has no instructions to read.', true);
      return;
    }
    saveImported(recipe);
    announce('Imported ' + recipe.name);
    navigate('#/recipe/' + recipe.id);
  }

  function recipeFromSourceRecord(record) {
    const raw = P.recipeFromJsonLd({
      name: record.name,
      recipeIngredient: record.ingredients,
      recipeInstructions: record.instructions,
      recipeYield: record.yields,
      prepTime: record.prepTime,
      cookTime: record.cookTime,
      totalTime: record.totalTime,
      author: record.author,
      recipeCuisine: record.country,
    }, { id: record.id, url: record.sourceUrl, sourceName: record.source });
    return P.buildRecipe(raw, { importedAt: new Date().toISOString() });
  }

  function importSourceRecord(record) {
    const here = knownImported(record.sourceUrl);
    if (here) { navigate('#/recipe/' + here.id); return; }
    const recipe = recipeFromSourceRecord(record);
    if (!recipe.ingredients.length || !recipe.steps.length) {
      announce('The publisher record has no usable ingredients or instructions.', true);
      return;
    }
    saveImported(recipe);
    announce('Imported ' + recipe.name + ' from ' + record.source);
    navigate('#/recipe/' + recipe.id);
  }

  function importCaribbeanSource(id) {
    const record = CARIBBEAN_SOURCES.find((item) => item.id === id);
    if (record) importSourceRecord(record);
  }

  function importAfricaSource(id) {
    const record = AFRICA_SOURCES.find((item) => item.id === id);
    if (record) importSourceRecord(record);
  }

  function importAllCaribbean() {
    const urlFor = (meal) => 'https://www.themealdb.com/meal/' + meal.idMeal;
    let added = 0;
    let reused = 0;
    for (const meal of (CARIBBEAN.meals || [])) {
      if (knownImported(urlFor(meal))) { reused += 1; continue; }
      const recipe = P.recipeFromMealDB(meal, new Date().toISOString());
      if (!recipe || !recipe.steps.length) continue;
      saveImported(recipe);
      added += 1;
    }
    for (const record of CARIBBEAN_SOURCES) {
      if (knownImported(record.sourceUrl)) { reused += 1; continue; }
      const recipe = recipeFromSourceRecord(record);
      if (!recipe.ingredients.length || !recipe.steps.length) continue;
      saveImported(recipe);
      added += 1;
    }
    announce(added ? `Imported ${added} Caribbean recipe${added === 1 ? '' : 's'}; ${reused} ${reused === 1 ? 'was' : 'were'} already imported.` : 'All Caribbean records are already imported.');
    render();
  }

  function importAllAfrica() {
    const urlFor = (meal) => 'https://www.themealdb.com/meal/' + meal.idMeal;
    let added = 0;
    let reused = 0;
    for (const meal of (AFRICA.meals || [])) {
      if (knownImported(urlFor(meal))) { reused += 1; continue; }
      const recipe = P.recipeFromMealDB(meal, new Date().toISOString());
      if (!recipe || !recipe.steps.length) continue;
      saveImported(recipe);
      added += 1;
    }
    for (const record of AFRICA_SOURCES) {
      if (knownImported(record.sourceUrl)) { reused += 1; continue; }
      const recipe = recipeFromSourceRecord(record);
      if (!recipe.ingredients.length || !recipe.steps.length) continue;
      saveImported(recipe);
      added += 1;
    }
    announce(added ? `Imported ${added} African recipe${added === 1 ? '' : 's'}; ${reused} ${reused === 1 ? 'was' : 'were'} already imported.` : 'All African records are already imported.');
    render();
  }

  function importAllGlobal() {
    const urlFor = (meal) => 'https://www.themealdb.com/meal/' + meal.idMeal;
    let added = 0;
    let reused = 0;
    for (const meal of (GLOBAL.records || [])) {
      if (knownImported(urlFor(meal))) { reused += 1; continue; }
      const recipe = P.recipeFromMealDB(meal, new Date().toISOString());
      if (!recipe || !recipe.steps.length) continue;
      saveImported(recipe);
      added += 1;
    }
    announce(added ? `Imported ${added} global recipe${added === 1 ? '' : 's'}; ${reused} ${reused === 1 ? 'was' : 'were'} already imported.` : 'All global records are already imported.');
    render();
  }

  /* ---------- modals ---------- */
  const modal = $('#modal');
  const modalBody = $('#modal-body');

  function openModal() {
    if (!modal || !modalBody) return;
    if (modal.open) modal.close();
    modal.showModal();
  }

  function closeModal() {
    if (modal && modal.open) modal.close();
  }

  function openSources() {
    modalBody.innerHTML = `<div class="modal-body">
      <button class="btn icon ghost modal-close" type="button" data-action="close-modal" aria-label="Close">${icon('x')}</button>
      <h2 id="modal-title">Where this comes from</h2>
      <p class="lede">Every recipe on this screen is a published record. Mise adds structure, never prose.</p>
      <div class="source-list">
        <div>
          <h3>TheMealDB</h3>
          <p>Live search, four bundled recipes, the world collection and the African and Caribbean snapshots come from TheMealDB's public API. Each record keeps its meal id and links back to <a href="https://www.themealdb.com" target="_blank" rel="noopener noreferrer">themealdb.com</a>. TheMealDB gives no total time or yield, so Mise shows a dash rather than an estimate.</p>
        </div>
        <div>
          <h3>Food &amp; Wine</h3>
          <p>Classic Beef Chili is from <a href="https://www.foodandwine.com/recipes/classic-beef-chili" target="_blank" rel="noopener noreferrer">Food &amp; Wine</a>, recipe by Robby Melvin, photograph by Caitlin Bensel. The record is the page's own schema.org Recipe data. Step photographs in that data are by Molly Bolton and are linked, not re-hosted.</p>
        </div>
        <div>
          <h3>Chef Lola's Kitchen</h3>
          <p>Nigerian jollof rice, suya, egusi, moin moin, puff puff, pepper soup, efo riro, doro wat, injera, kelewele, nyama choma, mandazi and East African chapati are read from <a href="https://cheflolaskitchen.com" target="_blank" rel="noopener noreferrer">cheflolaskitchen.com</a>. Ingredients and steps keep the publisher's wording; each record links to its page.</p>
        </div>
        <div>
          <h3>196 Flavors</h3>
          <p>Bobotie, waakye, oil down, pom, Johnny cake, Bajan salt fish cakes, locrio de pica pica, sawine, pernil asado, pelau, soup joumou, Trinidad black cake and Jamaican patty are read from <a href="https://www.196flavors.com" target="_blank" rel="noopener noreferrer">196flavors.com</a>. Mise does not re-host their photographs.</p>
        </div>
        <div>
          <h3>That Girl Cooks Healthy and BBC Good Food</h3>
          <p>Caribbean dishes from <a href="https://thatgirlcookshealthy.com" target="_blank" rel="noopener noreferrer">thatgirlcookshealthy.com</a> and <a href="https://www.bbcgoodfood.com" target="_blank" rel="noopener noreferrer">bbcgoodfood.com</a> are read the same way, from each page's own schema.org Recipe data. Vegan versions keep the word “vegan” in their names.</p>
        </div>
        <div>
          <h3>Global recipe research</h3>
          <p>The <a href="#/research">Global research</a> screen documents a 10 Nov 2026 audit of TheMealDB area filters: 195 area labels, ${GLOBAL_CENSUS.length} areas with matches and ${GLOBAL_CENSUS.reduce((sum, entry) => sum + entry[1], 0)} matches. The world kitchen keeps ${GLOBAL.records.length} recognition-led records; African and Caribbean recipes are collected in their own tabs.</p>
        </div>
        <div>
          <h3>Manrope, Fraunces and Caveat</h3>
          <p>Manrope, Fraunces and Caveat are bundled typefaces under the SIL Open Font License 1.1. Caveat is used only for the ingredient names on the cook-mode binder page.</p>
        </div>
      </div>
      <p class="limit-note"><strong>Limits, stated plainly.</strong> Live links are read in your browser, so a site with a strict CORS policy or a bot wall may refuse; paste the page source instead. Timers are the durations written in a step, and a range counts down from the lower bound while its label keeps the range. Ingredient-to-step links are word matches: an ingredient a step uses without naming stays a gap. Scaled amounts are rounded to the nearest 1/8. One timer runs at a time.</p>
    </div>`;
    openModal();
  }

  /* ---------- events ---------- */
  document.addEventListener('click', (event) => {
    const target = event.target.closest('[data-action]');
    if (!target) {
      if (event.target === modal) closeModal();
      return;
    }
    const action = target.dataset.action;
    const route = parseRoute();
    const recipe = route.parts[1] ? getRecipe(route.parts[1]) : null;

    if (action === 'sources') { openSources(); return; }
    if (action === 'focus-import') {
      const input = $('#recipe-url');
      if (input) {
        input.scrollIntoView({ block: 'center', behavior: 'smooth' });
        input.focus({ preventScroll: true });
      }
      return;
    }
    if (action === 'paste') { openPaste(target.dataset.url || ''); return; }
    if (action === 'close-modal') { closeModal(); return; }
    if (action === 'paste-parse') { parsePasted(target.dataset.url || ''); return; }

    if (action === 'library-tab') {
      libraryState.tab = ['kitchen', 'live', 'caribbean', 'africa', 'global'].includes(target.dataset.tab) ? target.dataset.tab : 'kitchen';
      navigate('#/library' + (libraryState.tab === 'kitchen' ? '' : '?tab=' + libraryState.tab));
      return;
    }
    if (action === 'filter-source') {
      libraryState.source = target.dataset.source || 'all';
      $$('.chipbtn[data-action="filter-source"]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.source === libraryState.source)));
      refreshLibraryRows();
      return;
    }
    if (action === 'clear-library') {
      libraryState.q = '';
      libraryState.source = 'all';
      render();
      return;
    }
    if (action === 'live-suggest') {
      libraryState.q = target.dataset.q || '';
      runLiveSearch();
      return;
    }
    if (action === 'live-search') {
      const input = $('#live-q');
      if (input) libraryState.q = input.value;
      runLiveSearch();
      return;
    }
    if (action === 'import-all-caribbean') {
      importAllCaribbean();
      return;
    }
    if (action === 'import-all-africa') {
      importAllAfrica();
      return;
    }
    if (action === 'import-all-global') {
      importAllGlobal();
      return;
    }
    if (action === 'import-meal') { importMeal(target.dataset.id); return; }
    if (action === 'import-caribbean-source') { importCaribbeanSource(target.dataset.id); return; }
    if (action === 'import-africa-source') { importAfricaSource(target.dataset.id); return; }

    if (action === 'scale') {
      if (!recipe) return;
      const v = Number(target.dataset.scale);
      setScale(recipe, v === 1.5 || v === 2 ? v : 1);
      render();
      announce('Batch scaled to ' + v + '.');
      return;
    }

    if (action === 'start-timer') {
      if (!recipe) return;
      startTimer(recipe, parseInt(target.dataset.step, 10), parseInt(target.dataset.timer, 10));
      return;
    }
    if (action === 'timer-pause') { pauseTimer(); return; }
    if (action === 'timer-resume') { resumeTimer(); return; }
    if (action === 'timer-reset') { resetTimer(); return; }
    if (action === 'timer-close') { closeTimer(); return; }

    if (action === 'cook-step') {
      if (recipe) cookStep(recipe, parseInt(target.dataset.step, 10));
      return;
    }
    if (action === 'cook-next') {
      if (recipe) cookNext(recipe);
      return;
    }
    if (action === 'cook-back') {
      if (recipe) cookBack(recipe);
      return;
    }
    if (action === 'start-over') {
      if (recipe) {
        session = { recipeId: recipe.id, step: 1, done: [], checks: {}, startedAt: Date.now(), complete: false };
        store.set(KEY.session, session);
        showCookStep(recipe);
        announce('Started over at step 1.');
      }
      return;
    }
    if (action === 'exit-cook') {
      if (recipe) navigate('#/recipe/' + recipe.id);
      return;
    }
  });

  document.addEventListener('change', (event) => {
    const miseBox = event.target.closest('[data-action="check-mise"]');
    if (miseBox) {
      const route = parseRoute();
      const recipe = getRecipe(route.parts[1] || '');
      if (!recipe) return;
      if (!session || session.recipeId !== recipe.id) session = getSession(recipe);
      if (!session.all) session.all = {};
      session.all[miseBox.dataset.ing] = miseBox.checked;
      store.set(KEY.session, session);
      announce(miseBox.checked ? 'Added to the whole mise.' : 'Removed from the whole mise.');
      return;
    }
    const box = event.target.closest('[data-action="check-ing"]');
    if (!box) return;
    const route = parseRoute();
    const recipe = getRecipe(route.parts[1] || '');
    if (!recipe) return;
    if (!session || session.recipeId !== recipe.id) session = getSession(recipe);
    if (!session.checks[session.step]) session.checks[session.step] = {};
    session.checks[session.step][box.dataset.ing] = box.checked;
    store.set(KEY.session, session);
    const step = recipe.steps[session.step - 1];
    const items = step.ingredients.map((id) => recipe.ingredients.find((i) => i.id === id)).filter(Boolean);
    const checked = items.filter((i) => session.checks[session.step][i.id]).length;
    announce(checked + ' of ' + items.length + ' ingredients checked for step ' + session.step);
  });

  document.addEventListener('input', (event) => {
    if (event.target.id === 'lib-search') {
      libraryState.q = event.target.value;
      refreshLibraryRows();
    }
    if (event.target.id === 'live-q') {
      libraryState.q = event.target.value;
    }
    if (event.target.id === 'caribbean-q') {
      caribbeanState.q = event.target.value;
      refreshCaribbeanRows();
    }
    if (event.target.id === 'africa-q') {
      africaState.q = event.target.value;
      refreshAfricaRows();
    }
    if (event.target.id === 'global-q') {
      globalState.q = event.target.value;
      refreshGlobalRows();
    }
  });

  document.addEventListener('submit', (event) => {
    if (event.target.id === 'import-form') {
      event.preventDefault();
      const input = $('#recipe-url');
      const url = normalizeUrl(input ? input.value : '');
      if (!url) {
        setImportStatus('That does not look like a recipe address. Use a full https:// link, or paste the page source.', true);
        if (input) input.focus();
        return;
      }
      store.set('mise.importurl.v1', url);
      input.value = url;
      importFromUrl(url);
      return;
    }
    if (event.target.id === 'live-form') {
      event.preventDefault();
      const input = $('#live-q');
      if (input) libraryState.q = input.value;
      runLiveSearch();
    }
  });

  document.addEventListener('keydown', (event) => {
    if (modal && modal.open) return;
    if (event.target.matches('input, textarea, select')) return;
    const route = parseRoute();
    if (route.parts[0] !== 'cook') return;
    const recipe = getRecipe(route.parts[1] || '');
    if (!recipe) return;

    if (event.key === 'ArrowRight') { event.preventDefault(); cookNext(recipe); return; }
    if (event.key === 'ArrowLeft') { event.preventDefault(); cookBack(recipe); return; }
    if (event.key === 'Escape') { event.preventDefault(); navigate('#/recipe/' + recipe.id); return; }
    if (event.key === 't' || event.key === 'T') {
      const step = recipe.steps[(session ? session.step : 1) - 1];
      if (step && step.timers.length) {
        event.preventDefault();
        startTimer(recipe, step.n, 0);
      }
    }
  });

  window.addEventListener('hashchange', render);

  // image failures: keep the frame, show the pot mark
  document.addEventListener('error', (event) => {
    const img = event.target;
    if (!img || img.tagName !== 'IMG') return;
    const wrap = img.closest('[data-img]');
    if (wrap) {
      wrap.classList.add('noimg');
      img.remove();
    }
  }, true);

  if (modal) {
    modal.addEventListener('click', (event) => {
      if (event.target === modal) closeModal();
    });
  }

  // restore the last address on the import field
  if (!location.hash) {
    // leave the home route explicit so the rail can mark itself
    if (history.replaceState) history.replaceState(null, '', '#/');
  }
  const rememberedUrl = store.get('mise.importurl.v1', '');
  if (rememberedUrl) {
    window.setTimeout(() => {
      const input = $('#recipe-url');
      if (input && !input.value) input.value = rememberedUrl;
    }, 0);
  }

  render();
})();
