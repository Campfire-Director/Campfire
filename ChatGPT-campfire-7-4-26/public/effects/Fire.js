// =============================================================
// Campfire Engine v2
// Fire.js
//
// Stage 1
// Procedural painted campfire.
//
// Future stages will add:
// - Sparks
// - Smoke
// - Firelight
// =============================================================

export default class Fire {

    constructor(x, y) {

        this.x = x;
        this.y = y;

        this.time = 0;

    }

    //---------------------------------------------------------

    update(dt) {

        this.time += dt;

    }

    //---------------------------------------------------------

    draw(ctx) {

        ctx.save();

        ctx.translate(this.x, this.y);

        //-----------------------------------
        // Ground glow
        //-----------------------------------

        const glow =
            0.9 +
            Math.sin(this.time * 1.2) * 0.08;

        const gradient =
            ctx.createRadialGradient(
                0,
                0,
                10,
                0,
                0,
                110
            );

        gradient.addColorStop(
            0,
            `rgba(255,210,90,${0.35 * glow})`
        );

        gradient.addColorStop(
            1,
            "rgba(255,120,0,0)"
        );

        ctx.fillStyle = gradient;

        ctx.beginPath();

        ctx.ellipse(
            0,
            10,
            95,
            42,
            0,
            0,
            Math.PI * 2
        );

        ctx.fill();

        //-----------------------------------
        // Flame body
        //-----------------------------------

        const height =
            150 +
            Math.sin(this.time * 3.5) * 8;

        const width =
            40 +
            Math.sin(this.time * 2.3) * 3;

        const flame =
            ctx.createLinearGradient(
                0,
                -height,
                0,
                20
            );

        flame.addColorStop(0, "#fff7d8");
        flame.addColorStop(0.25, "#ffe27b");
        flame.addColorStop(0.55, "#ffb13a");
        flame.addColorStop(1, "#ff6b00");

        ctx.fillStyle = flame;

        ctx.beginPath();

        ctx.moveTo(0, -height);

        for (let i = 0; i <= 24; i++) {

            const t = i / 24;

            const yy = -height + t * height;

            const sway =
                Math.sin(
                    this.time * 5 +
                    t * 8
                ) * 12;

            const xx =
                Math.sin(
                    t * Math.PI
                ) *
                width +
                sway;

            ctx.lineTo(xx, yy);

        }

        for (let i = 24; i >= 0; i--) {

            const t = i / 24;

            const yy = -height + t * height;

            const sway =
                Math.sin(
                    this.time * 5 +
                    t * 8 +
                    2
                ) * 12;

            const xx =
                -Math.sin(
                    t * Math.PI
                ) *
                width +
                sway;

            ctx.lineTo(xx, yy);

        }

        ctx.closePath();

        ctx.fill();

        //-----------------------------------
        // Bright core
        //-----------------------------------

        ctx.fillStyle =
            "rgba(255,255,240,.55)";

        ctx.beginPath();

        ctx.ellipse(
            0,
            -55,
            16,
            55,
            0,
            0,
            Math.PI * 2
        );

        ctx.fill();

        ctx.restore();

    }

}