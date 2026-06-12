/* ==========================================================
   CAMPFIRE — art.js
   Every drawing in the game: the campfire, the smoke
   buffooneries, and the marshmallows. All SVG. Edit, save,
   refresh. Preview everything at /studio.html
   ========================================================== */

/* The painted fire: three hand-drawn frames (fire-0/1/2.png) that the
   game cycles itself. Doing the looping in our own code — instead of
   trusting GIF playback — means the fire flickers on every browser and
   OS, no matter anyone's animation settings. */
const FIRE_FRAMES = ['fire-0.png', 'fire-1.png', 'fire-2.png'];
const FIRE_FLICKER_MS = 150; // time per frame — lower = livelier fire

function campfireSVG() {
  // The round-by-round dwindle is styled in theme.css (".campfire .fire-gif").
  return `<img src="${FIRE_FRAMES[0]}" class="fire-gif" alt="" style="width: 100%; display: block;">`;
}

// Preload all frames so the flicker never blinks while loading
FIRE_FRAMES.forEach(f => { const im = new Image(); im.src = f; });

// The flicker loop. Politely holds still for players who have
// turned motion off in their system accessibility settings.
(function () {
  let i = 0;
  const reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)');
  setInterval(() => {
    if (reduced && reduced.matches) return;
    i = (i + 1) % FIRE_FRAMES.length;
    document.querySelectorAll('.fire-gif').forEach(img => {
      img.src = FIRE_FRAMES[i];
    });
  }, FIRE_FLICKER_MS);
})();

/* The buffooneries that drift up through the smoke on the home screen.
   Pure silhouettes — swap, recolor, or add your own. */
const VIGNETTES = [
  // 1. A UFO abducting a mildly inconvenienced camel
  `<svg viewBox="0 0 120 80" width="130" aria-hidden="true"><g fill="var(--silhouette)">
    <ellipse cx="60" cy="14" rx="26" ry="7"/>
    <path d="M48 10 q12 -13 24 0 z"/>
    <path d="M46 20 L74 20 L86 76 L34 76 Z" opacity="0.18"/>
    <g transform="translate(38 38)">
      <path d="M6 22 q0 -8 7 -9 q1 -5 5 -5 q4 0 5 4 q1 -5 5 -4 q5 1 5 6 q6 1 6 7 v3 h-3 l-1 8 h-3 v-7 h-13 v7 h-3 l-1 -8 h-4 z"/>
      <path d="M33 14 q7 -2 7 -10 q4 1 3 6 q-1 7 -8 8 z"/>
    </g></g></svg>`,
  // 2. A sasquatch making off with a laptop; the monkey objects
  `<svg viewBox="0 0 120 80" width="130" aria-hidden="true"><g fill="var(--silhouette)">
    <ellipse cx="62" cy="38" rx="15" ry="19"/>
    <circle cx="62" cy="14" r="8"/>
    <path d="M50 32 l-12 9 l3 5 l12 -8 z"/>
    <rect x="32" y="40" width="15" height="10" rx="1.5"/>
    <path d="M56 55 l-5 19 h6 l4 -15 z"/>
    <path d="M68 55 l5 19 h-6 l-4 -15 z"/>
    <g transform="translate(95 42)">
      <circle cx="6" cy="5" r="4.5"/>
      <ellipse cx="6" cy="17" rx="4.5" ry="8"/>
      <path d="M2 12 l-7 -7 M10 12 l7 -7" stroke="var(--silhouette)" stroke-width="2.5" fill="none" stroke-linecap="round"/>
      <path d="M10 22 q9 3 8 -7" stroke="var(--silhouette)" stroke-width="2.5" fill="none" stroke-linecap="round"/>
    </g></g></svg>`,
  // 3. A dragon politely roasting a marshmallow
  `<svg viewBox="0 0 120 80" width="130" aria-hidden="true"><g fill="var(--silhouette)">
    <path d="M18 46 q-9 -20 13 -24 q17 -3 22 9 l15 4 l-15 5 q-5 11 -20 10 q-4 7 -11 6 q3 -5 2 -10 z"/>
    <path d="M30 18 l4 -9 l4 9 z M41 16 l4 -9 l4 9 z"/>
    <line x1="68" y1="38" x2="100" y2="52" stroke="var(--silhouette)" stroke-width="2.5" stroke-linecap="round"/>
    <rect x="96" y="46" width="12" height="11" rx="3.5"/>
  </g></svg>`,
  // 4. A tiny knight in pursuit of an enormous rubber duck
  `<svg viewBox="0 0 120 80" width="130" aria-hidden="true"><g fill="var(--silhouette)">
    <path d="M66 60 q-3 -16 11 -18 q-3 -9 7 -12 q10 -2 12 7 q1 5 -3 7 q14 1 13 14 q-1 10 -20 10 l-20 0 z"/>
    <path d="M97 36 l11 3 l-11 4 z"/>
    <g transform="translate(14 32)">
      <circle cx="9" cy="5" r="5.5"/>
      <rect x="5" y="12" width="9" height="15" rx="2"/>
      <path d="M14 17 l16 -10 l2.5 4 l-16 9 z"/>
      <path d="M6 27 l-4 14 h5 l3 -12 z M13 27 l4 14 h-5 l-2 -12 z"/>
    </g></g></svg>`,
];

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
