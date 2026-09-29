// Complication illustrations 13–24 (calendar + astronomical). See data/COMPLICATIONS.md → "Illustrations".
// Each entry: (o = { uid }) => SVG string. Colours only via --cx-* variables; motion only via cx-* classes.

const RAD = Math.PI / 180;
const n1 = (v) => Math.round(v * 10) / 10;
const pt = (cx, cy, r, a) => [n1(cx + r * Math.sin(a * RAD)), n1(cy - r * Math.cos(a * RAD))];

const svg = (label, body) =>
  `<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${label}">${body}</svg>`;

// style="" helper: fill / stroke / width, colours are --cx-* names (null = none)
const st = (fill, stroke, w, extra = '') =>
  `style="fill:${fill ? `var(--cx-${fill})` : 'none'}${stroke ? `;stroke:var(--cx-${stroke});stroke-width:${w}` : ''}${extra}"`;
const circ = (cx, cy, r, fill, stroke, w, extra = '') => `<circle cx="${cx}" cy="${cy}" r="${r}" ${st(fill, stroke, w, extra)}/>`;

// Evenly spaced radial ticks drawn as a dashed ring (n ticks, first at 12 o'clock). tw = tick width in 1/10 of a step.
const ring = (cx, cy, r, n, tw, len, color, extra = '') =>
  `<circle cx="${cx}" cy="${cy}" r="${r}" pathLength="${n * 10}" transform="rotate(-90 ${cx} ${cy})" style="fill:none;stroke:var(--cx-${color});stroke-width:${len};stroke-dasharray:${tw} ${10 - tw};stroke-dashoffset:${tw / 2}${extra}"/>`;

// Radial ticks at explicit angles
const ticks = (cx, cy, r1, r2, angles, color, w) =>
  `<path d="${angles.map((a) => `M${pt(cx, cy, r1, a)}L${pt(cx, cy, r2, a)}`).join('')}" ${st(null, color, w, ';stroke-linecap:round')}/>`;
const hourAngles = (skip = []) => [...Array(12).keys()].filter((i) => !skip.includes(i)).map((i) => i * 30);

// Text
const TG = (size, color, inner, extra = '') =>
  `<g text-anchor="middle" dominant-baseline="central" style="font-family:var(--cx-font);font-size:${size}px;fill:var(--cx-${color})${extra}">${inner}</g>`;
const T = (x, y, s) => `<text x="${x}" y="${y}">${s}</text>`;
const label = (x, y, s, color = 'muted', size = 5) => TG(size, color, T(x, y, s), ';letter-spacing:.14em;font-weight:500');

// Case, dial and minute track
const CASE = () =>
  `<rect x="189.5" y="93" width="7" height="14" rx="2" ${st('case')}/>` +
  circ(100, 100, 89, 'dial', 'case', 2.6) + circ(100, 100, 86.3, null, 'case', 0.5);
const TRACK = () => ring(100, 100, 82.5, 60, 0.5, 2.6, 'muted');

// Leaf hand pointing to 12 (rotate with transform or class)
const leaf = (cx, cy, len, tail, w) => `M${cx},${n1(cy + tail)}L${n1(cx - w)},${cy} ${cx},${n1(cy - len)} ${n1(cx + w)},${cy}Z`;
const rot = (a, cx, cy, inner) => `<g transform="rotate(${a} ${cx} ${cy})">${inner}</g>`;
const spin = (cls, cx, cy, inner) => `<g class="${cls}" style="transform-origin:${cx}px ${cy}px">${inner}</g>`;

// Main hour + minute hands (static, 10:08 by default)
const HANDS = (k = 1, h = 10, m = 8, cx = 100, cy = 100, halo = false) => {
  const hs = halo ? ';stroke:var(--cx-dial);stroke-width:1.4;paint-order:stroke' : '';
  return (
    rot(n1((h % 12) * 30 + m / 2), cx, cy, `<path d="${leaf(cx, cy, 38 * k, 8 * k, 2.3 * k)}" ${st('line', null, 0, hs)}/>`) +
    rot(m * 6, cx, cy, `<path d="${leaf(cx, cy, 60 * k, 10 * k, 1.8 * k)}" ${st('line', null, 0, hs)}/>`) +
    circ(cx, cy, 2.6 * k, 'line') + circ(cx, cy, 1, 'dial')
  );
};

// Gold pointer (date / week / moon-age): thin needle with a tip ornament, spinning slowly around 100,100
const pointer = (a, len, tip, cls = 'cx-spin-60s') =>
  rot(a, 100, 100, spin(cls, 100, 100,
    `<path d="M100,114V${100 - len}" ${st(null, 'gold', 0.9, ';stroke-linecap:round')}/>` + tip + circ(100, 112, 2.2, 'gold') + circ(100, 100, 2.4, 'gold') + circ(100, 100, 0.9, 'dial')));

// Rolling window (disc numerals seen through an aperture) — cx-slide steps the disc up 12 units at a time
const roll = (o, k, x, y, w, h, items, size = 7) =>
  `<clipPath id="${o.uid}${k}"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="1.2"/></clipPath>` +
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="1.2" ${st('line')}/>` +
  `<g clip-path="url(#${o.uid}${k})"><g class="cx-slide">${TG(size, 'dial', items.map((s, i) => T(n1(x + w / 2), n1(y + h / 2 + 0.4 + i * 12), s)).join(''), ';font-weight:600;letter-spacing:.04em')}</g></g>` +
  `<rect x="${n1(x - 1.3)}" y="${n1(y - 1.3)}" width="${n1(w + 2.6)}" height="${n1(h + 2.6)}" rx="2" ${st(null, 'gold', 1)}/>`;

// Classic moon-phase aperture with the two "humps"; disc rotates slowly behind it. (bx,by) = centre of the base line.
const moonAp = (o, k, bx, by, s, a0 = -28) => {
  const P = (x, y) => `${n1(bx + x * s)},${n1(by + y * s)}`;
  const d = `M${P(-32, 0)}A${n1(34 * s)},${n1(34 * s)} 0 0 1 ${P(32, 0)}A${n1(16 * s)},${n1(16 * s)} 0 0 0 ${P(0, 0)}A${n1(16 * s)},${n1(16 * s)} 0 0 0 ${P(-32, 0)}Z`;
  const dy = n1(by + 19 * s);
  const moon = (y) => {
    const my = n1(by + y * s);
    return circ(bx, my, n1(11 * s), 'gold') + circ(n1(bx - 3.5 * s), n1(my - 2.5 * s), n1(2.4 * s), 'dial', null, 0, ';opacity:.16') + circ(n1(bx + 3 * s), n1(my + 3.5 * s), n1(1.6 * s), 'dial', null, 0, ';opacity:.16');
  };
  const stars = [[-22, -8], [20, -14], [-26, 30], [24, 34], [-8, 22], [9, 12], [-30, 12], [31, 8]]
    .map(([x, y], i) => circ(n1(bx + x * s), n1(by + y * s), n1((i % 3 ? 0.7 : 1.1) * s), 'gold')).join('');
  return (
    `<clipPath id="${o.uid}${k}"><path d="${d}"/></clipPath>` +
    `<g clip-path="url(#${o.uid}${k})">${circ(bx, dy, n1(46 * s), 'night')}${rot(a0, bx, dy, spin('cx-spin-60s', bx, dy, stars + moon(-11) + moon(49)))}</g>` +
    `<path d="${d}" ${st(null, 'gold', 1, ';stroke-linejoin:round')}/>`
  );
};

// Small sub-dial frame
const sub = (cx, cy, r, n, color = 'muted') => circ(cx, cy, r, null, 'muted', 0.5) + ring(cx, cy, r - 2, n, 1.2, 2.4, color);
const subHand = (cx, cy, len, a, cls, color = 'gold', w = 1.3) => {
  const h = `<path d="${leaf(cx, cy, len, 3, w)}" ${st(color)}/>` + circ(cx, cy, 1.5, color);
  return rot(a, cx, cy, cls ? spin(cls, cx, cy, h) : h);
};

// Date ring 1–31 (odd numerals) for pointer-date / complete calendar
const dateRing = (r, color, size) =>
  ring(100, 100, 81, 31, 1, 3, 'muted') +
  TG(size, color, [...Array(16).keys()].map((i) => { const d = i * 2 + 1; const [x, y] = pt(100, 100, r, ((d - 1) * 360) / 31); return T(x, y, d); }).join(''));

const crescentTip = (y) => circ(100, y, 3.4, 'gold') + circ(100, y - 1.3, 2.7, 'dial');

export default {
  'pointer-date': (o) =>
    svg('Pointer date', CASE() + dateRing(71.5, 'line', 6.4) +
      ring(100, 100, 54, 12, 0.5, 9, 'line') +
      label(100, 128, 'DATE', 'gold', 5.2) +
      HANDS(0.82) +
      pointer(((14 - 1) * 360) / 31, 79, crescentTip(62))),

  'day-date': (o) =>
    svg('Day-date', CASE() + TRACK() +
      ticks(100, 100, 79, 70, hourAngles([0, 3]), 'line', 2.2) +
      roll(o, 'd', 79, 30, 42, 11, ['WED', 'THU', 'FRI'], 7.2) +
      roll(o, 'n', 135, 94.5, 18, 11, ['14', '15', '16'], 7.6) +
      label(100, 49.5, 'DAY', 'muted', 4) + label(144, 113.5, 'DATE', 'muted', 4) +
      HANDS(0.95) +
      rot(0, 100, 100, spin('cx-tick-60', 100, 100, `<path d="M100,118V26" ${st(null, 'blue', 0.6)}/>` + circ(100, 100, 1.4, 'blue')))),

  'week-number': (o) =>
    svg('Week number', CASE() +
      ring(100, 100, 81, 52, 1, 3, 'muted') + ring(100, 100, 81, 13, 0.6, 6, 'line') +
      TG(6.2, 'line', [10, 20, 30, 40, 50].map((w) => { const [x, y] = pt(100, 100, 71, ((w - 1) * 360) / 52); return T(x, y, w); }).join('') + T(100, 29, 1)) +
      ring(100, 100, 54, 12, 0.5, 9, 'muted') +
      label(100, 70, 'WEEK', 'gold', 5.6) +
      HANDS(0.82) +
      pointer(((39 - 1) * 360) / 52, 74, `<path d="M100,20.5L97.4,26H102.6Z" ${st('gold')}/>`)),

  'complete-calendar': (o) =>
    svg('Complete calendar', CASE() + dateRing(72, 'muted', 5.8) +
      roll(o, 'd', 72, 42, 25, 11, ['WED', 'THU', 'FRI'], 6.6) +
      `<rect x="103" y="42" width="25" height="11" rx="1.2" ${st('line')}/>` + TG(6.6, 'dial', T(115.5, 47.9, 'SEP'), ';font-weight:600') +
      `<rect x="101.7" y="40.7" width="27.6" height="13.6" rx="2" ${st(null, 'gold', 1)}/>` +
      moonAp(o, 'm', 100, 152, 0.8) +
      ticks(100, 100, 66, 60, hourAngles([0, 6]), 'line', 1.8) +
      HANDS(0.85) +
      pointer(((14 - 1) * 360) / 31, 79, crescentTip(63))),

  'annual-calendar': (o) =>
    svg('Annual calendar', CASE() + TRACK() +
      ticks(100, 100, 79, 71, hourAngles([0, 1, 11]), 'line', 2.2) +
      roll(o, 'd', 58, 50, 25, 11, ['MON', 'TUE', 'WED'], 6.4) +
      roll(o, 'n', 90, 46, 20, 11, ['28', '29', '30'], 7) +
      roll(o, 'm', 117, 50, 25, 11, ['FEB', 'MAR', 'APR'], 6.4) +
      label(100, 70, 'ANNUAL CALENDAR', 'gold', 4.4) +
      sub(100, 142, 16, 60) + subHand(100, 142, 13, 0, 'cx-tick-60', 'blue', 0.8) +
      HANDS(0.9)),

  'perpetual-calendar': (o) => {
    const leap = circ(138, 100, 7.5, 'dial', 'gold', 0.6) +
      `<path d="M138,92.5V107.5M130.5,100H145.5" ${st(null, 'muted', 0.4)}/>` +
      `<path d="M138,100V92.5A7.5,7.5 0 0 1 145.5,100Z" ${st('gold', null, 0, ';opacity:.85')}/>` +
      subHand(138, 100, 6, 0, 'cx-spin-12s', 'line', 0.8);
    return svg('Perpetual calendar', CASE() + TRACK() +
      ticks(100, 100, 79, 72, hourAngles([0, 3, 6, 9]), 'line', 2) +
      moonAp(o, 'm', 100, 72, 0.6) +
      sub(62, 100, 19, 7, 'line') + subHand(62, 100, 14, 3 * 360 / 7, null) +
      sub(138, 100, 19, 12, 'line') + leap + subHand(138, 100, 15, 8 * 30, null) +
      sub(100, 138, 19, 31) + ring(100, 138, 17, 4, 0.3, 4.2, 'line') + subHand(100, 138, 15, 140, 'cx-spin-60s') +
      TG(3.8, 'muted', T(62, 124.5, 'DAY') + T(138, 124.5, 'MONTH · LEAP') + T(100, 162.5, 'DATE'), ';letter-spacing:.12em') +
      HANDS(0.95));
  },

  'chinese-calendar': (o) =>
    svg('Chinese traditional calendar', CASE() + TRACK() +
      ticks(100, 100, 79, 71, hourAngles([0, 6]), 'line', 2.2) +
      roll(o, 'z', 67, 44, 18, 13, ['龍', '蛇', '馬'], 8.6) +
      `<rect x="115" y="44" width="18" height="13" rx="1.2" ${st('line')}/>` + TG(8.6, 'dial', T(124, 50.9, '木'), ';font-weight:600') +
      `<rect x="113.7" y="42.7" width="20.6" height="15.6" rx="2" ${st(null, 'gold', 1)}/>` +
      TG(3.8, 'muted', T(76, 63, 'ZODIAC') + T(124, 63, 'ELEMENT'), ';letter-spacing:.12em') +
      circ(100, 140, 22, null, 'gold', 0.6) + ring(100, 140, 20, 12, 0.35, 5, 'gold') +
      TG(4.6, 'line', ['子', '卯', '午', '酉'].map((c, i) => { const [x, y] = pt(100, 140, 13.5, i * 90); return T(x, y, c); }).join('')) +
      subHand(100, 140, 17, 30, 'cx-spin-60s') +
      HANDS(0.9)),

  moonphase: (o) =>
    svg('Moon phase', CASE() + TRACK() +
      ticks(100, 100, 79, 69, hourAngles([6]), 'line', 2.4) +
      moonAp(o, 'm', 100, 154, 1.1) +
      HANDS(1)),

  'astronomical-moonphase': (o) => {
    const scale = ring(100, 100, 81, 59, 0.9, 2.6, 'muted') +
      TG(5.8, 'line', [5, 10, 20, 25].map((d) => { const [x, y] = pt(100, 100, 72, (d * 360) / 29.5); return T(x, y, d); }).join('') + T(100, 28, '29½')) +
      circ(100, 172.5, 3, 'gold');
    const mc = [100, 130];
    const moon = `<clipPath id="${o.uid}c"><circle cx="${mc[0]}" cy="${mc[1]}" r="16"/></clipPath>` +
      circ(mc[0], mc[1], 22, 'night', 'gold', 1.1) + circ(mc[0], mc[1], 24.5, null, 'gold', 0.4) +
      [[-14, -10], [15, -9], [-9, 15], [13, 13], [0, -19]].map(([x, y]) => circ(mc[0] + x, mc[1] + y, 0.7, 'gold')).join('') +
      circ(mc[0], mc[1], 16, 'gold') + circ(94, 125, 3, 'dial', null, 0, ';opacity:.14') + circ(106, 136, 2, 'dial', null, 0, ';opacity:.14') +
      `<g clip-path="url(#${o.uid}c)">${rot(-70, 100, 150, spin('cx-spin-12s', 100, 150, circ(100, 130, 18, 'night', null, 0, ';opacity:.94')))}</g>`;
    return svg('Astronomical moon phase', CASE() + scale + moon +
      label(100, 70, 'AGE OF MOON', 'muted', 4.2) +
      HANDS(0.72) +
      pointer((11.2 * 360) / 29.5, 78, circ(100, 23, 2.6, null, 'gold', 0.9)));
  },

  'equation-of-time': (o) => {
    const cx = 100, cy = 118, r = 60;
    const A = (m) => (m + 16) * 4 - 60; // minutes → angle (−16 → −60°, +14 → +60°)
    const all = [...Array(31).keys()].map((i) => A(i - 16));
    const big = [-16, -10, -5, 0, 5, 10, 14].map(A);
    const arc = `M${pt(cx, cy, r, -60)}A${r},${r} 0 0 1 ${pt(cx, cy, r, 60)}`;
    const lab = [[-16, '−16'], [-10, '−10'], [0, '0'], [10, '+10'], [14, '+14']].map(([m, s]) => { const [x, y] = pt(cx, cy, r + 8.5, A(m)); return T(x, y, s); }).join('');
    const handG = `<path d="${leaf(cx, cy, 56, 10, 1.6)}" ${st('gold')}/>` + circ(cx, cy, 3, 'gold') + circ(cx, cy, 1.1, 'dial');
    const sun = circ(100, 104, 3.2, null, 'gold', 0.8) + ticks(100, 104, 4.8, 6.6, [0, 45, 90, 135, 180, 225, 270, 315], 'gold', 0.6);
    return svg('Equation of time', CASE() + TRACK() +
      `<path d="${arc}" ${st(null, 'gold', 0.7)}/>` + ticks(cx, cy, r - 3, r, all, 'muted', 0.5) + ticks(cx, cy, r - 6, r, big, 'gold', 1) +
      TG(5.6, 'line', lab) + sun + label(100, 131, 'EQUATION OF TIME', 'muted', 4.2) +
      rot(-60, cx, cy, spin('cx-sweep-retro', cx, cy, handG)) +
      sub(100, 158, 16, 12, 'line') + rot(304, 100, 158, `<path d="${leaf(100, 158, 8, 2, 1.3)}" ${st('line')}/>`) + rot(48, 100, 158, `<path d="${leaf(100, 158, 12.5, 2, 1)}" ${st('line')}/>`) + circ(100, 158, 1.4, 'line'));
  },

  'sidereal-time': (o) => {
    const nums = TG(6, 'line', [...Array(12).keys()].map((i) => { const h = (i + 1) * 2; const [x, y] = pt(100, 100, 70.5, h * 15); return T(x, y, h); }).join(''));
    const star = (x, y, r) => `<path d="M${x},${y - r}L${n1(x + r * 0.28)},${n1(y - r * 0.28)} ${x + r},${y} ${n1(x + r * 0.28)},${n1(y + r * 0.28)} ${x},${y + r} ${n1(x - r * 0.28)},${n1(y + r * 0.28)} ${x - r},${y} ${n1(x - r * 0.28)},${n1(y - r * 0.28)}Z" ${st('gold')}/>`;
    const solar = rot(135, 100, 100, `<path d="M100,108V46" ${st(null, 'blue', 1.2, ';stroke-linecap:round')}/>` + circ(100, 41, 4, null, 'blue', 1) + circ(100, 41, 1.4, 'blue'));
    return svg('Sidereal time', CASE() +
      ring(100, 100, 81, 96, 0.8, 2.6, 'muted') + ring(100, 100, 81, 24, 0.6, 5, 'line') + nums +
      circ(100, 100, 56, null, 'muted', 0.4) +
      label(100, 72, 'SIDEREAL', 'gold', 5.2) + star(100, 62, 4) +
      label(100, 130, 'SOLAR', 'blue', 4.4) +
      solar +
      rot(318, 100, 100, spin('cx-spin-60s', 100, 100,
        `<path d="M100,112V34" ${st(null, 'gold', 1.1, ';stroke-linecap:round')}/>` + star(100, 27, 6.5) + circ(100, 100, 2.8, 'gold') + circ(100, 100, 1, 'dial'))));
  },

  'celestial-chart': (o) => {
    // deterministic scatter of stars on the rotating sky disc
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    let stars = '';
    for (let i = 0; i < 34; i++) {
      const a = rnd() * 360, r = Math.sqrt(rnd()) * 70, s = rnd();
      const [x, y] = pt(100, 100, r, a);
      stars += circ(x, y, s > 0.85 ? 1.1 : s > 0.5 ? 0.7 : 0.45, 'gold', null, 0, s > 0.85 ? '' : ';opacity:.7');
    }
    const cons = (pts) => `<path d="M${pts.join('L')}" ${st(null, 'gold', 0.45, ';opacity:.8;stroke-linejoin:round')}/>` + pts.map(([x, y]) => circ(x, y, 1, 'gold')).join('');
    const sky = circ(100, 100, 72, 'night') + stars +
      cons([[62, 58], [72, 54], [81, 57], [89, 63], [92, 74], [104, 73], [101, 62], [89, 63]]) + // Plough
      cons([[122, 118], [128, 128], [134, 137]]) + cons([[118, 108], [128, 128], [140, 124]]) + // Orion-ish
      circ(112, 90, 38, null, 'gold', 0.5, ';stroke-dasharray:1.5 2;opacity:.9') + // ecliptic
      circ(100, 100, 1.6, 'gold') + // pole
      circ(74, 132, 4, 'gold') + circ(75.5, 131, 3.3, 'night');
    return svg('Celestial chart', CASE() +
      ring(100, 100, 81, 24, 0.5, 4, 'line') + ring(100, 100, 81, 96, 0.6, 2, 'muted') +
      `<clipPath id="${o.uid}s"><ellipse cx="100" cy="100" rx="68" ry="58"/></clipPath>` +
      `<g clip-path="url(#${o.uid}s)">${spin('cx-spin-60s', 100, 100, sky)}</g>` +
      `<ellipse cx="100" cy="100" rx="68" ry="58" ${st(null, 'gold', 1.1)}/>` + `<ellipse cx="100" cy="100" rx="70.5" ry="60.5" ${st(null, 'gold', 0.35)}/>` +
      TG(4, 'muted', T(100, 165, 'S') + T(100, 35.5, 'N'), ';letter-spacing:.1em') +
      HANDS(0.9, 10, 8, 100, 100, true));
  },
};
