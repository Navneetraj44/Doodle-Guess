# 🎨 Doodle Guess — a skribbl.io clone

A real-time multiplayer drawing and guessing game. One player draws a secret word, everyone else guesses it in the chat. Built with React + TypeScript + Vite, Node.js + Express + Socket.IO, and the HTML5 Canvas API. The server is the single source of truth for rooms, turns, timers, words and scores.

**Live URL:** _not deployed yet. After deploying (see "Deploy on Render"), paste the URL here._

## Features

| Area | What is in the app |
|---|---|
| Rooms | Create a room, join by 5-letter code, invite link (`?room=CODE`, also pasteable into the code box), **public rooms** (browse list + Quick play) and private invite-only rooms, ready-up, host starts the game |
| Settings (host) | Max players 2–20, rounds 2–10, draw time 15–240s, **words to choose from 1–5**, **hints 0–5**, **word mode** (Normal or **Hidden**), **themed word packs**, **custom words** (optionally "only my words"), public/private. Set in the Create Room dialog and editable by the host in the lobby through the **Room settings** dialog |
| Players | **Skribbl-style cartoon avatars** (draw-your-own face: 12 colours × 10 eyes × 10 mouths, picked with arrows or a dice button), a visible Host badge (crown icon) on every screen, **host kick and ban**, host migration if the host leaves, join/leave notices |
| Game | Drawer picks 1 of N words (N is a setting, auto-pick after 15s), blanks + the chosen number of letter hints over time (Normal mode), server-managed countdown, rotation through every player each round, scoring, final leaderboard, winner/tie, "Play again" |
| Drawing | Responsive canvas, mouse + touch (pointer events), 28 named colours (a compact 2-row grid under the board), 4 brush sizes, pencil, eraser, **paint-bucket Fill** (synced to every player, undoable), undo, clear, real-time sync, canvas recovery after refresh/late join, 👍/👎 reactions (one vote per player per turn, never the drawer) |
| Chat | One input for guesses and chat, correct-guess notification, **private "Your guess is close!"** to a guesser who is one slip away (nobody else sees it), public **"X liked / disliked the drawing!"** notices, players who already guessed (and the drawer) chat privately so nothing leaks |
| Word packs | 11 server-side word lists: Animals, Food, **Movies & Pop**, **Tech & Coding**, **Indian Culture**, Sports, Everyday Objects, Actions, Places, Nature, Transport, plus custom words. The packs you pick decide which words the server offers |
| Doodle Museum | After a game, every drawing from it is available with its word, artist, round and reaction count. The server keeps compact copies of the strokes in memory (no database) and only serves them once the game is over |
| Results | Winner and ranking come from the server's `game_over` state. The host can **Play Again** (new game right away, same settings) or go **Back to Lobby** |
| Safety | Secret reconnect tokens, server-side authorization for every action, rate limits, input validation, idle-room cleanup |

## Design: "Doodle Den" (riso zine on kraft paper)

The UI follows the Doodle Den direction: paper `#F3EDE2`, ink `#24201B`, riso pink `#FF4FA3`, riso blue `#1F6FD1` and highlighter yellow `#FFD23F`, with uneven sketchbook corners, ink outlines and hard offset shadows (no blur, no gradients). Everything is driven by the CSS variables at the top of `client/src/styles.css`.

- **Fonts:** Fredoka (headings and big game moments), Shantell Sans (general UI), a system sans-serif (inputs, settings, chat) and IBM Plex Mono (timer, codes, scores). They load from Google Fonts *without blocking rendering* (see `client/index.html`) and `styles.css` has full fallback stacks, so the game works and keeps its layout if the fonts never load. No font package is installed.
- **Icons:** the existing inline SVG icon set (`Icon.tsx`); no icon dependency was added.
- **Game arena layout:** three columns (players | board + toolbar | chat) from 1180px wide, board + a side column (players over chat) from 901px, and a single scrolling column below that. From 901px the game fills the viewport (`100dvh`) with no page scroll: the grid row is `minmax(0,1fr)`, the board area is a CSS size container, and the board is the largest 4:3 box that fits it (`min(100cqw, (100cqh - 6px) * 4/3 + 6px)`), so no toolbar or HUD height is guessed in CSS. The toolbar sits directly under the board at its natural height; when the window is wide but short it spans the stage column and can be slightly wider than the board.
- **Timer:** a stamp with a clock icon. It still renders the *server's* deadline (`endsAt` + measured clock offset); only its look changed.

## Prerequisites

- Node.js 20 or newer (22 recommended, see `.nvmrc`) and npm 10+
- Git (to deploy)

## Run locally

```bash
npm install
npm run dev:server      # terminal 1 -> game server on http://localhost:3001
npm run dev:client      # terminal 2 -> web app on  http://localhost:5173
```

Open http://localhost:5173 in two windows (use one normal and one private/incognito window, because each tab is a separate player) to play against yourself.

Production-style run (one server serves the game and the built web app, exactly like Render):

```bash
npm run build
npm start               # http://localhost:3001
```

### Scripts

| Command | What it does |
|---|---|
| `npm run dev:server` / `npm run dev:client` | Development servers with reload |
| `npm run build` | Builds the server (`server/dist`) and the client (`client/dist`) |
| `npm start` | Starts the built server (also serves `client/dist` if it exists) |
| `npm test` | Runs the server and client test suites |

### Environment variables

| Variable | Where | Default | Purpose |
|---|---|---|---|
| `PORT` | server | `3001` | Port to listen on (Render sets it automatically) |
| `CLIENT_ORIGIN` | server | `http://localhost:5173` | Comma-separated browser origins allowed by CORS. **Required in split-deploy** (set to your Vercel URL). Not needed in single-service mode (client and server share the same origin). |
| `STATIC_DIR` | server | `../client/dist` (relative to compiled entry) | Folder of the built web app to serve. **Single-service mode only.** Not used when the frontend is on Vercel. |
| `VITE_SERVER_URL` | client (build time) | dev: `http://localhost:3001`; production with no env var: `window.location.origin` | Backend URL baked into the client bundle. **Required in split-deploy** (set to your Render URL on Vercel). Leave unset in single-service mode (same origin). |
| `NODE_VERSION` | Render | `22` | Set in `render.yaml` |

No secrets are required. `.env` files are git-ignored; see `server/.env.example` and `client/.env.example`.

## Deploy on Vercel + Render (split-deploy — recommended)

The frontend is a static Vite build hosted on Vercel. The backend (Express + Socket.IO) runs on Render. They communicate over WebSocket/HTTP. This is the configuration that `render.yaml` is set up for.

**Step 1 — Push to GitHub**
```bash
git init && git add . && git commit -m "Doodle Guess"
git branch -M main && git remote add origin <your-repo-url> && git push -u origin main
```

**Step 2 — Deploy the backend on Render**

Option A — Blueprint (reads `render.yaml`):
In the Render dashboard choose **New → Blueprint**, pick the repository, and apply.

Option B — Manual Web Service:
- Build Command: `npm ci --include=dev && npm run build -w server`
- Start Command: `npm run start`
- Health Check Path: `/health`
- Environment variable: `NODE_VERSION=22`

After the service is live, copy its URL (e.g. `https://doodle-guess.onrender.com`). Then set:

| Render env var | Value |
|---|---|
| `CLIENT_ORIGIN` | Your Vercel frontend URL (set this **after** Step 3) |

**Step 3 — Deploy the frontend on Vercel**

1. In the Vercel dashboard choose **New Project**, import the GitHub repository.
2. Leave **Root Directory** as the **repo root** (do not change it to `client/` — the workspace `package-lock.json` lives at the root and Vercel must use it).
3. Set **Framework Preset** to **Vite**.
4. Set **Build Command** to: `npm ci --include=dev && npm run build -w client`
5. Set **Output Directory** to: `client/dist`
6. Add the environment variable:

| Vercel env var | Value |
|---|---|
| `VITE_SERVER_URL` | Your Render backend URL (from Step 2) |

7. Deploy. Copy the Vercel URL.

**Step 4 — Set `CLIENT_ORIGIN` on Render**

Go back to the Render dashboard → your service → Environment → set `CLIENT_ORIGIN` to the Vercel URL from Step 3, then redeploy (or it picks it up on the next deploy).

**Step 5 — Verify**

Open the Vercel URL, create a room, and test with two devices. Then paste the URL at the top of this README.

> **Note on SPA routing:** The app uses state-based navigation (no React Router, no sub-paths). All navigation stays on `/`, so no rewrite rules or `vercel.json` are needed.

---

## Deploy on Render (single-service, one URL — alternative)

The server also serves the built web app, so a single Render **Web Service** is enough — no CORS, no second host, no environment variables required.

To use this mode:

1. In `render.yaml`, change `buildCommand` to:
   ```
   npm ci --include=dev && npm run build
   ```
   (This builds both `server/dist` and `client/dist`.)
2. Remove or clear the `CLIENT_ORIGIN` env var.

Or deploy manually:
- Build Command: `npm ci --include=dev && npm run build`
- Start Command: `npm run start`
- Health Check Path: `/health`
- Environment variable: `NODE_VERSION=22`

When the deploy is live, open the URL, create a room, and test with two devices. Then put the URL at the top of this README.

Platform notes:
- Render supports long-lived WebSocket connections, so Socket.IO works as-is. Vercel runs serverless functions that **cannot hold a WebSocket server open**, so the **game server cannot live on Vercel** — only the static frontend can. If you want the web app on Vercel, deploy the server on Render (see the split-deploy section above).
- Game state lives in server memory. Run exactly **one instance** (more would split players across servers). A restart or redeploy ends all running games.
- Free instances sleep when idle. The first visit can take up to a minute; the app shows a "Connecting to server…" banner meanwhile.

## Project structure

```
server/src
  index.ts            starts the server (port, static client, SIGTERM)
  app.ts              createGameServer(): Express + Socket.IO, every socket event handler and its authorization
  RoomManager.ts      rooms, players, host, settings, public list, kick/ban, host migration, idle sweep
  Game.ts             one game: turn state machine, timers, words, hints, guessing, scoring
  DrawingManager.ts   per-room strokes (validation, caps, undo/clear)
  words.ts            categorized word packs, custom-word validation, no-repeat picker
  gallery.ts          Doodle Museum entry type + stroke compaction
  avatars.ts          fixed avatar list + validation
  view.ts             the only shape of a room that is sent to clients (strips secrets)
  *.test.ts           unit + socket integration tests
client/src
  App.tsx             socket wiring, reconnect, global state
  components/         Landing, CreateRoomModal, PackGrid, PublicRooms, Lobby, HostSettings, Game, Canvas, Chat, PlayerList,
                      Leaderboard (results), Museum, Toasts, Icon, Logo, Mascot, ...
  lib.ts              avatars, word-pack metadata, invite-code parser
  styles.css          the whole design system: Doodle Den tokens at the top, then base, buttons, forms, surfaces, one section per screen, responsive rules last
```

See [ARCHITECTURE.md](ARCHITECTURE.md) for how the pieces fit together and for the code walkthrough.

## Socket.IO event reference

Client → server (all have acknowledgements unless noted; the server validates and authorizes each one):

| Event | Payload | Who may send it |
|---|---|---|
| `create_room` | `{ token, playerName, avatar, settings, customWords }` | anyone (rate limited) |
| `join_room` | `{ token, roomCode, playerName, avatar }` | anyone (rate limited); same token = reconnect |
| `list_public_rooms` | – | anyone (rate limited) |
| `set_ready` | `{ ready }` | non-host players, lobby |
| `update_settings` | any of `maxPlayers, rounds, drawTime, wordCount, hints, isPublic, wordMode, categories, customOnly, customWords` | host, lobby |
| `kick_player` / `ban_player` | `{ playerId }` | host |
| `start_game` | – | host (everyone ready, 2+ players) |
| `choose_word` | `{ word }` | the drawer, choosing phase |
| `chat` (alias `guess`) | `{ text }` | players in a running game (rate limited) |
| `draw_start` / `draw_move` / `draw_end` | `{ color, size, x, y }` / `{ points }` / – | the drawer, drawing phase (no ack) |
| `draw_fill` | `{ color, x, y }` | the drawer, drawing phase (no ack); rate limited |
| `draw_undo` / `canvas_clear` | – | the drawer (no ack) |
| `time_sync` | – (ack returns `{ ok, now }`) | anyone; the client uses it to align its countdown with the server clock |
| `react` | `{ kind: 'like' \| 'dislike' }` | guessers, while drawing / turn end; one vote per turn (rate limited) |
| `get_gallery` | – | players, **not** while a game is running; returns `{ gallery }` |
| `play_again` | `{ restart?: true }` | host, finished game. Without `restart` it returns to the lobby; with it a new game starts immediately |
| `leave_room` | – | players |

Server → client:

| Event | Payload |
|---|---|
| `room_state` | the public room: settings, players (with avatar/score/connected), phase, drawer, game state, hint. Never tokens, words, custom words or bans |
| `you` | `{ id }` your own public id |
| `private_state` | `{ wordOptions, word }` only to the drawer (null for everyone else) |
| `host_settings` | `{ customWords }` only to the host |
| `chat_message` | `{ id, kind: chat \| system \| correct \| like \| dislike \| close, playerName, text, restricted }` (`close` is sent only to the guesser it is about) |
| `canvas_state` | `{ strokes }` authoritative canvas (join, reconnect, undo, clear, new turn, resync after a rejected stroke) |
| `draw_start` / `draw_move` / `draw_end` / `draw_fill` | live strokes and fills for guessers (the drawer renders locally) |
| `kicked` | `{ banned }` |

How this maps to the assignment's suggested events: `player_joined`, `player_left`, `game_state`, `round_start`, `round_end`, `game_over` are all carried by `room_state` (the whole public state is re-sent on every change); `word_chosen` is `choose_word`; `draw_data` is the `draw_*` broadcast (the drawer is not echoed, to avoid lag); `guess_result` is a `chat_message` with `kind: "correct"`.

## Rules

- **Scoring:** correct guess = 100 + up to 300 time bonus + order bonus (1st +50, 2nd +30, 3rd +15). The drawer earns 30 per correct guesser. A player is marked as guessed before points are added, so repeated guesses never score twice.
- **Word matching:** the server trims the guess, lowercases it and collapses repeated spaces, then compares it with the secret word (exact match; there is no partial match). A wrong guess within one edit (two for words of 8+ letters; spaces and punctuation ignored) triggers the private "Your guess is close!" notice; words shorter than 4 letters never do.
- **Timer:** the server owns every deadline (`endsAt`). Each browser measures its clock offset with `time_sync` (5 pings, shortest round trip wins, repeated every 30 s) and shows `ceil(endsAt - serverNow)`, ticking on whole seconds, so all players see the same number.
- **Fill tool:** a fill is stored as one more stroke (`fill: true`) in the room's ordered stroke list. Every browser flood-fills its own canvas when it replays that list, so undo, late join, reconnect and the Doodle Museum all work without extra code. Anti-aliasing could in theory differ slightly between very different browsers; the fill tolerance hides this.
- **Hints (Normal mode):** two letters are revealed, at 50% and 75% of the draw time, for words with 4+ letters. **Hidden mode:** guessers see no blanks, no length and no hints.
- **Words:** 3 choices per turn from the selected categories plus the host's custom words (or only custom words). Words are not repeated within a game until the pool runs out.
- **Turn ends** when time runs out or every connected guesser has guessed. Everyone gets one turn per round.
- **Room lifecycle:** lobby → playing → ended (leaderboard) → host presses "Play again" → lobby. Joining is allowed in the lobby and in a finished room, not while a game is running. A player whose token is still in the room can always reconnect.
- **Host:** if the host is offline for 15s (or leaves), the first connected player becomes host. "Play again" drops players who are offline.

## Security notes

- Every player has a public `id` and a secret `token` (kept in `sessionStorage`). Only the token can reconnect a seat and the server never sends it out.
- The secret word is kept only inside the server's `Game` object. Guessers never receive it before the turn ends; the drawer gets it on a private message. Custom words go only to the host.
- Every action is authorized on the server (host-only, drawer-only, phase checks). Only the socket that currently owns a seat can act for it.
- Inputs are validated and clamped; control characters are stripped; avatars must come from a fixed list; messages are limited to 100 KB.
- Rate limits per connection: drawing, chat, joins, room creation, room list, moderation. At most 1000 rooms; rooms that were offline for 5 minutes are deleted.
- A **ban** remembers the banned browser session's token. It does not stop someone who opens a new private window.

## Testing

- **Automated** (`npm test`): server unit tests for rooms, host rules, scoring, timers, words, custom words, public listing, moderation and the public-view privacy rule; **socket integration tests** that start the real server and use real Socket.IO clients (authorization, secrecy, reconnect, kick/ban, public rooms, hidden mode, rate limits, drawing resync); client tests for the invite-link parser.
- **Production build:** `npm run build` and a production-style smoke run (`npm start`: web app, deep link, `/health` and Socket.IO from one origin).
- **Not automated:** how the UI looks and behaves in a browser. Use the manual checklist below.

### Manual browser checklist (two or three windows)

1. Landing: pick an avatar, create a **public** room; in another window see it under "Public rooms" and join it. Create a private room and check it is not listed. Paste an invite link into the code box.
1b. Avatar: use the < > arrows and the dice on the landing page; confirm the face shows in the lobby, player list and results. The landing page has no word-pack section; packs are chosen in **Create Room**.
2. Lobby: as host change mode, categories and custom words (save 3+ words, tick "Only use my words"), watch the other window update. Check the 👑 Host badge, Ready buttons, Kick and Ban (a banned window must not be able to rejoin).
3. Game: start; drawer picks a word, draws with every tool; guessers see strokes live. In **Hidden** mode guessers see "Hidden word" instead of blanks. Check hints, the timer, scores, and the 👑 Host badge on the game screen.
3b. Leave: during a game click **🚪 Leave** in the header (next to the timer), check the confirmation dialog (Esc / "Stay in game" keep you playing), confirm, and check you land on the home page. Try it as the host, as the drawer and as a guesser: the others keep playing, a new host is shown, and the room disappears from "Public rooms" once everyone has left.
4. Resilience: refresh the drawer and a guesser mid-turn; close the host's window and wait ~15s to see another player become host.
5. End: leaderboard shows winner and avatars; host presses "Play again"; resize the window / use a phone to check the layout and touch drawing.

## Verification status

Server logic (rooms, lobby, settings, turn rotation, word choice, hints, packs, guessing, scoring, winner/tie, reactions, museum, play again, reconnect, host migration, kick/ban, rate limits) is covered by the unit tests and by the socket-level `integration.test.ts`. Run `npm test` and `npm run build` before deploying, and play one real game with two devices using the manual checklist above. The live URL needs your own Render account.

## UI notes
- The page background is an original doodle tile (`client/src/assets/doodles.svg`) over deep indigo; the drawing sheet is warm white so the canvas is never on top of the pattern.
- The in-game **Leave Room** button (top bar) opens a confirmation dialog (`components/ConfirmDialog.tsx`), then the client returns to the landing page immediately and sends `leave_room`. The server migrates the host, ends the turn if the drawer left, ends the game if fewer than 2 players remain, and deletes an empty room. Late `room_state` packets for a room the player already left are ignored.
- On desktop the game screen is sized to the window (no page scroll); on tablet and phone it stacks, with the chat directly under the canvas.

## Design system

Deep-indigo surfaces, a warm-white drawing sheet and four accent colours with fixed meanings (mint = go / correct, pink = leave / danger, yellow = host / highlight, sky = secondary action). Display type is Lilita One and body type is Nunito; both load from Google Fonts and fall back to local fonts when offline. UI icons are one hand-written SVG set (`components/Icon.tsx`); player avatars are original SVG cartoon faces (`components/Avatar.tsx`). The logo, mascot and doodle background are original artwork. Animations (confetti, floating mascot, banners) only run when the OS does not request reduced motion.

## Automated tests

```bash
npm test            # server (vitest) + client (vitest)
npm run build
```

`server/src/Museum.test.ts` covers word count, hints, word packs, the museum (including that it never leaks through public room state) and winner calculation; `Reactions.test.ts` covers the one-vote-per-turn rules. The socket-level suite is `integration.test.ts`.

## Known limitations

- Game state, the Doodle Museum and rooms live in server memory: a restart or redeploy ends running games and clears the museum. Run one instance.
- The museum keeps the last game of a room until the next game starts; each drawing is thinned to about 900 points and at most 60 drawings are kept.
- Ban is per browser session (it uses the player's secret token), so a determined player can return from a new browser profile.
- Combination word mode, spectators and replay (bonus ideas in the assignment) are not implemented.
- Like / dislike notices name the voter in the chat (as skribbl does); the public room state still only exposes counts and who has voted, never who voted what.

Screenshots in `docs/screenshots/` were rendered in Chromium with the *fallback* fonts (Shantell Sans could not be downloaded in that environment), so real text will look more hand-drawn.

## Waiting lobby
The lobby reuses the game screen's layout: header (logo, Lobby tag, status, Public/Private, Leave) | waiting panel in the board's place with the
drawing toolbar below it (shared `DrawToolbar`, shown disabled until the game starts) | joined players (`PlayerList`, only real players, no empty slots) and chat.
Settings are chosen in the Create Room dialog only and appear in the lobby as compact badges.
Lobby chat uses the existing `chat` Socket.IO event. While `room.phase === 'lobby'` the server broadcasts the message to the room
(100-character limit and the same rate limit as game chat); during a game the original guess/chat logic is unchanged, so the secret word is never involved.
