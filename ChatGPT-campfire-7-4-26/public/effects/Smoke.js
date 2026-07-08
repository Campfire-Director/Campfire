// =============================================================
// Campfire Engine v2
// Smoke.js
//
// Life inside the painted smoke column. The artwork already
// draws the column's shape; these puffs travel along that
// exact painted path (ArtworkMap.smokePath), so the average
// image never changes — the eye just reads slow upward motion
// inside the shape the artist chose.
// =============================================================

import { REDUCED_MOTION, organic } from "./Flicker.js";

const PUFF_COUNT = 7;

export default class Smoke {

    constructor(map) {

        this.map = map;
        this.time = Math.random() * 100;

        // A soft round sprite, pre-rendered once
        this.sprite = document.createElement("canvas");
        this.sprite.width = this.sprite.height = 64;
        const g = this.sprite.getContext("2d");
        const grad = g.createRadialGradient(32, 32, 2, 32, 32, 32);
        grad.addColorStop(0, "rgba(214, 190, 168, 0.55)");
        grad.addColorStop(0.6, "rgba(190, 168, 150, 0.18)");
        grad.addColorStop(1, "rgba(180, 160, 145, 0)");
        g.fillStyle = grad;
        g.fillRect(0, 0, 64, 64);

        // Puffs are spread evenly along the column and loop
        this.puffs = [];
        for (let i = 0; i < PUFF_COUNT; i++) {
            this.puffs.push({
                t: i / PUFF_COUNT,                 // 0 = at the fire, 1 = column top
                speed: 0.045 + Math.random() * 0.02, // full trips per second... per ~20s
                wobblePhase: Math.random() * Math.PI * 2,
                scale: 0.8 + Math.random() * 0.5,
            });
        }

    }

    //---------------------------------------------------------

    pathPoint(t) {

        const path = this.map.smokePath;
        // Defensive clamp: a stray t outside [0,1] must never
        // index outside the path
        const f = Math.min(1, Math.max(0, t)) * (path.length - 1);
        const i = Math.min(path.length - 2, Math.floor(f));
        const frac = f - i;
        return {
            x: path[i].x + (path[i + 1].x - path[i].x) * frac,
            y: path[i].y + (path[i + 1].y - path[i].y) * frac,
        };

    }

    //---------------------------------------------------------

    update(dt) {

        if (REDUCED_MOTION) return;

        this.time += dt;

        for (const p of this.puffs) {
            p.t += p.speed * dt;
            if (p.t > 1) p.t -= 1;
            if (p.t < 0) p.t += 1;
        }

    }

    //---------------------------------------------------------

    draw(ctx, view) {

        if (REDUCED_MOTION) return;

        const img = this.map.image;

        ctx.save();
        ctx.globalCompositeOperation = "lighter";

        for (const p of this.puffs) {

            const pt = this.pathPoint(p.t);
            // Ends of the trip fade so the loop never pops
            const edge = Math.min(p.t / 0.18, (1 - p.t) / 0.18, 1);
            const alpha = 0.085 * edge;
            if (alpha < 0.008) continue;

            const wobble = organic(this.time, 0.4, p.wobblePhase) * 0.008;
            const x = view.x + (pt.x + wobble) * img.width * view.scale;
            const y = view.y + pt.y * img.height * view.scale;
            // Puffs swell as they climb
            const size = (16 + p.t * 30) * p.scale * view.scale;

            ctx.globalAlpha = alpha;
            ctx.drawImage(this.sprite, x - size / 2, y - size / 2, size, size);

        }

        ctx.restore();
        ctx.globalAlpha = 1;

    }

}
