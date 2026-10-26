# Architecture and code walkthrough

## Big picture

```
 Browser (React + Canvas)                       Node.js server (one process)
 ┌──────────────────────┐   Socket.IO (WebSocket)   ┌─────────────────────────────────────────────┐
 │ Landing / Lobby      │  events + acknowledgements │ app.ts   socket handlers + authorization    │
 │ Game: Canvas, Chat,  │ ◄────────────────────────► │   ├─ RoomManager   rooms, players, host     │
 │ PlayerList, Timer    │                            │   ├─ Game (per room) turns, words, scoring  │
 │ (renders what the    │   room_state (public view) │   ├─ DrawingManager strokes per room        │
 │  server tells it)    │ ◄──────────────────────────│   └─ view.ts  what is allowed to leave      │
 └──────────────────────┘                            │ Express: /health + built client (client/dist)│
                                                     └─────────────────────────────────────────────┘
```

The browser never decides anything about the game. It sends *requests* (`start_game`, `choose_word`, `chat`, `draw_*`) and renders the *state* the server broadcasts. Everything that matters (who is host, whose turn it is, the secret word, the timer, the score) is owned and checked by the server.

## Frontend

- **React + TypeScript + Vite.** `App.tsx` owns the socket connection, the current room, chat messages, the private state (word options / secret word for the drawer), and reconnect logic.
- **Styling:** one stylesheet (`styles.css`) with design tokens (palette, fonts, corner shapes, shadows) at the top; components only pick class names. The game screen's column widths are computed in CSS from the container width and the viewport height (see the comment above `.game` and the *Responsive* section).
- **Screens:** `Landing` (profile, create, join, `PublicRooms`) → `Lobby` (players, `HostSettings`, kick/ban) → `Game` (`Canvas`, tools, `PlayerList`, `Chat`, `Timer`) → `Leaderboard`.
- **Server clock:** every `room_state` carries `serverNow`. The client stores `serverNow - Date.now()` and the `Timer` counts down to the server's `endsAt`, so countdowns match on every device.
- **Identity:** the browser keeps a random secret `token` in `sessionStorage`. The server answers with a separate public `id` (`you` event).

## Canvas and drawing sync

1. **Capture.** The canvas uses Pointer Events (mouse, touch and pen with one code path; `touch-action: none` stops page scrolling while drawing). Each point is converted to **normalized coordinates (0..1)** relative to the canvas size, so the picture looks the same on any screen size. The canvas has a fixed internal 800×600 resolution that CSS scales.
2. **Send.** The drawer emits `draw_start {color,size,x,y}` on pointer down. Points collected during the move are **batched and sent every ~30 ms** as `draw_move {points}` (not one message per mouse event). `draw_end` on release.
3. **Validate and store.** The server checks that the sender is the current drawer during the drawing phase, rate limits, validates color (`#rrggbb`), size (1–40), clamps coordinates, caps points per message and strokes per canvas, and appends to that room's stroke list (`DrawingManager`).
4. **Broadcast.** The server relays the clean data to everyone else in the room. The drawer is not echoed: they already drew locally, which keeps drawing lag-free.
5. **Render.** Every client draws each new segment with round line caps onto its own canvas.
6. **Authoritative resets.** Undo, clear, a new turn, a reconnect, and a late join all send `canvas_state {strokes}` (the full stroke list), and clients redraw from scratch. Undo simply removes the last stroke on the server. The eraser is just a white stroke, so it can be undone too.
7. **No silent divergence.** If the server rejects a drawing event (invalid data, canvas full, drawing too fast), it re-sends `canvas_state` to the drawer and posts the reason in the chat.

## Game state (server-authoritative)

`Game` is a small state machine, one instance per running room:

```
choosing (15s, drawer picks 1 of `wordCount`; auto-pick on timeout)
   → drawing (draw time; hint reveals at 50% and 75% in Normal mode)
   → turn_end (5s: word revealed, points shown)
   → next turn ... → game_over (leaderboard, winners)
```

- **Turn order:** at the start of each round the queue is the connected players in join order. Everyone draws once per round. Players who left or are offline are skipped.
- **Ending a turn:** time runs out, or every connected guesser has guessed, or the drawer leaves. `endTurn()` ignores calls unless the turn is in `choosing`/`drawing`, so a turn can never end twice.
- **Timers** are `setTimeout`s on the server, cleared on every transition and wrapped in try/catch so an error in a timer cannot crash the process.
- **Words:** `buildPool()` combines the selected categories and the host's custom words (or only custom words); `pickFromPool()` offers 3 unused words and recycles only when the pool is exhausted.
- **Public vs private data:** the public `GameView` has the masked hint and, only at `turn_end`, the revealed word. The secret word lives in a private field of `Game` and is sent only to the drawer with `private_state`.
- **Scoring:** see README. The "guessed" set is updated *before* points are added, so repeat guesses cannot score twice.

## WebSockets (Socket.IO)

- One Socket.IO room per game room (`io.to(code).emit(...)`). Request/response actions use **acknowledgements** (`ok` / `error`), so the UI can show clear messages.
- `app.ts` registers all handlers. Each handler first calls `ctx()` (who is this socket, in which room, and does this socket still own the seat?), then checks its own permission (host, drawer, phase), then rate limits, then calls `RoomManager` / `Game`. Business rules are in those classes, which are easy to unit test.
- **Reconnection:** a refresh creates a new socket. The client sends `join_room` with the same token, the server re-attaches the new socket to the same seat, and re-sends canvas, private word and state. The old socket is rejected from then on. Disconnects have a grace period (8s in game, 15s in the lobby) so a refresh does not end a turn or remove a player.
- **What may leave the server** is decided in one place, `view.ts` (`toPublicRoom`): it removes tokens, socket ids, custom words and the ban list.

## Word matching

`normalizeGuess` trims, lowercases and collapses whitespace; the guess is correct only if it equals the normalized secret word. Players who already guessed (and the drawer) can chat but their messages go only to each other, so the word cannot be leaked to people still guessing. There is no partial or "close guess" matching: a partial match would also accept things like "cat" for "category", and the assignment's checklist does not require it.

## Deployment

**Split-deploy (default):** The frontend (`client/`) is deployed to Vercel; the backend (`server/`) is deployed to Render as a Web Service (`render.yaml`). Render runs `npm run build -w server` (TypeScript only) then `npm run start`. Vercel runs `npm ci --include=dev && npm run build -w client` from the repo root with `VITE_SERVER_URL` set to the Render service URL; the output directory is `client/dist`. CORS is configured on the server via the `CLIENT_ORIGIN` env var (set to the Vercel URL). Vercel hosts the static SPA; the WebSocket connection goes directly to the Render service.

**Single-service alternative:** One Render Web Service can also run `npm run build` (builds both server and client), then `npm run start`. The server detects `client/dist/index.html` at startup and serves the web app from the same origin — no CORS setup, no Vercel needed. Change the `buildCommand` in `render.yaml` as described in its comments to use this mode.

Constraints worth knowing: WebSocket support is required (Render has it; Vercel runs serverless functions that cannot hold a WebSocket server open, so **only the static frontend** lives on Vercel — the game server must be on Render or a comparable platform). Game state lives in server memory — run exactly **one instance**. A restart or redeploy ends all running games. Free Render instances sleep when idle; the first request can take up to a minute.

## Code walkthrough: answers to the assignment's questions

- **How are strokes captured, sent and rendered?** See "Canvas and drawing sync" above (`client/src/components/Canvas.tsx`, `server/src/DrawingManager.ts`, drawing handlers in `server/src/app.ts`).
- **How is game state managed?** `server/src/Game.ts` (state machine, queue, timers, scoring) owned by `app.ts`; clients only render `room_state`.
- **How are WebSockets used?** Socket.IO events and acknowledgements in `app.ts`; the full list is in the README.
- **How does word matching work?** `normalizeGuess` in `Game.ts` (case, trim, whitespace), exact match; see above.
- **Deployment and constraints?** See "Deployment" above and the README.
- **Tech choices:** React for the UI state, Canvas for pixel drawing, Socket.IO for rooms/acknowledgements/automatic reconnection and fallbacks, TypeScript on both sides to catch mistakes, Vitest for fast tests, one service on Render to avoid CORS and cross-origin cookies entirely.

## Reactions (👍 / 👎)

`react {kind: 'like' | 'dislike'}` (acknowledged). `Game.react()` enforces: valid kind, drawing or turn_end phase only, the drawer cannot vote, and **one vote per player per turn** (a second vote is rejected). The public `GameView` carries only `likes`, `dislikes` and `voted` (who has voted, never what). Votes reset at the start of every turn. A per-socket rate limit adds protection against click spam.

## Word packs

`server/src/words.ts` holds one list per pack and `CATEGORIES` is simply their keys. `Game.start()` builds the round's pool from the room's selected packs (and custom words) and `pickFromPool` draws `wordCount` words from it for each turn, so the pack tiles in the UI change what the server offers. The client's `PACKS` in `lib.ts` only adds labels and icons for the same ids.

## Doodle Museum

When a turn ends, `Game.saveDrawing()` asks the server for that room's strokes (`snapshotCanvas`, backed by `DrawingManager`), thins them (`gallery.ts`) and stores one entry with the word, artist, round and reaction counts. Entries are NOT part of the public room state. `get_gallery` returns them, and refuses while a game is running, so a secret word can never be fetched early. After `play_again` the finished game's entries are kept in `galleries` until the next game starts; the client only gets a `museumCount` number in the room state. The client renders the saved strokes with the same `drawFull` function as the live canvas.


## Additions: fill tool, timer sync, close-guess and vote notices, cartoon avatars

- **Fill.** `draw_fill {color,x,y}` (drawer only, rate limited) is validated by `DrawingManager.fill` and stored as a stroke with `fill: true`, then relayed to the other players. Browsers replay the ordered stroke list and run `client/src/floodFill.ts` for fill strokes, so undo/clear/reconnect/museum reuse the existing `canvas_state` path.
- **Timer.** Deadlines are server timestamps. `time_sync` gives each client its clock offset (`client/src/clock.ts`, best of 5 pings); `Timer.tsx` recomputes seconds from `endsAt` on every tick and re-aligns on tab visibility.
- **Close guess.** `server/src/closeGuess.ts` (edit distance) is called from `Game.handleMessage`; the notice is a `chat_message` of kind `close` sent only to that player's socket.
- **Vote notices.** `Game.react` emits a public `like`/`dislike` chat message after the vote is accepted (never for rejected votes).
- **Avatars.** Stored as a validated code `color-eyes-mouth`; the face is drawn client-side.
