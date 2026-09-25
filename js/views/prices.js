// The Price Ladder (#/prices) — log-scale price guide, $20 to $5M.
// Mode 1: brand range bars grouped by tier. Mode 2: every model as a dot.
import {
  esc, fmtUSD, TIERS, tierVar, tierOfPrice, SEGMENTS, header, chips, wireChips,
  makeTooltip, allModels, onResize, debounce,
} from './_shared.js';
import { label } from '../lib/util.js';

const LO = 20, HI = 5e6;
const L0 = Math.log(LO), L1 = Math.log(HI);
const pct = p => Math.max(0, Math.min(100, (Math.log(Math.max(LO, Math.min(HI, p))) - L0) / (L1 - L0) * 100));
const TICKS = [20, 50, 100, 250, 500, 1e3, 2500, 5e3, 1e4, 25e3, 5e4, 1e5, 25e4, 5e5, 1e6, 5e6];
const MAJOR = new Set([20, 100, 1e3, 1e4, 1e5, 1e6, 5e6]);
const sliderToPrice = v => { const p = Math.exp(L0 + (L1 - L0) * v / 1000); const m = 10 ** Math.floor(Math.log10(p)); return Math.round(p / m * 4) / 4 * m; };
const priceToSlider = p => Math.round((Math.log(p) - L0) / (L1 - L0) * 1000);

let cleanup = [];

export default {
  title: 'The Price Ladder',
  render(root, ctx) {
    this.destroy();
    const wrap = document.createElement('div');
    wrap.className = 'vw vw-prices';
    root.appendChild(wrap);
    const q = ctx.params || {};
    const state = {
      mode: q.mode === 'models' ? 'models' : 'brands',
      seg: new Set(),
      budget: q.budget ? Math.max(LO, Math.min(HI, +q.budget || 5000)) : null,
    };

    wrap.innerHTML = `
      ${header({ eyebrow: 'Price guide', title: 'The Price <em>Ladder</em>', lede: 'From a twenty-dollar Casio to a five-million-dollar grand complication, every brand on one logarithmic scale. Each step to the right multiplies the price, it doesn’t just add to it.' })}
      <div class="vw-controls">
        <div class="vw-control"><span class="vw-control__label">View</span>
          <div class="vw-seg" role="radiogroup" aria-label="Chart mode">
            <button type="button" role="radio" data-mode="brands" aria-checked="${state.mode === 'brands'}">Brand ranges</button>
            <button type="button" role="radio" data-mode="models" aria-checked="${state.mode === 'models'}">Model prices</button>
          </div></div>
        <div class="vw-control"><span class="vw-control__label">Segment</span>${chips('seg', SEGMENTS.map(s => ({ value: s, label: s })), { label: 'Filter by segment' })}</div>
      </div>
      <div class="vw-budget">
        <label for="vwBudget" class="vw-budget__label">What does your budget buy?</label>
        <div class="vw-budget__row">
          <input id="vwBudget" type="range" min="0" max="1000" step="1" value="${priceToSlider(state.budget || 5000)}" aria-describedby="vwBudgetOut">
          <output id="vwBudgetOut" class="vw-budget__value">${state.budget ? fmtUSD(state.budget, { compact: false }) : 'Slide to set'}</output>
          <button type="button" class="vw-btn vw-btn--small" data-clear ${state.budget ? '' : 'hidden'}>Clear</button>
        </div>
        <p class="vw-budget__summary" aria-live="polite"></p>
        <div class="vw-budget__picks"></div>
      </div>
      <div class="vw-ladder__legend" aria-label="Tier colour legend">${TIERS.map(t => `<span><i style="background:${tierVar(t.tier)}"></i><b>${t.tier}</b> ${t.label}</span>`).join('')}</div>
      <div class="vw-ladder" aria-live="off"></div>`;

    const tip = makeTooltip(wrap);
    const chart = wrap.querySelector('.vw-ladder');
    const slider = wrap.querySelector('#vwBudget');
    const out = wrap.querySelector('#vwBudgetOut');
    const summary = wrap.querySelector('.vw-budget__summary');
    const picks = wrap.querySelector('.vw-budget__picks');
    const clearBtn = wrap.querySelector('[data-clear]');

    const brandsF = () => ctx.brands.filter(b => b.priceRange && (b.priceRange.min || b.priceRange.max) && (!state.seg.size || state.seg.has(b.segment)));

    function axisHTML() {
      return `<div class="vw-axis" aria-hidden="true">${TICKS.map(t => `<span class="vw-axis__t ${MAJOR.has(t) ? 'is-major' : ''} ${t === 20 || t === 1e6 ? 'is-mobhide' : ''}" style="left:${pct(t)}%">${fmtUSD(t)}</span>`).join('')}</div>`;
    }
    function zonesHTML() {
      return `<div class="vw-zones" aria-hidden="true">${TIERS.map(t => `<i style="left:${pct(t.min)}%;width:${pct(t.max) - pct(t.min)}%;--tc:${tierVar(t.tier)}"></i>`).join('')}</div>`;
    }
    const budgetLine = () => state.budget ? `<div class="vw-budgetline" style="left:${pct(state.budget)}%" aria-hidden="true"><span>${fmtUSD(state.budget)}</span></div>` : '';

    // ---------- Brand ranges ----------
    function renderBrands() {
      const list = brandsF();
      const byTier = new Map(TIERS.map(t => [t.tier, []]));
      list.forEach(b => byTier.get(Math.min(10, Math.max(1, b.priceTier || tierOfPrice(b.priceRange.min || b.priceRange.max))))?.push(b));
      let html = `<div class="vw-ladder__head"><div class="vw-ladder__labelcol">Brand</div><div class="vw-ladder__track">${axisHTML()}</div></div>
        <div class="vw-ladder__body"><div class="vw-ladder__bg"><div class="vw-ladder__labelcol"></div><div class="vw-ladder__track">${zonesHTML()}${budgetLine()}</div></div>`;
      for (const t of [...TIERS].reverse()) {
        const rows = byTier.get(t.tier).sort((a, b) => (a.priceRange.min || 0) - (b.priceRange.min || 0) || (a.priceRange.max || 0) - (b.priceRange.max || 0));
        if (!rows.length) continue;
        html += `<section class="vw-tierband" style="--tc:${tierVar(t.tier)}" aria-label="Tier ${t.tier}, ${t.label}">
          <h3 class="vw-tierband__h"><span class="vw-tierband__num">${t.tier}</span><span class="vw-tierband__name">${t.name}</span><span class="vw-tierband__range">${t.label}</span><span class="vw-tierband__count">${rows.length} brand${rows.length > 1 ? 's' : ''}</span></h3>
          ${rows.map(b => brandRow(b, t.tier)).join('')}
        </section>`;
      }
      html += '</div>';
      chart.innerHTML = list.length ? html : `<p class="vw-empty">No brands match these filters.</p>`;
      chart.classList.toggle('has-budget', !!state.budget);
    }
    function brandRow(b, tier) {
      const mn = b.priceRange.min || b.priceRange.max, mx = b.priceRange.max || mn;
      const ok = state.budget ? mn <= state.budget : null;
      const ticks = (b.models || []).filter(m => m.priceUSD).map(m =>
        `<i class="vw-rbar__tick ${state.budget && m.priceUSD <= state.budget ? 'is-ok' : ''}" style="left:${pct(m.priceUSD)}%"></i>`).join('');
      const label = `${b.name}: ${fmtUSD(mn, { compact: false })} to ${fmtUSD(mx, { compact: false })}, tier ${tier}, ${b.segment}${ok === true ? ', within budget' : ''}`;
      return `<a class="vw-rrow ${ok === true ? 'is-ok' : ok === false ? 'is-out' : ''}" href="#/brand/${esc(b.id)}" data-id="${esc(b.id)}" aria-label="${esc(label)}">
        <span class="vw-ladder__labelcol vw-rrow__name">${esc(b.name)}</span>
        <span class="vw-ladder__track"><span class="vw-rbar" style="left:${pct(mn)}%;width:max(6px, ${pct(mx) - pct(mn)}%);--tc:${tierVar(tier)}">${ticks}</span></span>
      </a>`;
    }

    // ---------- Model dots ----------
    function renderModels() {
      const inSeg = allModels(ctx.brands).filter(({ b }) => !state.seg.size || state.seg.has(b.segment));
      const all = inSeg.filter(({ m }) => m.priceUSD);
      const unpriced = inSeg.length - all.length;
      const cats = [...d3group(all, x => x.m.category || 'other')].sort((a, b) => b[1].length - a[1].length);
      const W = chart.clientWidth || 800;
      const mobile = W < 640;
      const labelW = mobile ? 0 : 150;
      const plotW = W - labelW - 8;
      const r = mobile ? 2.6 : 3.4;
      const pad = r * 2 + 0.6;
      let y = 0;
      const rowsSVG = [];
      const dots = [];
      for (const [cat, items] of cats) {
        // beeswarm dodge along x
        const placed = [];
        const sorted = items.map(it => ({ it, x: labelW + pct(it.m.priceUSD) / 100 * plotW })).sort((a, b) => a.x - b.x);
        for (const d of sorted) {
          let off = 0, k = 0;
          const near = placed.filter(p => Math.abs(p.x - d.x) < pad);
          while (near.some(p => Math.abs(p.off - off) < pad && (p.x - d.x) ** 2 + (p.off - off) ** 2 < pad * pad)) { k++; off = Math.ceil(k / 2) * (k % 2 ? 1 : -1) * (pad * 0.9); }
          d.off = off; placed.push(d);
        }
        const ext = Math.max(pad * 2, ...placed.map(p => Math.abs(p.off))) + pad;
        const top = y + (mobile ? 18 : 0);
        const cy = top + ext;
        rowsSVG.push(`<g class="vw-mrow"><line x1="${labelW}" x2="${W}" y1="${cy}" y2="${cy}" class="vw-mrow__line"/>
          <text x="${mobile ? 0 : labelW - 12}" y="${mobile ? top - 6 : cy}" dy="${mobile ? 0 : '0.35em'}" text-anchor="${mobile ? 'start' : 'end'}" class="vw-mrow__label">${esc(label(cat))} <tspan class="vw-mrow__n">${items.length}</tspan></text></g>`);
        placed.forEach(p => dots.push({ ...p, cy: cy + p.off }));
        y = cy + ext + 10;
      }
      const H = y + 8;
      const zones = TIERS.map(t => { const x0 = labelW + pct(t.min) / 100 * plotW, x1 = labelW + pct(t.max) / 100 * plotW; return `<rect x="${x0}" y="0" width="${x1 - x0}" height="${H}" class="vw-mzone" style="--tc:${tierVar(t.tier)}" />`; }).join('');
      const bx = state.budget ? labelW + pct(state.budget) / 100 * plotW : null;
      chart.innerHTML = all.length ? `
        <div class="vw-ladder__head"><div class="vw-ladder__labelcol vw-ladder__labelcol--models" style="--lw:${labelW}px">Category</div><div class="vw-ladder__track">${axisHTML()}</div></div>
        <svg class="vw-msvg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="group" aria-label="${all.length} models plotted by price on a logarithmic scale, grouped by category">
          ${zones}${rowsSVG.join('')}
          ${bx != null ? `<line class="vw-mbudget" x1="${bx}" x2="${bx}" y1="0" y2="${H}"/>` : ''}
          ${dots.map((d, i) => `<circle class="vw-mdot ${state.budget ? (d.it.m.priceUSD <= state.budget ? 'is-ok' : 'is-out') : ''}" cx="${d.x.toFixed(1)}" cy="${d.cy.toFixed(1)}" r="${r}" style="--tc:${tierVar(tierOfPrice(d.it.m.priceUSD))}" data-i="${i}" tabindex="0" role="link" aria-label="${esc(`${d.it.b.name} ${d.it.m.name}, ${fmtUSD(d.it.m.priceUSD, { compact: false })}`)}"/>`).join('')}
        </svg>${unpriced ? `<p class="vw-hint vw-ladder__note">${unpriced} model${unpriced === 1 ? '' : 's'} without a published price ${unpriced === 1 ? 'is' : 'are'} not plotted.</p>` : ''}` : `<p class="vw-empty">No models match these filters.</p>`;
      chart.classList.toggle('has-budget', !!state.budget);
      chart._dots = dots;
      // mobile: the axis track is full width, so align it
      chart.querySelector('.vw-ladder__head')?.style.setProperty('--lw', labelW + 'px');
    }
    function d3group(arr, fn) { const m = new Map(); arr.forEach(x => { const k = fn(x); if (!m.has(k)) m.set(k, []); m.get(k).push(x); }); return m; }

    function render() {
      chart.dataset.mode = state.mode;
      state.mode === 'brands' ? renderBrands() : renderModels();
      renderBudget();
    }

    function renderBudget() {
      clearBtn.hidden = !state.budget;
      if (!state.budget) { summary.textContent = 'Drag the slider to see which houses and models open their doors at your price.'; picks.innerHTML = ''; return; }
      const B = state.budget;
      const bs = brandsF().filter(b => (b.priceRange.min || b.priceRange.max) <= B);
      const ms = allModels(ctx.brands).filter(({ m, b }) => m.priceUSD && m.priceUSD <= B && (!state.seg.size || state.seg.has(b.segment)));
      summary.innerHTML = `With <strong>${fmtUSD(B, { compact: false })}</strong> you can step into <strong>${bs.length}</strong> brand${bs.length === 1 ? '' : 's'} and <strong>${ms.length}</strong> of the catalogued models.`;
      // best models just under budget: highest price ≤ budget, prestige-weighted, one per brand
      const seen = new Set();
      const top = ms.sort((a, b) => b.m.priceUSD - a.m.priceUSD || (b.b.prestige || 0) - (a.b.prestige || 0))
        .filter(x => !seen.has(x.b.id) && seen.add(x.b.id)).slice(0, 6);
      picks.innerHTML = top.length ? `<p class="vw-budget__pickh">Closest to your budget</p><ul>${top.map(({ m, b }) =>
        `<li><a href="#/brand/${esc(b.id)}"><span class="vw-budget__w">${watchMini(m, b)}</span><span><b>${esc(b.name)}</b> ${esc(m.name)}<em>${fmtUSD(m.priceUSD, { compact: false })}</em></span></a></li>`).join('')}</ul>` : '';
    }
    function watchMini(m, b) {
      try { return ctx.renderWatch(m.visual || ctx.fallbackVisual(b.id), { size: 44, showStrap: false, live: false, title: `${b.name} ${m.name}` }); } catch { return ''; }
    }

    // ---------- events ----------
    wireChips(wrap.querySelector('.vw-controls'), (name, set) => { state[name] = set; render(); });
    wrap.querySelectorAll('[data-mode]').forEach(btn => btn.addEventListener('click', () => {
      state.mode = btn.dataset.mode;
      wrap.querySelectorAll('[data-mode]').forEach(b => b.setAttribute('aria-checked', String(b === btn)));
      render();
    }));
    const applyBudget = debounce(render, 60);
    slider.addEventListener('input', () => {
      state.budget = sliderToPrice(+slider.value);
      out.textContent = fmtUSD(state.budget, { compact: false });
      applyBudget();
    });
    clearBtn.addEventListener('click', () => { state.budget = null; out.textContent = 'Slide to set'; render(); });

    chart.addEventListener('mousemove', e => {
      const row = e.target.closest('.vw-rrow');
      if (row) {
        const b = ctx.brandById.get(row.dataset.id); if (!b) return;
        const models = (b.models || []).filter(m => m.priceUSD).sort((x, y) => x.priceUSD - y.priceUSD);
        tip.show(`<strong>${esc(b.name)}</strong>
          <span>${fmtUSD(b.priceRange.min, { compact: false })} – ${fmtUSD(b.priceRange.max, { compact: false })}</span>
          <span class="vw-tip__muted">${[b.priceTier ? `Tier ${b.priceTier}` : null, b.segment, b.country].filter(Boolean).map(esc).join(' · ')}</span>
          ${models.length ? `<span class="vw-tip__list">${models.slice(0, 5).map(m => `<span>${esc(m.name)} <em>${fmtUSD(m.priceUSD)}</em></span>`).join('')}</span>` : ''}`, e.clientX, e.clientY);
        return;
      }
      const dot = e.target.closest('.vw-mdot');
      if (dot) {
        const d = chart._dots[+dot.dataset.i]; const { m, b } = d.it;
        tip.show(`<strong>${esc(m.name)}</strong><span>${esc(b.name)}</span><span>${fmtUSD(m.priceUSD, { compact: false })}</span>
          <span class="vw-tip__muted">${esc(label(m.category || ''))}${m.caseSizeMm ? ` · ${m.caseSizeMm} mm` : ''}${m.caseMaterial ? ` · ${esc(m.caseMaterial)}` : ''}</span>`, e.clientX, e.clientY);
        return;
      }
      tip.hide();
    });
    chart.addEventListener('mouseleave', () => tip.hide());
    const openDot = el => { const d = chart._dots[+el.dataset.i]; ctx.go(`#/brand/${d.it.b.id}?model=${d.it.key.split('::')[1]}`); };
    chart.addEventListener('click', e => { const dot = e.target.closest('.vw-mdot'); if (dot) openDot(dot); });
    chart.addEventListener('keydown', e => { const dot = e.target.closest('.vw-mdot'); if (dot && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); openDot(dot); } });
    chart.addEventListener('focusin', e => {
      const dot = e.target.closest('.vw-mdot'); if (!dot) return;
      const r = dot.getBoundingClientRect(); const d = chart._dots[+dot.dataset.i];
      tip.show(`<strong>${esc(d.it.m.name)}</strong><span>${esc(d.it.b.name)} · ${fmtUSD(d.it.m.priceUSD)}</span>`, r.right, r.bottom);
    });
    chart.addEventListener('focusout', () => tip.hide());

    render();
    cleanup.push(onResize(chart, () => { if (state.mode === 'models') render(); }));
  },
  destroy() { cleanup.forEach(f => f()); cleanup = []; },
};
