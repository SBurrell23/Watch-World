// Groups & Ownership (#/groups) — zoomable circle packing of conglomerates.
import { loadD3, loadCards, esc, fmtUSD, tierVar, header, makeTooltip, onResize, loadingHTML, prefersReducedMotion } from './_shared.js';

export const GROUP_INFO = {
  'Swatch Group': 'The world’s largest watch company by volume, forged in 1983 from the merger of ASUAG and SSIH to rescue Swiss watchmaking from the Quartz Crisis. Nicolas G. Hayek’s plastic Swatch funded a vertically integrated empire spanning Breguet and Blancpain at the summit, Omega and Longines in the middle, Tissot and Hamilton below, and ETA, the movement maker that supplies much of the industry.',
  'Richemont': 'Johann Rupert’s Geneva-based luxury group gathers jewellers and watchmakers under one roof: Cartier and Van Cleef & Arpels alongside the Specialist Watchmakers — Vacheron Constantin, A. Lange & Söhne, Jaeger-LeCoultre, IWC, Panerai, Piaget and more. Its strength is heritage, haute horlogerie and jewellery-driven profits.',
  'LVMH': 'The world’s biggest luxury conglomerate entered watches in 1999 and runs them like fashion houses: TAG Heuer for sport and motor racing, Zenith for its El Primero chronograph heritage, Hublot for bold fusion materials and marketing, and Bulgari for Italian design and record-thin complications.',
  'Kering': 'The French owner of Gucci and Saint Laurent has trimmed its watch holdings in recent years, divesting Girard-Perregaux and Ulysse Nardin in 2022. Its watch presence is now largely in-house fashion labels such as Gucci Timepieces.',
  'Rolex SA': 'Owned by the Hans Wilsdorf Foundation, a private charitable trust, Rolex answers to no shareholders. That independence, plus near-total vertical integration, has made it the most valuable name in watches. Sister brand Tudor offers Rolex-grade engineering at a lower price, and Rolex acquired Bucherer, the world’s largest watch retailer, in 2023.',
  'Seiko Group': 'Founded by Kintarō Hattori in 1881, Seiko is one of the few truly vertically integrated watchmakers, producing everything from hairsprings to quartz crystals. It launched the first quartz wristwatch in 1969, invented Spring Drive, and spun Grand Seiko off as an independent luxury brand in 2017.',
  'Citizen Group': 'Japan’s volume giant and a pioneer of light-powered Eco-Drive, Citizen has built a Western portfolio by acquisition: Bulova in 2008, Arnold & Son and La Joux-Perret in 2012, and Frédérique Constant and Alpina in 2016.',
  'Casio': 'The Tokyo electronics company that brought the calculator to the wrist. The G-Shock (1983), engineered to survive a fall from a third-storey window, has sold well over 100 million units and made Casio a cultural icon.',
  'Fossil Group': 'Born in Texas in 1984 as a retro-styled fashion watch brand, Fossil grew into one of the largest makers of licensed watches (Michael Kors, Armani Exchange, Diesel and others) and briefly into smartwatches before scaling back.',
  'Movado Group': 'A New Jersey-listed group built around the Swiss Movado brand and its minimalist Museum dial, plus licensed fashion watches for labels such as Coach, Hugo Boss, Tommy Hilfiger and Lacoste.',
  'Independent': 'Family firms, founder-led ateliers and microbrands with no conglomerate parent. They range from Patek Philippe and Audemars Piguet — the two most powerful independents — to the tiny workshops of F.P. Journe, MB&F and a new generation of online-first microbrands.',
  'Timex Group': 'America’s great survivor, tracing its roots to the Waterbury Clock Company of 1854. Timex democratised the wristwatch with inexpensive, rugged pin-lever movements ("takes a licking and keeps on ticking") and today also owns Guess watches under licence.',
  'Apple': 'Apple entered the wrist in 2015 and within five years was shipping more watches annually than the entire Swiss industry — a second “quartz moment” that pushed traditional brands further upmarket.',
};

let cleanup = [];

export default {
  title: 'Groups & Ownership',
  async render(root, ctx) {
    this.destroy();
    const wrap = document.createElement('div');
    wrap.className = 'vw vw-groups';
    root.appendChild(wrap);
    wrap.innerHTML = `
      ${header({ eyebrow: 'Who owns whom', title: 'Groups &amp; <em>Ownership</em>', lede: 'Behind hundreds of names sit a handful of powerful owners. Each circle is a group, each inner circle a brand sized by its fame and coloured by price tier. Select a group to step inside.' })}
      <div class="vw-groups__grid">
        <div class="vw-groups__stage"><div class="vw-groups__canvas">${loadingHTML('Assembling the groups')}</div>
          <button type="button" class="vw-btn vw-btn--small vw-groups__back" hidden>← All groups</button></div>
        <aside class="vw-groups__info" aria-live="polite"></aside>
      </div>
      <section><h2 class="vw-h2">All groups</h2><div class="vw-groupcards"></div></section>`;

    const tip = makeTooltip(wrap);
    const canvas = wrap.querySelector('.vw-groups__canvas');
    const info = wrap.querySelector('.vw-groups__info');
    const back = wrap.querySelector('.vw-groups__back');
    const cardsEl = wrap.querySelector('.vw-groupcards');

    let d3, cards;
    try { [d3, cards] = await Promise.all([loadD3(), loadCards()]); } catch { canvas.innerHTML = '<p class="vw-error">Could not load the chart library.</p>'; return; }
    if (!wrap.isConnected) return;

    // build hierarchy
    const groups = new Map();
    for (const b of ctx.brands) {
      const g = b.parentGroup || 'Independent';
      if (!groups.has(g)) groups.set(g, []);
      groups.get(g).push(b);
    }
    const groupList = [...groups].map(([name, brands]) => ({ name, brands })).sort((a, b) => b.brands.length - a.brands.length);
    const data = { name: 'All groups', children: groupList.map(g => ({ name: g.name, group: true, children: g.brands.map(b => ({ name: b.name, brand: b })) })) };

    const statsFor = g => {
      const bs = g.brands;
      const mins = bs.map(b => b.priceRange?.min).filter(Boolean), maxs = bs.map(b => b.priceRange?.max).filter(Boolean);
      return {
        n: bs.length,
        countries: [...new Set(bs.map(b => b.country))],
        oldest: bs.reduce((a, b) => (b.founded && (!a || b.founded < a.founded) ? b : a), null),
        min: mins.length ? Math.min(...mins) : null, max: maxs.length ? Math.max(...maxs) : null,
        segs: [...new Set(bs.map(b => b.segment))],
      };
    };
    const blurb = g => GROUP_INFO[g.name] || (() => {
      const s = statsFor(g);
      return `${esc(g.name)} counts ${s.n} brand${s.n > 1 ? 's' : ''} in this guide${s.countries.length ? `, based in ${esc(s.countries.join(', '))}` : ''}, spanning the ${esc(s.segs.join(' / '))} segment${s.segs.length > 1 ? 's' : ''}.`;
    })();

    cardsEl.innerHTML = groupList.map(g => {
      const s = statsFor(g);
      return `<button type="button" class="vw-groupcard" data-group="${esc(g.name)}">
        <span class="vw-groupcard__n">${s.n}</span>
        <span class="vw-groupcard__name">${esc(g.name)}</span>
        <span class="vw-groupcard__meta">${s.min ? `${fmtUSD(s.min)} – ${fmtUSD(s.max)}` : ''}${s.oldest ? ` · since ${s.oldest.founded}` : ''}</span>
        <span class="vw-groupcard__brands">${g.brands.slice().sort((a, b) => (b.popularity || 0) - (a.popularity || 0)).slice(0, 6).map(b => esc(b.name)).join(' · ')}${g.brands.length > 6 ? ' …' : ''}</span>
      </button>`;
    }).join('');

    let svg, nodes, labels, view, focus, packRoot, S;

    function build() {
      S = Math.min(canvas.clientWidth || 600, 760);
      packRoot = d3.pack().size([S, S]).padding(d => d.depth === 0 ? 8 : 3)(
        d3.hierarchy(data).sum(d => d.brand ? 1 + (d.brand.popularity || 3) ** 1.3 : 0).sort((a, b) => b.value - a.value));
      focus = focus ? packRoot.descendants().find(n => n.data.name === focus.data.name && n.depth === focus.depth) || packRoot : packRoot;
      canvas.innerHTML = '';
      svg = d3.select(canvas).append('svg').attr('viewBox', `${-S / 2} ${-S / 2} ${S} ${S}`).attr('width', S).attr('height', S)
        .attr('role', 'group').attr('aria-label', 'Circle packing of watch groups and their brands')
        .on('click', () => focus !== packRoot && zoomTo(packRoot));
      nodes = svg.append('g').selectAll('g').data(packRoot.descendants().slice(1)).join('g')
        .attr('class', d => d.children ? 'vw-pk vw-pk--group' : 'vw-pk vw-pk--brand')
        .attr('tabindex', d => d.children ? 0 : -1).attr('role', 'button')
        .attr('aria-label', d => d.children ? `${d.data.name}, ${d.children.length} brands. Press Enter to explore.` : `${d.data.name}, ${d.parent.data.name}`)
        .on('click', (e, d) => { e.stopPropagation(); clickNode(d); })
        .on('keydown', (e, d) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); clickNode(d); } })
        .on('mousemove', (e, d) => nodeTip(e, d)).on('mouseleave', () => tip.hide());
      nodes.append('circle').style('--tc', d => d.data.brand ? tierVar(d.data.brand.priceTier) : null);
      nodes.filter(d => !d.children).append('text').attr('class', 'vw-pk__label').attr('dy', '0.35em').text(d => d.data.name);
      // group labels live in their own layer so they sit above the brand circles
      labels = svg.append('g').attr('class', 'vw-pk--group vw-pk__labels').attr('aria-hidden', 'true')
        .selectAll('g').data(packRoot.children).join('g');
      labels.append('text').attr('class', 'vw-pk__label').attr('dy', '0.35em').text(d => d.data.name);
      labels.append('text').attr('class', 'vw-pk__count').text(d => d.children.length);
      view = null;
      zoomTo(focus, true);
    }

    function clickNode(d) {
      tip.hide();
      if (d.children) return zoomTo(focus === d ? packRoot : d);
      if (focus !== d.parent) return zoomTo(d.parent);
      ctx.go(`#/brand/${d.data.brand.id}`);
    }

    function nodeTip(e, d) {
      if (d.children) {
        const s = statsFor({ brands: d.children.map(c => c.data.brand) });
        tip.show(`<strong>${esc(d.data.name)}</strong><span>${s.n} brand${s.n > 1 ? 's' : ''}</span><span class="vw-tip__muted">${s.min ? `${fmtUSD(s.min)} – ${fmtUSD(s.max)}` : ''}</span>`, e.clientX, e.clientY);
      } else {
        const b = d.data.brand;
        tip.show(`<strong>${esc(b.name)}</strong><span>${esc(d.parent.data.name)}</span><span class="vw-tip__muted">${[b.country, b.segment, b.priceTier ? `Tier ${b.priceTier}` : null].filter(Boolean).map(esc).join(' · ')}</span>`, e.clientX, e.clientY);
      }
    }

    function zoomTo(d, instant = false) {
      focus = d;
      const target = [d.x - S / 2, d.y - S / 2, d.r * 2 + (d === packRoot ? 0 : 16)];
      const t = svg.transition().duration(instant || prefersReducedMotion() ? 0 : 750).ease(d3.easeCubicInOut)
        .tween('zoom', () => { const i = d3.interpolateZoom(view || target, target); return t => apply(i(t)); });
      void t;
      svg.classed('is-zoomed', d !== packRoot);
      back.hidden = d === packRoot;
      nodes.classed('is-focus', n => n === d).classed('is-in', n => n.parent === d)
        .attr('tabindex', n => (d === packRoot ? (n.children ? 0 : -1) : (n.parent === d ? 0 : -1)))
        .attr('aria-label', n => n.children ? `${n.data.name}, ${n.children.length} brands. Press Enter to explore.` : `${n.data.name} — open brand page`);
      renderInfo();
      cardsEl.querySelectorAll('.vw-groupcard').forEach(c => c.setAttribute('aria-pressed', String(c.dataset.group === d.data.name)));
    }

    function apply(v) {
      view = v;
      const k = S / v[2];
      const cx = v[0] + S / 2, cy = v[1] + S / 2;
      nodes.attr('transform', d => `translate(${(d.x - cx) * k},${(d.y - cy) * k})`);
      labels.attr('transform', d => `translate(${(d.x - cx) * k},${(d.y - cy) * k})`);
      nodes.select('circle').attr('r', d => d.r * k);
      d3.selectAll([...nodes.selectAll('.vw-pk__label').nodes(), ...labels.selectAll('.vw-pk__label').nodes()])
        .style('font-size', d => d.children ? `${Math.max(10, Math.min(18, d.r * k / 4.2))}px` : `${Math.min(13, d.r * k / 3.2)}px`)
        .attr('y', d => d.children && focus === packRoot ? -Math.min(d.r * k * 0.15, 8) : 0)
        .style('opacity', d => {
          const r = d.r * k;
          if (d.children) return focus === packRoot && r > 26 ? 1 : 0;
          return focus === d.parent && r > 16 ? 1 : 0;
        })
        .text(d => { const r = d.r * k; const max = Math.floor((r * 2 - 6) / (d.children ? 8 : 6.2)); return d.data.name.length > max ? d.data.name.slice(0, Math.max(3, max - 1)) + '…' : d.data.name; });
      labels.select('.vw-pk__count').attr('y', d => Math.min(d.r * k * 0.28, 16)).attr('dy', '0.7em')
        .style('opacity', d => focus === packRoot && d.r * k > 30 ? 1 : 0);
    }

    function renderInfo() {
      if (focus === packRoot) {
        const total = ctx.brands.length;
        info.innerHTML = `<p class="vw-eyebrow">The power map</p><h2 class="vw-panel__title">${groupList.length} owners, ${total} brands</h2>
          <p class="vw-groups__p">Most famous names in watchmaking belong to a few conglomerates. The Swiss “big three” — Swatch Group, Richemont and LVMH — together with independent Rolex, account for the lion’s share of Swiss watch exports by value.</p>
          <ol class="vw-share">${groupList.slice(0, 10).map(g => `<li><button type="button" data-group="${esc(g.name)}"><span>${esc(g.name)}</span><span class="vw-share__bar"><i style="width:${(g.brands.length / groupList[0].brands.length) * 100}%"></i></span><span class="vw-share__n">${g.brands.length}</span></button></li>`).join('')}</ol>`;
        return;
      }
      const g = groupList.find(x => x.name === focus.data.name);
      const s = statsFor(g);
      const bs = g.brands.slice().sort((a, b) => (b.priceTier || 0) - (a.priceTier || 0) || (b.popularity || 0) - (a.popularity || 0));
      info.innerHTML = `<p class="vw-eyebrow">Group</p><h2 class="vw-panel__title">${esc(g.name)}</h2>
        <p class="vw-groups__p">${blurb(g)}</p>
        <dl class="vw-dl vw-dl--row">
          <div><dt>Brands</dt><dd>${s.n}</dd></div>
          <div><dt>Price span</dt><dd>${s.min ? `${fmtUSD(s.min)} – ${fmtUSD(s.max)}` : '—'}</dd></div>
          <div><dt>Oldest</dt><dd>${s.oldest ? `${esc(s.oldest.name)}, ${s.oldest.founded}` : '—'}</dd></div>
          <div><dt>Countries</dt><dd>${esc(s.countries.join(', '))}</dd></div>
        </dl>
        <div class="vw-panel__cards vw-panel__cards--grid">${bs.map(b => cards.brandCard(b, ctx)).join('')}</div>`;
    }

    info.addEventListener('click', e => {
      const name = e.target.closest('[data-group]')?.dataset.group; if (!name) return;
      const n = packRoot.children.find(c => c.data.name === name); if (n) zoomTo(n);
    });
    cardsEl.addEventListener('click', e => {
      const name = e.target.closest('[data-group]')?.dataset.group; if (!name) return;
      const n = packRoot.children.find(c => c.data.name === name); if (n) zoomTo(n);
      wrap.querySelector('.vw-groups__grid').scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' });
    });
    back.addEventListener('click', () => zoomTo(packRoot));
    const onKey = e => { if (e.key === 'Escape' && focus !== packRoot) zoomTo(packRoot); };
    document.addEventListener('keydown', onKey);
    cleanup.push(() => document.removeEventListener('keydown', onKey));

    build();
    if (ctx.params?.group) { const n = packRoot.children.find(c => c.data.name === ctx.params.group); if (n) zoomTo(n, true); }
    cleanup.push(onResize(canvas, build));
  },
  destroy() { cleanup.forEach(f => f()); cleanup = []; },
};
