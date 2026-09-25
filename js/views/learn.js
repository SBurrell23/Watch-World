// Learn (#/learn) — illustrated guide: anatomy, glossary, pricing, Quartz Crisis,
// the Swiss groups and the tier scale.
import { esc, fmtUSD, TIERS, tierVar, header, debounce, watchSVG, prefersReducedMotion } from './_shared.js';

const CATS = { comp: 'Complications', mov: 'Movement', case: 'Case & bezel', mat: 'Materials', dial: 'Dial', ind: 'Industry' };

export const GLOSSARY = [
  ['Complication', 'comp', 'Any function beyond hours, minutes and seconds — from a simple date to a minute repeater.'],
  ['Chronograph', 'comp', 'A stopwatch built into the watch, started and stopped with pushers beside the crown.'],
  ['Flyback', 'comp', 'A chronograph that resets and restarts with a single push — designed for pilots timing successive legs.'],
  ['Rattrapante', 'comp', 'A split-seconds chronograph with two superimposed hands to time two events that start together.'],
  ['GMT', 'comp', 'A complication showing a second time zone, usually via an extra 24-hour hand and bezel.'],
  ['World time', 'comp', 'Displays the time in all 24 major time zones at once using a rotating city ring.'],
  ['Moonphase', 'comp', 'A disc showing the current phase of the moon through an aperture on the dial.'],
  ['Annual calendar', 'comp', 'A calendar that accounts for 30- and 31-day months, needing correction only once a year, at the end of February.'],
  ['Perpetual calendar', 'comp', 'A mechanical calendar that knows month lengths and leap years, correct until 2100.'],
  ['Minute repeater', 'comp', 'Chimes the time on demand on tiny gongs — hours, quarters and minutes. Among the hardest complications to make.'],
  ['Tourbillon', 'comp', 'A rotating cage that carries the escapement to average out the effects of gravity. Patented by Breguet in 1801.'],
  ['Power reserve indicator', 'comp', 'Shows how much energy remains in the mainspring before the watch stops.'],
  ['Big date', 'comp', 'A large date display using two separate discs for tens and units.'],
  ['Jumping hour', 'comp', 'Shows the hour as a numeral in a window that jumps instantly on the hour.'],
  ['Retrograde', 'comp', 'A hand that sweeps across an arc and then snaps back to zero to start again.'],
  ['Grande complication', 'comp', 'A watch combining at least a chronograph, a perpetual calendar and a minute repeater.'],
  ['Movement / calibre', 'mov', 'The engine of a watch. “Calibre” is the maker’s name for a specific movement design.'],
  ['Automatic', 'mov', 'A mechanical movement wound by a rotor that spins with the motion of your wrist.'],
  ['Manual winding', 'mov', 'A mechanical movement wound by turning the crown by hand, usually daily.'],
  ['Quartz', 'mov', 'A battery-powered movement regulated by a vibrating quartz crystal — typically accurate to seconds per month.'],
  ['Spring Drive', 'mov', 'Seiko’s hybrid: a mainspring powers the watch while a quartz-regulated electromagnetic brake governs its speed.'],
  ['Solar / Eco-Drive', 'mov', 'A quartz movement recharged by light through the dial. Citizen’s Eco-Drive is the best-known example.'],
  ['Escapement', 'mov', 'The mechanism that releases the mainspring’s energy in tiny, regular steps — the source of the tick.'],
  ['Co-axial escapement', 'mov', 'George Daniels’ low-friction escapement, industrialised by Omega from 1999.'],
  ['Balance wheel', 'mov', 'The oscillating wheel that, with the hairspring, acts as the watch’s timekeeping heart.'],
  ['Hairspring', 'mov', 'The fine coiled spring that makes the balance oscillate at a steady rate. Now often made of silicon.'],
  ['Mainspring', 'mov', 'The coiled spring in the barrel that stores the energy powering a mechanical watch.'],
  ['Jewels', 'mov', 'Synthetic rubies used as low-friction bearings for pivots. A simple automatic has about 21–25.'],
  ['Beat rate', 'mov', 'How many times the balance swings per hour, e.g. 28,800 vph (4 Hz). Higher rates can improve stability.'],
  ['Rotor', 'mov', 'The weighted semicircle in an automatic movement that swings to wind the mainspring.'],
  ['In-house', 'mov', 'A movement designed and made by the brand itself rather than bought from a supplier.'],
  ['Ébauche', 'mov', 'A partly finished movement kit bought from a supplier (such as ETA or Sellita) and finished by the brand.'],
  ['Silicon', 'mov', 'Anti-magnetic, lubricant-free material used for hairsprings and escapement parts since the 2000s.'],
  ['Chronometer', 'ind', 'A watch certified for precision, usually by COSC (−4/+6 seconds a day for mechanical movements).'],
  ['Bezel', 'case', 'The ring around the crystal. It may be fixed, decorative, or rotate to track elapsed time or time zones.'],
  ['Dive bezel', 'case', 'A unidirectional rotating bezel with a minute scale; it only turns one way so an accident can only shorten a dive.'],
  ['Tachymeter', 'case', 'A scale on the bezel or dial for converting elapsed time into speed over a known distance.'],
  ['Crown', 'case', 'The knob used to wind the watch and set time and date.'],
  ['Screw-down crown', 'case', 'A crown that screws onto the case tube to seal out water — essential on dive watches.'],
  ['Crown guards', 'case', 'Shoulders on the case that protect the crown from knocks.'],
  ['Lugs', 'case', 'The horns that project from the case to hold the strap or bracelet.'],
  ['Exhibition case back', 'case', 'A sapphire window in the back of the case that shows off the movement.'],
  ['Water resistance', 'case', 'A pressure rating, not a depth guide. 100 m suits swimming; 200 m+ is dive-ready.'],
  ['Integrated bracelet', 'case', 'A bracelet that flows seamlessly from the case, as on the Royal Oak and Nautilus.'],
  ['Sapphire crystal', 'mat', 'Synthetic corundum used for the watch glass. Nearly scratch-proof; only diamond is harder.'],
  ['904L steel', 'mat', 'A highly corrosion-resistant steel alloy used by Rolex (which calls it Oystersteel) and others.'],
  ['Titanium', 'mat', 'About 40% lighter than steel, hypoallergenic, and with a slightly warmer grey.'],
  ['Ceramic', 'mat', 'Zirconium oxide, used for bezels and cases. Scratch-proof and fade-proof, but can shatter if dropped.'],
  ['Bronze', 'mat', 'A copper alloy that develops a unique patina over time.'],
  ['Carbon composite', 'mat', 'Ultra-light layered carbon materials, popularised by Richard Mille and Audemars Piguet.'],
  ['18k gold', 'mat', '75% pure gold alloyed with other metals to make yellow, rose (Everose, Sedna, King Gold…) or white gold.'],
  ['Platinum', 'mat', 'The densest and rarest precious case metal, often signalled by a discreet detail such as a diamond at 6 o’clock.'],
  ['Guilloché', 'dial', 'Intricate engraved patterns cut into a dial with a rose-engine lathe.'],
  ['Sunburst', 'dial', 'A dial finish of fine radial brushing that catches light and appears to shimmer.'],
  ['Grand Feu enamel', 'dial', 'Vitreous enamel fired repeatedly above 800°C; deep, glossy and unfading, but many dials crack in the kiln.'],
  ['Lume', 'dial', 'Luminescent paint on the hands and indices, such as Super-LumiNova, that glows in the dark.'],
  ['Applied indices', 'dial', 'Hour markers made as separate pieces and fixed to the dial, rather than printed.'],
  ['Subdial', 'dial', 'A small secondary dial, e.g. for chronograph counters or small seconds.'],
  ['Skeleton', 'dial', 'A dial and movement cut away to reveal the mechanism.'],
  ['Swiss Made', 'ind', 'Legal label requiring at least 60% of manufacturing cost, and the movement, to be Swiss.'],
  ['Geneva Seal', 'ind', 'The Poinçon de Genève: a hallmark for movements made and finished to strict standards in the canton of Geneva.'],
  ['Haute horlogerie', 'ind', '“High watchmaking” — the top tier of craft, complications and hand-finishing.'],
  ['Manufacture', 'ind', 'A watchmaker that produces its own movements and most of its components in-house.'],
  ['Microbrand', 'ind', 'A small, usually online-first watch company, often founded by enthusiasts and selling direct.'],
  ['Grey market', 'ind', 'New watches sold by unauthorised dealers — often discounted for some brands, at a premium for others.'],
  ['Reference number', 'ind', 'The maker’s code for a specific model variant, like 5711/1A or 116610LN — collectors’ shorthand.'],
  ['Homage', 'ind', 'A watch closely imitating the design of a famous model, usually at a fraction of its price.'],
  ['Quartz Crisis', 'ind', 'The 1970s–80s upheaval when cheap, accurate quartz watches devastated the traditional mechanical industry.'],
];

const ANATOMY = [
  { n: 1, name: 'Bezel', x: 200, y: 88, tx: 40, ty: 60, d: 'The ring around the crystal. This one rotates one way to time a dive.' },
  { n: 2, name: 'Crystal', x: 250, y: 140, tx: 360, ty: 60, d: 'Sapphire glass protecting the dial.' },
  { n: 3, name: 'Crown', x: 322, y: 200, tx: 360, ty: 200, d: 'Winds the movement and sets the time.' },
  { n: 4, name: 'Pushers', x: 312, y: 150, tx: 360, ty: 130, d: 'Start, stop and reset the chronograph.' },
  { n: 5, name: 'Subdial', x: 200, y: 245, tx: 40, ty: 330, d: 'A chronograph counter recording elapsed minutes.' },
  { n: 6, name: 'Hands', x: 212, y: 170, tx: 360, ty: 270, d: 'Hour, minute and central seconds hands.' },
  { n: 7, name: 'Indices', x: 138, y: 200, tx: 40, ty: 200, d: 'Hour markers, here applied and filled with lume.' },
  { n: 8, name: 'Lugs', x: 145, y: 92, tx: 40, ty: 130, d: 'Hold the strap or bracelet to the case.' },
  { n: 9, name: 'Date window', x: 268, y: 206, tx: 360, ty: 330, d: 'An aperture revealing the date disc.' },
];

function anatomySVG() {
  const ticks = Array.from({ length: 60 }, (_, i) => { const a = i * 6 * Math.PI / 180, r1 = i % 5 ? 92 : 86; return `<line x1="${200 + Math.sin(a) * r1}" y1="${200 - Math.cos(a) * r1}" x2="${200 + Math.sin(a) * 96}" y2="${200 - Math.cos(a) * 96}" class="${i % 5 ? 'an-min' : 'an-hr'}"/>`; }).join('');
  const bez = Array.from({ length: 12 }, (_, i) => { const a = i * 30 * Math.PI / 180; return i === 0 ? `<path d="M200 ${200 - 118} l-6 -9 h12 z" class="an-tri"/>` : `<text x="${200 + Math.sin(a) * 112}" y="${200 - Math.cos(a) * 112}" class="an-bez" dy="0.35em">${i * 5}</text>`; }).join('');
  const inds = Array.from({ length: 12 }, (_, i) => { const a = i * 30 * Math.PI / 180; if (i === 3) return ''; const c = [200 + Math.sin(a) * 74, 200 - Math.cos(a) * 74]; return i % 3 === 0 ? `<rect x="${c[0] - 4}" y="${c[1] - 9}" width="8" height="18" rx="1.5" transform="rotate(${i * 30} ${c[0]} ${c[1]})" class="an-idx"/>` : `<circle cx="${c[0]}" cy="${c[1]}" r="5" class="an-idx"/>`; }).join('');
  const callouts = ANATOMY.map(a => `<g class="an-call" data-n="${a.n}" tabindex="0" role="button" aria-label="${a.n}. ${a.name}: ${a.d}">
      <path d="M${a.x} ${a.y} L${a.tx < 200 ? a.tx + 22 : a.tx - 22} ${a.ty}" class="an-leader"/>
      <circle cx="${a.x}" cy="${a.y}" r="3" class="an-pin"/>
      <circle cx="${a.tx}" cy="${a.ty}" r="13" class="an-badge"/><text x="${a.tx}" y="${a.ty}" dy="0.35em" class="an-num">${a.n}</text></g>`).join('');
  return `<svg viewBox="0 0 400 400" class="vw-anatomy__svg" role="group" aria-label="Labelled diagram of a dive chronograph">
    <rect x="160" y="0" width="80" height="70" rx="6" class="an-strap"/><rect x="160" y="330" width="80" height="70" rx="6" class="an-strap"/>
    <path d="M140 110 L150 60 H178 L182 100 Z M260 110 L250 60 H222 L218 100 Z M140 290 L150 340 H178 L182 300 Z M260 290 L250 340 H222 L218 300 Z" class="an-case"/>
    <rect x="312" y="188" width="20" height="24" rx="4" class="an-case"/>
    <rect x="300" y="134" width="14" height="16" rx="3" class="an-case" transform="rotate(-38 307 142)"/>
    <rect x="300" y="250" width="14" height="16" rx="3" class="an-case" transform="rotate(38 307 258)"/>
    <circle cx="200" cy="200" r="130" class="an-case"/>
    <circle cx="200" cy="200" r="122" class="an-bezelring"/>
    ${bez}
    <circle cx="200" cy="200" r="100" class="an-dial"/>
    ${ticks}${inds}
    <circle cx="200" cy="245" r="22" class="an-sub"/><line x1="200" y1="245" x2="200" y2="229" class="an-subhand"/>
    <circle cx="200" cy="155" r="22" class="an-sub"/><line x1="200" y1="155" x2="212" y2="146" class="an-subhand"/>
    <rect x="262" y="192" width="22" height="16" rx="2" class="an-date"/><text x="273" y="200" dy="0.35em" class="an-datet">25</text>
    <path d="M200 200 L196 150 L200 138 L204 150 Z" class="an-hand" transform="rotate(-60 200 200)"/>
    <path d="M200 200 L197 128 L200 112 L203 128 Z" class="an-hand" transform="rotate(62 200 200)"/>
    <line x1="200" y1="222" x2="200" y2="110" class="an-sec" transform="rotate(140 200 200)"/>
    <circle cx="200" cy="200" r="5" class="an-cap"/>
    <circle cx="200" cy="200" r="100" class="an-glass"/>
    ${callouts}
  </svg>`;
}

const SHAPES = [
  ['round', 'Round', 'The classic. Most watches ever made.'], ['cushion', 'Cushion', 'Softened square; vintage divers.'],
  ['tonneau', 'Tonneau', 'Barrel-shaped, curved to the wrist.'], ['rectangular', 'Rectangular', 'Art Deco dress, e.g. the Tank.'],
  ['square', 'Square', 'Bold, architectural.'], ['octagon', 'Octagon', 'Sport-luxury, e.g. the Royal Oak.'],
];

const COST = [
  { k: 'Retail & distribution', v: 40, d: 'Boutique rent, staff and the dealer’s margin — often the single largest share.' },
  { k: 'Marketing & brand', v: 20, d: 'Ambassadors, sponsorships, advertising and flagship stores.' },
  { k: 'Brand profit', v: 15, d: 'What the maker keeps after all costs.' },
  { k: 'Labour & finishing', v: 12, d: 'Assembly, regulation, hand-decoration, quality control.' },
  { k: 'Movement', v: 7, d: 'The engine — far more if made in-house with complications.' },
  { k: 'Case, dial & bracelet', v: 6, d: 'Materials and machining; precious metals change everything.' },
];

let cleanup = [];

export default {
  title: 'Learn',
  render(root, ctx) {
    this.destroy();
    const wrap = document.createElement('div');
    wrap.className = 'vw vw-learn';
    root.appendChild(wrap);

    const byGroup = g => ctx.brands.filter(b => b.parentGroup === g).sort((a, b) => (b.priceTier || 0) - (a.priceTier || 0));
    const tierExamples = t => ctx.brands.filter(b => b.priceTier === t).sort((a, b) => (b.popularity || 0) - (a.popularity || 0)).slice(0, 4);
    const brandLinks = list => list.map(b => `<a href="#/brand/${esc(b.id)}">${esc(b.name)}</a>`).join('<span aria-hidden="true"> · </span>');
    const shapeVisual = (shape) => ({ ...(ctx.fallbackVisual?.('learn-' + shape) || {}), caseShape: shape, caseMetal: 'steel', dialColor: '#1d2b3a', dialTexture: 'sunburst', bezel: shape === 'octagon' ? 'octagon-screws' : 'smooth', bezelColor: null, bezelColor2: null, hands: 'dauphine', handColor: '#e9e4d6', indices: 'baton', indexColor: '#e9e4d6', complications: [], strap: 'leather', strapColor: '#3b2a1d', crown: 'normal' });
    const SECTIONS = [['anatomy', 'Anatomy'], ['glossary', 'Glossary'], ['pricing', 'Pricing'], ['quartz', 'Quartz Crisis'], ['groups', 'The Swiss groups'], ['tiers', 'Tier scale']];

    wrap.innerHTML = `
      ${header({ eyebrow: 'The primer', title: 'Learn the Language of <em>Watches</em>', lede: 'Everything you need to read a spec sheet, hold your own with a collector and understand why one steel watch costs $200 and another $20,000.' })}
      <nav class="vw-toc" aria-label="On this page">${SECTIONS.map(([id, l], i) => `<a href="#/learn" data-jump="${id}"><span>${String(i + 1).padStart(2, '0')}</span>${l}</a>`).join('')}</nav>

      <section class="vw-sec" id="learn-anatomy" aria-labelledby="h-anatomy">
        <p class="vw-eyebrow">01</p><h2 class="vw-h2 vw-h2--big" id="h-anatomy">Anatomy of a watch</h2>
        <div class="vw-anatomy">
          <figure class="vw-anatomy__fig">${anatomySVG()}<figcaption>A dive chronograph, in schematic. Hover or tab through the numbers.</figcaption></figure>
          <ol class="vw-anatomy__list">${ANATOMY.map(a => `<li data-n="${a.n}"><span class="vw-anatomy__n">${a.n}</span><div><b>${a.name}</b><p>${a.d}</p></div></li>`).join('')}</ol>
        </div>
        <h3 class="vw-h3">Case shapes</h3>
        <div class="vw-shapes">${SHAPES.map(([s, l, d]) => `<figure class="vw-shape"><div class="vw-shape__art">${watchSVG(ctx, { visual: shapeVisual(s), name: l }, null, { size: 120, title: `${l} case` })}</div><figcaption><b>${l}</b><span>${d}</span></figcaption></figure>`).join('')}</div>
      </section>

      <section class="vw-sec" id="learn-glossary" aria-labelledby="h-glossary">
        <p class="vw-eyebrow">02</p><h2 class="vw-h2 vw-h2--big" id="h-glossary">Glossary</h2>
        <div class="vw-gloss__bar">
          <label class="vw-search"><span class="vw-sr">Search the glossary</span><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5"/></svg>
            <input type="search" placeholder="Search ${GLOSSARY.length} terms…" data-gq></label>
          <div class="vw-chips" role="group" aria-label="Glossary category">
            <button type="button" class="vw-chip" data-gc="" aria-pressed="true">All</button>
            ${Object.entries(CATS).map(([k, v]) => `<button type="button" class="vw-chip" data-gc="${k}" aria-pressed="false">${v}</button>`).join('')}
          </div>
        </div>
        <p class="vw-gloss__count" aria-live="polite"></p>
        <dl class="vw-gloss"></dl>
      </section>

      <section class="vw-sec" id="learn-pricing" aria-labelledby="h-pricing">
        <p class="vw-eyebrow">03</p><h2 class="vw-h2 vw-h2--big" id="h-pricing">How watch pricing works</h2>
        <div class="vw-cols">
          <div class="vw-prose">
            <p>A watch’s price has surprisingly little to do with what it is made of. A steel case and a good automatic movement cost a few hundred dollars to produce; the rest reflects <em>distribution, brand and scarcity</em>.</p>
            <p><b>Movement.</b> An off-the-shelf Swiss or Japanese calibre may cost the brand under $100; an in-house chronograph can cost thousands to develop and make, and a minute repeater may take a single watchmaker months.</p>
            <p><b>Finishing.</b> Hand-bevelled bridges, Geneva stripes and black-polished screws multiply labour hours — this is where haute horlogerie earns its keep.</p>
            <p><b>Materials.</b> Gold and platinum can add $10,000–40,000 over steel for the same model; ceramic and exotic composites add engineering cost.</p>
            <p><b>Brand & scarcity.</b> The strongest names deliberately under-supply, so some steel sports models trade above retail on the secondary market.</p>
          </div>
          <figure class="vw-cost">
            <figcaption>Where a $10,000 luxury watch’s price typically goes <span class="vw-muted">(illustrative industry estimate)</span></figcaption>
            <div class="vw-cost__bar" role="img" aria-label="${esc(COST.map(c => `${c.k} ${c.v}%`).join(', '))}">${COST.map((c, i) => `<i style="flex:${c.v};--o:${1 - i * 0.13}" title="${esc(c.k)}: ${c.v}%"></i>`).join('')}</div>
            <ul class="vw-cost__legend">${COST.map((c, i) => `<li style="--o:${1 - i * 0.13}"><i></i><b>${c.k}</b><span class="vw-cost__v">${c.v}% · ${fmtUSD(c.v * 100, { compact: false })}</span><p>${c.d}</p></li>`).join('')}</ul>
          </figure>
        </div>
      </section>

      <section class="vw-sec" id="learn-quartz" aria-labelledby="h-quartz">
        <p class="vw-eyebrow">04</p><h2 class="vw-h2 vw-h2--big" id="h-quartz">The Quartz Crisis</h2>
        <div class="vw-cols">
          <div class="vw-prose">
            <p class="vw-dropcap">On Christmas Day 1969, Seiko released the Astron, the world’s first quartz wristwatch. It cost as much as a small car — but it was a hundred times more accurate than any mechanical watch, and within a decade quartz movements cost only a few dollars.</p>
            <p>Swiss watchmaking, a proud cottage industry of hundreds of small workshops, was caught flat-footed. Ironically, Swiss engineers had built quartz prototypes (the Beta 21) first, but the industry saw them as a curiosity. Japanese and later Hong Kong factories flooded the world with cheap, precise watches.</p>
            <p>By the early 1980s the Swiss industry had shed roughly two-thirds of its jobs, and famous names were sold, merged or simply closed. The rescue came from an unlikely product: the <b>Swatch</b>, a cheap, colourful plastic quartz watch launched in 1983 by the merged ASUAG-SSIH under Nicolas G. Hayek. Its profits and scale funded the revival of mechanical watchmaking as a luxury — the <em>mechanical renaissance</em> of the 1990s.</p>
          </div>
          <ol class="vw-qtl">
            <li><span>1969</span><p>Seiko Astron — first quartz wristwatch. Also: Zenith El Primero and Heuer Calibre 11, the first automatic chronographs.</p></li>
            <li><span>1970</span><p>Hamilton Pulsar prototype — the first LED digital watch.</p></li>
            <li><span>1973</span><p>Seiko introduces the first six-digit LCD watch.</p></li>
            <li><span>1970–84</span><p>Swiss watch employment falls from about 90,000 to around 30,000.</p></li>
            <li><span>1983</span><p>ASUAG and SSIH merge; the Swatch is launched.</p></li>
            <li><span>1998</span><p>The merged company becomes The Swatch Group.</p></li>
          </ol>
        </div>
      </section>

      <section class="vw-sec" id="learn-groups" aria-labelledby="h-groups">
        <p class="vw-eyebrow">05</p><h2 class="vw-h2 vw-h2--big" id="h-groups">The three Swiss groups</h2>
        <p class="vw-prose vw-prose--wide">Most famous Swiss brands belong to one of three owners. Alongside them stands Rolex — privately held by a foundation — and a proud cohort of family-owned independents such as Patek Philippe and Audemars Piguet.</p>
        <div class="vw-trio">
          ${[
            ['Swatch Group', 'Biel/Bienne · founded 1983', 'The volume leader and the industry’s engine room: it owns ETA and Nivarox, which supply movements and hairsprings far beyond its own brands.'],
            ['Richemont', 'Geneva · founded 1988', 'Jewellery-led luxury with the most prestigious watch portfolio: Cartier alongside the “Specialist Watchmakers” of haute horlogerie.'],
            ['LVMH', 'Paris · watches since 1999', 'Fashion-house marketing muscle applied to watches, with a focus on sport, bold design and celebrity.'],
          ].map(([g, sub, d]) => { const bs = byGroup(g); return `<article class="vw-trio__card"><h3>${g}</h3><p class="vw-muted">${sub}</p><p>${d}</p>
            ${bs.length ? `<p class="vw-trio__brands">${brandLinks(bs)}</p>` : ''}<a class="vw-link" href="#/groups?group=${encodeURIComponent(g)}">Explore the group →</a></article>`; }).join('')}
        </div>
      </section>

      <section class="vw-sec" id="learn-tiers" aria-labelledby="h-tiers">
        <p class="vw-eyebrow">06</p><h2 class="vw-h2 vw-h2--big" id="h-tiers">Reading our tier scale</h2>
        <p class="vw-prose vw-prose--wide">Every brand carries a price tier from 1 to 10, based on the typical price of its core collection — not its cheapest or most extravagant piece. Each tier roughly doubles or triples the one below, so the scale is logarithmic, just like the <a href="#/prices">Price Ladder</a>.</p>
        <ol class="vw-tierscale">${TIERS.map(t => { const ex = tierExamples(t.tier); return `<li style="--tc:${tierVar(t.tier)};--w:${t.tier * 10}%">
          <span class="vw-tierscale__n">${t.tier}</span><span class="vw-tierscale__name">${t.name}<em>${t.label}</em></span>
          <span class="vw-tierscale__bar"><i></i></span><span class="vw-tierscale__ex">${ex.length ? brandLinks(ex) : '<span class="vw-muted">—</span>'}</span></li>`; }).join('')}</ol>
      </section>`;

    // glossary
    const gState = { q: '', c: '' };
    const gEl = wrap.querySelector('.vw-gloss'), gCount = wrap.querySelector('.vw-gloss__count');
    const sorted = [...GLOSSARY].sort((a, b) => a[0].localeCompare(b[0]));
    function renderGloss() {
      const q = gState.q.trim().toLowerCase();
      const list = sorted.filter(([t, c, d]) => (!gState.c || c === gState.c) && (!q || t.toLowerCase().includes(q) || d.toLowerCase().includes(q)));
      gCount.textContent = `${list.length} of ${GLOSSARY.length} terms`;
      let letter = '';
      const hl = s => q ? esc(s).replace(new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), m => `<mark>${m}</mark>`) : esc(s);
      gEl.innerHTML = list.map(([t, c, d]) => {
        const L = t[0].toUpperCase().normalize('NFD')[0];
        const head = L !== letter ? (letter = L, `<div class="vw-gloss__letter" aria-hidden="true">${L}</div>`) : '';
        return `${head}<div class="vw-gloss__item"><dt>${hl(t)} <span class="vw-gloss__cat">${CATS[c]}</span></dt><dd>${hl(d)}</dd></div>`;
      }).join('') || '<p class="vw-empty">No terms match. Try “bezel” or “tourbillon”.</p>';
    }
    wrap.querySelector('[data-gq]').addEventListener('input', debounce(e => { gState.q = e.target.value; renderGloss(); }, 100));
    wrap.querySelector('#learn-glossary .vw-chips').addEventListener('click', e => {
      const b = e.target.closest('[data-gc]'); if (!b) return;
      gState.c = b.dataset.gc;
      b.parentElement.querySelectorAll('[data-gc]').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
      renderGloss();
    });
    renderGloss();

    // anatomy highlight
    const fig = wrap.querySelector('.vw-anatomy');
    const hi = n => fig.querySelectorAll('[data-n]').forEach(el => el.classList.toggle('is-hi', el.dataset.n === n));
    fig.addEventListener('mouseover', e => { const t = e.target.closest('[data-n]'); hi(t ? t.dataset.n : null); });
    fig.addEventListener('focusin', e => { const t = e.target.closest('[data-n]'); hi(t ? t.dataset.n : null); });
    fig.addEventListener('mouseleave', () => hi(null));

    // in-page nav (hash routing safe)
    wrap.querySelector('.vw-toc').addEventListener('click', e => {
      const a = e.target.closest('[data-jump]'); if (!a) return;
      e.preventDefault();
      const el = wrap.querySelector('#learn-' + a.dataset.jump);
      el.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' });
      el.querySelector('h2').setAttribute('tabindex', '-1'); el.querySelector('h2').focus({ preventScroll: true });
    });
    if (ctx.params?.section) requestAnimationFrame(() => wrap.querySelector('#learn-' + ctx.params.section)?.scrollIntoView({ block: 'start' }));
  },
  destroy() { cleanup.forEach(f => f()); cleanup = []; },
};
