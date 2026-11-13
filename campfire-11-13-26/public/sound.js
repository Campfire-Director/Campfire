/* ==========================================================
   CAMPFIRE — sound.js
   Every sound in the game.

   Sound comes from two places:

   The ambience — one recorded loop (ambience-loop.wav, the title
   scene's soundtrack) that plays on every screen.

   The moments — synthesized live with WebAudio, no files
   (chime, pop, click, join knock, results fanfare):
   - Sound.chime()  — a new writing round begins / a story arrives
   - Sound.pop()    — picking a marshmallow on the ballot
   - Sound.click()  — small confirmations ("I'm ready")
   - Sound.tada()   — the results screen

   Browsers block audio until the player interacts with the page,
   so everything waits for the first tap/keypress. A mute toggle
   (bottom-left flame button) is remembered between visits.
   ========================================================== */

const Sound = (() => {
  let ctx = null;
  let master = null;        // one master gain — the mute switch
  let ambienceGain = null;  // the looping ambience bed
  let started = false;
  let muted = false;
  let volume = 1;
  try { muted = localStorage.getItem('sr_muted') === '1'; } catch (e) {}
  try {
    const v = parseFloat(localStorage.getItem('sr_volume'));
    if (!isNaN(v)) volume = Math.min(1, Math.max(0, v));
  } catch (e) {}

  function applyMaster() {
    if (master) master.gain.value = muted ? 0 : volume;
  }

  /* ---------- Boot: create the context on the first user gesture ---------- */
  function ensure() {
    if (started) return;
    if (!window.AudioContext && !window.webkitAudioContext) return;
    started = true;
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain();
    applyMaster();
    master.connect(ctx.destination);
    buildAmbience();
  }
  ['pointerdown', 'keydown', 'touchstart'].forEach(ev =>
    window.addEventListener(ev, ensure, { once: false, passive: true }));

  /* ---------- The ambience: one recorded loop ----------
     ambience-loop.wav is the soundtrack of the title scene, trimmed
     so its end flows into its start. It is decoded once and looped
     by WebAudio (gapless, unlike an <audio loop> tag) and plays on
     every screen. Change AMBIENCE_LEVEL to rebalance it against the
     chimes and pops. */
  const AMBIENCE_FILE = 'ambience-loop.wav';
  const AMBIENCE_LEVEL = 0.6;
  function buildAmbience() {
    ambienceGain = ctx.createGain();
    ambienceGain.gain.value = 0;
    ambienceGain.connect(master);
    fetch(AMBIENCE_FILE)
      .then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.arrayBuffer(); })
      .then(data => new Promise((ok, fail) => ctx.decodeAudioData(data, ok, fail)))
      .then(buf => {
        const src = ctx.createBufferSource();
        src.buffer = buf;
        src.loop = true;
        src.connect(ambienceGain);
        src.start();
        // ease in so it doesn't jump out on the first click
        ambienceGain.gain.setTargetAtTime(AMBIENCE_LEVEL, ctx.currentTime, 0.5);
      })
      .catch(err => console.warn('Campfire: ambience failed to load —', err));
  }

  /* ---------- The moments ---------- */
  function tone(freq, when, dur, peak, type) {
    const o = ctx.createOscillator();
    o.type = type || 'sine';
    o.frequency.value = freq;
    const g = ctx.createGain();
    const t = ctx.currentTime + (when || 0);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(peak, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(master);
    o.start(t); o.stop(t + dur + 0.05);
  }

  const api = {
    // A new story lands in your hands — two gentle bell notes
    chime() { if (!ready()) return; tone(660, 0, 0.5, 0.16); tone(880, 0.12, 0.6, 0.12); },
    // Marshmallow squish — a quick pitch-bent blip
    pop() {
      if (!ready()) return;
      const o = ctx.createOscillator(); o.type = 'triangle';
      const g = ctx.createGain();
      const t = ctx.currentTime;
      o.frequency.setValueAtTime(300, t);
      o.frequency.exponentialRampToValueAtTime(720, t + 0.09);
      g.gain.setValueAtTime(0.22, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.13);
      o.connect(g); g.connect(master);
      o.start(t); o.stop(t + 0.16);
    },
    // Someone joins the lobby — a soft two-note knock, lower and woodier than the chime
    join() { if (!ready()) return; tone(392, 0, 0.16, 0.14, 'triangle'); tone(587, 0.1, 0.3, 0.13, 'triangle'); },
    // Small confirmation
    click() { if (!ready()) return; tone(520, 0, 0.08, 0.1, 'triangle'); },
    // Results fanfare — a tiny rising arpeggio
    tada() {
      if (!ready()) return;
      [[523, 0], [659, 0.11], [784, 0.22], [1047, 0.34]].forEach(([f, w]) =>
        tone(f, w, 0.5, 0.14));
    },
    toggleMute() {
      muted = !muted;
      try { localStorage.setItem('sr_muted', muted ? '1' : '0'); } catch (e) {}
      if (!muted) ensure();  // may be the very first unmuted moment
      applyMaster();
      return muted;
    },
    isMuted() { return muted; },
    /* The volume dial: 0..1, remembered between visits. Setting any
       volume above zero also unmutes — turning the knob means
       "I want to hear it." */
    setVolume(v) {
      volume = Math.min(1, Math.max(0, +v || 0));
      try { localStorage.setItem('sr_volume', String(volume)); } catch (e) {}
      if (volume > 0 && muted) {
        muted = false;
        try { localStorage.setItem('sr_muted', '0'); } catch (e) {}
      }
      ensure();
      applyMaster();
      return volume;
    },
    getVolume() { return volume; },
  };

  function ready() { return started && !muted && ctx; }

  return api;
})();
