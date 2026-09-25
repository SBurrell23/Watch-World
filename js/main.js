// Watch World: bootstrap, data loading and normalisation, router, nav, theme, search palette, compare tray.
import {
  esc, slug, clamp, store, parseQuery, buildQuery, debounce, reducedMotion, fmtUSD, flagImg,
} from './lib/util.js';

/* ------------------------------------------------------------------ routes */

const ROUTES = {
  home: { file: 'home', label: 'Home' },
  explore: { file: 'explore', label: 'Explore' },
  brand: { file: 'brand', label: 'Brand' },
  compare: { file: 'compare', label: 'Compare' },
  favorites: { file: 'favorites', label: 'Favourites' },
  map: { file: 'map', label: 'Map' },
  prices: { file: 'prices', label: 'Price Ladder' },
  timeline: { file: 'timeline', label: 'Timeline' },
  groups: { file: 'groups', label: 'Groups' },
  network: { file: 'network', label: 'Network' },
  models: { file: 'models', label: 'Models' },
  finder: { file: 'finder', label: 'Watch Finder' },
  learn: { file: 'learn', label: 'Learn' },
};
// Aliases
ROUTES.favourites = ROUTES.favorites;

/** Sections shown in the nav and on the home page (hash, label, blurb). */
export const SECTIONS = [
  { id: 'explore', label: 'Explore', blurb: 'Search and filter every house by origin, price, movement and more.' },
  { id: 'map', label: 'Map', blurb: 'Where watches are made, from the Vallée de Joux to Tokyo.' },
  { id: 'prices', label: 'Price Ladder', blurb: 'From a $20 Casio to a million-dollar complication.' },
  { id: 'timeline', label: 'Timeline', blurb: 'Three centuries of foundings, crises and revivals.' },
  { id: 'groups', label: 'Groups', blurb: 'Who owns whom: Swatch, Richemont, LVMH and the independents.' },
  { id: 'network', label: 'Network', blurb: 'Owners, movement suppliers, designers and lineages, connected.' },
  { id: 'models', label: 'Models', blurb: 'A gallery of iconic references, rendered in fine line.' },
  { id: 'finder', label: 'Watch Finder', blurb: 'Answer a few questions and meet your next watch.' },
  { id: 'learn', label: 'Learn', blurb: 'Movements, complications and the vocabulary of horology.' },
  { id: 'compare', label: 'Compare', blurb: 'Put up to four houses side by side.' },
];

/* ------------------------------------------------------------------ state */

const app = document.getElementById('app');
const state = {
  brands: [],
  brandById: new Map(),
  source: '',
  renderer: null,
  current: null, // { name, path, mod }
  token: 0,
};

/* ------------------------------------------------------------------ theme */

function setTheme(t) {
  document.documentElement.dataset.theme = t;
  store.set('ww-theme', t);
  syncThemeButton(t);
}

function syncThemeButton(t) {
  const btn = document.getElementById('theme-toggle');
  if (btn) {
    btn.setAttribute('aria-pressed', String(t === 'light'));
    btn.setAttribute('aria-label', t === 'light' ? 'Switch to dark theme' : 'Switch to light theme');
  }
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', t === 'light' ? '#f6f1e7' : '#0b0a08');
}

/* ------------------------------------------------------------------ sets (favourites / compare) */

function makeSet(key, { max = Infinity, event } = {}) {
  let ids = store.get(key, []);
  if (!Array.isArray(ids)) ids = [];
  const api = {
    has: (id) => ids.includes(id),
    list: () => ids.slice(),
    toggle(id) {
      if (ids.includes(id)) ids = ids.filter((x) => x !== id);
      else {
        if (ids.length >= max) { toast(`Compare holds up to ${max} brands. Remove one first.`); return false; }
        ids = [...ids, id];
      }
      store.set(key, ids);
      window.dispatchEvent(new CustomEvent(event, { detail: { id, on: ids.includes(id), list: ids.slice() } }));
      return ids.includes(id);
    },
    set(list) {
      ids = [...new Set(list)].slice(0, max);
      store.set(key, ids);
      window.dispatchEvent(new CustomEvent(event, { detail: { list: ids.slice() } }));
    },
    clear() { api.set([]); },
    prune(valid) { const n = ids.filter((x) => valid.has(x)); if (n.length !== ids.length) { ids = n; store.set(key, ids); } },
  };
  return api;
}

const favorites = makeSet('ww-favorites', { event: 'ww:favorites' });
const compare = makeSet('ww-compare', { max: 4, event: 'ww:compare' });

/* ------------------------------------------------------------------ renderer */

/** Local stand-in used only when js/watch-render.js is unavailable. */
function stubRenderer() {
  const metal = { steel: '#c9ccd1', 'yellow-gold': '#d9b45a', 'rose-gold': '#d49a7a', 'white-gold': '#dfe1e4', platinum: '#e6e8ea', titanium: '#9ea3a8', black: '#2a2a2c', 'ceramic-white': '#f1f1ef', bronze: '#a8733d', 'two-tone': '#d0b36a', plastic: '#2a2a2a', carbon: '#303033' };
  const fallbackVisual = (seed = 'x') => {
    let h = 0; for (const c of String(seed)) h = (h * 31 + c.charCodeAt(0)) >>> 0;
    const dials = ['#10223a', '#0f0f10', '#eeeae0', '#1f3a2f', '#3a1f25', '#6d8a96'];
    return { caseShape: 'round', caseMetal: ['steel', 'yellow-gold', 'rose-gold'][h % 3], dialColor: dials[h % dials.length], dialTexture: 'sunburst', bezel: 'smooth', hands: 'dauphine', handColor: '#e9e4d8', indices: 'baton', indexColor: '#e9e4d8', complications: [], strap: 'leather', strapColor: '#3a2a1e', crown: 'normal' };
  };
  const renderWatch = (v = {}, { size = 200, showStrap = true, title = '' } = {}) => {
    const c = metal[v.caseMetal] || '#c9ccd1';
    const H = showStrap ? 160 : 100;
    const oy = showStrap ? 30 : 0;
    let ticks = '';
    for (let i = 0; i < 12; i++) ticks += `<rect x="49.2" y="${oy + 17}" width="1.6" height="${i % 3 ? 4 : 7}" fill="${v.indexColor || '#ddd'}" transform="rotate(${i * 30} 50 ${oy + 50})"/>`;
    const d = new Date();
    const hA = (d.getHours() % 12) * 30 + d.getMinutes() / 2, mA = d.getMinutes() * 6, sA = d.getSeconds() * 6;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 ${H}" width="${size}" height="${(size * H) / 100}" role="img" aria-label="${esc(title || 'Watch illustration')}">
      ${showStrap ? `<rect x="33" y="0" width="34" height="${H}" rx="6" fill="${v.strapColor || '#333'}"/>` : ''}
      <circle cx="50" cy="${oy + 50}" r="42" fill="${c}"/>
      <circle cx="50" cy="${oy + 50}" r="36" fill="${v.dialColor || '#123'}"/>${ticks}
      <g data-hand="hour" transform="rotate(${hA} 50 ${oy + 50})"><rect x="48.8" y="${oy + 30}" width="2.4" height="21" rx="1" fill="${v.handColor || '#eee'}"/></g>
      <g data-hand="minute" transform="rotate(${mA} 50 ${oy + 50})"><rect x="49.2" y="${oy + 20}" width="1.6" height="31" rx="1" fill="${v.handColor || '#eee'}"/></g>
      <g data-hand="second" transform="rotate(${sA} 50 ${oy + 50})"><rect x="49.6" y="${oy + 18}" width=".8" height="38" fill="${v.accentColor || '#c0392b'}"/></g>
      <circle cx="50" cy="${oy + 50}" r="1.8" fill="${v.handColor || '#eee'}"/></svg>`;
  };
  const startLiveHands = (svg) => {
    const tick = () => {
      if (!svg.isConnected) return;
      const d = new Date(); const vb = svg.viewBox.baseVal; const cy = (vb.height > 100 ? 30 : 0) + 50;
      const set = (n, a) => svg.querySelector(`[data-hand="${n}"]`)?.setAttribute('transform', `rotate(${a} 50 ${cy})`);
      set('hour', (d.getHours() % 12) * 30 + d.getMinutes() / 2); set('minute', d.getMinutes() * 6 + d.getSeconds() / 10); set('second', d.getSeconds() * 6);
    };
    const id = setInterval(tick, 1000); tick();
    return () => clearInterval(id);
  };
  return { renderWatch, startLiveHands, fallbackVisual, isStub: true };
}

async function loadRenderer() {
  try {
    const m = await import('./watch-render.js');
    if (typeof m.renderWatch !== 'function') throw new Error('renderWatch missing');
    return {
      renderWatch: m.renderWatch,
      startLiveHands: m.startLiveHands || (() => () => {}),
      fallbackVisual: m.fallbackVisual || stubRenderer().fallbackVisual,
    };
  } catch (e) {
    console.info('[Watch World] watch-render.js unavailable, using built-in placeholder renderer.', e?.message || e);
    return stubRenderer();
  }
}

/* ------------------------------------------------------------------ data */

const num = (v) => (v === null || v === undefined || v === '' || !isFinite(Number(v)) ? null : Number(v));
const score = (v) => { const n = num(v); return n == null ? null : clamp(Math.round(n), 1, 10); };
const arr = (v) => (Array.isArray(v) ? v.filter((x) => x != null && x !== '') : []);
const fold = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

function normalise(list) {
  const out = [];
  const seen = new Set();
  for (const raw of Array.isArray(list) ? list : []) {
    if (!raw || typeof raw !== 'object' || !raw.name) continue;
    const b = { ...raw };
    b.id = slug(b.id || b.name);
    if (!b.id || seen.has(b.id)) continue;
    seen.add(b.id);
    b.founded = num(b.founded);
    b.priceTier = score(b.priceTier);
    b.popularity = score(b.popularity);
    b.prestige = score(b.prestige);
    b.valueRetention = score(b.valueRetention);
    b.lat = num(b.lat); b.lng = num(b.lng);
    b.status = b.status || 'active';
    b.segment = b.segment || null;
    // "None"/"N/A" in the data means no parent group, which the site calls Independent.
    b.parentGroup = b.parentGroup && !/^(none|n\/a|unknown|-)$/i.test(String(b.parentGroup).trim()) ? b.parentGroup : 'Independent';
    b.inHouseMovements = ['yes', 'partial', 'no'].includes(b.inHouseMovements) ? b.inHouseMovements : null;
    const pr = b.priceRange || {};
    b.priceRange = { min: num(pr.min), max: num(pr.max) };
    for (const k of ['founders', 'movementTypes', 'specialties', 'innovations', 'famousWearers', 'funFacts']) b[k] = arr(b[k]);
    b.timeline = arr(b.timeline).filter((t) => t && typeof t === 'object').map((t) => ({ year: num(t.year), event: t.event || '' }))
      .sort((a, z) => (a.year ?? 0) - (z.year ?? 0));
    b.models = arr(b.models).filter((m) => m && typeof m === 'object' && m.name).map((m, i) => ({
      ...m,
      _i: i,
      introduced: num(m.introduced),
      priceUSD: num(m.priceUSD),
      caseSizeMm: num(m.caseSizeMm),
      waterResistanceM: num(m.waterResistanceM),
      visual: m.visual && typeof m.visual === 'object' ? m.visual : null,
    }));
    b._q = fold([b.name, b.country, b.city, b.originCountry, b.parentGroup, b.segment, b.knownFor, ...b.founders,
      ...b.models.map((m) => `${m.name} ${m.reference || ''}`)].join(' | '));
    out.push(b);
  }
  out.sort((a, z) => a.name.localeCompare(z.name, 'en', { sensitivity: 'base' }));
  return out;
}

async function fetchJSON(url) {
  const r = await fetch(url, { cache: 'no-cache' });
  if (!r.ok) throw new Error(`${url}: ${r.status}`);
  return r.json();
}

async function loadData() {
  const override = new URLSearchParams(location.search).get('data');
  const candidates = override && /^[\w.-]+\.json$/.test(override) ? [override] : [];
  candidates.push('brands.json', 'sample.json');
  for (const f of candidates) {
    try {
      const j = await fetchJSON(`data/${f}`);
      const list = Array.isArray(j) ? j : j?.brands;
      if (Array.isArray(list) && list.length) return { brands: normalise(list), source: f };
    } catch { /* try the next file */ }
  }
  return { brands: [], source: '' };
}

/* ------------------------------------------------------------------ lazy watch slots + reveal */

const svgCache = new Map();

function renderSlot(el) {
  if (el.classList.contains('is-filled')) return;
  const [id, idxStr] = (el.dataset.watch || '').split('~');
  const b = state.brandById.get(id);
  const i = Number(idxStr);
  const m = b?.models?.[i];
  const size = Number(el.dataset.size) || 220;
  const strap = el.dataset.strap !== '0';
  const key = `${id}~${i}~${size}~${strap ? 1 : 0}`;
  let html = svgCache.get(key);
  if (!html) {
    try {
      const visual = m?.visual || state.renderer.fallbackVisual(`${id}${m?.name || ''}`);
      html = state.renderer.renderWatch(visual, { size, showStrap: strap, live: false, title: m ? `${b.name} ${m.name}` : (b?.name || 'Watch') });
    } catch (e) {
      console.warn('renderWatch failed for', key, e);
      html = '';
    }
    svgCache.set(key, html);
  }
  el.innerHTML = html;
  el.classList.add('is-filled');
}

let slotObserver;
let revealObserver;

function scanDom() {
  const slots = document.querySelectorAll('.watch-slot[data-watch]:not(.is-filled):not([data-obs])');
  for (const el of slots) {
    el.setAttribute('data-obs', '');
    if (slotObserver) slotObserver.observe(el); else renderSlot(el);
  }
  const rev = document.querySelectorAll('.reveal:not(.is-in):not([data-obs])');
  for (const el of rev) {
    el.setAttribute('data-obs', '');
    if (revealObserver && !reducedMotion()) revealObserver.observe(el); else el.classList.add('is-in');
  }
}
const scheduleScan = (() => { let q = false; return () => { if (q) return; q = true; requestAnimationFrame(() => { q = false; scanDom(); }); }; })();

function setupObservers() {
  if ('IntersectionObserver' in window) {
    slotObserver = new IntersectionObserver((entries) => {
      for (const e of entries) if (e.isIntersecting) { slotObserver.unobserve(e.target); renderSlot(e.target); }
    }, { rootMargin: '500px 0px' });
    revealObserver = new IntersectionObserver((entries) => {
      for (const e of entries) {
        // Reveal on entry, and also anything the reader has already jumped past (anchor links, fast scrolls).
        if (e.isIntersecting || e.boundingClientRect.bottom < 0) { revealObserver.unobserve(e.target); e.target.classList.add('is-in'); }
      }
    }, { rootMargin: '100000px 0px -8% 0px', threshold: 0.01 }); // huge top margin: anything already scrolled past counts as seen
  }
  new MutationObserver(scheduleScan).observe(document.body, { childList: true, subtree: true });
}

/* ------------------------------------------------------------------ toast */

let toastTimer;
function toast(msg) {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = msg;
  el.classList.add('is-on');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('is-on'), 2600);
}

/* ------------------------------------------------------------------ context */

function go(hash) {
  const h = String(hash || '');
  location.hash = h.startsWith('#') ? h : `#${h.startsWith('/') ? '' : '/'}${h}`;
}

/** Replace the current hash's query without re-rendering (used by Explore filters). */
function setQuery(obj) {
  const [path] = location.hash.split('?');
  history.replaceState(history.state, '', `${location.pathname}${location.search}${path || '#/'}${buildQuery(obj)}`);
}

function makeCtx(params) {
  return {
    brands: state.brands,
    brandById: state.brandById,
    params,
    go,
    setQuery,
    toast,
    source: state.source,
    renderWatch: state.renderer.renderWatch,
    startLiveHands: state.renderer.startLiveHands,
    fallbackVisual: state.renderer.fallbackVisual,
    favorites,
    compare,
  };
}

/* ------------------------------------------------------------------ router */

function parseHash() {
  const raw = location.hash.replace(/^#\/?/, '');
  const qi = raw.indexOf('?');
  const pathStr = qi >= 0 ? raw.slice(0, qi) : raw;
  const qs = qi >= 0 ? raw.slice(qi + 1) : '';
  const segs = pathStr.split('/').filter(Boolean).map((s) => { try { return decodeURIComponent(s); } catch { return s; } });
  const name = segs[0] || 'home';
  const params = { ...parseQuery(qs), path: segs };
  if (segs[1]) params.id = segs[1];
  return { name, params, pathKey: segs.join('/') };
}

function comingSoon(root, label) {
  root.innerHTML = `<section class="wrap soon">
    <div class="soon__mark" aria-hidden="true"><span></span></div>
    <p class="eyebrow">In the workshop</p>
    <h1 class="display">${esc(label)} is coming soon</h1>
    <p class="lede">Our watchmakers are still assembling this section. In the meantime, explore the houses.</p>
    <p class="soon__actions"><a class="btn btn--gold" href="#/explore">Explore brands</a> <a class="btn btn--ghost" href="#/">Back home</a></p>
  </section>`;
}

function notFound(root) {
  root.innerHTML = `<section class="wrap soon">
    <div class="soon__mark" aria-hidden="true"><span></span></div>
    <p class="eyebrow">404</p>
    <h1 class="display">This page has stopped ticking</h1>
    <p class="lede">We couldn't find what you were looking for.</p>
    <p class="soon__actions"><a class="btn btn--gold" href="#/">Back home</a> <a class="btn btn--ghost" href="#/explore">Explore brands</a></p>
  </section>`;
}

async function route() {
  const { name, params, pathKey } = parseHash();
  const token = ++state.token;
  const r = ROUTES[name];
  const prev = state.current;
  const samePath = prev && prev.pathKey === pathKey;

  try { prev?.mod?.destroy?.(); } catch (e) { console.warn('destroy failed', e); }
  closeMenu();
  closePalette();
  updateNav(name);
  document.body.dataset.route = name;

  if (!r) {
    state.current = { name, pathKey, mod: null };
    notFound(app);
    document.title = 'Not found · Watch World';
    finishRoute(samePath);
    return;
  }

  const loadingTimer = setTimeout(() => { if (token === state.token) app.innerHTML = '<div class="route-loading" role="status"><span class="spinner"></span><span class="sr-only">Loading</span></div>'; }, 180);
  let mod = null;
  try {
    mod = (await import(`./views/${r.file}.js`)).default;
  } catch (e) {
    console.info(`[Watch World] view "${r.file}" unavailable:`, e?.message || e);
  }
  clearTimeout(loadingTimer);
  if (token !== state.token) return;

  state.current = { name, pathKey, mod };
  app.innerHTML = '';
  app.className = `view view--${name}`;
  if (!mod || typeof mod.render !== 'function') {
    comingSoon(app, r.label);
    document.title = `${r.label} · Watch World`;
    finishRoute(samePath);
    return;
  }
  try {
    await mod.render(app, makeCtx(params));
    if (token !== state.token) return;
    const t = typeof mod.title === 'function' ? mod.title(params, state) : mod.title;
    document.title = name === 'home' ? 'Watch World · The houses of horology' : `${t || r.label} · Watch World`;
  } catch (e) {
    console.error(`[Watch World] view "${r.file}" failed to render`, e);
    if (token !== state.token) return;
    app.innerHTML = `<section class="wrap soon"><p class="eyebrow">Something slipped a gear</p><h1 class="display">This view hit an error</h1>
      <p class="lede">${esc(e?.message || 'Unknown error')}</p><p class="soon__actions"><a class="btn btn--ghost" href="#/">Back home</a></p></section>`;
  }
  finishRoute(samePath);
}

function finishRoute(samePath) {
  if (!samePath) window.scrollTo({ top: 0, behavior: 'instant' });
  app.classList.remove('view-enter');
  void app.offsetWidth;
  app.classList.add('view-enter');
  if (state.booted) app.focus({ preventScroll: true });
  state.booted = true;
  updateTray();
  scheduleScan();
}

/* ------------------------------------------------------------------ nav + chrome */

function updateNav(name) {
  document.querySelectorAll('[data-nav]').forEach((a) => {
    const on = a.dataset.nav === name || (name === 'brand' && a.dataset.nav === 'explore');
    if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  });
}

function updateCounts() {
  const f = favorites.list().length;
  document.querySelectorAll('[data-count="favorites"]').forEach((el) => { el.textContent = f || ''; el.hidden = !f; });
  const c = compare.list().length;
  document.querySelectorAll('[data-count="compare"]').forEach((el) => { el.textContent = c || ''; el.hidden = !c; });
}

function openMenu() {
  document.body.classList.add('menu-open');
  document.getElementById('menu-toggle')?.setAttribute('aria-expanded', 'true');
}
function closeMenu() {
  document.body.classList.remove('menu-open');
  document.getElementById('menu-toggle')?.setAttribute('aria-expanded', 'false');
}

function buildChrome() {
  const links = SECTIONS.filter((s) => s.id !== 'compare');
  document.getElementById('nav-links').innerHTML = links.map((s) => `<li><a href="#/${s.id}" data-nav="${s.id}">${esc(s.label)}</a></li>`).join('');
  document.getElementById('mobile-links').innerHTML = [
    ...SECTIONS,
    { id: 'favorites', label: 'Favourites' },
  ].map((s, i) => `<li style="--i:${i}"><a href="#/${s.id}" data-nav="${s.id}"><span class="num">${String(i + 1).padStart(2, '0')}</span>${esc(s.label)}</a></li>`).join('');

  document.getElementById('menu-toggle').addEventListener('click', () => {
    if (document.body.classList.contains('menu-open')) closeMenu(); else openMenu();
  });
  document.getElementById('mobile-menu').addEventListener('click', (e) => { if (e.target.closest('a')) closeMenu(); });
  document.getElementById('theme-toggle').addEventListener('click', () => {
    setTheme(document.documentElement.dataset.theme === 'light' ? 'dark' : 'light');
  });
  document.querySelectorAll('[data-open-palette]').forEach((b) => b.addEventListener('click', () => openPalette()));
  const isMac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
  document.querySelectorAll('.kbd-mod').forEach((k) => { k.textContent = isMac ? '⌘' : 'Ctrl'; });

  // Scrolled state for the sticky header hairline.
  const header = document.querySelector('.site-header');
  const onScroll = () => header.classList.toggle('is-scrolled', window.scrollY > 8);
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  // Global delegated toggles for favourite / compare buttons (works for any view that uses the card components).
  document.addEventListener('click', (e) => {
    const fav = e.target.closest('[data-fav]');
    if (fav) {
      e.preventDefault(); e.stopPropagation();
      const id = fav.dataset.fav;
      const on = favorites.toggle(id);
      const b = state.brandById.get(id);
      toast(on ? `${b?.name || 'Brand'} saved to favourites` : `${b?.name || 'Brand'} removed from favourites`);
      return;
    }
    const cmp = e.target.closest('[data-compare]');
    if (cmp) {
      e.preventDefault(); e.stopPropagation();
      compare.toggle(cmp.dataset.compare);
    }
  });
  window.addEventListener('ww:favorites', (e) => {
    syncPressed('fav', e.detail);
    updateCounts();
  });
  window.addEventListener('ww:compare', (e) => {
    syncPressed('compare', e.detail);
    updateCounts();
    updateTray();
  });
  document.getElementById('footer-year').textContent = new Date().getFullYear();
}

function syncPressed(kind, detail) {
  const list = new Set(detail.list || []);
  document.querySelectorAll(`[data-${kind}]`).forEach((b) => b.setAttribute('aria-pressed', String(list.has(b.dataset[kind]))));
}

/* ------------------------------------------------------------------ compare tray */

function updateTray() {
  const tray = document.getElementById('compare-tray');
  if (!tray) return;
  const ids = compare.list().filter((id) => state.brandById.has(id));
  const hide = !ids.length || document.body.dataset.route === 'compare';
  tray.classList.toggle('is-on', !hide);
  document.body.classList.toggle('has-tray', !hide); // keeps the footer clear of the floating tray
  tray.setAttribute('aria-hidden', String(hide));
  tray.inert = hide;
  if (!ids.length) return;
  const slots = [];
  for (let i = 0; i < 4; i++) {
    const b = state.brandById.get(ids[i]);
    slots.push(b
      ? `<li class="tray__item"><a href="#/brand/${esc(b.id)}">${esc(b.name)}</a><button type="button" class="tray__x" data-compare="${esc(b.id)}" aria-pressed="true" aria-label="Remove ${esc(b.name)} from compare">×</button></li>`
      : '<li class="tray__item tray__item--empty" aria-hidden="true"><span>Empty</span></li>');
  }
  tray.innerHTML = `<p class="tray__label"><span class="eyebrow">Compare</span><span class="tray__count">${ids.length}/4</span></p>
    <ul class="tray__list">${slots.join('')}</ul>
    <div class="tray__actions">
      <button type="button" class="btn btn--ghost btn--sm" id="tray-clear">Clear</button>
      <a class="btn btn--gold btn--sm" href="#/compare?ids=${ids.map(encodeURIComponent).join(',')}" ${ids.length < 2 ? 'aria-disabled="true"' : ''}>Compare${ids.length < 2 ? ' (add one more)' : ' →'}</a>
    </div>`;
  tray.querySelector('#tray-clear').addEventListener('click', () => compare.clear());
}

/* ------------------------------------------------------------------ search palette */

let paletteIndex = [];
let paletteSel = 0;
let paletteItems = [];
let paletteReturnFocus = null;

function buildPaletteIndex() {
  paletteIndex = [];
  for (const b of state.brands) {
    paletteIndex.push({ kind: 'brand', b, name: b.name, n: fold(b.name), extra: fold(`${b.country} ${b.city} ${b.founders.join(' ')} ${b.knownFor || ''} ${b.parentGroup}`) });
    for (const m of b.models) {
      paletteIndex.push({ kind: 'model', b, m, name: m.name, n: fold(`${m.name} ${m.reference || ''}`), extra: fold(`${b.name} ${m.category || ''}`) });
    }
  }
}

function paletteSearch(q) {
  const s = fold(q.trim());
  const pages = SECTIONS.concat([{ id: 'favorites', label: 'Favourites', blurb: 'Your saved houses.' }])
    .filter((p) => !s || fold(p.label).includes(s))
    .map((p) => ({ kind: 'page', name: p.label, href: `#/${p.id}`, sub: p.blurb }));
  if (!s) {
    const featured = ['rolex', 'patek-philippe', 'audemars-piguet', 'omega', 'seiko', 'grand-seiko', 'cartier', 'casio']
      .map((id) => state.brandById.get(id)).filter(Boolean);
    const brands = (featured.length ? featured : state.brands.slice(0, 6)).slice(0, 6)
      .map((b) => ({ kind: 'brand', b, name: b.name, href: `#/brand/${b.id}` }));
    return { brands, models: [], pages: pages.slice(0, 5) };
  }
  const words = s.split(/\s+/).filter(Boolean);
  const scored = [];
  for (const it of paletteIndex) {
    let sc = 0;
    if (it.n === s) sc = 120;
    else if (it.n.startsWith(s)) sc = 100;
    else if (it.n.split(/[\s\-.&]+/).some((w) => w.startsWith(s))) sc = 80;
    else if (it.n.includes(s)) sc = 60;
    else if (words.every((w) => it.n.includes(w) || it.extra.includes(w))) sc = it.kind === 'model' && words.some((w) => it.n.includes(w)) ? 45 : 25;
    if (!sc) continue;
    if (it.kind === 'brand') sc += 8 + (it.b.popularity || 0) * 0.5; else sc += (it.b.popularity || 0) * 0.3;
    scored.push([sc, it]);
  }
  scored.sort((a, z) => z[0] - a[0]);
  const brands = []; const models = [];
  let modelsFirst = null;
  for (const [, it] of scored) {
    if (modelsFirst === null) modelsFirst = it.kind === 'model';
    if (it.kind === 'brand' && brands.length < 7) brands.push({ ...it, href: `#/brand/${it.b.id}` });
    if (it.kind === 'model' && models.length < 7) models.push({ ...it, href: `#/brand/${it.b.id}?model=${it.m._i}` });
  }
  return { brands, models, pages: pages.slice(0, 3), modelsFirst: !!modelsFirst };
}

function renderPalette() {
  const input = document.getElementById('palette-input');
  const list = document.getElementById('palette-list');
  const { brands, models, pages, modelsFirst } = paletteSearch(input.value);
  paletteItems = modelsFirst ? [...models, ...brands, ...pages] : [...brands, ...models, ...pages];
  if (paletteSel >= paletteItems.length) paletteSel = 0;
  let i = 0;
  const opt = (it, inner) => {
    const idx = i++;
    return `<li role="option" id="pal-opt-${idx}" data-idx="${idx}" aria-selected="${idx === paletteSel}" class="pal__opt">${inner}</li>`;
  };
  const group = (title, items, fn) => (items.length ? `<li class="pal__group" role="presentation">${title}</li>${items.map((it) => opt(it, fn(it))).join('')}` : '');
  const brandGroup = () => group(input.value ? 'Brands' : 'Popular houses', brands, (it) => `<span class="pal__icon">${flagImg(it.b.countryCode)}</span><span class="pal__main"><strong>${esc(it.b.name)}</strong><small>${esc([it.b.city, it.b.country].filter(Boolean).join(', '))}${it.b.founded ? ` · ${it.b.founded}` : ''}</small></span><span class="pal__kind">Brand</span>`);
  const modelGroup = () => group('Models', models, (it) => `<span class="pal__icon pal__icon--dot"></span><span class="pal__main"><strong>${esc(it.m.name)}</strong><small>${esc(it.b.name)}${it.m.reference ? ` · Ref. ${esc(it.m.reference)}` : ''}${it.m.priceUSD ? ` · ${fmtUSD(it.m.priceUSD)}` : ''}</small></span><span class="pal__kind">Model</span>`);
  list.innerHTML = (modelsFirst ? modelGroup() + brandGroup() : brandGroup() + modelGroup())
    + group('Sections', pages, (it) => `<span class="pal__icon pal__icon--page">→</span><span class="pal__main"><strong>${esc(it.name)}</strong><small>${esc(it.sub || '')}</small></span><span class="pal__kind">Go to</span>`);
  if (!paletteItems.length) list.innerHTML = `<li class="pal__empty" role="presentation">No matches for “${esc(input.value)}”. Try a country, founder or model name.</li>`;
  input.setAttribute('aria-activedescendant', paletteItems.length ? `pal-opt-${paletteSel}` : '');
}

function movePalette(d) {
  if (!paletteItems.length) return;
  paletteSel = (paletteSel + d + paletteItems.length) % paletteItems.length;
  const list = document.getElementById('palette-list');
  list.querySelectorAll('[role="option"]').forEach((el) => el.setAttribute('aria-selected', String(Number(el.dataset.idx) === paletteSel)));
  document.getElementById('palette-input').setAttribute('aria-activedescendant', `pal-opt-${paletteSel}`);
  list.querySelector(`#pal-opt-${paletteSel}`)?.scrollIntoView({ block: 'nearest' });
}

function choosePalette(idx = paletteSel) {
  const it = paletteItems[idx];
  if (!it) return;
  closePalette(false);
  location.hash = it.href;
}

function openPalette() {
  const pal = document.getElementById('palette');
  if (pal.classList.contains('is-open')) return;
  paletteReturnFocus = document.activeElement;
  pal.hidden = false;
  requestAnimationFrame(() => pal.classList.add('is-open'));
  document.body.classList.add('no-scroll');
  const input = document.getElementById('palette-input');
  input.value = '';
  paletteSel = 0;
  renderPalette();
  input.focus();
}

function closePalette(restore = true) {
  const pal = document.getElementById('palette');
  if (!pal || pal.hidden) return;
  pal.classList.remove('is-open');
  document.body.classList.remove('no-scroll');
  setTimeout(() => { if (!pal.classList.contains('is-open')) pal.hidden = true; }, 180);
  if (restore) paletteReturnFocus?.focus?.();
}

function setupPalette() {
  const pal = document.getElementById('palette');
  const input = document.getElementById('palette-input');
  const list = document.getElementById('palette-list');
  input.addEventListener('input', debounce(() => { paletteSel = 0; renderPalette(); }, 60));
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); movePalette(1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); movePalette(-1); }
    else if (e.key === 'Enter') { e.preventDefault(); choosePalette(); }
    else if (e.key === 'Escape') { e.preventDefault(); closePalette(); }
  });
  list.addEventListener('click', (e) => {
    const o = e.target.closest('[role="option"]');
    if (o) choosePalette(Number(o.dataset.idx));
  });
  list.addEventListener('mousemove', (e) => {
    const o = e.target.closest('[role="option"]');
    if (o && Number(o.dataset.idx) !== paletteSel) { paletteSel = Number(o.dataset.idx); list.querySelectorAll('[role="option"]').forEach((el) => el.setAttribute('aria-selected', String(el === o))); }
  });
  pal.addEventListener('click', (e) => { if (e.target === pal || e.target.classList.contains('pal__scrim')) closePalette(); });
  // Trap focus inside the palette (only the input and list are focusable).
  pal.addEventListener('keydown', (e) => { if (e.key === 'Tab') { e.preventDefault(); input.focus(); } });

  document.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); if (pal.classList.contains('is-open')) closePalette(); else openPalette(); return; }
    const tag = (e.target.tagName || '').toLowerCase();
    const typing = tag === 'input' || tag === 'textarea' || tag === 'select' || e.target.isContentEditable;
    if (e.key === '/' && !typing) { e.preventDefault(); openPalette(); }
    if (e.key === 'Escape') { closeMenu(); }
  });
}

/* ------------------------------------------------------------------ boot */

async function boot() {
  const qTheme = new URLSearchParams(location.search).get('theme');
  if (qTheme === 'light' || qTheme === 'dark') { document.documentElement.dataset.theme = qTheme; syncThemeButton(qTheme); }
  else setTheme(store.get('ww-theme', null) === 'light' ? 'light' : 'dark');
  buildChrome();
  setupPalette();
  setupObservers();
  updateCounts();

  const [data, renderer] = await Promise.all([loadData(), loadRenderer()]);
  state.renderer = renderer;
  state.brands = data.brands;
  state.source = data.source;
  state.brandById = new Map(data.brands.map((b) => [b.id, b]));
  favorites.prune(new Set(state.brandById.keys()));
  compare.prune(new Set(state.brandById.keys()));
  updateCounts();
  buildPaletteIndex();
  const fc = document.getElementById('footer-count');
  if (fc) fc.textContent = data.brands.length ? `${data.brands.length} houses catalogued${data.source === 'sample.json' ? ' (sample data)' : ''}.` : 'Data unavailable.';

  if (!data.brands.length) {
    app.innerHTML = `<section class="wrap soon"><p class="eyebrow">No data</p><h1 class="display">The archive is empty</h1>
      <p class="lede">Neither <code>data/brands.json</code> nor <code>data/sample.json</code> could be loaded. If you opened this file directly, serve the folder over HTTP instead.</p></section>`;
    document.documentElement.classList.remove('is-loading');
    return;
  }

  window.addEventListener('hashchange', route);
  await route();
  document.documentElement.classList.remove('is-loading');
}

boot();
