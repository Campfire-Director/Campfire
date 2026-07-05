/* ==========================================================
   STORY RELAY — game server ("the referee")
   Holds the one true copy of every room's game state,
   enforces the rules, and tells each player's browser
   what to show.
   ========================================================== */

const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');
const https = require('https');

const app = express();
const server = http.createServer(app);
// maxHttpBufferSize is raised so base64 audio clips fit through Socket.IO.
// AUDIO MODE MEMORY NOTE: clips live in server RAM for the life of the room
// and are discarded when it closes. Fine for game nights; for permanent
// storage you'd offload clips to something like S3 instead.
const io = new Server(server, { maxHttpBufferSize: 8 * 1024 * 1024 }); // 8 MB
app.use(express.static(path.join(__dirname, 'public')));
const PORT = process.env.PORT || 3000;

const rooms = new Map();
let nextPlayerId = 1;

/* ==========================================================
   DATA ON DISK — analytics counters + room snapshots.
   Lives in ./data (or DATA_DIR env var). On Render's free tier
   the disk is wiped on each deploy, so this protects against
   process crashes/restarts, not redeploys — attach a Render
   persistent disk (or point DATA_DIR at one) for full durability.
   ========================================================== */
const fs = require('fs');
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
try { fs.mkdirSync(DATA_DIR, { recursive: true }); } catch (e) {}
const STATS_FILE = path.join(DATA_DIR, 'stats.json');
const ROOMS_FILE = path.join(DATA_DIR, 'rooms.json');

/* ---------- Analytics: a handful of privacy-light counters ----------
   No names, no story text — just enough numbers to know how the
   game is doing. THE health metric is completion rate:
   gamesFinished / gamesStarted. */
let stats = {
  roomsCreated: 0,
  playersJoined: 0,       // every join (not counting reconnects)
  gamesStarted: 0,
  gamesFinished: 0,       // reached the results screen
  playersPerGameSum: 0,   // for the average: sum / gamesStarted
  settingsUse: { audioMode: 0, anonymous: 0, directorTheme: 0, themeNews: 0, themeReddit: 0, devPlaytest: 0 },
  since: new Date().toISOString(),
};
try {
  const loaded = JSON.parse(fs.readFileSync(STATS_FILE, 'utf8'));
  stats = { ...stats, ...loaded, settingsUse: { ...stats.settingsUse, ...(loaded.settingsUse || {}) } };
} catch (e) { /* first boot — start fresh */ }

let statsDirty = false;
function bump(key, sub) {
  if (sub) stats[key][sub]++;
  else stats[key]++;
  statsDirty = true;
}
setInterval(() => {
  if (!statsDirty) return;
  statsDirty = false;
  fs.writeFile(STATS_FILE, JSON.stringify(stats, null, 2), () => {});
}, 5000).unref();

// Read the numbers at /stats. Optionally set a STATS_KEY env var to
// require /stats?key=... — otherwise it's open (fine for a friend project).
app.get('/stats', (req, res) => {
  if (process.env.STATS_KEY && req.query.key !== process.env.STATS_KEY) {
    return res.status(403).json({ error: 'wrong or missing ?key=' });
  }
  const completionRate = stats.gamesStarted ? +(stats.gamesFinished / stats.gamesStarted).toFixed(3) : null;
  const avgPlayers = stats.gamesStarted ? +(stats.playersPerGameSum / stats.gamesStarted).toFixed(2) : null;
  res.json({ ...stats, completionRate, avgPlayersPerGame: avgPlayers, activeRooms: rooms.size });
});

/* ---------- Room persistence: survive a server restart ----------
   Rooms are snapshotted to disk (debounced) and restored on boot.
   Timer handles and live sockets can't be serialized: timers are
   recreated from the saved deadlines, and every player is restored
   as "disconnected" — the existing rejoin-by-name flow picks them
   back up the moment their browser reconnects. Audio clips are NOT
   snapshotted (they can be tens of MB); a restored audio-mode game
   keeps its structure but loses the recordings. */
let roomsDirty = false;
function markDirty() { roomsDirty = true; }

function serializeRooms() {
  const list = [];
  for (const room of rooms.values()) {
    const { timer, votingTimer, themeTimer, ...rest } = room;
    list.push({
      ...rest,
      players: room.players.map(p => ({ ...p, socketId: null })),
      stories: room.stories.map(st => ({
        segments: st.segments.map(seg => ({ ...seg, audio: null })),
      })),
      pending: Object.fromEntries(Object.entries(room.pending || {})
        .map(([k, v]) => [k, { ...v, audio: null }])),
    });
  }
  return { nextPlayerId, rooms: list };
}

setInterval(() => {
  if (!roomsDirty) return;
  roomsDirty = false;
  fs.writeFile(ROOMS_FILE, JSON.stringify(serializeRooms()), () => {});
}, 5000).unref();

function restoreRooms() {
  let snap;
  try { snap = JSON.parse(fs.readFileSync(ROOMS_FILE, 'utf8')); }
  catch (e) { return; } // nothing to restore
  nextPlayerId = Math.max(nextPlayerId, snap.nextPlayerId || 1);
  let revived = 0;
  for (const r of (snap.rooms || [])) {
    const room = { ...r, timer: null, votingTimer: null, themeTimer: null };
    // Humans come back disconnected (they'll rejoin by name); bots are
    // server-driven, so they're simply awake again.
    room.players.forEach(p => { p.connected = !!p.isBot; p.socketId = null; });
    rooms.set(room.code, room);
    reviveTimers(room);
    scheduleEmptyRoomCleanup(room);
    revived++;
  }
  if (revived) console.log(`Restored ${revived} room(s) from the last snapshot.`);
}

// Recreate the phase clock from a restored room's saved deadline
function reviveTimers(room) {
  const now = Date.now();
  if (room.phase === 'writing') {
    if (room.paused) {
      // was paused when we went down — keep the 30s safety auto-resume
      room.timer = setTimeout(() => resumeRound(room), 30 * 1000);
    } else {
      const remaining = Math.max(1000, (room.endsAt || now) - now);
      room.timer = setTimeout(() => endWritingRound(room), remaining + 2000);
    }
    scheduleBots(room); // dev bots pick their pens back up
  } else if (room.phase === 'voting') {
    const remaining = Math.max(1000, (room.votingEndsAt || now) - now);
    room.votingTimer = setTimeout(() => endVoting(room), remaining + 1500);
    scheduleBots(room);
  } else if (room.phase === 'theming') {
    const remaining = Math.max(1000, (room.themeEndsAt || now) - now);
    room.themeTimer = setTimeout(() => finishTheming(room, null), remaining + 1500);
  }
}

// A restored room starts with only bots (if any) awake; if no human comes
// back within 10 minutes, let it go (same grace as a live room).
function scheduleEmptyRoomCleanup(room) {
  setTimeout(() => {
    if (rooms.has(room.code) && room.players.every(p => p.isBot || !p.connected)) {
      rooms.delete(room.code);
      markDirty();
    }
  }, 10 * 60 * 1000).unref();
}

// One last snapshot on the way down (Render sends SIGTERM on restarts)
function saveNowAndExit() {
  try { fs.writeFileSync(ROOMS_FILE, JSON.stringify(serializeRooms())); } catch (e) {}
  try { fs.writeFileSync(STATS_FILE, JSON.stringify(stats, null, 2)); } catch (e) {}
  process.exit(0);
}
process.on('SIGTERM', saveNowAndExit);
process.on('SIGINT', saveNowAndExit);

// The camper avatar presets players can pick on the title screen
const CAMPER_IDS = ['ember', 'moss', 'wren', 'maple', 'marsh', 'bark'];
function cleanCamper(c) { return CAMPER_IDS.includes(c) ? c : null; }

function makeRoomCode() {
  const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  let code;
  do {
    code = Array.from({ length: 4 }, () =>
      letters[Math.floor(Math.random() * letters.length)]).join('');
  } while (rooms.has(code));
  return code;
}

// A grab-bag of evocative prompt words the Director can pick from
// if they're stuck. Edit freely — more variety is better.
const THEME_WORDS = [
  'betrayal', 'a haunted lighthouse', 'the worst birthday', 'buried treasure',
  'a wrong number', 'the last train', 'forbidden cheese', 'a talking cat',
  'midnight snack', 'the broken promise', 'a stolen identity', 'one bad decision',
  'the family secret', 'a desert mirage', 'the final exam', 'an unexpected guest',
  'the time machine', 'a haunted vending machine', 'the dragon\'s diary',
  'lost in the woods', 'the cursed sandwich', 'a message in a bottle',
  'the heist gone wrong', 'an alien penpal', 'the last slice of pizza',
  'a swapped briefcase', 'the lighthouse keeper', 'revenge of the houseplant',
  'the wedding disaster', 'a ghost with regrets', 'the suspicious neighbor',
  'an inheritance with strings', 'the underwater city', 'a deal with a goblin',
  // — the extended cut —
  'the world\'s worst superhero', 'a very polite apocalypse', 'the office holiday party',
  'grandma\'s secret recipe', 'the elevator that went sideways', 'a mattress full of money',
  'the town that banned Tuesdays', 'a knight afraid of horses', 'the moon is missing',
  'an extremely cursed garage sale', 'the substitute teacher', 'a pigeon with a plan',
  'the five-star review', 'witness protection for a wizard', 'the neighborhood watch',
  'a vampire\'s dentist appointment', 'the world\'s longest yard sale', 'jury duty on Mars',
  'the fortune cookie was right', 'a mermaid in the community pool', 'the group chat leaks',
  'the last blockbuster on earth', 'a scarecrow\'s day off', 'the potluck incident',
  'an octopus learns to drive', 'the retirement home talent show', 'a very haunted IKEA',
  'the sourdough starter awakens', 'a raccoon runs for mayor', 'the karaoke championship',
  'someone microwaved fish at work', 'the ghost only haunts on weekends', 'a spy at the farmers market',
  'the escape room has no exit', 'grandpa\'s conspiracy board was right', 'a dragon at the DMV',
  'the world\'s most cursed thrift store', 'a snail with somewhere to be', 'the HOA versus the werewolf',
  'a birthday clown\'s villain origin', 'the camping trip goes sideways', 'a genie with a lawyer',
  'the school play goes off-script', 'an immortal\'s gym membership', 'the bakery at the end of the world',
  'a lighthouse for lost socks', 'the museum heist (of one spoon)', 'a bear discovers coupons',
  'the family reunion time loop', 'a robot\'s first pet', 'the babysitter is a bounty hunter',
  'the world runs out of coffee', 'a duel settled by karaoke', 'the ice cream truck at midnight',
  'a fortune teller who\'s never wrong (twice)', 'the volcano\'s retirement party', 'a very slow car chase',
  'the roommate who never sleeps', 'a treasure map on a napkin', 'the plants are gossiping',
  'a superhero with a day job at a deli', 'the ferry to nowhere', 'a wizard\'s customer service hotline',
  'the smallest giant', 'a detective allergic to clues', 'the sleepover that lasted a decade',
  'an astronaut\'s houseplant', 'the neighborhood cryptid bake-off', 'a piano that plays the future',
  'the elevator pitch (in an actual elevator)', 'a lifeguard at the haunted lake', 'the recipe called for one ghost',
  'a courtroom sketch artist\'s revenge', 'the last phone booth', 'an extremely local news story',
  'the tooth fairy\'s union dispute', 'a map where X marks a Denny\'s', 'the world\'s politest heist',
  'a weather forecaster who controls the weather', 'the yard gnome uprising', 'a library book 40 years overdue',
];

/* ---------- The mad-lib prompt machine ----------
   Assembles a fresh, absurd prompt from parts — thousands of combos,
   so the Director never sees the same suggestion twice. */
const ML_ADJ = ['haunted', 'suspiciously cheap', 'extremely polite', 'radioactive', 'invisible',
  'legally distinct', 'unionized', 'cursed', 'gluten-free', 'award-winning', 'semi-professional',
  'ancient', 'inflatable', 'government-issued', 'emotionally unavailable', 'off-brand',
  'time-traveling', 'lightly used', 'forbidden', 'municipal'];
const ML_NOUN = ['lighthouse', 'sandwich', 'raccoon', 'wedding cake', 'submarine', 'accordion',
  'vending machine', 'group chat', 'crossbow', 'hot tub', 'scarecrow', 'tax audit', 'jetpack',
  'birthday clown', 'sourdough starter', 'garden gnome', 'escape room', 'karaoke machine',
  'houseplant', 'briefcase'];
const ML_PLACE = ['at the DMV', 'on the moon', 'in a Denny\'s parking lot', 'at grandma\'s house',
  'during jury duty', 'at the farmers market', 'in the break room', 'at the bottom of the sea',
  'at a middle school talent show', 'in witness protection', 'at the world\'s fair',
  'inside a snow globe', 'at the neighborhood watch meeting', 'during the big game',
  'at a very serious auction'];
const ML_TWIST = ['but everyone is lying', 'and the dog knows too much', 'with one hour to live',
  'but nobody remembers why', 'and it\'s somehow your fault', 'but the wifi is down',
  'and the prophecy was a typo', 'but it\'s technically legal', 'and the moon is watching',
  'but the intern is in charge', 'and there\'s a waiting list', 'but it\'s cake',
  'and the ghosts are unionizing', 'but the map is upside down', 'and it\'s all on camera'];

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function makeMadLib() {
  const forms = [
    () => `a ${pick(ML_ADJ)} ${pick(ML_NOUN)}`,
    () => `a ${pick(ML_ADJ)} ${pick(ML_NOUN)} ${pick(ML_PLACE)}`,
    () => `the ${pick(ML_NOUN)} ${pick(ML_PLACE)}, ${pick(ML_TWIST)}`,
    () => `a ${pick(ML_ADJ)} ${pick(ML_NOUN)}, ${pick(ML_TWIST)}`,
    () => `two ${pick(ML_NOUN)}s ${pick(ML_PLACE)}`,
  ];
  return pick(forms)();
}

function pickThemeWords(n) {
  const pool = [...THEME_WORDS];
  shuffle(pool);
  return pool.slice(0, n);
}

/* The Director's suggestion chips, shaped by the theme source:
   words → mostly the curated list with a couple of mad-libs mixed in;
   madlib → all freshly generated; live sources also get this blend
   as their instant fallback while feeds load. */
function pickSuggestions(source, n) {
  n = n || 8;
  if (source === 'madlib') {
    return Array.from({ length: n }, makeMadLib);
  }
  const words = pickThemeWords(Math.ceil(n * 0.6));
  const libs = Array.from({ length: n - words.length }, makeMadLib);
  return shuffle([...words, ...libs]);
}

/* ==========================================================
   NEWS HEADLINES — pulled from public RSS feeds (BBC + CNN)
   for the optional "News Headline" theme source. Headlines
   are cached briefly so we don't hit the feeds every game.
   NOTE: requires open outbound internet (works on Render;
   blocked in some sandboxes). Always degrades gracefully —
   if fetching fails, the Director just sees word suggestions.
   ========================================================== */
const NEWS_FEEDS = process.env.NEWS_FEEDS_JSON ? JSON.parse(process.env.NEWS_FEEDS_JSON) : [
  { name: 'BBC', url: 'https://feeds.bbci.co.uk/news/world/rss.xml' },
  { name: 'CNN', url: 'https://rss.cnn.com/rss/edition_world.rss' },
  { name: 'FOX', url: 'https://moxie.foxnews.com/google-publisher/latest.xml' },
];
let headlineCache = { at: 0, items: [] };
const HEADLINE_TTL = 5 * 60 * 1000; // 5 minutes

function fetchUrl(url, redirectsLeft = 3) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('http:') ? require('http') : https;
    const req = lib.get(url, {
      headers: {
        // Reddit (and some CDNs) refuse obviously-botty user agents with a
        // 403, especially from cloud IPs — a real browser string gets through.
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
        'Accept': 'application/json, application/rss+xml, application/xml, text/xml, */*',
      },
      timeout: 6000,
    }, (res) => {
      // Follow redirects — reddit.com and several RSS feeds 301/302 hop
      if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location && redirectsLeft > 0) {
        res.resume();
        const next = new URL(res.headers.location, url).href;
        return resolve(fetchUrl(next, redirectsLeft - 1));
      }
      if (res.statusCode !== 200) { res.resume(); return reject(new Error('HTTP ' + res.statusCode)); }
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve(data));
    });
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
    req.on('error', reject);
  });
}

/* Feeds love their HTML entities ("&amp;#39;", "&quot;" …). Decode them
   (twice — some feeds double-encode) and strip stray tags so prompts
   read like sentences instead of markup soup. */
const NAMED_ENTITIES = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
  mdash: '—', ndash: '–', hellip: '…', rsquo: '\u2019', lsquo: '\u2018',
  rdquo: '\u201d', ldquo: '\u201c', copy: '©', reg: '®', trade: '™',
  pound: '£', euro: '€', deg: '°', middot: '·', laquo: '«', raquo: '»',
};
function decodeEntitiesOnce(s) {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&([a-z]+);/gi, (m, name) => NAMED_ENTITIES[name.toLowerCase()] ?? m);
}
function cleanFeedText(s) {
  let out = decodeEntitiesOnce(decodeEntitiesOnce(String(s)));  // handles "&amp;#39;"
  out = out.replace(/<[^>]*>/g, '');       // stray markup
  out = out.replace(/\s+/g, ' ').trim();   // collapse whitespace
  return out;
}

// Pull <title> values out of an RSS document (skipping the channel title)
function parseHeadlines(xml, source) {
  const titles = [...xml.matchAll(/<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/g)]
    .map(m => cleanFeedText(m[1]))
    .filter(Boolean);
  // The first <title> is the feed's own name; drop it
  return titles.slice(1).map(t => ({ text: t, source }));
}

async function getHeadlines() {
  // Serve from cache if fresh
  if (Date.now() - headlineCache.at < HEADLINE_TTL && headlineCache.items.length) {
    return headlineCache.items;
  }
  const all = [];
  await Promise.all(NEWS_FEEDS.map(async (feed) => {
    try {
      const xml = await fetchUrl(feed.url);
      all.push(...parseHeadlines(xml, feed.name));
    } catch (e) {
      console.log('Headline fetch failed for ' + feed.name + ': ' + e.message);
    }
  }));
  if (all.length) headlineCache = { at: Date.now(), items: all };
  return all.length ? all : headlineCache.items; // fall back to last good cache
}

// Pick a handful of varied prompts for the Director to choose from
function pickHeadlines(all, n) {
  const pool = [...all];
  shuffle(pool);
  // Keep them a reasonable length for a story prompt
  return pool.filter(h => h.text.length >= 12 && h.text.length <= 140).slice(0, n);
}

/* ==========================================================
   REDDIT PROMPTS — post titles from comedy-friendly subreddits
   via Reddit's public JSON endpoints. NSFW-flagged and pinned
   posts are filtered out. Same graceful fallback as news:
   if Reddit is unreachable, word suggestions carry the day.
   ========================================================== */
const REDDIT_SUBS = [
  'Showerthoughts', 'nottheonion', 'AskReddit',
  'BrandNewSentence', 'CrazyIdeas', 'shittysuperpowers',
];
let redditCache = { at: 0, items: [] };

function parseRedditPosts(json, sub) {
  try {
    const posts = JSON.parse(json).data.children || [];
    return posts
      .map(p => p.data)
      .filter(d => d && d.title && !d.over_18 && !d.stickied)
      .map(d => ({ text: cleanFeedText(d.title), source: 'r/' + sub }));
  } catch (e) {
    return [];
  }
}

async function getRedditPosts() {
  if (Date.now() - redditCache.at < HEADLINE_TTL && redditCache.items.length) {
    return redditCache.items;
  }
  const all = [];
  await Promise.all(REDDIT_SUBS.map(async (sub) => {
    // www.reddit.com sometimes 403s cloud-hosted requests; old.reddit.com is
    // usually more forgiving, so try both before giving up on a sub.
    // (REDDIT_HOSTS env var overrides, comma-separated — handy for testing.)
    const hosts = (process.env.REDDIT_HOSTS || 'https://www.reddit.com,https://old.reddit.com').split(',');
    for (const host of hosts) {
      try {
        const body = await fetchUrl(host + '/r/' + sub + '/hot.json?limit=30&raw_json=1');
        const posts = parseRedditPosts(body, sub);
        if (posts.length) { all.push(...posts); return; }
      } catch (e) {
        console.log('Reddit fetch failed for r/' + sub + ' via ' + host + ': ' + e.message);
      }
    }
  }));
  if (all.length) redditCache = { at: Date.now(), items: all };
  return all.length ? all : redditCache.items;
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function countWords(text) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function truncateWords(text, max) {
  return text.trim().split(/\s+/).slice(0, max).join(' ') + '…';
}

/* ---------- Room helpers ---------- */

/* ==========================================================
   DEV PLAYTEST BOTS
   The "Solo playtest" button on the home screen builds a room
   with two server-driven bots so one human can walk every phase
   of the game alone. Bots write a silly line a few seconds into
   each round, vote semi-randomly, and never get crowned Director.
   They're ordinary players in every other way, so what you see
   is exactly what a real game does.
   ========================================================== */
const BOT_ROSTER = [
  { name: 'Botrick 🤖', camper: 'moss' },
  { name: 'Beep Cassidy 🤖', camper: 'wren' },
];
const BOT_LINES = [
  'Suddenly, a raccoon in a tiny vest appeared and demanded rent.',
  'Nobody mentioned the lighthouse had opinions, but here we were.',
  '"This is fine," said the ghost, who had clearly never been fine.',
  'The map led directly to a Denny\'s, which honestly tracked.',
  'Against all advice, the sandwich was eaten. The curse began.',
  'A distant kazoo played. Everyone pretended not to hear it.',
  'The moon blinked. Moons should not blink.',
  'It turned out the treasure was paperwork. So much paperwork.',
  'The dog knew. The dog had always known.',
  'Somewhere, an accordion started playing on its own.',
  'Plot twist: the narrator had been the villain\'s houseplant all along.',
  'And that\'s when the vending machine made its counteroffer.',
];

function botLine() {
  return BOT_LINES[Math.floor(Math.random() * BOT_LINES.length)];
}

// A bot submits its segment (mirrors the 'ready' handler's rules)
function botSubmit(room, botId) {
  if (room.phase !== 'writing') return;
  const seat = seatOf(room, botId);
  if (seat === -1 || room.pending[seat] !== undefined) return;
  room.pending[seat] = {
    text: botLine(),
    audio: null,
    backspaces: Math.floor(Math.random() * 6),
    seconds: 3 + Math.floor(Math.random() * 8),
    real: true,
  };
  const connectedSeats = room.seats.filter(pid => getPlayer(room, pid).connected);
  const readyConnected = connectedSeats.filter((pid) => room.pending[seatOf(room, pid)] !== undefined);
  if (readyConnected.length >= connectedSeats.length) endWritingRound(room);
  else broadcast(room);
}

// A bot casts its marshmallows (mirrors 'cast_vote' rules: never its own
// story, never itself for Best Camper)
function botVote(room, botId) {
  if (room.phase !== 'voting') return;
  const seat = seatOf(room, botId);
  if (seat === -1 || room.votes[seat] !== undefined) return;
  const options = room.stories.map((_, i) => i).filter(i => i !== seat);
  shuffle(options);
  room.votes[seat] = { up: options[0] ?? null, down: options[1] ?? null };
  const camperOptions = room.seats.filter(pid => pid !== botId);
  if (camperOptions.length) room.camperVotes[seat] = camperOptions[Math.floor(Math.random() * camperOptions.length)];
  const stillWaiting = room.seats.some((pid, s) =>
    room.votes[s] === undefined && getPlayer(room, pid).connected);
  if (!stillWaiting) endVoting(room);
  else broadcast(room);
}

// Called at the start of each writing round / voting window
function scheduleBots(room) {
  for (const p of room.players) {
    if (!p.isBot) continue;
    if (room.phase === 'writing') {
      setTimeout(() => botSubmit(room, p.id), 2500 + Math.random() * 3500);
    } else if (room.phase === 'voting') {
      setTimeout(() => botVote(room, p.id), 1500 + Math.random() * 2000);
    }
  }
}


function createRoom() {
  const room = {
    code: makeRoomCode(),
    hostId: null,        // whoever created the room (controls the lobby)
    directorId: null,    // the Camp Director — randomly crowned each game
    players: [],         // { id, name, socketId, connected }
    settings: { seconds: 90, minWords: 10, maxWords: 60, visibility: 'full', votingSeconds: 10, anonymous: false, directorTheme: false, mode: 'text', themeSource: 'words' },
    theme: null,         // the Director's chosen prompt, when Director's Theme is on
    themeEndsAt: null,
    themeTimer: null,
    phase: 'lobby',      // lobby -> writing -> reading -> voting -> results
    seats: [],           // player ids in ring order (the passing order)
    stories: [],
    round: 0,
    pending: {},         // this round's "ready" submissions: seat -> {text, backspaces, seconds, real}
    stats: {},           // per-seat totals for the campfire awards
    endsAt: null,
    timer: null,
    paused: false,
    pausedRemaining: 0,   // ms left on the clock when paused
    readIndex: 0,
    votes: {},           // seat -> { up, down } (golden + burnt marshmallow)
    camperVotes: {},     // voterSeat -> playerId they crowned Best Camper
    votingEndsAt: null,
    votingTimer: null,
  };
  rooms.set(room.code, room);
  return room;
}

function getPlayer(room, playerId) {
  return room.players.find(p => p.id === playerId);
}

function seatOf(room, playerId) {
  return room.seats.indexOf(playerId);
}

// The "leader" — host or Camp Director — drives shared navigation
function pid_is_leader(room, playerId) {
  return playerId === room.hostId || playerId === room.directorId;
}

// THE ROTATION RULE: in round r, the player in seat s writes the
// story owned by seat (s - r), wrapping around the ring.
function storyForSeat(room, seat, round) {
  const n = room.seats.length;
  return (seat - round + n * 10) % n;
}

/* ---------- Campfire awards (the runner-up recognitions) ---------- */

/* ---------- The AI Hallucinator's evidence locker ----------
   Entirely tongue-in-cheek. The "tells" are the internet's favorite
   AI-writing clichés — em-dashes, "delve", "tapestry" — plus pasting
   into the box and typing suspiciously fast with zero mistakes.
   Nobody is actually being accused of anything except being funny. */
function countEmDashes(text) {
  return (text.match(/—|--/g) || []).length;
}

const AI_BUZZWORDS = /\b(delve|delving|tapestry|testament|moreover|furthermore|myriad|plethora|intricate|nuanced|symphony|kaleidoscope|seamless(?:ly)?|foster(?:ing)?|embark(?:ed|ing)?|multifaceted|paradigm|synergy|elevate[sd]?|underscore[sd]?)\b|in conclusion|it'?s (?:important|worth) (?:to note|noting)|rich tapestry/gi;
function countAiBuzzwords(text) {
  return (text.match(AI_BUZZWORDS) || []).length;
}

function computeAwards(room) {
  const entries = room.seats.map((pid, seat) => {
    const st = room.stats[seat] || { words: 0, backspaces: 0, seconds: 0 };
    const minutes = Math.max(st.seconds, 5) / 60; // avoid silly division
    const wpm = st.words > 0 ? st.words / minutes : 0;
    const pastes = st.pastes || 0, emdash = st.emdash || 0, buzz = st.buzz || 0;
    // The suspicion score: pasting is the smoking gun, buzzwords are
    // strong circumstantial evidence, em-dashes are a pattern, and
    // flawless 90+ wpm over a real chunk of text raises an eyebrow.
    const roboWpm = wpm >= 90 && st.words > 30 && st.backspaces <= 2;
    const aiScore = pastes * 3 + buzz * 2 + emdash + (roboWpm ? 2 : 0);
    return {
      name: getPlayer(room, pid).name,
      words: st.words,
      backspaces: st.backspaces,
      seconds: st.seconds,
      wpm,
      pastes, emdash, buzz, roboWpm, aiScore,
    };
  });
  const pick = key => entries.reduce((a, b) => (b[key] > a[key] ? b : a));
  const w = pick('words'), b = pick('backspaces'), s = pick('wpm'), t = pick('seconds');
  const ai = pick('aiScore');

  // Build the Hallucinator's rap sheet from whatever evidence exists
  let aiAward;
  if (ai.aiScore > 0) {
    const evidence = [];
    if (ai.pastes) evidence.push(`${ai.pastes} paste${ai.pastes > 1 ? 's' : ''}`);
    if (ai.buzz) evidence.push(`${ai.buzz} AI word${ai.buzz > 1 ? 's' : ''}`);
    if (ai.emdash) evidence.push(`${ai.emdash} em-dash${ai.emdash > 1 ? 'es' : ''}`);
    if (ai.roboWpm) evidence.push('inhumanly clean typing');
    aiAward = { title: 'The AI Hallucinator', desc: 'Most suspiciously artificial prose', name: ai.name, value: evidence.join(' · ') };
  } else {
    aiAward = { title: 'The AI Hallucinator', desc: 'Most suspiciously artificial prose', name: '— nobody —', value: 'the fire finds everyone human' };
  }

  return [
    { title: 'The Novelist', desc: 'Most words typed', name: w.name, value: `${w.words} words` },
    { title: 'The Demolitionist', desc: 'Most backspaces', name: b.name, value: `${b.backspaces} backspaces` },
    { title: 'The Speed Demon', desc: 'Fastest typing', name: s.name, value: `${Math.round(s.wpm)} wpm` },
    { title: 'The Slow Roaster', desc: 'Most time at the fire', name: t.name, value: `${Math.round(t.seconds)}s writing` },
    aiAward,
  ];
}

/* ---------- Building each player's personal view ---------- */

function viewFor(room, playerId) {
  const me = getPlayer(room, playerId);
  const director = room.directorId ? getPlayer(room, room.directorId) : null;
  const view = {
    code: room.code,
    phase: room.phase,
    youId: playerId,
    youName: me ? me.name : '',
    isHost: room.hostId === playerId,
    youAreDirector: room.directorId === playerId,
    directorName: director ? director.name : null,
    settings: room.settings,
    players: room.players.map(p => ({
      name: p.name,
      connected: p.connected,
      isHost: p.id === room.hostId,
      camper: p.camper || null,
    })),
  };

  view.theme = room.theme; // null unless Director's Theme is set
  view.mode = room.settings.mode; // 'text' or 'audio'

  if (room.phase === 'theming') {
    view.theming = {
      youAreDirector: room.directorId === playerId,
      endsAt: room.themeEndsAt,
      suggestions: room.themeSuggestions || [],
      headlines: room.themeHeadlines || [], // [] unless News source + fetch succeeded
    };
  }

  if (room.phase === 'writing') {
    const n = room.seats.length;
    const seat = seatOf(room, playerId);
    const storyIdx = storyForSeat(room, seat, room.round);
    const story = room.stories[storyIdx];
    const ready = room.pending[seat] !== undefined;

    let context;
    const audio = room.settings.mode === 'audio';
    if (room.round === 0) {
      context = { mode: 'new', segments: [], audio: [] };
    } else if (audio) {
      // True telephone: you hear ONLY the previous recording
      const prev = story.segments[story.segments.length - 1];
      context = { mode: 'last', segments: [], audio: [prev.audio || null] };
    } else if (room.settings.visibility === 'full') {
      context = { mode: 'full', segments: story.segments.map(s => s.text), audio: [] };
    } else {
      context = { mode: 'last', segments: [story.segments[story.segments.length - 1].text], audio: [] };
    }

    view.writing = {
      round: room.round,
      totalRounds: n,
      endsAt: room.endsAt,
      paused: room.paused,
      pausedRemaining: room.pausedRemaining,
      anyDisconnected: room.seats.some(pid => !getPlayer(room, pid).connected),
      ready,
      readyCount: Object.keys(room.pending).length,
      total: n,
      context,
      status: room.seats.map((pid, s) => {
        const done = room.pending[s] !== undefined;
        const live = (room.live || {})[s] || {};
        // once someone's in, show their final word count; before that, the live one
        const words = (done && room.pending[s].real && room.pending[s].text)
          ? countWords(room.pending[s].text)
          : (live.words || 0);
        return {
          name: getPlayer(room, pid).name,
          done,
          connected: getPlayer(room, pid).connected,
          camper: getPlayer(room, pid).camper || null,
          words: room.settings.mode === 'audio' ? null : words,
          pasted: live.pasted || 0,
        };
      }),
    };
  }

  if (room.phase === 'reading') {
    const story = room.stories[room.readIndex];
    const ownerId = room.seats[room.readIndex];
    const anon = room.settings.anonymous; // hide ALL authorship until results
    const mayNavigate = pid_is_leader(room, playerId) ||
      (!anon && ownerId === playerId);
    view.reading = {
      index: room.readIndex,
      total: room.stories.length,
      totalRounds: room.seats.length,
      canGoBack: room.readIndex > 0,
      mayNavigate,
      ownerName: anon ? null : getPlayer(room, ownerId).name,
      youAreOwner: anon ? false : ownerId === playerId,
      segments: story.segments.map(seg => ({
        author: anon ? null : getPlayer(room, room.seats[seg.authorSeat]).name,
        text: seg.text,
        audio: seg.audio || null,
      })),
    };
  }

  if (room.phase === 'voting') {
    const mySeat = seatOf(room, playerId);
    view.voting = {
      voted: room.votes[mySeat] !== undefined,
      endsAt: room.votingEndsAt,
      options: room.stories.map((story, i) => ({
        index: i,
        ownerName: room.settings.anonymous ? null : getPlayer(room, room.seats[i]).name,
        teaser: story.segments[0].text.split(/\s+/).slice(0, 10).join(' ') + '…',
        opening: story.segments[0].text, // full first segment, shown for an informed vote
      })).filter(o => o.index !== mySeat),
      waitingOn: room.seats
        .filter((pid, s) => room.votes[s] === undefined && getPlayer(room, pid).connected)
        .map(pid => getPlayer(room, pid).name),
      campers: room.seats
        .filter(pid => pid !== playerId)
        .map(pid => ({ id: pid, name: getPlayer(room, pid).name, camper: getPlayer(room, pid).camper || null })),
    };
  }

  if (room.phase === 'results') {
    const ups = room.stories.map(() => 0);
    const downs = room.stories.map(() => 0);
    Object.values(room.votes).forEach(v => {
      if (v.up !== null) ups[v.up]++;
      if (v.down !== null) downs[v.down]++;
    });
    const scores = room.stories.map((_, i) => ups[i] - downs[i]);
    const top = Math.max(...scores);

    // Best Overall Camper — most golden-marshmallow crowns (people, not stories)
    const camperTally = {};
    room.seats.forEach(pid => { camperTally[pid] = 0; });
    Object.values(room.camperVotes).forEach(pid => {
      if (camperTally[pid] !== undefined) camperTally[pid]++;
    });
    const camperRanked = room.seats
      .map(pid => ({ name: getPlayer(room, pid).name, votes: camperTally[pid], camper: getPlayer(room, pid).camper || null }))
      .sort((a, b) => b.votes - a.votes);
    const bestCamperTop = camperRanked.length ? camperRanked[0].votes : 0;
    const bestCampers = camperRanked.filter(c => c.votes === bestCamperTop && bestCamperTop > 0).map(c => c.name);
    view.results = {
      winners: room.stories.map((_, i) => i).filter(i => scores[i] === top)
        .map(i => getPlayer(room, room.seats[i]).name),
      tally: room.stories.map((_, i) => ({
        ownerName: getPlayer(room, room.seats[i]).name,
        camper: getPlayer(room, room.seats[i]).camper || null,
        up: ups[i], down: downs[i], score: scores[i],
      })).sort((a, b) => b.score - a.score),
      awards: computeAwards(room),
      bestCampers,
      camperTally: camperRanked,
      stories: room.stories.map((story, i) => ({
        ownerName: getPlayer(room, room.seats[i]).name,
        segments: story.segments.map(seg => ({
          author: getPlayer(room, room.seats[seg.authorSeat]).name,
          text: seg.text,
        })),
      })),
    };
  }

  return view;
}

function broadcast(room) {
  markDirty(); // any broadcast means state changed — snapshot it soon
  for (const p of room.players) {
    if (p.connected && p.socketId) {
      io.to(p.socketId).emit('state', viewFor(room, p.id));
    }
  }
}

/* ---------- Round lifecycle ---------- */

function resumeRound(room) {
  if (!room.paused) return;
  room.paused = false;
  room.endsAt = Date.now() + room.pausedRemaining;
  clearTimeout(room.timer);
  room.timer = setTimeout(() => endWritingRound(room), room.pausedRemaining + 2000);
  broadcast(room);
}

function startTheming(room) {
  room.phase = 'theming';
  room.theme = null;
  room.themeSuggestions = pickSuggestions(room.settings.themeSource, 8);
  room.themeHeadlines = [];
  room.themeEndsAt = Date.now() + 45 * 1000; // Director gets 45 seconds
  clearTimeout(room.themeTimer);
  room.themeTimer = setTimeout(() => finishTheming(room, null), 45 * 1000 + 1500);
  broadcast(room);

  // If a live source (news, reddit, or the everything-mix) is selected,
  // fetch in the background and push an update when prompts arrive. The
  // phase starts immediately with generated suggestions so the Director
  // never waits on a slow feed.
  const source = room.settings.themeSource;
  if (source === 'news' || source === 'reddit' || source === 'mixed') {
    const loader = source === 'news' ? getHeadlines
      : source === 'reddit' ? getRedditPosts
      : async () => {
          const [news, reddit] = await Promise.all([
            getHeadlines().catch(() => []),
            getRedditPosts().catch(() => []),
          ]);
          return [...news, ...reddit];
        };
    loader().then(all => {
      if (room.phase !== 'theming') return; // they already moved on
      room.themeFeedPool = all;             // kept for rerolls
      room.themeHeadlines = pickHeadlines(all, 8);
      broadcast(room);
    }).catch(() => { /* source unavailable — generated suggestions remain */ });
  }
}

function finishTheming(room, theme) {
  if (room.phase !== 'theming') return;
  clearTimeout(room.themeTimer);
  theme = String(theme || '').trim().slice(0, 200);
  room.theme = theme || '(the Director left it wide open — write anything!)';
  room.phase = 'writing';
  startWritingRound(room);
}

function startWritingRound(room) {
  room.pending = {};
  room.live = {};  // per-seat live word counts + paste flags, fresh each round
  room.endsAt = Date.now() + room.settings.seconds * 1000;
  clearTimeout(room.timer);
  room.timer = setTimeout(() => endWritingRound(room), room.settings.seconds * 1000 + 2000);
  scheduleBots(room); // dev playtest bots write a few seconds in
  broadcast(room);
}

function endWritingRound(room) {
  if (room.phase !== 'writing') return;
  clearTimeout(room.timer);
  const n = room.seats.length;

  for (let seat = 0; seat < n; seat++) {
    const sub = room.pending[seat] ||
      { text: '(…the campfire crackled, but no words came…)', backspaces: 0, seconds: 0, real: false };

    // Awards only count real writing, not AFK placeholders
    if (sub.real) {
      const st = room.stats[seat] || (room.stats[seat] = { words: 0, backspaces: 0, seconds: 0 });
      st.words += countWords(sub.text);
      st.backspaces += sub.backspaces;
      st.seconds += sub.seconds;
      // Evidence for The AI Hallucinator (all in good fun)
      st.emdash = (st.emdash || 0) + countEmDashes(sub.text);
      st.buzz = (st.buzz || 0) + countAiBuzzwords(sub.text);
    }

    const storyIdx = storyForSeat(room, seat, room.round);
    room.stories[storyIdx].segments.push({ authorSeat: seat, text: sub.text, audio: sub.audio || null });
  }

  room.round++;
  if (room.round >= n) {
    room.phase = 'reading';
    room.readIndex = 0;
    room.endsAt = null;
    broadcast(room);
  } else {
    startWritingRound(room);
  }
}

function startVoting(room) {
  room.phase = 'voting';
  room.votes = {};
  room.camperVotes = {};
  room.votingEndsAt = Date.now() + room.settings.votingSeconds * 1000;
  clearTimeout(room.votingTimer);
  room.votingTimer = setTimeout(() => endVoting(room), room.settings.votingSeconds * 1000 + 1500);
  scheduleBots(room); // dev playtest bots cast their marshmallows
  broadcast(room);
}

function endVoting(room) {
  if (room.phase !== 'voting') return;
  clearTimeout(room.votingTimer);
  room.phase = 'results';
  bump('gamesFinished'); // reached the results screen — a completed game
  broadcast(room);
}

/* ---------- Socket event handling ---------- */

io.on('connection', (socket) => {

  function myRoom() {
    return rooms.get(socket.data.code) || null;
  }

  socket.on('create_room', ({ name, camper }, ack) => {
    name = String(name || '').trim().slice(0, 20);
    if (!name) return ack && ack({ error: 'Enter a name first.' });
    const room = createRoom();
    const player = { id: nextPlayerId++, name, socketId: socket.id, connected: true, camper: cleanCamper(camper) };
    room.players.push(player);
    room.hostId = player.id;
    socket.data.code = room.code;
    socket.data.playerId = player.id;
    bump('roomsCreated');
    bump('playersJoined');
    ack && ack({ ok: true, code: room.code });
    broadcast(room);
  });

  /* Solo playtest: a room with two server-driven bots, so one human can
     walk every phase alone. Not advertised in-game beyond the small link
     on the home screen — it's a dev tool. */
  socket.on('dev_quickstart', ({ name, camper }, ack) => {
    name = String(name || '').trim().slice(0, 20) || 'Playtester';
    const room = createRoom();
    const player = { id: nextPlayerId++, name, socketId: socket.id, connected: true, camper: cleanCamper(camper) };
    room.players.push(player);
    room.hostId = player.id;
    for (const bot of BOT_ROSTER) {
      room.players.push({ id: nextPlayerId++, name: bot.name, socketId: null, connected: true, camper: bot.camper, isBot: true });
    }
    socket.data.code = room.code;
    socket.data.playerId = player.id;
    bump('roomsCreated');
    bump('settingsUse', 'devPlaytest');
    ack && ack({ ok: true, code: room.code });
    broadcast(room);
  });

  socket.on('join_room', ({ code, name, camper }, ack) => {
    code = String(code || '').trim().toUpperCase();
    name = String(name || '').trim().slice(0, 20);
    const room = rooms.get(code);
    if (!room) return ack && ack({ error: 'No room with that code. Check it and try again.' });
    if (!name) return ack && ack({ error: 'Enter a name first.' });

    const existing = room.players.find(p => p.name.toLowerCase() === name.toLowerCase());
    if (existing) {
      if (existing.connected) return ack && ack({ error: 'That name is taken in this room.' });
      existing.connected = true;
      existing.socketId = socket.id;
      if (cleanCamper(camper)) existing.camper = cleanCamper(camper);
      socket.data.code = room.code;
      socket.data.playerId = existing.id;
      ack && ack({ ok: true, code: room.code });
      broadcast(room);
      return;
    }

    if (room.phase !== 'lobby') return ack && ack({ error: 'That game already started. Ask them to finish up!' });
    if (room.players.length >= 8) return ack && ack({ error: 'That room is full (8 players max).' });

    const player = { id: nextPlayerId++, name, socketId: socket.id, connected: true, camper: cleanCamper(camper) };
    room.players.push(player);
    socket.data.code = room.code;
    socket.data.playerId = player.id;
    bump('playersJoined');
    ack && ack({ ok: true, code: room.code });
    broadcast(room);
  });

  socket.on('update_settings', (settings) => {
    const room = myRoom();
    if (!room || room.phase !== 'lobby' || room.hostId !== socket.data.playerId) return;
    const s = room.settings;
    if (settings.seconds !== undefined) s.seconds = Math.min(600, Math.max(15, +settings.seconds || 90));
    if (settings.minWords !== undefined) s.minWords = Math.min(500, Math.max(0, +settings.minWords || 0));
    if (settings.maxWords !== undefined) s.maxWords = Math.min(2000, Math.max(0, +settings.maxWords || 0));
    if (settings.votingSeconds !== undefined) s.votingSeconds = Math.min(120, Math.max(5, +settings.votingSeconds || 10));
    if (settings.visibility === 'full' || settings.visibility === 'last') s.visibility = settings.visibility;
    if (settings.anonymous !== undefined) s.anonymous = !!settings.anonymous;
    if (settings.directorTheme !== undefined) s.directorTheme = !!settings.directorTheme;
    if (settings.mode === 'text' || settings.mode === 'audio') s.mode = settings.mode;
    if (['words', 'madlib', 'news', 'reddit', 'mixed'].includes(settings.themeSource)) s.themeSource = settings.themeSource;
    if (s.maxWords > 0 && s.maxWords < s.minWords) s.maxWords = s.minWords;
    broadcast(room);
  });

  // Host removes a player from the lobby (only in the lobby, not mid-game)
  socket.on('kick_player', ({ name }) => {
    const room = myRoom();
    if (!room || room.phase !== 'lobby' || room.hostId !== socket.data.playerId) return;
    const target = room.players.find(p => p.name.toLowerCase() === String(name || '').trim().toLowerCase());
    if (!target || target.id === room.hostId) return; // can't kick yourself
    // Tell the kicked player, then drop them
    if (target.socketId) io.to(target.socketId).emit('kicked');
    room.players = room.players.filter(p => p.id !== target.id);
    broadcast(room);
  });

  socket.on('start_game', () => {
    const room = myRoom();
    if (!room || room.phase !== 'lobby' || room.hostId !== socket.data.playerId) return;
    if (room.players.length < 3) return;

    // Crown a random Camp Director for this game. Bots (dev playtest
    // rooms) can't direct — they can't advance readings or pick themes —
    // so the crown always goes to a human.
    const humans = room.players.filter(p => !p.isBot);
    const pool = humans.length ? humans : room.players;
    room.directorId = pool[Math.floor(Math.random() * pool.length)].id;

    // Analytics: what gets played, and with which settings
    bump('gamesStarted');
    stats.playersPerGameSum += room.players.length;
    if (room.settings.mode === 'audio') bump('settingsUse', 'audioMode');
    if (room.settings.anonymous) bump('settingsUse', 'anonymous');
    if (room.settings.directorTheme) {
      bump('settingsUse', 'directorTheme');
      if (room.settings.themeSource === 'news') bump('settingsUse', 'themeNews');
      if (room.settings.themeSource === 'reddit') bump('settingsUse', 'themeReddit');
    }
    statsDirty = true;

    room.seats = shuffle(room.players.map(p => p.id));
    room.stories = room.seats.map(() => ({ segments: [] }));
    room.stats = {};
    room.round = 0;
    room.votes = {};
    room.camperVotes = {};
    room.paused = false;
    room.readIndex = 0;
    room.theme = null;

    if (room.settings.directorTheme) {
      startTheming(room);
    } else {
      room.phase = 'writing';
      startWritingRound(room);
    }
  });

  // Pause the writing clock (host or Camp Director), e.g. to wait for a rejoin
  socket.on('pause_round', () => {
    const room = myRoom();
    if (!room || room.phase !== 'writing' || room.paused) return;
    const pid = socket.data.playerId;
    if (pid !== room.hostId && pid !== room.directorId) return;
    room.paused = true;
    room.pausedRemaining = Math.max(0, room.endsAt - Date.now());
    clearTimeout(room.timer);
    // Safety net: auto-resume after 30s so a room can't be frozen forever
    room.timer = setTimeout(() => resumeRound(room), 30 * 1000);
    broadcast(room);
  });

  socket.on('resume_round', () => {
    const room = myRoom();
    if (!room || room.phase !== 'writing' || !room.paused) return;
    const pid = socket.data.playerId;
    if (pid !== room.hostId && pid !== room.directorId) return;
    resumeRound(room);
  });

  // The Camp Director submits (or skips) the story theme
  socket.on('set_theme', ({ theme }) => {
    const room = myRoom();
    if (!room || room.phase !== 'theming') return;
    if (socket.data.playerId !== room.directorId) return;
    finishTheming(room, theme);
  });

  // The Director rerolls the suggestion chips (and live-feed prompts, if
  // any are cached). Gently rate-limited so mashing 🎲 doesn't spam.
  socket.on('reroll_theme', () => {
    const room = myRoom();
    if (!room || room.phase !== 'theming') return;
    if (socket.data.playerId !== room.directorId) return;
    if (room.lastReroll && Date.now() - room.lastReroll < 800) return;
    room.lastReroll = Date.now();
    room.themeSuggestions = pickSuggestions(room.settings.themeSource, 8);
    if (room.themeFeedPool && room.themeFeedPool.length) {
      room.themeHeadlines = pickHeadlines(room.themeFeedPool, 8);
    }
    broadcast(room);
  });

  // A player marks themselves ready, locking in their current text + stats
  /* Live word count for the campfire sidebar. Clients throttle these to
     ~1 per 1.5s, so even a full room is only a gentle trickle. */
  socket.on('typing_progress', ({ words } = {}) => {
    const room = myRoom();
    if (!room || room.phase !== 'writing' || room.settings.mode === 'audio') return;
    const seat = seatOf(room, socket.data.playerId);
    if (seat === -1 || room.pending[seat] !== undefined) return;
    const w = Math.min(5000, Math.max(0, Math.floor(+words) || 0));
    room.live = room.live || {};
    const live = room.live[seat] || (room.live[seat] = {});
    if (live.words === w) return;   // nothing changed, nothing to say
    live.words = w;
    broadcast(room);
  });

  /* The paste confession. Purely for laughs: when a browser fires a paste
     event in the writing box, everyone gets to see the 🚨 CTRL+V badge
     next to that camper's name for the rest of the round. It also quietly
     feeds The AI Hallucinator award. */
  socket.on('paste_alert', () => {
    const room = myRoom();
    if (!room || room.phase !== 'writing') return;
    const seat = seatOf(room, socket.data.playerId);
    if (seat === -1) return;
    room.live = room.live || {};
    const live = room.live[seat] || (room.live[seat] = {});
    live.pasted = Math.min(99, (live.pasted || 0) + 1);
    const st = room.stats[seat] || (room.stats[seat] = { words: 0, backspaces: 0, seconds: 0 });
    st.pastes = (st.pastes || 0) + 1;
    broadcast(room);
  });

  socket.on('ready', ({ text, backspaces, seconds, audio }) => {
    const room = myRoom();
    if (!room || room.phase !== 'writing') return;
    const seat = seatOf(room, socket.data.playerId);
    if (seat === -1 || room.pending[seat] !== undefined) return;

    if (room.settings.mode === 'audio') {
      // Expect a base64 data URL; cap at ~6MB to protect server memory
      const ok = typeof audio === 'string' && audio.startsWith('data:audio') && audio.length < 6_000_000;
      room.pending[seat] = {
        text: ok ? '(audio recording)' : '(…no recording came through…)',
        audio: ok ? audio : null,
        backspaces: 0,
        seconds: Math.min(3600, Math.max(0, +seconds || 0)),
        real: ok,
      };
    } else {
      text = String(text || '').trim().slice(0, 10000);
      const max = room.settings.maxWords;
      if (max > 0 && countWords(text) > max) text = truncateWords(text, max);
      if (!text) text = '(…a thoughtful silence…)';
      room.pending[seat] = {
        text,
        audio: null,
        backspaces: Math.min(100000, Math.max(0, Math.floor(+backspaces) || 0)),
        seconds: Math.min(3600, Math.max(0, +seconds || 0)),
        real: true,
      };
    }

    // All *connected* players ready early? Skip the rest of the clock.
    // (A disconnected player can never ready up, so we don't wait on them —
    // their segment becomes a placeholder when the round ends.)
    const connectedSeats = room.seats.filter(pid => getPlayer(room, pid).connected);
    const readyConnected = connectedSeats.filter((pid) => room.pending[seatOf(room, pid)] !== undefined);
    if (readyConnected.length >= connectedSeats.length) {
      endWritingRound(room);
    } else {
      broadcast(room);
    }
  });

  // Changed your mind — go back to writing (until the round actually ends)
  socket.on('unready', () => {
    const room = myRoom();
    if (!room || room.phase !== 'writing') return;
    const seat = seatOf(room, socket.data.playerId);
    if (seat === -1 || room.pending[seat] === undefined) return;
    delete room.pending[seat];
    broadcast(room);
  });

  socket.on('advance_reading', ({ dir } = {}) => {
    const room = myRoom();
    if (!room || room.phase !== 'reading') return;
    const ownerId = room.seats[room.readIndex];
    const pid = socket.data.playerId;
    // The Camp Director or host can always navigate. The story's owner can
    // too — unless anonymous mode is on, where that would give them away.
    const ownerMayAdvance = !room.settings.anonymous && pid === ownerId;
    if (!ownerMayAdvance && pid !== room.directorId && pid !== room.hostId) return;

    if (dir === 'back') {
      // Step back to the previous story (never before the first)
      room.readIndex = Math.max(0, room.readIndex - 1);
      broadcast(room);
      return;
    }

    room.readIndex++;
    if (room.readIndex >= room.stories.length) {
      startVoting(room);
    } else {
      broadcast(room);
    }
  });

  // Two marshmallows: up = golden (best story), down = burnt (worst story)
  socket.on('cast_vote', ({ up, down, bestCamper }) => {
    const room = myRoom();
    if (!room || room.phase !== 'voting') return;
    const seat = seatOf(room, socket.data.playerId);
    if (seat === -1 || room.votes[seat] !== undefined) return;

    const n = room.stories.length;
    const valid = v => Number.isInteger(v) && v >= 0 && v < n && v !== seat;
    up = valid(+up) ? +up : null;
    down = valid(+down) ? +down : null;
    if (up !== null && up === down) down = null; // can't golden AND burn the same story

    room.votes[seat] = { up, down };

    // Best Overall Camper — a golden crown for a person (never yourself)
    const myId = socket.data.playerId;
    if (Number.isInteger(+bestCamper) && room.seats.includes(+bestCamper) && +bestCamper !== myId) {
      room.camperVotes[seat] = +bestCamper;
    }

    const stillWaiting = room.seats.some((pid, s) =>
      room.votes[s] === undefined && getPlayer(room, pid).connected);
    if (!stillWaiting) endVoting(room);
    else broadcast(room);
  });

  socket.on('play_again', () => {
    const room = myRoom();
    if (!room || room.phase !== 'results') return;
    const pid = socket.data.playerId;
    if (pid !== room.hostId && pid !== room.directorId) return;
    room.phase = 'lobby';
    room.stories = [];
    room.seats = [];
    room.stats = {};
    room.round = 0;
    room.votes = {};
    room.camperVotes = {};
    room.paused = false;
    room.directorId = null;
    room.theme = null;
    broadcast(room);
  });

  socket.on('disconnect', () => {
    const room = myRoom();
    if (!room) return;
    const player = getPlayer(room, socket.data.playerId);
    if (!player) return;
    player.connected = false;
    player.socketId = null;

    if (room.phase === 'lobby') {
      room.players = room.players.filter(p => p.id !== player.id);
      if (room.hostId === player.id && room.players.length > 0) {
        const human = room.players.find(p => !p.isBot);
        room.hostId = (human || room.players[0]).id;
      }
    } else {
      // Mid-game: if the host or Camp Director drops, hand their control to
      // a still-connected player so the game can't stall (the leader is who
      // advances readings and starts a new game). We only reassign control
      // roles — the Director's authorship of stories stays as it was.
      // Bots never take the wheel: they can't click "next story".
      const firstConnected = room.players.find(p => p.connected && !p.isBot);
      if (firstConnected) {
        if (room.hostId === player.id) room.hostId = firstConnected.id;
        if (room.directorId === player.id) room.directorId = firstConnected.id;
      }
    }

    // A room with only bots left awake is an abandoned room
    if (room.players.every(p => p.isBot || !p.connected)) {
      clearTimeout(room.timer);
      clearTimeout(room.votingTimer);
      clearTimeout(room.themeTimer);
      setTimeout(() => {
        if (rooms.has(room.code) && room.players.every(p => p.isBot || !p.connected)) {
          rooms.delete(room.code);
          markDirty();
        }
      }, 10 * 60 * 1000);
    }
    broadcast(room);
  });
});

restoreRooms(); // bring back any rooms that survived a restart

server.listen(PORT, () => {
  console.log(`Campfire is running! Open http://localhost:${PORT}`);
});
