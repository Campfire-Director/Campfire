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

const app = express();
const server = http.createServer(app);
const io = new Server(server);
app.use(express.static(path.join(__dirname, 'public')));
const PORT = process.env.PORT || 3000;

const rooms = new Map();
let nextPlayerId = 1;

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
];

function pickThemeWords(n) {
  const pool = [...THEME_WORDS];
  shuffle(pool);
  return pool.slice(0, n);
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

function createRoom() {
  const room = {
    code: makeRoomCode(),
    hostId: null,        // whoever created the room (controls the lobby)
    directorId: null,    // the Camp Director — randomly crowned each game
    players: [],         // { id, name, socketId, connected }
    settings: { seconds: 90, minWords: 10, maxWords: 60, visibility: 'full', votingSeconds: 10, anonymous: false, directorTheme: false },
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

function computeAwards(room) {
  const entries = room.seats.map((pid, seat) => {
    const st = room.stats[seat] || { words: 0, backspaces: 0, seconds: 0 };
    const minutes = Math.max(st.seconds, 5) / 60; // avoid silly division
    return {
      name: getPlayer(room, pid).name,
      words: st.words,
      backspaces: st.backspaces,
      seconds: st.seconds,
      wpm: st.words > 0 ? st.words / minutes : 0,
    };
  });
  const pick = key => entries.reduce((a, b) => (b[key] > a[key] ? b : a));
  const w = pick('words'), b = pick('backspaces'), s = pick('wpm'), t = pick('seconds');
  return [
    { title: 'The Novelist', desc: 'Most words typed', name: w.name, value: `${w.words} words` },
    { title: 'The Demolitionist', desc: 'Most backspaces', name: b.name, value: `${b.backspaces} backspaces` },
    { title: 'The Speed Demon', desc: 'Fastest typing', name: s.name, value: `${Math.round(s.wpm)} wpm` },
    { title: 'The Slow Roaster', desc: 'Most time at the fire', name: t.name, value: `${Math.round(t.seconds)}s writing` },
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
    })),
  };

  view.theme = room.theme; // null unless Director's Theme is set

  if (room.phase === 'theming') {
    view.theming = {
      youAreDirector: room.directorId === playerId,
      endsAt: room.themeEndsAt,
      suggestions: room.themeSuggestions || [],
    };
  }

  if (room.phase === 'writing') {
    const n = room.seats.length;
    const seat = seatOf(room, playerId);
    const storyIdx = storyForSeat(room, seat, room.round);
    const story = room.stories[storyIdx];
    const ready = room.pending[seat] !== undefined;

    let context;
    if (room.round === 0) {
      context = { mode: 'new', segments: [] };
    } else if (room.settings.visibility === 'full') {
      context = { mode: 'full', segments: story.segments.map(s => s.text) };
    } else {
      context = { mode: 'last', segments: [story.segments[story.segments.length - 1].text] };
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
      status: room.seats.map((pid, s) => ({
        name: getPlayer(room, pid).name,
        done: room.pending[s] !== undefined,
        connected: getPlayer(room, pid).connected,
      })),
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
        .map(pid => ({ id: pid, name: getPlayer(room, pid).name })),
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
      .map(pid => ({ name: getPlayer(room, pid).name, votes: camperTally[pid] }))
      .sort((a, b) => b.votes - a.votes);
    const bestCamperTop = camperRanked.length ? camperRanked[0].votes : 0;
    const bestCampers = camperRanked.filter(c => c.votes === bestCamperTop && bestCamperTop > 0).map(c => c.name);
    view.results = {
      winners: room.stories.map((_, i) => i).filter(i => scores[i] === top)
        .map(i => getPlayer(room, room.seats[i]).name),
      tally: room.stories.map((_, i) => ({
        ownerName: getPlayer(room, room.seats[i]).name,
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
  room.themeSuggestions = pickThemeWords(3); // 3 fallback prompts to choose from
  room.themeEndsAt = Date.now() + 45 * 1000; // Director gets 45 seconds
  clearTimeout(room.themeTimer);
  room.themeTimer = setTimeout(() => finishTheming(room, null), 45 * 1000 + 1500);
  broadcast(room);
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
  room.endsAt = Date.now() + room.settings.seconds * 1000;
  clearTimeout(room.timer);
  room.timer = setTimeout(() => endWritingRound(room), room.settings.seconds * 1000 + 2000);
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
    }

    const storyIdx = storyForSeat(room, seat, room.round);
    room.stories[storyIdx].segments.push({ authorSeat: seat, text: sub.text });
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
  broadcast(room);
}

function endVoting(room) {
  if (room.phase !== 'voting') return;
  clearTimeout(room.votingTimer);
  room.phase = 'results';
  broadcast(room);
}

/* ---------- Socket event handling ---------- */

io.on('connection', (socket) => {

  function myRoom() {
    return rooms.get(socket.data.code) || null;
  }

  socket.on('create_room', ({ name }, ack) => {
    name = String(name || '').trim().slice(0, 20);
    if (!name) return ack && ack({ error: 'Enter a name first.' });
    const room = createRoom();
    const player = { id: nextPlayerId++, name, socketId: socket.id, connected: true };
    room.players.push(player);
    room.hostId = player.id;
    socket.data.code = room.code;
    socket.data.playerId = player.id;
    ack && ack({ ok: true, code: room.code });
    broadcast(room);
  });

  socket.on('join_room', ({ code, name }, ack) => {
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
      socket.data.code = room.code;
      socket.data.playerId = existing.id;
      ack && ack({ ok: true, code: room.code });
      broadcast(room);
      return;
    }

    if (room.phase !== 'lobby') return ack && ack({ error: 'That game already started. Ask them to finish up!' });
    if (room.players.length >= 8) return ack && ack({ error: 'That room is full (8 players max).' });

    const player = { id: nextPlayerId++, name, socketId: socket.id, connected: true };
    room.players.push(player);
    socket.data.code = room.code;
    socket.data.playerId = player.id;
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
    if (s.maxWords > 0 && s.maxWords < s.minWords) s.maxWords = s.minWords;
    broadcast(room);
  });

  socket.on('start_game', () => {
    const room = myRoom();
    if (!room || room.phase !== 'lobby' || room.hostId !== socket.data.playerId) return;
    if (room.players.length < 3) return;

    // Crown a random Camp Director for this game
    room.directorId = room.players[Math.floor(Math.random() * room.players.length)].id;

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

  // A player marks themselves ready, locking in their current text + stats
  socket.on('ready', ({ text, backspaces, seconds }) => {
    const room = myRoom();
    if (!room || room.phase !== 'writing') return;
    const seat = seatOf(room, socket.data.playerId);
    if (seat === -1 || room.pending[seat] !== undefined) return;

    text = String(text || '').trim().slice(0, 10000);
    const max = room.settings.maxWords;
    if (max > 0 && countWords(text) > max) text = truncateWords(text, max);
    if (!text) text = '(…a thoughtful silence…)';

    room.pending[seat] = {
      text,
      backspaces: Math.min(100000, Math.max(0, Math.floor(+backspaces) || 0)),
      seconds: Math.min(3600, Math.max(0, +seconds || 0)),
      real: true,
    };

    // Everyone ready early? Skip the rest of the clock.
    if (Object.keys(room.pending).length >= room.seats.length) {
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
        room.hostId = room.players[0].id;
      }
    }

    if (room.players.every(p => !p.connected)) {
      clearTimeout(room.timer);
      clearTimeout(room.votingTimer);
      clearTimeout(room.themeTimer);
      setTimeout(() => {
        if (rooms.has(room.code) && room.players.every(p => !p.connected)) {
          rooms.delete(room.code);
        }
      }, 10 * 60 * 1000);
    }
    broadcast(room);
  });
});

server.listen(PORT, () => {
  console.log(`Campfire is running! Open http://localhost:${PORT}`);
});
