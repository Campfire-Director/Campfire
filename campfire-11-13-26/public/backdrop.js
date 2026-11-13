/* ==========================================================
   CAMPFIRE — backdrop.js
   The scenery behind every screen. Three stacked layers that
   fill the window (see ".backdrop" in theme.css):

     lobby-sky.jpg         the still night sky — always there,
                           underneath everything
     title-loop.mp4        the looping title scene (home screen)
     lobby-transition.mp4  the 3-second camera lift into the sky,
                           played once when you create a room

   Three modes, set as data-mode on #backdrop:
     "title"       title loop visible
     "transition"  transition video on top; the menus are hidden
     "sky"         both videos faded out; the still shows

   The videos are silent files. All sound lives in sound.js.
   ========================================================== */

const Backdrop = (() => {
  const root = document.getElementById('backdrop');
  const title = root.querySelector('.bd-title');
  const trans = root.querySelector('.bd-transition');
  const reduced = window.matchMedia
    ? window.matchMedia('(prefers-reduced-motion: reduce)')
    : { matches: false };

  let mode = 'sky';
  let armed = false;     // "the next move into a room should play the transition"
  let run = 0;           // bumps on every mode change, so a stale transition can't finish late
  let safety = null;

  function setMode(m) {
    mode = m;
    root.dataset.mode = m;
    document.body.classList.toggle('bd-transitioning', m === 'transition');
  }

  // Home screen: the title scene loops forever.
  // Players who asked their OS for less motion get the still poster frame.
  function showTitle() {
    run++; armed = false;
    clearTimeout(safety);
    trans.pause();
    setMode('title');
    if (!reduced.matches) {
      const p = title.play();
      if (p && p.catch) p.catch(() => {});
    }
  }

  // Every other screen: the still sky.
  function showSky() {
    run++;
    clearTimeout(safety);
    setMode('sky');
    // let the fade finish before stopping the loop underneath it
    setTimeout(() => { if (mode === 'sky') title.pause(); }, 600);
  }

  // Called when "create room" is pressed. If the room comes back OK,
  // the next enterGame() plays the transition; disarm() cancels that.
  function arm() { armed = true; }
  function disarm() { armed = false; }

  // Called on every in-game render. Only does something on the way out
  // of the title screen, so it's safe to call again and again.
  function enterGame() {
    if (mode !== 'title') return;
    const play = armed && !reduced.matches && trans.readyState >= 2;
    armed = false;
    if (play) playTransition(); else showSky();
  }

  function playTransition() {
    const mine = ++run;
    const done = () => { if (mine === run) showSky(); };
    setMode('transition');
    try { trans.currentTime = 0; } catch (e) {}
    trans.onended = done;
    const p = trans.play();
    if (p && p.catch) p.catch(done);       // blocked or failed: go straight to the sky
    clearTimeout(safety);
    safety = setTimeout(done, 4500);       // never leave the menus hidden if the video stalls
  }

  return { showTitle, showSky, arm, disarm, enterGame, mode: () => mode };
})();
