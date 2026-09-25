// Timeline of Horology (#/timeline) — zoomable horizontal timeline of brand
// foundings over era bands, an event-density strip, and a chronicle list.
import { loadD3, esc, SEGMENTS, header, chips, wireChips, makeTooltip, onResize, loadingHTML, prefersReducedMotion, debounce } from './_shared.js';

export const ERAS = [
  { id: 'enlightenment', start: 1700, end: 1799, row: 0, name: 'Age of Enlightenment', caption: 'Cabinotiers in Geneva and farmer-craftsmen of the Jura refine the pocket watch; Breguet, Blancpain and Vacheron lay the foundations of fine watchmaking and the lever escapement is born.' },
  { id: 'manufactures', start: 1800, end: 1849, row: 0, name: 'Rise of the manufactures', caption: 'Post-revolution Europe industrialises craft. Houses such as Patek Philippe, Jaeger-LeCoultre and Lange consolidate the many trades of watchmaking under one roof.' },
  { id: 'industrial', start: 1850, end: 1913, row: 0, name: 'Industrialisation & American mass production', caption: 'Waltham and Elgin pioneer interchangeable parts and machine-made movements. Railways demand accuracy; the Swiss respond by mechanising their own valleys.' },
  { id: 'wristwatch', start: 1914, end: 1945, row: 0, name: 'Wristwatch era & the World Wars', caption: 'Trench warfare turns the "wristlet" from a lady’s bracelet into a soldier’s tool. Waterproof cases, luminous dials and the automatic rotor follow.' },
  { id: 'golden', start: 1946, end: 1968, row: 0, name: 'Golden age of sport watches', caption: 'Divers, pilots, racers and astronauts: the Submariner, Speedmaster, Navitimer and Seamaster define archetypes still sold today.' },
  { id: 'quartz', start: 1969, end: 1985, row: 0, name: 'The Quartz Crisis', caption: 'Seiko’s Astron (1969) makes accuracy cheap. Swiss watch employment collapses by roughly two-thirds and hundreds of names fall silent.' },
  { id: 'renaissance', start: 1986, end: 2009, row: 0, name: 'Mechanical renaissance', caption: 'Swatch saves the Swiss industry, groups consolidate, and mechanical watches are reborn as emotional luxury objects rather than mere timekeepers.' },
  { id: 'independent', start: 2010, end: 2030, row: 0, name: 'Independent & microbrand boom', caption: 'Online communities and crowdfunding let tiny makers reach collectors directly, while celebrated independents command waiting lists.' },
  { id: 'smart', start: 2015, end: 2030, row: 1, name: 'Smartwatch era', caption: 'The Apple Watch (2015) makes the wrist a computer; by volume, smartwatches now outsell the entire Swiss industry.' },
];

let cleanup = [];

export default {
  title: 'Timeline of Horology',
  async render(root, ctx) {
    this.destroy();
    const wrap = document.createElement('div');
    wrap.className = 'vw vw-timeline';
    root.appendChild(wrap);

    const countries = [...ctx.brands.reduce((m, b) => m.set(b.country, (m.get(b.country) || 0) + 1), new Map())].sort((a, b) => b[1] - a[1]);
    const state = { seg: new Set(), country: ctx.params?.country || '' };

    wrap.innerHTML = `
      ${header({ eyebrow: 'History', title: 'Timeline of <em>Horology</em>', lede: 'Three centuries of watchmaking, from Enlightenment workshops to silicon on the wrist. Each name marks the year a house was founded; scroll or pinch to zoom, drag to travel through time.' })}
      <div class="vw-controls">
        <div class="vw-control"><label class="vw-control__label" for="vwTlCountry">Country</label>
          <select id="vwTlCountry" class="vw-select"><option value="">All countries</option>${countries.map(([c, n]) => `<option value="${esc(c)}" ${c === state.country ? 'selected' : ''}>${esc(c)} (${n})</option>`).join('')}</select></div>
        <div class="vw-control"><span class="vw-control__label">Segment</span>${chips('seg', SEGMENTS.map(s => ({ value: s, label: s })), { label: 'Filter by segment' })}</div>
      </div>
      <div class="vw-tl__stage">
        <div class="vw-tl__canvas">${loadingHTML('Winding the timeline')}</div>
      </div>
      <div class="vw-tl__below">
        <p class="vw-hint">Names that don’t fit are shown as dots — zoom in to reveal them. The lower strip shows how many recorded events fall in each period.</p>
        <div class="vw-map__zoom vw-tl__zoom" role="group" aria-label="Timeline zoom">
          <button type="button" data-z="in" aria-label="Zoom in">+</button>
          <button type="button" data-z="out" aria-label="Zoom out">−</button>
          <button type="button" data-z="reset" aria-label="Show all years">⟲</button>
        </div>
      </div>
      <section class="vw-eras" aria-label="Eras of watchmaking">
        ${ERAS.map((e, i) => `<button type="button" class="vw-era" data-era="${e.id}" style="--i:${i}">
          <span class="vw-era__years">${e.start}–${e.end >= 2026 ? 'today' : e.end}</span>
          <span class="vw-era__name">${e.name}</span>
          <span class="vw-era__cap">${e.caption}</span></button>`).join('')}
      </section>
      <section class="vw-chronicle">
        <div class="vw-chronicle__head"><h2 class="vw-h2">Chronicle</h2><p class="vw-chronicle__range" aria-live="polite"></p></div>
        <ol class="vw-chronicle__list"></ol>
        <button type="button" class="vw-btn" data-more hidden>Show more</button>
      </section>`;

    const tip = makeTooltip(wrap);
    const canvas = wrap.querySelector('.vw-tl__canvas');
    const listEl = wrap.querySelector('.vw-chronicle__list');
    const rangeEl = wrap.querySelector('.vw-chronicle__range');
    const moreBtn = wrap.querySelector('[data-more]');
    let listLimit = 60;

    let d3;
    try { d3 = await loadD3(); } catch (e) { canvas.innerHTML = `<p class="vw-error">Could not load the chart library.</p>`; return; }
    if (!wrap.isConnected) return;

    const measure = document.createElement('canvas').getContext('2d');
    const textW = s => { measure.font = '500 12px ' + (getComputedStyle(wrap).getPropertyValue('--font-body') || 'sans-serif'); return measure.measureText(s).width; };
    const eraW = s => { measure.font = '500 10.5px ' + (getComputedStyle(wrap).getPropertyValue('--font-body') || 'sans-serif'); return measure.measureText(s.toUpperCase()).width + s.length * 0.63; };
    const nameW = new Map(ctx.brands.map(b => [b.id, textW(b.name)]));

    const allEvents = [];
    for (const b of ctx.brands) for (const ev of (b.timeline || [])) if (ev && Number.isFinite(ev.year)) allEvents.push({ year: +ev.year, text: ev.event, b });
    allEvents.sort((a, b) => a.year - b.year);

    const pass = b => (!state.seg.size || state.seg.has(b.segment)) && (!state.country || b.country === state.country);
    const minYear = Math.max(1690, Math.min(1700, d3.min(ctx.brands, b => b.founded) || 1700));
    const MAX_YEAR = new Date().getFullYear() + 3;

    let svg, x0, x, zoom, W, H, lanesN, LANE = 21, gEras, gAxis, gLanes, gDensity, T = null;
    const TOP_ERA = 44, AXIS_Y = 58;

    function build() {
      W = canvas.clientWidth || 900;
      const mobile = W < 640;
      lanesN = mobile ? 12 : 16;
      const lanesTop = AXIS_Y + 14;
      const dotsY = lanesTop + lanesN * LANE + 10;
      const densTop = dotsY + 26, densH = 54;
      H = densTop + densH + 22;
      x0 = d3.scaleLinear().domain([minYear, MAX_YEAR]).range([12, W - 12]);
      x = x0.copy();
      canvas.innerHTML = '';
      svg = d3.select(canvas).append('svg').attr('viewBox', `0 0 ${W} ${H}`).attr('width', W).attr('height', H)
        .attr('role', 'group').attr('aria-label', 'Zoomable timeline of watch brand foundings. Brand names are links.');
      gEras = svg.append('g').attr('class', 'vw-tl__eras');
      gAxis = svg.append('g').attr('class', 'vw-tl__axis').attr('transform', `translate(0,${AXIS_Y})`);
      svg.append('line').attr('class', 'vw-tl__base').attr('x1', 0).attr('x2', W).attr('y1', dotsY).attr('y2', dotsY);
      gLanes = svg.append('g').attr('class', 'vw-tl__lanes');
      gDensity = svg.append('g').attr('class', 'vw-tl__density').attr('transform', `translate(0,${densTop})`);
      svg.append('text').attr('class', 'vw-tl__small').attr('x', 12).attr('y', densTop - 6).text('Recorded events');
      Object.assign(build, { lanesTop, dotsY, densTop, densH });

      zoom = d3.zoom().scaleExtent([1, 60]).extent([[0, 0], [W, H]]).translateExtent([[0, 0], [W, H]])
        .on('zoom', e => { T = e.transform; x = T.rescaleX(x0); draw(); tip.hide(); updateChronicle(); });
      svg.call(zoom).on('dblclick.zoom', null);
      if (mobile && !T) T = d3.zoomIdentity.scale(2.2).translate(-x0(1830) + 12, 0);
      if (T) svg.call(zoom.transform, T); else draw();
    }

    function draw() {
      const { lanesTop, dotsY, densTop, densH } = build;
      const [y0, y1] = x.domain();
      // eras
      gEras.selectAll('g.vw-tl__era').data(ERAS, d => d.id).join(enter => {
        const g = enter.append('g').attr('class', d => `vw-tl__era r${d.row}`).attr('data-era', d => d.id);
        g.append('rect').attr('class', 'vw-tl__eraBand');
        g.append('rect').attr('class', 'vw-tl__eraTab');
        g.append('text').attr('class', 'vw-tl__eraText');
        g.on('click', (e, d) => zoomToEra(d)).on('mousemove', (e, d) => tip.show(`<strong>${esc(d.name)}</strong><span class="vw-tip__muted">${d.start}–${d.end >= 2026 ? 'today' : d.end}</span><span>${esc(d.caption)}</span>`, e.clientX, e.clientY)).on('mouseleave', () => tip.hide());
        return g;
      }).each(function (d, i) {
        const g = d3.select(this);
        const a = x(d.start), b = x(Math.min(d.end + 1, MAX_YEAR));
        g.select('.vw-tl__eraBand').attr('x', a).attr('width', Math.max(0, b - a)).attr('y', d.row ? 22 : 0).attr('height', H - (d.row ? 22 : 0)).classed('alt', i % 2 === 1);
        g.select('.vw-tl__eraTab').attr('x', a).attr('width', Math.max(0, b - a)).attr('y', d.row ? 22 : 2).attr('height', 18);
        // Fit the label to the visible part of the tab, trimming at a word (or letter) boundary.
        const avail = Math.min(b, W) - Math.max(a, 0) - 12;
        let label = d.name;
        if (eraW(label) > avail) {
          const words = d.name.split(' ');
          label = '';
          for (let k = words.length - 1; k > 0 && !label; k--) { const t = words.slice(0, k).join(' ').replace(/[\s&,]+$/, '') + '…'; if (eraW(t) <= avail) label = t; }
          if (!label) { let t = d.name; while (t.length > 3 && eraW(t + '…') > avail) t = t.slice(0, -1); label = t.length > 3 ? t.trim() + '…' : ''; }
        }
        const txt = g.select('.vw-tl__eraText').attr('x', Math.max(a, 0) + 6).attr('y', (d.row ? 22 : 2) + 13).text(label);
        txt.append('title').text(d.name);
        g.select('.vw-tl__eraTab').selectAll('title').data([d.name]).join('title').text(t => t);
      });
      // axis
      const span = y1 - y0;
      const step = span > 200 ? 50 : span > 90 ? 20 : span > 40 ? 10 : span > 15 ? 5 : span > 6 ? 2 : 1;
      gAxis.call(d3.axisTop(x).tickValues(d3.range(Math.ceil(y0 / step) * step, y1 + 1, step)).tickFormat(d3.format('d')).tickSize(-(H - AXIS_Y - 20)).tickPadding(6))
        .call(g => g.select('.domain').remove());

      // lanes: greedy label packing in screen space
      const vis = ctx.brands.filter(b => Number.isFinite(b.founded) && pass(b)) /* isFinite(null) is true */.sort((a, b) => a.founded - b.founded || (b.popularity || 0) - (a.popularity || 0));
      const laneEnd = new Array(lanesN).fill(-Infinity);
      // place popular brands first so household names win the labels
      const order = [...vis].sort((a, b) => (b.popularity || 0) - (a.popularity || 0) || a.founded - b.founded);
      const placed = new Map(), flipped = new Map();
      const occupied = Array.from({ length: lanesN }, () => []);
      for (const b of order) {
        const px = x(b.founded + 0.5);
        if (px < -100 || px > W + 10) continue;
        const w = nameW.get(b.id);
        const flip = px + 10 + w > W - 6;
        const s = flip ? px - 10 - w - 8 : px - 5, e = flip ? px + 5 : px + 10 + w + 8;
        for (let l = 0; l < lanesN; l++) {
          if (occupied[l].every(([a, c]) => e < a || s > c)) { occupied[l].push([s, e]); placed.set(b.id, l); flipped.set(b.id, flip); break; }
        }
      }
      void laneEnd;
      const labelled = vis.filter(b => placed.has(b.id));
      const dotsOnly = vis.filter(b => !placed.has(b.id));
      gLanes.selectAll('a.vw-tl__brand').data(labelled, d => d.id).join(enter => {
        const a = enter.append('a').attr('class', 'vw-tl__brand').attr('href', d => `#/brand/${d.id}`)
          .attr('aria-label', d => `${d.name}, founded ${d.founded} in ${d.city || d.country}`);
        a.append('line').attr('class', 'vw-tl__stem');
        a.append('circle').attr('r', 3.5).attr('class', 'vw-tl__dot');
        a.append('text').attr('class', 'vw-tl__name').attr('dy', '0.35em').text(d => d.name);
        a.on('mousemove', (e, d) => brandTip(e, d)).on('mouseleave', () => tip.hide())
          .on('focus', function (e, d) { const r = this.getBoundingClientRect(); brandTip({ clientX: r.left, clientY: r.bottom }, d); }).on('blur', () => tip.hide());
        return a;
      }).each(function (d) {
        const px = x(d.founded + 0.5), py = lanesTop + placed.get(d.id) * LANE + LANE / 2;
        const g = d3.select(this);
        g.select('circle').attr('cx', px).attr('cy', py);
        const fl = flipped.get(d.id);
        g.select('text').attr('x', fl ? px - 8 : px + 8).attr('y', py).attr('text-anchor', fl ? 'end' : 'start');
        g.select('line').attr('x1', px).attr('x2', px).attr('y1', py + 4).attr('y2', dotsY);
      });
      gLanes.selectAll('a.vw-tl__pip').data(dotsOnly, d => d.id).join(enter => {
        const a = enter.append('a').attr('class', 'vw-tl__pip').attr('href', d => `#/brand/${d.id}`).attr('aria-label', d => `${d.name}, founded ${d.founded}`);
        a.append('circle').attr('r', 3);
        a.on('mousemove', (e, d) => brandTip(e, d)).on('mouseleave', () => tip.hide());
        return a;
      }).select('circle').attr('cx', d => x(d.founded + 0.5)).attr('cy', (d, i) => dotsY + ((i % 3) - 1) * 5);

      // today marker
      svg.selectAll('line.vw-tl__today').data([0]).join('line').attr('class', 'vw-tl__today')
        .attr('x1', x(new Date().getFullYear())).attr('x2', x(new Date().getFullYear())).attr('y1', AXIS_Y).attr('y2', H - 20);

      // density of events
      const evs = allEvents.filter(e => pass(e.b));
      const bw = Math.max(1, Math.round((y1 - y0) / (W / 7)));
      const bins = new Map();
      for (const e of evs) { if (e.year < y0 - bw || e.year > y1 + bw) continue; const k = Math.floor(e.year / bw) * bw; bins.set(k, (bins.get(k) || 0) + 1); }
      const maxC = Math.max(1, ...bins.values());
      gDensity.selectAll('rect').data([...bins], d => d[0]).join('rect')
        .attr('x', d => x(d[0]) + 0.5).attr('width', d => Math.max(1, x(d[0] + bw) - x(d[0]) - 1.5))
        .attr('y', d => densH - (d[1] / maxC) * densH).attr('height', d => (d[1] / maxC) * densH).attr('rx', 1.5)
        .on('mousemove', (e, d) => tip.show(`<strong>${d[0]}${bw > 1 ? '–' + (d[0] + bw - 1) : ''}</strong><span>${d[1]} event${d[1] > 1 ? 's' : ''}</span>`, e.clientX, e.clientY))
        .on('mouseleave', () => tip.hide());
    }

    function brandTip(e, b) {
      const evs = (b.timeline || []).slice(0, 4).map(t => `<span>${t.year != null ? `<em>${t.year}</em> ` : ''}${esc(t.event)}</span>`).join('');
      tip.show(`<strong>${esc(b.name)}</strong><span>${[b.founded ? `Founded ${b.founded}` : 'Founding year unknown', [b.city, b.country].filter(Boolean).map(esc).join(', ')].filter(Boolean).join(' · ')}</span>
        <span class="vw-tip__muted">${esc(b.segment)}${b.parentGroup ? ' · ' + esc(b.parentGroup) : ''}</span>${evs ? `<span class="vw-tip__list">${evs}</span>` : ''}`, e.clientX, e.clientY);
    }

    function zoomToEra(d) {
      const a = x0(Math.max(minYear, d.start - 3)), b = x0(Math.min(MAX_YEAR, d.end + 4));
      const k = Math.min(60, W / (b - a));
      const t = d3.zoomIdentity.scale(k).translate(-a, 0);
      svg.transition().duration(prefersReducedMotion() ? 0 : 850).ease(d3.easeCubicInOut).call(zoom.transform, t);
      wrap.querySelectorAll('.vw-era').forEach(el => el.setAttribute('aria-pressed', String(el.dataset.era === d.id)));
      wrap.querySelector('.vw-tl__stage').scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'nearest' });
    }

    const updateChronicle = debounce(() => {
      const [y0, y1] = x.domain();
      const evs = allEvents.filter(e => pass(e.b) && e.year >= Math.floor(y0) && e.year <= Math.ceil(y1));
      rangeEl.textContent = `${evs.length} events, ${Math.max(minYear, Math.floor(y0))}–${Math.min(new Date().getFullYear(), Math.ceil(y1))}`;
      listEl.innerHTML = evs.slice(0, listLimit).map(e => `<li><span class="vw-chronicle__y">${e.year}</span>
        <a class="vw-chronicle__b" href="#/brand/${esc(e.b.id)}">${esc(e.b.name)}</a><span class="vw-chronicle__t">${esc(e.text)}</span></li>`).join('')
        || '<li class="vw-empty">No recorded events in this window.</li>';
      moreBtn.hidden = evs.length <= listLimit;
      moreBtn.textContent = `Show more (${evs.length - listLimit} remaining)`;
    }, 120);

    wrap.querySelector('#vwTlCountry').addEventListener('change', e => { state.country = e.target.value; draw(); updateChronicle(); });
    wireChips(wrap.querySelector('.vw-controls'), (n, s) => { state[n] = s; draw(); updateChronicle(); });
    wrap.querySelectorAll('.vw-era').forEach(el => el.addEventListener('click', () => zoomToEra(ERAS.find(e => e.id === el.dataset.era))));
    moreBtn.addEventListener('click', () => { listLimit += 80; updateChronicle(); });
    wrap.querySelector('.vw-tl__zoom').addEventListener('click', e => {
      const z = e.target.closest('button')?.dataset.z; if (!z) return;
      if (z === 'reset') { wrap.querySelectorAll('.vw-era').forEach(el => el.setAttribute('aria-pressed', 'false')); return svg.transition().duration(500).call(zoom.transform, d3.zoomIdentity); }
      svg.transition().duration(350).call(zoom.scaleBy, z === 'in' ? 1.8 : 1 / 1.8);
    });

    build();
    updateChronicle();
    cleanup.push(onResize(canvas, () => { T = null; build(); }));
  },
  destroy() { cleanup.forEach(f => f()); cleanup = []; },
};
