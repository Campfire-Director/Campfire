/* ==========================================================
   CAMPFIRE — art.js
   The drawings in the game: the marshmallows, the campers,
   and the small lobby fireside. All SVG. Edit, save, refresh.
   (The big scenery is video + a still now — see backdrop.js.)
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
