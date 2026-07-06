/* ==========================================================
   CAMPFIRE — sound.js
   Every sound in the game, synthesized live with the browser's
   WebAudio API — no audio files to download or host.

   The ambience:
   - a crackling fire whose intensity follows the on-screen fire
     (roaring in round 1, faint coals by the end)
   - soft night crickets on the title screen

   The moments:
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
  let fireGain = null;      // fire crackle level (follows the fire stage)
  let cricketGain = null;   // crickets level (title screen only)
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

  let wantFire = 0;         // remembered targets from before audio unlocks
  let wantCrickets = false;

  /* ---------- Boot: create the context on the first user gesture ---------- */
  function ensure() {
    if (started) return;
    if (!window.AudioContext && !window.webkitAudioContext) return;
    started = true;
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain();
    applyMaster();
    master.connect(ctx.destination);
    buildFire();
    buildCrickets();
    setFire(wantFire);
    setCrickets(wantCrickets);
  }
  ['pointerdown', 'keydown', 'touchstart'].forEach(ev =>
    window.addEventListener(ev, ensure, { once: false, passive: true }));

  /* ---------- The crackling fire ----------
     A low rumble of filtered brown noise, plus randomly scheduled
     short "pops" of bandpassed noise — the snapping of the logs. */
  function noiseBuffer(seconds, brown) {
    const len = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      const white = Math.random() * 2 - 1;
      if (brown) { last = (last + 0.02 * white) / 1.02; d[i] = last * 3.5; }
      else d[i] = white;
    }
    return buf;
  }

  let popTimer = null;
  function buildFire() {
    fireGain = ctx.createGain();
    fireGain.gain.value = 0;
    fireGain.connect(master);

    // the low rumble bed
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer(3, true);
    src.loop = true;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 320;
    const bedGain = ctx.createGain(); bedGain.gain.value = 0.5;
    src.connect(lp); lp.connect(bedGain); bedGain.connect(fireGain);
    src.start();

    // the pops — schedule one, then another at a random gap
    const popBuf = noiseBuffer(0.06, false);
    function schedulePop() {
      const level = fireGain.gain.value;
      if (level > 0.004) {
        const p = ctx.createBufferSource(); p.buffer = popBuf;
        const bp = ctx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.value = 900 + Math.random() * 2600;
        bp.Q.value = 2.5;
        const g = ctx.createGain();
        g.gain.setValueAtTime((0.5 + Math.random() * 1.4) , ctx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05 + Math.random() * 0.06);
        p.connect(bp); bp.connect(g); g.connect(fireGain);
        p.start();
      }
      // a hotter fire pops more often
      const gap = 90 + Math.random() * (level > 0.05 ? 350 : 1200);
      popTimer = setTimeout(schedulePop, gap);
    }
    schedulePop();
  }

  /* ---------- Night crickets (title screen) ----------
     Little chirp trains: 4–5 rapid pulses of a ~4.3kHz tone,
     from two "crickets" chirping out of phase. */
  function buildCrickets() {
    cricketGain = ctx.createGain();
    cricketGain.gain.value = 0;
    cricketGain.connect(master);

    function cricket(baseHz, startDelay) {
      let stopped = false;
      function chirpTrain() {
        if (!ctx || stopped) return;
        const t0 = ctx.currentTime;
        const pulses = 4 + Math.floor(Math.random() * 2);
        for (let i = 0; i < pulses; i++) {
          const o = ctx.createOscillator();
          o.type = 'sine';
          o.frequency.value = baseHz + Math.random() * 120;
          const g = ctx.createGain();
          const t = t0 + i * 0.055;
          g.gain.setValueAtTime(0, t);
          g.gain.linearRampToValueAtTime(0.12, t + 0.008);
          g.gain.exponentialRampToValueAtTime(0.001, t + 0.045);
          o.connect(g); g.connect(cricketGain);
          o.start(t); o.stop(t + 0.06);
        }
        setTimeout(chirpTrain, 700 + Math.random() * 1900);
      }
      setTimeout(chirpTrain, startDelay);
    }
    cricket(4300, 400);
    cricket(3900, 1400);
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
    // Small confirmation
    click() { if (!ready()) return; tone(520, 0, 0.08, 0.1, 'triangle'); },
    // Results fanfare — a tiny rising arpeggio
    tada() {
      if (!ready()) return;
      [[523, 0], [659, 0.11], [784, 0.22], [1047, 0.34]].forEach(([f, w]) =>
        tone(f, w, 0.5, 0.14));
    },
    setFire, setCrickets,
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

  function setFire(stage) {
    wantFire = Math.max(0, Math.min(1, stage));
    if (!started) return;
    // Perceptual curve: quiet coals should still whisper a little
    const target = wantFire <= 0 ? 0 : 0.02 + wantFire * 0.11;
    fireGain.gain.setTargetAtTime(target, ctx.currentTime, 0.8);
  }

  function setCrickets(on) {
    wantCrickets = !!on;
    if (!started) return;
    cricketGain.gain.setTargetAtTime(on ? 0.5 : 0, ctx.currentTime, 0.6);
  }

  return api;
})();
