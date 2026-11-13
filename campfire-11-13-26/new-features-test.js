/* Tests the new machinery end-to-end against the mock feeds:
   1. each player's theme picker: five tabs, 10 options each, live tabs cleaned
   2. reroll_theme changes only the tab it names
   3. dev_quickstart: one human + two bots pitch, vote on a theme and play a full game
   4. /debug/feeds reports every source working, with the right filtering
   Run with: NEWS_FEEDS_JSON / ONION_FEED_URL / WIKI_API_URL pointed at
   mock-feeds.js (the exact command is at the top of that file) */
const { io } = require('socket.io-client');
const URL = 'http://localhost:3000';
function fail(m) { console.error('NEW-FEATURES TEST FAILED:', m); process.exit(1); }

/* ---------- Test 1+2: the tabbed theme picker — five tabs, per-tab reroll ---------- */
function testFeedsAndReroll() {
  return new Promise((resolve) => {
    const clients = {};
    const connect = n => { const c = io(URL); clients[n] = c; return c; };
    let stage = 'first';
    let before = null;
    const EXPECTED = {
      news: ['Ben & Jerry\'s announces "world\'s largest" ice cream', 'Mayor says town & council won\'t ban Tuesdays — yet', 'Scientists find giant squid near lighthouse'],
      onion: ['Basketball Scouts See Potential In 7-Foot-5 Toddler', 'Graceland Celebrates First Elvis Born In… Captivity'],
      wiki: ['Bal des Ardents — A masquerade ball in which the king and some dancers accidentally get set on fire.', 'Emu War — Australia\'s army loses a war against emus.',
             'Did you know… that before being accepted to theatre school, Swedish actress Amanda Jansson worked at a nuclear power plant?'],
    };
    const texts = tab => tab.items.map(i => i.text.replace(/[\u2018\u2019]/g, "'"));

    function drive(name, st) {
      if (st.phase !== 'theming' || name !== 'FAna') return;   // every player gets their own picker; watch one
      const tabs = st.theming.tabs;
      const live = ['news', 'onion', 'wiki'];
      if (live.some(t => !tabs[t] || tabs[t].status === 'loading')) return;   // wait for the feeds

      if (stage === 'first') {
        for (const t of ['words', 'madlib']) {
          if (tabs[t].items.length !== 10) fail(t + ': expected 10 options, got ' + tabs[t].items.length);
          if (new Set(texts(tabs[t])).size !== 10) fail(t + ': options repeat');
        }
        for (const t of live) {
          if (tabs[t].status !== 'ready') fail(t + ' not ready: ' + JSON.stringify(tabs[t]));
          if (tabs[t].items.length > 10) fail(t + ': more than 10 shown');
          const got = texts(tabs[t]).sort().join('|'), want = [...EXPECTED[t]].sort().join('|');
          if (got !== want) fail(t + ' tab has the wrong prompts (cleaning/filter/dedupe): ' + got);
        }
        before = JSON.stringify(tabs);
        stage = 'rerolled';
        clients[name].emit('reroll_theme', { tab: 'words' });
        return;
      }
      if (stage === 'rerolled') {
        const was = JSON.parse(before);
        if (JSON.stringify(tabs.words) === JSON.stringify(was.words)) return;   // not rerolled yet
        if (tabs.words.items.length !== 10) fail('words: reroll did not deal 10');
        for (const t of ['madlib', 'news', 'onion', 'wiki'])
          if (JSON.stringify(tabs[t]) !== JSON.stringify(was[t])) fail('rerolling Words also changed ' + t);
        stage = 'done';
        console.log('THEME PICKER OK — 5 tabs, 10 per generated tab, live tabs cleaned, reroll changed only its own tab');
        Object.values(clients).forEach(c => c.disconnect());
        resolve();
      }
    }

    const ana = connect('FAna');
    ana.on('connect', () => {
      ana.emit('create_room', { name: 'FAna' }, (res) => {
        const code = res.code;
        let joined = 0;
        ['FBen', 'FCleo'].forEach(n => {
          const c = connect(n);
          c.on('connect', () => c.emit('join_room', { code, name: n }, () => {
            if (++joined === 2) {
              ana.emit('update_settings', { themeMode: 'vote' });
              setTimeout(() => ana.emit('start_game'), 150);
            }
          }));
          c.on('state', st => drive(n, st));
        });
        ana.on('state', st => drive('FAna', st));
      });
    });
  });
}

/* ---------- Test 3: dev quickstart solo game ---------- */
function testDevQuickstart() {
  return new Promise((resolve) => {
    const c = io(URL);
    let started = false;
    const readied = new Set();
    const advanced = new Set();
    let voted = false, pitched = false, themeVoted = false;

    c.on('connect', () => {
      c.emit('dev_quickstart', { name: 'Solo', camper: 'ember' }, (res) => {
        if (!res || !res.ok) fail('dev_quickstart rejected');
      });
    });
    c.on('state', (st) => {
      if (st.phase === 'lobby') {
        if (st.players.length !== 3) fail('dev room should have 3 players, has ' + st.players.length);
        if (st.players.filter(p => p.name.includes('🤖')).length !== 2) fail('expected 2 bots in the lobby');
        if (!st.isHost) fail('human should be host of the dev room');
        if (!started) {
          started = true;
          c.emit('update_settings', { themeMode: 'vote' });   // bots must pitch and vote on themes too
          setTimeout(() => c.emit('start_game'), 150);
        }
      }
      if (st.phase === 'theming' && !st.theming.pitched && !pitched) {
        pitched = true;
        setTimeout(() => c.emit('submit_theme', { theme: 'solo theme' }), 100);
      }
      if (st.phase === 'themevote' && st.themeVote.voted === null && !themeVoted) {
        themeVoted = true;
        const open = st.themeVote.options.filter(o => !o.yours);
        if (!open.length) fail('no theme to vote for in the solo room');
        setTimeout(() => c.emit('vote_theme', { index: open[0].index }), 100);
      }
      if (st.phase === 'writing' && !st.writing.ready && !readied.has(st.writing.round)) {
        if (!st.theme) fail('solo game reached writing without a theme');
        readied.add(st.writing.round);
        setTimeout(() => c.emit('ready', { text: 'Solo writes round ' + (st.writing.round + 1), backspaces: 1, seconds: 4 }), 150);
      }
      if (st.phase === 'reading' && !advanced.has(st.reading.index)) {
        advanced.add(st.reading.index);
        setTimeout(() => c.emit('advance_reading', { dir: 'next' }), 120);
      }
      if (st.phase === 'voting' && !st.voting.voted && !voted) {
        voted = true;
        const up = st.voting.options[0].index, down = st.voting.options[1].index;
        setTimeout(() => c.emit('cast_vote', { up, down, bestCamper: st.voting.campers[0].id }), 150);
      }
      if (st.phase === 'results') {
        const r = st.results;
        if (r.tally.length !== 3) fail('expected 3 stories in solo playtest');
        if (r.awards.length !== 5) fail('expected 5 awards');
        console.log('DEV QUICKSTART OK — solo human + 2 bots reached results. Winner:', r.winners.join(', '));
        c.disconnect();
        resolve();
      }
    });
  });
}

/* ---------- Test 4: the live-feed diagnostics page ---------- */
function testFeedDiagnostics() {
  return new Promise((resolve) => {
    require('http').get(URL + '/debug/feeds', (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        const r = JSON.parse(data);
        if (!String(r.verdict).startsWith('WORKING')) fail('verdict not WORKING: ' + JSON.stringify(r));
        if (r.news.got !== 3) fail('news: expected 3, got ' + r.news.got);
        // 6 Onion items over 2 pages: minus a chart, a video, a blocked word and a duplicate
        if (r.onion.got !== 2) fail('onion: expected 2 after filtering, got ' + r.onion.got + ' ' + JSON.stringify(r.onion));
        if (!r.onion.tried.some(t => t.error)) fail('onion: the missing page 3 should be reported, not fatal');
        // 3 topic pages x 2 allowed rows (1 blocked) + 1 did-you-know fact
        if (r.wikipedia.got !== 7) fail('wikipedia: expected 7, got ' + r.wikipedia.got + ' ' + JSON.stringify(r.wikipedia));
        console.log('FEED DIAGNOSTICS OK —', r.verdict);
        resolve();
      });
    }).on('error', e => fail('debug endpoint unreachable: ' + e.message));
  });
}

(async () => {
  await testFeedsAndReroll();
  await testDevQuickstart();
  await testFeedDiagnostics();
  console.log('ALL NEW-FEATURE TESTS PASSED');
  process.exit(0);
})();
setTimeout(() => fail('timed out'), 60000);
