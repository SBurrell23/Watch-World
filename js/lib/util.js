// Watch World: shared utilities (no DOM side effects at import time).

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const slug = (s) => String(s ?? '')
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));

export function fmtUSD(n, { compact = true } = {}) {
  if (n == null || !isFinite(n)) return '—';
  if (!compact || n < 1000) return '$' + Math.round(n).toLocaleString('en-US');
  if (n >= 1e9) return '$' + (n / 1e9).toFixed(1).replace(/\.0$/, '') + 'B';
  if (n >= 1e6) return '$' + (n / 1e6).toFixed(1).replace(/\.0$/, '') + 'M';
  if (n >= 1e4) return '$' + Math.round(n / 1e3) + 'k';
  return '$' + (n / 1e3).toFixed(1).replace(/\.0$/, '') + 'k';
}

export const fmtNum = (n) => (n == null || !isFinite(n) ? '—' : Math.round(n).toLocaleString('en-US'));

/** Regional-indicator flag emoji from an ISO alpha-2 code. */
export function flag(cc) {
  if (!cc || !/^[A-Za-z]{2}$/.test(cc)) return '';
  return String.fromCodePoint(...[...cc.toUpperCase()].map((c) => 0x1f1a5 + c.charCodeAt(0)));
}

export function debounce(fn, ms = 150) {
  let t;
  return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}

/** Stable 32-bit string hash. */
export function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

export const uniq = (arr) => [...new Set(arr.filter((v) => v != null && v !== ''))];

export const reducedMotion = () => !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/** localStorage wrapper that never throws. */
export const store = {
  get(key, fallback = null) {
    try { const v = localStorage.getItem(key); return v == null ? fallback : JSON.parse(v); } catch { return fallback; }
  },
  set(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); } catch { /* private mode */ }
  },
};

/** Parse "a=1&b=x,y" into an object (values stay strings). */
export function parseQuery(qs) {
  const out = {};
  if (!qs) return out;
  for (const [k, v] of new URLSearchParams(qs)) out[k] = v;
  return out;
}

/** Build a query string from an object, skipping empty values. Arrays are comma-joined. */
export function buildQuery(obj) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(obj)) {
    if (v == null || v === '' || (Array.isArray(v) && !v.length)) continue;
    p.set(k, Array.isArray(v) ? v.join(',') : String(v));
  }
  const s = p.toString().replace(/%2C/gi, ',');
  return s ? '?' + s : '';
}

export const listParam = (v) => (v ? String(v).split(',').map((s) => s.trim()).filter(Boolean) : []);

export const TIER_LABELS = [
  null,
  '< $100', '$100–300', '$300–1k', '$1k–3k', '$3k–7k',
  '$7k–15k', '$15k–40k', '$40k–100k', '$100k–300k', '$300k+',
];
export const TIER_NAMES = [
  null, 'Entry', 'Accessible', 'Enthusiast', 'Serious', 'Luxury entry',
  'Luxury', 'High luxury', 'Haute', 'Grand haute', 'Stratospheric',
];

export const SEGMENTS = ['Haute Horlogerie', 'Luxury', 'Premium', 'Mid-range', 'Affordable', 'Fashion', 'Independent', 'Microbrand', 'Smartwatch'];
export const CONTINENTS = ['Europe', 'Asia', 'North America', 'South America', 'Oceania', 'Africa'];
export const MOVEMENT_TYPES = ['automatic', 'manual', 'quartz', 'spring-drive', 'solar', 'kinetic', 'smart', 'hybrid', 'mechanical-digital'];
export const SPECIALTIES = ['dive', 'chronograph', 'dress', 'pilot', 'field', 'gmt', 'complications', 'tourbillon', 'sport-luxury', 'racing', 'jewelry', 'skeleton', 'avant-garde', 'tool', 'digital', 'smart', 'military', 'minimalist', 'vintage-inspired', 'astronomical', 'enamel-artistry'];

/** "sport-luxury" -> "Sport luxury" */
export const label = (s) => {
  const t = String(s ?? '').replace(/-/g, ' ').replace(/\bgmt\b/gi, 'GMT');
  return t.charAt(0).toUpperCase() + t.slice(1);
};

export const plural = (n, one, many = one + 's') => `${fmtNum(n)} ${n === 1 ? one : many}`;

/** Ten-dot meter markup, used on cards and brand pages. */
export function dots(value, max = 10) {
  const v = Math.round(value || 0);
  let s = '';
  for (let i = 1; i <= max; i++) s += `<i class="${i <= v ? 'on' : ''}"></i>`;
  return `<span class="dots" aria-hidden="true">${s}</span>`;
}

/** Model key used across views: "brandId~index" */
export const modelKey = (brandId, i) => `${brandId}~${i}`;

/** Deterministic day index (local date) for "of the day" features. */
export function dayIndex(d = new Date()) {
  return Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 864e5);
}

export const nextFrame = () => new Promise((r) => requestAnimationFrame(() => r()));

/** Small flag image (flag-icons via jsDelivr); hides itself if the code is unknown. */
export function flagImg(cc, cls = 'flag') {
  if (!cc || !/^[A-Za-z]{2}$/.test(cc)) return '';
  return `<img class="${cls}" src="https://cdn.jsdelivr.net/npm/flag-icons@7/flags/4x3/${cc.toLowerCase()}.svg" alt="" width="20" height="15" loading="lazy" decoding="async" onerror="this.remove()">`;
}
