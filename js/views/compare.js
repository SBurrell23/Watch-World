import { esc, fmtUSD, flagImg, label, listParam } from '../lib/util.js';
import { tierBadge, watchSlot } from '../components/cards.js';

const COLORS = ['var(--gold)', 'var(--accent)', 'var(--tier-3)', 'var(--tier-9)'];
const AXES = [
  { key: 'priceTier', label: 'Price' },
  { key: 'popularity', label: 'Popularity' },
  { key: 'prestige', label: 'Prestige' },
  { key: 'valueRetention', label: 'Value retention' },
  { key: 'heritage', label: 'Heritage' },
];
const INHOUSE = { yes: 'In-house', partial: 'Partly', no: 'Sourced' };

let off = [];

export default {
  title: 'Compare',
  render(root, ctx) {
    off = [];
    const { brandById, brands } = ctx;
    let ids = listParam(ctx.params.ids).filter((id) => brandById.has(id));
    if (ctx.params.ids == null) ids = ctx.compare.list().filter((id) => brandById.has(id));
    ids = [...new Set(ids)].slice(0, 4);
    // Keep the tray in step with what is on screen.
    const same = ids.length === ctx.compare.list().length && ids.every((id) => ctx.compare.has(id));
    if (!same) ctx.compare.set(ids);

    const sel = ids.map((id) => brandById.get(id));
    const now = new Date().getFullYear();
    const maxAge = Math.max(1, ...brands.map((b) => (b.founded ? now - b.founded : 0)));
    const heritage = (b) => (b.founded ? Math.max(1, Math.min(10, Math.round((Math.sqrt(now - b.founded) / Math.sqrt(maxAge)) * 10))) : null);
    const val = (b, k) => (k === 'heritage' ? heritage(b) : b[k]);

    const popular = [...brands].sort((a, z) => (z.popularity || 0) + (z.prestige || 0) - (a.popularity || 0) - (a.prestige || 0))
      .filter((b) => !ids.includes(b.id)).slice(0, 8);

    const picker = `<div class="cmp-picker">
      <label class="sr-only" for="cmp-add">Add a brand to compare</label>
      <select class="select" id="cmp-add" ${ids.length >= 4 ? 'disabled' : ''}>
        <option value="">${ids.length >= 4 ? 'Compare is full (4 of 4)' : '+ Add a brand…'}</option>
        ${brands.filter((b) => !ids.includes(b.id)).map((b) => `<option value="${esc(b.id)}">${esc(b.name)}</option>`).join('')}
      </select>
      ${ids.length < 4 ? popular.slice(0, ids.length ? 4 : 8).map((b) => `<button type="button" class="chip" data-compare="${esc(b.id)}" aria-pressed="false">+ ${esc(b.name)}</button>`).join('') : ''}
      ${ids.length ? '<button type="button" class="clear-all" id="cmp-clear">Clear all</button>' : ''}
    </div>`;

    if (!sel.length) {
      root.innerHTML = `<div class="wrap"><header class="page-head"><p class="eyebrow">Side by side</p><h1 class="display">Compare <em>houses</em></h1>
        <p class="lede">Choose up to four brands to see how they measure up on price, popularity, prestige, value retention and heritage. Use the scales icon on any card, or start here.</p></header>
        ${picker}
        <div class="empty"><p class="h3">Nothing to compare yet</p><p>Add at least two brands to draw the chart.</p><a class="btn" href="#/explore">Browse brands</a></div></div>`;
      wire(root, ctx);
      return;
    }

    const cols = `style="--n:${sel.length}"`;
    const best = (k, dir = 1) => {
      const vs = sel.map((b) => val(b, k)).filter((v) => v != null);
      if (sel.length < 2 || !vs.length) return null;
      return dir > 0 ? Math.max(...vs) : Math.min(...vs);
    };
    const row = (name, fn, { k, dir } = {}) => {
      const bv = k ? best(k, dir) : null;
      return `<tr><th scope="row">${esc(name)}</th>${sel.map((b) => {
        const v = k ? val(b, k) : null;
        return `<td class="${bv != null && v === bv ? 'best' : ''}">${fn(b) ?? '—'}</td>`;
      }).join('')}</tr>`;
    };
    const score = (k) => (b) => (val(b, k) == null ? '—' : `<span class="serif" style="font-size:1.2rem">${val(b, k)}</span><span class="muted">/10</span>`);

    root.innerHTML = `
<div class="wrap">
  <header class="page-head">
    <p class="eyebrow">Side by side</p>
    <h1 class="display">${sel.map((b) => esc(b.name)).join(' <em>vs</em> ')}</h1>
  </header>
  ${picker}

  <div class="cmp-cols" ${cols}>
    ${sel.map((b, i) => `<div class="cmp-head reveal" style="--sc:${COLORS[i]};--d:${i * 70}ms">
      <button type="button" class="tray__x" data-compare="${esc(b.id)}" aria-pressed="true" aria-label="Remove ${esc(b.name)}">×</button>
      ${watchSlot(b.id, b.models.length ? 0 : -1, { size: 200 })}
      <h2><a href="#/brand/${esc(b.id)}">${esc(b.name)}</a></h2>
      <p>${flagImg(b.countryCode)} ${esc([b.city, b.country].filter(Boolean).join(', '))}</p>
      <p style="margin-top:.6rem">${tierBadge(b.priceTier)}</p>
    </div>`).join('')}
  </div>

  <section class="radar-wrap reveal" aria-labelledby="h-radar">
    <div>
      <h2 class="sr-only" id="h-radar">Radar chart</h2>
      ${radar(sel, val)}
    </div>
    <div>
      <p class="eyebrow">Profile</p>
      <ul class="radar-legend">
        ${sel.map((b, i) => `<li><button type="button" data-hi="${i}"><span class="cmp-swatch" style="--sc:${COLORS[i]}"></span><span><span class="nm">${esc(b.name)}</span><span class="sub">${AXES.map((a) => `${a.label.split(' ')[0]} ${val(b, a.key) ?? '–'}`).join(' · ')}</span></span></button></li>`).join('')}
      </ul>
      <p class="small muted" style="margin-top:1rem">All axes are 1–10. Heritage scales with age (square root), so the oldest house scores 10.</p>
    </div>
  </section>

  <section aria-labelledby="h-specs">
    <div class="section-head reveal"><div><p class="eyebrow">The details</p><h2 class="h2" id="h-specs">Specification</h2></div></div>
    <div class="cmp-table-wrap reveal">
      <table class="cmp-table">
        <thead><tr><th scope="col"><span class="sr-only">Attribute</span></th>${sel.map((b, i) => `<th scope="col"><span class="cmp-swatch" style="--sc:${COLORS[i]}"></span>${esc(b.name)}</th>`).join('')}</tr></thead>
        <tbody>
          ${row('Founded', (b) => (b.founded ? `${b.founded}` : null), { k: 'founded', dir: -1 })}
          ${row('Headquarters', (b) => esc([b.city, b.country].filter(Boolean).join(', ')))}
          ${row('Group', (b) => esc(b.parentGroup))}
          ${row('Segment', (b) => esc(b.segment))}
          ${row('Price tier', (b) => (b.priceTier ? `${tierBadge(b.priceTier)}` : null))}
          ${row('Price range', (b) => (b.priceRange.min || b.priceRange.max ? `${fmtUSD(b.priceRange.min)} – ${fmtUSD(b.priceRange.max)}` : null))}
          ${row('Popularity', score('popularity'), { k: 'popularity', dir: 1 })}
          ${row('Prestige', score('prestige'), { k: 'prestige', dir: 1 })}
          ${row('Value retention', score('valueRetention'), { k: 'valueRetention', dir: 1 })}
          ${row('Movements', (b) => `${INHOUSE[b.inHouseMovements] || '—'}${b.movementTypes.length ? `<br><span class="muted small">${esc(b.movementTypes.map(label).join(', '))}</span>` : ''}`)}
          ${row('Specialties', (b) => esc(b.specialties.map(label).join(', ')) || null)}
          ${row('Production', (b) => esc(b.annualProduction || '') || null)}
          ${row('Known for', (b) => esc(b.knownFor || '') || null)}
        </tbody>
      </table>
    </div>
  </section>

  <section class="section" aria-labelledby="h-cmodels">
    <div class="section-head reveal"><div><p class="eyebrow">On the wrist</p><h2 class="h2" id="h-cmodels">Signature <em>models</em></h2></div></div>
    <div class="cmp-models" ${cols}>
      ${sel.map((b) => `<div class="col">${b.models.slice(0, 4).map((m, i) => `<a class="cmp-mini" href="#/brand/${esc(b.id)}?model=${i}">
        ${watchSlot(b.id, i, { size: 120, strap: false })}
        <span><strong>${esc(m.name)}</strong><small>${[m.priceUSD ? fmtUSD(m.priceUSD) : 'Price on request', m.caseSizeMm ? `${m.caseSizeMm} mm` : null].filter(Boolean).join(' · ')}</small></span>
      </a>`).join('') || '<p class="muted small">No models listed.</p>'}</div>`).join('')}
    </div>
  </section>
</div>`;

    // Legend highlight
    const shapes = root.querySelectorAll('.radar .shape');
    root.querySelectorAll('[data-hi]').forEach((btn) => {
      const i = Number(btn.dataset.hi);
      const on = () => shapes.forEach((s, j) => { s.classList.toggle('hi', j === i); s.classList.toggle('dim', j !== i); });
      const offFn = () => shapes.forEach((s) => s.classList.remove('hi', 'dim'));
      btn.addEventListener('mouseenter', on); btn.addEventListener('focus', on);
      btn.addEventListener('mouseleave', offFn); btn.addEventListener('blur', offFn);
    });
    wire(root, ctx);
  },
  destroy() { off.forEach((f) => f()); off = []; },
};

function wire(root, ctx) {
  const add = root.querySelector('#cmp-add');
  add?.addEventListener('change', () => { if (add.value) ctx.compare.toggle(add.value); });
  root.querySelector('#cmp-clear')?.addEventListener('click', () => ctx.compare.clear());
  const onChange = () => ctx.go(`#/compare?ids=${ctx.compare.list().map(encodeURIComponent).join(',')}`);
  window.addEventListener('ww:compare', onChange);
  off.push(() => window.removeEventListener('ww:compare', onChange));
}

function radar(sel, val) {
  const C = 200; const R = 150; const n = AXES.length;
  const pt = (i, v) => {
    const a = -Math.PI / 2 + (i / n) * Math.PI * 2;
    return [C + Math.cos(a) * R * (v / 10), C + Math.sin(a) * R * (v / 10)];
  };
  let g = '';
  for (let r = 2; r <= 10; r += 2) {
    g += `<polygon class="ring ${r === 10 ? 'outer' : ''}" points="${AXES.map((_, i) => pt(i, r).join(',')).join(' ')}"/>`;
  }
  AXES.forEach((a, i) => {
    const [x, y] = pt(i, 10);
    const [lx, ly] = pt(i, 11.8);
    g += `<line class="spoke" x1="${C}" y1="${C}" x2="${x}" y2="${y}"/>`;
    const anchor = Math.abs(lx - C) < 8 ? 'middle' : lx > C ? 'start' : 'end';
    g += `<text class="axis-label" x="${lx}" y="${ly}" text-anchor="${anchor}" dominant-baseline="middle">${esc(a.label)}</text>`;
  });
  sel.forEach((b, j) => {
    const pts = AXES.map((a, i) => pt(i, val(b, a.key) ?? 0));
    g += `<polygon class="shape" points="${pts.map((p) => p.join(',')).join(' ')}" style="fill:${COLORS[j]};stroke:${COLORS[j]}"><title>${esc(b.name)}</title></polygon>`;
    g += pts.map((p) => `<circle class="pt" cx="${p[0]}" cy="${p[1]}" r="3.5" style="fill:${COLORS[j]}"/>`).join('');
  });
  const summary = sel.map((b) => `${b.name}: ${AXES.map((a) => `${a.label} ${val(b, a.key) ?? 'unknown'}`).join(', ')}`).join('. ');
  return `<svg class="radar" viewBox="-70 -10 540 420" role="img" aria-label="Radar chart. ${esc(summary)}">${g}</svg>`;
}

