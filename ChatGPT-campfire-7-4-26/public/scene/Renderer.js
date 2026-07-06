// =============================================================
// Campfire Engine v2
// Renderer.js
//
// Owns the render loop.
// Owns the canvas.
// Calls update() and draw() on the active scene.
//
// Nothing else.
// =============================================================

export default class Renderer {

    constructor(canvas) {

        if (!canvas)
            throw new Error("Renderer requires a canvas.");

        this.canvas = canvas;

        this.ctx = canvas.getContext("2d", {
            alpha: false,
            desynchronized: true
        });

        this.width = 0;
        this.height = 0;
        this.pixelRatio = 1;

        this.scene = null;

        this.running = false;

        this.lastFrame = performance.now();

        this.deltaTime = 0;

        this.fps = 0;

        this.frameCounter = 0;
        this.fpsTimer = 0;

        this.debug = false;

        this.loop = this.loop.bind(this);

        this.resize = this.resize.bind(this);

        window.addEventListener(
            "resize",
            this.resize
        );

        window.addEventListener("keydown", e => {

            if (e.key === "F1") {

                e.preventDefault();

                this.debug = !this.debug;

                console.log(
                    `Debug ${this.debug ? "Enabled" : "Disabled"}`
                );

            }

        });

        this.resize();

    }

    //---------------------------------------------------------

    setScene(scene) {

        this.scene = scene;

        if (scene.resize)
            scene.resize(
                this.width,
                this.height
            );

    }

    //---------------------------------------------------------

    start() {

        if (this.running)
            return;

        this.running = true;

        this.lastFrame = performance.now();

        requestAnimationFrame(this.loop);

    }

    //---------------------------------------------------------

    stop() {

        this.running = false;

    }

    //---------------------------------------------------------

    resize() {

        this.pixelRatio = Math.min(
            window.devicePixelRatio || 1,
            2
        );

        this.width = window.innerWidth;

        this.height = window.innerHeight;

        this.canvas.width =
            this.width * this.pixelRatio;

        this.canvas.height =
            this.height * this.pixelRatio;

        this.canvas.style.width =
            this.width + "px";

        this.canvas.style.height =
            this.height + "px";

        this.ctx.setTransform(
            this.pixelRatio,
            0,
            0,
            this.pixelRatio,
            0,
            0
        );

        if (
            this.scene &&
            this.scene.resize
        ) {

            this.scene.resize(
                this.width,
                this.height
            );

        }

    }

    //---------------------------------------------------------

    clear() {

        this.ctx.fillStyle = "#071019";

        this.ctx.fillRect(
            0,
            0,
            this.width,
            this.height
        );

    }

    //---------------------------------------------------------

    update(dt) {

        if (
            this.scene &&
            this.scene.update
        ) {

            this.scene.update(dt);

        }

    }

    //---------------------------------------------------------

    draw() {

        if (
            this.scene &&
            this.scene.draw
        ) {

            this.scene.draw(this.ctx);

        }

        if (this.debug)
            this.drawDebug();

    }

    //---------------------------------------------------------

    drawDebug() {

        const ctx = this.ctx;

        ctx.save();

        ctx.font = "14px monospace";

        ctx.fillStyle = "#ffffff";

        ctx.fillText(
            `FPS : ${this.fps}`,
            20,
            30
        );

        ctx.fillText(
            `Canvas : ${this.width} x ${this.height}`,
            20,
            50
        );

        ctx.fillText(
            `DPR : ${this.pixelRatio}`,
            20,
            70
        );

        ctx.restore();

    }

    //---------------------------------------------------------

    loop(now) {

        if (!this.running)
            return;

        this.deltaTime =
            Math.min(
                (now - this.lastFrame) / 1000,
                0.05
            );

        this.lastFrame = now;

        this.frameCounter++;

        this.fpsTimer += this.deltaTime;

        if (this.fpsTimer >= 1) {

            this.fps = this.frameCounter;

            this.frameCounter = 0;

            this.fpsTimer = 0;

        }

        this.clear();

        this.update(this.deltaTime);

        this.draw();

        requestAnimationFrame(this.loop);

    }

}