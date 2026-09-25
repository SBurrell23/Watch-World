// World Map (#/map) — D3 atlas of watch brands with country shading,
// screen-space clustered markers, zoom presets, filters and side panel.
import {
  loadD3, loadTopojson, loadWorld, loadCards, esc, fmtUSD, TIERS, tierVar, SEGMENTS,
  header, chips, wireChips, makeTooltip, onResize, watchSVG, loadingHTML, prefersReducedMotion,
} from './_shared.js';

// ISO alpha-2 -> ISO numeric (world-atlas feature ids)
const A2N = { CH: 756, FR: 250, DE: 276, IT: 380, GB: 826, US: 840, JP: 392, CN: 156, IN: 356, RU: 643, AU: 36, CA: 124, NL: 528, DK: 208, SE: 752, FI: 246, NO: 578, AT: 40, BE: 56, ES: 724, PT: 620, PL: 616, CZ: 203, UA: 804, HK: 344, SG: 702, KR: 410, TW: 158, TH: 764, MY: 458, ID: 360, PH: 608, VN: 704, AE: 784, IL: 376, TR: 792, BR: 76, AR: 32, MX: 484, ZA: 710, NZ: 554, IE: 372, MC: 492, LI: 438, LU: 442, HU: 348, GR: 300, RO: 642, CL: 152, CO: 170, NG: 566, EG: 818, KE: 404, BY: 112, LT: 440, LV: 428, EE: 233, SK: 703, SI: 705, HR: 191, PK: 586, BD: 50, SA: 682, QA: 634, IS: 352, RS: 688, BG: 100, PE: 604, VE: 862, KZ: 398, GH: 288, MA: 504, TN: 788, LK: 144, NP: 524, MN: 496, KP: 408 };
const pad3 = n => String(n).padStart(3, '0');

const PRESETS = [
  { id: 'world', label: 'World', b: null },
  { id: 'europe', label: 'Europe', b: [[-11, 36], [32, 61]] },
  { id: 'swiss', label: 'Switzerland', b: [[5.9, 45.8], [10.5, 47.85]] },
  { id: 'jura', label: 'Jura Arc & Geneva', b: [[5.95, 46.1], [7.7, 47.3]] },
  { id: 'japan', label: 'Japan', b: [[129, 30.5], [146, 45.5]] },
  { id: 'asia', label: 'Asia', b: [[60, -8], [150, 55]] },
  { id: 'na', label: 'North America', b: [[-128, 14], [-60, 56]] },
  { id: 'sa', label: 'South America', b: [[-82, -56], [-34, 13]] },
  { id: 'oceania', label: 'Oceania', b: [[112, -47], [179, -9]] },
  { id: 'africa', label: 'Africa', b: [[-18, -35], [52, 37]] },
];

const BINS = [
  { min: 1, max: 1, label: '1' },
  { min: 2, max: 3, label: '2–3' },
  { min: 4, max: 9, label: '4–9' },
  { min: 10, max: 29, label: '10–29' },
  { min: 30, max: Infinity, label: '30+' },
];
const binMix = [16, 30, 46, 64, 84];
const binFill = i => `color-mix(in oklab, var(--gold) ${binMix[i]}%, var(--surface-2))`;
const binOf = n => BINS.findIndex(b => n >= b.min && n <= b.max);

let cleanup = [];

export default {
  title: 'World Map',
  async render(root, ctx) {
    this.destroy();
    const wrap = document.createElement('div');
    wrap.className = 'vw vw-map';
    root.appendChild(wrap);

    const state = { seg: new Set(), tier: new Set(), selCountry: null, selBrand: null };

    wrap.innerHTML = `
      ${header({ eyebrow: 'Atlas', title: 'The World of <em>Watchmaking</em>', lede: 'Where the world’s watch houses make their home — from the snowbound valleys of the Jura to Tokyo, Glashütte and beyond. Zoom into the dense Swiss heartland, or tap a country to meet its makers.' })}
      <div class="vw-controls">
        <div class="vw-control"><span class="vw-control__label">Segment</span>${chips('seg', SEGMENTS.map(s => ({ value: s, label: s })), { label: 'Filter by segment' })}</div>
        <div class="vw-control"><span class="vw-control__label">Price tier</span>${chips('tier', TIERS.map(t => ({ value: String(t.tier), label: String(t.tier), swatch: tierVar(t.tier) })), { label: 'Filter by price tier' })}</div>
        <div class="vw-control"><span class="vw-control__label">Jump to</span>
          <div class="vw-chips" role="group" aria-label="Zoom presets">${PRESETS.map(p => `<button type="button" class="vw-chip vw-chip--ghost" data-preset="${p.id}">${p.label}</button>`).join('')}</div>
        </div>
      </div>
      <p class="vw-stats" aria-live="polite"></p>
      <div class="vw-map__stage">
        <div class="vw-map__canvas">${loadingHTML('Drawing the atlas')}</div>
        <div class="vw-map__zoom" role="group" aria-label="Map zoom">
          <button type="button" data-z="in" aria-label="Zoom in">+</button>
          <button type="button" data-z="out" aria-label="Zoom out">−</button>
          <button type="button" data-z="reset" aria-label="Reset view">⟲</button>
        </div>
        <div class="vw-map__legend" aria-label="Legend">
          <div class="vw-legend__title">Brands per country</div>
          <div class="vw-legend__ramp">${BINS.map((b, i) => `<span><i style="background:${binFill(i)}"></i>${b.label}</span>`).join('')}</div>
          <div class="vw-legend__title">Markers</div>
          <div class="vw-legend__marks"><span><i class="vw-dot"></i>Brand HQ (tier colour)</span><span><i class="vw-dot vw-dot--cluster">3</i>Cluster — click to zoom</span></div>
        </div>
        <aside class="vw-panel" hidden aria-live="polite"></aside>
      </div>
      <section class="vw-map__list">
        <h2 class="vw-h2">Countries by number of brands</h2>
        <ol class="vw-countrylist"></ol>
      </section>`;

    const tip = makeTooltip(wrap);
    const canvas = wrap.querySelector('.vw-map__canvas');
    const panel = wrap.querySelector('.vw-panel');
    const statsEl = wrap.querySelector('.vw-stats');
    const listEl = wrap.querySelector('.vw-countrylist');

    let d3, topo, world, cards;
    try {
      [d3, topo, world, cards] = await Promise.all([loadD3(), loadTopojson(), loadWorld(), loadCards()]);
    } catch (e) {
      canvas.innerHTML = `<p class="vw-error">The map could not be loaded (${esc(e.message)}). Check your connection and try again.</p>`;
      return;
    }
    if (!wrap.isConnected) return;

    const countries = topo.feature(world, world.objects.countries).features;
    const featById = new Map(countries.map(f => [f.id, f]));

    const filtered = () => ctx.brands.filter(b =>
      (!state.seg.size || state.seg.has(b.segment)) &&
      (!state.tier.size || state.tier.has(String(b.priceTier))) &&
      Number.isFinite(b.lat) && Number.isFinite(b.lng));

    // country aggregation by countryCode
    function aggregate(brands) {
      const m = new Map();
      for (const b of brands) {
        const k = b.countryCode || b.country;
        if (!m.has(k)) m.set(k, { code: b.countryCode, name: b.country, brands: [] });
        m.get(k).brands.push(b);
      }
      return m;
    }

    let svg, gMap, gMarks, zoom, projection, path, width, height, transform = d3.zoomIdentity;
    let agg = new Map(), brandsNow = [];

    function build() {
      width = canvas.clientWidth || 800;
      const mobile = width < 640;
      height = Math.round(width * (mobile ? 0.72 : 0.52));
      projection = d3.geoNaturalEarth1().fitExtent([[6, 6], [width - 6, height - 6]], { type: 'Sphere' });
      if (mobile) projection.scale(projection.scale() * 1.3).translate([width * 0.5, height * 0.56]);
      path = d3.geoPath(projection);

      canvas.innerHTML = '';
      svg = d3.select(canvas).append('svg')
        .attr('viewBox', `0 0 ${width} ${height}`).attr('width', width).attr('height', height)
        .attr('role', 'application').attr('aria-label', 'World map of watch brands. Use the country list below the map for keyboard-friendly navigation.');
      const defs = svg.append('defs');
      const glow = defs.append('filter').attr('id', 'vwGlow').attr('x', '-100%').attr('y', '-100%').attr('width', '300%').attr('height', '300%');
      glow.append('feGaussianBlur').attr('stdDeviation', 3.2).attr('result', 'b');
      const fm = glow.append('feMerge'); fm.append('feMergeNode').attr('in', 'b'); fm.append('feMergeNode').attr('in', 'SourceGraphic');

      gMap = svg.append('g').attr('class', 'vw-map__geo');
      gMap.append('path').datum({ type: 'Sphere' }).attr('class', 'vw-map__sphere').attr('d', path);
      gMap.append('path').datum(d3.geoGraticule10()).attr('class', 'vw-map__grat').attr('d', path);
      gMap.selectAll('path.vw-map__country').data(countries, d => d.id).join('path')
        .attr('class', 'vw-map__country').attr('d', path)
        .on('mousemove', (e, d) => countryTip(e, d))
        .on('mouseleave', () => tip.hide())
        .on('click', (e, d) => { const a = aggFor(d); if (a) openCountry(a); })
        .on('keydown', (e, d) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); const a = aggFor(d); if (a) openCountry(a); } });
      gMarks = svg.append('g').attr('class', 'vw-map__marks');

      zoom = d3.zoom().scaleExtent([1, 420])
        .translateExtent([[-width * 0.2, -height * 0.2], [width * 1.2, height * 1.2]])
        .filter(e => (!e.ctrlKey || e.type === 'wheel') && !e.button)
        .on('zoom', e => { transform = e.transform; gMap.attr('transform', transform); gMap.style('--k', transform.k); drawMarkers(); tip.hide(); });
      svg.call(zoom).on('dblclick.zoom', null);
      svg.call(zoom.transform, transform);
      paint();
    }

    const aggFor = d => {
      for (const a of agg.values()) if (a.code && pad3(A2N[a.code] ?? -1) === d.id) return a;
      return null;
    };

    function paint() {
      brandsNow = filtered();
      agg = aggregate(brandsNow);
      const idToAgg = new Map();
      for (const a of agg.values()) if (a.code && A2N[a.code] != null) idToAgg.set(pad3(A2N[a.code]), a);
      gMap.selectAll('path.vw-map__country')
        .classed('has-brands', d => idToAgg.has(d.id))
        .classed('is-selected', d => state.selCountry && idToAgg.get(d.id)?.code === state.selCountry)
        .attr('tabindex', d => idToAgg.has(d.id) ? 0 : null)
        .attr('role', d => idToAgg.has(d.id) ? 'button' : null)
        .attr('aria-label', d => { const a = idToAgg.get(d.id); return a ? `${a.name}: ${a.brands.length} brand${a.brands.length > 1 ? 's' : ''}` : null; })
        .style('fill', d => { const a = idToAgg.get(d.id); return a ? binFill(binOf(a.brands.length)) : null; });
      drawMarkers();
      // stats + list
      const sorted = [...agg.values()].sort((a, b) => b.brands.length - a.brands.length);
      statsEl.innerHTML = `<strong>${brandsNow.length}</strong> brands across <strong>${agg.size}</strong> countries${sorted[0] ? ` · ${esc(sorted[0].name)} leads with <strong>${sorted[0].brands.length}</strong>` : ''}`;
      const max = sorted[0]?.brands.length || 1;
      listEl.innerHTML = sorted.map(a => `<li><button type="button" data-code="${esc(a.code || a.name)}">
        <span class="vw-countrylist__name">${esc(a.name)}</span>
        <span class="vw-countrylist__bar"><i style="width:${(a.brands.length / max) * 100}%"></i></span>
        <span class="vw-countrylist__n">${a.brands.length}</span></button></li>`).join('') || '<li class="vw-empty">No brands match these filters.</li>';
    }

    function countryTip(e, d) {
      const a = aggFor(d);
      const name = a?.name || d.properties?.name || '';
      if (!a) { tip.show(`<strong>${esc(name)}</strong><span class="vw-tip__muted">No brands in view</span>`, e.clientX, e.clientY); return; }
      const top = [...a.brands].sort((x, y) => (y.popularity || 0) - (x.popularity || 0)).slice(0, 5).map(b => esc(b.name)).join(', ');
      tip.show(`<strong>${esc(name)}</strong><span>${a.brands.length} brand${a.brands.length > 1 ? 's' : ''}</span><span class="vw-tip__muted">${top}${a.brands.length > 5 ? '…' : ''}</span>`, e.clientX, e.clientY);
    }

    function clusters() {
      const pts = brandsNow.map(b => {
        const p = projection([b.lng, b.lat]);
        return p ? { b, x: transform.applyX(p[0]), y: transform.applyY(p[1]) } : null;
      }).filter(Boolean).sort((a, b) => (b.b.popularity || 0) - (a.b.popularity || 0));
      const R = width < 640 ? 20 : 17;
      const out = [];
      for (const p of pts) {
        let c = null;
        for (const q of out) if ((q.x - p.x) ** 2 + (q.y - p.y) ** 2 < R * R) { c = q; break; }
        if (c) c.items.push(p); else out.push({ x: p.x, y: p.y, items: [p] });
      }
      for (const c of out) {
        c.x = d3.mean(c.items, i => i.x); c.y = d3.mean(c.items, i => i.y);
        c.key = c.items.map(i => i.b.id).sort().join('|');
      }
      return out.filter(c => c.x > -30 && c.y > -30 && c.x < width + 30 && c.y < height + 30);
    }

    function drawMarkers() {
      if (!gMarks) return;
      const cs = clusters();
      const sel = gMarks.selectAll('g.vw-mk').data(cs, d => d.key);
      sel.exit().remove();
      const enter = sel.enter().append('g').attr('class', 'vw-mk').attr('tabindex', 0).attr('role', 'button')
        .on('mousemove', (e, d) => markerTip(e, d)).on('mouseleave', () => tip.hide())
        .on('click', (e, d) => markerClick(d))
        .on('keydown', (e, d) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); markerClick(d); } })
        .on('focus', function (e, d) { const r = this.getBoundingClientRect(); markerTip({ clientX: r.right, clientY: r.top }, d); })
        .on('blur', () => tip.hide());
      enter.each(function (d) {
        const g = d3.select(this);
        const n = d.items.length;
        if (n === 1) {
          const b = d.items[0].b;
          g.append('circle').attr('class', 'vw-mk__halo').attr('r', 9).style('fill', tierVar(b.priceTier));
          g.append('circle').attr('class', 'vw-mk__core').attr('r', 4.2).style('fill', tierVar(b.priceTier));
          g.append('text').attr('class', 'vw-mk__label').attr('x', 9).attr('dy', '0.35em').text(b.name);
        } else {
          const r = Math.min(8 + Math.sqrt(n) * 3.2, 22);
          g.append('circle').attr('class', 'vw-mk__halo vw-mk__halo--c').attr('r', r + 5);
          g.append('circle').attr('class', 'vw-mk__cluster').attr('r', r);
          g.append('text').attr('class', 'vw-mk__n').attr('dy', '0.35em').text(n);
        }
      });
      enter.merge(sel)
        .attr('transform', d => `translate(${d.x.toFixed(1)},${d.y.toFixed(1)})`)
        .classed('is-selected', d => state.selBrand && d.items.some(i => i.b.id === state.selBrand))
        .call(s => s.select('.vw-mk__label').style('display', transform.k >= 8 ? null : 'none'))
        .attr('aria-label', d => d.items.length === 1
          ? `${d.items[0].b.name}, ${d.items[0].b.city || d.items[0].b.country}. Press Enter to preview.`
          : `Cluster of ${d.items.length} brands: ${d.items.slice(0, 6).map(i => i.b.name).join(', ')}. Press Enter to zoom.`);
    }

    function markerTip(e, d) {
      if (d.items.length === 1) {
        const b = d.items[0].b;
        tip.show(`<strong>${esc(b.name)}</strong><span>${esc(b.city || '')}${b.city ? ', ' : ''}${esc(b.country)}</span>
          <span class="vw-tip__muted">${[b.founded ? `Founded ${b.founded}` : null, esc(b.segment || ''), b.priceRange?.min ? `${fmtUSD(b.priceRange.min)}–${fmtUSD(b.priceRange.max)}` : null].filter(Boolean).join(' · ')}</span>`, e.clientX, e.clientY);
      } else {
        const cities = [...new Set(d.items.map(i => i.b.city).filter(Boolean))];
        tip.show(`<strong>${d.items.length} brands</strong><span class="vw-tip__muted">${esc(cities.slice(0, 4).join(' · '))}${cities.length > 4 ? '…' : ''}</span>
          <span>${d.items.slice(0, 8).map(i => esc(i.b.name)).join(', ')}${d.items.length > 8 ? '…' : ''}</span>`, e.clientX, e.clientY);
      }
    }

    function markerClick(d) {
      tip.hide();
      if (d.items.length === 1) return openBrand(d.items[0].b);
      // zoom to fit the cluster; if the brands share a point (same city), list them
      const xs = d.items.map(i => projection([i.b.lng, i.b.lat]));
      const [x0, x1] = d3.extent(xs, p => p[0]), [y0, y1] = d3.extent(xs, p => p[1]);
      const span = Math.max(x1 - x0, y1 - y0);
      const k = Math.min(420, 0.5 * Math.min(width, height) / Math.max(span, 0.001));
      if (span < 0.02 || k <= transform.k * 1.15) return openList(`${d.items[0].b.city || 'This area'}`, d.items.map(i => i.b), 'Shared headquarters');
      zoomTo(x0, y0, x1, y1, 0.5);
    }

    function zoomTo(x0, y0, x1, y1, frac = 0.85) {
      const k = Math.min(420, frac / Math.max((x1 - x0) / width, (y1 - y0) / height, 1e-6));
      const t = d3.zoomIdentity.translate(width / 2, height / 2).scale(Math.max(1, k)).translate(-(x0 + x1) / 2, -(y0 + y1) / 2);
      svg.transition().duration(prefersReducedMotion() ? 0 : 900).ease(d3.easeCubicInOut).call(zoom.transform, t);
    }

    function preset(id) {
      const p = PRESETS.find(x => x.id === id);
      wrap.querySelectorAll('[data-preset]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.preset === id)));
      if (!p.b) return svg.transition().duration(prefersReducedMotion() ? 0 : 900).call(zoom.transform, d3.zoomIdentity);
      const [[lo0, la0], [lo1, la1]] = p.b;
      const pts = [[lo0, la0], [lo1, la1], [lo0, la1], [lo1, la0], [(lo0 + lo1) / 2, la0], [(lo0 + lo1) / 2, la1]].map(q => projection(q));
      zoomTo(d3.min(pts, q => q[0]), d3.min(pts, q => q[1]), d3.max(pts, q => q[0]), d3.max(pts, q => q[1]));
    }

    // ----- side panel -----
    function showPanel(html) {
      panel.innerHTML = `<button type="button" class="vw-panel__close" aria-label="Close panel">×</button>${html}`;
      panel.hidden = false;
      panel.querySelector('.vw-panel__close').onclick = closePanel;
      requestAnimationFrame(() => panel.classList.add('is-open'));
      if (window.innerWidth < 900) panel.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'nearest' });
    }
    function closePanel() {
      panel.classList.remove('is-open'); panel.hidden = true;
      state.selCountry = null; state.selBrand = null; paint();
    }
    function openCountry(a) {
      state.selCountry = a.code; state.selBrand = null; paint();
      const list = [...a.brands].sort((x, y) => (y.popularity || 0) - (x.popularity || 0));
      showPanel(`<p class="vw-eyebrow">Country</p><h2 class="vw-panel__title">${esc(a.name)}</h2>
        <p class="vw-panel__meta">${list.length} brand${list.length > 1 ? 's' : ''}${filterNote()}</p>
        <div class="vw-panel__cards">${list.map(b => cards.brandCard(b, ctx)).join('')}</div>`);
    }
    function openList(title, list, eyebrow) {
      showPanel(`<p class="vw-eyebrow">${esc(eyebrow)}</p><h2 class="vw-panel__title">${esc(title)}</h2>
        <p class="vw-panel__meta">${list.length} brands</p>
        <div class="vw-panel__cards">${list.map(b => cards.brandCard(b, ctx)).join('')}</div>`);
    }
    function openBrand(b) {
      state.selBrand = b.id; state.selCountry = null; paint();
      const m = (b.models || [])[0];
      showPanel(`<p class="vw-eyebrow">${esc(b.city || '')}${b.city ? ', ' : ''}${esc(b.country)}</p>
        <h2 class="vw-panel__title">${esc(b.name)}</h2>
        ${b.tagline ? `<p class="vw-panel__tag">${esc(b.tagline)}</p>` : ''}
        <div class="vw-panel__watch">${watchSVG(ctx, m, b, { size: 180 })}</div>
        <dl class="vw-dl">
          <div><dt>Founded</dt><dd>${b.founded ?? '—'}</dd></div>
          <div><dt>Segment</dt><dd>${esc(b.segment)}</dd></div>
          <div><dt>Group</dt><dd>${esc(b.parentGroup || '—')}</dd></div>
          <div><dt>Prices</dt><dd>${fmtUSD(b.priceRange?.min)} – ${fmtUSD(b.priceRange?.max)}</dd></div>
          <div><dt>Tier</dt><dd>${cards.tierBadge(b.priceTier)}</dd></div>
        </dl>
        ${b.knownFor ? `<p class="vw-panel__known"><span>Known for</span> ${esc(b.knownFor)}</p>` : ''}
        <div class="vw-panel__actions">
          <a class="vw-btn vw-btn--gold" href="#/brand/${esc(b.id)}">Open brand page</a>
          <button type="button" class="vw-btn" data-country="${esc(b.countryCode || b.country)}">All in ${esc(b.country)}</button>
        </div>`);
      panel.querySelector('[data-country]').onclick = e => { const a = agg.get(e.currentTarget.dataset.country); if (a) openCountry(a); };
    }
    const filterNote = () => (state.seg.size || state.tier.size) ? ' matching your filters' : '';

    // ----- wiring -----
    wireChips(wrap.querySelector('.vw-controls'), (name, set) => { state[name] = set; paint(); });
    wrap.querySelectorAll('[data-preset]').forEach(b => b.addEventListener('click', () => preset(b.dataset.preset)));
    wrap.querySelector('.vw-map__zoom').addEventListener('click', e => {
      const z = e.target.closest('button')?.dataset.z; if (!z) return;
      if (z === 'reset') return preset('world');
      svg.transition().duration(350).call(zoom.scaleBy, z === 'in' ? 1.8 : 1 / 1.8);
    });
    listEl.addEventListener('click', e => {
      const code = e.target.closest('button')?.dataset.code; if (!code) return;
      const a = agg.get(code); if (!a) return;
      openCountry(a);
      const f = a.code && featById.get(pad3(A2N[a.code]));
      if (f) { const [[x0, y0], [x1, y1]] = path.bounds(f); zoomTo(x0, y0, x1, y1, 0.6); }
      else { const b = a.brands[0]; const p = projection([b.lng, b.lat]); zoomTo(p[0] - 4, p[1] - 4, p[0] + 4, p[1] + 4, 0.5); }
      wrap.querySelector('.vw-map__stage').scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' });
    });
    const onKey = e => { if (e.key === 'Escape' && !panel.hidden) closePanel(); };
    document.addEventListener('keydown', onKey);
    cleanup.push(() => document.removeEventListener('keydown', onKey));

    build();
    cleanup.push(onResize(canvas, () => { transform = d3.zoomIdentity; build(); }));
    if (ctx.params?.country) { const a = agg.get(ctx.params.country); if (a) openCountry(a); }
  },
  destroy() { cleanup.forEach(f => f()); cleanup = []; },
};
