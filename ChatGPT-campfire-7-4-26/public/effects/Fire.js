// =============================================================
// Campfire Engine v2
// Fire.js
//
// The painted flames, breathing. This draws the fire's OWN
// pixels (extracted into ArtworkMap.fireMask) back over the
// painting additively, with an organic flicker on the alpha.
// The flame the artist painted brightens and settles — nothing
// foreign is drawn on top of it.
//
// The title gets the same treatment at a fraction of the
// energy: a slow toasted-marshmallow glow.
// =============================================================

import { REDUCED_MOTION, fireFlicker, organic } from "./Flicker.js";

export default class Fire {

    constructor(map) {

        this.map = map;
        this.time = Math.random() * 100;

    }

    //---------------------------------------------------------

    update(dt) {

        this.time += dt;

    }

    //---------------------------------------------------------

    draw(ctx, view) {

        const cache = this.map.scaled(view.scale);

        ctx.save();
        ctx.globalCompositeOperation = "lighter";

        // The fire: a lively but bounded shimmer. Even at its
        // peak it adds only a fraction of the painted values.
        const flame = REDUCED_MOTION ? 0.5 : fireFlicker(this.time, 0);
        this.drawMask(ctx, view, cache.fire, 0.05 + flame * 0.12);

        // The title: barely-there breathing, ~7 second period
        const breathe = REDUCED_MOTION ? 0 : organic(this.time, 0.14, 2.0);
        this.drawMask(ctx, view, cache.title, 0.04 + (breathe * 0.5 + 0.5) * 0.05);

        ctx.restore();
        ctx.globalAlpha = 1;

    }

    //---------------------------------------------------------

    drawMask(ctx, view, mask, alpha) {

        if (!mask.canvas || alpha < 0.01) return;
        ctx.globalAlpha = alpha;
        // pre-scaled: a straight 1:1 blit
        ctx.drawImage(mask.canvas, view.x + mask.x, view.y + mask.y);

    }

}
