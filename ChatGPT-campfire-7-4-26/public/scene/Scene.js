// =============================================================
// Campfire Engine v2
// Scene.js
//
// Base class for every scene in the engine.
// =============================================================

export default class Scene {

    constructor(renderer) {

        this.renderer = renderer;

        this.width = renderer.width;
        this.height = renderer.height;

    }

    //---------------------------------------------------------
    // Called whenever the browser window changes size.
    //---------------------------------------------------------

    resize(width, height) {

        this.width = width;
        this.height = height;

    }

    //---------------------------------------------------------
    // Called every frame.
    //---------------------------------------------------------

    update(dt) {

        // Override in child classes.

    }

    //---------------------------------------------------------
    // Draw the scene.
    //---------------------------------------------------------

    draw(ctx) {

        // Override in child classes.

    }

    //---------------------------------------------------------
    // Cleanup (future use)
    //---------------------------------------------------------

    destroy() {

        // Override if needed.

    }

}