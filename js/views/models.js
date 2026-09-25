// Model Gallery (#/models) — every model across all brands, filterable grid,
// lazily rendered SVG watches and a lightbox with specs.
import { esc, fmtUSD, tierVar, tierOfPrice, header, allModels, uniq, debounce, watchSVG, prefersReducedMotion } from './_shared.js';

const PAGE = 48;
const PRICE_STEPS = [100, 300, 1000, 3000, 7000, 15000, 40000, 100000, 300000, 1000000];
const FAMILIES = [
  { id: 'black', label: 'Black', sw: '#141414' }, { id: 'white', label: 'White & silver', sw: '#e9e6df' },
  { id: 'grey', label: 'Grey', sw: '#7c7f84' }, { id: 'blue', label: 'Blue', sw: '#24477a' },
  { id: 'green', label: 'Green', sw: '#2f6a45' }, { id: 'brown', label: 'Brown & champagne', sw: '#9b7a4f' },
  { id: 'red', label: 'Red & burgundy', sw: '#8e2230' }, { id: 'yellow', label: 'Gold & yellow', sw: '#d2a93b' },
  { id: 'other', label: 'Other', sw: 'conic-gradient(#c33,#3a3,#33c,#c33)' },
];
export function dialFamily(hex) {
  if (!hex || !/^#?[0-9a-f]{6}$/i.test(hex.replace('#', '').padEnd(6, '0'))) return 'other';
  const h6 = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4].map(i => parseInt(h6.slice(i, i + 2), 16) / 255);
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  let h = 0;
  if (d) h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  h = (h * 60 + 360) % 360;
  if (l < 0.13) return 'black';
  if (s < 0.14) return l > 0.68 ? 'white' : l < 0.22 ? 'black' : 'grey';
  if (l > 0.86) return 'white';
  if (h < 15 || h >= 335) return 'red';
  if (h < 45) return l < 0.55 ? 'brown' : (s < 0.45 ? 'brown' : 'yellow');
  if (h < 68) return s < 0.4 ? 'brown' : 'yellow';
  if (h < 170) return 'green';
  if (h < 265) return 'blue';
  return 'other';
}

const SORTS = [
  { id: 'popular', label: 'Most celebrated' }, { id: 'price-asc', label: 'Price: low to high' },
  { id: 'price-desc', label: 'Price: high to low' }, { id: 'newest', label: 'Newest introduced' },
  { id: 'oldest', label: 'Oldest introduced' }, { id: 'name', label: 'Name A–Z' },
];

let cleanup = [];

export default {
  title: 'Model Gallery',
  render(root, ctx) {
    this.destroy();
    const wrap = document.createElement('div');
    wrap.className = 'vw vw-models';
    root.appendChild(wrap);

    const all = allModels(ctx.brands).map(x => ({ ...x, fam: dialFamily(x.m.visual?.dialColor), hay: `${x.m.name} ${x.m.reference || ''} ${x.b.name} ${x.m.movement || ''} ${x.m.caseMaterial || ''} ${x.m.category || ''}`.toLowerCase() }));
    const opts = {
      category: uniq(all.map(x => x.m.category)).sort(),
      shape: uniq(all.map(x => x.m.visual?.caseShape)).sort(),
      metal: uniq(all.map(x => x.m.visual?.caseMetal)).sort(),
      comp: uniq(all.flatMap(x => x.m.visual?.complications || [])).sort(),
      fam: FAMILIES.filter(f => all.some(x => x.fam === f.id)),
    };
    const p = ctx.params || {};
    const state = {
      q: p.q || '', category: p.category || '', brand: p.brand || '', sort: p.sort || 'popular',
      min: +p.min || 0, max: +p.max || 0,
      shape: new Set(), metal: new Set(), fam: new Set(), comp: new Set(),
    };
    const pretty = s => String(s).replace(/-/g, ' ').replace(/\bgmt\b/gi, 'GMT').replace(/^\w/, c => c.toUpperCase());
    const chipRow = (name, items, lab, sw) => `<div class="vw-control"><span class="vw-control__label">${lab}</span><div class="vw-chips" role="group" aria-label="${lab}" data-set="${name}">
      ${items.map(v => `<button type="button" class="vw-chip" data-value="${esc(v.id ?? v)}" aria-pressed="false">${sw ? `<i class="vw-swatch" style="background:${v.sw}"></i>` : ''}${esc(v.label ?? pretty(v))}</button>`).join('')}</div></div>`;

    wrap.innerHTML = `
      ${header({ eyebrow: 'The collection', title: 'Model <em>Gallery</em>', lede: `${all.length.toLocaleString()} iconic references from ${ctx.brands.length} houses, each drawn from its real proportions and colours. Filter, compare and open any watch for its full specification.` })}
      <div class="vw-mg__bar">
        <label class="vw-search"><span class="vw-sr">Search models</span>
          <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5"/></svg>
          <input type="search" placeholder="Search name, reference, brand, movement…" value="${esc(state.q)}" data-f="q"></label>
        <label class="vw-field"><span>Category</span><select class="vw-select" data-f="category"><option value="">All</option>${opts.category.map(c => `<option value="${esc(c)}" ${c === state.category ? 'selected' : ''}>${esc(pretty(c))}</option>`).join('')}</select></label>
        <label class="vw-field"><span>Brand</span><select class="vw-select" data-f="brand"><option value="">All brands</option>${[...ctx.brands].sort((a, b) => a.name.localeCompare(b.name)).map(b => `<option value="${esc(b.id)}" ${b.id === state.brand ? 'selected' : ''}>${esc(b.name)}</option>`).join('')}</select></label>
        <label class="vw-field"><span>From</span><select class="vw-select" data-f="min"><option value="0">Any</option>${PRICE_STEPS.map(v => `<option value="${v}" ${v === state.min ? 'selected' : ''}>${fmtUSD(v)}</option>`).join('')}</select></label>
        <label class="vw-field"><span>To</span><select class="vw-select" data-f="max"><option value="0">Any</option>${PRICE_STEPS.map(v => `<option value="${v}" ${v === state.max ? 'selected' : ''}>${fmtUSD(v)}</option>`).join('')}</select></label>
        <label class="vw-field"><span>Sort</span><select class="vw-select" data-f="sort">${SORTS.map(s => `<option value="${s.id}" ${s.id === state.sort ? 'selected' : ''}>${s.label}</option>`).join('')}</select></label>
      </div>
      <details class="vw-mg__more">
        <summary>More filters <span class="vw-mg__active"></span></summary>
        <div class="vw-mg__morebody">
          ${chipRow('shape', opts.shape, 'Case shape')}
          ${chipRow('metal', opts.metal, 'Case metal')}
          ${chipRow('fam', opts.fam, 'Dial colour', true)}
          ${chipRow('comp', opts.comp, 'Complications')}
        </div>
      </details>
      <div class="vw-mg__status"><p aria-live="polite" class="vw-mg__count"></p><button type="button" class="vw-btn vw-btn--small" data-reset>Reset filters</button></div>
      <div class="vw-mg__grid" role="list"></div>
      <div class="vw-mg__sentinel" aria-hidden="true"></div>
      <dialog class="vw-lightbox" aria-labelledby="vwLbTitle"></dialog>`;

    const grid = wrap.querySelector('.vw-mg__grid');
    const countEl = wrap.querySelector('.vw-mg__count');
    const activeEl = wrap.querySelector('.vw-mg__active');
    const sentinel = wrap.querySelector('.vw-mg__sentinel');
    const dlg = wrap.querySelector('.vw-lightbox');
    let results = [], shown = 0;

    // lazy SVG rendering
    const io = new IntersectionObserver(entries => {
      for (const en of entries) {
        if (!en.isIntersecting) continue;
        const el = en.target; io.unobserve(el);
        const it = results[+el.dataset.i] || all.find(x => x.key === el.dataset.key);
        if (it) el.innerHTML = watchSVG(ctx, it.m, it.b, { size: 180, showStrap: true });
        el.classList.add('is-drawn');
      }
    }, { rootMargin: '300px 0px' });
    const more = new IntersectionObserver(en => { if (en[0].isIntersecting && shown < results.length) appendPage(); }, { rootMargin: '600px 0px' });
    more.observe(sentinel);
    cleanup.push(() => { io.disconnect(); more.disconnect(); });

    function filter() {
      const q = state.q.trim().toLowerCase().split(/\s+/).filter(Boolean);
      results = all.filter(x => {
        const m = x.m, v = m.visual || {};
        if (state.category && m.category !== state.category) return false;
        if (state.brand && x.b.id !== state.brand) return false;
        if (state.min && !(m.priceUSD >= state.min)) return false;
        if (state.max && !(m.priceUSD <= state.max)) return false;
        if (state.shape.size && !state.shape.has(v.caseShape)) return false;
        if (state.metal.size && !state.metal.has(v.caseMetal)) return false;
        if (state.fam.size && !state.fam.has(x.fam)) return false;
        if (state.comp.size && ![...state.comp].every(c => (v.complications || []).includes(c))) return false;
        return q.every(t => x.hay.includes(t));
      });
      const s = state.sort;
      const P = x => x.m.priceUSD ?? null;
      results.sort(
        s === 'price-asc' ? (a, b) => (P(a) ?? 1e12) - (P(b) ?? 1e12) :
        s === 'price-desc' ? (a, b) => (P(b) ?? -1) - (P(a) ?? -1) :
        s === 'newest' ? (a, b) => (b.m.introduced || 0) - (a.m.introduced || 0) :
        s === 'oldest' ? (a, b) => (a.m.introduced || 9999) - (b.m.introduced || 9999) :
        s === 'name' ? (a, b) => a.m.name.localeCompare(b.m.name) :
        (a, b) => ((b.b.popularity || 0) + (b.b.prestige || 0) * 0.5) - ((a.b.popularity || 0) + (a.b.prestige || 0) * 0.5) || a.m.name.localeCompare(b.m.name));
      io.disconnect();
      grid.innerHTML = ''; shown = 0;
      const nActive = state.shape.size + state.metal.size + state.fam.size + state.comp.size;
      activeEl.textContent = nActive ? `(${nActive} active)` : '';
      countEl.innerHTML = results.length ? `Showing <strong>${results.length.toLocaleString()}</strong> of ${all.length.toLocaleString()} models` : '';
      if (!results.length) { grid.innerHTML = `<div class="vw-empty vw-empty--big" role="listitem"><p>No watches match every filter.</p><button type="button" class="vw-btn" data-reset>Reset filters</button></div>`; return; }
      appendPage();
    }

    function card(it, i) {
      const { m, b } = it;
      const t = m.priceUSD ? tierOfPrice(m.priceUSD) : b.priceTier;
      return `<article class="vw-mcard" role="listitem" style="--tc:${tierVar(t)};--d:${(i % PAGE) * 18}ms">
        <button type="button" class="vw-mcard__btn" data-i="${i}" aria-label="${esc(`${b.name} ${m.name}${m.priceUSD ? ', ' + fmtUSD(m.priceUSD, { compact: false }) : ''}. Open details`)}">
          <span class="vw-mcard__art" data-i="${i}"></span>
          <span class="vw-mcard__brand">${esc(b.name)}</span>
          <span class="vw-mcard__name">${esc(m.name)}</span>
          <span class="vw-mcard__meta">${m.priceUSD ? `<span class="vw-mcard__price">${fmtUSD(m.priceUSD, { compact: false })}</span>` : '<span class="vw-mcard__price is-na">Price on request</span>'}<span>${esc(pretty(m.category || ''))}${m.caseSizeMm ? ` · ${m.caseSizeMm} mm` : ''}</span></span>
        </button></article>`;
    }
    function appendPage() {
      const end = Math.min(results.length, shown + PAGE);
      grid.insertAdjacentHTML('beforeend', results.slice(shown, end).map((it, k) => card(it, shown + k)).join(''));
      grid.querySelectorAll('.vw-mcard__art:not(.is-drawn):not([data-o])').forEach(el => { el.dataset.o = 1; io.observe(el); });
      shown = end;
    }

    // ------- lightbox -------
    let cur = -1, stopLive = null;
    function openLB(i) {
      cur = i;
      const { m, b } = results[i];
      const v = m.visual || {};
      stopLive?.(); stopLive = null;
      const specs = [
        ['Reference', m.reference], ['Introduced', m.introduced], ['Category', m.category && pretty(m.category)],
        ['Case', [m.caseMaterial, m.caseSizeMm && `${m.caseSizeMm} mm`].filter(Boolean).join(', ')],
        ['Shape', v.caseShape && pretty(v.caseShape)], ['Movement', m.movement],
        ['Water resistance', m.waterResistanceM ? `${m.waterResistanceM} m` : null],
        ['Complications', (v.complications || []).map(pretty).join(', ')],
        ['Strap', v.strap && pretty(v.strap)],
      ].filter(r => r[1]);
      dlg.innerHTML = `<div class="vw-lb">
        <button type="button" class="vw-lb__close" aria-label="Close">×</button>
        <div class="vw-lb__art">
          <div class="vw-lb__render">${watchSVG(ctx, m, b, { size: 360, showStrap: true, live: true })}</div>
          ${m.imageUrl ? `<figure class="vw-lb__photo" hidden><img alt="Official photograph of the ${esc(b.name)} ${esc(m.name)}" loading="lazy" referrerpolicy="no-referrer" src="${esc(m.imageUrl)}"><figcaption>Official image · ${esc(b.name)}</figcaption></figure>
            <div class="vw-seg vw-lb__toggle" role="radiogroup" aria-label="Image type"><button type="button" role="radio" aria-checked="true" data-show="render">Illustration</button><button type="button" role="radio" aria-checked="false" data-show="photo">Official photo</button></div>` : ''}
        </div>
        <div class="vw-lb__info">
          <a class="vw-eyebrow vw-lb__brand" href="#/brand/${esc(b.id)}">${esc(b.name)}</a>
          <h2 id="vwLbTitle" class="vw-lb__title">${esc(m.name)}</h2>
          <p class="vw-lb__price">${m.priceUSD ? fmtUSD(m.priceUSD, { compact: false }) : 'Price on request'} ${(() => { const t = m.priceUSD ? tierOfPrice(m.priceUSD) : b.priceTier; return t ? `<span style="--tc:${tierVar(t)}" class="vw-tier">Tier ${t}</span>` : ''; })()}</p>
          ${m.description ? `<p class="vw-lb__desc">${esc(m.description)}</p>` : ''}
          <dl class="vw-specs">${specs.map(([k, val]) => `<div><dt>${k}</dt><dd>${esc(val)}</dd></div>`).join('')}</dl>
          <div class="vw-panel__actions">
            ${m.url ? `<a class="vw-btn vw-btn--gold" href="${esc(m.url)}" target="_blank" rel="noopener noreferrer">View on maker’s site ↗</a>` : ''}
            <a class="vw-btn" href="#/brand/${esc(b.id)}">About ${esc(b.name)}</a>
          </div>
          <div class="vw-lb__nav"><button type="button" class="vw-btn vw-btn--small" data-nav="-1" ${i === 0 ? 'disabled' : ''} aria-label="Previous model">← Prev</button><span>${i + 1} / ${results.length}</span><button type="button" class="vw-btn vw-btn--small" data-nav="1" ${i === results.length - 1 ? 'disabled' : ''} aria-label="Next model">Next →</button></div>
        </div></div>`;
      const img = dlg.querySelector('.vw-lb__photo img');
      if (img) img.onerror = () => { dlg.querySelector('.vw-lb__toggle')?.remove(); dlg.querySelector('.vw-lb__photo')?.remove(); dlg.querySelector('.vw-lb__render').hidden = false; };
      try {
        const r = ctx.startLiveHands?.(dlg.querySelector('.vw-lb__render'));
        if (typeof r === 'function') stopLive = r; else if (r && typeof r.stop === 'function') stopLive = () => r.stop();
      } catch { /* optional */ }
      if (!dlg.open) dlg.showModal();
      dlg.querySelector('.vw-lb__close').focus();
    }
    function closeLB() { stopLive?.(); stopLive = null; if (dlg.open) dlg.close(); }
    dlg.addEventListener('close', () => { stopLive?.(); stopLive = null; grid.querySelector(`[data-i="${cur}"].vw-mcard__btn`)?.focus(); });
    dlg.addEventListener('click', e => {
      if (e.target === dlg) return closeLB();
      if (e.target.closest('.vw-lb__close')) return closeLB();
      if (e.target.closest('a[href^="#"]')) return closeLB();
      const nav = e.target.closest('[data-nav]'); if (nav) return openLB(cur + +nav.dataset.nav);
      const sh = e.target.closest('[data-show]');
      if (sh) {
        const photo = sh.dataset.show === 'photo';
        dlg.querySelector('.vw-lb__photo').hidden = !photo; dlg.querySelector('.vw-lb__render').hidden = photo;
        dlg.querySelectorAll('[data-show]').forEach(b => b.setAttribute('aria-checked', String(b === sh)));
      }
    });
    dlg.addEventListener('keydown', e => {
      if (e.key === 'ArrowRight' && cur < results.length - 1) openLB(cur + 1);
      if (e.key === 'ArrowLeft' && cur > 0) openLB(cur - 1);
    });

    // ------- events -------
    const refilter = debounce(filter, 160);
    wrap.querySelector('.vw-mg__bar').addEventListener('input', e => {
      const f = e.target.dataset.f; if (!f) return;
      state[f] = f === 'min' || f === 'max' ? +e.target.value : e.target.value;
      f === 'q' ? refilter() : filter();
    });
    wrap.querySelector('.vw-mg__morebody').addEventListener('click', e => {
      const b = e.target.closest('.vw-chip'); if (!b) return;
      const set = state[b.closest('[data-set]').dataset.set];
      const on = b.getAttribute('aria-pressed') !== 'true';
      b.setAttribute('aria-pressed', String(on));
      on ? set.add(b.dataset.value) : set.delete(b.dataset.value);
      filter();
    });
    wrap.addEventListener('click', e => {
      if (e.target.closest('[data-reset]')) {
        Object.assign(state, { q: '', category: '', brand: '', min: 0, max: 0 });
        ['shape', 'metal', 'fam', 'comp'].forEach(k => state[k].clear());
        wrap.querySelectorAll('.vw-mg__bar [data-f]').forEach(el => { if (el.dataset.f !== 'sort') el.value = el.tagName === 'SELECT' ? el.options[0].value : ''; });
        wrap.querySelectorAll('.vw-mg__morebody .vw-chip').forEach(c => c.setAttribute('aria-pressed', 'false'));
        return filter();
      }
      const btn = e.target.closest('.vw-mcard__btn'); if (btn) openLB(+btn.dataset.i);
    });

    filter();
    if (p.model) { const i = results.findIndex(x => x.key === p.model || x.m.name === p.model); if (i >= 0) openLB(i); }
    void prefersReducedMotion;
  },
  destroy() { cleanup.forEach(f => f()); cleanup = []; document.querySelector('.vw-lightbox[open]')?.close(); },
};
