// =============================================================
// Campfire Engine v2
// LobbyScene.js
//
// Main title screen.
// Draws the artwork and controls the camera.
// Future visual effects (embers, smoke, firelight)
// will be layered on top of the artwork.
//
// =============================================================

import Scene from "./Scene.js";
import Assets from "./Assets.js";
import Camera from "./Camera.js";
import ArtworkMap from "../effects/ArtworkMap.js";
import Firelight from "../effects/Firelight.js";
import Fire from "../effects/Fire.js";
import Smoke from "../effects/Smoke.js";
import Embers from "../effects/Embers.js";
import Stars from "../effects/Stars.js";

export default class LobbyScene extends Scene {

    constructor(renderer) {

        super(renderer);

        this.camera = new Camera();

        this.environment =
            Assets.get("environment");

        // One analysis pass over the painting's pixels feeds
        // every living-painting effect (see ArtworkMap.js)
        this.map = new ArtworkMap(this.environment);

        // Draw order, back to front:
        // ground glow → breathing fire/title → smoke → embers → stars
        this.effects = [
            new Firelight(this.map),
            new Fire(this.map),
            new Smoke(this.map),
            new Embers(this.map),
            new Stars(this.map),
        ];

    }

    //---------------------------------------------------------

    update(dt) {

        this.camera.update(dt);

        for (const fx of this.effects)
            fx.update(dt);

    }

    //---------------------------------------------------------

    draw(ctx) {

        // The artwork draws in SCREEN space, untouched by the camera —
        // per the design doc: "Background should draw directly to screen
        // coordinates. NOT world coordinates." The camera transform is
        // reserved for future world-space layers (avatars, particles
        // that live "in" the scene).
        const view = this.drawEnvironment(ctx);

        // The living-painting layers share the artwork's exact
        // placement, so they stay pixel-registered with the painting
        // at every window size
        if (view) {
            for (const fx of this.effects)
                fx.draw(ctx, view);
        }

        this.camera.begin(
            ctx,
            this.width,
            this.height
        );

        // (future world-space layers draw here)

        this.camera.end(ctx);

    }

    //---------------------------------------------------------

    drawEnvironment(ctx) {

        const image = this.environment;

        if (!image)
            return null;

        // CONTAIN fit: the whole painting is always visible, centered,
        // aspect ratio preserved — no stretching, no cropping. The
        // composition uses the full canvas (title in the sky, fire and
        // seating below), so cropping would always cut something the
        // design says must stay visible. The letterbox blends into the
        // renderer's night color, which matches the artwork's edges.
        //
        // (If a crop-to-fill look is ever wanted, swap Math.min for
        // Math.max below — that single change flips contain into cover.)
        const scale = Math.min(
            this.width / image.width,
            this.height / image.height
        );

        const drawWidth = image.width * scale;
        const drawHeight = image.height * scale;

        const x =
            (this.width - drawWidth) / 2;

        const y =
            (this.height - drawHeight) / 2;

        // Blit the pre-scaled copy (rebuilt only when the window
        // scale changes) — scaling a 1.5-megapixel painting every
        // frame is the single most expensive thing a software
        // rasterizer can be asked to do.
        ctx.drawImage(
            this.map.scaled(scale).art,
            x,
            y
        );

        // The view rect: where the artwork landed on screen this
        // frame. Effects use it to stay registered with the painting.
        return { x, y, scale };

    }

}