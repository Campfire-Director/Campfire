# Campfire

Round-robin storytelling around a campfire, for friends on Discord (or any
voice chat). Everyone writes the opening of a story, the stories secretly
rotate, everyone continues whichever story lands in their hands, and at the
end each story comes home to be read aloud and voted on with marshmallows.

## Text or Audio mode

In the lobby, the host picks **Story mode**:
- **Text** — players type their segments (the classic experience).
- **Audio** — players record their part with their microphone, telephone
  style: when a story is passed to you, you hear **only the previous clip**,
  then record your continuation. At the end, each story's clips play back
  in order (auto-play, with manual controls). Recording uses the browser's
  built-in microphone access — players approve the mic prompt once.

**Audio mode memory note:** recordings are held in the server's memory for
the life of the room and discarded when it closes — perfect for a game night,
but they aren't saved anywhere permanent. The text export notes where audio
segments were (the clips themselves can't go in a text file). If you ever
want audio to persist, that's a larger change involving file storage (e.g.
S3). The clip size is capped at ~6 MB per segment to protect server memory.

## The title screen

The home screen is a hand-painted starry-night campfire scene (all inline
SVG/CSS, no image files): a swirling Van Gogh-style sky with spiral stars and
a crescent moon, layered pine forest with a peeking raccoon and bigfoot, a
flying owl, a shooting star, a vector campfire with a log ring, drifting smoke
and rising embers, an arched floating "CAMPFIRE" wordmark, and two rustic
wooden trail signs holding the create/join form and a **camper picker**. The
scene builders live in `art.js` (sceneSky, sceneFireSVG, sceneTree, etc.);
the keyframes and layout are in `theme.css` (the "v8 — TITLE SCREEN" block).

The camper picker is currently cosmetic — your choice is saved locally and
will feed the planned avatar/lobby feature. All the create-room, join-room,
and shared-link behavior works exactly as before.

## Reliability & host tools

- **Host/Director hand-off:** if the host or Camp Director disconnects
  mid-game, their control (advancing readings, starting a new game) passes
  automatically to a still-connected player, so a game can never stall.
- **Smart early-skip:** a writing round ends as soon as every *connected*
  player is ready — it no longer waits on the full clock just because someone
  disconnected.
- **Kick button:** the host can remove a player from the lobby (the × on
  their name chip).
- **Quick presets:** one-tap ⚡ Quick / 🏕️ Standard / 🔥 Chaos buttons set
  the timer, word limits, voting time, and visibility all at once.
- **How to play:** a rules overlay any player can open from the lobby.

## The campfire rules

- **Best Overall Camper** vote: alongside the story marshmallows, each player
  casts one golden marshmallow for the camper who made the best additions
  across all stories (no burnt marshmallows for people, and you can't pick
  yourself). Crowned on the results screen and in the export.
- **Floating countdown** during writing rounds: the timer is pinned to the
  top of the screen so it stays visible even when a long story pushes the
  page down.
- **AFK warning**: a toast pops up at the 30-seconds-left mark if you haven't
  readied up yet, so nobody times out by accident.
- **Pause / resume**: if a camper drops mid-round, the host or Camp Director
  can pause the clock (up to 30 seconds) to wait for them to rejoin, then
  resume. The clock freezes exactly where it was.
- **Draft recovery**: what you've typed is saved to your browser as you go,
  so a wifi drop and rejoin restores your in-progress segment.
- **Director's Theme** (a lobby setting): the Camp Director gets 45 seconds
  to type a prompt — a word, phrase, or sentence — that everyone must base
  their story on, or tap one of 3 randomly suggested prompts if they're
  stuck. It stays pinned to every writing screen.
  - **Theme inspiration** sub-setting, three sources:
    - "Random words" — quirky short prompts from the built-in list.
    - "📰 News headlines" — real current headlines pulled from BBC, CNN,
      and Fox public RSS feeds; ~5 offered for the Director to pick from.
    - "👽 Reddit posts" — real post titles from r/Showerthoughts,
      r/nottheonion, and r/AskReddit for comedic effect. NSFW-flagged and
      pinned posts are filtered out automatically.
    All live sources cache for 5 minutes and silently fall back to word
    prompts if unreachable, so a game never stalls. (Live fetching requires
    open outbound internet — works on Render; blocked in some sandboxes.)
    The subreddit list is the REDDIT_SUBS array in server.js — edit freely.
- **Shareable join links**: the lobby shows a direct link (with a copy
  button) that drops friends straight into the room — they just add a name.
- **Leave lobby**: a back button in the lobby returns to the home screen.
- **Read aloud**: on the results/reading screens, a button uses the browser's
  built-in text-to-speech to read a story out loud.
- **Reading navigation**: the leader can step backward and forward through
  the stories during the reading phase, not just forward.
- **Story previews when voting**: each ballot shows the full opening line of
  every story, so players vote on something they've actually read.
- **Download the stories**: the results screen has a button that saves the
  whole game — every story with its authors, the vote tallies, the theme,
  and the campfire awards — as a text file to keep or paste into Discord.
- **Anonymous mode** (a lobby setting): nobody knows who owns or wrote any
  story during the readings and voting — the Camp Director reads everything
  aloud — and all names are revealed in one big unmasking on the results
  screen.
- A **Camp Director** is randomly crowned at the start of each game. They
  control the pacing: advancing the story readings and relighting the fire
  for another game.
- The **campfire at the bottom of the screen dwindles** round by round —
  roaring blaze in round 1, smoldering coals by the final round.
- During writing, hit **"I'm ready"** when you're done (or "keep writing"
  to change your mind). A ready fraction (e.g. 3/5) shows in the top-right
  for everyone, and the round skips ahead the moment everyone's ready.
- Voting gives each player **two marshmallows**: a golden one for the best
  story and a burnt one for the worst. Net score (golden minus burnt) wins.
  The voting window defaults to 10 seconds (changeable in the lobby).
- The results screen crowns the winner and hands out four **campfire
  awards**: The Novelist (most words), The Demolitionist (most backspaces),
  The Speed Demon (fastest typing), and The Slow Roaster (most time writing).

## What's in this folder

| File | What it is |
|---|---|
| `server.js` | The game server (the "referee"). Holds the real game state, enforces the rules, keeps everyone in sync. |
| `public/index.html` | The page players see. All the screens, styling, and the design tokens you can edit. |
| `package.json` | Tells Node which libraries this project needs (Express and Socket.IO). |
| `test-game.js` | An automated test that simulates 3 players playing a full game. Optional, but handy after making changes. |

## Running it on your own computer (first step)

1. Install Node.js from https://nodejs.org (the LTS version). This gives you
   the `node` and `npm` commands.
2. Open a terminal (Command Prompt or PowerShell on Windows, Terminal on Mac)
   and navigate into this folder, e.g. `cd Downloads/campfire`
3. Run `npm install` — this downloads the two libraries the server needs
   (you only ever do this once).
4. Run `npm start` — you should see "Campfire is running!"
5. Open http://localhost:3000 in your browser. Open it in a second tab (or a
   private/incognito window) to pretend to be a second player.

To stop the server, press Ctrl+C in the terminal.

Note: `localhost` only works on *your* machine. For friends to join, the game
needs to live on the internet — that's the next section.

## Putting it on the internet (so Discord friends can join)

The free tier of [Render](https://render.com) works well for this:

1. Create a free account at https://github.com and a new repository (a
   "repo" is just a folder GitHub stores for you). Upload these files —
   `server.js`, `package.json`, and the `public` folder. (Don't upload
   `node_modules` if it exists; Render rebuilds it itself.)
2. Create a free account at https://render.com and choose
   **New → Web Service**, then connect the GitHub repo you just made.
3. Render will ask two questions:
   - **Build command:** `npm install`
   - **Start command:** `npm start`
4. Click deploy. After a minute or two you'll get a public URL like
   `https://story-relay.onrender.com` — send that link to your friends,
   share a room code, and play.

Heads-up about free hosting: Render's free tier puts your server to sleep
after ~15 minutes of inactivity, so the *first* person to open the link
might wait 30–60 seconds while it wakes up. Annoying but fine for game night.
Also, game state lives in the server's memory — if the server restarts
mid-game, that game is lost (lobbies and stories aren't saved anywhere yet).

## The design studio

With the server running, open **http://localhost:3000/studio.html** — a
workshop page showing every graphic and UI component in the game at once:
the campfire with a slider to preview every burn stage, all the smoke
buffooneries side by side, the marshmallows, the design-token color
swatches, and live samples of every menu component. Edit a file, save,
refresh the studio. No need to play a game to see your changes.

## Customizing the look

The look now lives in two dedicated files in `public/`:

- **`theme.css`** — every color, font, spacing, and layout rule. The
  DESIGN TOKENS block at the top (colors, fonts, corner roundness,
  the whole campfire palette) controls most of the look in one place.
- **`art.js`** — every drawing: `campfireSVG()` (the fire),
  the `VIGNETTES` array (the smoke silhouettes — add your own!), and
  `mallow()` (the voting marshmallows). All plain SVG.

`public/index.html` holds the *structure* of each screen — the HTML inside
the `renderLobby()`, `renderWriting()`, `renderVoting()` (etc.) functions —
so that's where you go to rearrange or reword a menu. The CSS below it is organized by
screen and labeled. After editing, refresh the browser (if running locally)
or re-upload the file to GitHub (Render redeploys automatically).

## Running the automated test (optional)

With the server running in one terminal, open a second terminal in this
folder and run:

```
npm install socket.io-client --no-save
node test-game.js
```

It plays a complete 3-player game in about two seconds and prints
`ALL TESTS PASSED` if the rules all held up.

## How the rotation works (the math that makes it fair)

At game start, players are shuffled into a secret "ring" order. In round r,
the player in seat s writes the story owned by seat (s − r), wrapping around
the ring. Round 0 is everyone drafting their own story; after N rounds every
player has contributed to every story exactly once, and every story arrives
back home for the reading.
