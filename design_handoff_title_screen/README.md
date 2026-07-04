# Handoff: Campfire — Title / Home Screen Redesign

## Overview
A ground-up redesign of Campfire's title screen (the `renderHome` view). It replaces the
flat photographic night-sky background with a **hand-painted, Van-Gogh-inspired starry
night**, adds an animated **rising-smoke column that pools behind the title**, a new
**hand-painted SVG campfire**, a **ring of seating logs** for the eventual "camper" avatar
mechanic, a **dark forest that closes in around the fire**, ambient **critters** (raccoon,
owl, bigfoot, shooting star), and **rustic wooden trail-sign panels** carrying the
create/join form and the camper picker.

The design intent: the fire, its smoke, and the puffy "CAMPFIRE" wordmark read as **one
continuous gesture** — smoke rises from the flame, pools into a haze, and the marshmallow
letters float inside that haze like an extension of the fire itself.

## About the Design Files
The files in this bundle are **design references created in HTML** — a working prototype of
the intended look and behavior, **not production code to paste in directly**. The task is to
**recreate this design inside the Campfire repo's existing environment** — the vanilla
`public/index.html` + `public/art.js` + `public/theme.css` structure (no build step, no
framework) — following its established patterns. Where this prototype uses a component
runtime (`support.js`) and the bound design-system bundle, the real repo should express the
same visuals with plain DOM/SVG/CSS the way `renderHome` and `art.js` already do.

Two representations are included:
- `campfire-title-screen.standalone.html` — a **single self-contained file** you can open in
  any browser (no server, no assets folder) to see the finished design, animations and all.
  Good for review and for lifting exact markup/CSS.
- `source/Title Screen v2.dc.html` — the authored source (design-component format). Reference
  it for structure; the standalone file is the easier read for raw CSS/SVG values.

## Fidelity
**High-fidelity (hifi).** Final colors, typography, spacing, motion, and SVG art. Recreate
pixel-for-pixel in the repo, mapping each piece onto `renderHome` / `art.js` / `theme.css`.

## Target integration points in the repo
- `public/index.html` → `renderHome()` — the screen markup + the create/join form and the new
  camper picker.
- `public/art.js` — the new SVG campfire (flame + burning logs + coals), the seating-log ring,
  the forest trees, and the critters belong here as drawing helpers.
- `public/theme.css` — new tokens (below) and the `@keyframes`.
- `assets/` — `night-sky.jpg` is **no longer used** by this screen; the sky is now drawn as
  inline SVG. The `fire-*.png` frames are also unused here (the fire is now vector).

---

## Screen: Title / Home

Fixed full-viewport stage, **1440×900 reference** (the SVG sky uses `viewBox="0 0 1440 900"`
with `preserveAspectRatio="xMidYMid slice"`, so it fills any aspect). Composited in stacked
`z-index` layers, back to front:

| z | Layer | Notes |
|---|-------|-------|
| 0 | Painted sky (inline SVG) | gradient, wind swirls, spiral stars, crescent moon, indigo ridgelines, teal meadow |
| 1 | Twinkling white sparks + shooting star | 12 CSS dots + 1 streak |
| 3 | Smoke: back **pool** behind title, and rising **column** from the fire + embers | |
| 4 | Title "CAMPFIRE" (arched, floating letters) + tagline | |
| 2 | Owl flying across sky (behind fire layer, above sky) | |
| 5 | Campfire SVG + seating-log ring + your seated camper | |
| 6 | Forest trees (4 per side, layered) + raccoon + bigfoot | |
| 7 | Forest vignette (radial darkening that wraps the campers) | |
| 10 | Two rustic wooden sign panels (form + camper picker) | |
| 30 | Toast (validation / next-step messages) | |

### Layout
- Root: `position: relative; width:100%; height:100%; min-height:760px; overflow:hidden; background:#14100d`.
- Title block: absolutely positioned, `left:50%; top:5.5%; transform:translateX(-50%)`, centered text.
- Fire group: `position:absolute; left:50%; bottom:36%; transform:translateX(-50%)`; a zero-size
  anchor — all logs and the flame are positioned relative to this origin point (the fire's base).
- Bottom sign panels: `position:absolute; left:50%; bottom:26px; transform:translateX(-50%)`,
  a flex row, `gap:34px`, `align-items:flex-end`.

### The painted sky (SVG, `viewBox 0 0 1440 900`)
- **Sky gradient** `#33261a` → `#292018` → `#1a1e28` (top→0.72). Warm brown up top cooling to indigo.
- **Wind swirls**: layered `<path>` strokes in `#6b93b0` / `#9cc0d8` / `#7fa7c4`, stroke-widths
  16/7/4, wrapped in a group that drifts ±14px (`@keyframes cf-drift`, 16s alternate). Group is
  nudged down `translate(0 78)` and set to `opacity:0.75`.
- **Spiral stars**: reusable `<g id="v2-star">` — concentric arc strokes (`#a8923c`, `#cbb84a`,
  `#e8d76a`) around a `#f2e9a0` core, with a faint `#e8d76a` halo. Seven placed at varying scale
  (0.7–1.55); each slowly rotates (`cf-spin` / `cf-spin-rev`, 90–140s).
- **Crescent moon**: `#e8d76a` disc + `#f2e9a0` inner, crescent cut via a `mask` (`#v2-mooncut`:
  white rect minus an offset black circle). Two rotating arc halos around it.
- **Ridgelines**: two stacked wavy `<path>` fills, `#3b4a78` then `#2c3a63`, with a couple of
  `#6f83b8` highlight strokes.
- **Teal meadow**: bottom band `url(#v2-ground)` = `#1c4a41`→`#143830`→`#0c221e`, over-brushed
  with short `#2a6b5c`/`#1f5c4e`/`#16493e`/`#123c33` grass strokes.

### Title "CAMPFIRE"
- 8 letters, each an `inline-block` in a flex row (`align-items:flex-start; gap:2px`).
- Font: `ui-rounded, 'SF Pro Rounded', 'Arial Rounded MT Bold', 'Hiragino Maru Gothic ProN',
  system-ui, sans-serif`; `font-weight:900; font-size:92px; letter-spacing:2px; color:#fbf7ec`.
- **Arch**: per-letter vertical offset `translateY` of `[46,20,5,0,0,5,20,46]px` and rotation
  `[-11,-8,-4,-1,1,4,8,11]deg` (outer letters dip and tilt down).
- **Float**: each letter has an inner span animating `cf-letter-float` (translateY 0→-9px),
  `4.6–6.7s` ease-in-out alternate, negative stagger delay `-(i*0.9)s` so they bob out of phase.
- **Marshmallow shadow** (the puffy look): layered text-shadow —
  `0 3px 0 rgba(216,208,189,.85), 0 -1px 0 rgba(255,255,255,.9), 0 8px 22px rgba(9,14,21,.65), 0 0 34px rgba(241,238,227,.28)`.
- Tagline: `margin-top:54px; font-size:17px; color:#d9d4c6`, with a dark text-shadow scrim.
  Copy: **"Round-robin stories around the fire. Write, pass, ruin, vote."**

### Smoke
- **Pool** (behind the title): four blurred radial-gradient ellipses in `rgba(158,168,177,·)`
  (alpha 0.5–0.68), `filter:blur(12–16px)`, each drifting via `cf-pool` (12–17s alternate).
- **Column** (from fire into pool): 8 puffs, `cf-smoke-rise` — start `scale(.5) opacity 0` at the
  fire, rise `-78vh` while drifting +24–46px and scaling to 2×, fading out. Sizes 38–64px,
  durations 8.5–11s, staggered 1.2s apart. Radial-gradient fill `rgba(172,182,190,·)`, `blur(2px)`.
- **Embers**: 5 small dots, `cf-ember-rise` (rise -340px, drift +26px, shrink, fade), colors
  `#f2a33c`/`#e25822`/`#f7d154`/`#e98f3e`, `box-shadow:0 0 6px 1px rgba(226,88,34,.8)`.

### Campfire (SVG, `viewBox 0 0 360 420`, rendered ~248px wide)
Hand-painted vector fire. Positioned `translate(-50%, -88%)` off the fire anchor so the burning
logs sit at the ring center. Key pieces:
- **Two crossed burning logs** (`rotate(-17°)` and `rotate(16°)`), `url(#cffLog)` linear gradient
  `#9a744a`→`#6d4c2c`→`#432c17`, with lighter end-grain ellipses `url(#cffEnd)` and a knot ring.
- **Coal bed** ellipse `url(#cffCoal)` (`#ffd06a`→`#ff6a1f`→transparent) pulsing `cff-coal` 2.6s.
- **Flame**: outer `url(#cffOuter)` (`#f28a2e`→`#e05617`→`#ad2c0d`→`#6f1607`), mid `url(#cffMid)`
  (`#ffd36a`→`#f7902b`→`#d5400f`), blurred core `url(#cffCore)` (`#fff6d8`→`#ffdd86`→transparent).
- **Two side tongues** in `cffMid`.
- **Painterly wobble**: `feTurbulence`+`feDisplacementMap` filters (`#cffPaint`, `#cffPaintSoft`)
  give the edges a watercolor waver; the whole flame sways (`cff-sway` 3.6s), flickers
  (`cff-flick` .62s), the core breathes (`cff-core` 1.1s), tongues lick (`cff-tongue` ~.7s).
- Behind it: a blurred dark "mound" radial (`rgba(7,15,13,·)`) so the fire nestles into shadow.

### Seating-log ring (for the camper mechanic)
Six logs arranged around the fire anchor — 3 "back" (behind flame) + 3 "front" (in front):
- backLogs (x,y,w,rot): `(0,-34,74,-3) (-152,-6,86,8) (152,-6,86,-8)`
- frontLogs: `(-104,32,94,-10) (104,32,94,10) (0,50,102,2)`
- Each log: rounded `<rect>` `#5f4630` with a lighter top half `#6d5238`, and an end-grain
  ellipse `#8a6d4a` + inner `#a98a63`. (These are the *seating* logs; the fire's own two logs
  are the *burning* ones.)

### The seated camper (appears after a pick)
When a camper is chosen, a small figure sits on the front-left seating log
(`left:-152px, top:-12px` off the anchor), holding a stick with a marshmallow over the fire:
- Name pill above: `rgba(18,26,38,.88)`, `1px` border `rgba(241,238,227,.16)`, `999px`,
  `backdrop-filter:blur(5px)`, `13px`. Shows the typed name, else "`<Camper> (you)`".
- Body: beanie-topped figure — body ellipse in the camper's color, hat brim + band in a darker
  shade, **face circle in the camper's own skin tone**, white pom, dot eyes, smile; a
  `#8a6d4a` stick to a marshmallow `#f7f2e6`/`#c9974f`.

### Camper picker (6 presets, with varied skin tones)
`id / name / color(hat/body) / dark(shade) / face(skin)`:
- `ember / Ember / #e98f3e / #b96a24 / #c98e5f`
- `moss / Moss / #7cc79a / #55976f / #8c5a3b`
- `wren / Wren / #7f96ad / #5c7288 / #f0d6b8`
- `maple / Maple / #e8705f / #b94f41 / #5e3a24`
- `marsh / Marsh / #f0c987 / #c9974f / #a9714b`
- `bark / Bark / #9a7a52 / #7a5a3a / #e9c8a0`

Rendered as a `repeat(6,1fr)` grid of buttons; each shows the beanie avatar (skin = `face`).
Unpicked border `rgba(46,29,15,.8)`; picked border `#e98f3e`; hover border `rgba(233,143,62,.75)`.
Selecting one seats that camper by the fire and shows "`<Name> is warming up by the fire ✓`".

### Forest
- **Trees**: pine silhouettes (zig-zag `<path>`). Four per side at increasing size and darkness
  toward the front — fills `#15222e` → `#101c28` → `#0c1620` → `#0a121c` — each swaying
  (`cf-sway`, 10–14s, alternate; right side alternate-reverse). Front-left and front-right trees
  are the largest (~235px / 215px) and host the critters.
- **Vignette** (replaces the old bottom gradient): a single full-bleed radial that darkens the
  edges and **wraps the campers in shadow** —
  `radial-gradient(ellipse 68% 64% at 50% 50%, rgba(4,8,10,0) 48%, rgba(4,8,10,.38) 74%, rgba(2,4,7,.85) 100%)`.

### Rustic sign panels (bottom)
Two hand-cut wooden **arrow-plank** signs on posts, each drawn as an SVG plank shape
(`#7a5334` / `#6e4a2e` fill, `#2e1d0f` 6px outline, faint `#93684a` inner highlight) with wood-grain
line strokes and knot ellipses; a single center post per sign (`#3c2a19`→`#5c3f28`→`#2e1f12`).
Slightly rotated (−0.8° / +0.9°) for a tacked-up feel. Labels/text use warm `#e6c9a3`.
- **Left plank (600px)** — the create/join form: `Your camper's name` input + **"Light a fire
  (create room)"** button, an `or` divider, `Join a fire with a room code` input (4 chars, uppercased)
  + **"Join room"** secondary button. Inputs/buttons are the design-system `Input`/`Button` components.
- **Right plank (360px, arrow points back toward the fire)** — the camper picker described above,
  headed **"Design your camper"** / "Pick one — they'll take a seat by the fire."

---

## Interactions & Behavior
- **Pick a camper** → seats that avatar on the front-left log; picker shows confirmation line;
  the seated figure uses the camper's skin tone and (if typed) the entered name on its pill.
- **Light a fire** → if name empty, toast "Every camper needs a name first!"; else toast
  "The fire is lit — the lobby is the next screen on the trail." (Wire to the real create-room
  flow / `renderLobby`.)
- **Join room** → if code empty, toast "You need a 4-letter room code to join."; else toast
  "Heading to that campsite — the lobby is the next screen on the trail."
- **Toast**: fixed top-center pill, `#e98f3e` on `#241405`, slides/fades (`translateY -14→0`,
  opacity 0→1, 0.3s), auto-dismiss after 2.6s.
- **Ambient critters** (always present, subtly animated):
  - *Raccoon* sits on a branch of the front-left tree, masked face + striped tail swishing
    (`cf-tail-swish` 2.6s).
  - *Owl* flies left→right across the sky every 44s (`cf-owl-fly`), wings flapping (`cf-owl-flap`).
  - *Bigfoot* peeks out from behind the front-right tree periodically (`cf-bigfoot-peek` 38s).
  - *Shooting star* streaks every 26s (`cf-star-shoot`).
- **Reduced motion**: all animations/transitions disabled under `prefers-reduced-motion: reduce`.

## State Management
- `name` (string) — camper name input.
- `code` (string) — room code input.
- `picked` (camper id | null) — selected avatar; drives the seated figure + confirmation.
- `toast` / `toastShown` — transient message + visibility (timeout-cleared).
- A `showCritters` flag toggles all ambient critters on/off (default on).

## Design Tokens
Existing Campfire tokens still apply (accent `#e98f3e`, ink `#f1eee3`, night base). **New values
introduced by this screen** (add to `theme.css` or keep inline):

**Sky / night**: `#14100d` (stage base) · `#33261a`/`#292018`/`#1a1e28` (sky gradient) ·
`#e8d76a`/`#f2e9a0`/`#cbb84a`/`#a8923c` (moon + star golds) · `#6b93b0`/`#9cc0d8`/`#7fa7c4`
(wind swirls) · `#3b4a78`/`#2c3a63`/`#6f83b8` (ridgelines) · `#1c4a41`/`#143830`/`#0c221e` +
`#2a6b5c`/`#1f5c4e`/`#16493e`/`#123c33` (teal meadow).
**Fire**: `#f28a2e #e05617 #ad2c0d #6f1607` (outer) · `#ffd36a #f7902b #d5400f` (mid) ·
`#fff6d8 #ffdd86` (core) · `#ffd06a #ff6a1f` (coals) · logs `#9a744a #6d4c2c #432c17`, end-grain
`#c69a63 #7d5731 #4a3119`.
**Seating logs**: `#5f4630 #6d5238 #8a6d4a #a98a63`.
**Forest**: `#15222e #101c28 #0c1620 #0a121c` (trees) · vignette `rgba(4,8,10,·)`/`rgba(2,4,7,.85)`.
**Signs**: `#7a5334`/`#6e4a2e` (plank) · `#2e1d0f` (outline) · `#3c2a19 #5c3f28 #2e1f12` (post) ·
`#e6c9a3`/`#f1e6d4` (sign text).
**Smoke**: `rgba(158,168,177,·)` (pool) · `rgba(172,182,190,·)` (column).
**Type**: title `ui-rounded / 'SF Pro Rounded' / 'Arial Rounded MT Bold'` 900, 92px; tagline 17px.
**Radius**: 14px signs, 10px avatar buttons, 999px pills. **Motion**: see each section's `@keyframes`.

## Assets
No raster assets required — the sky, fire, logs, trees, critters, and signs are **all inline SVG /
CSS**. (`night-sky.jpg` and `fire-*.png` from the repo are intentionally retired for this screen;
copies are included under `source/assets/` only for reference.) Fonts are system fonts — nothing to load.

## Files
- `campfire-title-screen.standalone.html` — self-contained finished design (open in a browser).
- `source/Title Screen v2.dc.html` — authored source of the same screen.
- `source/assets/fire-*.png` — the old raster fire frames (reference only; not used by this design).
