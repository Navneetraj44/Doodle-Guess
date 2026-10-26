import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createGameServer } from './app.js';

const PORT = Number(process.env.PORT) || 3001;
const origins = (process.env.CLIENT_ORIGIN || 'http://localhost:5173').split(',').map(o => o.trim()).filter(Boolean);
// If the client has been built (client/dist), this same server also serves it: one URL, no CORS, one deploy.
const here = path.dirname(fileURLToPath(import.meta.url));
const staticDir = process.env.STATIC_DIR || path.resolve(here, '../../client/dist');

const srv = createGameServer({ origins, staticDir });
srv.httpServer.listen(PORT, () => console.log(`Server listening on :${PORT}`));
// Render/Railway send SIGTERM on redeploy: close sockets cleanly.
process.on('SIGTERM', () => { srv.close().finally(() => process.exit(0)); setTimeout(() => process.exit(0), 3000).unref(); });
