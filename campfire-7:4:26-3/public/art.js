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

/* ==========================================================
   TITLE-SCREEN SCENE (renderHome)
   A hand-painted starry-night campfire scene, recreated from
   the design handoff. All inline SVG/CSS — no raster assets.
   Split into builder functions so renderHome() stays readable.
   ========================================================== */

// Camper avatar presets (cosmetic; saved locally for the future avatar feature)
const CAMPERS = [
  { id: 'ember', name: 'Ember', color: '#e98f3e', dark: '#b96a24', face: '#c98e5f' },
  { id: 'moss',  name: 'Moss',  color: '#7cc79a', dark: '#55976f', face: '#8c5a3b' },
  { id: 'wren',  name: 'Wren',  color: '#7f96ad', dark: '#5c7288', face: '#f0d6b8' },
  { id: 'maple', name: 'Maple', color: '#e8705f', dark: '#b94f41', face: '#5e3a24' },
  { id: 'marsh', name: 'Marsh', color: '#f0c987', dark: '#c9974f', face: '#a9714b' },
  { id: 'bark',  name: 'Bark',  color: '#9a7a52', dark: '#7a5a3a', face: '#e9c8a0' },
];

// The painted sky: gradient, wind swirls, spiral stars, moon, ridges, meadow
function sceneSky() {
  return `
  <svg aria-hidden="true" viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice" style="position:absolute;inset:0;width:100%;height:100%;z-index:0;">
    <defs>
      <linearGradient id="v2-sky" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#33261a"/><stop offset="0.45" stop-color="#292018"/><stop offset="0.72" stop-color="#1a1e28"/>
      </linearGradient>
      <linearGradient id="v2-ground" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#1c4a41"/><stop offset="0.55" stop-color="#143830"/><stop offset="1" stop-color="#0c221e"/>
      </linearGradient>
      <mask id="v2-mooncut"><rect x="1220" y="30" width="180" height="180" fill="white"/><circle cx="1292" cy="108" r="37" fill="black"/></mask>
      <g id="v2-star">
        <circle r="30" fill="#e8d76a" opacity="0.1"/>
        <path d="M 0 -21 A 21 21 0 1 1 -20 -6" stroke="#a8923c" stroke-width="6" fill="none" stroke-linecap="round" opacity="0.8"/>
        <path d="M 2 -14 A 14 14 0 1 1 -13 -4" stroke="#cbb84a" stroke-width="5" fill="none" stroke-linecap="round" opacity="0.95"/>
        <path d="M 1 -8 A 8 8 0 1 1 -7 -2.5" stroke="#e8d76a" stroke-width="4.5" fill="none" stroke-linecap="round"/>
        <circle r="3" fill="#f2e9a0"/>
      </g>
    </defs>
    <rect x="0" y="0" width="1440" height="700" fill="url(#v2-sky)"/>
    <g transform="translate(0 78)">
    <g style="animation:cf-drift 16s ease-in-out infinite alternate;" opacity="0.75">
      <path d="M150 300 C 360 200, 600 210, 740 280 C 850 335, 930 300, 920 240 C 912 195, 855 185, 835 225 C 820 258, 855 285, 900 275" stroke="#6b93b0" stroke-width="16" fill="none" stroke-linecap="round" opacity="0.3"/>
      <path d="M160 295 C 365 200, 598 215, 735 282 C 845 333, 922 298, 912 242 C 905 200, 858 192, 842 226 C 830 254, 858 278, 898 270" stroke="#9cc0d8" stroke-width="7" fill="none" stroke-linecap="round" opacity="0.55"/>
      <path d="M150 312 C 358 214, 594 224, 732 292 C 838 342, 918 310, 908 252" stroke="#7fa7c4" stroke-width="4" fill="none" stroke-linecap="round" opacity="0.45"/>
      <path d="M175 315 C 380 225, 590 238, 720 300 C 700 302, 660 310, 640 318" stroke="#d7e5ec" stroke-width="6" fill="none" stroke-linecap="round" opacity="0.5"/>
      <path d="M220 275 C 400 195, 560 200, 690 255" stroke="#d7e5ec" stroke-width="4" fill="none" stroke-linecap="round" opacity="0.35"/>
      <path d="M980 320 C 1090 280, 1200 285, 1270 330 C 1330 370, 1310 420, 1260 415 C 1225 411, 1218 375, 1248 365" stroke="#6b93b0" stroke-width="12" fill="none" stroke-linecap="round" opacity="0.28"/>
      <path d="M985 315 C 1092 278, 1198 283, 1264 326 C 1320 363, 1303 412, 1262 407 C 1232 403, 1226 375, 1250 366" stroke="#8fb3c9" stroke-width="10" fill="none" stroke-linecap="round" opacity="0.6"/>
    </g></g>
    <g style="transform-origin:260px 150px;transform-box:view-box;animation:cf-spin 90s linear infinite;"><use href="#v2-star" transform="translate(260 150) scale(1.55)"/></g>
    <g style="transform-origin:465px 85px;transform-box:view-box;animation:cf-spin-rev 110s linear infinite;"><use href="#v2-star" transform="translate(465 85) scale(1.05)"/></g>
    <g style="transform-origin:660px 165px;transform-box:view-box;animation:cf-spin 130s linear infinite;"><use href="#v2-star" transform="translate(660 165) scale(0.85)"/></g>
    <g style="transform-origin:900px 95px;transform-box:view-box;animation:cf-spin-rev 100s linear infinite;"><use href="#v2-star" transform="translate(900 95) scale(1.3)"/></g>
    <g style="transform-origin:1080px 210px;transform-box:view-box;animation:cf-spin 120s linear infinite;"><use href="#v2-star" transform="translate(1080 210) scale(0.9)"/></g>
    <g style="transform-origin:330px 400px;transform-box:view-box;animation:cf-spin 140s linear infinite;"><use href="#v2-star" transform="translate(330 400) scale(0.75)"/></g>
    <g style="transform-origin:1150px 440px;transform-box:view-box;animation:cf-spin-rev 125s linear infinite;"><use href="#v2-star" transform="translate(1150 440) scale(0.7)"/></g>
    <g transform="translate(-125 15)">
      <g style="transform-origin:1310px 120px;transform-box:view-box;animation:cf-spin 200s linear infinite;">
        <circle cx="1310" cy="120" r="60" fill="#e8d76a" opacity="0.14"/>
        <path d="M 1310 34 A 86 86 0 1 1 1225 106" stroke="#a8923c" stroke-width="5" fill="none" stroke-linecap="round" opacity="0.55"/>
        <path d="M 1310 46 A 74 74 0 1 0 1382 132" stroke="#cbb84a" stroke-width="3.5" fill="none" stroke-linecap="round" opacity="0.4"/>
      </g>
      <g mask="url(#v2-mooncut)"><circle cx="1310" cy="120" r="42" fill="#e8d76a"/><circle cx="1310" cy="120" r="38" fill="#f2e9a0" opacity="0.55"/></g>
    </g>
    <path d="M0 640 Q 180 555 380 610 T 760 600 T 1130 615 T 1440 590 L 1440 700 L 0 700 Z" fill="#3b4a78" opacity="0.9"/>
    <path d="M0 640 Q 180 560 380 612 M 760 600 Q 900 570 1010 606" stroke="#6f83b8" stroke-width="5" fill="none" opacity="0.5" stroke-linecap="round"/>
    <path d="M0 675 Q 260 610 520 655 T 1010 650 T 1440 640 L 1440 700 L 0 700 Z" fill="#2c3a63" opacity="0.95"/>
    <rect x="0" y="668" width="1440" height="232" fill="url(#v2-ground)"/>
    <g stroke-linecap="round" fill="none" opacity="0.6">
      <path d="M60 720 q90 -14 180 -4" stroke="#2a6b5c" stroke-width="7"/><path d="M320 750 q120 -18 230 -6" stroke="#1f5c4e" stroke-width="8"/>
      <path d="M700 715 q100 -12 200 -2" stroke="#2a6b5c" stroke-width="6"/><path d="M1020 745 q120 -16 240 -4" stroke="#1f5c4e" stroke-width="8"/>
      <path d="M140 800 q140 -16 260 -6" stroke="#16493e" stroke-width="9"/><path d="M560 790 q130 -14 250 -4" stroke="#2a6b5c" stroke-width="7"/>
      <path d="M950 805 q130 -16 250 -5" stroke="#16493e" stroke-width="9"/><path d="M40 860 q160 -14 300 -6" stroke="#123c33" stroke-width="10"/>
      <path d="M620 862 q150 -12 280 -4" stroke="#1a5246" stroke-width="8"/><path d="M1060 858 q140 -14 280 -6" stroke="#123c33" stroke-width="10"/>
      <path d="M420 700 q60 -8 120 -2" stroke="#35755f" stroke-width="5"/><path d="M880 695 q70 -8 130 -3" stroke="#35755f" stroke-width="5"/>
    </g>
  </svg>`;
}

// The hand-painted vector campfire (flame + burning logs + coals)
function sceneFireSVG() {
  return `
  <svg viewBox="0 0 360 420" role="img" aria-label="A crackling campfire" width="248" style="display:block;overflow:visible;">
    <defs>
      <radialGradient id="cffOuter" cx="50%" cy="76%" r="62%"><stop offset="0%" stop-color="#f28a2e"/><stop offset="42%" stop-color="#e05617"/><stop offset="74%" stop-color="#ad2c0d"/><stop offset="100%" stop-color="#6f1607"/></radialGradient>
      <radialGradient id="cffMid" cx="50%" cy="80%" r="55%"><stop offset="0%" stop-color="#ffd36a"/><stop offset="46%" stop-color="#f7902b"/><stop offset="100%" stop-color="#d5400f"/></radialGradient>
      <radialGradient id="cffCore" cx="50%" cy="84%" r="52%"><stop offset="0%" stop-color="#fff6d8"/><stop offset="48%" stop-color="#ffdd86"/><stop offset="100%" stop-color="#ffab3d" stop-opacity="0"/></radialGradient>
      <linearGradient id="cffLog" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#9a744a"/><stop offset="55%" stop-color="#6d4c2c"/><stop offset="100%" stop-color="#432c17"/></linearGradient>
      <radialGradient id="cffEnd" cx="42%" cy="40%" r="65%"><stop offset="0%" stop-color="#c69a63"/><stop offset="55%" stop-color="#7d5731"/><stop offset="100%" stop-color="#4a3119"/></radialGradient>
      <radialGradient id="cffCoal" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="#ffd06a"/><stop offset="40%" stop-color="#ff6a1f"/><stop offset="100%" stop-color="#8f1d05" stop-opacity="0"/></radialGradient>
      <filter id="cffPaint" x="-30%" y="-30%" width="160%" height="160%">
        <feTurbulence type="fractalNoise" baseFrequency="0.015 0.03" numOctaves="2" seed="4" result="n"><animate attributeName="baseFrequency" dur="7s" values="0.015 0.028;0.021 0.038;0.015 0.028" repeatCount="indefinite"/></feTurbulence>
        <feDisplacementMap in="SourceGraphic" in2="n" scale="12" xChannelSelector="R" yChannelSelector="G"/>
      </filter>
      <filter id="cffPaintSoft" x="-30%" y="-30%" width="160%" height="160%">
        <feTurbulence type="fractalNoise" baseFrequency="0.03 0.05" numOctaves="2" seed="9" result="n2"/>
        <feDisplacementMap in="SourceGraphic" in2="n2" scale="7" xChannelSelector="R" yChannelSelector="G"/>
      </filter>
      <filter id="cffBlurCore" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="4"/></filter>
    </defs>
    <g filter="url(#cffPaintSoft)">
      <ellipse cx="180" cy="388" rx="128" ry="22" fill="#160c06" opacity="0.55"/>
      <g transform="rotate(-17 180 372)"><rect x="58" y="356" width="196" height="32" rx="16" fill="url(#cffLog)"/><ellipse cx="64" cy="372" rx="14" ry="17" fill="url(#cffEnd)"/><ellipse cx="64" cy="372" rx="7" ry="9.5" fill="none" stroke="#3d2914" stroke-width="1.8" opacity="0.6"/></g>
      <g transform="rotate(16 180 376)"><rect x="104" y="360" width="196" height="32" rx="16" fill="url(#cffLog)"/><ellipse cx="296" cy="376" rx="14" ry="17" fill="url(#cffEnd)"/><ellipse cx="296" cy="376" rx="7" ry="9.5" fill="none" stroke="#3d2914" stroke-width="1.8" opacity="0.6"/></g>
      <ellipse cx="180" cy="362" rx="80" ry="19" fill="url(#cffCoal)" style="animation:cff-coal 2.6s ease-in-out infinite;transform-box:fill-box;transform-origin:center;"/>
    </g>
    <g style="transform-box:fill-box;transform-origin:50% 94%;animation:cff-sway 3.6s ease-in-out infinite;">
      <g filter="url(#cffPaint)">
        <g style="transform-box:fill-box;transform-origin:50% 100%;animation:cff-flick .62s ease-in-out infinite;">
          <path d="M180,374 C140,372 108,340 106,296 C88,270 92,222 120,196 C104,178 110,146 138,140 C150,158 160,158 168,138 C174,120 178,108 176,92 C186,110 190,126 196,120 C222,150 236,214 218,262 C238,300 226,352 180,374 Z" fill="url(#cffOuter)"/>
          <path d="M180,364 C148,362 124,336 122,298 C108,276 112,236 134,214 C122,196 128,170 150,166 C160,182 166,182 172,166 C178,150 180,140 178,126 C196,158 206,214 194,256 C210,290 200,338 180,364 Z" fill="url(#cffMid)"/>
        </g>
      </g>
      <g filter="url(#cffBlurCore)"><path d="M180,356 C160,354 148,326 152,292 C148,272 154,244 172,232 C182,252 190,290 188,318 C186,342 190,350 180,356 Z" fill="url(#cffCore)" style="transform-box:fill-box;transform-origin:50% 100%;animation:cff-core 1.1s ease-in-out infinite;"/></g>
    </g>
    <g filter="url(#cffPaint)">
      <path d="M126,286 C108,262 110,228 128,208 C126,240 138,250 140,274 C138,292 136,298 126,286 Z" fill="url(#cffMid)" opacity="0.85" style="transform-box:fill-box;transform-origin:50% 100%;animation:cff-tongue .74s ease-in-out infinite;"/>
      <path d="M236,280 C256,254 256,218 236,196 C242,230 228,244 226,270 C228,290 228,296 236,280 Z" fill="url(#cffMid)" opacity="0.8" style="transform-box:fill-box;transform-origin:50% 100%;animation:cff-tongue .68s ease-in-out .3s infinite;"/>
    </g>
  </svg>`;
}

// A single seating log SVG (used for the ring)
function sceneLog(w) {
  return `<svg viewBox="0 0 96 26" width="${w}"><rect x="4" y="4" width="88" height="18" rx="9" fill="#5f4630"/><rect x="4" y="4" width="88" height="9" rx="4.5" fill="#6d5238" opacity="0.8"/><ellipse cx="8.5" cy="13" rx="5" ry="8.5" fill="#8a6d4a"/><ellipse cx="8.5" cy="13" rx="2.4" ry="4.6" fill="#a98a63"/></svg>`;
}

// A pine tree silhouette
function sceneTree(w, fill) {
  return `<svg viewBox="0 0 240 560" width="${w}"><path d="M70 560 L70 430 L40 440 L78 350 L52 358 L92 268 L70 274 L112 178 L96 182 L132 92 L168 182 L152 178 L194 274 L172 268 L212 358 L186 350 L224 440 L194 430 L194 560 Z" fill="${fill}"/></svg>`;
}

// The seated camper avatar (beanie figure with marshmallow stick)
function sceneSeatedCamper(color, dark, face, label) {
  return `
  <div style="position:absolute;left:-152px;top:-12px;transform:translate(-50%,-100%);display:flex;flex-direction:column;align-items:center;gap:4px;">
    <span class="camper-seat-label" style="background:rgba(18,26,38,0.88);border:1px solid rgba(241,238,227,0.16);border-radius:999px;padding:3px 12px;font-size:13px;color:#f1eee3;backdrop-filter:blur(5px);white-space:nowrap;">${esc(label)}</span>
    <svg viewBox="0 0 100 92" width="86">
      <line x1="58" y1="58" x2="88" y2="46" stroke="#8a6d4a" stroke-width="3" stroke-linecap="round"/>
      <rect x="83" y="36" width="12" height="10" rx="3.5" fill="#f7f2e6" stroke="#c9974f" stroke-width="1.2"/>
      <ellipse cx="42" cy="64" rx="20" ry="21" fill="${color}"/>
      <ellipse cx="44" cy="83" rx="17" ry="7" fill="${dark}"/>
      <circle cx="46" cy="32" r="14" fill="${face}"/>
      <path d="M32 30 a14 14 0 0 1 28 0 z" fill="${color}"/>
      <rect x="31" y="27" width="30" height="6" rx="3" fill="${dark}"/>
      <circle cx="46" cy="15" r="4.5" fill="#f1eee3"/>
      <circle cx="43" cy="37" r="1.7" fill="#2b2119"/><circle cx="52" cy="37" r="1.7" fill="#2b2119"/>
      <path d="M45 42 q3 2.6 6 0" stroke="#2b2119" stroke-width="1.3" fill="none" stroke-linecap="round"/>
    </svg>
  </div>`;
}

// A camper picker button (beanie avatar)
function sceneCamperButton(c, picked) {
  const edge = picked ? '#e98f3e' : 'rgba(46,29,15,0.8)';
  return `<button onclick="pickAvatar('${c.id}')" title="${esc(c.name)}" class="camper-avatar-btn" style="border-color:${edge};">
    <svg viewBox="26 8 40 38" width="100%">
      <circle cx="46" cy="32" r="14" fill="${c.face}"/>
      <path d="M32 30 a14 14 0 0 1 28 0 z" fill="${c.color}"/>
      <rect x="31" y="27" width="30" height="6" rx="3" fill="${c.dark}"/>
      <circle cx="46" cy="15" r="4.5" fill="#f1eee3"/>
      <circle cx="43" cy="37" r="1.7" fill="#2b2119"/><circle cx="52" cy="37" r="1.7" fill="#2b2119"/>
      <path d="M45 42 q3 2.6 6 0" stroke="#2b2119" stroke-width="1.3" fill="none" stroke-linecap="round"/>
    </svg>
  </button>`;
}

/* ==========================================================
   AVATARS IN THE GAME — the camper picked on the title screen
   follows the player everywhere: lobby seats, name chips,
   the writing status list, the ballot, and the results.
   ========================================================== */

function camperById(id) {
  return CAMPERS.find(c => c.id === id) || null;
}

// A little beanie head, for name chips and lists. Unknown/absent
// camper → a neutral gray head so every player still gets a face.
function camperHead(id, size) {
  const c = camperById(id) || { color: '#8a94a0', dark: '#66707c', face: '#c9c2b4' };
  return `<svg viewBox="28 8 36 38" width="${size || 20}" height="${size || 20}" style="vertical-align:-4px;">
    <circle cx="46" cy="32" r="14" fill="${c.face}"/>
    <path d="M32 30 a14 14 0 0 1 28 0 z" fill="${c.color}"/>
    <rect x="31" y="27" width="30" height="6" rx="3" fill="${c.dark}"/>
    <circle cx="46" cy="15" r="4.5" fill="#f1eee3"/>
    <circle cx="43" cy="37" r="1.7" fill="#2b2119"/><circle cx="52" cy="37" r="1.7" fill="#2b2119"/>
    <path d="M45 42 q3 2.6 6 0" stroke="#2b2119" stroke-width="1.3" fill="none" stroke-linecap="round"/>
  </svg>`;
}

// A full seated camper (body + marshmallow stick), standalone —
// used for the lobby fireside and the results podium.
function camperFigure(id, width, flip) {
  const c = camperById(id) || { color: '#8a94a0', dark: '#66707c', face: '#c9c2b4' };
  return `<svg viewBox="0 0 100 92" width="${width || 64}" style="display:block;${flip ? 'transform:scaleX(-1);' : ''}">
    <line x1="58" y1="58" x2="88" y2="46" stroke="#8a6d4a" stroke-width="3" stroke-linecap="round"/>
    <rect x="83" y="36" width="12" height="10" rx="3.5" fill="#f7f2e6" stroke="#c9974f" stroke-width="1.2"/>
    <ellipse cx="42" cy="64" rx="20" ry="21" fill="${c.color}"/>
    <ellipse cx="44" cy="83" rx="17" ry="7" fill="${c.dark}"/>
    <circle cx="46" cy="32" r="14" fill="${c.face}"/>
    <path d="M32 30 a14 14 0 0 1 28 0 z" fill="${c.color}"/>
    <rect x="31" y="27" width="30" height="6" rx="3" fill="${c.dark}"/>
    <circle cx="46" cy="15" r="4.5" fill="#f1eee3"/>
    <circle cx="43" cy="37" r="1.7" fill="#2b2119"/><circle cx="52" cy="37" r="1.7" fill="#2b2119"/>
    <path d="M45 42 q3 2.6 6 0" stroke="#2b2119" stroke-width="1.3" fill="none" stroke-linecap="round"/>
  </svg>`;
}

// The lobby fireside: everyone in the room seated in an arc around
// a small fire, marshmallow sticks pointed in. Disconnected campers
// fade out. Works for 1–8 players.
function lobbyFireside(players) {
  const n = players.length;
  const seats = players.map((p, i) => {
    // spread seats along a shallow arc, fire in the middle
    const t = n === 1 ? 0.5 : i / (n - 1);           // 0..1 across the strip
    const x = 8 + t * 84;                             // percent, edges padded
    const y = 42 + Math.sin(t * Math.PI) * 26;        // middle seats sit lower (closer)
    const flip = x > 50;                              // face the fire
    const scale = 0.8 + Math.sin(t * Math.PI) * 0.25; // middle seats a touch bigger
    return `
      <div style="position:absolute;left:${x}%;top:${y}%;transform:translate(-50%,0);text-align:center;${p.connected ? '' : 'opacity:0.35;filter:grayscale(0.7);'}">
        ${camperFigure(p.camper, Math.round(52 * scale), flip)}
        <div style="font-size:11px;color:var(--ink-soft);margin-top:1px;white-space:nowrap;max-width:76px;overflow:hidden;text-overflow:ellipsis;">${esc(p.name)}${p.isHost ? ' ★' : ''}</div>
      </div>`;
  }).join('');
  return `
  <div class="lobby-fireside" aria-label="Campers around the fire">
    <div style="position:absolute;left:50%;bottom:6px;transform:translateX(-50%);width:120px;">${sceneFireSVG().replace('width="248"', 'width="120"')}</div>
    ${seats}
  </div>`;
}
