# 🎨 Doodle-Guess

A real-time multiplayer drawing and guessing game inspired by skribbl.io. Players create or join rooms, take turns drawing secret words, guess through chat, and compete for the highest score.

**Live demo:** https://doodle-guess-six.vercel.app  
**GitHub repository:** https://github.com/Navneetraj44/Doodle-Guess

## Features

- **Multiplayer rooms:** Create public or private rooms and join with a room code or invite link.
- **Lobby:** View players, ready up, and let the host start the game.
- **Configurable settings:** Set player limit, rounds, drawing time, word choices, hints, word mode, word categories, and custom words.
- **Real-time drawing:** Canvas drawing synchronized through Socket.IO, with colors, brush sizes, eraser, fill, undo, and clear tools.
- **Turn-based gameplay:** Players choose words, draw, guess, and rotate turns across rounds.
- **Scoring and results:** Correct-guess points, time/order bonuses, drawer points, leaderboard, winner/tie handling, and Play Again.
- **Chat and hints:** Guess through chat, receive correct-guess notifications and timed hints; close-guess feedback is private to the relevant player.
- **Player avatars:** Customizable cartoon avatars.
- **Host controls:** Kick/ban players and transfer host status when the host leaves or disconnects.
- **Word packs:** Categorized word lists plus optional custom words.
- **Doodle Museum:** Review drawings from the completed game.
- **Responsive interface:** Supports desktop, tablet, and mobile layouts.

## Tech stack

| Layer | Technology | Purpose |
|---|---|---|
| Frontend | React, TypeScript, Vite | User interface and game screens |
| Drawing | HTML5 Canvas API | Render and replay drawing strokes |
| Backend | Node.js, Express | Server and game logic |
| Real-time communication | Socket.IO | Drawing, chat, room updates, and game-state synchronization |
| Testing | Vitest and Socket.IO integration tests | Validate game logic and client utilities |
| Hosting | Vercel + Render | Vercel serves the frontend; Render runs the persistent Socket.IO backend |

## How it works

1. A player creates a room or joins with a room code/invite link.
2. Players wait in the lobby; the host configures settings and starts the game.
3. The server selects the drawer and sends word choices privately to that player.
4. The drawer's strokes are sent to the server and synchronized with the other players over Socket.IO.
5. Players submit guesses through chat. The server checks guesses and calculates scores.
6. Turns and rounds continue until the game ends, then the server provides the final leaderboard.

The server is authoritative for room membership, game phase, turns, timers, word selection, guesses, and scores. The secret word and reconnect tokens are not included in the public room state.

## Architecture overview

- **`client/`** — React + TypeScript + Vite frontend.
- **`server/`** — Express + Socket.IO backend and authoritative game logic.
- **`server/src/RoomManager.ts`** — room membership, players, host, room settings, public-room listing, and moderation.
- **`server/src/Game.ts`** — turn flow, word selection, hints, timers, guessing, and scoring.
- **`server/src/DrawingManager.ts`** — drawing strokes, validation, undo, and canvas clearing.
- **`server/src/app.ts`** — Socket.IO event handlers and server-side authorization.
- **`client/src/App.tsx`** — client socket wiring, reconnect handling, and global state.
- **`client/src/styles.css`** — application styling and responsive layout.

For more detail, see [ARCHITECTURE.md](./ARCHITECTURE.md).

## Run locally

### Prerequisites

- Node.js 20 or newer (Node.js 22 recommended)
- npm 10 or newer
- Git

### Install and start

From the repository root:

```bash
npm install
npm run dev:server
```

In a second terminal, from the repository root:

```bash
npm run dev:client
```

Open http://localhost:5173. Use two separate browser windows (for example, a regular window and an incognito window) to test multiplayer.

### Build, test, and production-style run

```bash
npm test
npm run build
npm start
```

The production-style server runs at http://localhost:3001 by default.

## Deployment

This project is deployed as a split frontend/backend setup because the game server requires persistent WebSocket connections.

- **Frontend (Vercel):** https://doodle-guess-six.vercel.app
- **Backend (Render):** https://doodle-guess-7fk1.onrender.com

### Deployment configuration

- Vercel builds the frontend from the `client/` directory.
- Set the Vercel environment variable `VITE_SERVER_URL` to the Render backend URL:
  `https://doodle-guess-7fk1.onrender.com`
- Set the Render environment variable `CLIENT_ORIGIN` to the deployed Vercel frontend URL:
  `https://doodle-guess-six.vercel.app`
- Render supplies the server `PORT` automatically. The project uses Node.js 22.

If you fork or redeploy the project, replace these environment-variable values with your own frontend and backend URLs. Redeploy the frontend after changing `VITE_SERVER_URL`, because it is embedded at build time.

**Free-tier note:** Render Free services may spin down after inactivity. The first connection after a period of inactivity can take some time while the backend starts.

## Testing

Run the automated test suites:

```bash
npm test
```

Build the frontend and backend:

```bash
npm run build
```

For a manual multiplayer smoke test, open the live demo in two separate browsers/devices and verify that room creation/joining, drawing synchronization, guessing, scores, and the final leaderboard work.

## Known limitations

- Room and game state are stored in server memory. A backend restart or redeploy clears active rooms and the Doodle Museum.
- Run one backend instance; multiple independent instances would not share in-memory room state.
- The Combination word mode, spectator mode, and drawing replay are not implemented.
- Host bans apply to the relevant browser session/token and do not prevent a determined user from opening a new browser profile.

## Assignment alignment

This project implements the assignment's central flow: create/join rooms, lobby and host controls, turn-based drawing, real-time drawing synchronization, word selection and hints, guessing, scoring, and end-of-game leaderboard. The assignment's optional/bonus ideas are not all implemented; see **Known limitations** above.

## License

No license has been specified yet. Contact the repository owner before reusing or redistributing this project.
