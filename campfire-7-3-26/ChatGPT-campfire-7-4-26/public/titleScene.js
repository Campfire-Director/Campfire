{\rtf1\ansi\ansicpg1252\cocoartf2870
\cocoatextscaling0\cocoaplatform0{\fonttbl\f0\froman\fcharset0 Times-Roman;}
{\colortbl;\red255\green255\blue255;\red0\green0\blue0;}
{\*\expandedcolortbl;;\cssrgb\c0\c0\c0;}
\margl1440\margr1440\vieww11520\viewh8400\viewkind0
\deftab720
\pard\pardeftab720\partightenfactor0

\f0\fs24 \cf0 \expnd0\expndtw0\kerning0
\outl0\strokewidth0 \strokec2 const canvas = document.getElementById("scene");\
const ctx = canvas.getContext("2d");\
\
let width, height;\
\
function resize() \{\
    width = canvas.width = window.innerWidth;\
    height = canvas.height = window.innerHeight;\
\}\
\
window.addEventListener("resize", resize);\
resize();\
\
// ---------- Background Image ----------\
const bg = new Image();\
bg.src = "night-sky.jpg";\
\
// ---------- Stars ----------\
const stars = [];\
\
for (let i = 0; i < 180; i++) \{\
    stars.push(\{\
        x: Math.random(),\
        y: Math.random() * 0.6,\
        r: Math.random() * 2 + 0.5,\
        phase: Math.random() * Math.PI * 2,\
        speed: 0.5 + Math.random()\
    \});\
\}\
\
// ---------- Embers ----------\
const embers = [];\
\
function spawnEmber() \{\
    embers.push(\{\
        x: width / 2 + (Math.random() - 0.5) * 35,\
        y: height * 0.72,\
        vx: (Math.random() - 0.5) * 0.35,\
        vy: -1.2 - Math.random(),\
        life: 1\
    \});\
\}\
\
function update(dt) \{\
\
    if (Math.random() < 0.35)\
        spawnEmber();\
\
    for (let i = embers.length - 1; i >= 0; i--) \{\
\
        const e = embers[i];\
\
        e.x += e.vx;\
        e.y += e.vy;\
        e.life -= 0.008;\
\
        if (e.life <= 0)\
            embers.splice(i, 1);\
    \}\
\
\}let time = 0;\
\
function render() \{\
\
    requestAnimationFrame(render);\
\
    time += 0.016;\
\
    update();\
\
    // camera breathing\
\
    const breathe = Math.sin(time * 0.25) * 6;\
\
    ctx.clearRect(0, 0, width, height);\
\
    // background\
\
    if (bg.complete) \{\
\
        ctx.drawImage(\
            bg,\
            -20,\
            -20 + breathe,\
            width + 40,\
            height + 40\
        );\
\
    \} else \{\
\
        ctx.fillStyle = "#09111a";\
        ctx.fillRect(0,0,width,height);\
\
    \}\
\
    // stars\
\
    for (const s of stars) \{\
\
        const alpha =\
            0.5 +\
            0.5 *\
            Math.sin(time * s.speed + s.phase);\
\
        ctx.globalAlpha = alpha;\
\
        ctx.beginPath();\
        ctx.arc(\
            s.x * width,\
            s.y * height,\
            s.r,\
            0,\
            Math.PI * 2\
        );\
\
        ctx.fillStyle = "#fff9d5";\
        ctx.fill();\
\
    \}\
\
    ctx.globalAlpha = 1;\
\
    // moon\
\
    ctx.beginPath();\
\
    ctx.arc(\
        width * 0.83,\
        height * 0.18,\
        42,\
        0,\
        Math.PI * 2\
    );\
\
    ctx.fillStyle = "#fff6c5";\
    ctx.shadowBlur = 35;\
    ctx.shadowColor = "#fff7cc";\
    ctx.fill();\
\
    ctx.shadowBlur = 0;\
\
    // fire glow\
\
    const glow =\
        170 +\
        Math.sin(time * 9) * 18;\
\
    const g = ctx.createRadialGradient(\
        width / 2,\
        height * 0.73,\
        5,\
        width / 2,\
        height * 0.73,\
        glow\
    );\
\
    g.addColorStop(0, "rgba(255,200,90,.9)");\
    g.addColorStop(.5, "rgba(255,130,30,.35)");\
    g.addColorStop(1, "rgba(255,80,0,0)");\
\
    ctx.fillStyle = g;\
    ctx.fillRect(0,0,width,height);\
\
    // embers\
\
    for (const e of embers) \{\
\
        ctx.globalAlpha = e.life;\
\
        ctx.beginPath();\
\
        ctx.arc(\
            e.x,\
            e.y,\
            2,\
            0,\
            Math.PI * 2\
        );\
\
        ctx.fillStyle = "#ffd27a";\
        ctx.fill();\
\
    \}\
\
    ctx.globalAlpha = 1;\
\
\}\
\
render();}