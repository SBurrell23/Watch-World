// Merges data/raw/group-*.json into data/brands.json, validating and normalising against data/SCHEMA.md.
// Usage: node tools/build-data.mjs
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const rawDir = join(root, 'data', 'raw');

const ENUMS = {
  status: ['active', 'defunct', 'revived'],
  continent: ['Europe', 'Asia', 'North America', 'South America', 'Oceania', 'Africa'],
  segment: ['Haute Horlogerie', 'Luxury', 'Premium', 'Mid-range', 'Affordable', 'Fashion', 'Independent', 'Microbrand', 'Smartwatch'],
  inHouseMovements: ['yes', 'partial', 'no'],
  movementTypes: ['automatic', 'manual', 'quartz', 'spring-drive', 'solar', 'kinetic', 'smart', 'hybrid', 'mechanical-digital'],
  specialties: ['dive', 'chronograph', 'dress', 'pilot', 'field', 'gmt', 'complications', 'tourbillon', 'sport-luxury', 'racing', 'jewelry', 'skeleton', 'avant-garde', 'tool', 'digital', 'smart', 'military', 'minimalist', 'vintage-inspired', 'astronomical', 'enamel-artistry'],
};

const issues = [];
const warn = (id, msg) => issues.push(`${id}: ${msg}`);
const clamp = (n, lo, hi) => (typeof n === 'number' && isFinite(n) ? Math.min(hi, Math.max(lo, Math.round(n))) : null);
const slug = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const files = readdirSync(rawDir).filter((f) => /^group-\d+\.json$/.test(f)).sort();
const byId = new Map();

for (const f of files) {
  let arr;
  try {
    arr = JSON.parse(readFileSync(join(rawDir, f), 'utf8'));
  } catch (e) {
    console.error(`!! ${f} is not valid JSON: ${e.message}`);
    continue;
  }
  if (!Array.isArray(arr)) { console.error(`!! ${f} is not an array`); continue; }
  for (const b of arr) {
    if (!b || !b.name) continue;
    b.id = b.id ? slug(b.id) : slug(b.name);
    if (byId.has(b.id)) { warn(b.id, `duplicate in ${f}, keeping the entry with more models`); if ((byId.get(b.id).models || []).length >= (b.models || []).length) continue; }
    b._source = f;
    byId.set(b.id, b);
  }
}

const brands = [...byId.values()].map((b) => {
  for (const k of ['status', 'continent', 'segment', 'inHouseMovements']) {
    if (b[k] != null && !ENUMS[k].includes(b[k])) warn(b.id, `bad ${k} "${b[k]}"`);
  }
  for (const k of ['movementTypes', 'specialties']) {
    b[k] = (Array.isArray(b[k]) ? b[k] : []).filter((v) => ENUMS[k].includes(v) || (warn(b.id, `dropped ${k} "${v}"`), false));
  }
  for (const k of ['priceTier', 'popularity', 'prestige', 'valueRetention']) {
    b[k] = clamp(b[k], 1, 10);
    if (b[k] == null) warn(b.id, `missing ${k}`);
  }
  if (typeof b.founded === 'string') b.founded = parseInt(b.founded, 10) || null;
  if (typeof b.lat !== 'number' || typeof b.lng !== 'number') warn(b.id, 'missing coordinates');
  if (!b.priceRange || typeof b.priceRange.min !== 'number' || typeof b.priceRange.max !== 'number') {
    // Fall back to model prices, then to the brand's price-tier band; flagged so the UI can mark it as estimated.
    const TIERS = [[0, 100], [100, 300], [300, 1000], [1000, 3000], [3000, 7000], [7000, 15000], [15000, 40000], [40000, 100000], [100000, 300000], [300000, 1500000]];
    const prices = (b.models || []).map((m) => m.priceUSD).filter((p) => typeof p === 'number' && p > 0);
    const band = b.priceTier ? TIERS[b.priceTier - 1] : null;
    const pr = b.priceRange || {};
    const min = typeof pr.min === 'number' ? pr.min : prices.length ? Math.min(...prices) : band?.[0] ?? null;
    const max = typeof pr.max === 'number' ? pr.max : prices.length ? Math.max(...prices) : band?.[1] ?? null;
    b.priceRange = { min: min && max ? Math.min(min, max) : min, max: min && max ? Math.max(min, max) : max, estimated: true };
    if (b.priceRange.min == null) warn(b.id, 'missing priceRange (no fallback)');
  }
  b.models = (Array.isArray(b.models) ? b.models : []).filter((m) => m && m.name);
  if (b.models.length < 3) warn(b.id, `only ${b.models.length} models`);
  b.models.forEach((m, i) => {
    m.id = `${b.id}--${slug(m.name)}${b.models.findIndex((x) => slug(x.name) === slug(m.name)) !== i ? '-' + i : ''}`;
    if (!m.visual) warn(m.id, 'no visual');
    if (m.url && !/^https?:\/\//.test(m.url)) { warn(m.id, `bad url ${m.url}`); m.url = null; }
    if (m.imageUrl && !/^https:\/\//.test(m.imageUrl)) m.imageUrl = null;
  });
  if (b.website && !/^https?:\/\//.test(b.website)) b.website = 'https://' + b.website;
  delete b._source;
  return b;
}).sort((a, b) => a.name.localeCompare(b.name));

writeFileSync(join(root, 'data', 'brands.json'), JSON.stringify(brands));

// Connections graph: reconcile ids against final brand ids and drop dangling or duplicate edges.
const EDGE_TYPES = ['owns', 'stake', 'movement-supplier', 'designer', 'lineage', 'collaboration', 'founder-link', 'former-owner', 'case-dial-supplier'];
try {
  const conn = JSON.parse(readFileSync(join(rawDir, 'connections.json'), 'utf8'));
  const entityIds = new Set(conn.entities.map((e) => (e.id = slug(e.id))));
  const brandIds = new Set(brands.map((b) => b.id));
  // Tolerate slug variants: "a-lange-sohne" vs "a-lange-and-sohne", "mbandf" vs "mb-and-f", "iwc" vs "iwc-schaffhausen".
  const loose = (s) => s.replace(/and/g, '').replace(/-/g, '');
  const looseMap = new Map();
  for (const b of brands) for (const v of [b.id, slug(b.name)]) looseMap.set(loose(v), b.id);
  const byLength = [...brandIds].sort((a, b) => b.length - a.length);
  const resolve = (id) => {
    id = slug(id);
    if (entityIds.has(id) || brandIds.has(id)) return id;
    return looseMap.get(loose(id)) ?? byLength.find((b) => id.startsWith(b + '-') || b.startsWith(id + '-')) ?? null;
  };
  const seen = new Set();
  const before = conn.edges.length;
  conn.edges = conn.edges.filter((e) => {
    const s = resolve(e.source), t = resolve(e.target);
    if (!s || !t) { warn('connections', `dropped ${e.source} -> ${e.target} (unknown node)`); return false; }
    if (!EDGE_TYPES.includes(e.type)) { warn('connections', `dropped ${e.source} -> ${e.target} (bad type ${e.type})`); return false; }
    const key = `${s}|${t}|${e.type}`;
    if (seen.has(key)) return false;
    seen.add(key);
    e.source = s; e.target = t;
    return true;
  });
  writeFileSync(join(root, 'data', 'connections.json'), JSON.stringify(conn, null, 1));
  console.log(`Connections: kept ${conn.edges.length}/${before} edges, ${conn.entities.length} entities.`);
} catch (e) {
  console.log(`Connections: skipped (${e.message})`);
}
const models = brands.reduce((n, b) => n + b.models.length, 0);
console.log(`Wrote ${brands.length} brands, ${models} models from ${files.length} files.`);
console.log(`Countries: ${new Set(brands.map((b) => b.countryCode)).size}, with images: ${brands.flatMap((b) => b.models).filter((m) => m.imageUrl).length}`);
if (issues.length) console.log(`\n${issues.length} issues:\n` + issues.join('\n'));
