// Shared card components. Each returns an HTML string.
// Watch renders are lazy: a `.watch-slot[data-watch="brandId~modelIndex"]` placeholder is filled by
// main.js (IntersectionObserver) when it scrolls near the viewport, so any view can use these cards freely.
import { esc, fmtUSD, flagImg, TIER_LABELS, TIER_NAMES, label } from '../lib/util.js';

const HEART = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20.5s-7.5-4.6-9.3-9.2C1.4 8 3.5 4.5 7 4.5c2 0 3.3 1.1 5 3 1.7-1.9 3-3 5-3 3.5 0 5.6 3.5 4.3 6.8-1.8 4.6-9.3 9.2-9.3 9.2z"/></svg>';
const SCALES = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v18M5 21h14M4 8h16M7 8l-3 7a3 3 0 0 0 6 0L7 8zm10 0-3 7a3 3 0 0 0 6 0l-3-7z"/></svg>';

/** Price-tier pill. Colour comes from --tier-N. */
export function tierBadge(tier) {
  const t = Math.round(Number(tier));
  if (!t || t < 1 || t > 10) return '';
  return `<span class="tier-badge" style="--tc:var(--tier-${t})" title="Price tier ${t} of 10 · ${esc(TIER_NAMES[t])} (${esc(TIER_LABELS[t])})"><i aria-hidden="true"></i>T${t}<span class="tier-badge__range"> · ${esc(TIER_LABELS[t])}</span></span>`;
}

/** Placeholder that main.js fills with renderWatch() when visible. */
export function watchSlot(brandId, modelIndex = 0, { size = 240, strap = true, cls = '' } = {}) {
  return `<div class="watch-slot ${cls}" data-watch="${esc(brandId)}~${modelIndex}" data-size="${size}" data-strap="${strap ? 1 : 0}" aria-hidden="true"></div>`;
}

export function favButton(brand, ctx) {
  const on = !!ctx?.favorites?.has(brand.id);
  return `<button type="button" class="icon-btn fav-btn" data-fav="${esc(brand.id)}" aria-pressed="${on}" aria-label="Save ${esc(brand.name)} to favourites" title="Favourite">${HEART}</button>`;
}

export function compareButton(brand, ctx) {
  const on = !!ctx?.compare?.has(brand.id);
  return `<button type="button" class="icon-btn cmp-btn" data-compare="${esc(brand.id)}" aria-pressed="${on}" aria-label="Add ${esc(brand.name)} to compare" title="Compare">${SCALES}</button>`;
}

/** Brand card: render, name, origin, known-for, tier, segment, favourite and compare toggles. */
export function brandCard(brand, ctx) {
  if (!brand) return '';
  const hasModel = (brand.models || []).length > 0;
  const place = [brand.city, brand.country].filter(Boolean).join(', ');
  return `<article class="bcard" data-id="${esc(brand.id)}">
  <div class="bcard__media">${hasModel ? watchSlot(brand.id, 0, { size: 220 }) : `<div class="watch-slot" data-watch="${esc(brand.id)}~-1" data-size="220" data-strap="1" aria-hidden="true"></div>`}</div>
  <div class="bcard__body">
    <p class="bcard__meta">${flagImg(brand.countryCode)}<span>${esc(place)}</span>${brand.founded ? `<span class="bcard__year">est. ${esc(brand.founded)}</span>` : ''}</p>
    <h3 class="bcard__name"><a class="stretch" href="#/brand/${esc(brand.id)}">${esc(brand.name)}</a></h3>
    ${brand.knownFor ? `<p class="bcard__known">${esc(brand.knownFor)}</p>` : ''}
    <div class="bcard__foot">${tierBadge(brand.priceTier)}<span class="seg" title="${esc(brand.segment || '')}">${esc(brand.segment || '')}</span></div>
  </div>
  <div class="bcard__actions">${favButton(brand, ctx)}${compareButton(brand, ctx)}</div>
</article>`;
}

/** Model card: render, brand, name, reference, key specs, price. Links to the brand page's gallery. */
export function modelCard(model, brand, ctx) {
  if (!model || !brand) return '';
  let i = Number.isInteger(model._i) ? model._i : (brand.models || []).indexOf(model);
  const media = i >= 0
    ? watchSlot(brand.id, i, { size: 220 })
    : `<div class="watch-slot is-filled">${safeRender(ctx, model, brand)}</div>`;
  if (i < 0) i = 0;
  const specs = [
    model.caseSizeMm ? `${model.caseSizeMm} mm` : null,
    model.caseMaterial,
    model.waterResistanceM ? `${model.waterResistanceM} m` : null,
  ].filter(Boolean);
  return `<article class="mcard" data-model="${esc(brand.id)}~${i}">
  <div class="mcard__media">${media}</div>
  <div class="mcard__body">
    <p class="mcard__brand">${esc(brand.name)}</p>
    <h3 class="mcard__name"><a class="stretch" href="#/brand/${esc(brand.id)}?model=${i}">${esc(model.name)}</a></h3>
    <p class="mcard__ref">${model.reference ? `Ref. ${esc(model.reference)}` : label(model.category || '')}${model.introduced ? ` · ${esc(model.introduced)}` : ''}</p>
    ${specs.length ? `<p class="mcard__specs">${specs.map(esc).join('<span aria-hidden="true"> · </span>')}</p>` : ''}
    <p class="mcard__price">${model.priceUSD ? `<span class="muted">from</span> ${fmtUSD(model.priceUSD, { compact: false })}` : '<span class="muted">Price on request</span>'}</p>
  </div>
</article>`;
}

function safeRender(ctx, model, brand) {
  try {
    const v = model.visual || ctx?.fallbackVisual?.(brand.id + model.name);
    return ctx.renderWatch(v, { size: 220, showStrap: true, live: false, title: `${brand.name} ${model.name}` });
  } catch { return ''; }
}
