// =============================================================
// Campfire Engine v2
// LobbyScene.js
//
// The title screen scene.
//
// Responsibilities:
// - Own the environment artwork
// - Own the camera
// - (Later) Own visual effects
// =============================================================

import Stars from "../effects/Stars.js";
import Scene from "./Scene.js";
import Assets from "./Assets.js";
import Camera from "./Camera.js";

export default class LobbyScene extends Scene {

    constructor(renderer) {

        super(renderer);

        this.stars = new Stars();
        
        this.camera = new Camera();

        this.environment = Assets.get("environment");

    }

    //---------------------------------------------------------

    update(dt) {

        this.camera.update(dt);

        this.stars.update(dt);

    }

    //---------------------------------------------------------

    draw(ctx) {

        this.camera.begin(
            ctx,
            this.width,
            this.height
        );

        this.drawEnvironment(ctx);

        this.stars.draw(
         ctx,
          this.width,
            this.height
        );

        this.camera.end(ctx);

    }

    //---------------------------------------------------------

    drawEnvironment(ctx) {

        const image = this.environment;

        const canvasRatio =
            this.width / this.height;

        const imageRatio =
            image.width / image.height;

        let drawWidth;
        let drawHeight;

        if (imageRatio > canvasRatio) {

            drawHeight = this.height;
            drawWidth = drawHeight * imageRatio;

        }
        else {

            drawWidth = this.width;
            drawHeight = drawWidth / imageRatio;

        }

        // Artistic framing
        drawWidth *= this.camera.zoom;
        drawHeight *= this.camera.zoom;

        const x =
            (this.width - drawWidth) * 0.5;

        const y =
            (this.height - drawHeight) * 0.5 - 120;

        ctx.drawImage(
            image,
            x,
            y,
            drawWidth,
            drawHeight
        );

    }

}