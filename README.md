# Campfire

Round-robin storytelling around a campfire, for friends on Discord (or any
voice chat). Everyone writes the opening of a story, the stories secretly
rotate, everyone continues whichever story lands in their hands, and at the
end each story comes home to be read aloud and voted on with marshmallows.

## The campfire rules

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
