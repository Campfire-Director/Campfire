/* ==========================================================
   CAMPFIRE — art.js
   The drawings in the game: the voting marshmallows. SVG.
   Edit, save, refresh. (The scenery is video + a still —
   see backdrop.js.)
   ========================================================== */

/* Marshmallow-on-a-stick icons for voting */
function mallow(type, size) {
  size = size || 26;
  const fill = type === 'gold' ? 'var(--mallow-gold)' : 'var(--mallow-burnt)';
  const edge = type === 'gold' ? 'var(--mallow-gold-edge)' : 'var(--mallow-burnt-edge)';
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true">
    <line x1="3" y1="21" x2="13" y2="11" stroke="var(--stick)" stroke-width="2.2" stroke-linecap="round"/>
    <rect x="10.5" y="3" width="10.5" height="9.5" rx="3" fill="${fill}" stroke="${edge}" stroke-width="1.2"/>
    ${type === 'gold' ? '<path d="M13 10.5 q2.5 1.5 5 0" stroke="var(--mallow-gold-edge)" stroke-width="1" fill="none"/>' : '<path d="M14 12.5 v3 M18 12.5 v2" stroke="var(--mallow-burnt)" stroke-width="2" stroke-linecap="round"/>'}
  </svg>`;
}
