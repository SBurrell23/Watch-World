import { esc, fmtNum, dayIndex, hash, reducedMotion, uniq, flagImg } from '../lib/util.js';
import { brandCard, modelCard, tierBadge, watchSlot, favButton, compareButton } from '../components/cards.js';
import { meter } from '../components/ui.js';

const ICONS = {
  explore: '<circle cx="20" cy="20" r="15"/><path d="m26 14-4 8-8 4 4-8z"/><circle cx="20" cy="20" r="1"/>',
  map: '<circle cx="20" cy="20" r="15"/><path d="M5 20h30M20 5c5 4 6 10 6 15s-1 11-6 15c-5-4-6-10-6-15s1-11 6-15z"/>',
  prices: '<path d="M8 33h24M11 33V22M17 33V16M23 33V11M29 33V6"/>',
  timeline: '<path d="M20 4v32"/><circle cx="20" cy="10" r="2.5"/><circle cx="20" cy="20" r="2.5"/><circle cx="20" cy="30" r="2.5"/><path d="M23 10h9M8 20h9M23 30h7"/>',
  groups: '<circle cx="20" cy="11" r="5"/><circle cx="9" cy="29" r="5"/><circle cx="31" cy="29" r="5"/><path d="m17 15-5 10M23 15l5 10M14 29h12"/>',
  network: '<circle cx="10" cy="10" r="3"/><circle cx="30" cy="12" r="3"/><circle cx="20" cy="22" r="4"/><circle cx="9" cy="31" r="3"/><circle cx="31" cy="31" r="3"/><path d="m12 12 5 7M28 14l-5 6M17 25l-6 4M23 25l6 4M13 10h14"/>',
  models: '<rect x="13" y="3" width="14" height="34" rx="4"/><circle cx="20" cy="20" r="9" fill="var(--bg-elev)"/><path d="M20 14v6l4 2"/>',
  complications: '<circle cx="20" cy="20" r="15"/><circle cx="20" cy="20" r="11.5" stroke-dasharray="1 2.2"/><circle cx="20" cy="27" r="4"/><path d="M20 20V9M20 20l6 3"/><path d="M12.5 12.5a10.5 10.5 0 0 1 4-2.8"/>',
  finder: '<circle cx="17" cy="17" r="10"/><path d="m24.5 24.5 9 9M17 11v6h5"/>',
  learn: '<path d="M6 10c5-2 10-2 14 1 4-3 9-3 14-1v22c-5-2-10-2-14 1-4-3-9-3-14-1z"/><path d="M20 11v22"/>',
  compare: '<path d="M20 5v30M10 35h20M7 12h26M11 12l-5 11a5 5 0 0 0 10 0zm18 0-5 11a5 5 0 0 0 10 0z"/>',
};

const TRINITY = ['patek-philippe', 'audemars-piguet', 'vacheron-constantin'];

let cleanups = [];

export default {
  title: 'Home',
  render(root, ctx) {
    cleanups = [];
    const { brands, brandById } = ctx;
    const countries = uniq(brands.map((b) => b.country));
    const models = brands.reduce((n, b) => n + b.models.length, 0);
    const oldest = brands.filter((b) => b.founded).sort((a, z) => a.founded - z.founded)[0];

    const heroBrand = ['patek-philippe', 'rolex', 'audemars-piguet', 'omega'].map((id) => brandById.get(id)).find((b) => b?.models.length)
      || [...brands].sort((a, z) => (z.prestige || 0) - (a.prestige || 0))[0];
    const heroModel = heroBrand?.models[0];

    const cities = uniq([...brands].sort((a, z) => (z.popularity || 0) - (a.popularity || 0)).map((b) => b.city)).slice(0, 10);

    // Brand of the day: deterministic by local date.
    const di = dayIndex();
    const spot = brands[(hash(String(di)) % brands.length)];

    const trinity = TRINITY.map((id) => brandById.get(id)).filter(Boolean);
    const holy = trinity.length >= 2 ? trinity : [...brands].sort((a, z) => (z.prestige || 0) - (a.prestige || 0)).slice(0, 3);
    const value = brands
      .filter((b) => b.status !== 'defunct' && b.priceTier && b.priceTier <= 5)
      .map((b) => [((b.prestige || 5) * 1.3 + (b.valueRetention || 5) * 0.8 + (b.popularity || 5) * 0.5) / (b.priceTier + 1.5), b])
      .sort((a, z) => z[0] - a[0]).slice(0, 12).map((x) => x[1]);
    const oldestList = brands.filter((b) => b.founded && b.status !== 'defunct').sort((a, z) => a.founded - z.founded).slice(0, 12);
    const indies = brands
      .filter((b) => /independent/i.test(b.parentGroup || '') && ['Independent', 'Haute Horlogerie', 'Microbrand', 'Premium', 'Luxury'].includes(b.segment) && b.status !== 'defunct')
      .sort((a, z) => (z.prestige || 0) - (a.prestige || 0) || (a.popularity || 0) - (z.popularity || 0))
      .filter((b) => !['rolex', 'patek-philippe'].includes(b.id))
      .slice(0, 12);
    const iconic = brands
      .filter((b) => b.models.length)
      .sort((a, z) => ((z.popularity || 0) + (z.prestige || 0)) - ((a.popularity || 0) + (a.prestige || 0)))
      .slice(0, 12).map((b) => [b.models[0], b]);

    const words = (s, start) => s.split(' ').map((w, i) => `<span class="w" style="--i:${start + i}">${w}</span>`).join(' ');

    root.innerHTML = `
<section class="hero">
  <div class="wrap">
    <div class="hero__grid">
      <div class="hero__copy">
        <p class="eyebrow reveal">An illustrated atlas of horology</p>
        <h1 class="hero__title">
          <span class="ln">${words('The great houses', 0)}</span>
          <span class="ln">${words('of watchmaking,', 3)}</span>
          <span class="ln"><em>${words('illustrated.', 5)}</em></span>
        </h1>
        <p class="lede hero__lede">${fmtNum(brands.length)} brands, from ${fmtNum(countries.length)} countries: their histories, icons, owners and prices, drawn one watch at a time. Start in <span class="hero__rotator" id="rotator">${esc(cities[0] || 'Geneva')}</span>.</p>
        <div class="hero__cta">
          <a class="btn btn--gold" href="#/explore">Explore the brands</a>
          <a class="btn" href="#/finder">Find my watch</a>
        </div>
      </div>
      <div class="hero__stage">
        <svg class="hero__rings" viewBox="0 0 400 400" aria-hidden="true">
          <g class="spin-slow" opacity=".55">${ticks(200, 200, 196, 120, 4, 9)}</g>
          <circle cx="200" cy="200" r="186" fill="none" stroke="currentColor" stroke-width=".4" opacity=".35"/>
          <g class="spin-rev" opacity=".35"><circle cx="200" cy="200" r="172" fill="none" stroke="currentColor" stroke-width=".5" stroke-dasharray="1 7"/></g>
        </svg>
        <div class="hero__glow"></div>
        <div class="hero__watch" id="hero-watch"></div>
        ${heroModel ? `<p class="hero__caption"><a href="#/brand/${esc(heroBrand.id)}?model=0">${esc(heroBrand.name)} ${esc(heroModel.name)}</a> · keeping your time</p>` : ''}
      </div>
    </div>
    <div class="stats reveal" id="stats">
      ${stat(brands.length, 'Watch brands')}
      ${stat(countries.length, 'Countries')}
      ${stat(models, 'Iconic models')}
      ${oldest ? stat(oldest.founded, `Oldest house · ${esc(oldest.name)}`, true) : ''}
    </div>
  </div>
</section>

<section class="section wrap" aria-labelledby="h-sections">
  <div class="section-head reveal">
    <div><p class="eyebrow">Eleven ways in</p><h2 class="h2" id="h-sections">Choose your <em>complication</em></h2></div>
  </div>
  <div class="tiles reveal">
    ${SECTIONS().map((s, i) => `<a class="tile" href="#/${s.id}">
      <span class="tile__num">${String(i + 1).padStart(2, '0')}</span>
      <span class="tile__arrow" aria-hidden="true">↗</span>
      <span class="tile__icon" aria-hidden="true"><svg viewBox="0 0 40 40">${ICONS[s.id] || ''}</svg></span>
      <span class="tile__title">${esc(s.label)}</span>
      <p class="tile__blurb">${esc(s.blurb)}</p>
    </a>`).join('')}
  </div>
</section>

${spot ? `<section class="section wrap" aria-labelledby="h-spot">
  <div class="section-head reveal"><div><p class="eyebrow">Brand of the day</p><h2 class="h2" id="h-spot">Today's <em>spotlight</em></h2></div></div>
  <article class="spotlight reveal">
    <div class="spotlight__media">
      <span class="spotlight__date">${new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}</span>
      ${watchSlot(spot.id, spot.models.length ? 0 : -1, { size: 360 })}
    </div>
    <div>
      <p class="eyebrow">${flagImg(spot.countryCode)} ${esc([spot.city, spot.country].filter(Boolean).join(', '))}${spot.founded ? ` · est. ${spot.founded}` : ''}</p>
      <h3 class="spotlight__name">${esc(spot.name)}</h3>
      ${spot.tagline ? `<p class="spotlight__tag">${esc(spot.tagline)}</p>` : ''}
      <p class="muted">${esc(spot.summary || '')}</p>
      <div class="spotlight__meters">
        ${meter('Price tier', spot.priceTier, { color: `var(--tier-${spot.priceTier || 5})` })}
        ${meter('Prestige', spot.prestige)}
        ${meter('Popularity', spot.popularity)}
        ${meter('Value retention', spot.valueRetention)}
      </div>
      <div class="spotlight__actions">
        <a class="btn btn--gold" href="#/brand/${esc(spot.id)}">Read the story</a>
        ${favButton(spot, ctx)}${compareButton(spot, ctx)}
        ${tierBadge(spot.priceTier)}
      </div>
    </div>
  </article>
</section>` : ''}

${rail('holy', 'The Holy Trinity', 'Geneva’s <em>big three</em>', holy.map((b) => brandCard(b, ctx)), '#/explore?sort=prestige')}
${rail('iconic', 'Icons', 'Watches that <em>defined</em> a genre', iconic.map(([m, b]) => modelCard(m, b, ctx)), '#/models')}
${rail('value', 'Best value', 'Serious watches, <em>sensible</em> money', value.map((b) => brandCard(b, ctx)), '#/explore?tier=1-5&sort=value')}
${rail('oldest', 'Oldest houses', 'Centuries of <em>continuous</em> ticking', oldestList.map((b) => brandCard(b, ctx)), '#/explore?sort=founded')}
${rail('indies', 'Independents to know', 'Small houses, <em>outsized</em> reputations', indies.map((b) => brandCard(b, ctx)), '#/explore?group=Independent&sort=prestige')}
`;

    // Live hero watch
    const heroEl = root.querySelector('#hero-watch');
    if (heroEl) {
      const v = heroModel?.visual || ctx.fallbackVisual(heroBrand?.id || 'hero');
      try {
        heroEl.innerHTML = ctx.renderWatch(v, { size: 460, showStrap: true, live: true, title: heroModel ? `${heroBrand.name} ${heroModel.name}, showing the current time` : 'Watch showing the current time' });
        const svg = heroEl.querySelector('svg');
        if (svg) { const stop = ctx.startLiveHands(svg); if (typeof stop === 'function') cleanups.push(stop); }
      } catch (e) { console.warn('hero render failed', e); }
    }

    // Rotating city in the lede
    const rot = root.querySelector('#rotator');
    if (rot && cities.length > 1 && !reducedMotion()) {
      let i = 0;
      const id = setInterval(() => {
        rot.classList.add('is-out');
        setTimeout(() => { i = (i + 1) % cities.length; rot.textContent = cities[i]; rot.classList.remove('is-out'); }, 450);
      }, 2800);
      cleanups.push(() => clearInterval(id));
    }

    // Count-up stats once visible
    const statsEl = root.querySelector('#stats');
    if (statsEl && 'IntersectionObserver' in window && !reducedMotion()) {
      const io = new IntersectionObserver((es) => {
        if (!es.some((e) => e.isIntersecting)) return;
        io.disconnect();
        statsEl.querySelectorAll('[data-to]').forEach((el) => countUp(el));
      }, { threshold: 0.3 });
      io.observe(statsEl);
      cleanups.push(() => io.disconnect());
    } else statsEl?.querySelectorAll('[data-to]').forEach((el) => { el.textContent = el.dataset.fmt === 'year' ? el.dataset.to : fmtNum(+el.dataset.to); });

    // Tile hover glow follows the pointer
    root.querySelectorAll('.tile').forEach((t) => t.addEventListener('pointermove', (e) => {
      const r = t.getBoundingClientRect();
      t.style.setProperty('--mx', `${e.clientX - r.left}px`);
      t.style.setProperty('--my', `${e.clientY - r.top}px`);
    }));

    wireRails(root);
  },
  destroy() {
    cleanups.forEach((f) => { try { f(); } catch { /* noop */ } });
    cleanups = [];
  },
};

function SECTIONS() {
  return [
    { id: 'explore', label: 'Explore', blurb: 'Search and filter every house by origin, price, movement and more.' },
    { id: 'map', label: 'Map', blurb: 'Where watches are made, from the Vallée de Joux to Tokyo.' },
    { id: 'prices', label: 'Price Ladder', blurb: 'From a $20 Casio to a million-dollar complication.' },
    { id: 'timeline', label: 'Timeline', blurb: 'Three centuries of foundings, crises and revivals.' },
    { id: 'groups', label: 'Groups', blurb: 'Who owns whom: Swatch, Richemont, LVMH and the independents.' },
    { id: 'network', label: 'Network', blurb: 'Owners, movement suppliers, designers and lineages, connected.' },
    { id: 'models', label: 'Models', blurb: 'A gallery of iconic references, rendered in fine line.' },
    { id: 'complications', label: 'Complications', blurb: 'From the humble date to the minute repeater: 48 mechanisms, illustrated.' },
    { id: 'finder', label: 'Watch Finder', blurb: 'Answer a few questions and meet your next watch.' },
    { id: 'learn', label: 'Learn', blurb: 'Movements, complications and the vocabulary of horology.' },
    { id: 'compare', label: 'Compare', blurb: 'Put up to four houses side by side on one chart.' },
  ];
}

function stat(n, label, isYear = false) {
  return `<div class="stat"><div class="stat__n" data-to="${n}" data-fmt="${isYear ? 'year' : 'num'}">${isYear ? n : fmtNum(n)}</div><div class="stat__l">${label}</div></div>`;
}

function countUp(el) {
  const to = Number(el.dataset.to);
  const isYear = el.dataset.fmt === 'year';
  const from = isYear ? 2026 : 0;
  const t0 = performance.now();
  const dur = 1400;
  const step = (t) => {
    const p = Math.min(1, (t - t0) / dur);
    const e = 1 - Math.pow(1 - p, 3);
    const v = Math.round(from + (to - from) * e);
    el.textContent = isYear ? String(v) : fmtNum(v);
    if (p < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

function ticks(cx, cy, r, n, short, long) {
  let s = '';
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const len = i % 10 === 0 ? long : short;
    const x1 = cx + Math.sin(a) * r, y1 = cy - Math.cos(a) * r;
    const x2 = cx + Math.sin(a) * (r - len), y2 = cy - Math.cos(a) * (r - len);
    s += `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="currentColor" stroke-width="${i % 10 === 0 ? 1 : 0.5}"/>`;
  }
  return s;
}

function rail(id, eyebrow, title, items, more) {
  if (!items.length) return '';
  return `<section class="section wrap" aria-labelledby="h-${id}">
  <div class="section-head reveal">
    <div><p class="eyebrow">${esc(eyebrow)}</p><h2 class="h2" id="h-${id}">${title}</h2></div>
    <div class="kicker-row">
      <div class="rail-nav"><button type="button" class="icon-btn" data-rail="${id}" data-dir="-1" aria-label="Scroll back"><svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg></button><button type="button" class="icon-btn" data-rail="${id}" data-dir="1" aria-label="Scroll forward"><svg viewBox="0 0 24 24"><path d="M9 5l7 7-7 7"/></svg></button></div>
      <a class="link-more" href="${more}">View all <span aria-hidden="true">→</span></a>
    </div>
  </div>
  <div class="rail" id="rail-${id}" tabindex="0" aria-label="${esc(eyebrow)}">${items.join('')}</div>
</section>`;
}

function wireRails(root) {
  root.querySelectorAll('[data-rail]').forEach((b) => b.addEventListener('click', () => {
    const r = root.querySelector(`#rail-${b.dataset.rail}`);
    if (!r) return;
    r.scrollBy({ left: Number(b.dataset.dir) * r.clientWidth * 0.8, behavior: reducedMotion() ? 'auto' : 'smooth' });
  }));
}
