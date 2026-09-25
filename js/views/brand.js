import { esc, fmtUSD, fmtNum, flagImg, label, TIER_LABELS, TIER_NAMES } from '../lib/util.js';
import { brandCard, tierBadge, watchSlot, favButton, compareButton } from '../components/cards.js';
import { meter, ARROW_EXT } from '../components/ui.js';

let current = null;
let off = [];
let connPromise = null;
let geoPromise = null;

const INHOUSE = { yes: 'Yes, in-house', partial: 'Partly in-house', no: 'Sourced from suppliers' };

export default {
  get title() { return current ? current.name : 'Brand'; },
  render(root, ctx) {
    off = [];
    const b = ctx.brandById.get(ctx.params.id);
    current = b || null;
    if (!b) {
      root.innerHTML = `<section class="wrap soon"><div class="soon__mark" aria-hidden="true"><span></span></div><p class="eyebrow">Unknown brand</p>
        <h1 class="display">We couldn't find “${esc(ctx.params.id || '')}”</h1><p class="lede">It may have been renamed. Try searching instead.</p>
        <p class="soon__actions"><a class="btn btn--gold" href="#/explore${ctx.params.id ? `?q=${encodeURIComponent(ctx.params.id.replace(/-/g, ' '))}` : ''}">Search the catalogue</a></p></section>`;
      return;
    }

    const list = ctx.brands;
    const idx = list.indexOf(b);
    const prev = list[(idx - 1 + list.length) % list.length];
    const next = list[(idx + 1) % list.length];
    const place = [b.city, b.country].filter(Boolean).join(', ');
    const age = b.founded ? new Date().getFullYear() - b.founded : null;
    const history = String(b.history || '').split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
    const site = safeUrl(b.website);
    const similar = similarBrands(b, list);

    root.innerHTML = `
<article class="brand-page">
  <header class="bhero">
    <div class="wrap">
      <nav class="bhero__crumbs" aria-label="Breadcrumb">
        <a href="#/explore">Explore</a><span aria-hidden="true">/</span>
        ${b.segment ? `<a href="#/explore?seg=${encodeURIComponent(b.segment)}">${esc(b.segment)}</a><span aria-hidden="true">/</span>` : ''}
        <span aria-current="page">${esc(b.name)}</span>
      </nav>
      <div class="bhero__grid">
        <div>
          <p class="eyebrow reveal">${esc(b.segment || 'Watchmaker')}${b.parentGroup && b.parentGroup !== b.segment ? ` · ${esc(b.parentGroup)}` : ''} ${b.status !== 'active' ? `<span class="status-pill ${b.status === 'revived' ? 'status-pill--revived' : ''}">${esc(b.status)}</span>` : ''}</p>
          <h1 class="bhero__name reveal" style="--d:80ms">${nameHTML(b.name)}</h1>
          ${b.tagline ? `<p class="bhero__tag reveal" style="--d:160ms">${esc(b.tagline)}</p>` : ''}
          <div class="bhero__facts reveal" style="--d:240ms">
            ${place ? `<span>${flagImg(b.countryCode)}${esc(place)}</span>` : ''}
            ${b.founded ? `<span><span class="k">Est.</span> ${esc(b.founded)}${age ? ` <span class="muted">(${age} years)</span>` : ''}</span>` : ''}
            ${tierBadge(b.priceTier)}
          </div>
          <div class="bhero__actions reveal" style="--d:320ms">
            ${actionToggle('fav', b, ctx)}
            ${actionToggle('compare', b, ctx)}
            ${site ? `<a class="btn" href="${esc(site)}" target="_blank" rel="noopener noreferrer">Official site ${ARROW_EXT}</a>` : ''}
            <a class="btn btn--ghost" href="#/network?focus=${encodeURIComponent(b.id)}">See connections <span aria-hidden="true">→</span></a>
          </div>
        </div>
        <div class="bhero__stage">${watchSlot(b.id, b.models.length ? 0 : -1, { size: 420 })}</div>
      </div>
    </div>
  </header>

  <div class="wrap">
    <section class="meters reveal" aria-label="Ratings">
      ${meter('Price tier', b.priceTier, { color: `var(--tier-${b.priceTier || 5})`, note: b.priceTier ? `${TIER_NAMES[b.priceTier]} · ${TIER_LABELS[b.priceTier]}` : 'Prices not published' })}
      ${meter('Popularity', b.popularity, { note: 'Recognition beyond collectors' })}
      ${meter('Prestige', b.prestige, { note: 'Respect among connoisseurs' })}
      ${meter('Value retention', b.valueRetention, { note: 'Strength on the secondary market' })}
    </section>

    <div class="bbody">
      <div class="prose">
        ${b.summary ? `<p class="summary reveal">${esc(b.summary)}</p>` : ''}
        ${history.length ? `<h2 class="h2 reveal">The <em>story</em></h2><div class="history reveal">${history.map((p) => `<p>${esc(p)}</p>`).join('')}</div>` : ''}

        ${b.timeline.length ? `<h2 class="h2 reveal">Timeline</h2>
        <ol class="vtimeline reveal">${b.timeline.map((t) => `<li><span class="yr">${esc(t.year ?? '')}</span><span class="ev">${esc(t.event)}</span></li>`).join('')}</ol>` : ''}
      </div>

      <aside class="bbody__aside">
        <section class="panel reveal" aria-labelledby="h-facts">
          <h2 class="panel__title" id="h-facts">At a glance</h2>
          <dl class="facts">
            ${fact('Founded', b.founded ? `${b.founded}${b.founders.length ? ` by ${esc(b.founders.join(', '))}` : ''}` : null, true)}
            ${fact('Headquarters', place)}
            ${b.originCountry && b.originCountry !== b.country ? fact('Founded in', b.originCountry) : ''}
            ${fact('Group', b.parentGroup ? `<a href="#/groups">${esc(b.parentGroup)}</a>` : null, true)}
            ${fact('Ownership', b.ownership)}
            ${fact('Segment', b.segment)}
            ${fact('Price range', b.priceRange.min || b.priceRange.max ? `${fmtUSD(b.priceRange.min)} – ${fmtUSD(b.priceRange.max)}` : null)}
            ${fact('Production', b.annualProduction ? `${b.annualProduction} a year` : null)}
            ${fact('Revenue', b.revenueUSD ? `≈ ${fmtUSD(b.revenueUSD)}` : null)}
            ${fact('Employees', b.employees ? `≈ ${fmtNum(b.employees)}` : null)}
            ${fact('Movements', INHOUSE[b.inHouseMovements])}
            ${b.movementTypes.length ? fact('Calibres', b.movementTypes.map((m) => `<a class="tag" href="#/explore?mv=${encodeURIComponent(m)}">${esc(label(m))}</a>`).join(' '), true) : ''}
            ${b.specialties.length ? fact('Specialties', b.specialties.map((s) => `<a class="tag" href="#/explore?spec=${encodeURIComponent(s)}">${esc(label(s))}</a>`).join(' '), true) : ''}
            ${site ? fact('Website', `<a href="${esc(site)}" target="_blank" rel="noopener noreferrer">${esc(site.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, ''))} ${ARROW_EXT}</a>`, true) : ''}
          </dl>
        </section>
        ${b.lat != null && b.lng != null ? `<section class="panel reveal" aria-labelledby="h-loc">
          <h2 class="panel__title" id="h-loc">Where it’s made</h2>
          <div class="locmap" id="locmap" role="img" aria-label="Globe showing ${esc(place)}"></div>
          <p class="coords">${fmtCoord(b.lat, 'N', 'S')} · ${fmtCoord(b.lng, 'E', 'W')}</p>
          <p class="coords"><a href="#/map">Open the world map</a> · <a href="https://www.openstreetmap.org/?mlat=${b.lat}&amp;mlon=${b.lng}#map=11/${b.lat}/${b.lng}" target="_blank" rel="noopener noreferrer">OpenStreetMap ${ARROW_EXT}</a></p>
        </section>` : ''}
        <section class="panel reveal" id="conn-panel" aria-labelledby="h-conn" hidden>
          <h2 class="panel__title" id="h-conn">Connections</h2>
          <ul class="conn-list" id="conn-list"></ul>
          <p style="margin:.8rem 0 0"><a class="link-more" href="#/network?focus=${encodeURIComponent(b.id)}">See connections <span aria-hidden="true">→</span></a></p>
        </section>
      </aside>
    </div>

    ${b.innovations.length ? `<section class="section" style="padding-top:0" aria-labelledby="h-innov">
      <div class="section-head reveal"><div><p class="eyebrow">Firsts and breakthroughs</p><h2 class="h2" id="h-innov">Innovations</h2></div></div>
      <ul class="innov">${b.innovations.map((s, i) => { const m = /^\s*(\d{3,4}s?)\s*[:–-]\s*(.*)$/.exec(String(s)); return `<li class="reveal" style="--d:${i * 60}ms">${m ? `<span class="yr">${esc(m[1])}</span><p>${esc(m[2])}</p>` : `<p>${esc(s)}</p>`}</li>`; }).join('')}</ul>
    </section>` : ''}

    ${b.famousWearers.length || b.funFacts.length ? `<section class="section split" style="padding-top:0">
      ${b.famousWearers.length ? `<div class="reveal"><p class="eyebrow">On famous wrists</p><h2 class="h2" style="margin-bottom:1.4rem">Famous wearers</h2><div class="wearers">${b.famousWearers.map((w) => `<span>${esc(w)}</span>`).join('')}</div></div>` : ''}
      ${b.funFacts.length ? `<div class="reveal"><p class="eyebrow">Did you know</p><h2 class="h2" style="margin-bottom:1.4rem">Fun facts</h2><ol class="funfacts">${b.funFacts.map((f) => `<li>${esc(f)}</li>`).join('')}</ol></div>` : ''}
    </section>` : ''}

    ${b.models.length ? `<section class="section" style="padding-top:0" aria-labelledby="h-models">
      <div class="section-head reveal"><div><p class="eyebrow">The collection</p><h2 class="h2" id="h-models">${b.models.length} defining <em>models</em></h2></div>
      <a class="link-more" href="#/models">All models <span aria-hidden="true">→</span></a></div>
      <div class="gallery">${b.models.map((m, i) => modelBlock(b, m, i)).join('')}</div>
    </section>` : ''}

    ${similar.length ? `<section class="section" style="padding-top:0" aria-labelledby="h-sim">
      <div class="section-head reveal"><div><p class="eyebrow">If you like ${esc(b.name)}</p><h2 class="h2" id="h-sim">Similar <em>houses</em></h2></div>
      <a class="link-more" href="#/compare?ids=${[b, ...similar.slice(0, 3)].map((x) => encodeURIComponent(x.id)).join(',')}">Compare these <span aria-hidden="true">→</span></a></div>
      <div class="card-grid">${similar.map((s) => brandCard(s, ctx)).join('')}</div>
    </section>` : ''}

    <nav class="pn" aria-label="Adjacent brands">
      <a href="#/brand/${esc(prev.id)}" rel="prev"><span class="dir">← Previous</span><span class="nm">${esc(prev.name)}</span></a>
      <a href="#/brand/${esc(next.id)}" rel="next"><span class="dir">Next →</span><span class="nm">${esc(next.name)}</span></a>
    </nav>
  </div>
</article>`;

    // Photo / illustration toggles
    root.querySelectorAll('.gmodel').forEach((g) => {
      const img = g.querySelector('.gmodel__photo');
      const slot = g.querySelector('.watch-slot');
      const btns = g.querySelectorAll('[data-show]');
      if (!img) return;
      const show = (which) => {
        const photo = which === 'photo';
        img.hidden = !photo;
        slot.hidden = photo;
        btns.forEach((x) => x.setAttribute('aria-pressed', String(x.dataset.show === which)));
      };
      img.addEventListener('error', () => {
        show('illustration');
        const pb = g.querySelector('[data-show="photo"]');
        if (pb) { pb.disabled = true; pb.title = 'Official photo unavailable'; pb.setAttribute('aria-disabled', 'true'); }
      });
      btns.forEach((x) => x.addEventListener('click', () => {
        if (x.dataset.show === 'photo') img.loading = 'eager';
        show(x.dataset.show);
      }));
    });

    // Scroll to a requested model
    const mi = Number(ctx.params.model);
    if (Number.isInteger(mi) && b.models[mi]) {
      const el = root.querySelector(`#model-${mi}`);
      if (el) {
        el.classList.add('is-target');
        requestAnimationFrame(() => requestAnimationFrame(() => el.scrollIntoView({ block: 'center' })));
        const t = setTimeout(() => el.classList.remove('is-target'), 3000);
        off.push(() => clearTimeout(t));
      }
    }

    // Lazy extras
    drawGlobe(root.querySelector('#locmap'), b);
    loadConnections(root, b, ctx);
  },
  destroy() {
    off.forEach((f) => f());
    off = [];
  },
};

function actionToggle(kind, b, ctx) {
  if (kind === 'fav') {
    const on = ctx.favorites.has(b.id);
    return `<button type="button" class="btn" data-fav="${esc(b.id)}" aria-pressed="${on}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20.5s-7.5-4.6-9.3-9.2C1.4 8 3.5 4.5 7 4.5c2 0 3.3 1.1 5 3 1.7-1.9 3-3 5-3 3.5 0 5.6 3.5 4.3 6.8-1.8 4.6-9.3 9.2-9.3 9.2z"/></svg>Favourite</button>`;
  }
  const on = ctx.compare.has(b.id);
  return `<button type="button" class="btn" data-compare="${esc(b.id)}" aria-pressed="${on}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v18M5 21h14M4 8h16M7 8l-3 7a3 3 0 0 0 6 0L7 8zm10 0-3 7a3 3 0 0 0 6 0l-3-7z"/></svg>Compare</button>`;
}

/** "Apple (Apple Watch)" -> "Apple" for inline copy. */
function shortName(n) { return String(n || '').replace(/\s*\([^)]*\)\s*$/, '') || n; }

/** Big display name: a trailing parenthetical drops to a smaller italic second line. */
function nameHTML(n) {
  const m = /^(.*?)\s*\(([^)]+)\)\s*$/.exec(String(n || ''));
  return m ? `${esc(m[1])} <span class="bhero__aka">${esc(m[2])}</span>` : esc(n);
}

function fact(k, v, raw = false) {
  if (v == null || v === '') return '';
  return `<div><dt>${esc(k)}</dt><dd>${raw ? v : esc(v)}</dd></div>`;
}

function fmtCoord(v, pos, neg) {
  return `${Math.abs(v).toFixed(4)}° ${v >= 0 ? pos : neg}`;
}

function safeUrl(u) {
  if (!u) return null;
  try { const x = new URL(u); return /^https?:$/.test(x.protocol) ? x.href : null; } catch { return null; }
}

function modelBlock(b, m, i) {
  const url = safeUrl(m.url);
  const img = safeUrl(m.imageUrl);
  const specs = [
    ['Reference', m.reference],
    ['Introduced', m.introduced],
    ['Case', [m.caseSizeMm ? `${m.caseSizeMm} mm` : null, m.caseMaterial].filter(Boolean).join(', ')],
    ['Movement', m.movement],
    ['Water resistance', m.waterResistanceM ? `${fmtNum(m.waterResistanceM)} m` : null],
    ['Category', m.category ? label(m.category) : null],
  ].filter(([, v]) => v != null && v !== '');
  return `<article class="gmodel reveal" id="model-${i}" aria-labelledby="mname-${i}">
    <div class="gmodel__media">
      <div class="gmodel__frame">
        ${watchSlot(b.id, i, { size: 360 })}
        ${img ? `<img class="gmodel__photo" src="${esc(img)}" alt="Official photo of the ${esc(b.name)} ${esc(m.name)}" loading="lazy" decoding="async" referrerpolicy="no-referrer" hidden>` : ''}
      </div>
      ${img ? `<div class="seg-toggle" role="group" aria-label="Image type">
        <button type="button" class="chip" data-show="illustration" aria-pressed="true">Illustration</button>
        <button type="button" class="chip" data-show="photo" aria-pressed="false">Official photo</button>
      </div>` : ''}
    </div>
    <div>
      <span class="gmodel__num">${String(i + 1).padStart(2, '0')} / ${String(b.models.length).padStart(2, '0')}</span>
      <h3 class="gmodel__name" id="mname-${i}">${esc(m.name)}</h3>
      ${m.reference ? `<p class="gmodel__ref">Ref. ${esc(m.reference)}</p>` : ''}
      ${m.description ? `<p class="gmodel__desc">${esc(m.description)}</p>` : ''}
      <dl class="specs">
        ${specs.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}
        <div class="price"><dt>Approx. price</dt><dd>${m.priceUSD ? fmtUSD(m.priceUSD, { compact: false }) : '<span class="on-request">Price on request</span>'}</dd></div>
      </dl>
      <div class="gmodel__foot">
        ${url ? `<a class="btn btn--gold" href="${esc(url)}" target="_blank" rel="noopener noreferrer">View on ${esc(shortName(b.name))} site ${ARROW_EXT}</a>` : ''}
      </div>
    </div>
  </article>`;
}

function similarBrands(b, list) {
  const specs = new Set(b.specialties);
  return list
    .filter((x) => x !== b)
    .map((x) => {
      let s = 0;
      if (x.segment && x.segment === b.segment) s += 3;
      if (x.priceTier && b.priceTier) s += Math.max(0, 2.5 - Math.abs(x.priceTier - b.priceTier));
      s += Math.min(4, x.specialties.filter((y) => specs.has(y)).length) * 0.9;
      if (x.country === b.country) s += 0.5;
      if (x.parentGroup && x.parentGroup === b.parentGroup && x.parentGroup !== 'Independent') s += 1;
      if (x.prestige && b.prestige) s += Math.max(0, 1 - Math.abs(x.prestige - b.prestige) * 0.3);
      return [s, x];
    })
    .sort((a, z) => z[0] - a[0])
    .slice(0, 4)
    .map((x) => x[1]);
}

/* ---------- location globe (lazy D3) ---------- */
function drawGlobe(el, b) {
  if (!el) return;
  geoPromise ||= Promise.all([
    import('https://cdn.jsdelivr.net/npm/d3-geo@3/+esm'),
    import('https://cdn.jsdelivr.net/npm/topojson-client@3/+esm'),
    fetch('https://cdn.jsdelivr.net/npm/world-atlas@2/land-110m.json').then((r) => { if (!r.ok) throw new Error('atlas'); return r.json(); }),
  ]).then(([geo, topo, world]) => ({ geo, land: topo.feature(world, world.objects.land) }));
  geoPromise.then(({ geo, land }) => {
    if (!el.isConnected) return;
    const S = 280;
    const proj = geo.geoOrthographic().scale(S / 2 - 6).translate([S / 2, S / 2]).rotate([-b.lng, -b.lat * 0.75]).clipAngle(90);
    const path = geo.geoPath(proj);
    const [px, py] = proj([b.lng, b.lat]) || [S / 2, S / 2];
    el.innerHTML = `<svg viewBox="0 0 ${S} ${S}" aria-hidden="true">
      <path class="sphere" d="${path({ type: 'Sphere' })}"/>
      <path class="grat" d="${path(geo.geoGraticule10())}"/>
      <path class="land" d="${path(land)}"/>
      <circle class="pulse" cx="${px}" cy="${py}" r="6"/>
      <circle class="pin" cx="${px}" cy="${py}" r="4"/>
    </svg>`;
  }).catch(() => {
    if (!el.isConnected) return;
    el.style.aspectRatio = 'auto';
    el.innerHTML = '';
  });
}

/* ---------- connections (lazy data/connections.json) ---------- */
const PHRASES = {
  owns: ['Owns', 'Owned by'],
  stake: ['Holds a stake in', 'Stake held by'],
  'movement-supplier': ['Supplies movements to', 'Movements from'],
  designer: ['Designed for', 'Designed by'],
  lineage: ['Led to', 'Descends from'],
  collaboration: ['Collaboration with', 'Collaboration with'],
  'founder-link': ['Founder link to', 'Founder link to'],
  'former-owner': ['Former owner of', 'Formerly owned by'],
  'case-dial-supplier': ['Supplies cases or dials to', 'Cases or dials from'],
};

function loadConnections(root, b, ctx) {
  connPromise ||= fetch('data/connections.json').then((r) => (r.ok ? r.json() : null)).catch(() => null);
  connPromise.then((data) => {
    const panel = root.querySelector('#conn-panel');
    if (!panel || !panel.isConnected || !data || !Array.isArray(data.edges)) return;
    const ents = new Map((data.entities || []).map((e) => [e.id, e]));
    const edges = data.edges.filter((e) => e && (e.source === b.id || e.target === b.id));
    if (!edges.length) return;
    edges.sort((a, z) => (z.current !== false) - (a.current !== false) || (a.year || 0) - (z.year || 0));
    const rows = edges.slice(0, 12).map((e) => {
      const out = e.source === b.id;
      const other = out ? e.target : e.source;
      const ob = ctx.brandById.get(other);
      const oe = ents.get(other);
      const name = ob?.name || oe?.name || String(other).split('-').map((w) => (w.length > 2 || /^[a-z]$/.test(w) ? w.charAt(0).toUpperCase() + w.slice(1) : w)).join(' ');
      const phrase = (PHRASES[e.type] || [label(e.type || 'related'), label(e.type || 'related')])[out ? 0 : 1];
      const who = ob ? `<a href="#/brand/${esc(ob.id)}">${esc(name)}</a>` : esc(name);
      const detail = [e.label, e.year && !String(e.label || '').includes(String(e.year)) ? e.year : null].filter(Boolean).join(' · ');
      return `<li class="${e.current === false ? 'past' : ''}"><span class="who">${esc(phrase)} ${who}</span>${e.current === false ? '<span class="type">Historical</span>' : ''}${detail ? `<span class="lbl">${esc(detail)}</span>` : ''}</li>`;
    });
    panel.querySelector('#conn-list').innerHTML = rows.join('');
    panel.hidden = false;
  });
}
