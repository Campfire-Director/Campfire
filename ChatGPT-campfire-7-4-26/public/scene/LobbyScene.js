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

        this.camera.begin(
            ctx,
            this.width,
            this.height
        );

        this.drawEnvironment(ctx);

        this.camera.end(ctx);

    }

    //---------------------------------------------------------

    drawEnvironment(ctx) {

        const image = this.environment;

        if (!image)
            return;

        const canvasRatio =
            this.width / this.height;

        const imageRatio =
            image.width / image.height;

        let drawWidth;
        let drawHeight;

        if (imageRatio > canvasRatio) {

            drawHeight = this.height;
            drawWidth = drawHeight * imageRatio;

        } else {

            drawWidth = this.width;
            drawHeight = drawWidth / imageRatio;

        }

        // Slight zoom so artwork fills the screen naturally
        drawWidth *= 1.08;
        drawHeight *= 1.08;

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