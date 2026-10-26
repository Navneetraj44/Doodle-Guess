# Doodle-Guess — Architecture and Code Walkthrough

This document explains how the implementation meets the core requirements of the skribbl.io clone assignment: multiplayer rooms, turn-based drawing, real-time synchronization, word selection and hints, scoring, a leaderboard, and public deployment.

## 1. System overview

```text
Player browser A                                   Player browser B
React + TypeScript + Canvas                        React + TypeScript + Canvas
          |                                                  |
          +---------------- Socket.IO -----------------------+
                               |
                               v
                    Node.js + Express server
                    (single running instance)
                               |
             +-----------------+------------------+
             |                 |                  |
        RoomManager           Game          DrawingManager
        rooms/players      turns/words/       strokes/undo/
        host/settings      timers/scoring     canvas state
                               |
                         Public room view
                          via view.ts
```

The browser captures user input and renders the state it receives. The server validates actions and is authoritative for room membership, host permissions, turn order, secret words, timers, guesses, and scores.

## 2. Technology stack

| Layer | Technology | Responsibility |
|---|---|---|
| Frontend | React, TypeScript, Vite | Landing page, lobby, game UI, player list, chat, timer, results |
| Drawing | HTML5 Canvas API | Capture and render drawing strokes |
| Backend | Node.js, Express | HTTP health endpoint and game server |
| Real-time communication | Socket.IO | Room events, drawing updates, chat, guesses, and state synchronization |
| Validation and tests | TypeScript, Vitest, Socket.IO integration tests | Type checking and automated behavior checks |
| Deployment | Vercel + Render | Vercel hosts the frontend; Render hosts the persistent Socket.IO backend |

## 3. Main project structure

```text
client/
  src/
    App.tsx                 Socket connection, room state, reconnect behavior
    components/
      Canvas.tsx            Drawing surface and pointer input
      Chat.tsx              Chat and guess interface
      Game.tsx              Active game screen
      Lobby.tsx             Waiting room
      PlayerList.tsx        Players and scores
      Timer.tsx             Countdown display
      Leaderboard.tsx       Final results
    lib.ts                  Shared client-side helpers and word-pack metadata
    styles.css              Layout, design tokens, responsive styling

server/
  src/
    app.ts                  Express + Socket.IO setup and event handlers
    RoomManager.ts          Rooms, players, host, settings, moderation
    Game.ts                 Turn state machine, words, hints, timers, scoring
    DrawingManager.ts       Drawing stroke validation, storage, undo/clear
    words.ts                Categorized word packs and custom-word validation
    gallery.ts              Completed-game drawing snapshots for Doodle Museum
    view.ts                 Safe public room-state projection
    *.test.ts               Unit and integration tests

package.json                Workspace scripts
package-lock.json           Locked dependency versions
render.yaml                 Render deployment configuration
README.md                   Setup, features, and deployment instructions
```

## 4. Core gameplay flow

1. A player creates a public/private room or joins with a room code or invite link.
2. The server registers the player and sends the room's public state to participants.
3. The host configures room settings and starts the game when the room is ready.
4. At each turn, the drawer receives word options privately and chooses one. If the drawer does not choose in time, the server auto-selects a word.
5. The drawer draws on the canvas. Drawing events are validated by the server and synchronized to the other players through Socket.IO.
6. Other players submit guesses through chat. The server normalizes and checks each guess, then calculates points for correct guesses.
7. Turns rotate through players. When all rounds finish, the server sends the final leaderboard and winner/tie result.

## 5. Drawing and real-time synchronization

1. **Capture:** The canvas uses pointer input, supporting mouse and touch. Points are normalized to the canvas dimensions so the drawing scales across screen sizes.
2. **Send:** The client emits drawing events such as `draw_start`, batched `draw_move`, and `draw_end`.
3. **Authorize and validate:** The server verifies that the sender is the current drawer and that the game is in the drawing phase. It validates drawing parameters and applies rate/size limits.
4. **Store and broadcast:** `DrawingManager` stores accepted strokes; the server broadcasts the validated drawing data to other players in the room.
5. **Render:** Each receiving browser renders the drawing on its own canvas.
6. **Resync:** Undo, clear, reconnect, and late joining use the server's current canvas state so clients can redraw consistently.

The drawer renders their own strokes locally to keep drawing responsive; other players receive the synchronized events from the server.

## 6. Game state, words, and scoring

The `Game` class manages a per-room state machine:

```text
choosing word → drawing → turn end → next turn → game over
```

- **Word choices:** The drawer receives the configured number of word options. Word pools are built from selected categories and any custom words allowed by the host settings.
- **Hints:** In Normal mode, letters are revealed during the drawing period according to the game rules. Hidden mode does not show the usual word blanks or hints.
- **Word matching:** The server trims guesses, converts them to lowercase, and collapses repeated whitespace before exact comparison with the secret word. It also supports a private close-guess notice for near misses.
- **Scoring:** The server awards points for correct guesses and applies the game's time/order bonuses and drawer points. A player cannot score repeatedly for guessing correctly more than once in the same turn.
- **Turn endings:** A turn ends when the timer expires, all connected guessers have guessed, or the drawer leaves. At game end, the server supplies the leaderboard and winner/tie state.

## 7. Socket.IO communication and event security

Socket.IO provides the live connection between browser clients and the server. Events cover room creation/joining, lobby settings, starting a game, choosing a word, drawing, chat/guesses, reactions, reconnecting, and requesting the completed-game gallery.

For incoming actions, the server checks the socket's room/seat, the player's permissions, and the current game phase before applying the action. Rate limits and input validation reduce accidental or abusive event traffic. Public room state is built through `view.ts` so secret reconnect tokens and secret words are not sent to guessers.

## 8. Deployment architecture

The application uses a split deployment, as allowed by the assignment's deployment section (PDF page 6):

- **Frontend:** Vercel — https://doodle-guess-six.vercel.app
- **Backend:** Render Web Service — https://doodle-guess-7fk1.onrender.com

The frontend connects directly to the Render backend through Socket.IO.

### Relevant environment variables

| Variable | Set on | Purpose |
|---|---|---|
| `VITE_SERVER_URL` | Vercel | Render backend URL embedded in the frontend build |
| `CLIENT_ORIGIN` | Render | Allows the deployed Vercel origin through CORS |
| `PORT` | Render | Port provided by the hosting platform |
| `NODE_VERSION` | Render | Node.js runtime version (22) |

Vercel is used for the frontend rather than hosting the persistent Socket.IO server because its serverless functions are not intended to keep a long-lived game WebSocket server running. Render supports the backend's persistent WebSocket connection.

**Runtime constraints:**
- Game rooms and the Doodle Museum are stored in server memory, so a restart/redeploy clears active rooms and stored gallery entries.
- Run one backend instance so players share the same in-memory room state.
- Render's free service can sleep after inactivity; the first connection after sleeping may take time to start.

## 9. Assignment requirements coverage

| Assignment requirement | Implementation |
|---|---|
| Create/join rooms and invite links | `RoomManager` and room events |
| Public/private rooms and lobby | Public-room listing, room settings, ready-up and host start |
| Turn-based drawing | `Game` state machine and turn queue |
| Real-time drawing via WebSockets | Socket.IO drawing events and `DrawingManager` |
| Word selection and hints | Word pool, private drawer word options, Normal/Hidden modes |
| Chat and guessing | Chat/guess handlers and server-side word matching |
| Scoring and leaderboard | Server-side score calculation and final game state |
| Drawing tools | Canvas tools, undo, clear, eraser, fill |
| Public deployment and live URL | Vercel frontend + Render backend (links above) |
| Architecture and code walkthrough | This document and `README.md` |

### Optional/bonus items not implemented

The assignment lists Combination word mode, spectator mode, replay, votekick, report, and multiple-language word lists as optional or bonus ideas. They are not implemented in the current version. The project does include configurable room settings, custom words, avatars, and host kick/ban controls.

## 10. Automated and manual verification

Run from the repository root:

```bash
npm test
npm run build
```

For a manual production check, open the live frontend in two separate browser profiles/devices and test:

1. Create a room and join it from the second browser.
2. Confirm lobby/player state updates.
3. Start the game and verify drawing updates appear on the other browser.
4. Submit a correct guess and check notifications and scores.
5. Finish the game and verify the leaderboard.
6. Refresh a browser during a turn and verify reconnection/canvas recovery.

The assignment asks for the core production flow—create room → draw → guess → score—to work publicly, and asks students to be ready to explain drawing synchronization, game state, WebSockets, word matching, and deployment constraints (PDF page 6). This document is organized around those points.
