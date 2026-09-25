// Shared helpers for the data-visualisation views (map, prices, timeline, groups,
// models, finder, learn). No DOM side effects at import time.

export const D3_URL = 'https://cdn.jsdelivr.net/npm/d3@7/+esm';
export const TOPOJSON_URL = 'https://cdn.jsdelivr.net/npm/topojson-client@3/+esm';
export const WORLD_URL = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json';

let _d3, _topo, _world, _cards;
export const loadD3 = () => (_d3 ||= import(D3_URL));
export const loadTopojson = () => (_topo ||= import(TOPOJSON_URL));
export const loadWorld = () => (_world ||= fetch(WORLD_URL).then(r => {
  if (!r.ok) throw new Error('World atlas failed to load');
  return r.json();
}));

/** Lazily import the lead agent's card components, with a minimal fallback. */
export function loadCards() {
  return (_cards ||= import('../components/cards.js').catch(() => ({
    brandCard: (b) => `<a class="vw-mini-card" href="#/brand/${esc(b.id)}">
        <span class="vw-mini-card__name">${esc(b.name)}</span>
        <span class="vw-mini-card__meta">${esc(b.city || '')}${b.city ? ', ' : ''}${esc(b.country || '')} · ${esc(b.segment || '')}</span>
        ${tierBadgeFallback(b.priceTier)}</a>`,
    modelCard: (m, b) => `<div class="vw-mini-card"><span class="vw-mini-card__name">${esc(m.name)}</span>
        <span class="vw-mini-card__meta">${esc(b.name)} · ${fmtUSD(m.priceUSD)}</span></div>`,
    tierBadge: tierBadgeFallback,
  })));
}
function tierBadgeFallback(t) {
  if (!t) return '';
  return `<span class="vw-tier" style="--tc:var(--tier-${t})">T${t}</span>`;
}

export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export function fmtUSD(n, { compact = true } = {}) {
  if (n == null || !isFinite(n)) return '—';
  if (!compact) return '$' + Math.round(n).toLocaleString('en-US');
  if (n >= 1e6) return '$' + (n / 1e6).toFixed(n % 1e6 === 0 ? 0 : 1).replace(/\.0$/, '') + 'M';
  if (n >= 1e4) return '$' + Math.round(n / 1e3) + 'k';
  if (n >= 1e3) return '$' + (n / 1e3).toFixed(1).replace(/\.0$/, '') + 'k';
  return '$' + Math.round(n);
}

export const TIERS = [
  { tier: 1, min: 20, max: 100, label: 'Under $100', name: 'Entry' },
  { tier: 2, min: 100, max: 300, label: '$100 – 300', name: 'Accessible' },
  { tier: 3, min: 300, max: 1000, label: '$300 – 1k', name: 'Enthusiast' },
  { tier: 4, min: 1000, max: 3000, label: '$1k – 3k', name: 'Serious' },
  { tier: 5, min: 3000, max: 7000, label: '$3k – 7k', name: 'Luxury entry' },
  { tier: 6, min: 7000, max: 15000, label: '$7k – 15k', name: 'Luxury' },
  { tier: 7, min: 15000, max: 40000, label: '$15k – 40k', name: 'High luxury' },
  { tier: 8, min: 40000, max: 100000, label: '$40k – 100k', name: 'Haute' },
  { tier: 9, min: 100000, max: 300000, label: '$100k – 300k', name: 'Grand haute' },
  { tier: 10, min: 300000, max: 5000000, label: '$300k +', name: 'Stratospheric' },
];
export const tierOfPrice = (p) => (TIERS.find(t => p < t.max) || TIERS[9]).tier;
export const tierVar = (t) => `var(--tier-${t || 5})`;

export const SEGMENTS = ['Haute Horlogerie', 'Luxury', 'Premium', 'Mid-range', 'Affordable', 'Fashion', 'Independent', 'Microbrand', 'Smartwatch'];
export const CONTINENTS = ['Europe', 'Asia', 'North America', 'South America', 'Oceania', 'Africa'];

/** Flatten all models with their brand. Cached per brands array. */
const _modelCache = new WeakMap();
export function allModels(brands) {
  if (_modelCache.has(brands)) return _modelCache.get(brands);
  const out = [];
  for (const b of brands) (b.models || []).forEach((m, i) => out.push({ m, b, key: `${b.id}::${i}` }));
  _modelCache.set(brands, out);
  return out;
}

export function debounce(fn, ms = 150) {
  let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}

export function uniq(arr) { return [...new Set(arr.filter(v => v != null && v !== ''))]; }

/** Singleton floating tooltip attached to a view root. */
export function makeTooltip(root) {
  const el = document.createElement('div');
  el.className = 'vw-tooltip';
  el.setAttribute('role', 'tooltip');
  el.hidden = true;
  root.appendChild(el);
  return {
    el,
    show(html, x, y) {
      el.innerHTML = html; el.hidden = false;
      const r = root.getBoundingClientRect();
      const w = el.offsetWidth, h = el.offsetHeight;
      let lx = x - r.left + 14, ly = y - r.top + 14;
      if (lx + w > r.width - 8) lx = x - r.left - w - 14;
      if (lx < 4) lx = 4;
      if (y + h + 20 > window.innerHeight) ly = y - r.top - h - 14;
      el.style.transform = `translate(${lx}px, ${ly}px)`;
    },
    hide() { el.hidden = true; },
  };
}

/** Standard editorial header. */
export function header({ eyebrow, title, lede }) {
  return `<header class="vw-head">
    <p class="vw-eyebrow">${esc(eyebrow)}</p>
    <h1 class="vw-title">${title}</h1>
    ${lede ? `<p class="vw-lede">${lede}</p>` : ''}
  </header>`;
}

/** Chip group markup. options: [{value,label}] */
export function chips(name, options, { multi = true, selected = [], label = '' } = {}) {
  return `<div class="vw-chips" role="group" aria-label="${esc(label || name)}" data-chips="${esc(name)}" data-multi="${multi}">
    ${options.map(o => `<button type="button" class="vw-chip" data-value="${esc(o.value)}" aria-pressed="${selected.includes(o.value)}">${o.swatch ? `<i class="vw-swatch" style="background:${o.swatch}"></i>` : ''}${esc(o.label)}</button>`).join('')}
  </div>`;
}

/** Wire chip groups under root; onChange(name, Set) */
export function wireChips(root, onChange) {
  root.querySelectorAll('[data-chips]').forEach(g => {
    g.addEventListener('click', e => {
      const btn = e.target.closest('.vw-chip'); if (!btn) return;
      const multi = g.dataset.multi === 'true';
      const on = btn.getAttribute('aria-pressed') !== 'true';
      if (!multi) g.querySelectorAll('.vw-chip').forEach(b => b.setAttribute('aria-pressed', 'false'));
      btn.setAttribute('aria-pressed', String(on));
      onChange(g.dataset.chips, chipValues(g));
    });
  });
}
export function chipValues(g) {
  return new Set([...g.querySelectorAll('.vw-chip[aria-pressed="true"]')].map(b => b.dataset.value));
}

/** Observe element resize; returns disconnect fn. */
export function onResize(el, fn) {
  let w = el.clientWidth;
  const ro = new ResizeObserver(debounce(() => {
    if (Math.abs(el.clientWidth - w) > 4) { w = el.clientWidth; fn(); }
  }, 120));
  ro.observe(el);
  return () => ro.disconnect();
}

/** Safe renderWatch (falls back to fallbackVisual). */
export function watchSVG(ctx, model, brand, opts = {}) {
  try {
    const visual = model?.visual || ctx.fallbackVisual?.(brand?.id || model?.name || 'x');
    return ctx.renderWatch(visual, { size: 160, showStrap: true, live: false, title: model ? `${brand?.name || ''} ${model.name}` : '', ...opts });
  } catch (e) {
    console.warn('renderWatch failed', e);
    return `<svg viewBox="0 0 100 100" role="img" aria-label="Watch"><circle cx="50" cy="50" r="40" fill="none" stroke="currentColor"/></svg>`;
  }
}

export const prefersReducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

export function loadingHTML(msg = 'Loading') {
  return `<div class="vw-loading" role="status"><span class="vw-loading__ring"></span>${esc(msg)}…</div>`;
}
