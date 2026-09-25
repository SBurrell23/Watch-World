/*
 * Watch World: procedural SVG watch renderer.
 *
 *   renderWatch(visual, { size = 240, showStrap = true, live = false, title })  -> SVG string
 *   startLiveHands(svgOrContainer)                                               -> stop()
 *   fallbackVisual(seedString)                                                   -> visual object
 *
 * Dependency-free ES module. Every render gets a unique id prefix so any number of
 * watches can live on one page. All geometry is drawn in a fixed viewBox centred on
 * the dial (0,0); clock angles are degrees clockwise from 12 o'clock.
 */

const D2R = Math.PI / 180;
let SEQ = 0;

/* ------------------------------------------------------------------ enums */

const E = {
  caseShape: ['round', 'cushion', 'tonneau', 'rectangular', 'square', 'octagon', 'oval'],
  caseMetal: ['steel', 'yellow-gold', 'rose-gold', 'white-gold', 'platinum', 'titanium', 'black', 'ceramic-white', 'bronze', 'two-tone', 'plastic', 'carbon'],
  dialTexture: ['sunburst', 'matte', 'guilloche', 'tapisserie', 'linen', 'enamel', 'skeleton', 'meteorite', 'textured', 'digital'],
  bezel: ['smooth', 'fluted', 'dive', 'gmt', 'tachymeter', 'none', 'octagon-screws', 'compass', 'slide-rule', 'digital'],
  hands: ['baton', 'dauphine', 'sword', 'mercedes', 'breguet', 'cathedral', 'leaf', 'snowflake', 'arrow', 'pencil', 'skeleton'],
  indices: ['baton', 'arabic', 'roman', 'dots', 'applied-mixed', 'breguet-numerals', 'explorer', 'none'],
  complications: ['date', 'day-date', 'chronograph', 'gmt', 'moonphase', 'small-seconds', 'power-reserve', 'tourbillon', 'perpetual-calendar', 'world-time', 'digital', 'open-heart', 'big-date', 'jumping-hour', 'retrograde'],
  strap: ['bracelet', 'integrated-bracelet', 'leather', 'rubber', 'nato', 'mesh', 'fabric', 'resin'],
  crown: ['normal', 'crown-guard', 'onion', 'left'],
};

const ALIAS = {
  gold: 'yellow-gold', yellow: 'yellow-gold', 'yellow-gold-18k': 'yellow-gold', rose: 'rose-gold', 'red-gold': 'rose-gold', 'pink-gold': 'rose-gold',
  everose: 'rose-gold', 'sedna-gold': 'rose-gold', 'stainless-steel': 'steel', stainless: 'steel', oystersteel: 'steel', silver: 'steel',
  pvd: 'black', dlc: 'black', 'black-ceramic': 'black', ceramic: 'black', 'black-pvd': 'black', 'black-dlc': 'black', 'white-ceramic': 'ceramic-white',
  resin: 'plastic', bioceramic: 'plastic', 'carbon-fibre': 'carbon', 'carbon-fiber': 'carbon', 'forged-carbon': 'carbon', bicolor: 'two-tone', rolesor: 'two-tone',
  rectangle: 'rectangular', barrel: 'tonneau', circle: 'round', ellipse: 'oval', octagonal: 'octagon',
  'crown-guards': 'crown-guard', guard: 'crown-guard', guards: 'crown-guard', destro: 'left',
  integrated: 'integrated-bracelet', milanese: 'mesh', canvas: 'fabric', textile: 'fabric', silicone: 'rubber', alligator: 'leather', crocodile: 'leather', 'fkm': 'rubber',
  'sun-burst': 'sunburst', sunray: 'sunburst', 'grand-feu': 'enamel', openworked: 'skeleton', lcd: 'digital', oled: 'digital', lacquer: 'enamel', stone: 'meteorite',
  diver: 'dive', tachy: 'tachymeter', '24h': 'gmt', daydate: 'day-date', chrono: 'chronograph', 'moon-phase': 'moonphase',
  'small-second': 'small-seconds', subseconds: 'small-seconds', perpetual: 'perpetual-calendar', worldtime: 'world-time', 'big-date': 'big-date', 'bigdate': 'big-date',
  numerals: 'arabic', 'arabic-numerals': 'arabic', 'roman-numerals': 'roman', breguet_numerals: 'breguet-numerals', 'feuille': 'leaf', 'plongeur': 'sword',
};

function pick(val, list, def) {
  if (typeof val !== 'string') return def;
  const s = val.trim().toLowerCase().replace(/[\s_]+/g, '-');
  if (list.includes(s)) return s;
  const a = ALIAS[s];
  return a && list.includes(a) ? a : def;
}

/* ------------------------------------------------------------------ colour */

function hexc(h, d) {
  if (typeof h !== 'string') return d;
  let s = h.trim();
  if (s[0] !== '#') s = '#' + s;
  if (/^#[0-9a-f]{3}$/i.test(s)) s = '#' + s[1] + s[1] + s[2] + s[2] + s[3] + s[3];
  return /^#[0-9a-f]{6}$/i.test(s) ? s.toLowerCase() : d;
}
const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const hex = (a) => '#' + a.map((x) => Math.max(0, Math.min(255, Math.round(x))).toString(16).padStart(2, '0')).join('');
const mix = (a, b, t) => { const A = rgb(a), B = rgb(b); return hex(A.map((x, i) => x + (B[i] - x) * t)); };
const lt = (h, t) => mix(h, '#ffffff', t);
const dk = (h, t) => mix(h, '#000000', t);
const lum = (h) => {
  const [r, g, b] = rgb(h).map((x) => { x /= 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const cdist = (a, b) => { const A = rgb(a), B = rgb(b); return Math.hypot(A[0] - B[0], A[1] - B[1], A[2] - B[2]); };
const ink = (bg) => (lum(bg) > 0.4 ? '#17191d' : '#f3f1ea');

const METAL = {
  steel: ['#ffffff', '#dadee3', '#a1a8b0', '#596068'],
  'yellow-gold': ['#fff6d6', '#f0d27e', '#c79a3e', '#7a561b'],
  'rose-gold': ['#ffeade', '#ecb7a0', '#c48167', '#7a4433'],
  'white-gold': ['#ffffff', '#e7e6e0', '#b7b6ae', '#6b6a64'],
  platinum: ['#ffffff', '#e8ebf0', '#bec4cc', '#77808b'],
  titanium: ['#e4e5e2', '#b5b8b4', '#898c88', '#4a4d4a'],
  black: ['#7a7e86', '#3c3f45', '#202226', '#060607'],
  'ceramic-white': ['#ffffff', '#f7f6f3', '#e1dfd9', '#a8a6a0'],
  bronze: ['#f5d4a6', '#cb9a63', '#946539', '#4f3217'],
  carbon: ['#62666d', '#34363b', '#1c1d20', '#08090a'],
};
const fromBase = (b, k = 1) => [lt(b, 0.55 * k), lt(b, 0.22 * k), b, dk(b, 0.5 * k)];

/* ------------------------------------------------------------------ svg utils */

const f = (n) => { const r = Math.round(n * 10) / 10; return String(r === 0 ? 0 : r); };
const f2 = (n) => { const r = Math.round(n * 100) / 100; return String(r === 0 ? 0 : r); };
const P = (r, a) => [r * Math.sin(a * D2R), -r * Math.cos(a * D2R)];
const esc = (s) => String(s).replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
const stops = (list) => list.map(([o, c, a]) => `<stop offset="${o}" stop-color="${c}"${a != null && a !== 1 ? ` stop-opacity="${a}"` : ''}/>`).join('');
const linGrad = (id, list, x1 = 0, y1 = 0, x2 = 1, y2 = 1, extra = '') => `<linearGradient id="${id}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"${extra}>${stops(list)}</linearGradient>`;
const metalStops = (p) => [[0, p[1]], [0.22, p[0]], [0.45, p[2]], [0.64, p[1]], [0.84, p[3]], [1, p[2]]];
const brushStops = (p) => [[0, p[3]], [0.14, p[2]], [0.38, p[0]], [0.56, p[1]], [0.84, p[2]], [1, p[3]]];
const line = (a, r1, r2) => { const [x1, y1] = P(r1, a), [x2, y2] = P(r2, a); return `M${f(x1)} ${f(y1)}L${f(x2)} ${f(y2)}`; };
const rot = (a, r) => `rotate(${f(a)}) translate(0 ${f(-r)})`;

/** Ring of radial marks via a dashed circle: n dashes of `len` length centred on the clock positions. */
function dashRing(r, w, n, len, stroke, op = 1, phase = 0) {
  const C = 2 * Math.PI * r, step = C / n;
  return `<circle r="${f2(r)}" fill="none" stroke="${stroke}" stroke-width="${f2(w)}" stroke-dasharray="${len.toFixed(3)} ${(step - len).toFixed(3)}" stroke-dashoffset="${(len / 2 - phase * step).toFixed(3)}" transform="rotate(-90)"${op !== 1 ? ` opacity="${op}"` : ''}/>`;
}

/* ------------------------------------------------------------------ shapes */

const S = (k, w, h, n = 2) => ({ k, w, h, n });
const inset = (s, d) => ({ ...s, w: s.w - d, h: s.h - d });

function insideF(s) {
  switch (s.k) {
    case 's': return (x, y) => (Math.abs(x / s.w) ** s.n + Math.abs(y / s.h) ** s.n) ** (1 / s.n);
    case 't': return (x, y) => { const t = 1 - 0.24 * (y / s.h) ** 2; return (Math.abs(x / (s.w * t)) ** s.n + Math.abs(y / s.h) ** s.n) ** (1 / s.n); };
    case 'o': return (x, y) => {
      let sum = 0;
      for (let k = 0; k < 8; k++) { const a = k * 45 * D2R, p = (x * Math.sin(a) - y * Math.cos(a)) / s.w; if (p > 0) sum += p ** 22; }
      return sum ** (1 / 22);
    };
    default: return (x, y) => Math.hypot(x / s.w, y / s.h);
  }
}

/** Distance from centre to the outline of shape s along clock angle a. */
function edge(s, a) {
  if (s.k === 'c') {
    if (s.w === s.h) return s.w;
    const sn = Math.sin(a * D2R), cs = Math.cos(a * D2R);
    return 1 / Math.sqrt((sn / s.w) ** 2 + (cs / s.h) ** 2);
  }
  const F = s._f || (s._f = insideF(s));
  const sn = Math.sin(a * D2R), cs = -Math.cos(a * D2R);
  let lo = 0, hi = Math.max(s.w, s.h) * 1.5;
  for (let i = 0; i < 22; i++) { const m = (lo + hi) / 2; if (F(m * sn, m * cs) > 1) hi = m; else lo = m; }
  return (lo + hi) / 2;
}

/** Smooth closed path through polar samples of r(a). */
function polarPath(rf, N = 64) {
  const pts = [];
  for (let i = 0; i < N; i++) { const a = (i * 360) / N; pts.push(P(rf(a), a)); }
  const mid = (p, q) => [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
  let m = mid(pts[N - 1], pts[0]);
  let d = `M${f(m[0])} ${f(m[1])}`;
  for (let i = 0; i < N; i++) { const p = pts[i], q = mid(p, pts[(i + 1) % N]); d += `Q${f(p[0])} ${f(p[1])} ${f(q[0])} ${f(q[1])}`; }
  return d + 'Z';
}

/** Element for shape s (circle/ellipse natively, anything else as a sampled path). */
function shapeEl(s, attrs = '') {
  if (s.k === 'c') return s.w === s.h ? `<circle r="${f(s.w)}"${attrs}/>` : `<ellipse rx="${f(s.w)}" ry="${f(s.h)}"${attrs}/>`;
  return `<path d="${polarPath((a) => edge(s, a), s.k === 'o' || s.n > 5 ? 64 : 48)}"${attrs}/>`;
}
/** <use> of a defined shape scaled inwards by roughly d units (cheap inset). */
const scl = (sh, d) => `scale(${(1 - d / sh.w).toFixed(3)} ${(1 - d / sh.h).toFixed(3)})`;
const iuse = (c, key, sh, d, attrs = '') => `<use href="#${c.u(key)}" transform="${scl(sh, d)}"${attrs}/>`;

/* ------------------------------------------------------------------ seeded rng */

function hashStr(s) { let h = 2166136261; for (const ch of String(s)) { h ^= ch.codePointAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

/* ------------------------------------------------------------------ normalise */

function normalize(vis) {
  const x = vis && typeof vis === 'object' ? vis : {};
  const v = {};
  v.caseShape = pick(x.caseShape, E.caseShape, 'round');
  v.caseMetal = pick(x.caseMetal, E.caseMetal, 'steel');
  v.dialTexture = pick(x.dialTexture, E.dialTexture, 'sunburst');
  v.bezel = pick(x.bezel, E.bezel, 'smooth');
  v.hands = pick(x.hands, E.hands, 'baton');
  v.indices = pick(x.indices, E.indices, 'baton');
  v.strap = pick(x.strap, E.strap, 'leather');
  v.crown = pick(x.crown, E.crown, 'normal');
  const comps = Array.isArray(x.complications) ? x.complications : typeof x.complications === 'string' ? [x.complications] : [];
  v.complications = [...new Set(comps.map((s) => pick(s, E.complications, null)).filter(Boolean))];
  v.digital = v.dialTexture === 'digital';
  v.dialColor = hexc(x.dialColor, v.digital ? '#9aa392' : '#1d2330');
  const dl = lum(v.dialColor);
  const warm = ['yellow-gold', 'rose-gold', 'bronze'].includes(v.caseMetal);
  const defHand = dl > 0.4 ? (warm ? dk(METAL[v.caseMetal][2], 0.3) : '#1c1f26') : warm ? METAL[v.caseMetal][1] : '#e8eaee';
  v.handColor = hexc(x.handColor, defHand);
  v.indexColor = hexc(x.indexColor, v.handColor);
  v.accentColor = hexc(x.accentColor, null);
  v.lumeColor = hexc(x.lumeColor, null);
  v.bezelColor = hexc(x.bezelColor, null);
  v.bezelColor2 = hexc(x.bezelColor2, null);
  const defStrap = { leather: '#4a2e1f', rubber: '#16181b', nato: '#1f2a3d', fabric: '#3b463a', resin: '#16171a' }[v.strap] || null;
  v.strapColor = hexc(x.strapColor, defStrap);
  if (!v.strapColor && !['bracelet', 'integrated-bracelet', 'mesh'].includes(v.strap)) v.strapColor = '#2a2a2a';
  return v;
}

/* ------------------------------------------------------------------ geometry */

function geom(v) {
  const dig = v.digital;
  let cs, lug = 'std', hw, B = null, D = null;
  switch (v.caseShape) {
    case 'cushion': cs = S('s', 64, 64, 3.3); hw = 24; break;
    case 'tonneau': cs = S('t', 54, 68, 4); lug = 'none'; hw = 27; break;
    case 'rectangular': cs = dig ? S('s', 52, 60, 4.6) : S('s', 44, 64, 7); lug = 'rect'; hw = dig ? 36 : 32; break;
    case 'square': cs = S('s', 60, 60, dig ? 4.4 : 6); lug = 'rect'; hw = dig ? 38 : 42; break;
    case 'octagon': cs = S('s', 66, 62, 2.6); hw = 24; B = S('o', 58, 58); D = S('c', 46, 46); break;
    case 'oval': cs = S('c', 52, 66); hw = 21; break;
    default: cs = S('c', 66, 66); hw = 22;
  }
  const bwMap = { none: 3.6, smooth: 6.5, fluted: 8.5, dive: 11.5, gmt: 11.5, tachymeter: 11.5, compass: 11, 'slide-rule': 12, digital: 11, 'octagon-screws': 10 };
  const bw = bwMap[v.bezel] || 6.5;
  if (!B) B = inset(cs, v.bezel === 'none' ? 1.5 : 2.2);
  if (!D) D = inset(B, bw);
  if (v.caseShape === 'rectangular' && v.bezel === 'none' && !dig) D = { ...D, w: D.w - 3.5 };
  if (dig && lug === 'rect') { lug = 'none'; hw = cs.w * 0.74; }
  if (v.strap === 'integrated-bracelet') { lug = 'int'; hw = Math.max(hw, cs.w * 0.64); }
  return { cs, B, D, lug, hw, R: Math.min(D.w, D.h) };
}

/* ------------------------------------------------------------------ main render */

export function renderWatch(visual, opts = {}) {
  const v = normalize(visual);
  const size = +opts.size > 0 ? +opts.size : 240;
  const showStrap = opts.showStrap !== false;
  const live = !!opts.live;
  const id = 'ww' + (++SEQ).toString(36) + Math.random().toString(36).slice(2, 6);
  const G = geom(v);
  const c = { v, G, live, defs: [], n: 0, id, u: (s) => id + s, url: (s) => `url(#${id}${s})`, nid: () => id + 'k' + c.n++ };

  const pal = v.caseMetal === 'plastic' ? fromBase(plasticColor(v), 0.7) : METAL[v.caseMetal === 'two-tone' ? 'steel' : v.caseMetal] || METAL.steel;
  const gold = METAL['yellow-gold'];
  c.pal = pal;
  c.bpal = v.caseMetal === 'two-tone' ? gold : pal;
  const { cs, B, D } = G;

  c.defs.push(
    linGrad(c.u('cg'), metalStops(pal)),
    linGrad(c.u('bz'), metalStops(c.bpal), 1, 0, 0, 1),
    linGrad(c.u('lg'), brushStops(pal), 0, 0, 1, 0),
    linGrad(c.u('cr'), brushStops(v.caseMetal === 'two-tone' ? gold : pal), 0, 0, 0, 1),
    shapeEl(cs, ` id="${c.u('cs')}"`),
    shapeEl(B, ` id="${c.u('bs')}"`),
    shapeEl(D, ` id="${c.u('ds')}"`),
    `<clipPath id="${c.u('dc')}"><use href="#${c.u('ds')}"/></clipPath>`,
    `<filter id="${c.u('sh')}" x="-30%" y="-30%" width="160%" height="170%"><feDropShadow dx="0" dy="4" stdDeviation="4.5" flood-color="#000" flood-opacity=".42"/></filter>`,
  );

  let body = '';
  if (showStrap) body += strapSVG(c);
  body += lugsSVG(c);
  body += crownSVG(c);
  // case body
  body += `<use href="#${c.u('cs')}" fill="${c.url('cg')}" stroke="${pal[3]}" stroke-width=".7"/>`;
  if (v.caseMetal === 'carbon') body += `<use href="#${c.u('cs')}" fill="${carbonPattern(c)}" opacity=".55"/>`;
  body += `<use href="#${c.u('cs')}" fill="none" stroke="#fff" stroke-opacity=".32" stroke-width=".9" transform="scale(.975)"/>`;
  body += bezelSVG(c);
  body += dialSVG(c);
  body += crystalSVG(c);

  const vb = showStrap ? '-120 -120 240 240' : '-90 -90 180 180';
  const title = opts.title ? String(opts.title) : 'Watch illustration';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}" width="${size}" height="${size}" role="img" aria-label="${esc(title)}"${live ? ' data-ww-live="1"' : ''}><title>${esc(title)}</title><defs>${c.defs.join('')}</defs><g filter="${c.url('sh')}">${body}</g></svg>`;
}

function plasticColor(v) {
  if (v.bezel === 'digital' && v.bezelColor) return v.bezelColor;
  if (['resin', 'rubber'].includes(v.strap) && v.strapColor) return v.strapColor;
  return '#26282c';
}

function carbonPattern(c) {
  const id = c.u('cb');
  if (!c._cb) {
    c._cb = 1;
    c.defs.push(`<pattern id="${id}" width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="2" height="2" fill="#000"/><rect x="2" y="2" width="2" height="2" fill="#000"/><rect x="2" width="2" height="2" fill="#444"/><rect y="2" width="2" height="2" fill="#444"/></pattern>`);
  }
  return `url(#${id})`;
}

/* ------------------------------------------------------------------ straps */

function strapSVG(c) {
  const { v, G } = c, { cs, hw, lug } = G;
  const y0 = lug === 'std' ? cs.h * 0.5 : lug === 'rect' ? cs.h - 12 : lug === 'int' ? cs.h * 0.45 : cs.h - 16;
  const y1 = 124;
  const straight = ['nato', 'fabric'].includes(v.strap);
  const hw1 = straight ? hw : hw * (v.strap === 'integrated-bracelet' ? 0.84 : 0.87);
  const W = (y) => hw + ((hw1 - hw) * (y - y0)) / (y1 - y0);
  const out = `M${f(-hw)} ${f(y0)}L${f(hw)} ${f(y0)}L${f(hw1)} ${y1}L${f(-hw1)} ${y1}Z`;
  const fade = c.u('fd');
  c.defs.push(
    `<linearGradient id="${fade}g" x1="0" y1="-120" x2="0" y2="120" gradientUnits="userSpaceOnUse">${stops([[0, '#000'], [0.1, '#fff'], [0.9, '#fff'], [1, '#000']])}</linearGradient>`,
    `<mask id="${fade}" maskUnits="userSpaceOnUse" x="-130" y="-130" width="260" height="260"><rect x="-130" y="-130" width="260" height="260" fill="url(#${fade}g)"/></mask>`,
    linGrad(c.u('ss'), [[0, '#000', 0.5], [0.16, '#000', 0.08], [0.5, '#fff', 0.1], [0.84, '#000', 0.08], [1, '#000', 0.5]], 0, 0, 1, 0),
  );
  const shade = `<path d="${out}" fill="${c.url('ss')}"/>`;
  let s = '', bottomOnly = '';
  const metalStrap = ['bracelet', 'integrated-bracelet', 'mesh'].includes(v.strap);
  let sp = c.pal;
  if (metalStrap && v.strapColor && v.caseMetal !== 'two-tone' && cdist(v.strapColor, c.pal[2]) > 70) sp = fromBase(v.strapColor);
  if (metalStrap) c.defs.push(linGrad(c.u('bh'), brushStops(sp), 0, 0, 1, 0), linGrad(c.u('bp'), [[0, sp[2]], [0.3, sp[0]], [0.55, sp[1]], [1, sp[3]]], 0, 0, 1, 0));

  if (v.strap === 'bracelet' || v.strap === 'integrated-bracelet') {
    const integ = v.strap === 'integrated-bracelet';
    const cf = integ ? 0.24 : 0.36, lh = integ ? 10.5 : 8.6;
    const cp = v.caseMetal === 'two-tone' ? METAL['yellow-gold'] : sp;
    if (v.caseMetal === 'two-tone') c.defs.push(linGrad(c.u('bp'), [[0, cp[2]], [0.3, cp[0]], [0.55, cp[1]], [1, cp[3]]], 0, 0, 1, 0).replace(`id="${c.u('bp')}"`, `id="${c.u('bq')}"`));
    const cfill = v.caseMetal === 'two-tone' ? c.url('bq') : c.url('bp');
    s += `<path d="${out}" fill="${c.url('bh')}"/>`;
    s += `<path d="M${f(-hw * cf)} ${f(y0)}L${f(hw * cf)} ${f(y0)}L${f(hw1 * cf)} ${y1}L${f(-hw1 * cf)} ${y1}Z" fill="${cfill}"/>`;
    let dd = '', hl = '';
    const start = integ ? cs.h + 3 : cs.h + 2;
    for (let y = start; y < y1; y += lh) {
      const w = W(y);
      dd += `M${f(-w)} ${f(y)}L${f(-w * cf)} ${f(y)}M${f(w * cf)} ${f(y)}L${f(w)} ${f(y)}`;
      hl += `M${f(-w + 0.6)} ${f(y + 0.8)}L${f(-w * cf - 0.6)} ${f(y + 0.8)}M${f(w * cf + 0.6)} ${f(y + 0.8)}L${f(w - 0.6)} ${f(y + 0.8)}`;
      const yc = y + lh / 2, wc = W(yc) * cf;
      dd += `M${f(-wc)} ${f(yc)}L${f(wc)} ${f(yc)}`;
      hl += `M${f(-wc + 0.5)} ${f(yc + 0.8)}L${f(wc - 0.5)} ${f(yc + 0.8)}`;
    }
    dd += `M${f(-hw * cf)} ${f(y0)}L${f(-hw1 * cf)} ${y1}M${f(hw * cf)} ${f(y0)}L${f(hw1 * cf)} ${y1}`;
    s += `<path d="${dd}" stroke="${sp[3]}" stroke-width=".9" opacity=".75"/><path d="${hl}" stroke="#fff" stroke-width=".5" opacity=".45"/>`;
    s += shade.replace('fill=', 'opacity=".6" fill=');
  } else if (v.strap === 'mesh') {
    const pid = c.u('mp');
    c.defs.push(`<pattern id="${pid}" width="2.2" height="2.2" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><path d="M0 1.1H2.2M1.1 0V2.2" stroke="#000" stroke-width=".55" opacity=".45"/></pattern>`);
    s += `<path d="${out}" fill="${c.url('bh')}"/><path d="${out}" fill="url(#${pid})"/>` + shade;
  } else {
    const sc = v.strapColor;
    s += `<path d="${out}" fill="${sc}"/>`;
    const stitch = (col, ins = 2.3, dash = '2.2 1.5') => {
      const a = `M${f(-hw + ins)} ${f(y0)}L${f(-hw1 + ins)} ${y1}M${f(hw - ins)} ${f(y0)}L${f(hw1 - ins)} ${y1}`;
      return `<path d="${a}" stroke="${col}" stroke-width=".7" stroke-dasharray="${dash}" fill="none" opacity=".9"/>`;
    };
    if (v.strap === 'leather') {
      const pid = c.u('lp');
      c.defs.push(`<pattern id="${pid}" width="7" height="5.2" patternUnits="userSpaceOnUse"><rect x=".5" y=".5" width="6" height="4.2" rx="1.8" fill="none" stroke="#000" stroke-width=".55"/><rect x="-3" y="3.1" width="6" height="4.2" rx="1.8" fill="none" stroke="#000" stroke-width=".55"/><rect x="4" y="3.1" width="6" height="4.2" rx="1.8" fill="none" stroke="#000" stroke-width=".55"/></pattern>`);
      s += `<path d="${out}" fill="url(#${pid})" opacity=".22"/>` + shade + stitch(mix(sc, '#f3e9d6', 0.62));
    } else if (v.strap === 'rubber') {
      let g = '';
      for (let y = cs.h + 6; y < y1; y += 5.5) { const w = W(y) * 0.52; g += `M${f(-w)} ${f(y)}L${f(w)} ${f(y)}`; }
      s += `<path d="${g}" stroke="#000" stroke-width="1.3" opacity=".35"/><path d="${g}" stroke="#fff" stroke-width=".4" opacity=".12" transform="translate(0 .9)"/>` + shade;
    } else if (v.strap === 'nato' || v.strap === 'fabric') {
      const pid = c.u('np');
      if (v.strap === 'nato') {
        const st = v.accentColor || lt(sc, 0.45), st2 = lt(sc, 0.25);
        s += `<rect x="${f(-hw * 0.2)}" y="${f(y0)}" width="${f(hw * 0.4)}" height="${f(y1 - y0)}" fill="${st2}"/>`;
        s += `<rect x="${f(-hw * 0.52)}" y="${f(y0)}" width="${f(hw * 0.12)}" height="${f(y1 - y0)}" fill="${st}"/><rect x="${f(hw * 0.4)}" y="${f(y0)}" width="${f(hw * 0.12)}" height="${f(y1 - y0)}" fill="${st}"/>`;
        c.defs.push(`<pattern id="${pid}" width="1.6" height="1.6" patternUnits="userSpaceOnUse"><path d="M0 .4H1.6" stroke="#000" stroke-width=".5" opacity=".35"/></pattern>`);
      } else {
        c.defs.push(`<pattern id="${pid}" width="2" height="2" patternUnits="userSpaceOnUse" patternTransform="rotate(35)"><path d="M0 .5H2" stroke="#000" stroke-width=".7" opacity=".35"/><path d="M0 1.5H2" stroke="#fff" stroke-width=".4" opacity=".12"/></pattern>`);
      }
      s += `<path d="${out}" fill="url(#${pid})"/>` + shade + stitch(lt(sc, 0.35), 1.6, '1.6 1.1');
    } else { // resin
      let g = '';
      for (let y = cs.h + 5; y < y1; y += 6.5) { const w = W(y) - 1.5; g += `M${f(-w)} ${f(y)}L${f(w)} ${f(y)}`; }
      s += `<path d="${g}" stroke="#000" stroke-width="1.6" opacity=".45"/><path d="${g}" stroke="#fff" stroke-width=".5" opacity=".14" transform="translate(0 1.2)"/>` + shade;
      for (let y = cs.h + 28; y < y1 - 4; y += 7.5) bottomOnly += `<ellipse cy="${f(y)}" rx="1.6" ry="1.9" fill="#000" opacity=".75"/>`;
    }
  }
  const sid = c.u('st');
  return `<g mask="url(#${fade})"><g id="${sid}">${s}</g><use href="#${sid}" transform="scale(1 -1)"/>${bottomOnly}</g>`;
}

/* ------------------------------------------------------------------ lugs, crown, pushers */

function lugsSVG(c) {
  const { cs, hw, lug } = c.G;
  if (lug === 'std') {
    const F = insideF(cs);
    const L = cs.h + 15, x0 = hw + 0.6, x1 = hw + 10.5;
    const yb = cs.h * (c.v.caseShape === 'oval' ? 0.72 : 0.64);
    let lo = 0, hi = cs.w;
    for (let i = 0; i < 20; i++) { const m = (lo + hi) / 2; if (F(m, yb) > 1) hi = m; else lo = m; }
    const xb = Math.max(x1 + 2, lo - 1.5);
    const d = `M${f(x0)} ${f(yb - 8)}L${f(x0)} ${f(L - 2.4)}Q${f(x0)} ${f(L)} ${f(x0 + 2.4)} ${f(L)}L${f(x1 - 2.2)} ${f(L)}Q${f(x1)} ${f(L)} ${f(x1)} ${f(L - 2.4)}L${f(x1)} ${f(L - 6)}C${f(x1)} ${f(yb + 9)} ${f(xb - 3)} ${f(yb + 4)} ${f(xb)} ${f(yb - 3)}L${f(xb)} ${f(yb - 8)}Z`;
    const id = c.u('lu');
    c.defs.push(`<g id="${id}"><path d="${d}" fill="${c.url('cg')}" stroke="${c.pal[3]}" stroke-width=".5"/><path d="M${f(x0 + 1.2)} ${f(yb)}L${f(x0 + 1.2)} ${f(L - 2.6)}" stroke="#fff" stroke-width=".8" opacity=".5"/><path d="M${f(x1 - 0.8)} ${f(L - 5)}C${f(x1 - 0.8)} ${f(yb + 9)} ${f(xb - 3.5)} ${f(yb + 3.5)} ${f(xb - 0.6)} ${f(yb - 3)}" fill="none" stroke="#000" stroke-width=".7" opacity=".25"/></g>`);
    return ['', ' transform="scale(-1 1)"', ' transform="scale(1 -1)"', ' transform="scale(-1 -1)"'].map((t) => `<use href="#${id}"${t}/>`).join('');
  }
  if (lug === 'rect') {
    const x0 = hw + 0.4, x1 = Math.max(x0 + 5, cs.w - 1.2), y0 = cs.h * 0.5, L = cs.h + (c.v.digital ? 5 : 8);
    const d = `M${f(x0)} ${f(y0)}L${f(x0)} ${f(L - 2)}Q${f(x0)} ${f(L)} ${f(x0 + 2)} ${f(L)}L${f(x1 - 2)} ${f(L)}Q${f(x1)} ${f(L)} ${f(x1)} ${f(L - 2)}L${f(x1)} ${f(y0)}Z`;
    const id = c.u('lu');
    c.defs.push(`<path id="${id}" d="${d}" fill="${c.url('lg')}" stroke="${c.pal[3]}" stroke-width=".5"/>`);
    return ['', ' transform="scale(-1 1)"', ' transform="scale(1 -1)"', ' transform="scale(-1 -1)"'].map((t) => `<use href="#${id}"${t}/>`).join('');
  }
  return '';
}

function pusher(c, a, r, w = 5.5, len = 6) {
  return `<g transform="${rot(a, r - 1.5)}"><rect x="${f(-w * 0.35)}" y="-3" width="${f(w * 0.7)}" height="4" fill="${c.url('lg')}"/><rect x="${f(-w / 2)}" y="${f(-len - 1)}" width="${f(w)}" height="${f(len - 1.5)}" rx="1.3" fill="${c.url('lg')}" stroke="${c.pal[3]}" stroke-width=".5"/></g>`;
}

function crownSVG(c) {
  const { v, G } = c, cs = G.cs;
  const cx = new Set(v.complications);
  const oled = v.digital && isOled(v);
  let s = '';
  if (v.digital && !oled) {
    for (const a of [55, 125, 235, 305]) s += pusher(c, a, edge(cs, a), 6, 5.5);
    return s;
  }
  const xr = edge(cs, 90);
  if (cx.has('chronograph') && !oled) for (const a of [58, 122]) s += pusher(c, a, edge(cs, a), 5.5, 6.5);
  let cr = '';
  const knurl = (x0, x1, h, step = 1.25) => { let d = ''; for (let y = -h / 2 + 1; y <= h / 2 - 0.9; y += step) d += `M${f(x0)} ${f(y)}H${f(x1)}`; return `<path d="${d}" stroke="#000" stroke-width=".45" opacity=".35"/>`; };
  const cp = c.pal[3];
  if (v.crown === 'crown-guard') {
    cr += `<path d="M${f(xr - 7)} -13Q${f(xr + 5.5)} -13 ${f(xr + 5.5)} -6.5L${f(xr + 5.5)} 6.5Q${f(xr + 5.5)} 13 ${f(xr - 7)} 13Z" fill="${c.url('lg')}" stroke="${cp}" stroke-width=".5"/>`;
    cr += `<rect x="${f(xr + 1)}" y="-5.2" width="7.6" height="10.4" rx="1.6" fill="${c.url('cr')}" stroke="${cp}" stroke-width=".5"/>` + knurl(xr + 5.5, xr + 8.4, 10.4);
  } else if (v.crown === 'onion') {
    cr += `<rect x="${f(xr - 2)}" y="-3.2" width="5" height="6.4" fill="${c.url('cr')}"/>`;
    cr += `<path d="M${f(xr + 2)} -5Q${f(xr + 5)} -9.5 ${f(xr + 8)} -7.5Q${f(xr + 11)} -6 ${f(xr + 11)} 0Q${f(xr + 11)} 6 ${f(xr + 8)} 7.5Q${f(xr + 5)} 9.5 ${f(xr + 2)} 5Z" fill="${c.url('cr')}" stroke="${cp}" stroke-width=".5"/>`;
    cr += `<path d="M${f(xr + 4.5)} -6.8Q${f(xr + 6)} 0 ${f(xr + 4.5)} 6.8M${f(xr + 7.6)} -7.4Q${f(xr + 9.2)} 0 ${f(xr + 7.6)} 7.4" stroke="#000" stroke-width=".5" fill="none" opacity=".4"/>` + knurl(xr + 2.5, xr + 10.5, 12, 1.6);
  } else if (oled) {
    const y = -G.R * 0.28;
    cr += `<rect x="${f(xr - 2)}" y="${f(y - 2.6)}" width="5" height="5.2" fill="${c.url('cr')}"/><rect x="${f(xr + 1.4)}" y="${f(y - 5.5)}" width="6.4" height="11" rx="2.4" fill="${c.url('cr')}" stroke="${cp}" stroke-width=".5"/>` + knurl(xr + 2.2, xr + 7.6, 11, 1);
    cr += `<rect x="${f(xr - 1.5)}" y="${f(G.R * 0.05)}" width="3.6" height="${f(G.R * 0.42)}" rx="1.4" fill="${c.url('cr')}" stroke="${cp}" stroke-width=".5"/>`;
  } else {
    cr += `<rect x="${f(xr - 2)}" y="-3" width="5" height="6" fill="${c.url('cr')}"/><rect x="${f(xr + 1.4)}" y="-6.2" width="6.6" height="12.4" rx="1.8" fill="${c.url('cr')}" stroke="${cp}" stroke-width=".5"/>` + knurl(xr + 2, xr + 7.4, 12.4);
    if (['rectangular', 'square'].includes(v.caseShape)) cr += `<ellipse cx="${f(xr + 8.6)}" rx="2" ry="4.4" fill="#1d3a8f" stroke="${cp}" stroke-width=".5"/><ellipse cx="${f(xr + 8.4)}" cy="-1.6" rx=".7" ry="1.3" fill="#fff" opacity=".55"/>`;
  }
  s += cr;
  return v.crown === 'left' ? `<g transform="scale(-1 1)">${s}</g>` : s;
}

const isOled = (v) => lum(v.dialColor) <= 0.2 && v.bezel !== 'digital';

/* ------------------------------------------------------------------ bezels */

function bezelSVG(c) {
  const { v, G } = c, { B, D } = G;
  let type = v.bezel;
  if (G.B.k === 'o' && type === 'none') type = 'smooth';
  const oe = (a) => edge(B, a), ie = (a) => edge(D, a);
  const bs = `#${c.u('bs')}`;
  let s = `<use href="${bs}" fill="${c.url('bz')}"/>`;
  const insertShape = inset(B, 1.8);
  const oi = (a) => edge(insertShape, a);
  const round = B.k === 'c' && B.w === B.h && D.k === 'c';
  const mid = (a) => (oi(a) + ie(a)) / 2;
  const band = Math.max(4, oi(0) - ie(0));

  let insId = null;
  const insert = (col) => {
    if (!insId) { insId = c.u('in'); c.defs.push(linGrad(insId, [[0, '#fff', 0.16], [0.45, '#fff', 0], [1, '#000', 0.28]])); }
    return iuse(c, 'bs', B, 1.8, ` fill="${col}"`) + iuse(c, 'bs', B, 1.8, ` fill="url(#${insId})"`);
  };
  const label = (a, txt, r, extra = '') => `<text transform="${rot(a, r)}"${extra}>${txt}</text>`;
  const textG = (col, fs, inner, extra = '') => `<g fill="${col}" font-family="Helvetica Neue,Arial,sans-serif" font-size="${f(fs)}" font-weight="600" text-anchor="middle" dominant-baseline="central"${extra}>${inner}</g>`;

  switch (type) {
    case 'fluted': {
      if (round) {
        const r = (oe(0) + ie(0)) / 2, w = oe(0) - ie(0);
        s += dashRing(r, w, 84, 0.9, '#fff', 0.55) + dashRing(r, w, 84, 0.9, '#000', 0.3, 0.5);
      } else {
        let d1 = '', d2 = '';
        for (let i = 0; i < 64; i++) { const a = i * 5.625; d1 += line(a, oe(a) - 0.4, ie(a)); d2 += line(a + 2.8, oe(a + 2.8) - 0.4, ie(a + 2.8)); }
        s += `<path d="${d1}" stroke="#fff" stroke-width=".9" opacity=".55"/><path d="${d2}" stroke="#000" stroke-width=".9" opacity=".3"/>`;
      }
      break;
    }
    case 'dive': {
      const col = v.bezelColor || '#121418', tc = ink(col);
      s += insert(col);
      let d = '';
      for (let m = 1; m < 60; m++) {
        const a = m * 6;
        if (m % 10 === 0) continue;
        if (m % 5 === 0) d += line(a, oi(a) - 1.2, ie(a) + 1.6);
        else if (m < 15) d += line(a, oi(a) - 1, oi(a) - band * 0.42);
      }
      s += `<path d="${d}" stroke="${tc}" stroke-width="${f2(band * 0.12)}" fill="none"/>`;
      let t = '';
      for (let m = 10; m < 60; m += 10) t += label(m * 6, String(m), mid(m * 6));
      s += textG(tc, band * 0.58, t);
      const r0 = oi(0) - 1, r1 = ie(0) + 1.2, tw = band * 0.42;
      s += `<path d="M${f(-tw)} ${f(-r0)}L${f(tw)} ${f(-r0)}L0 ${f(-r1)}Z" fill="${tc}"/>`;
      s += `<circle cy="${f(-(r0 * 0.62 + r1 * 0.38))}" r="${f(band * 0.13)}" fill="${v.lumeColor || '#e9e6d6'}" stroke="${c.pal[1]}" stroke-width=".4"/>`;
      break;
    }
    case 'gmt': {
      const c1 = v.bezelColor || '#1d2a52', c2 = v.bezelColor2 || c1;
      s += insert(c1);
      if (c2 !== c1) {
        const hid = c.nid();
        c.defs.push(`<clipPath id="${hid}"><rect x="-130" y="0" width="260" height="130"/></clipPath>`);
        s += `<g clip-path="url(#${hid})">${insert(c2)}</g>`;
      }
      let t1 = '', t2 = '', d1 = '', d2 = '';
      for (let h = 1; h < 24; h++) {
        const a = h * 15, lower = a > 90 && a < 270;
        if (h % 2) { const seg = line(a, oi(a) - 1.2, oi(a) - band * 0.45); if (lower) d2 += seg; else d1 += seg; }
        else { const tt = label(a, String(h), mid(a)); if (lower) t2 += tt; else t1 += tt; }
      }
      const k1 = ink(c1), k2 = ink(c2);
      s += `<path d="${d1}" stroke="${k1}" stroke-width="${f2(band * 0.12)}"/><path d="${d2}" stroke="${k2}" stroke-width="${f2(band * 0.12)}"/>`;
      s += textG(k1, band * 0.5, t1) + textG(k2, band * 0.5, t2);
      const r0 = oi(0) - 1, r1 = ie(0) + 1.2, tw = band * 0.4;
      s += `<path d="M${f(-tw)} ${f(-r0)}L${f(tw)} ${f(-r0)}L0 ${f(-r1)}Z" fill="${k1}"/>`;
      break;
    }
    case 'tachymeter': {
      const col = v.bezelColor;
      if (col) s += insert(col);
      const tc = col ? ink(col) : dk(c.bpal[3], 0.5);
      const nums = [500, 400, 300, 250, 200, 170, 150, 130, 110, 100, 90, 80, 70];
      let t = '', d = '';
      for (const n of nums) { const a = 21600 / n; t += label(a, String(n), mid(a) - band * 0.08); d += line(a, oi(a) - 0.5, oi(a) - band * 0.2); }
      for (let a = 60; a < 360; a += 6) if (!nums.some((n) => Math.abs(21600 / n - a) < 2.2)) d += line(a, oi(a) - 0.5, oi(a) - band * 0.12);
      s += `<path d="${d}" stroke="${tc}" stroke-width=".5"/>`;
      s += textG(tc, band * 0.42, t);
      s += textG(tc, band * 0.3, label(22, 'TACHYMETRE', mid(22)), ' letter-spacing=".25"');
      s += `<circle cy="${f(-mid(0))}" r="${f(band * 0.1)}" fill="${tc}"/>`;
      break;
    }
    case 'compass': {
      const col = v.bezelColor;
      if (col) s += insert(col);
      const tc = col ? ink(col) : dk(c.bpal[3], 0.5);
      let d = '';
      for (let a = 0; a < 360; a += 5) { if (a % 90 === 0) continue; d += line(a, oi(a) - 0.6, oi(a) - band * (a % 15 === 0 ? 0.4 : 0.22)); }
      s += `<path d="${d}" stroke="${tc}" stroke-width=".55"/>`;
      let t = '';
      [['N', 0], ['E', 90], ['S', 180], ['W', 270]].forEach(([l, a]) => { if (a) t += label(a, l, mid(a)); });
      s += textG(tc, band * 0.62, t) + textG(v.accentColor || '#c8372d', band * 0.62, label(0, 'N', mid(0)));
      for (const a of [45, 135, 225, 315]) s += `<circle transform="${rot(a, mid(a))}" r="${f(band * 0.1)}" fill="${tc}"/>`;
      break;
    }
    case 'slide-rule': {
      const col = v.bezelColor;
      const knurlW = 2.6;
      if (round) s += dashRing(oe(0) - knurlW / 2, knurlW, 120, 0.9, '#000', 0.35);
      const sr = inset(B, knurlW);
      if (col) { const gid = c.nid(); c.defs.push(linGrad(gid, [[0, '#fff', 0.14], [1, '#000', 0.25]])); s += iuse(c, 'bs', B, knurlW, ` fill="${col}"`) + iuse(c, 'bs', B, knurlW, ` fill="url(#${gid})"`); }
      const tc = col ? ink(col) : dk(c.bpal[3], 0.55);
      const o2 = (a) => edge(sr, a);
      s += logScale(c, (a) => o2(a) - 0.3, o2(0) - ie(0), tc, false);
      break;
    }
    case 'digital': {
      const col = v.bezelColor || (v.caseMetal === 'plastic' ? plasticColor(v) : null);
      if (col) s += insert(col);
      const tc = col ? mix(ink(col), col, 0.25) : dk(c.bpal[3], 0.5);
      const ac = v.accentColor || tc;
      const fs = band * 0.34;
      const put = (a, txt, col2, align = 'middle') => { const [x, y] = P(mid(a), a); return `<text x="${f(x)}" y="${f(y)}" fill="${col2}" text-anchor="${align}">${txt}</text>`; };
      let t = put(0, 'ILLUMINATOR', ac) + put(180, 'WATER RESIST', tc);
      if (B.k !== 'c') {
        const yt = -mid(0), yb = mid(180), xs = B.w * 0.7;
        const at = (x, y, txt) => `<text x="${f(x)}" y="${f(y)}" fill="${tc}" text-anchor="middle">${txt}</text>`;
        t += at(-xs, yt, 'LIGHT') + at(xs, yt, 'START') + at(-xs, yb, 'MODE') + at(xs, yb, 'RESET');
      }
      s += `<g font-family="Helvetica Neue,Arial,sans-serif" font-size="${f(fs)}" font-weight="700" letter-spacing=".3" dominant-baseline="central">${t}</g>`;
      break;
    }
    case 'octagon-screws': {
      const angs = B.k === 'o' ? [22.5, 67.5, 112.5, 157.5, 202.5, 247.5, 292.5, 337.5] : [0, 45, 90, 135, 180, 225, 270, 315];
      for (const a of angs) {
        const [x, y] = P(B.k === 'o' ? oe(a) - 5 : (oe(a) + ie(a)) / 2, a);
        s += `<g transform="translate(${f(x)} ${f(y)})"><circle r="2.5" fill="${c.url('lg')}" stroke="${c.bpal[3]}" stroke-width=".5"/><path d="M-1.2 -.7L0 -1.4L1.2 -.7L1.2 .7L0 1.4L-1.2 .7Z" fill="${c.bpal[3]}" opacity=".7" transform="rotate(${f(a * 1.7)})"/></g>`;
      }
      break;
    }
    default: break;
  }
  // polish edges
  s += `<use href="${bs}" fill="none" stroke="${c.bpal[3]}" stroke-width=".6"/>`;
  s += `<use href="${bs}" fill="none" stroke="#fff" stroke-width=".6" opacity=".35" transform="scale(${f2(1 - 0.8 / B.w)})"/>`;
  if (B.k === 'o') s += `<use href="${bs}" fill="none" stroke="#000" stroke-width=".4" opacity=".25" transform="scale(${f2(1 - 3 / B.w)})"/>`;
  return s;
}

/** Logarithmic slide-rule scale ring (Navitimer style). */
function logScale(c, rf, band, col, inner) {
  const nums = [10, 12, 15, 20, 25, 30, 35, 40, 45, 50, 60, 70, 80, 90];
  const ang = (n) => (360 * Math.log10(n / 10)) % 360;
  let d = '';
  for (let n = 10; n < 100; n += n < 20 ? 0.5 : n < 50 ? 1 : 2) {
    const a = ang(n), major = nums.includes(n);
    d += inner ? line(a, rf(a), rf(a) - band * (major ? 0.32 : 0.18)) : line(a, rf(a), rf(a) - band * (major ? 0.3 : 0.17));
  }
  let t = '';
  for (const n of nums) {
    const a = ang(n), r = inner ? rf(a) - band * 0.62 : rf(a) - band * 0.62;
    t += `<text transform="${rot(a, r)}"${n === 10 ? ` fill="${c.v.accentColor || '#c8372d'}"` : ''}>${n}</text>`;
  }
  return `<path d="${d}" stroke="${col}" stroke-width=".35"/><g fill="${col}" font-family="Helvetica Neue,Arial,sans-serif" font-size="${f(band * 0.36)}" font-weight="600" text-anchor="middle" dominant-baseline="central">${t}</g>`;
}

/* ------------------------------------------------------------------ dial */

function dialSVG(c) {
  const { v, G } = c, { D, R } = G;
  const dc = c.url('dc');
  const dcol = v.dialColor, dl = lum(dcol);
  let s = `<g clip-path="${dc}"><rect x="-100" y="-100" width="200" height="200" fill="${dcol}"/>`;
  if (v.digital) {
    s += '</g>' + digitalFace(c);
    return s;
  }
  s += textureSVG(c);
  // general dial light and vignette
  const lid = c.u('dl'), vid = c.u('vg');
  c.defs.push(
    linGrad(lid, [[0, '#fff', dl > 0.5 ? 0.18 : 0.1], [0.5, '#fff', 0], [1, '#000', dl > 0.5 ? 0.08 : 0.18]]),
    `<radialGradient id="${vid}" r="${f(R * 1.08)}" cx="0" cy="0" gradientUnits="userSpaceOnUse">${stops([[0, '#000', 0], [0.68, '#000', 0.04], [1, '#000', dl > 0.5 ? 0.2 : 0.38]])}</radialGradient>`,
  );
  s += `<rect x="-100" y="-100" width="200" height="200" fill="url(#${lid})"/>`;
  s += `<rect x="-100" y="-100" width="200" height="200" fill="url(#${vid})"/>`;

  // reserved outer rings
  let ringInset = 0;
  const cx = new Set(v.complications);
  if (cx.has('world-time')) { s += worldTime(c); ringInset = R * 0.27; }
  else if (v.bezel === 'slide-rule') {
    const bandW = R * 0.13;
    const rcol = dl > 0.5 ? dk(dcol, 0.06) : lt(dcol, 0.1);
    s += `<use href="#${c.u('ds')}" fill="none" stroke="${rcol}" stroke-width="${f(bandW * 2)}"/>` + iuse(c, 'ds', D, bandW, ` fill="none" stroke="${v.indexColor}" stroke-width=".4" opacity=".6"`);
    s += logScale(c, (a) => edge(D, a) - 0.5, bandW, v.indexColor, true);
    ringInset = bandW + 1;
  }
  // flange shadow
  s += `<use href="#${c.u('ds')}" fill="none" stroke="#000" stroke-width="3.2" opacity=".38"/><use href="#${c.u('ds')}" fill="none" stroke="#000" stroke-width="1.2" opacity=".5"/>`;
  s += '</g>';

  const Rin = R - ringInset;
  const re = (a) => edge(D, a) - ringInset;
  const pl = plan(v, c, Rin);
  s += indicesSVG(c, re, pl, R, Rin);
  s += pl.svg;
  s += handsSVG(c, Rin, R, pl);
  return s;
}

function textureSVG(c) {
  const { v, G } = c, R = G.R, dcol = v.dialColor, dl = lum(dcol);
  const light = dl > 0.5;
  let s = '';
  switch (v.dialTexture) {
    case 'sunburst': {
      s += dashRing(R * 0.56, R * 1.12, 150, 0.32, '#fff', light ? 0.12 : 0.07) + dashRing(R * 0.56, R * 1.12, 150, 0.32, '#000', light ? 0.05 : 0.1, 0.5);
      const gid = c.u('sb'), did = c.u('sd');
      c.defs.push(
        `<radialGradient id="${gid}" r="${f(R * 1.1)}" cx="0" cy="0" gradientUnits="userSpaceOnUse">${stops([[0, '#fff', 0.05], [0.5, '#fff', light ? 0.35 : 0.3], [1, '#fff', 0.12]])}</radialGradient>`,
        `<radialGradient id="${did}" r="${f(R * 1.1)}" cx="0" cy="0" gradientUnits="userSpaceOnUse">${stops([[0, '#000', 0], [0.6, '#000', light ? 0.12 : 0.28], [1, '#000', 0.2]])}</radialGradient>`,
      );
      const wedge = (a, h) => { const r = R * 1.5, [x1, y1] = P(r, a - h), [x2, y2] = P(r, a + h), [x3, y3] = P(r, a + 180 - h), [x4, y4] = P(r, a + 180 + h); return `M0 0L${f(x1)} ${f(y1)}L${f(x2)} ${f(y2)}ZM0 0L${f(x3)} ${f(y3)}L${f(x4)} ${f(y4)}Z`; };
      s += `<path d="${wedge(315, 30)}" fill="url(#${gid})" opacity=".45"/><path d="${wedge(315, 13)}" fill="url(#${gid})" opacity=".7"/>`;
      s += `<path d="${wedge(45, 34)}" fill="url(#${did})" opacity=".6"/><path d="${wedge(45, 16)}" fill="url(#${did})" opacity=".6"/>`;
      break;
    }
    case 'guilloche': {
      const col = light ? dk(dcol, 0.22) : lt(dcol, 0.28);
      let d = '';
      const n = 40, rc = R * 0.58, dist = R * 0.42;
      for (let i = 0; i < n; i++) { const [x, y] = P(dist, (i * 360) / n); d += `M${f(x + rc)} ${f(y)}a${f(rc)} ${f(rc)} 0 1 0 ${f(-2 * rc)} 0a${f(rc)} ${f(rc)} 0 1 0 ${f(2 * rc)} 0`; }
      s += `<path d="${d}" fill="none" stroke="${col}" stroke-width=".32" opacity=".55"/>`;
      break;
    }
    case 'tapisserie': {
      const t = Math.max(2.6, R * 0.068), pid = c.u('tp');
      c.defs.push(`<pattern id="${pid}" width="${f2(t)}" height="${f2(t)}" patternUnits="userSpaceOnUse" x="${f2(t / 2)}" y="${f2(t / 2)}"><rect width="${f2(t)}" height="${f2(t)}" fill="${dk(dcol, 0.4)}"/><rect x=".35" y=".35" width="${f2(t - 0.9)}" height="${f2(t - 0.9)}" fill="${dcol}"/><path d="M.35 .6H${f2(t - 0.55)}M.6 .35V${f2(t - 0.55)}" stroke="${lt(dcol, 0.35)}" stroke-width=".45"/></pattern>`);
      s += `<rect x="-100" y="-100" width="200" height="200" fill="url(#${pid})"/>`;
      break;
    }
    case 'linen': {
      const pid = c.u('ln');
      c.defs.push(`<pattern id="${pid}" width="1.6" height="1.6" patternUnits="userSpaceOnUse"><rect width="1.6" height=".6" fill="#fff" opacity="${light ? 0.35 : 0.07}"/><rect width=".6" height="1.6" fill="#000" opacity="${light ? 0.07 : 0.14}"/></pattern>`);
      s += `<rect x="-100" y="-100" width="200" height="200" fill="url(#${pid})"/>`;
      break;
    }
    case 'enamel': {
      const gid = c.u('en');
      c.defs.push(`<radialGradient id="${gid}" cx="${f(-R * 0.35)}" cy="${f(-R * 0.4)}" r="${f(R * 1.2)}" gradientUnits="userSpaceOnUse">${stops([[0, '#fff', 0.5], [0.35, '#fff', 0.12], [0.75, '#fff', 0], [1, '#000', 0.12]])}</radialGradient>`);
      s += `<rect x="-100" y="-100" width="200" height="200" fill="url(#${gid})"/>`;
      s += `<ellipse cx="${f(-R * 0.38)}" cy="${f(-R * 0.52)}" rx="${f(R * 0.22)}" ry="${f(R * 0.08)}" transform="rotate(-38 ${f(-R * 0.38)} ${f(-R * 0.52)})" fill="#fff" opacity=".35"/>`;
      break;
    }
    case 'meteorite': {
      const r = rng(hashStr(dcol + 'met'));
      let dl1 = '', dd = '';
      for (const base of [18, 78, 138]) {
        let off = -R * 1.2;
        while (off < R * 1.2) {
          const w = 0.6 + r() * 3.2;
          const rect = `<rect x="${f(-R * 1.3)}" y="${f(off)}" width="${f(R * 2.6)}" height="${f(w)}" transform="rotate(${f(base + (r() - 0.5) * 6)})"/>`;
          if (r() > 0.5) dl1 += rect; else dd += rect;
          off += w + 2 + r() * 7;
        }
      }
      s += `<g fill="#fff" opacity="${light ? 0.22 : 0.13}">${dl1}</g><g fill="#000" opacity="${light ? 0.12 : 0.22}">${dd}</g>`;
      break;
    }
    case 'textured': {
      const fid = c.u('tx');
      c.defs.push(`<filter id="${fid}" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".16 .24" numOctaves="2" seed="${hashStr(dcol) % 97}" result="a"/><feColorMatrix in="a" type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 ${light ? 1.4 : 0.8} -.5"/></filter>`
        + `<filter id="${fid}g" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="1" seed="3"/><feColorMatrix type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -1.1 .62"/></filter>`);
      s += `<rect x="${f(-R)}" y="${f(-R)}" width="${f(2 * R)}" height="${f(2 * R)}" filter="url(#${fid})"/>`;
      s += `<rect x="${f(-R)}" y="${f(-R)}" width="${f(2 * R)}" height="${f(2 * R)}" filter="url(#${fid}g)" opacity="${light ? 0.35 : 0.5}"/>`;
      break;
    }
    case 'skeleton': s += skeletonSVG(c); break;
    default: break; // matte
  }
  return s;
}

/* ------------------------------------------------------------------ movement bits */

function movePal(c) {
  const warm = ['yellow-gold', 'rose-gold', 'bronze'].includes(c.v.caseMetal);
  return warm ? METAL['yellow-gold'] : METAL.steel;
}

function gear(x, y, r, col, dark, teeth = true) {
  let s = `<g transform="translate(${f(x)} ${f(y)})">`;
  if (teeth) s += dashRing(r + 0.5, 1.6, Math.max(12, Math.round(r * 2.2)), 0.9, col);
  s += `<circle r="${f(r)}" fill="none" stroke="${col}" stroke-width="${f(Math.max(1, r * 0.14))}"/>`;
  let d = '';
  for (let k = 0; k < 5; k++) d += line(k * 72 + 10, r * 0.2, r);
  s += `<path d="${d}" stroke="${col}" stroke-width="${f(Math.max(0.7, r * 0.1))}"/><circle r="${f(Math.max(1.2, r * 0.22))}" fill="${col}" stroke="${dark}" stroke-width=".4"/><circle r=".7" fill="#b3122e"/></g>`;
  return s;
}

function balance(x, y, r, col, dark) {
  let sp = '';
  for (let k = 0; k < 4; k++) { const rr = r * (0.22 + k * 0.12); sp += `M${f(rr)} 0A${f(rr)} ${f(rr)} 0 1 1 ${f(-rr)} 0A${f(rr * 0.95)} ${f(rr * 0.95)} 0 1 1 ${f(rr * 0.9)} 0`; }
  return `<g transform="translate(${f(x)} ${f(y)})"><circle r="${f(r)}" fill="none" stroke="${col}" stroke-width="${f(r * 0.16)}"/>${dashRing(r, r * 0.16, 16, 0.5, dark, 0.6)}<path d="${line(20, 0, r)}${line(140, 0, r)}${line(260, 0, r)}" stroke="${col}" stroke-width="${f(r * 0.09)}"/><path d="${sp}" fill="none" stroke="#d9dde2" stroke-width=".35" opacity=".85"/><circle r="${f(r * 0.14)}" fill="#b3122e" stroke="${col}" stroke-width=".5"/></g>`;
}

function skeletonSVG(c) {
  const { v, G } = c, R = G.R;
  const mp = movePal(c), col = mp[1], dark = mp[3];
  const base = mix(v.dialColor, '#0c0d10', 0.55);
  const bid = c.nid();
  c.defs.push(linGrad(bid, metalStops(mp)));
  let s = `<rect x="-100" y="-100" width="200" height="200" fill="${base}"/>`;
  s += `<circle r="${f(R * 0.95)}" fill="none" stroke="${lt(base, 0.08)}" stroke-width="${f(R * 0.03)}" stroke-dasharray="1 2"/>`;
  s += gear(-R * 0.32, -R * 0.3, R * 0.3, col, dark) + gear(R * 0.02, R * 0.02, R * 0.22, col, dark) + gear(R * 0.36, R * 0.22, R * 0.16, col, dark) + gear(R * 0.1, R * 0.5, R * 0.12, col, dark);
  s += balance(-R * 0.36, R * 0.38, R * 0.22, mp[1], dark);
  const br = (d, w) => `<path d="${d}" fill="none" stroke="${dark}" stroke-width="${f(w + 1)}" stroke-linecap="round"/><path d="${d}" fill="none" stroke="url(#${bid})" stroke-width="${f(w)}" stroke-linecap="round"/>`;
  s += br(`M${f(-R * 0.85)} ${f(-R * 0.1)}Q${f(-R * 0.3)} ${f(R * 0.1)} ${f(R * 0.2)} ${f(-R * 0.35)}T${f(R * 0.8)} ${f(-R * 0.45)}`, R * 0.09);
  s += br(`M${f(R * 0.75)} ${f(R * 0.45)}Q${f(R * 0.3)} ${f(R * 0.2)} ${f(R * 0.05)} ${f(R * 0.75)}`, R * 0.08);
  s += br(`M${f(-R * 0.72)} ${f(R * 0.55)}L${f(-R * 0.36)} ${f(R * 0.38)}`, R * 0.06);
  for (const [x, y] of [[-0.66, -0.13], [0.62, -0.46], [0.6, 0.38], [0.18, 0.54]]) s += `<circle cx="${f(x * R)}" cy="${f(y * R)}" r="${f(R * 0.03)}" fill="#2a4fa8" stroke="${dark}" stroke-width=".3"/>`;
  for (const [x, y] of [[-0.05, -0.28], [0.44, -0.41], [0.3, 0.34]]) s += `<circle cx="${f(x * R)}" cy="${f(y * R)}" r="${f(R * 0.025)}" fill="#c2183a"/>`;
  // chapter ring
  s += `<use href="#${c.u('ds')}" fill="none" stroke="${v.dialColor}" stroke-width="${f(R * 0.3)}"/>` + iuse(c, 'ds', G.D, R * 0.15, ` fill="none" stroke="${mp[2]}" stroke-width=".7"`);
  return s;
}

/* ------------------------------------------------------------------ world time */

const CITIES = ['LONDON', 'PARIS', 'CAIRO', 'MOSCOW', 'DUBAI', 'KARACHI', 'DHAKA', 'BANGKOK', 'BEIJING', 'TOKYO', 'SYDNEY', 'NOUMEA', 'FIJI', 'SAMOA', 'HAWAII', 'ALASKA', 'L.A.', 'DENVER', 'MEXICO', 'N.YORK', 'CARACAS', 'RIO', 'NORONHA', 'AZORES'];

function worldTime(c) {
  const { v, G } = c, { D, R } = G;
  const band = R * 0.13;
  const e = (a) => edge(D, a);
  const dl = lum(v.dialColor), tc = v.indexColor;
  let s = '';
  const ringCol = dl > 0.5 ? dk(v.dialColor, 0.05) : lt(v.dialColor, 0.06);
  s += `<use href="#${c.u('ds')}" fill="none" stroke="${ringCol}" stroke-width="${f(band * 2)}"/>`;
  let t = '';
  CITIES.forEach((n, i) => { const a = i * 15; t += `<text transform="${rot(a, e(a) - band * 0.52)}">${n}</text>`; });
  s += `<g fill="${tc}" font-family="Helvetica Neue,Arial,sans-serif" font-size="${f(band * 0.3)}" font-weight="600" text-anchor="middle" dominant-baseline="central">${t}</g>`;
  // 24h day / night ring
  const rMid = (a) => edge(D, a) - band * 1.52;
  const hid = c.nid(), nid = c.nid();
  c.defs.push(`<clipPath id="${hid}"><rect x="-100" y="0" width="200" height="100"/></clipPath>`);
  const r1 = (attrs) => iuse(c, 'ds', D, band, attrs);
  c.defs.push(`<clipPath id="${nid}">${r1('')}</clipPath>`);
  const night = dl > 0.5 ? '#1b2440' : mix(v.dialColor, '#000', 0.5);
  s += `<g clip-path="url(#${nid})">${r1(` fill="${night}"`)}<g clip-path="url(#${hid})">${r1(' fill="#e7dfc6"')}</g></g>`;
  s += iuse(c, 'ds', D, band * 2.05, ` fill="${v.dialColor}" stroke="${tc}" stroke-width=".4"`);
  let t1 = '', t2 = '', d = '';
  for (let h = 1; h <= 24; h++) {
    const a = (h % 24) * 15;
    if (h % 2 === 0) { const tt = `<text transform="${rot(a, rMid(a))}">${h}</text>`; if (a > 90 && a < 270) t2 += tt; else t1 += tt; }
    else d += line(a, rMid(a) + band * 0.25, rMid(a) - band * 0.25);
  }
  s += `<path d="${d}" stroke="#888" stroke-width=".5"/>`;
  const g = (col, inner) => `<g fill="${col}" font-family="Helvetica Neue,Arial,sans-serif" font-size="${f(band * 0.36)}" font-weight="600" text-anchor="middle" dominant-baseline="central">${inner}</g>`;
  s += g('#e7dfc6', t1) + g('#1b2440', t2);
  s += r1(` fill="none" stroke="${tc}" stroke-width=".4" opacity=".7"`);
  return s;
}

/* ------------------------------------------------------------------ complications */

function plan(v, c, Rin) {
  const cx = new Set(v.complications);
  const { D } = c.G;
  const slots = {};
  const take = (name, prefs) => { for (const p of prefs) if (!slots[p]) { slots[p] = name; return p; } return null; };
  const hasChrono = cx.has('chronograph');
  const hasDate = cx.has('date') || cx.has('day-date');
  if (cx.has('day-date')) take('day', ['top']);
  if (cx.has('jumping-hour')) take('jump', ['top', 'bottom']);
  if (cx.has('big-date')) take('bigdate', ['top', 'bottom']);
  if (cx.has('tourbillon')) take('tourb', ['bottom', 'top', 'left', 'right']);
  if (cx.has('perpetual-calendar')) { take('pday', ['left']); take('pmonth', ['right']); take('pdate', ['bottom', 'top']); }
  if (hasChrono) {
    take('csec', ['left', 'right', 'bottom', 'top']);
    take('cmin', hasDate ? ['top', 'right', 'bottom'] : ['right', 'top', 'bottom']);
    take('chr', ['bottom', 'top', 'right']);
  }
  let dateAt = null;
  if (hasDate && !cx.has('big-date')) dateAt = take('date', ['right', 'bottom']);
  if (cx.has('moonphase')) take('moon', ['bottom', 'top', 'left', 'right']);
  if (cx.has('small-seconds') && !hasChrono) take('ssec', ['bottom', 'left', 'right', 'top']);
  if (cx.has('power-reserve')) take('pr', ['top', 'left', 'right', 'bottom']);
  if (cx.has('open-heart')) take('heart', ['left', 'bottom', 'top', 'right']);
  if (cx.has('retrograde')) take('retro', ['top', 'bottom', 'left', 'right']);
  if (cx.has('digital')) take('lcd', ['bottom', 'top']);

  const k = 0.45 * (Rin / c.G.R);
  const pos = { top: [0, -D.h * k], bottom: [0, D.h * k], left: [-D.w * k, 0], right: [D.w * k, 0] };
  if (Math.abs(D.w - D.h) > 4) { pos.left[0] = -Math.min(D.w * k, Rin * 0.46); pos.right[0] = -pos.left[0]; }
  const hourOf = { top: 12, right: 3, bottom: 6, left: 9 };
  const hide = new Set(), hideNum = new Set();
  const rs = Rin * 0.22;
  let svg = '';
  const hc = v.handColor, ac = v.accentColor;
  for (const [slot, name] of Object.entries(slots)) {
    const [x, y] = pos[slot];
    hideNum.add(hourOf[slot]);
    const baseA = { top: 0, right: 90, bottom: 180, left: 270 }[slot];
    switch (name) {
      case 'day': svg += windowSVG(c, 0, -Rin * 0.56, Rin * 0.44, Rin * 0.15, ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'][new Date().getDay()], Rin * 0.1); break;
      case 'date': {
        hide.add(hourOf[slot]);
        const e = slot === 'right' ? edge(D, 90) : edge(D, 180);
        const r = (e - (c.G.R - Rin)) * 0.72;
        svg += slot === 'right' ? windowSVG(c, r, 0, Rin * 0.19, Rin * 0.15, String(new Date().getDate()), Rin * 0.105) : windowSVG(c, 0, r, Rin * 0.19, Rin * 0.15, String(new Date().getDate()), Rin * 0.105);
        break;
      }
      case 'jump': svg += windowSVG(c, x, y, Rin * 0.3, Rin * 0.2, '10', Rin * 0.15, 'jh'); break;
      case 'bigdate': {
        const dd = String(new Date().getDate()).padStart(2, '0'), w = Rin * 0.17;
        svg += `<rect x="${f(x - w - 1.2)}" y="${f(y - w * 0.62 - 1.2)}" width="${f(2 * w + 2.4)}" height="${f(w * 1.24 + 2.4)}" rx=".8" fill="${c.url('lg')}"/>`;
        svg += windowSVG(c, x - w / 2 - 0.3, y, w, w * 1.2, dd[0], w * 0.95, null, true) + windowSVG(c, x + w / 2 + 0.3, y, w, w * 1.2, dd[1], w * 0.95, null, true);
        break;
      }
      case 'csec': svg += subdial(c, x, y, rs, { n: 60, major: 12, a: 216, ww: 'ss' }); break;
      case 'cmin': svg += subdial(c, x, y, rs, { n: 30, major: 6, a: 0, labels: [['30', 0], ['10', 120], ['20', 240]], hc: ac }); break;
      case 'chr': svg += subdial(c, x, y, rs, { n: 12, major: 4, a: 0, labels: [['12', 0], ['6', 180]], hc: ac }); break;
      case 'ssec': svg += subdial(c, x, y, rs, { n: 60, major: 12, a: 216, ww: 'ss', labels: rs > 9 ? [['60', 0], ['20', 120], ['40', 240]] : null }); break;
      case 'pday': svg += subdial(c, x, y, rs, { n: 7, major: 7, a: 4 * 51.4, labels: 'MTWTFSS'.split('').map((l, i) => [l, i * 51.43]), lr: 0.6 }); break;
      case 'pmonth': svg += subdial(c, x, y, rs, { n: 48, major: 12, a: 8 * 30 + 15, labels: [['I', 0], ['IV', 90], ['VII', 180], ['X', 270]], lr: 0.58 }); break;
      case 'pdate': svg += subdial(c, x, y, rs, { n: 31, major: 31, a: (new Date().getDate() - 1) * (360 / 31), labels: [['10', 9 * 11.6], ['20', 19 * 11.6], ['31', 30 * 11.6]], lr: 0.58, ticks2: true }); break;
      case 'moon': svg += moonSVG(c, x, y, rs * 1.15); break;
      case 'tourb': svg += tourbillonSVG(c, x, y, rs * 1.2); break;
      case 'heart': svg += heartSVG(c, x, y, rs * 0.95); break;
      case 'pr': svg += fanSVG(c, x, y, baseA, rs * 1.5, 48, 10, 0.72, ['E', 'F']); break;
      case 'retro': svg += fanSVG(c, x, y, baseA, rs * 1.9, 60, 31, 0.8, ['1', '31'], true); break;
      case 'lcd': svg += lcdWindow(c, x, y, rs * 2.7, rs * 1.15); break;
      default: break;
    }
  }
  return { svg, hide, hideNum, slots, chrono: hasChrono, jump: slots.top === 'jump' || slots.bottom === 'jump' };
}

function windowSVG(c, x, y, w, h, txt, fs, ww, big) {
  const dl = lum(c.v.dialColor);
  const bg = big || dl < 0.6 ? '#f5f3ee' : '#ffffff';
  return `<g transform="translate(${f(x)} ${f(y)})"><rect x="${f(-w / 2 - 0.9)}" y="${f(-h / 2 - 0.9)}" width="${f(w + 1.8)}" height="${f(h + 1.8)}" rx=".7" fill="${c.url('lg')}"/><rect x="${f(-w / 2)}" y="${f(-h / 2)}" width="${f(w)}" height="${f(h)}" rx=".4" fill="${bg}"/><rect x="${f(-w / 2)}" y="${f(-h / 2)}" width="${f(w)}" height="${f(h * 0.3)}" fill="#000" opacity=".12"/><text y=".3" font-family="Helvetica Neue,Arial,sans-serif" font-size="${f(fs)}" font-weight="700" fill="#15171b" text-anchor="middle" dominant-baseline="central"${ww && c.live ? ` data-ww="${ww}"` : ''}>${txt}</text></g>`;
}

function subdial(c, x, y, r, o) {
  const { v } = c, ic = v.indexColor, dl = lum(v.dialColor);
  const sf = dl > 0.5 ? dk(v.dialColor, 0.07) : lt(v.dialColor, 0.06);
  let s = `<g transform="translate(${f(x)} ${f(y)})"><circle r="${f(r)}" fill="${sf}"/>`;
  let az = '';
  for (let k = 1; k < 5; k++) az += `<circle r="${f(r * k * 0.2)}"/>`;
  s += `<g fill="none" stroke="${ic}" stroke-width=".3" opacity=".14">${az}</g>`;
  s += dashRing(r - 1.1, 1.6, o.n, 0.28, ic, 0.85);
  if (o.major && o.major !== o.n) s += dashRing(r - 1.6, 2.6, o.major, 0.55, ic);
  else if (o.ticks2) s += '';
  if (o.labels) {
    const lr = r * (o.lr || 0.55);
    s += `<g fill="${ic}" font-family="Helvetica Neue,Arial,sans-serif" font-size="${f(r * 0.3)}" font-weight="600" text-anchor="middle" dominant-baseline="central">${o.labels.map(([t, a]) => { const [tx, ty] = P(lr, a); return `<text x="${f(tx)}" y="${f(ty)}">${t}</text>`; }).join('')}</g>`;
  }
  s += `<circle r="${f(r)}" fill="none" stroke="#000" stroke-width=".8" opacity=".3"/><circle r="${f(r + 0.4)}" fill="none" stroke="${ic}" stroke-width=".35" opacity=".45"/>`;
  const hc = o.hc || v.handColor;
  s += `<g transform="rotate(${f(o.a || 0)})"${o.ww && c.live ? ` class="ww-subsecond" data-ww="${o.ww}"` : ''}><path d="M-.6 ${f(r * 0.25)}L-.32 ${f(-(r - 1.2))}L.32 ${f(-(r - 1.2))}L.6 ${f(r * 0.25)}Z" fill="${hc}"/></g><circle r="1.25" fill="${hc}"/><circle r=".45" fill="#000" opacity=".5"/></g>`;
  return s;
}

function moonSVG(c, x, y, r) {
  const { v } = c, id = c.nid(), mg = c.nid();
  const dcol = v.dialColor;
  c.defs.push(`<clipPath id="${id}"><path d="M${f(-r)} 0A${f(r)} ${f(r)} 0 0 1 ${f(r)} 0Z"/></clipPath>`, `<radialGradient id="${mg}" cx=".35" cy=".35" r=".75">${stops([[0, '#fff3c4'], [0.6, '#e2b653'], [1, '#a47a26']])}</radialGradient>`);
  const oy = r * 0.32;
  let stars = '';
  const rr = rng(7);
  for (let i = 0; i < 9; i++) stars += `<circle cx="${f((rr() * 2 - 1) * r * 0.85)}" cy="${f(-rr() * r * 0.85)}" r="${f(0.25 + rr() * 0.35)}"/>`;
  return `<g transform="translate(${f(x)} ${f(y + oy)})"><g clip-path="url(#${id})"><rect x="${f(-r)}" y="${f(-r)}" width="${f(2 * r)}" height="${f(r)}" fill="#13204a"/><g fill="#f4e6b0">${stars}</g><circle cx="${f(-r * 0.06)}" cy="${f(-r * 0.56)}" r="${f(r * 0.3)}" fill="url(#${mg})"/><circle cx="${f(-r * 0.5)}" cy="${f(r * 0.06)}" r="${f(r * 0.5)}" fill="${dcol}"/><circle cx="${f(r * 0.5)}" cy="${f(r * 0.06)}" r="${f(r * 0.5)}" fill="${dcol}"/></g><path d="M${f(-r)} 0A${f(r)} ${f(r)} 0 0 1 ${f(r)} 0" fill="none" stroke="${c.url('lg')}" stroke-width="1.1"/><path d="M${f(-r)} 0H${f(r)}" stroke="${v.indexColor}" stroke-width=".4" opacity=".6"/></g>`;
}

function tourbillonSVG(c, x, y, r) {
  const mp = movePal(c);
  let s = `<g transform="translate(${f(x)} ${f(y)})"><circle r="${f(r)}" fill="#0b0c10"/>`;
  s += `<circle r="${f(r * 0.86)}" fill="none" stroke="${mp[2]}" stroke-width=".6" opacity=".6"/>`;
  s += balance(0, 0, r * 0.6, mp[1], mp[3]).replace('translate(0 0)', 'rotate(12)');
  let d = '';
  for (let k = 0; k < 3; k++) { const a = k * 120 + 25; const [x1, y1] = P(r * 0.85, a); const [x2, y2] = P(r * 0.85, a + 40); d += `M0 0L${f(x1)} ${f(y1)}A${f(r * 0.85)} ${f(r * 0.85)} 0 0 1 ${f(x2)} ${f(y2)}Z`; }
  s += `<path d="${d}" fill="none" stroke="${mp[0]}" stroke-width="${f(r * 0.08)}" stroke-linejoin="round" opacity=".92"/>`;
  s += `<circle r="${f(r * 0.16)}" fill="${mp[1]}"/><circle r="${f(r * 0.07)}" fill="#c2183a"/>`;
  s += `<circle r="${f(r)}" fill="none" stroke="${c.url('lg')}" stroke-width="1.6"/><circle r="${f(r - 0.8)}" fill="none" stroke="#000" stroke-width=".8" opacity=".5"/></g>`;
  return s;
}

function heartSVG(c, x, y, r) {
  const mp = movePal(c);
  return `<g transform="translate(${f(x)} ${f(y)})"><circle r="${f(r)}" fill="#0b0c10"/>${balance(r * 0.05, r * 0.05, r * 0.66, mp[1], mp[3])}<path d="M${f(-r)} ${f(r * 0.5)}Q0 ${f(r * 0.1)} ${f(r)} ${f(-r * 0.6)}" stroke="${mp[2]}" stroke-width="${f(r * 0.18)}" fill="none" opacity=".9"/><circle r="${f(r)}" fill="none" stroke="${c.url('lg')}" stroke-width="1.4"/><circle r="${f(r - 0.7)}" fill="none" stroke="#000" stroke-width=".7" opacity=".5"/></g>`;
}

/** Fan-shaped scale (power reserve or retrograde) pointing away from the dial centre. */
function fanSVG(c, x, y, baseA, r, span, n, pos, labels, big) {
  const { v } = c, ic = v.indexColor;
  const [px, py] = P(r * (big ? 0.55 : 0.45), baseA + 180);
  const cxp = x + px, cyp = y + py;
  let d = '';
  for (let i = 0; i <= n; i++) { const a = baseA - span + (2 * span * i) / n; d += line(a, r, r - (i % (big ? 5 : 5) === 0 || i === n ? 2.4 : 1.3)); }
  const [ax1, ay1] = P(r, baseA - span), [ax2, ay2] = P(r, baseA + span);
  let s = `<g transform="translate(${f(cxp)} ${f(cyp)})"><path d="M${f(ax1)} ${f(ay1)}A${f(r)} ${f(r)} 0 0 1 ${f(ax2)} ${f(ay2)}" fill="none" stroke="${ic}" stroke-width=".45"/><path d="${d}" stroke="${ic}" stroke-width=".5"/>`;
  if (!big) { const [lx, ly] = P(r, baseA - span); const [lx2, ly2] = P(r, baseA - span + 18); s += `<path d="M${f(lx)} ${f(ly)}A${f(r)} ${f(r)} 0 0 1 ${f(lx2)} ${f(ly2)}" fill="none" stroke="${v.accentColor || '#c8372d'}" stroke-width="1.2"/>`; }
  const fs = Math.max(2.4, r * (big ? 0.16 : 0.24));
  const [t1x, t1y] = P(r - fs * 1.3, baseA - span + 4), [t2x, t2y] = P(r - fs * 1.3, baseA + span - 4);
  s += `<g fill="${ic}" font-family="Helvetica Neue,Arial,sans-serif" font-size="${f(fs)}" font-weight="600" text-anchor="middle" dominant-baseline="central"><text x="${f(t1x)}" y="${f(t1y)}">${labels[0]}</text><text x="${f(t2x)}" y="${f(t2y)}">${labels[1]}</text></g>`;
  const ha = baseA - span + 2 * span * pos;
  s += `<g transform="rotate(${f(ha)})"><path d="M-.7 2L-.3 ${f(-(r - 1))}L.3 ${f(-(r - 1))}L.7 2Z" fill="${v.accentColor || v.handColor}"/></g><circle r="1.5" fill="${v.handColor}"/></g>`;
  return s;
}

function lcdWindow(c, x, y, w, h) {
  const col = '#b9c0ad';
  let s = `<g transform="translate(${f(x)} ${f(y)})"><rect x="${f(-w / 2 - 1)}" y="${f(-h / 2 - 1)}" width="${f(w + 2)}" height="${f(h + 2)}" rx="1.2" fill="${c.url('lg')}"/><rect x="${f(-w / 2)}" y="${f(-h / 2)}" width="${f(w)}" height="${f(h)}" rx=".8" fill="${col}"/>`;
  s += segDisplay(c, 0, 0, w * 0.88, h * 0.7, '#1e231c', 0.08, false);
  return s + '</g>';
}

/* ------------------------------------------------------------------ seven segment */

const SEGS = { a: [[0, 0], [1, 0]], b: [[1, 0], [1, 0.5]], c: [[1, 0.5], [1, 1]], d: [[0, 1], [1, 1]], e: [[0, 0.5], [0, 1]], f: [[0, 0], [0, 0.5]], g: [[0, 0.5], [1, 0.5]] };
export const DIGIT_SEGS = { 0: 'abcdef', 1: 'bc', 2: 'abdeg', 3: 'abcdg', 4: 'bcfg', 5: 'acdfg', 6: 'acdefg', 7: 'abc', 8: 'abcdefg', 9: 'abcdfg', ' ': '' };

function digit(x, y, w, h, t, ch, ghost, live, idx) {
  const on = DIGIT_SEGS[ch] || '';
  let s = `<g transform="translate(${f2(x)} ${f2(y)}) skewX(-7)"${live ? ` data-ww="dg" data-i="${idx}" data-g="${ghost}"` : ''}>`;
  for (const k of 'abcdefg') {
    const [p, q] = SEGS[k].map(([u, vv]) => [u * w, vv * h]);
    const dx = q[0] - p[0], dy = q[1] - p[1], len = Math.hypot(dx, dy), ux = dx / len, uy = dy / len, nx = -uy, ny = ux, g = t * 0.2, hh = t / 2;
    const pts = [
      [p[0] + ux * g, p[1] + uy * g], [p[0] + ux * (g + hh) + nx * hh, p[1] + uy * (g + hh) + ny * hh], [q[0] - ux * (g + hh) + nx * hh, q[1] - uy * (g + hh) + ny * hh],
      [q[0] - ux * g, q[1] - uy * g], [q[0] - ux * (g + hh) - nx * hh, q[1] - uy * (g + hh) - ny * hh], [p[0] + ux * (g + hh) - nx * hh, p[1] + uy * (g + hh) - ny * hh],
    ];
    s += `<path d="M${pts.map((pp) => `${f2(pp[0])} ${f2(pp[1])}`).join('L')}Z"${on.includes(k) ? '' : ` fill-opacity="${ghost}"`}/>`;
  }
  return s + '</g>';
}

/** HH:MM(:SS) seven-segment block centred on (cx,cy) fitting w x h. */
function segDisplay(c, cx, cy, w, h, col, ghost, secs, t = [10, 9, 36]) {
  let dh = h, dw = dh * 0.5;
  const sp = () => dh * 0.17;
  const width = () => 4 * dw + 3 * sp() + dh * 0.28 + (secs ? sp() * 1.3 + 2 * dw * 0.62 + sp() * 0.5 : 0);
  const k = Math.min(1, w / width());
  dh *= k; dw *= k;
  const th = dh * 0.15;
  const W = width();
  let x = cx - W / 2;
  const top = cy - dh / 2 + (secs ? 0 : 0);
  const hh = String(t[0] % 12 || 12).padStart(2, ' '), mm = String(t[1]).padStart(2, '0'), ss = String(t[2]).padStart(2, '0');
  let s = `<g fill="${col}">`;
  const L = c.live;
  s += digit(x, top, dw, dh, th, hh[0], ghost, L, 0); x += dw + sp();
  s += digit(x, top, dw, dh, th, hh[1], ghost, L, 1); x += dw + sp() * 0.6;
  s += `<rect x="${f2(x + dh * 0.02)}" y="${f2(top + dh * 0.25)}" width="${f2(th)}" height="${f2(th)}"/><rect x="${f2(x - dh * 0.04)}" y="${f2(top + dh * 0.68)}" width="${f2(th)}" height="${f2(th)}"/>`;
  x += dh * 0.28 + sp() * 0.4;
  s += digit(x, top, dw, dh, th, mm[0], ghost, L, 2); x += dw + sp();
  s += digit(x, top, dw, dh, th, mm[1], ghost, L, 3); x += dw + sp() * 1.3;
  if (secs) {
    const sdh = dh * 0.62, sdw = dw * 0.62;
    s += digit(x, top + dh - sdh, sdw, sdh, th * 0.75, ss[0], ghost, L, 4); x += sdw + sp() * 0.5;
    s += digit(x, top + dh - sdh, sdw, sdh, th * 0.75, ss[1], ghost, L, 5);
  }
  return s + '</g>';
}

function digitalFace(c) {
  const { v, G } = c, { D, R } = G;
  const dc = c.url('dc');
  const now = new Date();
  const day = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'][now.getDay()];
  let s = `<g clip-path="${dc}">`;
  if (isOled(v)) {
    const tc = v.handColor, ac = v.accentColor || '#ff9f0a';
    s += `<rect x="-100" y="-100" width="200" height="200" fill="#000"/><rect x="-100" y="-100" width="200" height="200" fill="${v.dialColor}" opacity=".6"/>`;
    const fs = Math.min(D.w * 0.62, D.h * 0.5);
    s += `<text y="${f(-D.h * 0.34)}" fill="${ac}" font-family="-apple-system,Helvetica Neue,Arial,sans-serif" font-size="${f(fs * 0.24)}" font-weight="600" text-anchor="middle" letter-spacing=".4">${['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'][now.getDay()]} ${now.getDate()}</text>`;
    s += `<text y="${f(D.h * 0.02)}" fill="${tc}" font-family="-apple-system,Helvetica Neue,Arial,sans-serif" font-size="${f(fs)}" font-weight="300" text-anchor="middle" dominant-baseline="central" letter-spacing="-1"${c.live ? ' data-ww="tx"' : ''}>10:09</text>`;
    // activity rings
    const rr = Math.min(D.w, D.h) * 0.2, cy = D.h * 0.56;
    const ring = (r, col, p) => { const C = 2 * Math.PI * r; return `<circle cy="${f(cy)}" r="${f(r)}" fill="none" stroke="${col}" stroke-width="${f(rr * 0.2)}" opacity=".25"/><circle cy="${f(cy)}" r="${f(r)}" fill="none" stroke="${col}" stroke-width="${f(rr * 0.2)}" stroke-linecap="round" stroke-dasharray="${f(C * p)} ${f(C)}" transform="rotate(-90 0 ${f(cy)})"/>`; };
    s += ring(rr, '#fa114f', 0.78) + ring(rr * 0.74, '#9be62a', 0.62) + ring(rr * 0.48, '#1ee3ef', 0.85);
    s += '</g>';
    s += `<use href="#${c.u('ds')}" fill="none" stroke="#000" stroke-width="2.4" opacity=".6"/>`;
    return s;
  }
  const lcdLight = lum(v.dialColor) > 0.2;
  const plate = lcdLight ? '#15171b' : dk(v.dialColor, 0.35);
  const segCol = lcdLight ? '#1b1f1a' : v.handColor;
  const ghost = lcdLight ? 0.07 : 0.1;
  const ac = v.accentColor || '#2b6fd6';
  s += `<rect x="-100" y="-100" width="200" height="200" fill="${plate}"/>`;
  const sw = D.w * 1.72, sh = Math.min(D.h * 1.04, sw * 0.58);
  const sy = D.h * 0.08;
  s += `<rect x="${f(-sw / 2 - 1.2)}" y="${f(sy - sh / 2 - 1.2)}" width="${f(sw + 2.4)}" height="${f(sh + 2.4)}" rx="2.4" fill="#000" opacity=".55"/>`;
  s += `<rect x="${f(-sw / 2)}" y="${f(sy - sh / 2)}" width="${f(sw)}" height="${f(sh)}" rx="1.8" fill="${v.dialColor}"/>`;
  const gid = c.nid();
  c.defs.push(linGrad(gid, [[0, '#fff', lcdLight ? 0.22 : 0.08], [0.5, '#fff', 0], [1, '#000', 0.12]], 0, 0, 0, 1));
  s += `<rect x="${f(-sw / 2)}" y="${f(sy - sh / 2)}" width="${f(sw)}" height="${f(sh)}" rx="1.8" fill="url(#${gid})"/>`;
  // top row: day + date
  const rowH = sh * 0.22, rowY = sy - sh / 2 + sh * 0.08;
  s += `<text x="${f(-sw * 0.36)}" y="${f(rowY + rowH / 2)}" fill="${segCol}" font-family="Helvetica Neue,Arial,sans-serif" font-weight="700" font-size="${f(rowH * 0.9)}" dominant-baseline="central" font-style="italic">${day}</text>`;
  const dd = String(now.getDate()).padStart(2, ' ');
  const dw2 = rowH * 0.52;
  s += `<g fill="${segCol}">${digit(sw * 0.12, rowY, dw2, rowH, rowH * 0.16, dd[0], ghost)}${digit(sw * 0.12 + dw2 * 1.4, rowY, dw2, rowH, rowH * 0.16, dd[1], ghost)}</g>`;
  s += segDisplay(c, 0, sy + sh * 0.15, sw * 0.9, sh * 0.5, segCol, ghost, true);
  // plate printing
  const tfs = Math.max(2.6, R * 0.07);
  const topY = sy - sh / 2 - (sy - sh / 2 + D.h) / 2, botY = sy + sh / 2 + (D.h - sy - sh / 2) / 2;
  s += `<g font-family="Helvetica Neue,Arial,sans-serif" font-weight="700" font-size="${f(tfs)}" text-anchor="middle" dominant-baseline="central" letter-spacing=".35">`;
  s += `<text y="${f(topY)}" fill="${lt(plate, 0.75)}">ALARM <tspan fill="${ac}">CHRONOGRAPH</tspan></text>`;
  s += `<text y="${f(botY)}" fill="${lt(plate, 0.6)}" font-size="${f(tfs * 0.85)}">WATER <tspan fill="${ac}">WR</tspan> RESIST</text></g>`;
  s += `<rect x="${f(-sw / 2)}" y="${f(topY + tfs * 0.9)}" width="${f(sw)}" height=".5" fill="${ac}" opacity=".8"/>`;
  s += '</g>';
  s += `<use href="#${c.u('ds')}" fill="none" stroke="#000" stroke-width="2" opacity=".5"/>`;
  return s;
}

/* ------------------------------------------------------------------ indices */

function indicesSVG(c, re, pl, R, Rin) {
  const { v } = c;
  const type = v.indices, ic = v.indexColor, lu = v.lumeColor;
  const hide = pl.hide || new Set(), hideNum = pl.hideNum || new Set();
  const ix = c.u('ix'), ap = c.u('ap');
  c.defs.push(
    linGrad(ix, [[0, lt(ic, 0.5)], [0.5, lt(ic, 0.12)], [0.5, dk(ic, 0.1)], [1, dk(ic, 0.38)]], 0, 0, 1, 0),
    `<filter id="${ap}" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx=".35" dy=".7" stdDeviation=".35" flood-color="#000" flood-opacity=".55"/></filter>`,
  );
  const round = c.G.D.k === 'c' && c.G.D.w === c.G.D.h && Rin === R;
  let s = '';
  if (type === 'none') return '';
  // minute track
  let d = '';
  const t0 = R * 0.018, t1 = R * 0.06;
  for (let m = 0; m < 60; m++) {
    const a = m * 6;
    if (m % 5 === 0 && hide.has(m / 5 || 12)) continue;
    d += line(a, re(a) - t0, re(a) - (m % 5 === 0 ? t1 * 1.35 : t1));
  }
  const numeric = ['arabic', 'roman', 'breguet-numerals'].includes(type);
  const cD = c.G.D.k === 'c' && c.G.D.w === c.G.D.h;
  if (cD) { const rb = R - (R - Rin); s += `<g opacity=".75">${dashRing(rb - (t0 + t1) / 2, t1 - t0, 60, +m5(R), ic)}${dashRing(rb - (t0 + t1 * 1.35) / 2, t1 * 1.35 - t0, 12, +m5(R) * 1.4, ic)}</g>`; }
  else s += `<path d="${d}" stroke="${ic}" stroke-width="${m5(R)}" opacity=".75"/>`;
  if (numeric) {
    const ri = R - Rin;
    for (const tt of [t0, t1]) s += round ? `<circle r="${f(R - tt)}" fill="none" stroke="${ic}" stroke-width=".3" opacity=".6"/>` : iuse(c, 'ds', c.G.D, ri + tt, ` fill="none" stroke="${ic}" stroke-width=".3" opacity=".6"`);
  }
  const rOut = (a) => re(a) - R * 0.085;
  const elong = Math.max(c.G.D.h, c.G.D.w) / Math.min(c.G.D.h, c.G.D.w) > 1.4 ? 1.3 : 1;
  const NFS = R * elong * (type === 'roman' ? 0.15 : type === 'breguet-numerals' ? 0.17 : 0.16);
  const L = R * 0.17, w = Math.max(1.1, R * 0.028);
  let app = '', lum2 = '';
  const lumeCol = lu;
  const metal = `url(#${ix})`;
  for (let h = 1; h <= 12; h++) {
    const a = h * 30;
    if (hide.has(h)) continue;
    const r = rOut(a);
    const tr = `transform="${rot(a, r)}"`;
    const quarter = h % 3 === 0;
    switch (type) {
      case 'baton': {
        if (h === 12) {
          app += `<g ${tr}><rect x="${f(-w * 2.5)}" width="${f(w * 2)}" height="${f(L)}" rx=".3" fill="${metal}"/><rect x="${f(w * 0.5)}" width="${f(w * 2)}" height="${f(L)}" rx=".3" fill="${metal}"/></g>`;
          if (lumeCol) lum2 += `<g ${tr}><rect x="${f(-w * 2.05)}" y="1" width="${f(w * 1.1)}" height="${f(L - 2)}" fill="${lumeCol}"/><rect x="${f(w * 0.95)}" y="1" width="${f(w * 1.1)}" height="${f(L - 2)}" fill="${lumeCol}"/></g>`;
        } else {
          const ww = quarter ? w * 1.25 : w;
          app += `<rect ${tr} x="${f(-ww)}" width="${f(2 * ww)}" height="${f(L)}" rx=".3" fill="${metal}"/>`;
          if (lumeCol) lum2 += `<rect ${tr} x="${f(-ww * 0.5)}" y="1" width="${f(ww)}" height="${f(L - 2)}" fill="${lumeCol}"/>`;
        }
        break;
      }
      case 'dots': {
        const rd = R * (quarter ? 0.055 : 0.042);
        app += `<circle ${tr} cy="${f(rd + 0.5)}" r="${f(rd)}" fill="${lumeCol || metal}" stroke="${ic}" stroke-width="${lumeCol ? 0.7 : 0}"/>`;
        break;
      }
      case 'applied-mixed':
      case 'explorer': {
        const lc = lumeCol || '#efe9d8';
        if (h === 12) {
          const tw = R * 0.085, th = R * 0.17;
          app += `<path ${tr} d="M${f(-tw)} 0L${f(tw)} 0L0 ${f(th)}Z" fill="${lc}" stroke="${ic}" stroke-width=".8" stroke-linejoin="round"/>`;
        } else if (type === 'explorer' && quarter) {
          const fs = R * 0.2, [x, y] = P(r - fs * 0.55, a);
          app += `<text x="${f(x)}" y="${f(y)}" font-size="${f(fs)}" fill="${lc}" stroke="${ic}" stroke-width=".45" font-family="Helvetica Neue,Arial,sans-serif" font-weight="700" text-anchor="middle" dominant-baseline="central">${h}</text>`;
        } else if (quarter || type === 'explorer') {
          const ww = type === 'explorer' ? w * 1.1 : w * 1.5;
          app += `<rect ${tr} x="${f(-ww)}" width="${f(2 * ww)}" height="${f(L)}" rx=".4" fill="${lc}" stroke="${ic}" stroke-width=".8"/>`;
        } else {
          const rd = R * 0.055;
          app += `<circle ${tr} cy="${f(rd + 0.6)}" r="${f(rd)}" fill="${lc}" stroke="${ic}" stroke-width=".8"/>`;
        }
        break;
      }
      default: {
        if (hideNum.has(h) && h % 3 === 0) break;
        const roman = type === 'roman';
        const txt = roman ? ['I', 'II', 'III', 'IIII', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'][h - 1] : String(h);
        const fs = NFS;
        if (roman) {
          app += `<text transform="${rot(a, r - fs * 0.52)}" dominant-baseline="central">${txt}</text>`;
        } else {
          const wid = txt.length * fs * 0.3;
          const [x, y] = P(r - fs * 0.5 - Math.abs(Math.sin(a * D2R)) * wid * 0.55, a);
          app += `<text x="${f(x)}" y="${f(y)}">${txt}</text>`;
        }
        if (lumeCol) { const [x, y] = P(re(a) - t1 * 0.5 - 0.3, a); lum2 += `<circle cx="${f(x)}" cy="${f(y)}" r="${f(R * 0.018)}" fill="${lumeCol}"/>`; }
      }
    }
  }
  if (numeric) {
    const roman = type === 'roman', breg = type === 'breguet-numerals';
    const ff = roman || breg ? "Didot,'Bodoni 72',Georgia,'Times New Roman',serif" : 'Helvetica Neue,Arial,sans-serif';
    s += `<g fill="${ic}" font-family="${ff}" font-size="${f(NFS)}"${breg ? ' font-style="italic"' : ''} font-weight="${roman || breg ? 400 : 600}" text-anchor="middle" dominant-baseline="central"${roman ? ' letter-spacing="-.4"' : ''}>${app}</g>`;
    if (breg) {
      let dots = '';
      for (let m = 0; m < 60; m += 5) { const [x, y] = P(re(m * 6) - (t0 + t1) / 2, m * 6); dots += `<circle cx="${f(x)}" cy="${f(y)}" r=".7"/>`; }
      s += `<g fill="${ic}">${dots}</g>`;
    }
  } else {
    s += `<g filter="url(#${ap})">${app}</g>`;
  }
  if (lum2) s += `<g opacity=".95">${lum2}</g>`;
  return s;
}
const m5 = (R) => f2(Math.max(0.4, R * 0.009));

/* ------------------------------------------------------------------ hands */

function handShape(type, L, W, lu, minute) {
  const F = (n) => f(n);
  let body = '', lume = '', extra = '';
  switch (type) {
    case 'dauphine': {
      const bw = W * 1.35;
      body = `<path d="M0 ${F(-L)}L${F(-bw)} ${F(-L * 0.12)}L${F(-bw * 0.4)} 7L0 7Z" fill="LIGHT"/><path d="M0 ${F(-L)}L${F(bw)} ${F(-L * 0.12)}L${F(bw * 0.4)} 7L0 7Z" fill="DARK"/>`;
      if (lu) lume = `<path d="M0 ${F(-L * 0.9)}L${F(-bw * 0.4)} ${F(-L * 0.22)}L0 ${F(-L * 0.18)}L${F(bw * 0.4)} ${F(-L * 0.22)}Z" fill="${lu}"/>`;
      return body + lume;
    }
    case 'leaf': {
      const bw = W * 1.35;
      body = `<path d="M0 ${F(-L)}C${F(bw * 0.9)} ${F(-L * 0.78)} ${F(bw * 1.25)} ${F(-L * 0.3)} ${F(W * 0.35)} 6L${F(-W * 0.35)} 6C${F(-bw * 1.25)} ${F(-L * 0.3)} ${F(-bw * 0.9)} ${F(-L * 0.78)} 0 ${F(-L)}Z" fill="GRAD"/>`;
      if (lu) lume = `<path d="M0 ${F(-L * 0.86)}C${F(bw * 0.45)} ${F(-L * 0.7)} ${F(bw * 0.6)} ${F(-L * 0.4)} 0 ${F(-L * 0.22)}C${F(-bw * 0.6)} ${F(-L * 0.4)} ${F(-bw * 0.45)} ${F(-L * 0.7)} 0 ${F(-L * 0.86)}Z" fill="${lu}"/>`;
      return body + lume;
    }
    case 'sword':
    case 'skeleton': {
      const bw = W * 1.1;
      const d = `M${F(-bw * 0.7)} 7L${F(-bw)} ${F(-L * 0.25)}L${F(-bw * 0.95)} ${F(-L * 0.76)}L0 ${F(-L)}L${F(bw * 0.95)} ${F(-L * 0.76)}L${F(bw)} ${F(-L * 0.25)}L${F(bw * 0.7)} 7Z`;
      if (type === 'skeleton') return `<path d="${d}" fill="none" stroke="GRAD" stroke-width="${F(Math.max(0.8, W * 0.4))}" stroke-linejoin="round"/>` + (lu ? `<path d="M0 ${F(-L * 0.93)}L${F(-bw * 0.45)} ${F(-L * 0.78)}L${F(bw * 0.45)} ${F(-L * 0.78)}Z" fill="${lu}"/>` : '');
      body = `<path d="${d}" fill="GRAD"/>`;
      if (lu) lume = `<path d="M${F(-bw * 0.5)} ${F(-L * 0.22)}L${F(-bw * 0.5)} ${F(-L * 0.76)}L0 ${F(-L * 0.9)}L${F(bw * 0.5)} ${F(-L * 0.76)}L${F(bw * 0.5)} ${F(-L * 0.22)}Z" fill="${lu}"/>`;
      return body + lume;
    }
    case 'pencil': {
      const bw = W * 0.9;
      body = `<path d="M${F(-bw)} 7L${F(-bw)} ${F(-L * 0.88)}L0 ${F(-L)}L${F(bw)} ${F(-L * 0.88)}L${F(bw)} 7Z" fill="GRAD"/>`;
      if (lu) lume = `<rect x="${F(-bw * 0.5)}" y="${F(-L * 0.86)}" width="${F(bw)}" height="${F(L * 0.62)}" fill="${lu}"/>`;
      return body + lume;
    }
    case 'breguet': {
      const rc = W * (minute ? 1.05 : 1.3), cy = -L * (minute ? 0.8 : 0.7);
      body = `<path d="M${F(-W * 0.3)} 8L${F(-W * 0.22)} ${F(cy + rc)}L${F(W * 0.22)} ${F(cy + rc)}L${F(W * 0.3)} 8Z" fill="GRAD"/><circle cy="${F(cy)}" r="${F(rc)}" fill="none" stroke="GRAD" stroke-width="${F(W * 0.5)}"/><path d="M${F(-W * 0.45)} ${F(cy - rc * 0.9)}L0 ${F(-L)}L${F(W * 0.45)} ${F(cy - rc * 0.9)}Z" fill="GRAD"/>`;
      return body;
    }
    case 'cathedral': {
      const bw = W * 1.6, a = -L * 0.34, b = -L * 0.82;
      body = `<path d="M${F(-W * 0.45)} 7L${F(-W * 0.45)} ${F(a)}C${F(-bw)} ${F(a - L * 0.04)} ${F(-bw * 1.1)} ${F(b + L * 0.12)} ${F(-W * 0.5)} ${F(b)}L0 ${F(-L)}L${F(W * 0.5)} ${F(b)}C${F(bw * 1.1)} ${F(b + L * 0.12)} ${F(bw)} ${F(a - L * 0.04)} ${F(W * 0.45)} ${F(a)}L${F(W * 0.45)} 7Z" fill="GRAD"/>`;
      const inner = `<path d="M0 ${F(a - L * 0.04)}C${F(-bw * 0.7)} ${F(a - L * 0.08)} ${F(-bw * 0.7)} ${F(b + L * 0.14)} 0 ${F(b + L * 0.03)}C${F(bw * 0.7)} ${F(b + L * 0.14)} ${F(bw * 0.7)} ${F(a - L * 0.08)} 0 ${F(a - L * 0.04)}Z" fill="${lu || '#000'}"${lu ? '' : ' opacity=".55"'}/>`;
      return body + inner + `<path d="M0 ${F(a - L * 0.04)}V${F(b + L * 0.03)}" stroke="GRAD" stroke-width="${F(W * 0.3)}"/>`;
    }
    case 'mercedes': {
      if (minute) return handShape('sword', L, W, lu, true);
      const rc = W * 1.75, cy = -L * 0.72;
      body = `<path d="M${F(-W * 0.6)} 7L${F(-W * 0.6)} ${F(cy + rc)}L${F(W * 0.6)} ${F(cy + rc)}L${F(W * 0.6)} 7Z" fill="GRAD"/>`;
      if (lu) body += `<rect x="${F(-W * 0.3)}" y="${F(cy + rc + 1)}" width="${F(W * 0.6)}" height="${F(-cy - rc - L * 0.12)}" fill="${lu}"/>`;
      body += `<circle cy="${F(cy)}" r="${F(rc)}" fill="${lu || '#000'}"${lu ? '' : ' fill-opacity=".35"'} stroke="GRAD" stroke-width="${F(W * 0.55)}"/>`;
      body += `<path d="M0 ${F(cy)}L0 ${F(cy - rc)}M0 ${F(cy)}L${F(rc * 0.87)} ${F(cy + rc * 0.5)}M0 ${F(cy)}L${F(-rc * 0.87)} ${F(cy + rc * 0.5)}" stroke="GRAD" stroke-width="${F(W * 0.5)}"/>`;
      body += `<path d="M${F(-W * 0.75)} ${F(cy - rc + 0.3)}L0 ${F(-L)}L${F(W * 0.75)} ${F(cy - rc + 0.3)}Z" fill="GRAD"/>`;
      return body;
    }
    case 'snowflake': {
      if (minute) return handShape('sword', L, W * 0.9, lu, true);
      const bw = W * 1.45, y1 = -L * 0.56, y2 = -L * 0.86;
      body = `<path d="M${F(-W * 0.55)} 7L${F(-W * 0.55)} ${F(y1)}L${F(-bw)} ${F(y1)}L${F(-bw)} ${F(y2)}L${F(-W * 0.5)} ${F(y2)}L0 ${F(-L)}L${F(W * 0.5)} ${F(y2)}L${F(bw)} ${F(y2)}L${F(bw)} ${F(y1)}L${F(W * 0.55)} ${F(y1)}L${F(W * 0.55)} 7Z" fill="GRAD"/>`;
      if (lu) lume = `<rect x="${F(-bw + 0.8)}" y="${F(y2 + 0.8)}" width="${F(2 * bw - 1.6)}" height="${F(y1 - y2 - 1.6)}" fill="${lu}"/><rect x="${F(-W * 0.25)}" y="${F(y1)}" width="${F(W * 0.5)}" height="${F(-y1 - L * 0.14)}" fill="${lu}"/>`;
      return body + lume;
    }
    case 'arrow': {
      if (minute) return handShape('pencil', L, W * 0.95, lu, true);
      const bw = W * 1.9, y1 = -L * 0.6;
      body = `<path d="M${F(-W * 0.55)} 7L${F(-W * 0.55)} ${F(y1)}L${F(W * 0.55)} ${F(y1)}L${F(W * 0.55)} 7Z" fill="GRAD"/><path d="M0 ${F(-L)}L${F(bw)} ${F(-L * 0.66)}L0 ${F(-L * 0.54)}L${F(-bw)} ${F(-L * 0.66)}Z" fill="GRAD"/>`;
      if (lu) lume = `<path d="M0 ${F(-L * 0.93)}L${F(bw * 0.58)} ${F(-L * 0.68)}L0 ${F(-L * 0.6)}L${F(-bw * 0.58)} ${F(-L * 0.68)}Z" fill="${lu}"/><rect x="${F(-W * 0.25)}" y="${F(y1)}" width="${F(W * 0.5)}" height="${F(-y1 - L * 0.14)}" fill="${lu}"/>`;
      return body + lume;
    }
    default: { // baton
      body = `<path d="M${F(-W)} 7L${F(-W * 0.82)} ${F(-L)}L${F(W * 0.82)} ${F(-L)}L${F(W)} 7Z" fill="GRAD"/>`;
      if (lu) lume = `<rect x="${F(-W * 0.42)}" y="${F(-L + 1.4)}" width="${F(W * 0.84)}" height="${F(L * 0.66)}" fill="${lu}"/>`;
      return body + lume;
    }
  }
}

function handsSVG(c, Rin, R, pl) {
  const { v } = c;
  const hc = v.handColor, lu = v.lumeColor;
  const hg = c.u('hg'), hs = c.u('hs');
  c.defs.push(
    linGrad(hg, [[0, lt(hc, 0.5)], [0.5, lt(hc, 0.15)], [0.5, dk(hc, 0.12)], [1, dk(hc, 0.4)]], 0, 0, 1, 0),
    `<filter id="${hs}" x="-50%" y="-50%" width="200%" height="200%"><feDropShadow dx="1" dy="1.8" stdDeviation="1.1" flood-color="#000" flood-opacity=".45"/></filter>`,
  );
  const paint = (str) => str.replace(/"GRAD"/g, `"url(#${hg})"`).replace(/"LIGHT"/g, `"${lt(hc, 0.35)}"`).replace(/"DARK"/g, `"${dk(hc, 0.22)}"`);
  const Wh = Math.max(1.2, R * 0.045), Wm = Math.max(0.9, R * 0.033);
  const Lh = Rin * 0.58, Lm = Rin * (v.hands === 'breguet' ? 0.84 : 0.88);
  const t = [10, 9, 36];
  const hA = (t[0] + t[1] / 60 + t[2] / 3600) * 30, mA = (t[1] + t[2] / 60) * 6, sA = t[2] * 6;
  const L = c.live;
  const grp = (kind, a, inner, extra = '') => `<g${L ? ` class="ww-${kind === 'h' ? 'hour' : kind === 'm' ? 'minute' : kind === 's' ? 'second' : kind}" data-ww="${kind}"` : ''}${extra} transform="rotate(${f2(a)})">${inner}</g>`;
  let s = `<g filter="url(#${hs})">`;
  const cx = new Set(v.complications);
  if (cx.has('gmt')) {
    const gc = v.accentColor || '#c8372d', gL = Rin * 0.86, gw = Math.max(0.5, R * 0.012);
    const gA = ((17 + 9 / 60) / 24) * 360;
    s += grp('gmt', gA, `<path d="M${f(-gw)} 6L${f(-gw)} ${f(-gL * 0.84)}L${f(gw)} ${f(-gL * 0.84)}L${f(gw)} 6Z" fill="${gc}"/><path d="M0 ${f(-gL)}L${f(R * 0.05)} ${f(-gL * 0.82)}L${f(-R * 0.05)} ${f(-gL * 0.82)}Z" fill="${gc}" stroke="${dk(gc, 0.3)}" stroke-width=".3"/>`, L ? ' data-off="7"' : '');
  }
  if (!pl.jump) s += grp('h', hA, paint(handShape(v.hands, Lh, Wh, lu, false)));
  s += grp('m', mA, paint(handShape(v.hands, Lm, Wm, lu, true)));
  s += `<circle r="${f(Wh * 1.1)}" fill="url(#${hg})"/>`;
  // seconds / chrono seconds
  const sc = v.accentColor || (cx.has('chronograph') ? hc : hc);
  const hasSecSub = pl.chrono || Object.values(pl.slots).includes('ssec');
  if (!hasSecSub || pl.chrono) {
    const sL = Rin * 0.92, tail = Rin * 0.22, sw = Math.max(0.45, R * 0.01);
    let sh = `<path d="M${f(-sw)} ${f(tail)}L${f(-sw * 0.6)} ${f(-sL)}L${f(sw * 0.6)} ${f(-sL)}L${f(sw)} ${f(tail)}Z" fill="${sc}"/><rect x="${f(-sw * 2.2)}" y="${f(tail * 0.55)}" width="${f(sw * 4.4)}" height="${f(tail * 0.45)}" rx="${f(sw)}" fill="${sc}"/>`;
    if (lu) sh += `<circle cy="${f(-sL * 0.74)}" r="${f(R * 0.035)}" fill="${lu}" stroke="${sc}" stroke-width=".7"/>`;
    s += pl.chrono ? grp('chrono', 0, sh) : grp('s', sA, sh);
    s += `<circle r="${f(Math.max(1.4, R * 0.028))}" fill="${sc}"/>`;
  }
  s += `<circle r="${f(Math.max(0.5, R * 0.01))}" fill="#000" opacity=".45"/></g>`;
  return s;
}

/* ------------------------------------------------------------------ crystal */

function crystalSVG(c) {
  const { G } = c, { D, R } = G;
  const gl = c.u('gl');
  c.defs.push(linGrad(gl, [[0, '#fff', 0.34], [0.55, '#fff', 0.05], [1, '#fff', 0]], 0, 0, 0.3, 1));
  const cx = -R * 0.3, cy = -R * 0.62;
  let s = `<g clip-path="${c.url('dc')}"><ellipse cx="${f(cx)}" cy="${f(cy)}" rx="${f(R * 1.15)}" ry="${f(R * 0.52)}" transform="rotate(-28 ${f(cx)} ${f(cy)})" fill="url(#${gl})" opacity=".55"/>`;
  s += `<path d="M${f(-R * 1.2)} ${f(R * 0.95)}L${f(R * 1.2)} ${f(R * 0.25)}L${f(R * 1.2)} ${f(R * 0.4)}L${f(-R * 1.2)} ${f(R * 1.1)}Z" fill="#fff" opacity=".035"/></g>`;
  let d = '';
  for (let a = 284; a <= 346; a += 6) { const [x, y] = P(edge(D, a) - R * 0.045, a); d += (a === 284 ? 'M' : 'L') + f(x) + ' ' + f(y); }
  s += `<path d="${d}" fill="none" stroke="#fff" stroke-width=".9" stroke-linecap="round" opacity=".45"/>`;
  return s;
}

/* ------------------------------------------------------------------ live hands */

export function startLiveHands(svgElement) {
  const root = svgElement;
  if (!root || typeof root.querySelectorAll !== 'function') return () => {};
  const q = (k) => Array.from(root.querySelectorAll(`[data-ww="${k}"]`));
  const H = q('h'), M = q('m'), Sx = q('s'), SS = q('ss'), GM = q('gmt'), DG = q('dg'), TX = q('tx'), JH = q('jh');
  if (!H.length && !M.length && !DG.length && !TX.length && !SS.length && !JH.length) return () => {};
  const raf = typeof requestAnimationFrame === 'function' ? requestAnimationFrame : (fn) => setTimeout(() => fn(Date.now()), 50);
  const caf = typeof cancelAnimationFrame === 'function' ? cancelAnimationFrame : clearTimeout;
  let handle = 0, lastSec = -1, stopped = false;
  const set = (els, a) => { for (const e of els) e.setAttribute('transform', `rotate(${a.toFixed(2)})`); };
  const frame = () => {
    if (stopped) return;
    if (root.isConnected === false) { stopped = true; return; }
    const d = new Date();
    const s = d.getSeconds() + d.getMilliseconds() / 1000, m = d.getMinutes() + s / 60, h = (d.getHours() % 12) + m / 60;
    set(H, h * 30); set(M, m * 6); set(Sx, s * 6); set(SS, s * 6);
    for (const g of GM) { const off = +g.getAttribute('data-off') || 0; set([g], (((d.getHours() + off + m / 60) % 24) / 24) * 360); }
    if (d.getSeconds() !== lastSec) {
      lastSec = d.getSeconds();
      const hh = String(d.getHours() % 12 || 12).padStart(2, ' '), mm = String(d.getMinutes()).padStart(2, '0'), ss = String(d.getSeconds()).padStart(2, '0');
      const str = hh + mm + ss;
      for (const g of DG) {
        const on = DIGIT_SEGS[str[+g.getAttribute('data-i')]] || '';
        const ghost = g.getAttribute('data-g') || '0.08';
        Array.from(g.children).forEach((p, k) => { if (on.includes('abcdefg'[k])) p.removeAttribute('fill-opacity'); else p.setAttribute('fill-opacity', ghost); });
      }
      for (const t of TX) t.textContent = `${d.getHours() % 12 || 12}:${mm}`;
      for (const t of JH) t.textContent = String(d.getHours() % 12 || 12);
    }
    handle = raf(frame);
  };
  frame();
  return () => { stopped = true; caf(handle); };
}

/* ------------------------------------------------------------------ fallback visual */

const ARCHETYPES = [
  { caseShape: ['round'], bezel: ['dive'], hands: ['mercedes', 'sword', 'snowflake', 'arrow'], indices: ['applied-mixed', 'dots'], strap: ['bracelet', 'rubber', 'bracelet'], crown: ['crown-guard'], lume: 1, comps: [[], ['date']], textures: ['matte', 'sunburst'], bezelCols: ['#111418', '#16264a', '#133b2c', '#111418'] },
  { caseShape: ['round', 'round', 'rectangular', 'oval', 'tonneau', 'cushion'], bezel: ['none', 'smooth'], hands: ['dauphine', 'leaf', 'breguet', 'baton'], indices: ['baton', 'roman', 'breguet-numerals', 'dots'], strap: ['leather'], crown: ['normal'], lume: 0, comps: [[], ['small-seconds'], ['moonphase'], ['date'], ['power-reserve']], textures: ['guilloche', 'enamel', 'sunburst', 'linen', 'matte'], light: 0.55 },
  { caseShape: ['round'], bezel: ['smooth', 'compass'], hands: ['sword', 'cathedral', 'pencil'], indices: ['arabic'], strap: ['leather', 'nato', 'fabric'], crown: ['onion', 'normal'], lume: 1, comps: [[], ['date'], ['small-seconds']], textures: ['matte'] },
  { caseShape: ['round', 'cushion'], bezel: ['tachymeter', 'smooth'], hands: ['baton', 'sword', 'arrow'], indices: ['baton', 'arabic'], strap: ['bracelet', 'leather', 'rubber'], crown: ['normal'], lume: 1, comps: [['chronograph'], ['chronograph', 'date']], textures: ['sunburst', 'matte'] },
  { caseShape: ['octagon', 'cushion'], bezel: ['octagon-screws', 'smooth'], hands: ['baton'], indices: ['baton'], strap: ['integrated-bracelet'], crown: ['normal'], lume: 1, comps: [['date'], []], textures: ['tapisserie', 'textured', 'sunburst'] },
  { caseShape: ['round'], bezel: ['gmt'], hands: ['mercedes', 'sword'], indices: ['applied-mixed', 'baton'], strap: ['bracelet'], crown: ['crown-guard'], lume: 1, comps: [['gmt', 'date']], textures: ['matte', 'sunburst'], gmt: 1 },
  { caseShape: ['round'], bezel: ['smooth', 'fluted'], hands: ['baton', 'dauphine'], indices: ['baton', 'explorer', 'dots'], strap: ['bracelet', 'leather'], crown: ['normal'], lume: 1, comps: [[], ['date'], ['day-date']], textures: ['sunburst', 'textured', 'matte'] },
];
const DIALS_DARK = ['#0f1a2e', '#16181d', '#0e3b2e', '#1f3a5f', '#4a1c26', '#243238', '#10141c', '#2b3a2e', '#3a2f28', '#1d2b4f'];
const DIALS_LIGHT = ['#f1ede4', '#e9e4d8', '#dfe3e6', '#f6f3ea', '#c9ccd1', '#e8dcc2'];
const METALS_FB = ['steel', 'steel', 'steel', 'yellow-gold', 'rose-gold', 'white-gold', 'titanium', 'two-tone', 'black', 'platinum', 'bronze'];

export function fallbackVisual(seedString) {
  const r = rng(hashStr(seedString == null ? 'watch' : String(seedString)) || 1);
  const pk = (a) => a[Math.floor(r() * a.length) % a.length];
  const A = pk(ARCHETYPES);
  const light = r() < (A.light != null ? A.light : 0.25);
  const dialColor = light ? pk(DIALS_LIGHT) : pk(DIALS_DARK);
  let caseMetal = pk(METALS_FB);
  const strap = pk(A.strap);
  if (A.strap[0] === 'integrated-bracelet' && !['steel', 'titanium', 'rose-gold', 'white-gold'].includes(caseMetal)) caseMetal = 'steel';
  const warm = ['yellow-gold', 'rose-gold', 'bronze'].includes(caseMetal);
  let handColor = light ? (warm ? '#6b4a1e' : pk(['#1c1f26', '#1e3a8a', '#23262d'])) : warm ? METAL[caseMetal][1] : '#e8eaee';
  const hands = pk(A.hands);
  if (hands === 'breguet' && light) handColor = '#1f3fa0';
  const bezel = pk(A.bezel);
  const leather = ['#4a2e1f', '#2a1c14', '#1c1c1e', '#5a3a22', '#233049'];
  const strapColor = strap === 'leather' ? pk(leather) : strap === 'rubber' ? pk(['#15171a', '#1b2a44', '#2a3a2a']) : strap === 'nato' ? pk(['#1f2a3d', '#394232', '#2a2a2e']) : strap === 'fabric' ? pk(['#3b463a', '#4a4235', '#2d3440']) : null;
  const bezelCols = A.bezelCols || ['#111418', '#1d2a52'];
  const gmtPairs = [['#b0212b', '#1d3a8a'], ['#1d2a52', '#121212'], ['#121212', '#6b3a1f'], ['#1f5130', '#121212']];
  const gp = pk(gmtPairs);
  const insertBezel = ['dive', 'gmt'].includes(bezel);
  return {
    caseShape: pk(A.caseShape),
    caseMetal,
    dialColor,
    dialTexture: pk(A.textures),
    bezel,
    bezelColor: bezel === 'gmt' ? gp[0] : insertBezel ? pk(bezelCols) : bezel === 'tachymeter' ? '#141518' : null,
    bezelColor2: bezel === 'gmt' ? gp[1] : null,
    hands,
    handColor,
    indices: pk(A.indices),
    indexColor: handColor,
    accentColor: r() < 0.3 ? pk(['#c8372d', '#e0a526', '#d9542b']) : A.gmt ? '#c8372d' : null,
    complications: pk(A.comps).slice(),
    strap,
    strapColor,
    crown: pk(A.crown),
    lumeColor: A.lume && r() < 0.8 ? pk(['#e9f0dc', '#f0e6c8', '#dfeee4']) : null,
  };
}

export default { renderWatch, startLiveHands, fallbackVisual };
