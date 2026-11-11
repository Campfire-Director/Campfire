/* Tests the new machinery end-to-end against the mock feeds:
   1. themeSource 'mixed' pulls news + reddit, entity-decoded, 8 shown
   2. suggestions are 8 and reroll produces a fresh set
   3. dev_quickstart: one human + two bots play a full game
   Run with: NEWS_FEEDS_JSON / REDDIT_HOSTS pointed at mock-feeds.js */
const { io } = require('socket.io-client');
const URL = 'http://localhost:3000';
function fail(m) { console.error('NEW-FEATURES TEST FAILED:', m); process.exit(1); }

/* ---------- Test 1+2: mixed feeds, cleaning, reroll ---------- */
function testFeedsAndReroll() {
  return new Promise((resolve) => {
    const clients = {};
    const connect = n => { const c = io(URL); clients[n] = c; return c; };
    let stage = 'first';       // first suggestions -> reroll -> verify
    let firstSuggestions = null;
    let feedsChecked = false;

    function drive(name, st) {
      if (st.phase !== 'theming' || !st.theming.youAreDirector) return;
      const t = st.theming;

      if (stage === 'first' && t.suggestions && t.suggestions.length) {
        if (t.suggestions.length !== 8) fail('expected 8 suggestions, got ' + t.suggestions.length);
        firstSuggestions = JSON.stringify(t.suggestions);
        stage = 'rerolled';
        clients[name].emit('reroll_theme');
        return;
      }
      if (stage === 'rerolled' && t.suggestions.length === 8 && JSON.stringify(t.suggestions) !== firstSuggestions) {
        stage = 'waiting-feeds';
      }
      if ((stage === 'waiting-feeds' || stage === 'rerolled') && t.headlines && t.headlines.length && !feedsChecked) {
        feedsChecked = true;
        const texts = t.headlines.map(h => h.text);
        const sources = new Set(t.headlines.map(h => h.source));
        // entity soup must be gone
        for (const x of texts) {
          if (/&(amp|quot|#\d+|#x[0-9a-f]+|rsquo|lt|gt);/i.test(x)) fail('entities survived cleaning: ' + x);
          if (/<[^>]*>/.test(x)) fail('markup survived cleaning: ' + x);
        }
        const joined = texts.join(' | ');
        if (!/Ben & Jerry's announces "world's largest" ice cream/.test(joined) &&
            !/won't ban Tuesdays — yet/.test(joined) &&
            !/giant squid near lighthouse/.test(joined) &&
            !/ketchup is technically jam/.test(joined) &&
            !/My cat won't stop "helping" me work/.test(joined))
          fail('no cleaned mock prompts found in: ' + joined);
        if (joined.includes('NSFW') || joined.includes('PINNED')) fail('nsfw/pinned post leaked through');
        // mixed source: both a news source and a reddit source present
        const hasNews = [...sources].some(s => s === 'MOCK');
        const hasReddit = [...sources].some(s => s.startsWith('r/'));
        if (!hasNews || !hasReddit) fail('mixed source missing a feed type: ' + [...sources].join(','));
        console.log('FEEDS OK — 8 suggestions, reroll changed them, prompts cleaned:', texts[0]);
        clients[name].emit('set_theme', { theme: 'mock theme' });
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
              ana.emit('update_settings', { seconds: 120, directorTheme: true, themeSource: 'mixed' });
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
    let voted = false;

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
          c.emit('update_settings', { seconds: 120, minWords: 1, votingSeconds: 60, directorTheme: false });
          setTimeout(() => c.emit('start_game'), 150);
        }
      }
      if (st.phase === 'writing' && !st.writing.ready && !readied.has(st.writing.round)) {
        if (!st.youAreDirector) fail('director must be the human in a dev room');
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

/* ---------- Test 4: OAuth layer + gzip via /debug/reddit ---------- */
function testRedditDiagnostics() {
  return new Promise((resolve) => {
    require('http').get('http://localhost:3000/debug/reddit', (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        const r = JSON.parse(data);
        if (!r.oauthConfigured) fail('debug endpoint says oauth not configured (env vars not passed?)');
        if (r.oauthToken !== 'ok') fail('oauth token fetch failed: ' + r.oauthToken);
        if (!r.verdict.startsWith('WORKING')) fail('verdict not WORKING: ' + r.verdict);
        for (const [sub, info] of Object.entries(r.subs)) {
          if (info.got < 1) fail('sub ' + sub + ' got no posts: ' + JSON.stringify(info.tried));
          const viaOauth = info.tried.find(t => t.via === 'oauth' && t.ok);
          if (!viaOauth) fail('sub ' + sub + ' did not succeed via oauth: ' + JSON.stringify(info.tried));
        }
        console.log('REDDIT DIAGNOSTICS OK —', r.verdict, '(oauth path, gzipped responses decompressed)');
        resolve();
      });
    }).on('error', e => fail('debug endpoint unreachable: ' + e.message));
  });
}

(async () => {
  await testFeedsAndReroll();
  await testDevQuickstart();
  await testRedditDiagnostics();
  console.log('ALL NEW-FEATURE TESTS PASSED');
  process.exit(0);
})();
setTimeout(() => fail('timed out'), 60000);
