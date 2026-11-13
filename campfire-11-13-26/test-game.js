/* End-to-end test of the game rules, played by simulated players over
   real sockets. Run the server, then:  node test-game.js
   (takes about 25 seconds — one part waits out a 15-second round timer)

   GAME 1  the default game: no timers, everyone pitches a theme and votes
   GAME 2  timers on + the host sets the theme: unfinished drafts are handed in
   GAME 3  anonymous mode hides word counts and authors */
const { io } = require('socket.io-client');
const URL = 'http://localhost:3000';
function fail(msg) { console.error('TEST FAILED:', msg); process.exit(1); }
const wait = ms => new Promise(r => setTimeout(r, ms));

// A simulated player: remembers its latest state and can wait for a condition
function player(name) {
  const sock = io(URL, { forceNew: true });
  const p = { name, sock, st: null, events: [], waiters: [] };
  sock.on('state', (st) => {
    p.st = st;
    p.waiters = p.waiters.filter(w => { if (w.test(st)) { w.resolve(st); return false; } return true; });
  });
  sock.on('read_aloud', e => p.events.push(e));
  p.until = (test, what, ms = 6000) => new Promise((resolve) => {
    if (p.st && test(p.st)) return resolve(p.st);
    p.waiters.push({ test, resolve });
    setTimeout(() => { if (p.waiters.some(w => w.resolve === resolve)) fail(`${name} timed out waiting for: ${what}`); }, ms);
  });
  p.emit = (...a) => sock.emit(...a);
  p.ask = (ev, data) => new Promise(r => sock.emit(ev, data, r));
  return p;
}
async function room(names, settings) {
  const ps = names.map(player);
  await Promise.all(ps.map(p => new Promise(r => p.sock.on('connect', r))));
  const res = await ps[0].ask('create_room', { name: names[0] });
  if (!res || !res.ok) fail('create_room failed');
  for (const p of ps.slice(1)) { const j = await p.ask('join_room', { code: res.code, name: p.name }); if (!j.ok) fail('join failed: ' + j.error); }
  await ps[0].until(st => st.players.length === names.length, 'everyone in the lobby');
  if (settings) { ps[0].emit('update_settings', settings); await wait(120); }
  return ps;
}
const readyUp = (p, text) => p.emit('ready', { text, backspaces: 1, seconds: 3 });

async function game1() {
  const [ana, ben, cleo] = await room(['Ana', 'Ben', 'Cleo']);
  const all = [ana, ben, cleo];
  const s = ana.st.settings;
  if (s.limits !== false || s.themeMode !== 'vote') fail('defaults should be no limits + theme vote, got ' + JSON.stringify(s));
  if (typeof ana.st.now !== 'number') fail('state carries no server clock');

  // --- everyone pitches a theme ---
  ana.emit('start_game');
  await Promise.all(all.map(p => p.until(st => st.phase === 'theming', 'theming')));
  for (const p of all) {
    const t = p.st.theming;
    if (t.endsAt) fail('untimed game has a pitch deadline');
    for (const tab of ['words', 'madlib']) if (!t.tabs[tab] || t.tabs[tab].items.length !== 10) fail(`${p.name}: expected 10 ${tab} options`);
  }
  if (JSON.stringify(ana.st.theming.tabs.words) === JSON.stringify(ben.st.theming.tabs.words)) fail('players should each get their own options');
  ana.emit('submit_theme', { theme: 'a haunted lighthouse' });
  ben.emit('submit_theme', { theme: 'space llamas' });
  await ana.until(st => st.theming && st.theming.readyCount === 2, 'two pitches in');
  await wait(300);
  if (cleo.st.phase !== 'theming') fail('pitching ended before everyone was ready');
  if (ana.st.theming.waitingOn.join() !== 'Cleo') fail('waitingOn should be Cleo: ' + ana.st.theming.waitingOn);
  ana.emit('unsubmit_theme');
  await ana.until(st => st.theming && !st.theming.pitched, 'Ana takes her pitch back');
  ana.emit('submit_theme', { theme: 'a haunted lighthouse' });
  cleo.emit('submit_theme', { theme: 'A Haunted Lighthouse ' });   // same as Ana's: folds into one option

  // --- the camp votes ---
  await Promise.all(all.map(p => p.until(st => st.phase === 'themevote', 'theme vote')));
  const opts = ana.st.themeVote.options;
  if (opts.length !== 2) fail('identical pitches should fold into one option; got ' + opts.length);
  const mine = p => p.st.themeVote.options.filter(o => o.yours).map(o => o.text.toLowerCase());
  if (mine(ana)[0] !== 'a haunted lighthouse' || mine(cleo)[0] !== 'a haunted lighthouse' || mine(ben)[0] !== 'space llamas') fail('"yours" flags are wrong');
  const idx = text => opts.find(o => o.text.toLowerCase() === text).index;
  ana.emit('vote_theme', { index: idx('a haunted lighthouse') });   // her own: must be refused
  await wait(200);
  if (ana.st.themeVote.voted !== null) fail('a player voted for their own pitch');
  ana.emit('vote_theme', { index: idx('space llamas') });
  ben.emit('vote_theme', { index: idx('a haunted lighthouse') });
  await wait(250);
  if (ana.st.phase !== 'themevote') fail('theme vote ended before everyone voted');
  cleo.emit('vote_theme', { index: idx('space llamas') });
  await Promise.all(all.map(p => p.until(st => st.phase === 'writing', 'writing')));
  if (ana.st.theme !== 'space llamas') fail('wrong theme won: ' + ana.st.theme);
  console.log('THEME VOTE OK — pitches folded, no self-votes, 2–1 winner: ' + ana.st.theme);

  // --- round 1: untimed; Ana never presses ready, the host moves on, her draft is used ---
  const w = ana.st.writing;
  if (w.endsAt || ana.st.timed) fail('untimed game has a round deadline');
  if (w.limits.min !== 1 || w.limits.max !== 0) fail('limits off should mean min 1, no max: ' + JSON.stringify(w.limits));
  if (w.status.some(r => typeof r.words !== 'number')) fail('word counts missing in a named game');
  ana.emit('typing_progress', { text: 'Ana draft never readied', backspaces: 2 });
  readyUp(ben, 'Ben round one'); readyUp(cleo, 'Cleo round one');
  await ana.until(st => st.writing.readyCount === 2, 'two ready');
  await wait(400);
  if (ana.st.writing.round !== 0) fail('untimed round ended while a player was still writing');
  if (!ana.st.writing.status.find(r => r.name === 'Ana' && r.words === 4)) fail('live word count from the draft not shown');
  ben.emit('force_advance');                       // not the host: ignored
  await wait(200);
  if (ana.st.writing.round !== 0) fail('a non-host moved the game on');
  ana.emit('force_advance');
  await Promise.all(all.map(p => p.until(st => st.phase === 'writing' && st.writing.round === 1, 'round 2')));

  // --- round 2: ready, then "keep writing", then ready again ---
  readyUp(ana, 'Ana round two'); readyUp(ben, 'Ben round two first try');
  await ben.until(st => st.writing.ready, 'Ben ready');
  ben.emit('unready');
  await ben.until(st => !st.writing.ready, 'Ben back to writing');
  readyUp(ben, 'Ben round two'); readyUp(cleo, 'Cleo round two');
  await Promise.all(all.map(p => p.until(st => st.phase === 'writing' && st.writing.round === 2, 'round 3')));

  // --- round 3: Cleo leaves mid-round; nobody waits on her, her draft is still used ---
  cleo.emit('typing_progress', { text: 'Cleo was mid-sentence when she left' });
  readyUp(ana, 'Ana round three'); readyUp(ben, 'Ben round three');
  await ana.until(st => st.writing && st.writing.readyCount === 2, 'two ready in round 3');
  await wait(300);
  if (ana.st.phase !== 'writing') fail('round ended while Cleo was still connected and writing');
  await cleo.ask('leave_room');
  await Promise.all([ana, ben].map(p => p.until(st => st.phase === 'reading', 'reading (after Cleo left)')));
  console.log('UNTIMED ROUNDS OK — waited for everyone, host could move on, leaving unblocked the round');

  // --- reading: drafts became entries; the host's read-aloud reaches everyone ---
  const seen = [];
  for (let i = 0; i < 3; i++) {
    await ana.until(st => st.phase === 'reading' && st.reading.index === i, 'story ' + (i + 1));
    seen.push(...ana.st.reading.segments.map(sg => sg.text));
    if (ana.st.reading.segments.length !== 3) fail('a story is missing a segment');
    if (!ana.st.reading.mayNavigate) fail('host cannot navigate the reading');
    if (i === 0) {
      ben.emit('read_aloud', { on: true });          // not the host: no relay
      await wait(200);
      if (ana.events.length || ben.events.length) fail('a non-host triggered read-aloud for the lobby');
      ana.emit('read_aloud', { on: true });
      await wait(250);
      if (!(ben.events.length === 1 && ben.events[0].on === true && ben.events[0].index === 0 && ana.events.length === 1)) fail('host read-aloud did not reach every player');
      ana.emit('read_aloud', { on: false });
      await wait(200);
      if (ben.events.length !== 2 || ben.events[1].on !== false) fail('host could not stop the read-aloud for everyone');
    }
    ana.emit('advance_reading', { dir: 'next' });
  }
  if (!seen.includes('Ana draft never readied')) fail('a draft was thrown away when the host moved on (should be handed in)');
  if (!seen.includes('Cleo was mid-sentence when she left')) fail('the draft of a player who left was thrown away');
  if (seen.some(t => t.includes('no words came'))) fail('a placeholder replaced real writing');
  console.log('DRAFTS + READ-ALOUD OK — unfinished drafts were handed in; host read-aloud reached the lobby');

  // --- voting: untimed, ends once the two who remain have voted ---
  await Promise.all([ana, ben].map(p => p.until(st => st.phase === 'voting', 'voting')));
  if (ana.st.voting.endsAt) fail('untimed game has a voting deadline');
  for (const p of [ana, ben]) {
    const o = p.st.voting.options;
    p.emit('cast_vote', { up: o[0].index, down: o[1].index, bestCamper: p.st.voting.campers[0].id });
    if (p === ana) { await wait(250); if (ana.st.phase !== 'voting') fail('voting ended before everyone voted'); }
  }
  await Promise.all([ana, ben].map(p => p.until(st => st.phase === 'results', 'results')));
  if (ana.st.results.awards.length !== 5 || ana.st.results.tally.length !== 3) fail('results are incomplete');
  ana.emit('play_again');
  await ana.until(st => st.phase === 'lobby', 'back to the lobby');
  if (ana.st.players.length !== 2) fail('a player who left should not be in the next lobby');

  // Cleo left mid-game: she can come back afterwards as a normal player
  const back = await cleo.ask('join_room', { code: ana.st.code, name: 'Cleo' });
  if (!back.ok) fail('a player who left could not rejoin the lobby: ' + back.error);
  await ana.until(st => st.players.length === 3, 'Cleo back in the lobby');
  console.log('GAME 1 OK — full default game: pitch, vote, 3 untimed rounds, read, vote, results, play again');
  all.forEach(p => p.sock.disconnect());
}

async function game2() {
  const [hal, ivy, jo] = await room(['Hal', 'Ivy', 'Jo'], { limits: true, seconds: 15, minWords: 3, maxWords: 6, themeMode: 'host' });
  hal.emit('start_game');
  await wait(300);
  if (hal.st.phase !== 'lobby') fail('game started with "host sets the theme" but no theme typed');
  hal.emit('update_settings', { hostTheme: 'robots at prom' });
  await ivy.until(st => st.settings.themeMode === 'host', 'settings reach Ivy');
  await wait(150);
  if (ivy.st.settings.hostTheme) fail("the host's theme leaked to another player before the game started");
  if (hal.st.settings.hostTheme !== 'robots at prom') fail('the host cannot see their own theme');
  const started = Date.now();
  hal.emit('start_game');
  await Promise.all([hal, ivy, jo].map(p => p.until(st => st.phase === 'writing', 'writing')));
  if (hal.st.theme !== 'robots at prom') fail('host theme not used: ' + hal.st.theme);
  const w = ivy.st.writing;
  if (!w.endsAt || !ivy.st.timed) fail('timed game has no round deadline');
  const windowMs = w.endsAt - ivy.st.now;
  if (windowMs < 13000 || windowMs > 15500) fail('round window is wrong: ' + windowMs);
  if (w.limits.min !== 3 || w.limits.max !== 6) fail('word limits not applied: ' + JSON.stringify(w.limits));
  readyUp(hal, 'Hal was ready early');
  ivy.emit('typing_progress', { text: 'Ivy ran out of time with nine words typed here' });   // over the 6-word max
  // Jo types nothing at all
  console.log('  …waiting out the 15-second round timer…');
  await Promise.all([hal, ivy, jo].map(p => p.until(st => st.phase === 'writing' && st.writing.round === 1, 'round 2 after the timer', 20000)));
  const took = Date.now() - started;
  if (took < 14500) fail('timed round ended early (' + took + 'ms) although not everyone was ready');
  const passed = [hal, ivy, jo].map(p => p.st.writing.context.segments[0]);
  if (!passed.includes('Hal was ready early')) fail("Hal's entry is missing");
  if (!passed.includes('Ivy ran out of time with…')) fail("Ivy's unfinished draft was not handed in (trimmed to the word limit): " + JSON.stringify(passed));
  if (!passed.some(t => t.includes('no words came'))) fail('an empty box should become the placeholder');
  console.log('GAME 2 OK — timers on, host theme private until the start, time-out handed in the unfinished draft');
  [hal, ivy, jo].forEach(p => p.sock.disconnect());
}

async function game3() {
  const [kit, lou, max] = await room(['Kit', 'Lou', 'Max'], { anonymous: true, themeMode: 'none' });
  kit.emit('start_game');
  await Promise.all([kit, lou, max].map(p => p.until(st => st.phase === 'writing', 'writing')));
  if (kit.st.theme) fail('no-theme game has a theme');
  lou.emit('typing_progress', { text: 'five words are typed here' });
  await wait(250);
  if (kit.st.writing.status.some(r => r.words !== null)) fail('anonymous mode shows word counts: ' + JSON.stringify(kit.st.writing.status));
  for (let r = 0; r < 3; r++) {
    await Promise.all([kit, lou, max].map(p => p.until(st => st.phase === 'writing' && st.writing.round === r, 'round ' + (r + 1))));
    [kit, lou, max].forEach(p => readyUp(p, `${p.name} r${r + 1}`));
  }
  await Promise.all([kit, lou, max].map(p => p.until(st => st.phase === 'reading', 'reading')));
  const rd = lou.st.reading;
  if (rd.ownerName !== null || rd.youAreOwner || rd.segments.some(sg => sg.author !== null)) fail('anonymous mode leaked an author');
  if (lou.st.reading.mayNavigate) fail('in anonymous mode only the host should navigate');
  console.log('GAME 3 OK — anonymous: no word counts, no authors, host-only navigation');
  [kit, lou, max].forEach(p => p.sock.disconnect());
}

(async () => {
  await game1();
  await game2();
  await game3();
  console.log('ALL TESTS PASSED');
  process.exit(0);
})();
setTimeout(() => fail('test timed out'), 60000);
