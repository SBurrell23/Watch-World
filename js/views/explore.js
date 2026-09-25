import { esc, debounce, listParam, label, TIER_LABELS, SEGMENTS, CONTINENTS, MOVEMENT_TYPES, SPECIALTIES, uniq, fmtNum } from '../lib/util.js';
import { brandCard } from '../components/cards.js';

const PAGE = 48;
const fold = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

const SORTS = [
  ['name', 'Name A–Z'],
  ['name-desc', 'Name Z–A'],
  ['founded', 'Oldest first'],
  ['founded-desc', 'Newest first'],
  ['price', 'Price: low to high'],
  ['price-desc', 'Price: high to low'],
  ['popularity', 'Most popular'],
  ['prestige', 'Most prestigious'],
  ['retention', 'Best value retention'],
  ['value', 'Best value for money'],
];

const LIST_FACETS = {
  cont: { title: 'Continent', key: (b) => b.continent },
  country: { title: 'Country', key: (b) => b.country, search: true, scroll: true },
  seg: { title: 'Segment', key: (b) => b.segment },
  group: { title: 'Parent group', key: (b) => b.parentGroup, search: true, scroll: true },
  mv: { title: 'Movements', key: (b) => b.movementTypes, multi: true, chips: true },
  spec: { title: 'Specialties', key: (b) => b.specialties, multi: true, chips: true },
  inhouse: { title: 'In-house movements', key: (b) => b.inHouseMovements },
  status: { title: 'Status', key: (b) => b.status },
};
const INHOUSE_LABEL = { yes: 'Yes, in-house', partial: 'Partly in-house', no: 'Sourced' };

let st;
let off = [];

export default {
  title: 'Explore',
  render(root, ctx) {
    const { brands } = ctx;
    const p = ctx.params;
    const years = brands.map((b) => b.founded).filter(Boolean);
    const yMin = years.length ? Math.min(...years) : 1700;
    const yMax = years.length ? Math.max(...years) : new Date().getFullYear();

    const range = (v, lo, hi) => {
      const m = /^(\d+)-(\d+)$/.exec(v || '');
      if (!m) return [lo, hi];
      const a = Math.max(lo, Math.min(hi, +m[1])); const z = Math.max(lo, Math.min(hi, +m[2]));
      return a <= z ? [a, z] : [z, a];
    };
    st = {
      q: p.q || '',
      cont: listParam(p.cont), country: listParam(p.country), seg: listParam(p.seg), group: listParam(p.group),
      mv: listParam(p.mv), spec: listParam(p.spec), inhouse: listParam(p.inhouse), status: listParam(p.status),
      tier: range(p.tier, 1, 10),
      yr: range(p.yr, yMin, yMax),
      pop: Math.max(1, Math.min(10, Number(p.pop) || 1)),
      pres: Math.max(1, Math.min(10, Number(p.pres) || 1)),
      sort: SORTS.some(([k]) => k === p.sort) ? p.sort : 'name',
      view: p.view === 'list' ? 'list' : 'grid',
      shown: PAGE,
      yMin, yMax,
    };

    // Option lists per facet
    const opts = {
      cont: CONTINENTS.filter((c) => brands.some((b) => b.continent === c)),
      country: uniq(brands.map((b) => b.country)).sort(),
      seg: SEGMENTS.filter((s) => brands.some((b) => b.segment === s)),
      group: uniq(brands.map((b) => b.parentGroup)).sort((a, z) => (a === 'Independent' ? -1 : z === 'Independent' ? 1 : a.localeCompare(z))),
      mv: MOVEMENT_TYPES.filter((m) => brands.some((b) => b.movementTypes.includes(m))),
      spec: SPECIALTIES.filter((s) => brands.some((b) => b.specialties.includes(s))),
      inhouse: ['yes', 'partial', 'no'].filter((v) => brands.some((b) => b.inHouseMovements === v)),
      status: ['active', 'revived', 'defunct'].filter((v) => brands.some((b) => b.status === v)),
    };

    const facetHTML = (f) => {
      const cfg = LIST_FACETS[f];
      const items = opts[f];
      if (!items.length) return '';
      const nm = (v) => (f === 'inhouse' ? INHOUSE_LABEL[v] : f === 'mv' || f === 'spec' || f === 'status' ? label(v) : v);
      const body = cfg.chips
        ? `<div class="chip-row">${items.map((v) => `<button type="button" class="chip" data-f="${f}" data-v="${esc(v)}" aria-pressed="${st[f].includes(v)}">${esc(nm(v))}</button>`).join('')}</div>`
        : `${cfg.search ? `<input class="input" type="search" placeholder="Filter ${esc(cfg.title.toLowerCase())}…" data-facet-search="${f}" aria-label="Filter ${esc(cfg.title)} list">` : ''}
           <div class="${cfg.scroll ? 'fgroup__scroll' : ''}">${items.map((v) => `<label class="check" data-name="${esc(fold(v))}"><input type="checkbox" data-f="${f}" value="${esc(v)}" ${st[f].includes(v) ? 'checked' : ''}><span>${esc(nm(v))}</span><span class="count" data-count="${f}::${esc(v)}"></span></label>`).join('')}</div>`;
      const open = st[f].length || ['cont', 'seg'].includes(f);
      return `<details class="fgroup" data-group="${f}" ${open ? 'open' : ''}><summary>${esc(cfg.title)}<span class="n" data-n="${f}"></span></summary><div class="fgroup__body">${body}</div></details>`;
    };

    root.innerHTML = `
<div class="wrap">
  <header class="page-head">
    <p class="eyebrow">The catalogue</p>
    <h1 class="display">Explore <em>${fmtNum(brands.length)}</em> houses</h1>
    <p class="lede">Search by name, city, founder or model, then refine by where they’re from, what they cost and how they’re made. Filters are saved in the address bar, so you can share any view.</p>
  </header>
  <div class="explore">
    <div class="filters-scrim" id="f-scrim"></div>
    <aside class="filters" id="filters" aria-label="Filters">
      <div class="filters__head"><h2 class="h3">Filters</h2><button type="button" class="icon-btn" id="f-close" aria-label="Close filters"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"/></svg></button></div>
      ${facetHTML('cont')}
      ${facetHTML('seg')}
      <details class="fgroup" open data-group="tier"><summary>Price tier<span class="n" data-n="tier"></span></summary><div class="fgroup__body">
        ${dual('tier', 1, 10, st.tier, 'Price tier')}
        <div class="range-out"><span id="tier-lo"></span><span id="tier-hi"></span></div>
      </div></details>
      <details class="fgroup" data-group="pop" ${st.pop > 1 ? 'open' : ''}><summary>Popularity<span class="n" data-n="pop"></span></summary><div class="fgroup__body">
        <input class="single-range" type="range" min="1" max="10" step="1" value="${st.pop}" data-single="pop" aria-label="Minimum popularity">
        <div class="range-out"><span>At least <b id="pop-out">${st.pop}</b>/10</span><span>Household name</span></div>
      </div></details>
      <details class="fgroup" data-group="pres" ${st.pres > 1 ? 'open' : ''}><summary>Prestige<span class="n" data-n="pres"></span></summary><div class="fgroup__body">
        <input class="single-range" type="range" min="1" max="10" step="1" value="${st.pres}" data-single="pres" aria-label="Minimum prestige">
        <div class="range-out"><span>At least <b id="pres-out">${st.pres}</b>/10</span><span>Collector grail</span></div>
      </div></details>
      <details class="fgroup" data-group="yr" ${st.yr[0] !== yMin || st.yr[1] !== yMax ? 'open' : ''}><summary>Founded<span class="n" data-n="yr"></span></summary><div class="fgroup__body">
        ${dual('yr', yMin, yMax, st.yr, 'Founded year')}
        <div class="range-out"><span id="yr-lo"></span><span id="yr-hi"></span></div>
      </div></details>
      ${facetHTML('country')}
      ${facetHTML('group')}
      ${facetHTML('mv')}
      ${facetHTML('spec')}
      ${facetHTML('inhouse')}
      ${facetHTML('status')}
      <div class="filters__foot"><button type="button" class="btn btn--gold filter-open" id="f-done">Show results</button></div>
    </aside>

    <section aria-label="Results">
      <div class="toolbar">
        <label class="searchbox"><span class="sr-only">Search brands</span>
          <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5"/></svg>
          <input class="input" id="x-q" type="search" placeholder="Name, city, founder, model…" value="${esc(st.q)}" autocomplete="off">
        </label>
        <button type="button" class="btn filter-open" id="f-open" aria-controls="filters" aria-expanded="false"><svg viewBox="0 0 24 24"><path d="M4 6h16M7 12h10M10 18h4"/></svg>Filters <span id="f-count"></span></button>
        <label class="sr-only" for="x-sort">Sort by</label>
        <select class="select" id="x-sort">${SORTS.map(([k, l]) => `<option value="${k}" ${k === st.sort ? 'selected' : ''}>${l}</option>`).join('')}</select>
        <div class="seg-toggle" role="group" aria-label="Layout">
          <button type="button" data-view="grid" aria-pressed="${st.view === 'grid'}" aria-label="Grid view"><svg viewBox="0 0 24 24"><rect x="4" y="4" width="6.5" height="6.5" rx="1"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1"/></svg></button>
          <button type="button" data-view="list" aria-pressed="${st.view === 'list'}" aria-label="List view"><svg viewBox="0 0 24 24"><path d="M4 6h16M4 12h16M4 18h16"/></svg></button>
        </div>
      </div>
      <div class="result-bar" aria-live="polite">
        <p class="result-count" id="x-count"></p>
        <div class="chip-row" id="x-chips"></div>
      </div>
      <div class="card-grid ${st.view === 'list' ? 'is-list' : ''}" id="x-grid"></div>
      <div class="load-more" id="x-more"></div>
    </section>
  </div>
</div>`;

    const $ = (s) => root.querySelector(s);
    const grid = $('#x-grid');
    const filtersEl = $('#filters');

    /* ---------- matching ---------- */
    const matchers = {
      q: (b) => { if (!st.q.trim()) return true; const words = fold(st.q).split(/\s+/).filter(Boolean); return words.every((w) => b._q.includes(w)); },
      cont: (b) => !st.cont.length || st.cont.includes(b.continent),
      country: (b) => !st.country.length || st.country.includes(b.country),
      seg: (b) => !st.seg.length || st.seg.includes(b.segment),
      group: (b) => !st.group.length || st.group.includes(b.parentGroup),
      mv: (b) => !st.mv.length || st.mv.every((m) => b.movementTypes.includes(m)),
      spec: (b) => !st.spec.length || st.spec.every((s) => b.specialties.includes(s)),
      inhouse: (b) => !st.inhouse.length || st.inhouse.includes(b.inHouseMovements),
      status: (b) => !st.status.length || st.status.includes(b.status),
      tier: (b) => (st.tier[0] === 1 && st.tier[1] === 10) || (b.priceTier != null && b.priceTier >= st.tier[0] && b.priceTier <= st.tier[1]),
      yr: (b) => (st.yr[0] === yMin && st.yr[1] === yMax) || (b.founded != null && b.founded >= st.yr[0] && b.founded <= st.yr[1]),
      pop: (b) => st.pop <= 1 || (b.popularity || 0) >= st.pop,
      pres: (b) => st.pres <= 1 || (b.prestige || 0) >= st.pres,
    };
    const keys = Object.keys(matchers);
    const passExcept = (b, skip) => keys.every((k) => k === skip || matchers[k](b));

    const valueScore = (b) => ((b.prestige || 5) * 1.3 + (b.valueRetention || 5) * 0.8 + (b.popularity || 5) * 0.5) / ((b.priceTier || 5) + 1.5);
    const priceKey = (b) => (b.priceTier || 0) * 1e7 + Math.min(9e6, b.priceRange?.min || 0);
    const byName = (a, z) => a.name.localeCompare(z.name);
    const sorters = {
      name: byName,
      'name-desc': (a, z) => -byName(a, z),
      founded: (a, z) => (a.founded ?? 9999) - (z.founded ?? 9999) || byName(a, z),
      'founded-desc': (a, z) => (z.founded ?? 0) - (a.founded ?? 0) || byName(a, z),
      price: (a, z) => priceKey(a) - priceKey(z) || byName(a, z),
      'price-desc': (a, z) => priceKey(z) - priceKey(a) || byName(a, z),
      popularity: (a, z) => (z.popularity || 0) - (a.popularity || 0) || byName(a, z),
      prestige: (a, z) => (z.prestige || 0) - (a.prestige || 0) || byName(a, z),
      retention: (a, z) => (z.valueRetention || 0) - (a.valueRetention || 0) || byName(a, z),
      value: (a, z) => valueScore(z) - valueScore(a),
    };

    /* ---------- render ---------- */
    let results = [];
    const tierTxt = (t) => `T${t} · ${TIER_LABELS[t]}`;

    function syncUrl() {
      ctx.setQuery({
        q: st.q.trim() || null,
        cont: st.cont, country: st.country, seg: st.seg, group: st.group, mv: st.mv, spec: st.spec, inhouse: st.inhouse, status: st.status,
        tier: st.tier[0] !== 1 || st.tier[1] !== 10 ? st.tier.join('-') : null,
        yr: st.yr[0] !== yMin || st.yr[1] !== yMax ? st.yr.join('-') : null,
        pop: st.pop > 1 ? st.pop : null,
        pres: st.pres > 1 ? st.pres : null,
        sort: st.sort !== 'name' ? st.sort : null,
        view: st.view !== 'grid' ? st.view : null,
      });
    }
    const syncUrlSoon = debounce(syncUrl, 250);

    function activeChips() {
      const out = [];
      if (st.q.trim()) out.push(['q', '', `“${st.q.trim()}”`]);
      for (const f of Object.keys(LIST_FACETS)) for (const v of st[f]) out.push([f, v, f === 'inhouse' ? INHOUSE_LABEL[v] : f === 'mv' || f === 'spec' || f === 'status' ? label(v) : v]);
      if (st.tier[0] !== 1 || st.tier[1] !== 10) out.push(['tier', '', `Tier ${st.tier[0]}–${st.tier[1]}`]);
      if (st.yr[0] !== yMin || st.yr[1] !== yMax) out.push(['yr', '', `Founded ${st.yr[0]}–${st.yr[1]}`]);
      if (st.pop > 1) out.push(['pop', '', `Popularity ≥ ${st.pop}`]);
      if (st.pres > 1) out.push(['pres', '', `Prestige ≥ ${st.pres}`]);
      return out;
    }

    function update({ resetPage = true, url = true } = {}) {
      if (resetPage) st.shown = PAGE;
      results = brands.filter((b) => passExcept(b, null)).sort(sorters[st.sort] || byName);

      // Facet counts (each facet ignores its own selection)
      for (const f of Object.keys(LIST_FACETS)) {
        const counts = new Map();
        const k = LIST_FACETS[f].key;
        for (const b of brands) {
          if (!passExcept(b, f)) continue;
          const v = k(b);
          if (Array.isArray(v)) v.forEach((x) => counts.set(x, (counts.get(x) || 0) + 1));
          else if (v != null) counts.set(v, (counts.get(v) || 0) + 1);
        }
        filtersEl.querySelectorAll(`[data-count^="${f}::"]`).forEach((el) => {
          const v = el.dataset.count.slice(f.length + 2);
          const n = counts.get(v) || 0;
          el.textContent = n;
          el.closest('.check').style.opacity = n || st[f].includes(v) ? '' : '0.45';
        });
        const nEl = filtersEl.querySelector(`[data-n="${f}"]`);
        if (nEl) nEl.textContent = st[f].length ? st[f].length : '';
      }
      const setN = (k, on) => { const el = filtersEl.querySelector(`[data-n="${k}"]`); if (el) el.textContent = on ? '•' : ''; };
      setN('tier', st.tier[0] !== 1 || st.tier[1] !== 10);
      setN('yr', st.yr[0] !== yMin || st.yr[1] !== yMax);
      setN('pop', st.pop > 1);
      setN('pres', st.pres > 1);

      const chips = activeChips();
      $('#x-count').innerHTML = `<strong>${fmtNum(results.length)}</strong> ${results.length === 1 ? 'house' : 'houses'}`;
      $('#x-chips').innerHTML = chips.map(([f, v, l]) => `<button type="button" class="chip chip--x" data-rm="${f}" data-v="${esc(v)}" aria-label="Remove filter ${esc(l)}">${esc(l)}</button>`).join('')
        + (chips.length ? '<button type="button" class="clear-all" id="x-clear">Clear all</button>' : '');
      const fc = $('#f-count'); fc.textContent = chips.length ? `(${chips.length})` : '';

      renderGrid();
      if (url) syncUrlSoon();
    }

    function renderGrid() {
      if (!results.length) {
        grid.innerHTML = `<div class="empty" style="grid-column:1/-1"><p class="h3">No houses match</p><p>Try removing a filter or searching for something broader.</p><button type="button" class="btn" id="x-clear2">Clear all filters</button></div>`;
        $('#x-more').innerHTML = '';
        return;
      }
      grid.innerHTML = results.slice(0, st.shown).map((b) => brandCard(b, ctx)).join('');
      const left = results.length - st.shown;
      $('#x-more').innerHTML = left > 0 ? `<button type="button" class="btn" id="x-more-btn">Show ${Math.min(left, PAGE)} more <span class="muted">of ${left}</span></button>` : '';
    }

    function paintRanges() {
      const paint = (k, lo, hi, fmt) => {
        const [a, z] = st[k];
        const fill = filtersEl.querySelector(`[data-fill="${k}"]`);
        if (fill) { fill.style.left = `${((a - lo) / (hi - lo || 1)) * 100}%`; fill.style.right = `${100 - ((z - lo) / (hi - lo || 1)) * 100}%`; }
        $(`#${k}-lo`).textContent = fmt(a);
        $(`#${k}-hi`).textContent = fmt(z);
      };
      paint('tier', 1, 10, tierTxt);
      paint('yr', yMin, yMax, String);
      $('#pop-out').textContent = st.pop;
      $('#pres-out').textContent = st.pres;
    }

    function clearAll() {
      Object.assign(st, { q: '', cont: [], country: [], seg: [], group: [], mv: [], spec: [], inhouse: [], status: [], tier: [1, 10], yr: [yMin, yMax], pop: 1, pres: 1 });
      $('#x-q').value = '';
      filtersEl.querySelectorAll('input[type="checkbox"]').forEach((c) => { c.checked = false; });
      filtersEl.querySelectorAll('.chip[data-f]').forEach((c) => c.setAttribute('aria-pressed', 'false'));
      syncRangeInputs();
      paintRanges();
      update();
    }

    function syncRangeInputs() {
      for (const k of ['tier', 'yr']) {
        filtersEl.querySelector(`[data-dual="${k}"][data-end="0"]`).value = st[k][0];
        filtersEl.querySelector(`[data-dual="${k}"][data-end="1"]`).value = st[k][1];
      }
      filtersEl.querySelector('[data-single="pop"]').value = st.pop;
      filtersEl.querySelector('[data-single="pres"]').value = st.pres;
    }

    /* ---------- events ---------- */
    const onQ = debounce(() => { st.q = $('#x-q').value; update(); }, 120);
    $('#x-q').addEventListener('input', onQ);
    $('#x-sort').addEventListener('change', (e) => { st.sort = e.target.value; update(); });
    root.querySelectorAll('[data-view]').forEach((b) => b.addEventListener('click', () => {
      st.view = b.dataset.view;
      root.querySelectorAll('[data-view]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      grid.classList.toggle('is-list', st.view === 'list');
      syncUrl();
    }));

    filtersEl.addEventListener('change', (e) => {
      const c = e.target;
      if (c.matches('input[type="checkbox"][data-f]')) {
        const f = c.dataset.f;
        st[f] = c.checked ? uniq([...st[f], c.value]) : st[f].filter((x) => x !== c.value);
        update();
      }
    });
    filtersEl.addEventListener('click', (e) => {
      const chip = e.target.closest('.chip[data-f]');
      if (!chip) return;
      const f = chip.dataset.f; const v = chip.dataset.v;
      const on = chip.getAttribute('aria-pressed') !== 'true';
      chip.setAttribute('aria-pressed', String(on));
      st[f] = on ? uniq([...st[f], v]) : st[f].filter((x) => x !== v);
      update();
    });
    filtersEl.addEventListener('input', (e) => {
      const t = e.target;
      if (t.dataset.dual) {
        const k = t.dataset.dual; const end = Number(t.dataset.end);
        let v = Number(t.value);
        if (end === 0 && v > st[k][1]) { v = st[k][1]; t.value = v; }
        if (end === 1 && v < st[k][0]) { v = st[k][0]; t.value = v; }
        st[k] = end === 0 ? [v, st[k][1]] : [st[k][0], v];
        paintRanges();
        updateSoon();
      } else if (t.dataset.single) {
        st[t.dataset.single] = Number(t.value);
        paintRanges();
        updateSoon();
      } else if (t.dataset.facetSearch) {
        const s = fold(t.value);
        t.closest('.fgroup__body').querySelectorAll('.check').forEach((l) => { l.hidden = !!s && !l.dataset.name.includes(s); });
      }
    });
    const updateSoon = debounce(() => update(), 60);

    root.addEventListener('click', (e) => {
      const rm = e.target.closest('[data-rm]');
      if (rm) {
        const f = rm.dataset.rm; const v = rm.dataset.v;
        if (f === 'q') { st.q = ''; $('#x-q').value = ''; }
        else if (f === 'tier') st.tier = [1, 10];
        else if (f === 'yr') st.yr = [yMin, yMax];
        else if (f === 'pop' || f === 'pres') st[f] = 1;
        else {
          st[f] = st[f].filter((x) => x !== v);
          filtersEl.querySelectorAll(`[data-f="${f}"]`).forEach((c) => {
            if (c.type === 'checkbox' && c.value === v) c.checked = false;
            if (c.classList.contains('chip') && c.dataset.v === v) c.setAttribute('aria-pressed', 'false');
          });
        }
        syncRangeInputs(); paintRanges(); update();
        return;
      }
      if (e.target.closest('#x-clear, #x-clear2')) { clearAll(); return; }
      if (e.target.closest('#x-more-btn')) { st.shown += PAGE; renderGrid(); }
    });

    // Mobile drawer
    const scrim = $('#f-scrim');
    const openBtn = $('#f-open');
    const setDrawer = (on) => {
      filtersEl.classList.toggle('is-open', on);
      scrim.classList.toggle('is-on', on);
      openBtn.setAttribute('aria-expanded', String(on));
      document.body.classList.toggle('no-scroll', on);
      if (on) $('#f-close').focus(); else if (window.innerWidth <= 1000) openBtn.focus();
    };
    openBtn.addEventListener('click', () => setDrawer(true));
    $('#f-close').addEventListener('click', () => setDrawer(false));
    $('#f-done').addEventListener('click', () => setDrawer(false));
    scrim.addEventListener('click', () => setDrawer(false));
    const onKey = (e) => { if (e.key === 'Escape' && filtersEl.classList.contains('is-open')) setDrawer(false); };
    document.addEventListener('keydown', onKey);
    off = [() => document.removeEventListener('keydown', onKey), () => document.body.classList.remove('no-scroll')];

    paintRanges();
    update({ url: false });
  },
  destroy() {
    off.forEach((f) => f());
    off = [];
  },
};

function dual(key, lo, hi, [a, z], name) {
  return `<div class="dual">
    <div class="dual__track"><div class="dual__fill" data-fill="${key}"></div></div>
    <input type="range" min="${lo}" max="${hi}" step="1" value="${a}" data-dual="${key}" data-end="0" aria-label="${esc(name)} minimum">
    <input type="range" min="${lo}" max="${hi}" step="1" value="${z}" data-dual="${key}" data-end="1" aria-label="${esc(name)} maximum">
  </div>`;
}
