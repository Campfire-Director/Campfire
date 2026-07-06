// =============================================================
// Campfire Engine v2
// Stars.js
//
// Twinkling stars for the title scene.
// =============================================================

export default class Stars {

    constructor(count = 180) {

        this.stars = [];

        for (let i = 0; i < count; i++) {

            this.stars.push({

                x: Math.random(),

                y: Math.random() * 0.55,

                radius: 0.5 + Math.random() * 1.8,

                phase: Math.random() * Math.PI * 2,

                speed: 0.6 + Math.random() * 1.4

            });

        }

        this.time = 0;

    }

    //---------------------------------------------------------

    update(dt) {

        this.time += dt;

    }

    //---------------------------------------------------------

    draw(ctx, width, height) {

        ctx.save();

        for (const star of this.stars) {

            const alpha =

                0.45 +

                0.55 *

                Math.sin(

                    this.time *

                    star.speed +

                    star.phase

                );

            ctx.globalAlpha = alpha;

            ctx.beginPath();

            ctx.arc(

                star.x * width,

                star.y * height,

                star.radius,

                0,

                Math.PI * 2

            );

            ctx.fillStyle = "#FFF8E8";

            ctx.fill();

        }

        ctx.restore();

        ctx.globalAlpha = 1;

    }

}