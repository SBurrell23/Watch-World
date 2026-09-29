// Complication illustrations 37–48 (travel, striking, regulation, artistic). See data/COMPLICATIONS.md "Illustrations".
// Each entry: (o) => SVG string; o.uid prefixes every internal id.

const R = (n) => Math.round(n * 10) / 10;
const rad = (a) => (a * Math.PI) / 180;
// Polar point: angle in degrees clockwise from 12 o'clock.
const P = (cx, cy, r, a) => [R(cx + r * Math.sin(rad(a))), R(cy - r * Math.cos(rad(a)))];
const pt = (p) => `${p[0]} ${p[1]}`;
const S = (c) => `stroke:var(--cx-${c})`;
const F = (c) => `fill:var(--cx-${c})`;
const T = 'font-family:var(--cx-font)';
const rot = (cls, x, y, body) => `<g class="${cls}" style="transform-origin:${x}px ${y}px">${body}</g>`;

const svg = (b) =>
  `<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" fill="none" stroke-linecap="round" stroke-linejoin="round">${b}</svg>`;

// Round case with crown at 3 o'clock and a dial.
const wrist = (extra = '', crown = true) =>
  (crown ? `<rect x="183" y="93" width="8" height="14" rx="2" style="${F('dial')};${S('case')}" stroke-width="1.4"/>` : '') +
  extra +
  `<circle cx="100" cy="100" r="86" style="${F('dial')};${S('case')}" stroke-width="3"/>` +
  `<circle cx="100" cy="100" r="80.5" style="${S('muted')}" stroke-width=".6"/>`;

// Pusher on the case band at angle a (clockwise from 12).
const push = (a, c = 'case') => `<rect x="96.5" y="7.5" width="7" height="8" rx="1.8" transform="rotate(${a} 100 100)" style="${F('dial')};${S(c)}" stroke-width="1.3"/>`;

// Bridge: outlined bar (case colour) between two points, with a jewelled boss at (bx, by).
const bridge = (x1, y1, x2, y2, w, bx, by) =>
  `<path d="M${x1} ${y1}L${x2} ${y2}" style="${S('case')}" stroke-width="${w + 2.4}"/><path d="M${x1} ${y1}L${x2} ${y2}" style="${S('dial')}" stroke-width="${w}"/>` +
  `<circle cx="${x1}" cy="${y1}" r="1.3" style="${S('case')}" stroke-width=".7"/><circle cx="${x2}" cy="${y2}" r="1.3" style="${S('case')}" stroke-width=".7"/>` +
  `<circle cx="${bx}" cy="${by}" r="${w * 0.75}" style="${F('dial')};${S('case')}" stroke-width="1.2"/><circle cx="${bx}" cy="${by}" r="1.6" style="${F('red')}"/>`;

// Radial tick marks as one path.
const ticks = (cx, cy, r, len, n, style, w, skip = 0) => {
  let d = '';
  for (let i = 0; i < n; i++) {
    if (skip && i % skip === 0) continue;
    const a = (360 / n) * i;
    d += `M${pt(P(cx, cy, r, a))}L${pt(P(cx, cy, r - len, a))}`;
  }
  return `<path d="${d}" style="${style}" stroke-width="${w}"/>`;
};

// Fine scale as a dashed circle (cheap alternative to many tick paths).
const scale = (cx, cy, r, len, n, style, w) => {
  const c = 2 * Math.PI * (r - len / 2);
  return `<circle cx="${cx}" cy="${cy}" r="${R(r - len / 2)}" style="${style}" stroke-width="${len}" stroke-linecap="butt" stroke-dasharray="${w} ${R(c / n - w)}" stroke-dashoffset="${w / 2}"/>`;
};

// Gear outline: n teeth, pitch radius r, tooth depth h, phase (deg) of first tooth centre.
const gear = (cx, cy, r, n, h, style, w = 1, phase = 0) => {
  const s = 360 / n;
  let d = '';
  for (let i = 0; i < n; i++) {
    const a = phase + i * s;
    const q = [P(cx, cy, r - h / 2, a - s / 3), P(cx, cy, r + h / 2, a - s / 6), P(cx, cy, r + h / 2, a + s / 6), P(cx, cy, r - h / 2, a + s / 3)];
    d += (i ? 'L' : 'M') + q.map(pt).join('L');
  }
  return `<path d="${d}Z" style="${style}" stroke-width="${w}"/>`;
};

// Archimedean spiral (hairspring / mainspring).
const spiral = (cx, cy, r0, r1, turns, style, w = 0.6) => {
  const n = Math.round(turns * 14);
  let d = '';
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    d += (i ? 'L' : 'M') + pt(P(cx, cy, r0 + (r1 - r0) * t, t * turns * 360));
  }
  return `<path d="${d}" style="${style}" stroke-width="${w}"/>`;
};

// Swinging balance wheel (gold rim, two arms, timing screws) over a fixed hairspring.
const balance = (cx, cy, r, c = 'gold') => {
  let screws = '';
  for (let a = 0; a < 360; a += 45) {
    const p = P(cx, cy, r + 1.4, a + 22.5);
    screws += `<circle cx="${p[0]}" cy="${p[1]}" r="${R(r / 9)}"/>`;
  }
  return (
    spiral(cx, cy, r * 0.15, r * 0.7, 3.2, S('muted'), 0.5) +
    rot('cx-swing', cx, cy, `<circle cx="${cx}" cy="${cy}" r="${r}" style="${S(c)}" stroke-width="${R(r / 7)}"/><path d="M${cx - r} ${cy}H${cx + r}" style="${S(c)}" stroke-width="${R(r / 10)}"/><g style="${F(c)}">${screws}</g>`) +
    `<circle cx="${cx}" cy="${cy}" r="1.3" style="${F('red')}"/>`
  );
};

// Hour + minute hands (leaf-ish, line colour) with a small hub.
const hands = (cx, cy, hl, ml, ha, ma, c = 'line') => {
  const hand = (l, a, w) => {
    const t = P(cx, cy, l, a), b1 = P(cx, cy, w, a - 90), b2 = P(cx, cy, w, a + 90), tail = P(cx, cy, l * 0.18, a + 180);
    return `M${pt(tail)}L${pt(b1)}L${pt(t)}L${pt(b2)}Z`;
  };
  return `<path d="${hand(hl, ha, 1.8)}${hand(ml, ma, 1.3)}" style="${F(c)}"/><circle cx="${cx}" cy="${cy}" r="2" style="${F(c)}"/>`;
};

// Small time sub-dial.
const subdial = (cx, cy, r, ha = 305, ma = 60) =>
  `<circle cx="${cx}" cy="${cy}" r="${r}" style="${S('muted')}" stroke-width=".7"/>` +
  ticks(cx, cy, r - 2, r * 0.16, 12, S('line'), 1) +
  scale(cx, cy, r - 2, 1.2, 60, S('muted'), 0.4) +
  hands(cx, cy, r * 0.5, r * 0.78, ha, ma);

// Aperture (open window onto the movement).
const aperture = (cx, cy, r) =>
  `<circle cx="${cx}" cy="${cy}" r="${r}" style="${F('dial')};${S('case')}" stroke-width="1.6"/><circle cx="${cx}" cy="${cy}" r="${r - 3}" style="${S('muted')}" stroke-width=".4"/>`;

// Tourbillon cage: frame + escape wheel + swinging balance, rotating once every 6s.
const cage = (cx, cy, r, lyre = false) => {
  const arms = [0, 120, 240]
    .map((a) => {
      const e = P(cx, cy, r, a);
      if (!lyre) return `M${cx} ${cy}L${pt(e)}`;
      return `M${pt(P(cx, cy, 4, a - 40))}Q${pt(P(cx, cy, r * 0.62, a + 40))} ${pt(e)}`;
    })
    .join('');
  const esc = P(cx, cy, r * 0.66, 60), pal = P(cx, cy, r * 0.46, 85);
  const tip = P(cx, cy, r + 4, 0);
  return rot(
    'cx-spin-6s', cx, cy,
    `<circle cx="${cx}" cy="${cy}" r="${r}" style="${S('gold')}" stroke-width="1.6"/>` +
      gear(esc[0], esc[1], r * 0.22, 12, 1.6, S('muted'), 0.6) +
      `<path d="M${pt(esc)}L${pt(pal)}" style="${S('muted')}" stroke-width=".8"/>` +
      balance(cx, cy, r * 0.5) +
      `<path d="${arms}" style="${S('gold')}" stroke-width="${lyre ? 1.8 : 2.2}"/>` +
      `<path d="M${cx} ${cy - r}L${pt(tip)}" style="${S('blue')}" stroke-width="1.2"/>` +
      (lyre ? `<circle cx="${cx}" cy="${cy}" r="4" style="${S('gold')}" stroke-width="1.4"/><circle cx="${cx}" cy="${cy}" r="1.5" style="${F('red')}"/>` : `<circle cx="${cx}" cy="${cy}" r="2" style="${F('gold')}"/>`),
  );
};

// ─── Striking family ────────────────────────────────────────────────────────────────
// Movement-side view: coiled gongs, hammers, sound waves. n = hammers/gongs.
const striking = (o, { n, slide, pocket, snail, label, sel }) => {
  const C = 100;
  let b = '';
  if (pocket)
    b += `<rect x="94" y="4" width="12" height="10" rx="2" style="${F('dial')};${S('case')}" stroke-width="1.4"/><path d="M84 12A16 13 0 0 1 116 12" style="${S('case')}" stroke-width="2.2"/>`;
  b += wrist('', !pocket) + (pocket ? '' : push(40));
  if (slide) {
    // repeater slide on the case flank at 9 o'clock
    const a0 = P(C, C, 88.5, 246), a1 = P(C, C, 88.5, 300), s0 = P(C, C, 89, 258), s1 = P(C, C, 89, 280);
    b += `<path d="M${pt(a0)}A88.5 88.5 0 0 1 ${pt(a1)}" style="${S('muted')}" stroke-width="1"/>`;
    b += `<path d="M${pt(s0)}A89 89 0 0 1 ${pt(s1)}" style="${S('gold')}" stroke-width="4.5"/>`;
  }
  // movement plate details (bridges)
  b += `<path d="M58 70Q100 52 142 70M52 116Q78 130 96 158M148 116Q124 134 108 158" style="${S('muted')}" stroke-width=".7"/>`;
  b += [[62, 66], [138, 66], [100, 160]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="1.6" style="${S('muted')}" stroke-width=".6"/>`).join('');
  if (snail) {
    // all-or-nothing hour snail (12 steps) + quarter snail
    let d = '';
    for (let i = 0; i < 12; i++) {
      const r = 10 + i * 1.1;
      d += `${i ? 'L' : 'M'}${pt(P(C, C, r, i * 30))}A${r} ${r} 0 0 1 ${pt(P(C, C, r, i * 30 + 30))}`;
    }
    b += `<path d="${d}Z" style="${S('line')}" stroke-width=".7" opacity=".8"/>`;
    b += `<circle cx="${C}" cy="${C}" r="3" style="${S('muted')}" stroke-width=".7"/>`;
    // racks
    b += `<path d="M${pt(P(C, C, 30, 40))}A30 30 0 0 1 ${pt(P(C, C, 30, 80))}M${pt(P(C, C, 34, 280))}A34 34 0 0 1 ${pt(P(C, C, 34, 320))}" style="${S('muted')}" stroke-width="2.4" stroke-linecap="butt" stroke-dasharray=".8 1.2"/>`;
  } else {
    b += `<circle cx="${C}" cy="${C}" r="11" style="${S('muted')}" stroke-width=".7"/>` + gear(C, C, 16, 24, 2, S('muted'), 0.6);
  }
  // governor (regulator fly) spinning
  const g = [74, 56];
  b += `<circle cx="${g[0]}" cy="${g[1]}" r="8.5" style="${S('muted')}" stroke-width=".5"/>`;
  b += rot('cx-spin-2s', g[0], g[1], `<path d="M${g[0] - 7} ${g[1]}H${g[0] + 7}" style="${S('line')}" stroke-width="1"/><rect x="${g[0] - 8}" y="${g[1] - 2.4}" width="3" height="4.8" rx=".8" style="${F('line')}"/><rect x="${g[0] + 5}" y="${g[1] - 2.4}" width="3" height="4.8" rx=".8" style="${F('line')}"/>`);
  b += `<circle cx="${g[0]}" cy="${g[1]}" r="1.4" style="${F('red')}"/>`;
  // gongs from a heel at ~226°, coiling clockwise to ~212°
  const foot = P(C, C, 72 - (n - 1) * 1.6, 224);
  for (let i = 0; i < n; i++) {
    const r = 74 - i * 3.4;
    b += `<path d="M${pt(P(C, C, r, 230))}A${r} ${r} 0 1 1 ${pt(P(C, C, r, 214 - i * 2))}" style="${S('gold')}" stroke-width="1.3"/>`;
  }
  b += `<circle cx="${foot[0]}" cy="${foot[1]}" r="${4 + n * 0.6}" style="${F('dial')};${S('gold')}" stroke-width="1.2"/><circle cx="${foot[0]}" cy="${foot[1]}" r="1" style="${F('gold')}"/>`;
  // hammers
  for (let i = 0; i < n; i++) {
    const a = 206 - i * (n > 2 ? 15 : 20), gr = 74 - i * 3.4;
    const hd = P(C, C, gr - 4.4, a), pv = P(C, C, gr - 11, a - 24), tl = P(C, C, gr - 12, a - 31);
    b += `<path d="M${pt(tl)}L${pt(pv)}L${pt(hd)}" style="${S('gold')}" stroke-width="2.2"/><circle cx="${hd[0]}" cy="${hd[1]}" r="3" style="${F('gold')}"/><circle cx="${pv[0]}" cy="${pv[1]}" r="2.2" style="${F('dial')};${S('case')}" stroke-width="1"/>`;
  }
  // sound waves outside the case
  const waves = [94, 101, 108].map((r, i) => {
    const s = P(C, C, r, 178), e = P(C, C, r, 222);
    return `<path class="cx-pulse" style="animation-delay:${-i * 0.35}s;${S('gold')}" d="M${pt(s)}A${r} ${r} 0 0 1 ${pt(e)}" stroke-width="${1.2 - i * 0.3}"/>`;
  });
  b += waves.join('');
  if (sel) {
    // Grande / Petite / Silence selector
    b += ['G', 'P', 'S'].map((t, i) => { const p = P(C, C, 54, 62 + i * 14); return `<text x="${p[0]}" y="${p[1] + 2}" text-anchor="middle" style="${T};${F(i ? 'muted' : 'gold')}" font-size="6.5" font-weight="600">${t}</text>`; }).join('');
    const q = P(C, C, 34, 82);
    b += `<path d="M${pt(q)}L${pt(P(C, C, 47, 63))}" style="${S('gold')}" stroke-width="1.6"/><circle cx="${q[0]}" cy="${q[1]}" r="2" style="${F('gold')}"/>`;
  }
  b += `<text x="${C}" y="128" text-anchor="middle" style="${T};${F('muted')}" font-size="6.5" letter-spacing="1.4">${label}</text>`;
  return svg(b);
};

export default {
  'world-time': (o) => {
    const cities = 'LON PAR CAI MOW DXB KHI DAC BKK HKG TYO SYD NOU AKL MDY HNL ANC LAX DEN CHI NYC CCS RIO FEN AZO'.split(' ');
    let b = wrist(push(300, 'gold'));
    b += `<g text-anchor="middle" style="${T};${F('gold')}" font-size="6" letter-spacing=".3">` + cities.map((c, i) => `<text x="100" y="30" transform="rotate(${i * 15} 100 100)">${c}</text>`).join('') + '</g>';
    b += `<circle cx="100" cy="100" r="65.5" style="${S('muted')}" stroke-width=".6"/>`;
    // rotating 24-hour day/night ring
    let ring = `<path d="M35 100A65 65 0 0 1 165 100H159A59 59 0 0 0 41 100Z" style="${F('gold')}" opacity=".32"/>`;
    ring += `<path d="M35 100A65 65 0 0 0 165 100H159A59 59 0 0 1 41 100Z" style="${F('night')}"/>`;
    for (let h = 0; h < 24; h++) {
      const a = h * 15 + 180, night = h < 6 || h >= 18;
      if (h % 2) { const p = P(100, 100, 54, a); ring += `<circle cx="${p[0]}" cy="${p[1]}" r=".8" style="${F('muted')}"/>`; continue; }
      ring += `<text x="100" y="48.5" transform="rotate(${a} 100 100)" style="${F(night ? 'muted' : 'line')}">${h || 24}</text>`;
    }
    const sun = P(100, 100, 62, 180 + 12 * 15);
    ring += `<circle cx="${sun[0]}" cy="${sun[1]}" r="2.6" style="${F('gold')}"/>`;
    ring += `<path d="M99 159.4a2.6 2.6 0 1 0 3 3.2 2 2 0 1 1 -3 -3.2z" style="${F('gold')}"/>`;
    b += rot('cx-spin-rev-12s', 100, 100, `<g text-anchor="middle" style="${T}" font-size="6.2">${ring}</g>`);
    b += `<circle cx="100" cy="100" r="46" style="${S('gold')}" stroke-width=".8"/>`;
    // globe
    b += `<circle cx="100" cy="100" r="30" style="${S('muted')}" stroke-width=".6"/><ellipse cx="100" cy="100" rx="13" ry="30" style="${S('muted')}" stroke-width=".5"/><path d="M70 100H130M74 85H126M74 115H126M100 70V130" style="${S('muted')}" stroke-width=".5"/>`;
    b += hands(100, 100, 30, 44, 300, 60);
    return svg(b);
  },

  alarm: (o) => {
    let b = wrist(push(45, 'gold'));
    b += ticks(100, 100, 77, 9, 12, S('line'), 2.2);
    b += scale(100, 100, 77, 3, 60, S('muted'), 0.6);
    // alarm setting disc with gold arrow
    b += `<circle cx="100" cy="100" r="24" style="${S('muted')}" stroke-width=".6"/>`;
    b += ticks(100, 100, 24, 3, 12, S('gold'), 0.8);
    const tip = P(100, 100, 64, 210), l = P(100, 100, 56, 205), r = P(100, 100, 56, 215), bl = P(100, 100, 5, 120), br = P(100, 100, 5, 300);
    b += `<path d="M${pt(bl)}L${pt(P(100, 100, 56, 209))}L${pt(l)}L${pt(tip)}L${pt(r)}L${pt(P(100, 100, 56, 211))}L${pt(br)}Z" style="${F('gold')}"/>`;
    b += hands(100, 100, 40, 62, 305, 58);
    // bell with ringing waves
    b += `<path d="M91 60Q91 44 100 44Q109 44 109 60L112 63H88Z" style="${F('dial')};${S('gold')}" stroke-width="1.4"/><circle cx="100" cy="66" r="2" style="${F('gold')}"/><circle cx="100" cy="42" r="1.4" style="${F('gold')}"/>`;
    b += [0, 1].map((i) => `<path class="cx-pulse" style="animation-delay:${-i * 0.4}s;${S('gold')}" stroke-width="${1 - i * 0.3}" d="M${84 - i * 5} ${46 - i * 2}Q${80 - i * 5} 54 ${84 - i * 5} ${62 + i * 2}M${116 + i * 5} ${46 - i * 2}Q${120 + i * 5} 54 ${116 + i * 5} ${62 + i * 2}"/>`).join('');
    b += `<circle cx="100" cy="132" r="2.2" class="cx-pulse" style="${F('red')}"/>`;
    b += `<text x="100" y="146" text-anchor="middle" style="${T};${F('muted')}" font-size="6.5" letter-spacing="1.6">ALARM</text>`;
    return svg(b);
  },

  'quarter-repeater': (o) => striking(o, { n: 2, slide: true, pocket: true, label: '¼ REPEATER' }),
  'minute-repeater': (o) => striking(o, { n: 2, slide: true, snail: true, label: 'MINUTES' }),
  'grande-sonnerie': (o) => striking(o, { n: 4, sel: true, label: 'SONNERIE' }),

  tourbillon: (o) => {
    let b = wrist();
    b += subdial(100, 58, 26);
    b += aperture(100, 130, 38);
    b += scale(100, 130, 34.5, 2, 60, S('muted'), 0.4);
    b += cage(100, 130, 27);
    // upper tourbillon bridge
    b += bridge(64, 148, 136, 112, 6, 100, 130);
    return svg(b);
  },

  'flying-tourbillon': (o) => {
    let b = wrist();
    b += subdial(100, 50, 22);
    b += aperture(100, 124, 44);
    // lower carriage bearing (the cage is cantilevered from below: no bridge)
    b += `<circle cx="100" cy="124" r="36" style="${S('muted')}" stroke-width=".6" stroke-dasharray="1.2 2"/>`;
    b += cage(100, 124, 32, true);
    b += `<text x="100" y="176" text-anchor="middle" style="${T};${F('muted')}" font-size="5" letter-spacing="1.4">FLYING</text>`;
    return svg(b);
  },

  'multi-axis-tourbillon': (o) => {
    let b = wrist();
    b += subdial(100, 44, 19);
    b += aperture(100, 116, 50);
    const C = [100, 116];
    // outer carriage (tilted ring) and middle carriage on different axes
    const ring = (rx, ry, cls, w, tilt) =>
      rot(cls, C[0], C[1], `<g transform="rotate(${tilt} ${C[0]} ${C[1]})"><ellipse cx="${C[0]}" cy="${C[1]}" rx="${rx}" ry="${ry}" style="${S('gold')}" stroke-width="${w}"/><ellipse cx="${C[0]}" cy="${C[1]}" rx="${rx - 2.5}" ry="${ry - 2}" style="${S('gold')}" stroke-width=".4"/><circle cx="${C[0] - rx}" cy="${C[1]}" r="2.3" style="${F('gold')}"/><circle cx="${C[0] + rx}" cy="${C[1]}" r="2.3" style="${F('gold')}"/></g>`);
    b += ring(43, 17, 'cx-spin-12s', 1.8, 0);
    b += ring(31, 12, 'cx-spin-rev-12s', 1.5, 90);
    b += cage(C[0], C[1], 17);
    b += `<text x="100" y="175.5" text-anchor="middle" style="${T};${F('muted')}" font-size="5" letter-spacing="1.4">3 AXES</text>`;
    return svg(b);
  },

  carrousel: (o) => {
    let b = wrist();
    b += subdial(100, 50, 22);
    b += aperture(100, 124, 46);
    const c = [89, 128], rc = 28, rd = 14, th = -40; // cage centre, radii, contact direction (deg from +x, up)
    const d = [R(c[0] + (rc + rd) * Math.cos(rad(th))), R(c[1] + (rc + rd) * Math.sin(rad(th)))];
    const aC = 90 + th; // contact angle in clockwise-from-12 terms, seen from the cage
    // driver (third-wheel drive) meshing with the toothed carriage
    b += rot('cx-spin-6s', d[0], d[1], gear(d[0], d[1], rd, 14, 3, S('gold'), 1, aC + 180 + 360 / 28) + `<path d="M${d[0] - 9} ${d[1]}H${d[0] + 9}M${d[0]} ${d[1] - 9}V${d[1] + 9}" style="${S('gold')}" stroke-width="1"/><circle cx="${d[0]}" cy="${d[1]}" r="9" style="${S('gold')}" stroke-width=".6"/>`);
    b += `<circle cx="${d[0]}" cy="${d[1]}" r="2.2" style="${F('dial')};${S('case')}" stroke-width="1"/>`;
    // carriage with toothed rim, turning the other way
    let car = gear(c[0], c[1], rc, 28, 3, S('gold'), 1.1, aC);
    car += `<circle cx="${c[0]}" cy="${c[1]}" r="${rc - 4}" style="${S('gold')}" stroke-width=".5"/>`;
    car += `<path d="${[30, 150, 270].map((a) => `M${pt(P(c[0], c[1], 5, a))}L${pt(P(c[0], c[1], rc - 4, a))}`).join('')}" style="${S('gold')}" stroke-width="1.6"/>`;
    const e = P(c[0], c[1], 17, 90);
    car += gear(e[0], e[1], 4.5, 10, 1.4, S('muted'), 0.6);
    car += balance(c[0], c[1], 12);
    b += rot('cx-spin-rev-12s', c[0], c[1], car);
    // carriage bridge
    b += bridge(c[0] - 38, c[1] + 16, c[0], c[1], 5, c[0], c[1]);
    b += `<text x="100" y="177" text-anchor="middle" style="${T};${F('muted')}" font-size="5" letter-spacing="1.2">KARRUSEL</text>`;
    return svg(b);
  },

  'constant-force-escapement': (o) => {
    let b = wrist();
    // dead-beat seconds (the remontoir releases once per second)
    b += `<circle cx="100" cy="58" r="28" style="${S('muted')}" stroke-width=".7"/>`;
    b += scale(100, 58, 26, 2.5, 60, S('muted'), 0.5) + ticks(100, 58, 26, 5, 12, S('line'), 1.2);
    b += hands(100, 58, 13, 20, 300, 55);
    b += rot('cx-tick-60', 100, 58, `<path d="M100 64V34" style="${S('blue')}" stroke-width=".9"/><circle cx="100" cy="58" r="1.4" style="${F('blue')}"/>`);
    b += aperture(100, 128, 38);
    // balance + escape wheel on the left
    b += balance(78, 134, 13, 'line');
    b += gear(99, 150, 6, 15, 1.8, S('muted'), 0.6) + `<path d="M92 142L99 150" style="${S('muted')}" stroke-width=".8"/>`;
    // remontoir: toothed wheel carrying a gold spring, stop-star released once a second
    const m = [118, 122];
    b += gear(m[0], m[1], 15, 28, 2.2, S('gold'), 1) + spiral(m[0], m[1], 3.2, 12, 3.2, S('gold'), 0.9);
    let star = '';
    for (let i = 0; i < 6; i++) star += (i ? 'L' : 'M') + pt(P(m[0], m[1], i % 2 ? 2.6 : 6.5, i * 60));
    b += rot('cx-jump', m[0], m[1], `<path d="${star}Z" style="${F('gold')}"/>`);
    b += `<path d="M131 148L122 128" style="${S('line')}" stroke-width="1.4"/><circle cx="131" cy="148" r="2" style="${F('dial')};${S('case')}" stroke-width="1"/>`;
    b += `<text x="100" y="175.5" text-anchor="middle" style="${T};${F('muted')}" font-size="5" letter-spacing="1.2">REMONTOIR</text>`;
    return svg(b);
  },

  'fusee-and-chain': (o) => {
    let b = `<circle cx="100" cy="100" r="86" style="${F('dial')};${S('case')}" stroke-width="3"/><circle cx="100" cy="100" r="80.5" style="${S('muted')}" stroke-width=".6"/>`;
    b += `<path d="M28 56H172M28 156H172" style="${S('muted')}" stroke-width=".7"/>`; // plates
    // barrel (mainspring)
    b += `<path d="M44 76V128A22 6 0 0 0 88 128V76" style="${F('dial')};${S('case')}" stroke-width="1.3"/><ellipse cx="66" cy="76" rx="22" ry="6" style="${F('dial')};${S('case')}" stroke-width="1.3"/>`;
    b += `<path d="M66 58V70M66 134V156" style="${S('case')}" stroke-width="1.6"/>`;
    b += spiral(66, 76, 1.5, 6, 2, S('muted'), 0.5).replace(/d="/, 'transform="matrix(1 0 0 .3 0 53.2)" d="');
    // chain wraps on the barrel
    for (let y = 104; y <= 124; y += 5) b += `<path d="M44 ${y}A22 6 0 0 0 88 ${y}" style="${S('gold')}" stroke-width="1.8" stroke-dasharray="2.4 1"/>`;
    // fusée cone
    const fx = 130, top = 64, bot = 134, r0 = 7, r1 = 25;
    const rAt = (y) => r0 + ((y - top) / (bot - top)) * (r1 - r0);
    b += `<path d="M${fx} 56V${top}M${fx} ${bot + 8}V156" style="${S('case')}" stroke-width="1.6"/>`;
    b += `<path d="M${fx - r0} ${top}L${fx - r1} ${bot}A${r1} 6 0 0 0 ${fx + r1} ${bot}L${fx + r0} ${top}" style="${F('dial')};${S('line')}" stroke-width="1.1"/><ellipse cx="${fx}" cy="${top}" rx="${r0}" ry="2" style="${F('dial')};${S('line')}" stroke-width="1"/>`;
    // spiral groove, chain in the lower turns
    const contact = 92;
    for (let y = top + 5; y < bot; y += 6) {
      const ra = rAt(y), rb = rAt(y + 3);
      const on = y >= contact;
      b += `<path d="M${R(fx - ra)} ${y}Q${fx} ${R(y + 4 + ra / 5)} ${R(fx + rb)} ${y + 3}" style="${S(on ? 'gold' : 'muted')}" stroke-width="${on ? 1.8 : 0.6}"${on ? ' stroke-dasharray="2.4 1"' : ''}/>`;
    }
    // chain run from barrel to fusée
    const cx0 = R(fx - rAt(contact));
    b += `<path d="M88 102L${cx0} ${contact}" style="${S('gold')}" stroke-width="2.4" stroke-dasharray="2.6 1"/><path d="M88 102L${cx0} ${contact}" style="${S('dial')}" stroke-width=".5"/>`;
    // great wheel under the fusée
    b += `<ellipse cx="${fx}" cy="${bot + 8}" rx="30" ry="7" style="${F('dial')};${S('gold')}" stroke-width="1.2"/>`;
    let t = '';
    for (let i = 0; i <= 20; i++) { const a = Math.PI * (i / 20); t += `M${R(fx - 30 * Math.cos(a))} ${R(bot + 8 + 7 * Math.sin(a))}v2.4`; }
    b += `<path d="${t}" style="${S('gold')}" stroke-width=".8"/>`;
    b += `<path d="M${fx - r1} ${bot}A${r1} 6 0 0 0 ${fx + r1} ${bot}" style="${S('line')}" stroke-width="1.1"/>`;
    // balance, for life
    b += balance(160, 80, 9, 'line');
    b += `<text x="100" y="170" text-anchor="middle" style="${T};${F('muted')}" font-size="6" letter-spacing="1.4">FUSÉE</text>`;
    return svg(b);
  },

  automaton: (o) => {
    const clip = `${o.uid}-scene`;
    let b = wrist();
    b += `<defs><clipPath id="${clip}"><path d="M28 98H172A72 72 0 0 1 28 98Z"/></clipPath></defs>`;
    b += subdial(100, 56, 24, 300, 50);
    b += `<g clip-path="url(#${clip})"><rect x="20" y="90" width="160" height="90" style="${F('night')}"/>`;
    // stars and moon
    b += [[48, 110], [62, 104], [150, 112], [140, 104], [84, 108], [160, 124]].map(([x, y], i) => `<circle cx="${x}" cy="${y}" r="${i % 2 ? 0.8 : 1.1}" class="cx-pulse" style="animation-delay:${-i * 0.3}s;${F('gold')}"/>`).join('');
    b += `<path d="M58 124a7 7 0 1 0 7 9 5.6 5.6 0 1 1 -7 -9z" style="${F('gold')}" opacity=".9"/>`;
    // hills
    b += `<path d="M20 160Q60 138 100 152T180 146V180H20Z" style="${F('dial')}" opacity=".92"/><path d="M20 160Q60 138 100 152T180 146" style="${S('muted')}" stroke-width=".7"/>`;
    // windmill
    b += `<path d="M120 152L124 124H132L136 152Z" style="${F('dial')};${S('gold')}" stroke-width="1.1"/><path d="M122 120L128 114L134 120Z" style="${F('gold')}"/><rect x="126" y="142" width="4" height="10" rx="2" style="${F('gold')}"/>`;
    // little figure with lantern
    b += `<circle cx="84" cy="141" r="2.2" style="${F('gold')}"/><path d="M84 143.6Q80.6 146 80 154H88Q87.4 146 84 143.6Z" style="${F('gold')}"/><path d="M82 154L81.4 158M86 154L86.6 158M86.4 147L89 149.4" style="${S('gold')}" stroke-width="1.1"/><circle cx="89" cy="150" r="1.3" class="cx-pulse" style="${F('gold')}"/>`;
    b += `</g>`;
    // sails (turn)
    const hub = [128, 121];
    let sails = '';
    for (let a = 45; a < 360; a += 90) {
      const e = P(hub[0], hub[1], 21, a), s1 = P(hub[0], hub[1], 7, a + 9), s2 = P(hub[0], hub[1], 21, a + 13);
      sails += `<path d="M${hub[0]} ${hub[1]}L${pt(e)}" style="${S('gold')}" stroke-width="1.3"/><path d="M${pt(P(hub[0], hub[1], 7, a))}L${pt(e)}L${pt(s2)}L${pt(s1)}Z" style="${F('gold')};${S('gold')}" fill-opacity=".25" stroke-width=".6"/>`;
    }
    b += rot('cx-spin-6s', hub[0], hub[1], sails) + `<circle cx="${hub[0]}" cy="${hub[1]}" r="1.8" style="${F('gold')}"/>`;
    b += `<path d="M28 98H172A72 72 0 0 1 28 98Z" style="${S('case')}" stroke-width="1.4"/>`;
    return svg(b);
  },
};
