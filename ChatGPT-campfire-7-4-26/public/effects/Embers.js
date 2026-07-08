// =============================================================
// Campfire Engine v2
// Embers.js
//
// A thin stream of embers rising off the fire — colored from
// the fire's own palette (ArtworkMap.palette), so they can't
// clash with the painting. Garnish rules: few at a time, small,
// translucent, and gone before they'd draw attention.
// =============================================================

import { REDUCED_MOTION, organic } from "./Flicker.js";

const MAX_EMBERS = 14;
const SPAWN_PER_SEC = 2.2;

export default class Embers {

    constructor(map) {

        this.map = map;
        this.particles = [];
        this.spawnDebt = 0;
        this.time = Math.random() * 100;

    }

    //---------------------------------------------------------

    spawn() {

        const f = this.map.fire;
        // Born in the upper half of the flames, near the center line
        const jitter = (Math.random() - 0.5) * 0.035;
        this.particles.push({
            x: f.x + jitter,
            y: f.top + Math.random() * (f.base - f.top) * 0.45,
            life: 0,
            // A few seconds of drift, then gone
            ttl: 2.6 + Math.random() * 2.4,
            rise: 0.028 + Math.random() * 0.03,      // artwork-heights per second
            swayPhase: Math.random() * Math.PI * 2,
            swaySpeed: 0.6 + Math.random() * 0.9,
            size: 1.3 + Math.random() * 1.5,          // artwork pixels
            color: this.map.palette[(Math.random() * this.map.palette.length) | 0],
            // One in eight is a livelier "pop" spark
            spark: Math.random() < 0.125,
        });

    }

    //---------------------------------------------------------

    update(dt) {

        if (REDUCED_MOTION) return;

        this.time += dt;
        this.spawnDebt += dt * SPAWN_PER_SEC;

        while (this.spawnDebt > 1 && this.particles.length < MAX_EMBERS) {
            this.spawnDebt -= 1;
            this.spawn();
        }
        this.spawnDebt = Math.min(this.spawnDebt, 2);

        for (const p of this.particles) {
            p.life += dt;
            const speedup = p.spark ? 1.9 : 1;
            p.y -= p.rise * speedup * dt;
            p.x += organic(this.time, p.swaySpeed, p.swayPhase) * 0.006 * dt;
        }

        this.particles = this.particles.filter(p => p.life < p.ttl);

    }

    //---------------------------------------------------------

    draw(ctx, view) {

        if (REDUCED_MOTION || !this.particles.length) return;

        const img = this.map.image;

        ctx.save();
        ctx.globalCompositeOperation = "lighter";

        for (const p of this.particles) {

            const t = p.life / p.ttl;
            // Quick fade-in, long fade-out; never fully opaque
            const fade = t < 0.12 ? t / 0.12 : 1 - (t - 0.12) / 0.88;
            const alpha = fade * (p.spark ? 0.7 : 0.5);
            if (alpha < 0.02) continue;

            const x = view.x + p.x * img.width * view.scale;
            const y = view.y + p.y * img.height * view.scale;
            const r = Math.max(0.6, p.size * view.scale * (1 - t * 0.45));

            ctx.globalAlpha = alpha;
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.arc(x, y, r, 0, Math.PI * 2);
            ctx.fill();

        }

        ctx.restore();
        ctx.globalAlpha = 1;

    }

}
