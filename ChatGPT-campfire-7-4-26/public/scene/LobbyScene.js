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

        const x = (this.width - drawWidth) * 0.5;
        const y = (this.height - drawHeight) * 0.5;

        ctx.drawImage(
            image,
            x,
            y,
            drawWidth,
            drawHeight
        );

    }

}