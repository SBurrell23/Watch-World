// Complication illustrations 25–36 (astronomical tail, timing, travel). See data/COMPLICATIONS.md → Illustrations.
// Every drawing: viewBox 0 0 200 200, dial centred at 100,100, colours only via --cx-* variables.

const r1 = (n) => Math.round(n * 10) / 10;
// Point on a circle; angle in degrees clockwise from 12 o'clock.
const pt = (cx, cy, r, a) => {
  const t = (a * Math.PI) / 180;
  return [r1(cx + r * Math.sin(t)), r1(cy - r * Math.cos(t))];
};
const F = (c, x = '') => `style="fill:var(--cx-${c})${x}"`;
const S = (c, w, x = '') => `style="fill:none;stroke:var(--cx-${c});stroke-width:${w}${x}"`;
const P = (d, st) => `<path d="${d}" ${st}/>`;
const C = (cx, cy, r, st) => `<circle cx="${cx}" cy="${cy}" r="${r}" ${st}/>`;
const T = (x, y, size, c, txt, { w = 500, ls = 0.1, rot } = {}) =>
  `<text x="${x}" y="${y}" text-anchor="middle"${rot != null ? ` transform="rotate(${r1(rot)} 100 100)"` : ''} style="font-family:var(--cx-font);font-size:${size}px;font-weight:${w};letter-spacing:${ls}em;fill:var(--cx-${c})">${txt}</text>`;
const G = (cls, cx, cy, inner, x = '') => `<g class="${cls}" style="transform-origin:${cx}px ${cy}px${x}">${inner}</g>`;
// Text centred on radius r at angle a, flipped on the lower half so it never reads upside-down.
// items: [[text, angle], …]; one shared style group keeps the markup small.
const ringText = (items, r, size, c, w = 600) =>
  `<g text-anchor="middle" style="font-family:var(--cx-font);font-size:${size}px;font-weight:${w};fill:var(--cx-${c})">${items
    .map(([t, a]) => {
      const flip = a > 100 && a < 260;
      return `<text x="100" y="${r1((flip ? 100 + r : 100 - r) + size * 0.35)}" transform="rotate(${r1(flip ? a - 180 : a)} 100 100)">${t}</text>`;
    })
    .join('')}</g>`;
const svg = (inner) => `<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${inner}</svg>`;

// Radial tick path: n ticks between radii ra..rb, optionally skipping some indices.
const ticks = (cx, cy, ra, rb, n, skip, a0 = 0, span = 360) => {
  let d = '';
  for (let i = 0; i < n; i++) {
    if (skip && skip(i)) continue;
    const a = a0 + (span * i) / n;
    const [x1, y1] = pt(cx, cy, ra, a);
    const [x2, y2] = pt(cx, cy, rb, a);
    d += `M${x1} ${y1}L${x2} ${y2}`;
  }
  return d;
};
const radial = (angles, ra, rb) =>
  angles.map((a) => { const [x1, y1] = pt(100, 100, ra, a), [x2, y2] = pt(100, 100, rb, a); return `M${x1} ${y1}L${x2} ${y2}`; }).join('');

// Case furniture
const crown = (a = 90, c = 'case') =>
  `<g transform="rotate(${a} 100 100)"><rect x="94.5" y="4" width="11" height="8" rx="1.8" ${F(c)}/>${P('M97 5.5V10.5M100 5.5V10.5M103 5.5V10.5', S('dial', 0.6, ';opacity:.5'))}</g>`;
const pusher = (a, c = 'case', cls = '') =>
  `<g transform="rotate(${a} 100 100)"><rect x="98" y="7" width="4" height="6" ${F(c)}/><rect x="95.8" y="3.6" width="8.4" height="4.4" rx="1.2"${cls ? ` class="${cls}" style="fill:var(--cx-${c})"` : ` ${F(c)}`}/></g>`;
const kase = () => C(100, 100, 88.5, S('case', 2.6)) + C(100, 100, 85.6, F('dial')) + C(100, 100, 85.6, S('case', 0.5));
const track = (ri = 80) => P(ticks(100, 100, ri, 84, 60, (i) => i % 5 === 0), S('muted', 0.5)) + P(ticks(100, 100, ri - 2, 84, 12), S('line', 0.9));
const indices = (skip, ra = 64, rb = 74) => P(ticks(100, 100, ra, rb, 12, skip), S('line', 2.2));

// Hands (drawn pointing to 12, rotated by deg)
const leaf = (cx, cy, len, w, tail, c, deg) =>
  `<path${deg ? ` transform="rotate(${deg} ${cx} ${cy})"` : ''} d="M${cx} ${cy + tail}L${cx - w} ${cy}L${cx} ${cy - len}L${cx + w} ${cy}Z" ${F(c)}/>`;
const needle = (cx, cy, len, tail, c, w = 0.9, cw = 2) =>
  P(`M${cx} ${cy + tail}V${cy - len}`, S(c, w, ';stroke-linecap:round')) + C(cx, cy + tail - cw, cw, F(c));
const cap = (cx = 100, cy = 100, c = 'gold', r = 2.8) => C(cx, cy, r, F(c)) + C(cx, cy, r1(r * 0.35), F('dial'));
const mainHands = (h = 305, m = 60, hl = 40, ml = 60) => leaf(100, 100, hl, 3.2, 8, 'line', h) + leaf(100, 100, ml, 2.5, 10, 'line', m);

const subdial = (cx, cy, r, n = 12) =>
  C(cx, cy, r, S('muted', 0.6)) + P(ticks(cx, cy, r - 3, r, n), S('muted', 0.5)) + P(ticks(cx, cy, r - 5, r, 4), S('line', 0.8));

// ---------- chronograph family ----------
function chrono(o, { pushers = [], crownEl = crown(), subs = [], skip, label, labelY = 142, hands = '', hm = [305, 60] }) {
  let s = crownEl + pushers.join('') + kase() + track() + indices(skip);
  for (const sd of subs) {
    s += subdial(sd.x, sd.y, sd.r, sd.n) + G(sd.cls, sd.x, sd.y, needle(sd.x, sd.y, sd.r - 3, 4, sd.c, 0.9, 1.3)) + cap(sd.x, sd.y, sd.c, 1.6);
  }
  if (label) s += T(100, labelY, 6.5, 'gold', label, { w: 600, ls: 0.18 });
  s += mainHands(...hm) + hands + cap();
  return svg(s);
}
const chronoHand = (cls = 'cx-spin-12s', c = 'gold', x = '') => G(cls, 100, 100, needle(100, 100, 80, 18, c, 1, 2.4), x);

const scaleDial = (o, marks, minors, label, cue) => {
  let s = crown() + pusher(60) + pusher(120) + kase();
  s += C(100, 100, 77.5, S('gold', 0.5)) + P(radial(minors, 80.5, 84.5), S('gold', 0.5)) + P(radial(marks.map((m) => m[1]), 78, 84.5), S('gold', 0.9));
  s += ringText(marks, 69.5, 6.6, 'gold');
  s += C(100, 100, 62, S('muted', 0.4)) + P(ticks(100, 100, 59, 62, 60), S('muted', 0.4)) + indices((i) => i === 6, 47, 56);
  s += T(100, 74, 6, 'gold', label, { w: 600, ls: 0.2 }) + cue;
  s += mainHands(305, 60, 32, 50) + chronoHand() + cap();
  return svg(s);
};

export default {
  'sunrise-sunset': (o) => {
    const sky = 'M44 100A56 56 0 0 1 156 100Z';
    const sun = C(100, 58, 6, F('gold')) + P(ticks(100, 58, 8.5, 12, 12), S('gold', 0.9, ';stroke-linecap:round'));
    const stars = [[70, 76], [82, 62], [128, 70], [118, 84], [140, 88], [60, 92]].map(([x, y]) => C(x, y, 0.8, F('gold', ';opacity:.75'))).join('');
    let s = crown() + kase() + track();
    s += `<clipPath id="${o.uid}-sky"><path d="${sky}"/></clipPath>`;
    s += P(sky, F('night')) + `<g clip-path="url(#${o.uid}-sky)">${stars}${G('cx-spin-12s', 100, 100, `<g transform="rotate(-90 100 100)">${sun}</g>`)}</g>`;
    s += P('M44 100A56 56 0 0 1 156 100', S('gold', 0.8));
    // 24-hour scale over the aperture, noon at the top
    s += P(ticks(100, 100, 60, 63, 24, (i) => i > 12, -90, 360), S('muted', 0.6));
    s += [[-90, '6'], [-45, '9'], [0, '12'], [45, '15'], [90, '18']].map(([a, t]) => { const [x, y] = pt(100, 100, 69, a); return T(x, r1(y + 2.3), 6.5, 'muted', t, { ls: 0 }); }).join('');
    // sunrise / sunset markers
    s += [-80, 80].map((a) => `<path transform="rotate(${a} 100 100)" d="M100 44.5L97 38.5H103Z" ${F('gold')}/>`).join('');
    s += P('M36 100H164', S('gold', 1.1, ';stroke-linecap:round'));
    s += T(70, 115, 5.8, 'muted', 'RISE', { w: 600, ls: 0.2 }) + T(70, 125, 8, 'gold', '06:40', { w: 500, ls: 0.02 });
    s += T(130, 115, 5.8, 'muted', 'SET', { w: 600, ls: 0.2 }) + T(130, 125, 8, 'gold', '17:20', { w: 500, ls: 0.02 });
    s += subdial(100, 148, 17) + leaf(100, 148, 9, 1.8, 3, 'line', 300) + leaf(100, 148, 13, 1.4, 4, 'line', 50) + cap(100, 148, 'line', 1.6);
    return svg(s);
  },

  'tide-indicator': (o) => {
    const cx = 100, cy = 134, r = 30;
    const wave = (y) => `M60 ${y}q6-4 12 0t12 0t12 0t12 0t12 0t12 0t12 0`;
    let s = crown() + kase() + track() + indices((i) => i >= 4 && i <= 8);
    s += `<clipPath id="${o.uid}-sea"><circle cx="${cx}" cy="${cy}" r="${r - 0.6}"/></clipPath>`;
    s += C(cx, cy, r, F('dial'));
    s += `<g clip-path="url(#${o.uid}-sea)">${G('cx-slide', cx, cy, `<path d="${wave(146)}V172H60Z" ${F('night')}/>${P(wave(146), S('blue', 1.2))}${P(wave(152), S('blue', 0.5, ';opacity:.6'))}`)}</g>`;
    s += C(cx, cy, r, S('gold', 0.9)) + P(ticks(cx, cy, r - 4, r, 12), S('muted', 0.6));
    s += `<path d="M${cx} ${cy - r + 0.5}l-2.4-5h4.8Z" ${F('red')}/>`;
    s += T(cx, cy - 16, 5.6, 'gold', 'HIGH', { w: 600, ls: 0.16 }) + T(cx, cy + 24, 5.6, 'gold', 'LOW', { w: 600, ls: 0.16 });
    s += G('cx-spin-12s', cx, cy, `<g transform="rotate(40 ${cx} ${cy})"><path d="M${cx} ${cy + 5}V${cy - 20}" ${S('gold', 1.1)}/><path d="M${cx} ${cy - 26}l-3 6h6Z" ${F('gold')}/></g>`);
    s += cap(cx, cy, 'gold', 2);
    s += mainHands(305, 60, 36, 58) + cap(100, 100, 'line');
    return svg(s);
  },

  chronograph: (o) =>
    chrono(o, {
      pushers: [pusher(60, 'gold'), pusher(120, 'gold')],
      subs: [{ x: 62, y: 100, r: 19, c: 'line', cls: 'cx-spin-60s' }, { x: 138, y: 100, r: 19, c: 'gold', cls: 'cx-tick-60' }],
      skip: (i) => i === 3 || i === 9,
      label: 'CHRONOGRAPH',
      hands: chronoHand(),
    }),

  'monopusher-chronograph': (o) =>
    chrono(o, {
      crownEl: `<g transform="rotate(90 100 100)"><rect x="97" y="0.6" width="6" height="4.4" rx="1.2" class="cx-pulse" style="fill:var(--cx-gold)"/></g>` + crown(90, 'gold'),
      subs: [{ x: 100, y: 60, r: 17, c: 'gold', cls: 'cx-tick-60' }, { x: 100, y: 146, r: 16, c: 'line', cls: 'cx-spin-60s' }],
      skip: (i) => i === 0 || i === 6,
      label: 'MONOPUSHER',
      labelY: 126,
      hm: [300, 70],
      hands: chronoHand(),
    }),

  'flyback-chronograph': (o) => {
    const [ex, ey] = pt(100, 100, 62, 12), [tx, ty] = pt(100, 100, 62, 3), [b1x, b1y] = pt(100, 100, 58, 13), [b2x, b2y] = pt(100, 100, 66, 13);
    const [sx, sy] = pt(100, 100, 62, 116);
    const arrow = `<g class="cx-pulse">${P(`M${sx} ${sy}A62 62 0 0 0 ${ex} ${ey}`, S('gold', 1.1, ';stroke-dasharray:3 2'))}<path d="M${tx} ${ty}L${b1x} ${b1y}L${b2x} ${b2y}Z" ${F('gold')}/></g>`;
    return chrono(o, {
      pushers: [pusher(60, 'case'), pusher(120, 'gold', 'cx-pulse')],
      subs: [{ x: 62, y: 100, r: 19, c: 'line', cls: 'cx-spin-60s' }, { x: 138, y: 100, r: 17, c: 'gold', cls: 'cx-tick-60' }],
      skip: (i) => i === 3 || i === 9,
      label: 'FLYBACK',
      hands: arrow + chronoHand('cx-sweep-retro'),
    });
  },

  'split-seconds-chronograph': (o) =>
    chrono(o, {
      pushers: [pusher(60, 'gold'), pusher(120, 'gold'), pusher(305, 'blue')],
      subs: [{ x: 62, y: 100, r: 19, c: 'line', cls: 'cx-spin-60s' }, { x: 138, y: 100, r: 19, c: 'gold', cls: 'cx-tick-60' }],
      skip: (i) => i === 3 || i === 9,
      label: 'RATTRAPANTE',
      hands: `<g transform="rotate(42 100 100)">${needle(100, 100, 80, 18, 'blue', 1.3, 2.6)}</g>` + chronoHand(),
    }),

  tachymeter: (o) =>
    scaleDial(o,
      [[500, 43.2], [400, 54], [300, 72], [250, 86.4], [200, 108], [150, 144], [120, 180], [100, 216], [90, 240], [80, 270], [70, 308.6], [60, 360]],
      [350, 225, 175, 160, 140, 130, 110, 95, 85, 75, 65].map((v) => 21600 / v),
      'TACHYMETRE',
      T(100, 134, 5.5, 'muted', 'UNITS PER HOUR', { w: 500, ls: 0.14 })),

  pulsometer: (o) =>
    scaleDial(o,
      [[200, 54], [160, 67.5], [120, 90], [100, 108], [90, 120], [80, 135], [70, 154.3], [60, 180], [50, 216], [40, 270], [35, 308.6]],
      [180, 150, 140, 130, 110, 95, 85, 75, 65, 55, 45].map((v) => 10800 / v),
      'PULSOMETRE',
      `<path class="cx-pulse" d="M100 139C92 133 89.5 128.5 92 125.6C94 123.4 97.8 124 100 127.2C102.2 124 106 123.4 108 125.6C110.5 128.5 108 133 100 139Z" style="fill:var(--cx-red)"/>` +
        T(100, 152, 5.2, 'muted', 'BASE 30', { w: 500, ls: 0.16 })),

  telemeter: (o) =>
    scaleDial(o,
      [1, 2, 3, 4, 5, 6, 8, 10, 12, 14, 16, 18].map((k) => [k, (k / 0.343) * 6]),
      [7, 9, 11, 13, 15, 17, 19].map((k) => (k / 0.343) * 6),
      'TELEMETRE · KM',
      `<path d="M91 124L85 134H90L87 142L95 131H90L93 124Z" ${F('gold')}/>` +
        [6, 11, 16].map((r, i) => `<path class="cx-pulse" style="fill:none;stroke:var(--cx-gold);stroke-width:.8;animation-delay:${i * 0.35}s" d="M${97 + r * 0.2} ${133 - r * 0.8}A${r} ${r} 0 0 1 ${97 + r * 0.2} ${133 + r * 0.8}"/>`).join('')),

  'regatta-timer': (o) => {
    let s = crown() + pusher(60) + pusher(120) + kase() + track() + indices(null, 66, 74);
    s += P('M100 18A82 82 0 0 1 171 59', S('red', 1.6, ';opacity:.8'));
    [-48, -24, 0, 24, 48].forEach((a, i) => {
      const [x, y] = pt(100, 100, 48, a);
      s += C(x, y, 7.6, F(i % 2 ? 'blue' : 'red')) + `<circle cx="${x}" cy="${y}" r="9.4" class="cx-pulse" style="fill:none;stroke:var(--cx-gold);stroke-width:1.2;animation-delay:${r1(i * 0.32)}s"/>`;
      s += C(x, y, 7.6, S('gold', 0.6)) + T(x, r1(y + 3), 8.4, 'dial', 5 - i, { w: 700, ls: 0 });
    });
    s += T(100, 142, 6.5, 'gold', 'REGATTA', { w: 600, ls: 0.2 });
    s += mainHands(240, 125, 36, 58) + chronoHand() + cap();
    return svg(s);
  },

  gmt: (o) => {
    const [a1, b1] = pt(100, 100, 87, 270), [a2, b2] = pt(100, 100, 87, 90), [c2, d2] = pt(100, 100, 71, 90), [c1, d1] = pt(100, 100, 71, 270);
    let s = crown() + C(100, 100, 88.5, S('case', 2.6)) + C(100, 100, 87, F('dial'));
    s += `<path d="M${a1} ${b1}A87 87 0 0 1 ${a2} ${b2}L${c2} ${d2}A71 71 0 0 0 ${c1} ${d1}Z" ${F('night')}/>`;
    s += `<path d="M${a1} ${b1}A87 87 0 0 0 ${a2} ${b2}L${c2} ${d2}A71 71 0 0 1 ${c1} ${d1}Z" ${F('case', ';opacity:.14')}/>`;
    s += C(100, 100, 87, S('case', 0.6)) + C(100, 100, 71, S('case', 0.8));
    s += P(ticks(100, 100, 83, 86, 24, (i) => i % 2 === 0), S('gold', 0.8));
    s += ringText([2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22].map((h) => [h, h * 15]), 78.6, 7, 'gold');
    s += `<path d="M100 22.5L95.8 15.4H104.2Z" ${F('gold')}/>`;
    s += P(ticks(100, 100, 66, 70, 60, (i) => i % 5 === 0), S('muted', 0.5)) + indices(null, 55, 65);
    s += T(100, 76, 8, 'gold', 'GMT', { w: 700, ls: 0.24 });
    s += mainHands(305, 60, 32, 50);
    s += G('cx-spin-60s', 100, 100, `<g transform="rotate(140 100 100)">${P('M100 108V40', S('gold', 1.2))}<path d="M100 29.5L95 40.5H105Z" ${F('gold')}/></g>`);
    s += G('cx-tick-60', 100, 100, needle(100, 100, 64, 14, 'blue', 0.7, 1.6)) + cap();
    return svg(s);
  },

  'dual-time': (o) => {
    let s = crown(60) + crown(120) + kase() + track();
    s += P(radial([0, 180], 70, 76), S('line', 2.2));
    const dial = (x, c, hDeg, lab) => {
      let d = C(x, 98, 27, F('dial')) + C(x, 98, 27, S(c === 'gold' ? 'gold' : 'muted', 0.8)) + P(ticks(x, 98, 23.5, 26, 12, (i) => i % 3 === 0), S('muted', 0.6)) + P(ticks(x, 98, 21, 26, 4), S(c, 1.4));
      d += leaf(x, 98, 14, 2.2, 4, c, hDeg) + G('cx-spin-12s', x, 98, leaf(x, 98, 21, 1.7, 5, c)) + cap(x, 98, c, 2);
      return d + T(x, 141, 6.4, c, lab, { w: 600, ls: 0.2 });
    };
    s += dial(66, 'line', 300, 'LOCAL') + dial(134, 'gold', 120, 'HOME');
    s += T(100, 52, 6, 'muted', 'DUAL TIME', { w: 500, ls: 0.24 });
    return svg(s);
  },
};
