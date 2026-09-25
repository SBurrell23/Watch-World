// Watch Finder (#/finder) — step-by-step quiz that scores brands and models.
import { esc, fmtUSD, tierVar, header, allModels, watchSVG, prefersReducedMotion } from './_shared.js';

const STEPS = [
  { key: 'b', q: 'What would you like to spend?', sub: 'A guide, not a limit — we’ll suggest watches at or a little under this figure.', type: 'single', options: [
    { v: '300', label: 'Up to $300', note: 'Honest, fun, and indestructible' },
    { v: '1000', label: 'Up to $1,000', note: 'Enthusiast Japanese & microbrand territory' },
    { v: '3000', label: 'Up to $3,000', note: 'Serious Swiss & German mechanics' },
    { v: '7000', label: 'Up to $7,000', note: 'The doorway to luxury' },
    { v: '15000', label: 'Up to $15,000', note: 'Icons of the industry' },
    { v: '40000', label: 'Up to $40,000', note: 'Precious metals and manufactures' },
    { v: '1000000', label: 'Sky’s the limit', note: 'Haute horlogerie and grand complications' },
  ] },
  { key: 'o', q: 'Where will it be worn most?', type: 'multi', max: 1, options: [
    { v: 'everyday', label: 'Every day', note: 'One watch for everything' },
    { v: 'dress', label: 'Dress & formal', note: 'Slim, under a cuff' },
    { v: 'sport', label: 'Sport & water', note: 'Divers and chronographs' },
    { v: 'adventure', label: 'Adventure', note: 'Field, tool and rugged' },
    { v: 'travel', label: 'Travel & flying', note: 'Pilot’s and GMT watches' },
    { v: 'collector', label: 'Collector’s piece', note: 'Complications and artistry' },
    { v: 'tech', label: 'Tech & fitness', note: 'Smart and digital' },
  ] },
  { key: 'mv', q: 'What should make it tick?', type: 'single', options: [
    { v: 'auto', label: 'Automatic', note: 'Self-winding mechanics, sweeping seconds' },
    { v: 'manual', label: 'Hand-wound', note: 'A daily ritual; often slimmer' },
    { v: 'quartz', label: 'Quartz or solar', note: 'Grab-and-go precision' },
    { v: 'smart', label: 'Smart', note: 'Notifications, health and apps' },
    { v: 'any', label: 'No preference', note: '' },
  ] },
  { key: 'sz', q: 'How large is your wrist?', sub: 'Measure just below the wrist bone.', type: 'single', options: [
    { v: 's', label: 'Slender', note: 'Under 16 cm · 34–38 mm cases' },
    { v: 'm', label: 'Average', note: '16–18 cm · 38–41 mm cases' },
    { v: 'l', label: 'Broad', note: 'Over 18 cm · 41–46 mm cases' },
    { v: 'any', label: 'Not sure', note: 'Size won’t count against a watch' },
  ] },
  { key: 'p', q: 'What matters most to you?', type: 'multi', max: 1, options: [
    { v: 'heritage', label: 'Heritage', note: 'Long history and storied icons' },
    { v: 'value', label: 'Value retention', note: 'Holds or grows its worth' },
    { v: 'innovation', label: 'Innovation', note: 'In-house engineering and firsts' },
    { v: 'recognition', label: 'Recognition', note: 'A name everyone knows' },
    { v: 'craft', label: 'Craft & prestige', note: 'Respected by connoisseurs' },
    { v: 'bang', label: 'Bang for the buck', note: 'Most watch for the money' },
  ] },
  { key: 'r', q: 'Any regional preference?', type: 'multi', max: 1, options: [
    { v: 'CH', label: 'Swiss', note: 'The Jura, Geneva and Biel' },
    { v: 'DE', label: 'German', note: 'Glashütte precision' },
    { v: 'JP', label: 'Japanese', note: 'Seiko, Citizen, Casio & more' },
    { v: 'US', label: 'American', note: 'From Waltham to Cupertino' },
    { v: 'GB', label: 'British', note: 'A revival of English watchmaking' },
    { v: 'FR,IT,DK,SE,NL,AT', label: 'Elsewhere in Europe', note: 'French, Italian, Nordic…' },
    { v: 'CN,HK,IN,KR,SG,AU,TW', label: 'Asia-Pacific', note: 'Emerging makers' },
    { v: '', label: 'No preference', note: 'Great watches come from everywhere' },
  ] },
];

const OCC = {
  everyday: ['sport-luxury', 'field', 'dive', 'minimalist', 'pilot', 'gmt', 'dress', 'vintage-inspired'],
  dress: ['dress', 'minimalist', 'jewelry', 'enamel-artistry'],
  sport: ['dive', 'chronograph', 'racing', 'sport-luxury'],
  adventure: ['field', 'tool', 'military', 'dive', 'digital'],
  travel: ['pilot', 'gmt'],
  collector: ['complications', 'tourbillon', 'astronomical', 'skeleton', 'avant-garde', 'enamel-artistry'],
  tech: ['smart', 'digital'],
};
const OCC_LABEL = { everyday: 'everyday wear', dress: 'dressier occasions', sport: 'sport and water', adventure: 'adventure', travel: 'travel', collector: 'collecting', tech: 'tech-minded wear' };
const SIZE = { s: [33, 38.5], m: [38, 41.5], l: [41, 46.5] };
const COUNTRY_ADJ = { CH: 'Swiss', DE: 'German', JP: 'Japanese', US: 'American', GB: 'British', FR: 'French', IT: 'Italian' };

function movementKind(m, b) {
  const s = `${m.movement || ''}`.toLowerCase();
  if (/smart|wear ?os|watchos/.test(s)) return 'smart';
  if (/quartz|solar|eco-drive|kinetic|spring drive|spring-drive|digital/.test(s)) return /spring/.test(s) ? 'auto' : 'quartz';
  if (/manual|hand-?wound|hand wind/.test(s)) return 'manual';
  if (/auto/.test(s)) return 'auto';
  const t = b.movementTypes || [];
  if (t.includes('smart')) return 'smart';
  if (t.length === 1 && ['quartz', 'solar'].includes(t[0])) return 'quartz';
  return t.includes('automatic') ? 'auto' : t.includes('manual') ? 'manual' : 'quartz';
}

export function score(ans, brands) {
  const budget = +ans.b || 1e7;
  const occ = ans.o || [];
  const pri = ans.p || [];
  const regions = (ans.r || []).flatMap(r => r.split(','));
  const cats = new Set(occ.flatMap(o => OCC[o] || []));
  const out = [];
  for (const { m, b, key } of allModels(brands)) {
    const price = m.priceUSD ?? b.priceRange?.min;
    if (!price || price > budget * 1.1) continue;
    const why = [];
    let s = 0;
    // budget fit: best when using 35–100% of budget
    const ratio = price / budget;
    s += ratio > 1 ? 10 : ratio >= 0.35 ? 22 + ratio * 8 : 10 + ratio * 30;
    if (budget < 1e6) why.push(ratio > 1 ? `A small stretch at ${fmtUSD(price, { compact: false })}` : `Within budget at ${fmtUSD(price, { compact: false })}`);
    // occasion
    if (occ.length) {
      const hit = cats.has(m.category) || (b.specialties || []).some(sp => cats.has(sp) && sp === m.category);
      if (cats.has(m.category)) { s += 24; why.push(`A ${String(m.category).replace(/-/g, ' ')} watch — right for ${occ.map(o => OCC_LABEL[o]).join(' and ')}`); }
      else if ((b.specialties || []).some(sp => cats.has(sp))) s += 8;
      else s -= 6;
      void hit;
      if (occ.includes('dress') && m.caseSizeMm && m.caseSizeMm <= 40) s += 4;
      if (occ.includes('sport') && m.waterResistanceM >= 200) { s += 5; why.push(`${m.waterResistanceM} m water resistance`); }
    }
    // movement
    if (ans.mv && ans.mv !== 'any') {
      const k = movementKind(m, b);
      if (k === ans.mv) { s += 16; why.push({ auto: 'Self-winding automatic movement', manual: 'Hand-wound mechanical movement', quartz: 'Precise quartz or solar movement', smart: 'Smart functionality' }[k]); }
      else if ((ans.mv === 'auto' && k === 'manual') || (ans.mv === 'manual' && k === 'auto')) s += 6;
      else s -= 14;
    }
    // size
    if (ans.sz && ans.sz !== 'any' && m.caseSizeMm) {
      const [lo, hi] = SIZE[ans.sz];
      if (m.caseSizeMm >= lo && m.caseSizeMm <= hi) { s += 10; why.push(`${m.caseSizeMm} mm case suits your wrist`); }
      else s -= Math.min(12, 3 * Math.min(Math.abs(m.caseSizeMm - lo), Math.abs(m.caseSizeMm - hi)));
    }
    // priorities
    const P = {
      heritage: () => { const age = new Date().getFullYear() - (b.founded || 2000); const v = Math.min(1, age / 150) * 0.6 + ((m.introduced && m.introduced < 1975) ? 0.4 : 0); return [v, v > 0.6 && `${b.name} has been making watches since ${b.founded}`]; },
      value: () => { const v = (b.valueRetention || 5) / 10; return [v, v >= 0.8 && `Strong resale value (${b.valueRetention}/10)`]; },
      innovation: () => { const v = (b.inHouseMovements === 'yes' ? 0.5 : b.inHouseMovements === 'partial' ? 0.25 : 0) + Math.min(0.5, (b.innovations || []).length * 0.1); return [v, v >= 0.6 && (b.innovations?.[0] ? `Innovator — ${b.innovations[0]}` : 'In-house movements')]; },
      recognition: () => { const v = (b.popularity || 5) / 10; return [v, v >= 0.8 && `A name recognised worldwide`]; },
      craft: () => { const v = (b.prestige || 5) / 10; return [v, v >= 0.8 && `Revered by collectors (prestige ${b.prestige}/10)`]; },
      bang: () => { const v = Math.max(0, Math.min(1, ((b.prestige || 5) - (b.priceTier || 5) + 3) / 6)); return [v, v >= 0.7 && `Punches above its price`]; },
    };
    for (const k of pri) { const [v, w] = P[k](); s += v * 18; if (w) why.push(w); }
    // region
    if (regions.length) {
      if (regions.includes(b.countryCode)) { s += 12; why.push(`${COUNTRY_ADJ[b.countryCode] || b.country}-made, as you prefer`); }
      else s -= 10;
    }
    s += (b.popularity || 5) * 0.4 + (b.prestige || 5) * 0.3; // gentle tie-breaker
    out.push({ m, b, key, s, why: why.filter(Boolean) });
  }
  out.sort((a, b) => b.s - a.s);
  const brandsMap = new Map();
  for (const r of out) { if (!brandsMap.has(r.b.id)) brandsMap.set(r.b.id, { b: r.b, s: 0, n: 0, best: r }); const e = brandsMap.get(r.b.id); if (e.n < 2) { e.s += r.s * (e.n ? 0.12 : 1); e.n++; } }
  const topBrands = [...brandsMap.values()].sort((a, b) => b.s - a.s);
  // diversify models: max 2 per brand
  const per = new Map();
  const models = out.filter(r => { const n = per.get(r.b.id) || 0; if (n >= 2) return false; per.set(r.b.id, n + 1); return true; });
  const max = out[0]?.s || 1;
  return { models, brands: topBrands, max };
}

const encode = a => Object.entries(a).filter(([, v]) => v && (!Array.isArray(v) || v.length)).map(([k, v]) => `${k}=${encodeURIComponent(Array.isArray(v) ? v.join('|') : v)}`).join('&');
const decode = p => {
  const a = {};
  for (const s of STEPS) if (p[s.key]) a[s.key] = s.type === 'multi' ? String(p[s.key]).split('|').filter(Boolean) : String(p[s.key]);
  return a;
};

let cleanup = [];

export default {
  title: 'Watch Finder',
  render(root, ctx) {
    this.destroy();
    const wrap = document.createElement('div');
    wrap.className = 'vw vw-finder';
    root.appendChild(wrap);
    let ans = decode(ctx.params || {});
    let step = 0;
    let advancing = false;
    const done = ctx.params?.go === '1' && ans.b;

    wrap.innerHTML = `${header({ eyebrow: 'Personal consultation', title: 'Watch <em>Finder</em>', lede: 'Six questions, a few seconds each. We weigh every model in the guide against your budget, style and priorities — and tell you why.' })}
      <div class="vw-finder__body" aria-live="polite"></div>`;
    const body = wrap.querySelector('.vw-finder__body');

    function renderStep() {
      const s = STEPS[step];
      const sel = s.type === 'multi' ? (ans[s.key] || []) : [ans[s.key]].filter(Boolean);
      body.innerHTML = `<section class="vw-quiz" aria-labelledby="vwQ">
        <div class="vw-quiz__progress" aria-hidden="true"><i style="width:${(step / STEPS.length) * 100}%"></i></div>
        <p class="vw-quiz__count"><span>${String(step + 1).padStart(2, '0')}</span> / ${String(STEPS.length).padStart(2, '0')}</p>
        <h2 class="vw-quiz__q" id="vwQ" tabindex="-1">${s.q}</h2>
        ${s.sub ? `<p class="vw-quiz__sub">${s.sub}</p>` : ''}
        <div class="vw-quiz__opts" role="group" aria-labelledby="vwQ">
          ${s.options.map((o, i) => `<button type="button" class="vw-opt" style="--i:${i}" data-v="${esc(o.v)}" aria-pressed="${sel.includes(o.v)}">
            <span class="vw-opt__label">${esc(o.label)}</span>${o.note ? `<span class="vw-opt__note">${esc(o.note)}</span>` : ''}<span class="vw-opt__check" aria-hidden="true"></span></button>`).join('')}
        </div>
        <div class="vw-quiz__nav">
          <button type="button" class="vw-btn" data-back ${step === 0 ? 'disabled' : ''}>← Back</button>
        </div></section>`;
      body.querySelector('.vw-quiz__q').focus({ preventScroll: true });
    }

    body.addEventListener('click', e => {
      const opt = e.target.closest('.vw-opt');
      if (opt) {
        // Every question is a single pick that advances on its own; 'multi' steps still store an array for scoring.
        if (advancing) return;
        const s = STEPS[step];
        const v = opt.dataset.v;
        ans[s.key] = s.type === 'multi' ? (v ? [v] : []) : v;
        body.querySelectorAll('.vw-opt').forEach(b => b.setAttribute('aria-pressed', String(b === opt)));
        advancing = true;
        setTimeout(() => { advancing = false; next(); }, prefersReducedMotion() ? 0 : 260);
        return;
      }
      if (e.target.closest('[data-back]')) { step = Math.max(0, step - 1); renderStep(); }
      if (e.target.closest('[data-next]')) next();
      if (e.target.closest('[data-restart]')) { ans = {}; step = 0; history.replaceState(null, '', '#/finder'); renderStep(); wrap.scrollIntoView({ block: 'start' }); }
      if (e.target.closest('[data-edit]')) { step = +e.target.closest('[data-edit]').dataset.edit; renderStep(); }
      if (e.target.closest('[data-share]')) share(e.target.closest('[data-share]'));
    });

    function next() {
      if (step < STEPS.length - 1) { step++; renderStep(); } else renderResults();
    }

    function share(btn) {
      const url = location.href.split('#')[0] + '#/finder?' + encode(ans) + '&go=1';
      const done = t => { btn.textContent = t; setTimeout(() => (btn.textContent = 'Share results'), 2200); };
      if (navigator.share && matchMedia('(pointer:coarse)').matches) navigator.share({ title: 'My Watch World matches', url }).catch(() => {});
      else navigator.clipboard?.writeText(url).then(() => done('Link copied ✓'), () => { prompt('Copy this link', url); });
    }

    function summary() {
      const lab = (k, v) => STEPS.find(s => s.key === k).options.find(o => o.v === v)?.label || v;
      return STEPS.map((s, i) => {
        const v = ans[s.key];
        const txt = Array.isArray(v) ? (v.length ? v.map(x => lab(s.key, x)).join(', ') : 'Any') : v ? lab(s.key, v) : 'Any';
        return `<button type="button" class="vw-answer" data-edit="${i}" aria-label="Change answer: ${esc(s.q)}"><span>${esc(s.q.replace(/\?$/, ''))}</span><b>${esc(txt)}</b></button>`;
      }).join('');
    }

    function renderResults() {
      history.replaceState(null, '', '#/finder?' + encode(ans) + '&go=1');
      const { models, brands, max } = score(ans, ctx.brands);
      if (!models.length) {
        body.innerHTML = `<section class="vw-results"><h2 class="vw-h2">Nothing quite fits — yet.</h2><p class="vw-lede">Try widening your budget or removing a regional preference.</p><div class="vw-answers">${summary()}</div><button type="button" class="vw-btn vw-btn--gold" data-restart>Start again</button></section>`;
        return;
      }
      const top3 = brands.slice(0, 3);
      const pctOf = s => Math.max(40, Math.min(99, Math.round(60 + (s / max) * 39)));
      body.innerHTML = `<section class="vw-results">
        <p class="vw-eyebrow">Your matches</p>
        <h2 class="vw-results__h">We’d start with <em>${esc(top3[0].b.name)}</em>${top3[1] ? `, then ${esc(top3[1].b.name)}` : ''}${top3[2] ? ` and ${esc(top3[2].b.name)}` : ''}.</h2>
        <div class="vw-answers" aria-label="Your answers — select one to change it">${summary()}</div>
        <div class="vw-results__actions"><button type="button" class="vw-btn vw-btn--gold" data-share>Share results</button><button type="button" class="vw-btn" data-restart>Restart quiz</button></div>
        <div class="vw-podium">${top3.map((e, i) => `<a class="vw-podium__item" href="#/brand/${esc(e.b.id)}" style="--i:${i}">
          <span class="vw-podium__rank">${['I', 'II', 'III'][i]}</span>
          <span class="vw-podium__art">${watchSVG(ctx, e.best.m, e.b, { size: 150 })}</span>
          <span class="vw-podium__name">${esc(e.b.name)}</span>
          <span class="vw-podium__meta">${[e.b.country, e.b.segment].filter(Boolean).map(esc).join(' · ')}</span>
          <span class="vw-podium__why">${esc(e.best.why.slice(-2).join(' · ') || e.b.knownFor || '')}</span></a>`).join('')}</div>
        <h3 class="vw-h2">Recommended models</h3>
        <ol class="vw-recs">${models.slice(0, 12).map((r, i) => `<li class="vw-rec" style="--tc:${tierVar(r.b.priceTier)}">
          <span class="vw-rec__art">${watchSVG(ctx, r.m, r.b, { size: 110 })}</span>
          <div class="vw-rec__body">
            <p class="vw-rec__rank">No. ${i + 1} · <span class="vw-rec__match">${pctOf(r.s)}% match</span></p>
            <h4 class="vw-rec__name"><a href="#/brand/${esc(r.b.id)}">${esc(r.b.name)}</a> ${esc(r.m.name)}</h4>
            <p class="vw-rec__price">${r.m.priceUSD ? fmtUSD(r.m.priceUSD, { compact: false }) : r.b.priceRange?.min ? `Brand from ${fmtUSD(r.b.priceRange.min, { compact: false })}` : 'Price on request'}</p>
            <ul class="vw-rec__why">${r.why.slice(0, 4).map(w => `<li>${esc(w)}</li>`).join('')}</ul>
            ${r.m.url ? `<a class="vw-link" href="${esc(r.m.url)}" target="_blank" rel="noopener noreferrer">View on maker’s site ↗</a>` : ''}
          </div></li>`).join('')}</ol>
      </section>`;
      body.querySelector('.vw-results__h').setAttribute('tabindex', '-1');
      body.querySelector('.vw-results__h').focus({ preventScroll: true });
      wrap.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' });
    }

    if (done) renderResults(); else renderStep();
  },
  destroy() { cleanup.forEach(f => f()); cleanup = []; },
};
