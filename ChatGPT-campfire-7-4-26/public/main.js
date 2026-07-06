// ======================================================
// Campfire Engine v2
// main.js
// Engine bootstrap
// ======================================================

import Assets from "./scene/Assets.js";
import Renderer from "./scene/Renderer.js";
import LobbyScene from "./scene/LobbyScene.js";

class CampfireApp {
    constructor() {
        this.canvas = null;
        this.renderer = null;
        this.scene = null;
    }

    async start() {

        // Locate canvas
        this.canvas = document.getElementById("scene");

        if (!this.canvas) {
            throw new Error(
                "Unable to find canvas with id 'scene'."
            );
        }

        // Load all engine assets
        await Assets.load();

        // Create renderer
        this.renderer = new Renderer(this.canvas);

        // Create scene
        this.scene = new LobbyScene(this.renderer);

        // Give renderer the active scene
        this.renderer.setScene(this.scene);

        // Begin rendering
        this.renderer.start();

        console.log("🔥 Campfire Engine Started");
    }
}

window.addEventListener("DOMContentLoaded", async () => {

    try {

        const app = new CampfireApp();

        await app.start();

        window.Campfire = app;

    }
    catch (err) {

        console.error(err);

    }

});