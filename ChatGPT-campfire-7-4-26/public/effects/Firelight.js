// =============================================================
// Campfire Engine v2
// Firelight.js
//
// The fire's breath on the clearing: a soft radial warmth
// centered on the fire pit that swells and settles with the
// flames. Deliberately faint — it should read as the ground
// catching the light, never as a spotlight.
// =============================================================

import { REDUCED_MOTION, fireFlicker } from "./Flicker.js";

export default class Firelight {

    constructor(map) {

        this.map = map;
        this.time = Math.random() * 100;

        // The gradient is rebuilt only when the view changes size
        this.cachedKey = "";
        this.gradient = null;

    }

    //---------------------------------------------------------

    update(dt) {

        this.time += dt;

    }

    //---------------------------------------------------------

    draw(ctx, view) {

        const img = this.map.image;
        const fx = view.x + this.map.fire.x * img.width * view.scale;
        const fy = view.y + (this.map.fire.base * 0.94) * img.height * view.scale;
        const radius = img.width * view.scale * 0.34;

        const key = `${radius | 0}`;
        if (key !== this.cachedKey) {
            this.cachedKey = key;
            this.gradient = ctx.createRadialGradient(0, 0, radius * 0.05, 0, 0, radius);
            this.gradient.addColorStop(0, "rgba(255, 168, 64, 0.30)");
            this.gradient.addColorStop(0.45, "rgba(224, 112, 32, 0.12)");
            this.gradient.addColorStop(1, "rgba(160, 64, 16, 0)");
        }

        // Base warmth always present; the flicker rides on top
        const breathe = REDUCED_MOTION ? 0.5 : fireFlicker(this.time, 0.7);
        const alpha = 0.06 + breathe * 0.08;

        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        ctx.globalAlpha = alpha;
        ctx.translate(fx, fy);
        // The clearing is seen at an angle — squash the glow into
        // a ground-hugging ellipse
        ctx.scale(1, 0.55);
        ctx.fillStyle = this.gradient;
        ctx.fillRect(-radius, -radius, radius * 2, radius * 2);
        ctx.restore();
        ctx.globalAlpha = 1;

    }

}
