// =============================================================
// Campfire Engine v2
// Flicker.js
//
// The shared heartbeat of the living painting: organic
// flicker curves built from layered sines at irrational
// frequency ratios (so the pattern never visibly repeats),
// and the accessibility switch every effect respects.
// =============================================================

// Players who ask their OS for less motion get a still painting
export const REDUCED_MOTION =
    typeof matchMedia === "function" &&
    matchMedia("(prefers-reduced-motion: reduce)").matches;

// A gentle organic wave in [-1, 1]: three sines, no common period
export function organic(t, speed = 1, phase = 0) {
    const s = t * speed + phase;
    return (
        Math.sin(s * 2.1) * 0.55 +
        Math.sin(s * 3.7 + 1.3) * 0.3 +
        Math.sin(s * 7.3 + 4.1) * 0.15
    );
}

// Fire-like flicker in [0, 1]: mostly calm, occasionally lively
export function fireFlicker(t, phase = 0) {
    const base = organic(t, 1.6, phase) * 0.5 + 0.5;
    const spike = Math.max(0, Math.sin(t * 11.7 + phase * 3)) ** 6;
    return Math.min(1, base * 0.8 + spike * 0.25);
}
