// Small shared UI fragments (HTML strings).
import { esc } from '../lib/util.js';

/** Ten-segment meter with a label and value. */
export function meter(label, value, { color, note, max = 10 } = {}) {
  const v = value == null ? null : Math.round(value);
  let bars = '';
  for (let i = 1; i <= max; i++) bars += `<i class="${v != null && i <= v ? 'on' : ''}" style="--k:${i}"></i>`;
  return `<div class="meter"${color ? ` style="--mc:${color}"` : ''} role="img" aria-label="${esc(label)}: ${v == null ? 'unknown' : `${v} out of ${max}`}">
    <div class="meter__top"><span class="meter__label">${esc(label)}</span><span class="meter__value">${v == null ? '—' : v}<small>/${max}</small></span></div>
    <div class="meter__bar" aria-hidden="true">${bars}</div>
    ${note ? `<span class="meter__note">${esc(note)}</span>` : ''}
  </div>`;
}

export const ARROW_EXT = '<span aria-hidden="true">↗</span>';
