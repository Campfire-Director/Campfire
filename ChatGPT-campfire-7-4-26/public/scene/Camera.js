// =============================================================
// Campfire Engine v2
// Camera.js
//
// A lightweight camera used by LobbyScene.
// Handles subtle breathing motion, zoom, and positioning.
//
// Future:
// - Screen shake
// - Smooth panning
// - Focus targets
// =============================================================

export default class Camera {

    constructor() {

        // Time accumulator
        this.time = 0;

        // Position offset (pixels)
        this.x = 0;
        this.y = 0;

        // Base zoom
        this.zoom = 1.12;

        // Breathing controls
        this.breathAmplitude = 4;     // pixels
        this.breathSpeed = 0.18;      // cycles/sec

    }

    //---------------------------------------------------------
    // Called every frame
    //---------------------------------------------------------

    update(dt) {

        this.time += dt;

        // Gentle vertical breathing motion
        this.y =
            Math.sin(
                this.time *
                Math.PI *
                2 *
                this.breathSpeed
            ) * this.breathAmplitude;

    }

    //---------------------------------------------------------
    // Apply camera transform
    //---------------------------------------------------------

    begin(ctx, width, height) {

        ctx.save();

        ctx.translate(
            width * 0.5,
            height * 0.5
        );

        ctx.scale(
            this.zoom,
            this.zoom
        );

        ctx.translate(
            -width * 0.5 + this.x,
            -height * 0.5 + this.y
        );

    }

    //---------------------------------------------------------
    // Restore canvas
    //---------------------------------------------------------

    end(ctx) {

        ctx.restore();

    }

}