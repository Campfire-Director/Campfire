/* Automated smoke test: 3 simulated players play a full game
   with the campfire rules (ready, director, marshmallow votes, awards). */
const { io } = require('socket.io-client');
const URL = 'http://localhost:3000';
const ANON = process.env.ANON === '1';
const THEME = process.env.THEME === '1';
console.log('Mode:', (ANON ? 'ANONYMOUS' : 'normal') + (THEME ? " + Director's Theme" : ''));
let themeSet = false;

const clients = {};
const readyRounds = {};
const advancedReads = new Set();
const votedNames = new Set();
let directorSeen = null;
let backTested = false;
let done = false;
let liveSeen = false;   // saw Ana's live pre-ready word count
let pasteSeen = false;  // saw Ben's paste badge

function fail(msg) { console.error('TEST FAILED:', msg); process.exit(1); }

function handleState(name, st) {
  if (st.phase !== 'lobby' && st.directorName) directorSeen = st.directorName;

  if (st.phase === 'theming') {
    if (!st.theming.endsAt) fail('theming phase has no countdown');
    if (st.theming.youAreDirector && !themeSet) {
      themeSet = true;
      if (!st.theming.suggestions || st.theming.suggestions.length !== 8) fail('expected 8 theme suggestions, got ' + (st.theming.suggestions||[]).length);
      // verify the 45s window (endsAt should be ~45s out, definitely >30s)
      const windowMs = st.theming.endsAt - Date.now();
      if (windowMs < 30000) fail('theme window too short: ' + Math.round(windowMs/1000) + 's (expected ~45)');
      setTimeout(() => clients[name].emit('set_theme', { theme: 'a haunted lighthouse' }), 50);
    }
  }

  if (st.phase === 'writing' && !st.writing.ready) {
    if (typeof st.writing.readyCount !== 'number') fail('no readyCount in writing view');
    // live sidebar data: every status row carries a word count in text mode
    if (st.writing.status.some(p => typeof p.words !== 'number')) fail('status rows missing live word counts');
    // watch for Ana's live (pre-ready) count and Ben's paste badge
    const anaRow = st.writing.status.find(p => p.name === 'Ana');
    if (anaRow && !anaRow.done && anaRow.words === 7) liveSeen = true;
    const benRow = st.writing.status.find(p => p.name === 'Ben');
    if (benRow && benRow.pasted >= 2) pasteSeen = true;

    const r = st.writing.round;
    readyRounds[name] = readyRounds[name] || new Set();
    if (!readyRounds[name].has(r)) {
      readyRounds[name].add(r);
      if (r > 0 && st.writing.context.segments.length === 0) fail('no context in round ' + r);
      if (THEME && st.theme !== 'a haunted lighthouse') fail('theme not shown on writing screen: ' + st.theme);
      if (!THEME && st.theme) fail('unexpected theme when toggle off');
      // Round 0: Ana types live, Ben pastes twice, before anyone readies
      if (r === 0 && name === 'Ana') clients[name].emit('typing_progress', { words: 7 });
      if (r === 0 && name === 'Ben') { clients[name].emit('paste_alert'); clients[name].emit('paste_alert'); }
      // Each player types a different amount so the awards are distinguishable
      const repeats = name === 'Ana' ? 12 : name === 'Ben' ? 6 : 3;
      const text = Array(repeats).fill(`${name}-r${r + 1}`).join(' ');
      const stats = { text, backspaces: name === 'Ben' ? 9 : 2, seconds: name === 'Cleo' ? 1 : 8 };
      setTimeout(() => clients[name].emit('ready', stats), r === 0 ? 450 : 50);
    }
  }

  if (st.phase === 'reading') {
    if (ANON) {
      if (st.reading.ownerName !== null) fail('anonymous mode leaked the story owner');
      if (st.reading.youAreOwner) fail('anonymous mode leaked youAreOwner');
      if (st.reading.segments.some(s => s.author !== null)) fail('anonymous mode leaked segment authors');
    }
    if (st.youAreDirector) {
      if (!st.reading.mayNavigate) fail('director cannot navigate readings');
      if (st.reading.index === 0 && st.reading.canGoBack) fail('canGoBack true on first story');
      const key = 'read-' + st.reading.index + '-' + (backTested ? 'after' : 'pre');
      if (!advancedReads.has(key)) {
        advancedReads.add(key);
        if (st.reading.segments.length !== 3) fail('story has ' + st.reading.segments.length + ' segments');
        if (!ANON) {
          const authors = new Set(st.reading.segments.map(s => s.author));
          if (authors.size !== 3) fail('story authors not distinct');
        }
        // On the 2nd story, test going BACK once before continuing forward
        if (st.reading.index === 1 && !backTested) {
          backTested = true;
          if (!st.reading.canGoBack) fail('canGoBack should be true on story 2');
          setTimeout(() => clients[name].emit('advance_reading', { dir: 'back' }), 50);
        } else {
          setTimeout(() => clients[name].emit('advance_reading', { dir: 'next' }), 50);
        }
      }
    }
  }

  if (st.phase === 'voting' && !st.voting.voted && !votedNames.has(name)) {
    votedNames.add(name);
    if (!st.voting.endsAt) fail('voting has no countdown endsAt');
    if (st.voting.options.length !== 2) fail('expected 2 votable stories, got ' + st.voting.options.length);
    if (st.voting.options.some(o => !o.opening || o.opening.length < 1)) fail('vote option missing opening-line preview');
    if (ANON && st.voting.options.some(o => o.ownerName !== null)) fail('anonymous mode leaked owners on the ballot');
    if (!ANON && st.voting.options.some(o => o.ownerName === name)) fail('voter can see own story');
    if (!st.voting.campers || st.voting.campers.length < 1) fail('no Best Camper options offered');
    if (st.voting.campers.some(c => c.name === name)) fail('player can vote themselves Best Camper');
    const up = st.voting.options[0].index;
    const down = st.voting.options[1].index;
    const bestCamper = st.voting.campers[0].id; // everyone crowns the first listed camper
    setTimeout(() => clients[name].emit('cast_vote', { up, down, bestCamper }), 50);
  }

  if (st.phase === 'results' && !done) {
    done = true;
    const r = st.results;
    const ups = r.tally.reduce((a, t) => a + t.up, 0);
    const downs = r.tally.reduce((a, t) => a + t.down, 0);
    if (ups !== 3 || downs !== 3) fail(`expected 3 golden + 3 burnt, got ${ups}/${downs}`);
    for (const t of r.tally) if (t.score !== t.up - t.down) fail('score math is off');
    if (r.awards.length !== 5) fail('expected 5 campfire awards, got ' + r.awards.length);
    if (!liveSeen) fail('live word count never appeared before Ana readied');
    if (!pasteSeen) fail('Ben\'s paste alert never showed in the status');
    const hallucinator = r.awards.find(a => a.title === 'The AI Hallucinator');
    if (!hallucinator) fail('no AI Hallucinator award');
    if (hallucinator.name !== 'Ben') fail('Hallucinator should be Ben (2 pastes), got ' + hallucinator.name);
    if (!/2 pastes/.test(hallucinator.value)) fail('Hallucinator evidence should cite 2 pastes, got: ' + hallucinator.value);
    if (!r.bestCampers || r.bestCampers.length < 1) fail('no Best Overall Camper crowned despite votes');
    const camperTotal = (r.camperTally || []).reduce((a, c) => a + c.votes, 0);
    if (camperTotal !== 3) fail('expected 3 Best Camper votes, got ' + camperTotal);
    const novelist = r.awards.find(a => a.title === 'The Novelist');
    if (novelist.name !== 'Ana') fail('Novelist should be Ana (most words), got ' + novelist.name);
    const demo = r.awards.find(a => a.title === 'The Demolitionist');
    if (demo.name !== 'Ben') fail('Demolitionist should be Ben, got ' + demo.name);
    if (!directorSeen) fail('no Camp Director was ever announced');
    if (r.tally.some(t => !t.ownerName)) fail('results should reveal all names');
    if (THEME && st.theme !== 'a haunted lighthouse') fail('theme missing at results');
    console.log('Camp Director was:', directorSeen, THEME ? '(theme: ' + st.theme + ')' : '');
    console.log('Tally:', r.tally.map(t => `${t.ownerName} ${t.up}up/${t.down}down=${t.score >= 0 ? '+' : ''}${t.score}`).join('  '));
    console.log('Awards:', r.awards.map(a => `${a.title}: ${a.name} (${a.value})`).join(' | '));
    console.log('Best Camper:', r.bestCampers.join(', '), '(' + r.camperTally.map(c => c.name + ':' + c.votes).join(' ') + ')');
    console.log('Winner(s):', r.winners.join(', '));
    console.log('ALL TESTS PASSED');
    process.exit(0);
  }
}

function connect(name) {
  const c = io(URL);
  clients[name] = c;
  c.on('state', (st) => handleState(name, st));
  return c;
}

const ana = connect('Ana');
ana.on('connect', () => {
  ana.emit('create_room', { name: 'Ana' }, (res) => {
    if (!res.ok) fail('create_room: ' + res.error);
    const code = res.code;
    console.log('Room created:', code);
    let joined = 0;
    for (const n of ['Ben', 'Cleo']) {
      const c = connect(n);
      c.on('connect', () => {
        c.emit('join_room', { code, name: n }, (r2) => {
          if (!r2.ok) fail('join_room ' + n + ': ' + r2.error);
          joined++;
          if (joined === 2) {
            ana.emit('update_settings', { seconds: 15, minWords: 1, maxWords: 0, visibility: 'full', votingSeconds: 10, anonymous: ANON, directorTheme: THEME });
            setTimeout(() => ana.emit('start_game'), 100);
          }
        });
      });
    }
  });
});

setTimeout(() => fail('timed out — game never reached results'), 25000);
