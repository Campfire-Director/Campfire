// =============================================================
// Campfire Engine v2
// Stars.js
//
// The painted stars, twinkling. Instead of scattering foreign
// dots over the artwork (the old approach), this finds every
// star the artist actually painted (ArtworkMap.sparkles) and
// re-draws each one's own pixels additively on an independent
// clock. The sky twinkles exactly where the painting says
// stars are — and the moon shimmers slowest of all.
// =============================================================

import { REDUCED_MOTION, organic } from "./Flicker.js";

export default class Stars {

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

        if (REDUCED_MOTION) return; // the painted stars remain, still

        const cache = this.map.scaled(view.scale);

        ctx.save();
        ctx.globalCompositeOperation = "lighter";

        for (const s of this.map.sparkles) {

            // Each star brightens above its painted baseline and
            // relaxes back — it never darkens, so the painting is
            // always intact underneath.
            const tw = organic(this.time, s.speed, s.phase) * 0.5 + 0.5;
            const strength = s.isMoon ? 0.10 : 0.22;
            const alpha = tw * tw * strength;
            if (alpha < 0.015) continue;

            ctx.globalAlpha = alpha;
            // source and destination both in view scale — 1:1 blit
            const dx = s.sx * view.scale, dy = s.sy * view.scale;
            const dw = s.sw * view.scale, dh = s.sh * view.scale;
            ctx.drawImage(
                cache.art,
                dx, dy, dw, dh,
                view.x + dx, view.y + dy, dw, dh
            );

        }

        ctx.restore();
        ctx.globalAlpha = 1;

    }

}
