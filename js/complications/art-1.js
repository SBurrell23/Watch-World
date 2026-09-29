// Complication illustrations 1–12 (time display, indication, date). See data/COMPLICATIONS.md → "Illustrations".
// Each entry: (o = { uid }) => SVG string. Colours only via --cx-* variables; motion only via cx-* classes.

const r1 = (v) => Math.round(v * 10) / 10;
/** Point at radius r, angle a (degrees clockwise from 12 o'clock) around cx,cy. */
const P = (cx, cy, r, a) => {
  const t = ((a - 90) * Math.PI) / 180;
  return [r1(cx + r * Math.cos(t)), r1(cy + r * Math.sin(t))];
};
const F = (c) => `style="fill:var(--cx-${c})"`;
const S = (c) => `style="fill:none;stroke:var(--cx-${c})"`;
const FS = (f, s) => `style="fill:var(--cx-${f});stroke:var(--cx-${s})"`;
const svg = (b) => `<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">${b}</svg>`;
const T = (x, y, s, size, c = 'line', ex = '') =>
  `<text x="${x}" y="${y}" font-size="${size}" text-anchor="middle" style="fill:var(--cx-${c});font-family:var(--cx-font)"${ex}>${s}</text>`;
const spin = (cls, x, y, body) => `<g class="${cls}" style="transform-origin:${x}px ${y}px">${body}</g>`;
const rot = (a, x, y, body) => `<g transform="rotate(${a} ${x} ${y})">${body}</g>`;

/** One path of radial ticks: n ticks from angle a0 every `step` degrees, between radii ra..rb. */
const ticks = (cx, cy, ra, rb, n, step, a0, c, w, skip) => {
  let d = '';
  for (let i = 0; i < n; i++) {
    if (skip && skip(i)) continue;
    const a = a0 + i * step;
    const [x1, y1] = P(cx, cy, ra, a);
    const [x2, y2] = P(cx, cy, rb, a);
    d += `M${x1} ${y1}L${x2} ${y2}`;
  }
  return `<path d="${d}" ${S(c)} stroke-width="${w}"/>`;
};
/** Arc path from angle a0 to a1 (clockwise). */
const arcD = (cx, cy, r, a0, a1) => {
  const [x0, y0] = P(cx, cy, r, a0);
  const [x1, y1] = P(cx, cy, r, a1);
  return `M${x0} ${y0}A${r} ${r} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${x1} ${y1}`;
};
/** Annular sector (window) path between radii ri..ro, angles a0..a1. */
const sectorD = (cx, cy, ri, ro, a0, a1) => {
  const [x0, y0] = P(cx, cy, ro, a0);
  const [x1, y1] = P(cx, cy, ro, a1);
  const [x2, y2] = P(cx, cy, ri, a1);
  const [x3, y3] = P(cx, cy, ri, a0);
  const l = a1 - a0 > 180 ? 1 : 0;
  return `M${x0} ${y0}A${ro} ${ro} 0 ${l} 1 ${x1} ${y1}L${x2} ${y2}A${ri} ${ri} 0 ${l} 0 ${x3} ${y3}Z`;
};

/** Case, crown, dial, flange; optional minute track and hour batons (skip = hour indices 0–11 to omit). */
const base = ({ track = true, batons = true, skip = [] } = {}) =>
  `<rect x="188" y="93" width="8" height="14" rx="2" ${F('case')}/>` +
  `<circle cx="100" cy="100" r="90" ${FS('dial', 'case')} stroke-width="3"/>` +
  `<circle cx="100" cy="100" r="85.5" ${S('case')} stroke-width=".5" opacity=".6"/>` +
  (track ? ticks(100, 100, 80.5, 83.5, 60, 6, 0, 'muted', 0.6, (i) => i % 5 === 0) : '') +
  (batons ? ticks(100, 100, 70, 83, 12, 30, 0, 'line', 2.4, (i) => skip.includes(i)) : '');

/** Dauphine hand pointing to 12 from cx,cy, with a fine facet line. */
const leaf = (cx, cy, len, w, tail, c) =>
  `<path d="M${cx} ${r1(cy - len)}L${r1(cx + w)} ${cy}L${cx} ${r1(cy + tail)}L${r1(cx - w)} ${cy}Z" ${F(c)}/>` +
  `<path d="M${cx} ${r1(cy - len + 3)}V${cy}" ${S('dial')} stroke-width=".5" opacity=".55"/>`;
/** Hour + minute hands at angles ha, ma; k scales them. */
const hm = (ha, ma, cx = 100, cy = 100, k = 1, c = 'line') =>
  rot(ha, cx, cy, leaf(cx, cy, 42 * k, 3.2 * k, 8 * k, c)) +
  rot(ma, cx, cy, leaf(cx, cy, 64 * k, 2.4 * k, 10 * k, c)) +
  `<circle cx="${cx}" cy="${cy}" r="${r1(3.4 * k)}" ${F(c)}/>`;
/** Slim seconds-type hand (to 12) with counterweight. */
const needle = (cx, cy, len, tail, c, w = 0.9) =>
  `<path d="M${cx} ${cy + tail}V${cy - len}" ${S(c)} stroke-width="${w}" stroke-linecap="round"/>` +
  `<circle cx="${cx}" cy="${cy + tail - 2}" r="2" ${FS('dial', c)} stroke-width="${w}"/>` +
  `<circle cx="${cx}" cy="${cy}" r="2" ${F(c)}/>`;
/** Sub-dial: ring + 60 fine ticks + 12 marks. */
const sub = (cx, cy, r, ring = 'muted', rw = 0.8) =>
  `<circle cx="${cx}" cy="${cy}" r="${r}" ${FS('dial', ring)} stroke-width="${rw}"/>` +
  `<circle cx="${cx}" cy="${cy}" r="${r - 7}" ${S('muted')} stroke-width=".3" opacity=".6"/>` +
  ticks(cx, cy, r - 3.5, r - 1.5, 60, 6, 0, 'muted', 0.35, (i) => i % 5 === 0) +
  ticks(cx, cy, r - 5, r - 1.5, 12, 30, 0, 'line', 0.8);
/** Rolling-disc column: digits stacked 12 local units apart, scaled by k, animated with cx-slide, clipped. */
const roller = (id, x, y, k, digits, size, c = 'line', w = 500) =>
  `<g clip-path="url(#${id})"><g transform="translate(${x} ${y}) scale(${k})"><g class="cx-slide">` +
  digits.map((d, i) => T(0, i * 12, d, size, c, ` font-weight="${w}"`)).join('') +
  `</g></g></g>`;

export default {
  'small-seconds': (o) =>
    svg(
      base({ skip: [6] }) +
        sub(100, 138, 23, 'gold', 1.1) +
        T(100, 128.5, '60', 5.5, 'muted') +
        spin('cx-spin-60s', 100, 138, needle(100, 138, 20, 5, 'gold')) +
        hm(305, 58),
    ),

  'deadbeat-seconds': (o) =>
    svg(
      base({ track: false }) +
        ticks(100, 100, 79.5, 83.5, 60, 6, 0, 'gold', 0.7, (i) => i % 5 === 0) +
        ticks(100, 100, 76, 83.5, 12, 30, 0, 'gold', 0.9) +
        T(100, 138, 'SECONDE MORTE', 5.6, 'gold', ' letter-spacing="1"') +
        T(100, 146, '1 BEAT · 1 SECOND', 4.4, 'muted', ' letter-spacing=".8"') +
        hm(305, 58) +
        spin('cx-tick-60', 100, 100, needle(100, 100, 80, 20, 'gold', 1)),
    ),

  'jumping-hour': (o) => {
    const id = `${o.uid}-jh`;
    return svg(
      `<defs><clipPath id="${id}"><rect x="83" y="43" width="34" height="28" rx="3"/></clipPath></defs>` +
        base({ batons: false }) +
        ticks(100, 100, 76, 83.5, 12, 30, 0, 'line', 1.2, (i) => i === 0) +
        [
          [90, '15'],
          [180, '30'],
          [270, '45'],
        ]
          .map(([a, s]) => {
            const [x, y] = P(100, 100, 66, a);
            return T(x, y + 2.5, s, 7, 'muted');
          })
          .join('') +
        `<rect x="83" y="43" width="34" height="28" rx="3" ${F('dial')}/>` +
        roller(id, 100, 64.5, 2, ['10', '11', '12'], 9.5, 'gold', 600) +
        `<rect x="83" y="43" width="34" height="28" rx="3" ${S('gold')} stroke-width="1.3"/>` +
        T(100, 80, 'HEURE SAUTANTE', 4.6, 'muted', ' letter-spacing=".8"') +
        spin('cx-spin-2s', 100, 100, leaf(100, 100, 70, 2.4, 11, 'line')) +
        `<circle cx="100" cy="100" r="3.4" ${F('line')}/>`,
    );
  },

  'wandering-hour': (o) => {
    const id = `${o.uid}-wh`;
    const win = sectorD(100, 100, 31, 66, -62, 62);
    const sats = [
      [0, '10'],
      [90, '9'],
      [180, '12'],
      [270, '11'],
    ]
      .map(([a, s]) => {
        const [x, y] = P(100, 100, 49, a);
        return spin(
          'cx-spin-rev-12s',
          x,
          y,
          `<circle cx="${x}" cy="${y}" r="11.5" ${FS('dial', 'gold')} stroke-width="1"/>` +
            `<circle cx="${x}" cy="${y}" r="9" ${S('gold')} stroke-width=".3"/>` +
            T(x, y + 3.6, s, 10, 'gold', ' font-weight="600"'),
        );
      })
      .join('');
    let lbl = '';
    for (let m = 0; m <= 60; m += 15) {
      const [x, y] = P(100, 100, 77.5, -60 + m * 2);
      lbl += T(x, y + 2, m, 5.5, 'muted');
    }
    return svg(
      `<defs><clipPath id="${id}"><path d="${win}"/></clipPath></defs>` +
        base({ track: false, batons: false }) +
        ticks(100, 100, 9, 25, 60, 6, 0, 'muted', 0.35) +
        `<path d="${win}" ${F('dial')}/>` +
        `<g clip-path="url(#${id})">${spin('cx-orbit-12s', 100, 100, `<circle cx="100" cy="100" r="61" ${S('muted')} stroke-width=".4"/>` + sats)}</g>` +
        `<path d="${win}" ${S('case')} stroke-width="1"/>` +
        ticks(100, 100, 68.5, 71.5, 31, 4, -60, 'line', 0.5) +
        ticks(100, 100, 68.5, 73.5, 5, 30, -60, 'line', 1) +
        `<path d="${arcD(100, 100, 68.5, -60, 60)}" ${S('line')} stroke-width=".5"/>` +
        lbl +
        `<circle cx="100" cy="100" r="25" ${S('muted')} stroke-width=".5"/>` +
        `<circle cx="100" cy="100" r="7" ${FS('dial', 'gold')} stroke-width="1"/>` +
        `<circle cx="100" cy="100" r="2.2" ${F('gold')}/>` +
        T(100, 152, 'HEURES VAGABONDES', 5, 'muted', ' letter-spacing=".8"'),
    );
  },

  'retrograde-display': (o) => {
    let lbl = '';
    for (let m = 0; m <= 60; m += 15) {
      const [x, y] = P(100, 124, 71, -60 + m * 2);
      lbl += T(x, y + 2.2, m, 6, 'gold', ' font-weight="500"');
    }
    return svg(
      base({ track: false, batons: false }) +
        `<path d="${sectorD(100, 124, 54, 64, -60, 60)}" ${F('gold')} opacity=".1"/>` +
        `<path d="${arcD(100, 124, 64, -60, 60)}" ${S('gold')} stroke-width="1.2"/>` +
        `<path d="${arcD(100, 124, 54, -60, 60)}" ${S('gold')} stroke-width=".4"/>` +
        ticks(100, 124, 58, 64, 31, 4, -60, 'gold', 0.55) +
        ticks(100, 124, 54, 64, 5, 30, -60, 'gold', 1.2) +
        lbl +
        T(100, 104, 'MINUTES', 4.8, 'muted', ' letter-spacing="1"') +
        sub(100, 156, 15) +
        rot(300, 100, 156, leaf(100, 156, 10, 1.8, 3, 'line')) +
        `<circle cx="100" cy="156" r="1.6" ${F('line')}/>` +
        rot(-60, 100, 124, spin('cx-sweep-retro', 100, 124, leaf(100, 124, 62, 2.3, 10, 'gold'))) +
        `<circle cx="100" cy="124" r="3.4" ${F('gold')}/><circle cx="100" cy="124" r="1.2" ${F('dial')}/>`,
    );
  },

  'regulator-dial': (o) =>
    svg(
      base({ batons: false }) +
        ticks(100, 100, 77, 83.5, 12, 30, 0, 'line', 1.1) +
        sub(100, 60, 20, 'line', 0.7) +
        [
          [0, '12'],
          [90, '3'],
          [180, '6'],
          [270, '9'],
        ]
          .map(([a, s]) => {
            const [x, y] = P(100, 60, 11, a);
            return T(x, y + 1.8, s, 5, 'muted');
          })
          .join('') +
        rot(300, 100, 60, leaf(100, 60, 13, 2.2, 3.5, 'line')) +
        `<circle cx="100" cy="60" r="1.8" ${F('line')}/>` +
        sub(100, 140, 20, 'line', 0.7) +
        spin('cx-tick-60', 100, 140, needle(100, 140, 17, 4, 'blue', 0.8)) +
        rot(52, 100, 100, leaf(100, 100, 78, 2.3, 14, 'gold')) +
        `<circle cx="100" cy="100" r="3.6" ${F('gold')}/><circle cx="100" cy="100" r="1.2" ${F('dial')}/>` +
        T(146, 102, 'RÉGULATEUR', 4.6, 'muted', ' letter-spacing=".8"'),
    ),

  'mechanical-digital-display': (o) => {
    const m = `${o.uid}-dm`;
    return svg(
      `<defs><clipPath id="${m}"><rect x="108" y="81" width="46" height="30" rx="2"/></clipPath></defs>` +
        base({ batons: false, track: false }) +
        `<path d="M22 88Q100 40 178 88L178 112Q100 132 22 112Z" ${FS('case', 'case')} fill-opacity=".14" stroke-width=".8"/>` +
        `<rect x="46" y="81" width="46" height="30" rx="2" ${F('dial')}/><rect x="108" y="81" width="46" height="30" rx="2" ${F('dial')}/>` +
        T(69, 104.5, '12', 22, 'line', ' font-weight="500"') +
        T(121.5, 104.5, '4', 22, 'line', ' font-weight="500"') +
        roller(m, 142, 104.5, 2, ['7', '8', '9'], 11, 'line', 500) +
        `<rect x="46" y="81" width="46" height="30" rx="2" ${S('gold')} stroke-width="1.3"/>` +
        `<rect x="108" y="81" width="46" height="30" rx="2" ${S('gold')} stroke-width="1.3"/>` +
        T(69, 76, 'HOURS', 4.6, 'muted', ' letter-spacing="1"') +
        T(131, 76, 'MINUTES', 4.6, 'muted', ' letter-spacing="1"') +
        sub(100, 150, 18, 'line', 0.7) +
        spin('cx-spin-2s', 100, 150, needle(100, 150, 15, 4, 'line', 0.8)) +
        `<circle cx="100" cy="42" r="6" ${S('case')} stroke-width=".8"/><circle cx="100" cy="42" r="2" ${F('gold')}/>`,
    );
  },

  'power-reserve': (o) => {
    // tapering gold band: thin at empty (left) to full (right)
    let outer = '';
    let inner = '';
    for (let i = 0; i <= 24; i++) {
      const a = -60 + i * 5;
      const [xo, yo] = P(100, 110, 64, a);
      const [xi, yi] = P(100, 110, 63 - i * 0.28, a);
      outer += `${i ? 'L' : 'M'}${xo} ${yo}`;
      inner = `L${xi} ${yi}` + inner;
    }
    const [ex, ey] = P(100, 110, 74, -60);
    const [fx, fy] = P(100, 110, 74, 60);
    return svg(
      base({ batons: false }) +
        ticks(100, 100, 77, 83.5, 12, 30, 0, 'line', 1.1, (i) => i > 1 && i < 11) +
        `<path d="${outer}${inner}Z" ${F('gold')}/>` +
        ticks(100, 110, 52, 58, 13, 10, -60, 'gold', 0.6) +
        ticks(100, 110, 49, 58, 5, 30, -60, 'gold', 1.2) +
        T(ex, ey + 2, '0', 6.5, 'muted') +
        T(fx, fy + 2, '48', 6.5, 'gold', ' font-weight="600"') +
        T(100, 96, 'RÉSERVE', 5, 'muted', ' letter-spacing="1.2"') +
        `<g transform="translate(200 0) scale(-1 1)">${rot(-60, 100, 110, spin('cx-sweep-retro', 100, 110, leaf(100, 110, 56, 2.2, 9, 'gold')))}</g>` +
        `<circle cx="100" cy="110" r="3.4" ${F('gold')}/><circle cx="100" cy="110" r="1.2" ${F('dial')}/>` +
        sub(100, 148, 17) +
        hm(300, 60, 100, 148, 0.24),
    );
  },

  'day-night-indicator': (o) => {
    const id = `${o.uid}-dn`;
    const win = sectorD(100, 100, 30, 64, -66, 66);
    let stars = '';
    [
      [150, 52, 0.9],
      [205, 40, 0.7],
      [225, 56, 1],
      [240, 44, 0.6],
      [135, 36, 0.6],
    ].forEach(([a, r, s]) => {
      const [x, y] = P(100, 100, r, a);
      stars += `<circle cx="${x}" cy="${y}" r="${s}" ${F('line')}/>`;
    });
    let rays = '';
    for (let i = 0; i < 12; i++) {
      const [x1, y1] = P(100, 54, 9, i * 30);
      const [x2, y2] = P(100, 54, i % 2 ? 11.5 : 13.5, i * 30);
      rays += `M${x1} ${y1}L${x2} ${y2}`;
    }
    const disc =
      `<path d="M38 100A62 62 0 0 1 162 100Z" ${F('blue')} opacity=".16"/>` +
      `<path d="M38 100A62 62 0 0 0 162 100Z" ${F('night')}/>` +
      `<circle cx="100" cy="54" r="6.5" ${F('gold')}/><path d="${rays}" ${S('gold')} stroke-width="1.1" stroke-linecap="round"/>` +
      `<g transform="translate(100 146)"><path d="M-1 -8A8 8 0 1 0 7 4A9 9 0 0 1 -1 -8Z" ${F('gold')}/></g>` +
      stars;
    return svg(
      `<defs><clipPath id="${id}"><path d="${win}"/></clipPath></defs>` +
        base() +
        `<g clip-path="url(#${id})">${spin('cx-spin-12s', 100, 100, disc)}</g>` +
        `<path d="${win}" ${S('gold')} stroke-width="1.2"/>` +
        T(100, 132, 'JOUR · NUIT', 4.8, 'muted', ' letter-spacing="1"') +
        hm(250, 122),
    );
  },

  'depth-gauge': (o) => {
    let lbl = '';
    for (let m = 0; m <= 60; m += 10) {
      const [x, y] = P(100, 100, 62, m * 2);
      lbl += T(x, y + 2.2, m, 6, 'gold', ' font-weight="500"');
    }
    return svg(
      base({ track: false, batons: false }) +
        ticks(100, 100, 80.5, 83.5, 60, 6, 0, 'muted', 0.6, (i) => i % 5 === 0 || i <= 20) +
        ticks(100, 100, 70, 83, 12, 30, 0, 'line', 2.4, (i) => i < 5) +
        `<path d="${sectorD(100, 100, 70, 83.5, 0, 120)}" ${F('gold')} opacity=".1"/>` +
        `<path d="${arcD(100, 100, 83.5, 0, 120)}" ${S('gold')} stroke-width="1"/>` +
        ticks(100, 100, 77.5, 83.5, 31, 4, 0, 'gold', 0.55) +
        ticks(100, 100, 71, 83.5, 7, 20, 0, 'gold', 1.2) +
        lbl +
        T(100, 134, 'DEPTH · M', 5.2, 'muted', ' letter-spacing="1.5"') +
        hm(262, 300) +
        rot(90, 100, 100, `<path d="M100 22L102.6 29H97.4Z" ${F('blue')}/><path d="M100 29V100" ${S('blue')} stroke-width=".7"/>`) +
        spin(
          'cx-sweep-retro',
          100,
          100,
          `<path d="M100 18L103 28H97Z" ${F('gold')}/><path d="M100 28V116" ${S('gold')} stroke-width="1.1"/>`,
        ) +
        `<circle cx="100" cy="100" r="3.6" ${F('gold')}/><circle cx="100" cy="100" r="1.2" ${F('dial')}/>`,
    );
  },

  date: (o) => {
    const id = `${o.uid}-dt`;
    return svg(
      `<defs><clipPath id="${id}"><rect x="135" y="90" width="26" height="20" rx="1.5"/></clipPath></defs>` +
        base({ skip: [3] }) +
        `<rect x="135" y="90" width="26" height="20" rx="1.5" ${F('dial')}/>` +
        roller(id, 148, 105.4, 1.5, ['17', '18', '19'], 9.5, 'line', 500) +
        `<rect x="135" y="90" width="26" height="20" rx="1.5" ${S('gold')} stroke-width="1.3"/>` +
        hm(305, 58) +
        spin('cx-spin-60s', 100, 100, needle(100, 100, 76, 18, 'blue', 0.8)),
    );
  },

  'big-date': (o) => {
    const id = `${o.uid}-bd`;
    return svg(
      `<defs><clipPath id="${id}"><rect x="101.5" y="40" width="27" height="33" rx="2"/></clipPath></defs>` +
        base({ skip: [0] }) +
        `<rect x="68" y="36" width="64" height="41" rx="4" ${S('gold')} stroke-width=".5" opacity=".7"/>` +
        `<rect x="71.5" y="40" width="27" height="33" rx="2" ${F('dial')}/><rect x="101.5" y="40" width="27" height="33" rx="2" ${F('dial')}/>` +
        T(85, 67.5, '2', 30, 'line', ' font-weight="500"') +
        roller(id, 115, 67.5, 2.5, ['7', '8', '9'], 12, 'line', 500) +
        `<rect x="71.5" y="40" width="27" height="33" rx="2" ${S('gold')} stroke-width="1.3"/>` +
        `<rect x="101.5" y="40" width="27" height="33" rx="2" ${S('gold')} stroke-width="1.3"/>` +
        T(100, 86, 'GRANDE DATE', 4.6, 'muted', ' letter-spacing="1"') +
        hm(232, 128),
    );
  },
};
