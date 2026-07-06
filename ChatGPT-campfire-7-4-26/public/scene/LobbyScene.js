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

export default class LobbyScene extends Scene {

    constructor(renderer) {

        super(renderer);

        this.camera = new Camera();

        this.environment =
            Assets.get("environment");

    }

    //---------------------------------------------------------

    update(dt) {

        this.camera.update(dt);

    }

    //---------------------------------------------------------

    draw(ctx) {

        // The artwork draws in SCREEN space, untouched by the camera —
        // per the design doc: "Background should draw directly to screen
        // coordinates. NOT world coordinates." The camera transform is
        // reserved for future world-space layers (avatars, particles
        // that live "in" the scene).
        this.drawEnvironment(ctx);

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
            return;

        // CONTAIN fit: the whole painting is always visible, centered,
        // aspect ratio preserved — no stretching, no cropping.
        //
        // Why contain and not cover: this artwork is portrait (1122x1402)
        // and composed edge to edge — the painted CAMPFIRE title lives in
        // the top quarter and the fire + seating (the future avatar
        // spots) sit 60–90% down. Cover-fit on any landscape screen
        // must crop more than half of that height away, which is exactly
        // the "only the center shows" bug: the visible band was the dark
        // forest BETWEEN the title and the fire. Contain letterboxes into
        // the renderer's night color instead, so every design-critical
        // element stays on screen at every window size.
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

        ctx.drawImage(
            image,
            x,
            y,
            drawWidth,
            drawHeight
        );

    }

}