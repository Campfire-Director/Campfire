// =============================================================
// Campfire Engine v2
// LobbyScene.js
//
// Renders the Campfire environment.
// =============================================================

import Scene from "./Scene.js";
import Assets from "./Assets.js";

export default class LobbyScene extends Scene {

    constructor(renderer) {

        super(renderer);

        this.environment = Assets.get("environment");

    }

    update(dt) {

        // Nothing yet.

    }

    draw(ctx) {

    const image = this.environment;

    // -------- Camera Settings --------

    // We'll tweak these over time.
    const zoom = 1.12;
    const verticalOffset = 120;

    //----------------------------------

    const canvasRatio = this.width / this.height;
    const imageRatio = image.width / image.height;

    let drawWidth;
    let drawHeight;

    if (imageRatio > canvasRatio) {

        drawHeight = this.height;
        drawWidth = drawHeight * imageRatio;

    } else {

        drawWidth = this.width;
        drawHeight = drawWidth / imageRatio;

    }

    // Apply cinematic zoom
    drawWidth *= zoom;
    drawHeight *= zoom;

    const x = (this.width - drawWidth) / 2;

    // Shift artwork upward so the fire sits lower
    const y =
        (this.height - drawHeight) / 2
        - verticalOffset;

    ctx.drawImage(
        image,
        x,
        y,
        drawWidth,
        drawHeight
    );

}