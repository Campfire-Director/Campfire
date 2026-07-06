// =============================================================
// Campfire Engine v2
// Assets.js
//
// Central asset manager.
// Loads and caches every image used by the engine.
//
// Future support:
// - Audio
// - Avatar sprites
// - Seasonal themes
// =============================================================

class Assets {

    constructor() {

        this.images = new Map();

        this.loaded = false;

    }

    //------------------------------------------------------------

    async load() {

        if (this.loaded)
            return;

        console.log("Loading Campfire assets...");

        await Promise.all([

            this.loadImage(
                "environment",
                "images/lobby-scene.webp"
            )

        ]);

        this.loaded = true;

        console.log("✓ Assets Loaded");

    }

    //------------------------------------------------------------

    loadImage(name, path) {

        return new Promise((resolve, reject) => {

            const image = new Image();

            image.onload = () => {

                this.images.set(name, image);

                console.log(
                    `✓ ${name}`
                );

                resolve(image);

            };

            image.onerror = () => {

                reject(
                    new Error(
                        `Unable to load ${path}`
                    )
                );

            };

            image.src = path;

        });

    }

    //------------------------------------------------------------

    get(name) {

        if (!this.images.has(name)) {

            throw new Error(

                `Asset "${name}" does not exist.`

            );

        }

        return this.images.get(name);

    }

    //------------------------------------------------------------

    has(name) {

        return this.images.has(name);

    }

}

export default new Assets();