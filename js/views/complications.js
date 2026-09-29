// Complications (#/complications): an illustrated compendium of 48 watch complications.
// Filterable card grid with lazy, visibility-gated SVG art; a deep-linkable detail dialog (?c=id);
// and a Difficulty × Cost map. Data: data/complications.json (falls back to complications-sample.json).
import { esc, fmtUSD, header, debounce, onResize, makeTooltip, prefersReducedMotion } from './_shared.js';
import { modelCard } from '../components/cards.js';
import { complicationSVG } from '../complications/index.js';

/* ------------------------------------------------------------------ vocabulary */

const CATEGORIES = [
  { id: 'time-display', label: 'Time display' },
  { id: 'indication', label: 'Indication' },
  { id: 'calendar', label: 'Calendar' },
  { id: 'astronomical', label: 'Astronomical' },
  { id: 'timing', label: 'Timing' },
  { id: 'travel', label: 'Travel' },
  { id: 'striking', label: 'Striking' },
  { id: 'regulation', label: 'Regulation' },
  { id: 'artistic', label: 'Artistic' },
];
const CAT = Object.fromEntries(CATEGORIES.map((c) => [c.id, c]));

const DIFFICULTY = [
  { id: 'basic', label: 'Basic' }, { id: 'moderate', label: 'Moderate' }, { id: 'advanced', label: 'Advanced' },
  { id: 'expert', label: 'Expert' }, { id: 'grand', label: 'Grand complication' },
];
const COST = [
  null,
  { sym: '$', range: 'Under $500' }, { sym: '$$', range: '$500–3k' }, { sym: '$$$', range: '$3k–15k' },
  { sym: '$$$$', range: '$15k–100k' }, { sym: '$$$$$', range: '$100k+' },
];
const USE_TYPES = {
  'daily-practical': { label: 'Daily practical', short: 'Daily' },
  situational: { label: 'Situational', short: 'Situational' },
  'sport-professional': { label: 'Sport & professional', short: 'Sport / pro' },
  travel: { label: 'Travel', short: 'Travel' },
  'astronomical-curiosity': { label: 'Astronomical curiosity', short: 'Curiosity' },
  aesthetic: { label: 'Aesthetic', short: 'Aesthetic' },
  prestige: { label: 'Prestige', short: 'Prestige' },
};
const COMMONNESS = [
  { id: 'ubiquitous', label: 'Ubiquitous' }, { id: 'common', label: 'Common' }, { id: 'uncommon', label: 'Uncommon' },
  { id: 'rare', label: 'Rare' }, { id: 'exceedingly-rare', label: 'Exceedingly rare' },
];
const SORTS = [
  { id: 'common', label: 'Most common' },
  { id: 'difficulty', label: 'Difficulty (hardest first)' },
  { id: 'cost', label: 'Cost (highest first)' },
  { id: 'useful', label: 'Usefulness (most useful first)' },
  { id: 'invented', label: 'Invented (oldest first)' },
  { id: 'az', label: 'A–Z' },
];
/** Complication id -> value used in model.visual.complications (brands.json). */
const MODEL_MAP = {
  date: 'date', 'day-date': 'day-date', chronograph: 'chronograph', gmt: 'gmt', moonphase: 'moonphase',
  'small-seconds': 'small-seconds', 'power-reserve': 'power-reserve', tourbillon: 'tourbillon',
  'perpetual-calendar': 'perpetual-calendar', 'world-time': 'world-time', 'big-date': 'big-date',
  'jumping-hour': 'jumping-hour', 'retrograde-display': 'retrograde',
};
const WATCH_PAGE = 8;

/* ------------------------------------------------------------------ data */

const fold = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const str = (v) => (typeof v === 'string' && v.trim() && !/^(null|undefined|nan)$/i.test(v.trim()) ? v.trim() : null);
const num = (v) => (v === null || v === undefined || v === '' || !Number.isFinite(Number(v)) ? null : Number(v));
const score = (v, max = 10) => { const n = num(v); return n == null ? null : Math.min(max, Math.max(1, Math.round(n))); };
const strs = (v) => (Array.isArray(v) ? v.map(str).filter(Boolean) : []);

const diffIdOf = (label, d) => {
  const l = fold(label);
  const hit = DIFFICULTY.find((x) => fold(x.label) === l || x.id === l || (x.id === 'grand' && l.startsWith('grand')));
  if (hit) return hit.id;
  if (d == null) return null;
  return d <= 2 ? 'basic' : d <= 4 ? 'moderate' : d <= 6 ? 'advanced' : d <= 8 ? 'expert' : 'grand';
};
const comIdOf = (label, c) => {
  const l = fold(label);
  const hit = COMMONNESS.find((x) => fold(x.label) === l || x.id === l);
  if (hit) return hit.id;
  if (c == null) return null;
  return c >= 9 ? 'ubiquitous' : c >= 7 ? 'common' : c >= 5 ? 'uncommon' : c >= 3 ? 'rare' : 'exceedingly-rare';
};

function normalise(list) {
  const out = [];
  const seen = new Set();
  for (const r of Array.isArray(list) ? list : []) {
    if (!r || typeof r !== 'object') continue;
    const id = str(r.id);
    const name = str(r.name);
    if (!id || !name || seen.has(id)) continue;
    seen.add(id);
    const difficulty = score(r.difficulty);
    const commonness = score(r.commonness);
    const inv = r.invented && typeof r.invented === 'object' ? r.invented : {};
    const e = {
      id, name,
      aka: strs(r.aka),
      category: CAT[r.category] ? r.category : null,
      tagline: str(r.tagline), summary: str(r.summary), howItWorks: str(r.howItWorks), history: str(r.history),
      invented: { year: num(inv.year) != null ? Math.round(num(inv.year)) : null, by: str(inv.by) },
      difficulty,
      diffId: diffIdOf(r.difficultyLabel, difficulty),
      costTier: score(r.costTier, 5),
      entryPrice: num(r.typicalEntryPriceUSD) > 0 ? num(r.typicalEntryPriceUSD) : null,
      usefulness: score(r.usefulness),
      usefulnessType: USE_TYPES[r.usefulnessType] ? r.usefulnessType : null,
      commonness,
      comId: comIdOf(r.commonnessLabel, commonness),
      partsCount: str(r.partsCount) || (num(r.partsCount) ? String(num(r.partsCount)) : null),
      funFact: str(r.funFact),
      famousExamples: (Array.isArray(r.famousExamples) ? r.famousExamples : [])
        .filter((x) => x && typeof x === 'object' && (str(x.model) || str(x.brand)))
        .map((x) => ({ brand: str(x.brand), brandId: str(x.brandId), model: str(x.model) })),
      pairsWith: strs(r.pairsWith).filter((p) => p !== id),
      sources: strs(r.sources).filter((u) => /^https?:\/\//i.test(u)),
    };
    e.diffLabel = DIFFICULTY.find((x) => x.id === e.diffId)?.label || null;
    e.comLabel = COMMONNESS.find((x) => x.id === e.comId)?.label || null;
    e._q = fold([e.name, ...e.aka, e.tagline, e.summary].filter(Boolean).join(' | '));
    out.push(e);
  }
  return out;
}

let dataPromise = null;
let cached = null;
function loadData() {
  dataPromise ||= (async () => {
    for (const f of ['complications.json', 'complications-sample.json']) {
      try {
        const r = await fetch(`data/${f}`, { cache: 'no-cache' });
        if (!r.ok) continue;
        const j = await r.json();
        const list = normalise(Array.isArray(j) ? j : j?.complications);
        if (list.length) return (cached = { list, source: f });
      } catch { /* try the next file */ }
    }
    dataPromise = null; // allow a retry on the next visit
    return { list: [], source: '' };
  })();
  return dataPromise;
}

/* ------------------------------------------------------------------ small renderers */

const catLabel = (id) => CAT[id]?.label || 'Complication';
const catVar = (id) => (CAT[id] ? `var(--cx-cat-${id})` : 'var(--gold)');
const yearText = (y) => (y == null ? null : y < 0 ? `${-y} BC` : String(y));

function initials(name) {
  const words = name.replace(/\(.*?\)/g, ' ').split(/[\s/–-]+/).filter((w) => /^[A-Za-zÀ-ÿ]/.test(w));
  return (words.slice(0, 2).map((w) => w[0].toUpperCase()).join('') || name.slice(0, 2)).slice(0, 2);
}

function placeholderSVG(e) {
  let ticks = '';
  for (let i = 0; i < 60; i++) {
    const a = (i * 6 * Math.PI) / 180;
    const r1 = i % 5 ? 80 : 76;
    ticks += `<line x1="${(100 + Math.sin(a) * r1).toFixed(1)}" y1="${(100 - Math.cos(a) * r1).toFixed(1)}" x2="${(100 + Math.sin(a) * 83).toFixed(1)}" y2="${(100 - Math.cos(a) * 83).toFixed(1)}" style="stroke:var(--cx-muted)" stroke-width="${i % 5 ? 0.4 : 0.9}"/>`;
  }
  return `<svg viewBox="0 0 200 200" role="img" aria-label="${esc(e.name)}" class="cx-ph">
    <circle cx="100" cy="100" r="88" style="fill:none;stroke:var(--cx-gold)" stroke-width=".8"/>
    <circle cx="100" cy="100" r="70" style="fill:none;stroke:var(--cx-gold)" stroke-width=".4" opacity=".6"/>
    ${ticks}
    <text x="100" y="100" dy=".34em" text-anchor="middle" style="fill:var(--cx-gold);font-family:var(--font-display)" font-size="50" font-style="italic" font-weight="400">${esc(initials(e.name))}</text>
  </svg>`;
}

/** One compact stat meter. Every meter has: label, value, segmented bar, qualifier. */
function meter({ key, label, value, max, valueHTML, note, noteAlt, aria, title }) {
  let bars = '';
  for (let i = 1; i <= max; i++) bars += `<i class="${value != null && i <= value ? 'on' : ''}"></i>`;
  return `<div class="cx-m cx-m--${key}" role="img" aria-label="${esc(aria)}"${title ? ` title="${esc(title)}"` : ''}>
    <div class="cx-m__top"><span class="cx-m__label">${esc(label)}</span><span class="cx-m__val">${valueHTML}</span></div>
    <div class="cx-m__bar" style="--n:${max}" aria-hidden="true">${bars}</div>
    <div class="cx-m__note">${noteAlt ? `<span class="cx-m__a">${note}</span><span class="cx-m__b">${noteAlt}</span>` : note}</div>
  </div>`;
}

function meters(e, cls = '') {
  const na = '<span class="cx-m__na">Not rated</span>';
  const v10 = (v) => (v == null ? '<span class="cx-m__na">—</span>' : `${v}<small>/10</small>`);
  const cost = e.costTier ? COST[e.costTier] : null;
  const entry = e.entryPrice ? `Entry ≈ ${fmtUSD(e.entryPrice, { compact: false })}` : null;
  const ut = e.usefulnessType ? USE_TYPES[e.usefulnessType] : null;
  return `<div class="cx-meters ${cls}">
    ${meter({ key: 'diff', label: 'Difficulty', value: e.difficulty, max: 10, valueHTML: v10(e.difficulty), note: esc(e.diffLabel || '') || na,
      aria: `Difficulty: ${e.difficulty == null ? 'not rated' : `${e.difficulty} out of 10`}${e.diffLabel ? `, ${e.diffLabel}` : ''}` })}
    ${meter({ key: 'cost', label: 'Cost', value: e.costTier, max: 5,
      valueHTML: cost ? `<span class="cx-m__sym">${cost.sym}</span><span class="cx-m__dim">${'$'.repeat(5 - e.costTier)}</span>` : '<span class="cx-m__na">—</span>',
      note: cost ? esc(cost.range) : na, noteAlt: cost && entry ? esc(entry) : null,
      title: cost ? `${cost.range}${entry ? ` · ${entry}` : ''}` : null,
      aria: `Cost: ${cost ? `tier ${e.costTier} of 5, ${cost.range}${entry ? `. ${entry}` : ''}` : 'not rated'}` })}
    ${meter({ key: 'use', label: 'Usefulness', value: e.usefulness, max: 10, valueHTML: v10(e.usefulness),
      note: ut ? `<span class="cx-badge" title="${esc(ut.label)}">${esc(ut.short)}</span>` : (e.usefulness == null ? na : ''),
      aria: `Usefulness: ${e.usefulness == null ? 'not rated' : `${e.usefulness} out of 10`}${ut ? `, ${ut.label}` : ''}` })}
    ${meter({ key: 'com', label: 'Commonness', value: e.commonness, max: 10, valueHTML: v10(e.commonness), note: esc(e.comLabel || '') || na,
      aria: `Commonness: ${e.commonness == null ? 'not rated' : `${e.commonness} out of 10`}${e.comLabel ? `, ${e.comLabel}` : ''}` })}
  </div>`;
}

function card(e, i) {
  return `<article class="cx-card" role="listitem" data-id="${esc(e.id)}" style="--cc:${catVar(e.category)};--d:${Math.min(i, 16) * 35}ms">
    <div class="cx-card__media"><div class="cx-art" data-cx="${esc(e.id)}"></div></div>
    <div class="cx-card__body">
      <p class="cx-card__cat"><i aria-hidden="true"></i>${esc(catLabel(e.category))}</p>
      <h3 class="cx-card__name"><a class="stretch" href="#/complications?c=${encodeURIComponent(e.id)}" data-open="${esc(e.id)}">${esc(e.name)}</a></h3>
      ${e.tagline ? `<p class="cx-card__tag">${esc(e.tagline)}</p>` : ''}
      ${meters(e)}
    </div>
  </article>`;
}

/* ------------------------------------------------------------------ view */

let cleanup = [];

export default {
  title: (params) => {
    const e = params?.c && cached?.list.find((x) => x.id === params.c);
    return e ? `${e.name} · Complications` : 'Complications';
  },

  async render(root, ctx) {
    this.destroy();
    const life = { on: true }; // per-render; flipped off by destroy()
    cleanup.push(() => { life.on = false; });
    const wrap = document.createElement('div');
    wrap.className = 'vw cx';
    wrap.innerHTML = `<div class="vw-loading" role="status"><span class="vw-loading__ring"></span>Winding the movements…</div>`;
    root.appendChild(wrap);

    const { list, source } = await loadData();
    if (!life.on || !wrap.isConnected) return;
    if (!list.length) {
      wrap.innerHTML = `${header({ eyebrow: 'The mechanisms', title: 'The <em>Complications</em>', lede: 'The compendium could not be loaded. Please try again in a moment.' })}`;
      return;
    }

    const byId = new Map(list.map((e) => [e.id, e]));
    const p = ctx.params || {};
    const pick = (v, ok) => (v && ok(v) ? v : '');
    const state = {
      q: p.q || '',
      cat: pick(p.cat, (v) => CAT[v]),
      diff: pick(p.diff, (v) => DIFFICULTY.some((x) => x.id === v)),
      cost: pick(p.cost, (v) => /^[1-5]$/.test(v)),
      use: pick(p.use, (v) => USE_TYPES[v]),
      com: pick(p.com, (v) => COMMONNESS.some((x) => x.id === v)),
      sort: pick(p.sort, (v) => SORTS.some((s) => s.id === v)) || 'common',
      c: '',
    };

    const catsPresent = CATEGORIES.filter((c) => list.some((e) => e.category === c.id));
    const rarest = [...list].filter((e) => e.commonness != null)
      .sort((a, z) => a.commonness - z.commonness || (z.difficulty || 0) - (a.difficulty || 0) || (z.costTier || 0) - (a.costTier || 0))[0];
    const opt = (items, cur, all) => `<option value="">${all}</option>${items.map((o) => `<option value="${esc(o.id)}" ${o.id === cur ? 'selected' : ''}>${esc(o.label)}</option>`).join('')}`;

    wrap.innerHTML = `
      ${header({ eyebrow: 'The mechanisms', title: 'The <em>Complications</em>', lede: `From the humble date to the minute repeater: ${list.length} ways a watch can do more than tell the time, drawn, explained and rated for difficulty, cost, usefulness and rarity.` })}
      <section class="cx-intro" aria-label="About complications">
        <div class="cx-intro__text">
          <p class="cx-intro__lead">In watchmaking, a <em>complication</em> is any function beyond the simple display of hours, minutes and seconds.</p>
          <p>Some are everyday conveniences, like a date window or a second time zone. Others are feats of micro-engineering: a perpetual calendar that knows every leap year, or a minute repeater that chimes the time on hair-thin gongs. Each one adds parts, cost and skill, which is why a watch’s complications say so much about its price.</p>
          <p class="cx-intro__links"><a class="vw-link" href="#/complications" data-jump="cx-map">See the complication map ↓</a> <a class="vw-link" href="#/learn?section=glossary">Glossary of terms</a></p>
        </div>
        <dl class="cx-stats">
          <div><dt>Complications</dt><dd>${list.length}</dd></div>
          <div><dt>Categories</dt><dd>${catsPresent.length}</dd></div>
          ${rarest ? `<div class="cx-stats__rare"><dt>${list.filter((e) => e.commonness === rarest.commonness).length > 1 ? 'Among the rarest' : 'Rarest'}</dt><dd><a href="#/complications?c=${encodeURIComponent(rarest.id)}" data-open="${esc(rarest.id)}">${esc(rarest.name)}</a><small>${esc(rarest.comLabel || '')}${rarest.commonness != null ? ` · ${rarest.commonness}/10` : ''}</small></dd></div>` : ''}
        </dl>
      </section>

      <section class="cx-browse" aria-labelledby="cx-h-browse">
        <h2 class="vw-sr" id="cx-h-browse">Browse complications</h2>
        <div class="cx-bar">
          <label class="vw-search cx-bar__q"><span class="vw-sr">Search complications</span>
            <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5"/></svg>
            <input type="search" placeholder="Search names, aliases, summaries…" value="${esc(state.q)}" data-f="q" autocomplete="off"></label>
          <label class="vw-field"><span>Difficulty</span><select class="vw-select" data-f="diff">${opt(DIFFICULTY, state.diff, 'Any')}</select></label>
          <label class="vw-field"><span>Cost</span><select class="vw-select" data-f="cost">${opt(COST.slice(1).map((c, i) => ({ id: String(i + 1), label: `${c.sym}  ${c.range}` })), state.cost, 'Any')}</select></label>
          <label class="vw-field"><span>Usefulness</span><select class="vw-select" data-f="use">${opt(Object.entries(USE_TYPES).map(([id, u]) => ({ id, label: u.label })), state.use, 'Any')}</select></label>
          <label class="vw-field"><span>Commonness</span><select class="vw-select" data-f="com">${opt(COMMONNESS, state.com, 'Any')}</select></label>
          <label class="vw-field"><span>Sort</span><select class="vw-select" data-f="sort">${SORTS.map((s) => `<option value="${s.id}" ${s.id === state.sort ? 'selected' : ''}>${esc(s.label)}</option>`).join('')}</select></label>
        </div>
        <div class="cx-cats" role="group" aria-label="Category"></div>
        <div class="cx-status"><p class="cx-count" aria-live="polite"></p><button type="button" class="vw-btn vw-btn--small" data-reset hidden>Reset filters</button></div>
        <div class="cx-grid" role="list"></div>
      </section>

      <section class="cx-mapsec" id="cx-map" aria-labelledby="cx-h-map">
        <p class="vw-eyebrow">The complication map</p>
        <h2 class="vw-h2 vw-h2--big" id="cx-h-map">Difficulty <em>×</em> cost</h2>
        <p class="cx-mapsec__lede">Every complication placed by how hard it is to design and build, and what a watch with it typically costs. Larger dots are more common. <span class="cx-hint-pointer">Hover for a name, click to open.</span><span class="cx-hint-touch">Tap a dot for its name, tap again to open.</span></p>
        <div class="cx-map">
          <div class="cx-map__plot"></div>
        </div>
        <div class="cx-legend" role="group" aria-label="Filter by category"></div>
      </section>

      <dialog class="cx-dlg" aria-labelledby="cx-d-title"></dialog>
      ${source === 'complications-sample.json' ? '<p class="cx-note vw-muted">Showing a preview sample while the full compendium is prepared.</p>' : ''}`;

    const grid = wrap.querySelector('.cx-grid');
    const countEl = wrap.querySelector('.cx-count');
    const resetBtn = wrap.querySelector('[data-reset]');
    const catsEl = wrap.querySelector('.cx-cats');
    const legendEl = wrap.querySelector('.cx-legend');
    const plot = wrap.querySelector('.cx-map__plot');
    const mapBox = wrap.querySelector('.cx-map');
    const dlg = wrap.querySelector('.cx-dlg');
    let results = [];

    /* ---------- lazy art: draw once when near, animate only while visible ---------- */
    const drawArt = async (el) => {
      if (el.dataset.drawn) return;
      el.dataset.drawn = '1';
      const e = byId.get(el.dataset.cx);
      let svg = null;
      try { svg = await complicationSVG(el.dataset.cx); } catch { svg = null; }
      if (!life.on || !el.isConnected) return;
      el.innerHTML = svg || (e ? placeholderSVG(e) : '');
      el.classList.add('is-drawn', svg ? 'has-art' : 'is-placeholder');
      if (svg && e) el.querySelector('svg')?.setAttribute('aria-hidden', 'true');
    };
    const liveIO = new IntersectionObserver((entries) => {
      for (const en of entries) {
        en.target.classList.toggle('is-live', en.isIntersecting);
        if (en.isIntersecting) drawArt(en.target);
      }
    }, { rootMargin: '120px 0px' });
    cleanup.push(() => liveIO.disconnect());

    /* ---------- filtering ---------- */
    const matches = (e, skip) => {
      if (skip !== 'cat' && state.cat && e.category !== state.cat) return false;
      if (state.diff && e.diffId !== state.diff) return false;
      if (state.cost && String(e.costTier) !== state.cost) return false;
      if (state.use && e.usefulnessType !== state.use) return false;
      if (state.com && e.comId !== state.com) return false;
      const q = fold(state.q).trim().split(/\s+/).filter(Boolean);
      return q.every((t) => e._q.includes(t));
    };
    const sorter = (s) => {
      const nm = (a, z) => a.name.localeCompare(z.name, 'en', { sensitivity: 'base' });
      const desc = (k) => (a, z) => (z[k] ?? -1) - (a[k] ?? -1) || nm(a, z);
      if (s === 'difficulty') return desc('difficulty');
      if (s === 'cost') return (a, z) => (z.costTier ?? -1) - (a.costTier ?? -1) || (z.entryPrice ?? -1) - (a.entryPrice ?? -1) || nm(a, z);
      if (s === 'useful') return desc('usefulness');
      if (s === 'invented') return (a, z) => (a.invented.year ?? 1e6) - (z.invented.year ?? 1e6) || nm(a, z);
      if (s === 'az') return nm;
      return (a, z) => (z.commonness ?? -1) - (a.commonness ?? -1) || (a.difficulty ?? 99) - (z.difficulty ?? 99) || nm(a, z);
    };

    function syncURL() {
      ctx.setQuery({
        q: state.q.trim(), cat: state.cat, diff: state.diff, cost: state.cost, use: state.use, com: state.com,
        sort: state.sort === 'common' ? '' : state.sort, c: state.c,
      });
    }

    function renderCats() {
      const counts = new Map();
      for (const e of list) if (matches(e, 'cat')) counts.set(e.category, (counts.get(e.category) || 0) + 1);
      const total = [...counts.values()].reduce((a, b) => a + b, 0);
      const chip = (id, label, n, sw) => `<button type="button" class="vw-chip cx-chip" data-cat="${id}" aria-pressed="${state.cat === id}"${n === 0 && state.cat !== id ? ' data-empty' : ''}>${sw ? `<i class="cx-sw" style="--cc:${sw}" aria-hidden="true"></i>` : ''}${esc(label)}<span class="cx-chip__n">${n}</span></button>`;
      catsEl.innerHTML = chip('', 'All', total) + catsPresent.map((c) => chip(c.id, c.label, counts.get(c.id) || 0, catVar(c.id))).join('');
      legendEl.innerHTML = catsPresent.map((c) => `<button type="button" class="cx-legend__item" data-cat="${c.id}" aria-pressed="${state.cat === c.id}"><i class="cx-sw" style="--cc:${catVar(c.id)}" aria-hidden="true"></i>${esc(c.label)}</button>`).join('');
    }

    function apply({ url = true } = {}) {
      results = list.filter((e) => matches(e)).sort(sorter(state.sort));
      renderCats();
      liveIO.disconnect();
      const active = !!(state.q.trim() || state.cat || state.diff || state.cost || state.use || state.com);
      resetBtn.hidden = !active;
      countEl.innerHTML = results.length === list.length
        ? `All <strong>${list.length}</strong> complications · sorted by ${esc(SORTS.find((s) => s.id === state.sort).label.replace(/ \(.*\)$/, '').toLowerCase())}`
        : `Showing <strong>${results.length}</strong> of ${list.length} complications`;
      grid.innerHTML = results.length
        ? results.map(card).join('')
        : `<div class="vw-empty vw-empty--big" role="listitem"><p>No complication matches every filter.</p><button type="button" class="vw-btn" data-reset>Reset filters</button></div>`;
      grid.querySelectorAll('.cx-art').forEach((el) => liveIO.observe(el));
      map.update();
      if (url) syncURL();
    }

    function reset() {
      Object.assign(state, { q: '', cat: '', diff: '', cost: '', use: '', com: '' });
      wrap.querySelectorAll('.cx-bar [data-f]').forEach((el) => { if (el.dataset.f !== 'sort') el.value = ''; });
      apply();
    }

    /* ---------- map ---------- */
    const map = makeMap();
    function makeMap() {
      const tip = makeTooltip(mapBox);
      let selected = null;
      let lastPointer = 'mouse';
      const plotted = list.filter((e) => e.difficulty != null && e.costTier != null);

      function draw() {
        const W = Math.round(plot.clientWidth);
        if (!W) return;
        const small = W < 640;
        const H = small ? Math.round(W * 1.05) : Math.round(Math.min(560, Math.max(380, W * 0.5)));
        const m = small ? { l: 46, r: 10, t: 30, b: 46 } : { l: 104, r: 20, t: 18, b: 54 };
        const pw = W - m.l - m.r, ph = H - m.t - m.b;
        const X = (d) => m.l + ((d - 0.5) / 10) * pw;
        const Y = (t) => m.t + ph - ((t - 0.5) / 5) * ph;
        const cw = pw / 10, ch = ph / 5;
        const R = (c) => (small ? 3.8 : 5.4) + (c || 1) * (small ? 0.62 : 1.05) * Math.min(1.25, W / 900 + 0.35);

        // Deterministic packing: start around the cell centre, then relax collisions.
        const nodes = plotted.map((e, i) => {
          const a = i * 2.39996;
          const ax = X(e.difficulty), ay = Y(e.costTier);
          return { e, ax, ay, x: ax + Math.cos(a) * 3, y: ay + Math.sin(a) * 3, r: R(e.commonness) };
        });
        for (let it = 0; it < 160; it++) {
          for (let i = 0; i < nodes.length; i++) {
            for (let j = i + 1; j < nodes.length; j++) {
              const a = nodes[i], b = nodes[j];
              let dx = b.x - a.x, dy = b.y - a.y;
              let d = Math.hypot(dx, dy);
              const min = a.r + b.r + 2;
              if (d >= min) continue;
              if (d < 0.01) { dx = 0.7; dy = 0.7; d = 1; }
              const push = (min - d) / 2;
              a.x -= (dx / d) * push; a.y -= (dy / d) * push;
              b.x += (dx / d) * push; b.y += (dy / d) * push;
            }
          }
          for (const n of nodes) {
            n.x += (n.ax - n.x) * 0.04; n.y += (n.ay - n.y) * 0.04;
            n.x = Math.min(m.l + pw - n.r, Math.max(m.l + n.r, n.x));
            n.y = Math.min(m.t + ph - n.r, Math.max(m.t + n.r, n.y));
          }
        }

        let bg = '';
        for (let d = 1; d <= 10; d++) if (d % 2 === 0) bg += `<rect x="${(X(d) - cw / 2).toFixed(1)}" y="${m.t}" width="${cw.toFixed(1)}" height="${ph}" class="cx-map__band"/>`;
        let grid = '';
        for (let t = 1; t <= 5; t++) {
          const y = Y(t);
          grid += `<line x1="${m.l}" x2="${m.l + pw}" y1="${(y + ch / 2).toFixed(1)}" y2="${(y + ch / 2).toFixed(1)}" class="cx-map__grid"/>`;
          grid += `<text x="${m.l - (small ? 8 : 14)}" y="${y.toFixed(1)}" class="cx-map__ylab" text-anchor="end" dy="${small ? '.35em' : '-.15em'}">${COST[t].sym}</text>`;
          if (!small) grid += `<text x="${m.l - 14}" y="${y.toFixed(1)}" class="cx-map__ysub" text-anchor="end" dy="1.1em">${esc(COST[t].range)}</text>`;
        }
        for (let d = 1; d <= 10; d++) grid += `<text x="${X(d).toFixed(1)}" y="${m.t + ph + 18}" class="cx-map__xlab" text-anchor="middle">${d}</text>`;
        const axes = `<line x1="${m.l}" x2="${m.l + pw}" y1="${m.t + ph}" y2="${m.t + ph}" class="cx-map__axis"/>
          <text x="${m.l + pw / 2}" y="${H - 8}" class="cx-map__title" text-anchor="middle">Difficulty to design and build →</text>
          ${small ? '' : `<text x="${m.l}" y="${m.t + ph + 38}" class="cx-map__sub">Basic</text><text x="${m.l + pw}" y="${m.t + ph + 38}" class="cx-map__sub" text-anchor="end">Grand complication</text>`}
          ${small ? `<text x="4" y="12" class="cx-map__title">↑ Typical cost</text>` : `<text transform="translate(16 ${m.t + ph / 2}) rotate(-90)" class="cx-map__title" text-anchor="middle">Typical cost →</text>`}`;
        const dots = nodes.map((n) => {
          const e = n.e;
          return `<g class="cx-dot" data-id="${esc(e.id)}" data-cat="${e.category || ''}" transform="translate(${n.x.toFixed(1)} ${n.y.toFixed(1)})" tabindex="0" role="button"
            aria-label="${esc(`${e.name}. ${catLabel(e.category)}. Difficulty ${e.difficulty} of 10, cost ${COST[e.costTier].range}${e.commonness != null ? `, commonness ${e.commonness} of 10` : ''}. Open details`)}">
            <circle r="${Math.max(n.r + 4, 11).toFixed(1)}" class="cx-dot__hit"/>
            <circle r="${n.r.toFixed(1)}" class="cx-dot__c" style="--cc:${catVar(e.category)}"/></g>`;
        }).join('');
        plot.innerHTML = `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" class="cx-map__svg" role="group" aria-label="Scatter chart of ${plotted.length} complications by difficulty and cost">
          ${bg}${grid}${axes}<g class="cx-map__dots">${dots}</g></svg>`;
        update();
      }

      function update() {
        const inSet = new Set(results.map((e) => e.id));
        plot.querySelectorAll('.cx-dot').forEach((g) => {
          g.classList.toggle('is-out', !inSet.has(g.dataset.id));
          g.classList.toggle('is-sel', g.dataset.id === selected);
        });
      }

      function tipHTML(e, touch) {
        const cost = COST[e.costTier];
        return `<strong>${esc(e.name)}</strong><span class="cx-tip__cat"><i class="cx-sw" style="--cc:${catVar(e.category)}"></i>${esc(catLabel(e.category))}</span>
          <span class="vw-tip__muted">Difficulty ${e.difficulty}/10${e.diffLabel ? ` · ${esc(e.diffLabel)}` : ''}</span>
          <span class="vw-tip__muted">Cost ${cost.sym} · ${esc(cost.range)}</span>
          ${e.commonness != null ? `<span class="vw-tip__muted">Commonness ${e.commonness}/10${e.comLabel ? ` · ${esc(e.comLabel)}` : ''}</span>` : ''}
          <span class="cx-tip__cta">${touch ? 'Tap again to open' : 'Click to open'}</span>`;
      }
      function showTip(g, touch) {
        const e = byId.get(g.dataset.id);
        if (!e) return;
        const r = g.getBoundingClientRect();
        tip.show(tipHTML(e, touch), r.left + r.width / 2, r.top + r.height / 2);
        g.parentNode.appendChild(g); // bring to front
      }

      plot.addEventListener('pointerdown', (ev) => { lastPointer = ev.pointerType || 'mouse'; });
      plot.addEventListener('pointerover', (ev) => {
        if (ev.pointerType === 'touch') return;
        const g = ev.target.closest('.cx-dot');
        if (g) showTip(g, false);
      });
      plot.addEventListener('pointerout', (ev) => {
        if (ev.pointerType === 'touch') return;
        const g = ev.target.closest('.cx-dot');
        if (g && !g.contains(ev.relatedTarget)) tip.hide();
      });
      plot.addEventListener('focusin', (ev) => { const g = ev.target.closest('.cx-dot'); if (g) showTip(g, false); });
      plot.addEventListener('focusout', () => tip.hide());
      plot.addEventListener('click', (ev) => {
        const g = ev.target.closest('.cx-dot');
        if (!g) { selected = null; tip.hide(); update(); return; }
        const id = g.dataset.id;
        if (lastPointer === 'touch' && selected !== id) {
          selected = id; update(); showTip(g, true);
          return;
        }
        selected = null; tip.hide(); update();
        openDetail(id, g);
      });
      plot.addEventListener('keydown', (ev) => {
        const g = ev.target.closest('.cx-dot');
        if (g && (ev.key === 'Enter' || ev.key === ' ')) { ev.preventDefault(); openDetail(g.dataset.id, g); }
      });
      cleanup.push(onResize(plot, draw));
      requestAnimationFrame(draw);
      return { update, hide: () => tip.hide() };
    }

    /* ---------- detail dialog ---------- */
    let current = null;
    let returnFocus = null;
    let watchShown = WATCH_PAGE;

    const watchesFor = (id) => {
      const v = MODEL_MAP[id];
      if (!v) return null;
      const out = [];
      for (const b of ctx.brands) (b.models || []).forEach((m, i) => { if (m?.visual?.complications?.includes?.(v)) out.push({ m, b, i }); });
      return out.sort((a, z) => ((z.b.popularity || 0) + (z.b.prestige || 0)) - ((a.b.popularity || 0) + (a.b.prestige || 0)) || a.m.name.localeCompare(z.m.name));
    };

    const exampleHTML = (x) => {
      const b = x.brandId ? ctx.brandById.get(x.brandId) : null;
      let href = b ? `#/brand/${encodeURIComponent(b.id)}` : null;
      if (b && x.model) {
        const f = fold(x.model);
        const mi = (b.models || []).findIndex((m) => { const n = fold(m.name); return n && (f.includes(n) || n.includes(f)); });
        if (mi >= 0) href += `?model=${mi}`;
      }
      const brandName = x.brand || b?.name || '';
      const inner = `<span class="cx-ex__brand">${esc(brandName)}</span><span class="cx-ex__model">${esc(x.model || '')}</span>`;
      return `<li>${href ? `<a href="${href}">${inner}<span class="cx-ex__go" aria-hidden="true">→</span></a>` : `<span class="cx-ex__plain">${inner}</span>`}</li>`;
    };
    const host = (u) => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return u; } };

    function sequence() {
      return current && results.some((e) => e.id === current.id) ? results : [...list].sort(sorter(state.sort));
    }

    function watchesHTML(e) {
      const all = watchesFor(e.id);
      if (!all) return '';
      if (!all.length) return `<section class="cx-d__watches"><h3 class="cx-d__h">Watches in Watch World with this complication</h3><p class="vw-muted">None of the illustrated models carries it yet.</p></section>`;
      const shown = all.slice(0, watchShown);
      return `<section class="cx-d__watches" aria-labelledby="cx-d-w">
        <div class="cx-d__whead"><h3 class="cx-d__h" id="cx-d-w">Watches in Watch World with this complication</h3><span class="cx-d__wcount">${all.length} model${all.length === 1 ? '' : 's'}</span></div>
        <div class="cx-d__wgrid">${shown.map(({ m, b }) => modelCard(m, b, ctx)).join('')}</div>
        ${all.length > shown.length ? `<p class="cx-d__more"><button type="button" class="vw-btn" data-more>Show ${Math.min(12, all.length - shown.length)} more <span class="vw-muted">(${all.length - shown.length} left)</span></button></p>` : ''}
      </section>`;
    }

    function detailHTML(e) {
      const seq = sequence();
      const idx = seq.findIndex((x) => x.id === e.id);
      const prev = idx > 0 ? seq[idx - 1] : null;
      const next = idx >= 0 && idx < seq.length - 1 ? seq[idx + 1] : null;
      const facts = [
        ['Invented', yearText(e.invented.year)],
        ['By', e.invented.by],
        ['Parts', e.partsCount],
        ['Typical entry price', e.entryPrice ? `≈ ${fmtUSD(e.entryPrice, { compact: false })}` : null],
        ['Category', catLabel(e.category)],
        ['Usefulness', e.usefulnessType ? USE_TYPES[e.usefulnessType].label : null],
      ].filter((f) => f[1]);
      const pairs = e.pairsWith.map((id) => byId.get(id)).filter(Boolean);
      const navBtn = (x, dir) => (x
        ? `<a class="cx-d__step cx-d__step--${dir}" href="#/complications?c=${encodeURIComponent(x.id)}" data-open="${esc(x.id)}" data-keep><span class="cx-d__stepk">${dir === 'prev' ? '← Previous' : 'Next →'}</span><span class="cx-d__stepn">${esc(x.name)}</span></a>`
        : '<span class="cx-d__step is-empty" aria-hidden="true"></span>');
      return `<article class="cx-d" style="--cc:${catVar(e.category)}">
        <div class="cx-d__bar">
          <span class="cx-d__pos">${idx >= 0 ? `${idx + 1} / ${seq.length}` : ''}</span>
          <span class="cx-d__nav">
            <button type="button" class="cx-d__iconbtn" data-step="-1" ${prev ? '' : 'disabled'} aria-label="Previous complication${prev ? `: ${esc(prev.name)}` : ''}">←</button>
            <button type="button" class="cx-d__iconbtn" data-step="1" ${next ? '' : 'disabled'} aria-label="Next complication${next ? `: ${esc(next.name)}` : ''}">→</button>
            <button type="button" class="cx-d__iconbtn cx-d__close" data-close aria-label="Close">×</button>
          </span>
        </div>
        <div class="cx-d__hero">
          <div class="cx-d__art"><div class="cx-art is-live" data-cx="${esc(e.id)}"></div></div>
          <div class="cx-d__intro">
            <p class="vw-eyebrow cx-d__eyebrow"><i class="cx-sw" style="--cc:${catVar(e.category)}" aria-hidden="true"></i>${esc(catLabel(e.category))}</p>
            <h2 class="cx-d__title" id="cx-d-title">${esc(e.name)}</h2>
            ${e.aka.length ? `<p class="cx-d__aka">Also known as ${e.aka.map((a) => `<em>${esc(a)}</em>`).join(', ')}</p>` : ''}
            ${e.tagline ? `<p class="cx-d__tag">${esc(e.tagline)}</p>` : ''}
            ${meters(e, 'cx-meters--lg')}
          </div>
        </div>
        <div class="cx-d__body">
          <div class="cx-d__main">
            ${e.summary ? `<p class="cx-d__summary">${esc(e.summary)}</p>` : ''}
            ${e.howItWorks ? `<h3 class="cx-d__h">How it works</h3><p class="cx-d__p">${esc(e.howItWorks)}</p>` : ''}
            ${e.history ? `<h3 class="cx-d__h">History</h3><p class="cx-d__p">${esc(e.history)}</p>` : ''}
            ${e.funFact ? `<aside class="cx-fact"><p class="cx-fact__k">Fun fact</p><p class="cx-fact__t">${esc(e.funFact)}</p></aside>` : ''}
          </div>
          <aside class="cx-d__side">
            ${facts.length ? `<dl class="cx-facts">${facts.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>` : ''}
            ${e.famousExamples.length ? `<h3 class="cx-d__h">Famous examples</h3><ul class="cx-ex">${e.famousExamples.map(exampleHTML).join('')}</ul>` : ''}
            ${pairs.length ? `<h3 class="cx-d__h">Pairs with</h3><p class="cx-pairs">${pairs.map((x) => `<a class="vw-chip cx-chip" href="#/complications?c=${encodeURIComponent(x.id)}" data-open="${esc(x.id)}" data-keep><i class="cx-sw" style="--cc:${catVar(x.category)}" aria-hidden="true"></i>${esc(x.name)}</a>`).join('')}</p>` : ''}
            ${e.sources.length ? `<h3 class="cx-d__h">Sources</h3><ul class="cx-src">${e.sources.map((u) => `<li><a href="${esc(u)}" target="_blank" rel="noopener noreferrer">${esc(host(u))} <span aria-hidden="true">↗</span></a></li>`).join('')}</ul>` : ''}
          </aside>
        </div>
        ${watchesHTML(e)}
        <nav class="cx-d__foot" aria-label="More complications">${navBtn(prev, 'prev')}${navBtn(next, 'next')}</nav>
      </article>`;
    }

    function openDetail(id, from) {
      const e = byId.get(id);
      if (!e) return;
      if (!dlg.open) returnFocus = from || document.activeElement;
      current = e;
      state.c = e.id;
      watchShown = WATCH_PAGE;
      dlg.innerHTML = detailHTML(e);
      dlg.scrollTop = 0;
      drawArt(dlg.querySelector('.cx-art'));
      if (!dlg.open) dlg.showModal();
      dlg.querySelector('[data-close]')?.focus({ preventScroll: true });
      document.title = `${e.name} · Complications · Watch World`;
      syncURL();
    }

    function closeDetail() { if (dlg.open) dlg.close(); }

    dlg.addEventListener('close', () => {
      current = null;
      state.c = '';
      dlg.innerHTML = '';
      if (!life.on) return; // navigating away: never touch the new route's URL
      if (location.hash.startsWith('#/complications')) { syncURL(); document.title = 'Complications · Watch World'; }
      const back = returnFocus?.isConnected ? returnFocus : null;
      back?.focus?.({ preventScroll: true });
      returnFocus = null;
    });
    dlg.addEventListener('click', (ev) => {
      if (ev.target === dlg) return closeDetail(); // backdrop
      if (ev.target.closest('[data-close]')) return closeDetail();
      const step = ev.target.closest('[data-step]');
      if (step) {
        const seq = sequence();
        const i = seq.findIndex((x) => x.id === current?.id);
        const n = seq[i + Number(step.dataset.step)];
        if (n) { openDetail(n.id); dlg.querySelector(`[data-step="${step.dataset.step}"]:not([disabled])`)?.focus(); }
        return;
      }
      const more = ev.target.closest('[data-more]');
      if (more && current) {
        watchShown += 12;
        const sec = dlg.querySelector('.cx-d__watches');
        const tmp = document.createElement('div');
        tmp.innerHTML = watchesHTML(current);
        const fresh = tmp.firstElementChild;
        sec.replaceWith(fresh);
        fresh.querySelectorAll('.mcard')[watchShown - 12]?.querySelector('a')?.focus({ preventScroll: false });
        return;
      }
      const open = ev.target.closest('[data-open]');
      if (open && !ev.metaKey && !ev.ctrlKey && !ev.shiftKey) {
        ev.preventDefault();
        openDetail(open.dataset.open);
        return;
      }
      // Any other in-app link (brand pages, models) leaves this view; the router tears the dialog down.
    });
    dlg.addEventListener('keydown', (ev) => {
      if (ev.target.closest('input, textarea, select')) return;
      if (ev.key === 'ArrowLeft' || ev.key === 'ArrowRight') {
        const btn = dlg.querySelector(`[data-step="${ev.key === 'ArrowLeft' ? -1 : 1}"]`);
        if (btn && !btn.disabled) { ev.preventDefault(); btn.click(); }
      }
    });

    /* ---------- events ---------- */
    const bar = wrap.querySelector('.cx-bar');
    const refilter = debounce(() => apply(), 140);
    bar.addEventListener('input', (ev) => {
      const f = ev.target.dataset.f;
      if (!f) return;
      state[f] = ev.target.value;
      if (f === 'q') refilter(); else apply();
    });
    const pickCat = (ev) => {
      const b = ev.target.closest('[data-cat]');
      if (!b) return;
      const id = b.dataset.cat;
      state.cat = state.cat === id ? '' : id;
      apply();
      // keep focus on the equivalent control after the re-render
      ev.currentTarget.querySelector(`[data-cat="${id}"]`)?.focus();
    };
    catsEl.addEventListener('click', pickCat);
    legendEl.addEventListener('click', pickCat);
    legendEl.addEventListener('pointerover', (ev) => {
      const b = ev.target.closest('[data-cat]');
      plot.dataset.hl = b ? b.dataset.cat : '';
    });
    legendEl.addEventListener('pointerleave', () => { plot.dataset.hl = ''; });
    legendEl.addEventListener('focusin', (ev) => { const b = ev.target.closest('[data-cat]'); plot.dataset.hl = b ? b.dataset.cat : ''; });
    legendEl.addEventListener('focusout', () => { plot.dataset.hl = ''; });

    wrap.addEventListener('click', (ev) => {
      if (dlg.contains(ev.target)) return;
      if (ev.target.closest('[data-reset]')) { reset(); return; }
      const jump = ev.target.closest('[data-jump]');
      if (jump) {
        ev.preventDefault();
        const el = wrap.querySelector(`#${jump.dataset.jump}`);
        el?.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' });
        return;
      }
      const open = ev.target.closest('[data-open]');
      if (open) {
        if (ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.button === 1) return;
        ev.preventDefault();
        openDetail(open.dataset.open, open);
        return;
      }
      // Clicking anywhere on a card (e.g. on its meters, which sit above the stretched link) opens it too.
      const c = ev.target.closest('.cx-card');
      if (c && !ev.target.closest('a, button')) openDetail(c.dataset.id, c.querySelector('[data-open]'));
    });

    apply({ url: false });
    if (p.c && byId.has(p.c)) openDetail(p.c);
  },

  destroy() {
    cleanup.forEach((f) => { try { f(); } catch { /* noop */ } });
    cleanup = [];
    document.querySelectorAll('.cx-dlg[open]').forEach((d) => d.close());
  },
};
