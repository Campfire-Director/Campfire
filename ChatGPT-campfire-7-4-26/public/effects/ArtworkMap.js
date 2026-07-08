// =============================================================
// Campfire Engine v2
// ArtworkMap.js
//
// One-time analysis of the title artwork, run at scene load.
// Everything the living-painting effects need is derived from
// the painting's own pixels, so the effects stay true to the
// art by construction — and adapt automatically if the artwork
// is ever repainted.
//
// Produces:
//   fireMask     — canvas holding only the fire's bright pixels
//   titleMask    — canvas holding the marshmallow title's pixels
//   sparkles     — each painted star / the moon, as source rects
//   fire         — { x, top, base } fire anatomy (normalized)
//   smokePath    — points along the painted smoke column (normalized)
//   palette      — the fire's own dominant colors, for particles
//
// The expensive getImageData pass happens exactly once. Per
// frame, effects only ever drawImage from the prebuilt masks.
// =============================================================

export default class ArtworkMap {

    constructor(image) {

        this.image = image;

        const w = image.width;
        const h = image.height;

        // Read the artwork's pixels once
        const src = document.createElement("canvas");
        src.width = w;
        src.height = h;
        const sctx = src.getContext("2d", { willReadFrequently: true });
        sctx.drawImage(image, 0, 0);
        const data = sctx.getImageData(0, 0, w, h).data;

        const at = (x, y) => {
            const i = (y * w + x) * 4;
            return [data[i], data[i + 1], data[i + 2]];
        };

        this.buildFireAnatomy(at, w, h);
        this.buildMasks(data, w, h);
        this.buildSparkles(at, w, h);
        this.buildSmokePath(at, w, h);
        this.buildPalette(at, w, h);

    }

    //---------------------------------------------------------
    // Fire anatomy: the brightest warm cluster low in the frame
    //---------------------------------------------------------

    buildFireAnatomy(at, w, h) {

        let sx = 0, n = 0, top = h, base = 0;

        for (let y = Math.floor(h * 0.45); y < h; y += 2) {
            for (let x = Math.floor(w * 0.25); x < w * 0.75; x += 2) {
                const [r, g, b] = at(x, y);
                if (r > 230 && g > 140 && b < 120) {
                    sx += x; n++;
                    if (y < top) top = y;
                    if (y > base) base = y;
                }
            }
        }

        this.fire = n
            ? { x: (sx / n) / w, top: top / h, base: base / h }
            : { x: 0.5, top: 0.55, base: 0.9 };

    }

    //---------------------------------------------------------
    // Masks: the fire's own pixels, and the title's own pixels,
    // copied onto transparent canvases. Drawing these back over
    // the painting with 'lighter' + a breathing alpha makes the
    // painted light sources glow without touching the art.
    //---------------------------------------------------------

    buildMasks(data, w, h) {

        // Masks are cropped to their content's bounding box, so the
        // per-frame drawImage only touches the pixels that matter
        // (the full canvas would be ~90% transparent waste).
        const makeMask = (test) => {
            let minX = w, maxX = 0, minY = h, maxY = 0;
            const alphas = new Uint8Array(w * h);
            for (let y = 0; y < h; y++) {
                for (let x = 0; x < w; x++) {
                    const i = (y * w + x) * 4;
                    const a = test(data[i], data[i + 1], data[i + 2], x, y);
                    if (a > 0) {
                        alphas[y * w + x] = a;
                        if (x < minX) minX = x;
                        if (x > maxX) maxX = x;
                        if (y < minY) minY = y;
                        if (y > maxY) maxY = y;
                    }
                }
            }
            if (maxX < minX) return { canvas: null, x: 0, y: 0 };
            const bw = maxX - minX + 1;
            const bh = maxY - minY + 1;
            const c = document.createElement("canvas");
            c.width = bw;
            c.height = bh;
            const ctx = c.getContext("2d");
            const out = ctx.createImageData(bw, bh);
            for (let y = 0; y < bh; y++) {
                for (let x = 0; x < bw; x++) {
                    const a = alphas[(y + minY) * w + (x + minX)];
                    if (!a) continue;
                    const si = ((y + minY) * w + (x + minX)) * 4;
                    const di = (y * bw + x) * 4;
                    out.data[di] = data[si];
                    out.data[di + 1] = data[si + 1];
                    out.data[di + 2] = data[si + 2];
                    out.data[di + 3] = a;
                }
            }
            ctx.putImageData(out, 0, 0);
            return { canvas: c, x: minX, y: minY };
        };

        const fireTopY = this.fire.top * h * 0.94;

        // The fire and its glow on the ground: warm AND bright,
        // in the lower half. Alpha follows brightness so the
        // mask's edges feather naturally into the painting.
        this.fireMask = makeMask((r, g, b, x, y) => {
            if (y < fireTopY) return 0;
            const warm = r - b;
            if (r > 180 && warm > 60 && g > 80) {
                return Math.min(255, (r - 160) * 2.2);
            }
            return 0;
        });

        // The marshmallow title: bright AND desaturated-cream,
        // upper-middle band only.
        this.titleMask = makeMask((r, g, b, x, y) => {
            if (y < h * 0.06 || y > h * 0.42) return 0;
            if (r > 195 && g > 180 && b > 145) {
                return Math.min(255, (r - 170) * 2);
            }
            return 0;
        });

    }

    //---------------------------------------------------------
    // Sparkles: every painted star (and the moon) found as a
    // connected component of bright sky pixels. Each one gets
    // its own source rect in the artwork so it can twinkle on
    // its own clock.
    //---------------------------------------------------------

    buildSparkles(at, w, h, skyBottom = 0.4) {

        // Work at quarter resolution — plenty for star blobs
        const step = 4;
        const gw = Math.ceil(w / step);
        const gh = Math.ceil((h * skyBottom) / step);

        const bright = new Uint8Array(gw * gh);
        for (let gy = 0; gy < gh; gy++) {
            for (let gx = 0; gx < gw; gx++) {
                const [r, g, b] = at(gx * step, gy * step);
                // painted stars are golden-bright on deep blue
                if (r + g + b > 470 && r > 150) bright[gy * gw + gx] = 1;
            }
        }

        // Flood-fill connected components
        const seen = new Uint8Array(gw * gh);
        const sparkles = [];
        const stack = [];

        for (let i = 0; i < bright.length; i++) {
            if (!bright[i] || seen[i]) continue;
            let minX = gw, maxX = 0, minY = gh, maxY = 0, count = 0;
            stack.push(i);
            seen[i] = 1;
            while (stack.length) {
                const j = stack.pop();
                const jx = j % gw, jy = (j / gw) | 0;
                count++;
                if (jx < minX) minX = jx;
                if (jx > maxX) maxX = jx;
                if (jy < minY) minY = jy;
                if (jy > maxY) maxY = jy;
                const nbrs = [j - 1, j + 1, j - gw, j + gw];
                for (const k of nbrs) {
                    if (k >= 0 && k < bright.length && bright[k] && !seen[k]) {
                        seen[k] = 1;
                        stack.push(k);
                    }
                }
            }
            if (count < 2) continue; // single-pixel noise
            // pad the box a little so the star's halo comes along
            const pad = 2;
            sparkles.push({
                sx: Math.max(0, (minX - pad) * step),
                sy: Math.max(0, (minY - pad) * step),
                sw: Math.min(w, (maxX - minX + 1 + pad * 2) * step),
                sh: Math.min(h * skyBottom, (maxY - minY + 1 + pad * 2) * step),
                size: count,
                phase: Math.random() * Math.PI * 2,
                speed: 0.25 + Math.random() * 0.5,
            });
        }

        // The moon is the biggest component — give it the slowest,
        // gentlest shimmer of all
        sparkles.sort((a, b) => b.size - a.size);
        if (sparkles.length) {
            sparkles[0].isMoon = true;
            sparkles[0].speed = 0.1;
        }

        this.sparkles = sparkles;

        // A source canvas the sparkles can be drawn FROM (the
        // artwork itself — drawing a star's own rect additively
        // brightens exactly that star)
        this.sourceImage = this.image;

    }

    //---------------------------------------------------------
    // The painted smoke column: per-row centroid of warm,
    // mid-brightness pixels in a corridor above the fire.
    //---------------------------------------------------------

    buildSmokePath(at, w, h) {

        const fx = this.fire.x * w;
        const path = [];

        for (let y = Math.floor(h * 0.16); y < this.fire.top * h; y += Math.floor(h / 60)) {
            let sx = 0, n = 0;
            for (let x = Math.max(0, fx - 160); x < Math.min(w, fx + 160); x += 2) {
                const [r, g, b] = at(Math.floor(x), y);
                const lum = (r + g + b) / 3;
                if (lum > 85 && lum < 225 && r - b > 25) { sx += x; n++; }
            }
            if (n > 4) path.push({ x: (sx / n) / w, y: y / h });
        }

        // Fallback: straight up from the fire
        if (path.length < 3) {
            path.length = 0;
            for (let t = 0; t <= 1; t += 0.1) {
                path.push({ x: this.fire.x, y: 0.18 + t * (this.fire.top - 0.18) });
            }
        }

        // Top of column first → sort by y ascending, then reverse
        // so index 0 is at the fire (where puffs are born)
        path.sort((a, b) => b.y - a.y);
        this.smokePath = path;

    }

    //---------------------------------------------------------
    // The fire's own palette, for embers and sparks
    //---------------------------------------------------------

    buildPalette(at, w, h) {

        const seen = new Map();
        const y0 = Math.floor(this.fire.top * h);
        const y1 = Math.floor(this.fire.base * h);
        const fx = Math.floor(this.fire.x * w);

        for (let y = y0; y < y1; y += 3) {
            for (let x = fx - 90; x < fx + 90; x += 3) {
                const [r, g, b] = at(Math.max(0, Math.min(w - 1, x)), y);
                if (r > 220 && g > 120 && b < 130) {
                    const key = `${r >> 4},${g >> 4},${b >> 4}`;
                    seen.set(key, (seen.get(key) || 0) + 1);
                }
            }
        }

        const top = [...seen.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);

        this.palette = top.length
            ? top.map(([k]) => {
                const [r, g, b] = k.split(",").map(v => (v << 4) + 8);
                return `rgb(${r},${g},${b})`;
            })
            : ["#ffc445", "#eb9614", "#f3da44"];

    }


    //---------------------------------------------------------
    // View-scale cache: masks (and the artwork, for sparkle
    // sources) pre-scaled to the current on-screen size, rebuilt
    // only when the window scale changes. Per-frame drawing then
    // blits 1:1 — dramatically cheaper than scaling every frame,
    // especially on software rasterizers.
    //---------------------------------------------------------

    scaled(scale) {

        const key = Math.round(scale * 1000);
        if (this._scaledKey === key) return this._scaled;

        const make = (source) => {
            if (!source) return null;
            const c = document.createElement("canvas");
            c.width = Math.max(1, Math.round(source.width * scale));
            c.height = Math.max(1, Math.round(source.height * scale));
            const ctx = c.getContext("2d");
            ctx.drawImage(source, 0, 0, c.width, c.height);
            return c;
        };

        this._scaledKey = key;
        this._scaled = {
            art: make(this.image),
            fire: this.fireMask.canvas ? {
                canvas: make(this.fireMask.canvas),
                x: this.fireMask.x * scale,
                y: this.fireMask.y * scale,
            } : { canvas: null },
            title: this.titleMask.canvas ? {
                canvas: make(this.titleMask.canvas),
                x: this.titleMask.x * scale,
                y: this.titleMask.y * scale,
            } : { canvas: null },
        };
        return this._scaled;

    }

}
