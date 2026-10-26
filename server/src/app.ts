import express from 'express';
import cors from 'cors';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { Server, Socket } from 'socket.io';
import { RoomManager, GameError } from './RoomManager.js';
import { DrawingManager } from './DrawingManager.js';
import { Game, GameDeps } from './Game.js';
import { Room } from './types.js';
import { GalleryEntry } from './gallery.js';
import { toPublicRoom } from './view.js';

export interface ServerOptions {
  origins?: string[];        // allowed browser origins (only needed when the client is hosted on a different domain)
  staticDir?: string;        // built client (client/dist); when present the same server also serves the web app
  sweepIntervalMs?: number;  // how often to look for abandoned rooms
  idleRoomTtlMs?: number;    // delete rooms where everyone has been offline this long
}
type Ack = (res: { ok: true; room?: unknown; rooms?: unknown } | { ok: false; error: string }) => void;

/** Builds the HTTP + Socket.IO server without listening, so tests can start it on any port. */
export function createGameServer(opts: ServerOptions = {}) {
  const origins = opts.origins ?? ['http://localhost:5173'];
  const app = express();
  app.disable('x-powered-by');
  app.use((_req, res, next) => { res.setHeader('X-Content-Type-Options', 'nosniff'); next(); });
  app.use(cors({ origin: origins }));
  app.get('/health', (_req, res) => res.json({ ok: true }));
  if (opts.staticDir && fs.existsSync(path.join(opts.staticDir, 'index.html'))) {
    app.use(express.static(opts.staticDir, { maxAge: '1h' }));
    app.get('*', (_req, res) => res.sendFile(path.join(opts.staticDir!, 'index.html'))); // Socket.IO answers /socket.io/* before Express sees it
  } else {
    app.get('/', (_req, res) => res.type('text').send('Doodle Guess game server is running.'));
  }

  const server = http.createServer(app);
  const io = new Server(server, { cors: { origin: origins }, maxHttpBufferSize: 1e5 }); // 100 KB max message
  const rooms = new RoomManager();
  const drawing = new DrawingManager();
  const games = new Map<string, Game>();
  const galleries = new Map<string, GalleryEntry[]>(); // finished games' drawings, kept until the next game starts (Doodle Museum)
  let msgId = 0;

  const system = (room: Room, text: string) => io.to(room.code).emit('chat_message', { id: ++msgId, kind: 'system', text });
  const broadcast = (room: Room) => {
    io.to(room.code).emit('room_state', toPublicRoom(room));
    // Custom words are private to the host (they would hint at the secret word), so only the host receives the list.
    const host = room.players.find(p => p.id === room.hostId);
    if (room.phase === 'lobby' && host?.socketId) io.to(host.socketId).emit('host_settings', { customWords: room.customWords });
  };
  function handle(fn: () => Room | void, ack?: Ack) {
    try { const room = fn(); ack?.({ ok: true, room: room ? toPublicRoom(room) : undefined }); }
    catch (e) {
      ack?.({ ok: false, error: e instanceof GameError ? e.message : 'Something went wrong.' });
      if (!(e instanceof GameError)) console.error(e);
    }
  }
  const makeDeps = (room: Room): GameDeps => {
    const to = (pid: string) => room.players.find(p => p.id === pid)?.socketId;
    return {
      onChange: () => broadcast(room),
      sendPrivate: (pid, s) => { const sid = to(pid); if (sid) io.to(sid).emit('private_state', s); },
      sendMessage: (m, recipients) => {
        const msg = { id: ++msgId, ...m };
        if (!recipients) io.to(room.code).emit('chat_message', msg);
        else for (const pid of recipients) { const sid = to(pid); if (sid) io.to(sid).emit('chat_message', msg); }
      },
      resetCanvas: () => { drawing.reset(room.code); io.to(room.code).emit('canvas_state', { strokes: [] }); },
      snapshotCanvas: () => drawing.get(room.code),
    };
  };
  const cleanupIfEmpty = (code: string) => {
    if (rooms.get(code)) return;
    drawing.remove(code); games.get(code)?.destroy(); games.delete(code); galleries.delete(code);
  };

  io.on('connection', (socket: Socket) => {
    let current: { code: string; playerId: string } | null = null;
    const attach = (room: Room, token: string) => {
      const player = rooms.playerByToken(room, token)!;
      const reconnecting = player.socketId === null && room.players.some(p => p.id !== player.id && p.socketId !== null); // someone else is online: this is a comeback, not a brand-new room
      const playerId = player.id; player.socketId = socket.id;
      current = { code: room.code, playerId };
      socket.emit('you', { id: playerId }); // each client learns only its own public id
      socket.join(room.code);
      const wasOffline = room.phase === 'playing' && reconnecting;
      games.get(room.code)?.onReconnect(playerId);
      broadcast(room);
      if (wasOffline) system(room, `${player.name} is back!`);
      if (room.phase === 'playing') socket.emit('canvas_state', { strokes: drawing.get(room.code) });
    };
    const ctx = () => {
      const room = current && rooms.get(current.code);
      if (!room || !current) throw new GameError('You are not in a room.');
      const me = room.players.find(p => p.id === current!.playerId);
      if (!me) throw new GameError('You are no longer in this room.');
      if (me.socketId !== socket.id) throw new GameError('This session was opened in another tab.');
      return { room, playerId: current.playerId };
    };
    const validId = (id: unknown) => {
      if (typeof id !== 'string' || id.length < 8 || id.length > 64) throw new GameError('Invalid session.');
      return id;
    };
    // Drawing events: only the current drawer, only while the turn is in its drawing phase.
    const drawerCtx = () => {
      const c = ctx();
      if (c.room.game?.turnPhase !== 'drawing' || c.room.drawerId !== c.playerId) throw new GameError('Only the drawer can draw.');
      return c;
    };
    // Token-bucket rate limits (per socket).
    const bucket = (cap: number, perMs: number) => { let t = cap, last = Date.now(); return () => { const n = Date.now(); t = Math.min(cap, t + (n - last) / perMs); last = n; return t-- >= 1; }; };
    const allowDraw = bucket(200, 5), allowChat = bucket(5, 800), allowJoin = bucket(10, 1000), allowCreate = bucket(3, 20000), allowList = bucket(10, 1000), allowMod = bucket(10, 1000), allowReact = bucket(4, 1000);
    const allowAction = bucket(20, 250);   // lobby/game control events: set_ready, update_settings, start_game, choose_word, play_again
    const allowCanvasOp = bucket(8, 400);
    const allowFill = bucket(6, 300);       // every fill makes all clients flood-fill their canvas, so fills are limited separately too  // undo / clear each re-broadcast the WHOLE canvas, so they are limited separately from point streaming

    /** Runs a drawing event for the drawer. If the server rejects it, the drawer's canvas is re-synced so it never silently diverges. */
    let lastResync = 0;
    const drawEvent = (fn: (room: Room) => void, limiter: (() => boolean) | null = allowDraw) => {
      let room: Room;
      try { room = drawerCtx().room; } catch (e) { if (!(e instanceof GameError)) console.error(e); return; } // not the drawer: ignore
      try { if (limiter && !limiter()) throw new GameError('You are drawing too fast.'); fn(room); }
      catch (e) {
        if (!(e instanceof GameError)) { console.error(e); return; }
        const now = Date.now();
        if (now - lastResync > 500) { lastResync = now; socket.emit('canvas_state', { strokes: drawing.get(room.code) }); socket.emit('chat_message', { id: ++msgId, kind: 'system', text: e.message }); }
      }
    };

    socket.on('create_room', (d: any, ack?: Ack) => handle(() => {
      const token = validId(d?.token);
      if (!allowCreate()) throw new GameError('Too many rooms created. Please wait a moment.');
      const room = rooms.createRoom(token, d?.playerName, { ...(d?.settings ?? {}), customWords: d?.customWords }, d?.avatar); attach(room, token); return room;
    }, ack));
    socket.on('join_room', (d: any, ack?: Ack) => handle(() => {
      const token = validId(d?.token);
      if (!allowJoin()) throw new GameError('Too many attempts. Please wait a moment.'); // slows room-code guessing
      const room = rooms.joinRoom(String(d?.roomCode ?? ''), token, d?.playerName, d?.avatar); attach(room, token); return room;
    }, ack));
    socket.on('list_public_rooms', (_d: any, ack?: Ack) => {
      if (!allowList()) return ack?.({ ok: false, error: 'Too many requests. Please wait a moment.' });
      ack?.({ ok: true, rooms: rooms.listPublic() });
    });
    socket.on('set_ready', (d: any, ack?: Ack) => handle(() => { const { room, playerId } = ctx(); if (!allowAction()) throw new GameError('Too many actions. Please wait a moment.'); rooms.setReady(room, playerId, !!d?.ready); broadcast(room); }, ack));
    socket.on('update_settings', (d: any, ack?: Ack) => handle(() => { const { room, playerId } = ctx(); if (!allowAction()) throw new GameError('Too many actions. Please wait a moment.'); rooms.updateSettings(room, playerId, d ?? {}); broadcast(room); }, ack));
    const moderate = (ban: boolean) => (d: any, ack?: Ack) => handle(() => {
      const { room, playerId } = ctx();
      if (!allowMod()) throw new GameError('Too many actions. Please wait a moment.');
      const target = rooms.moderate(room, playerId, String(d?.playerId ?? ''), ban);
      games.get(room.code)?.onLeft(target.id); // the target is already out of room.players: the game adjusts (e.g. drawer removed -> turn ends)
      if (target.socketId) { io.sockets.sockets.get(target.socketId)?.leave(room.code); io.to(target.socketId).emit('kicked', { banned: ban }); }
      system(room, `${target.name} was ${ban ? 'banned' : 'kicked'} by the host.`);
      broadcast(room);
    }, ack);
    socket.on('kick_player', moderate(false)); socket.on('ban_player', moderate(true));
    socket.on('start_game', (_d: any, ack?: Ack) => handle(() => {
      const { room, playerId } = ctx(); if (!allowAction()) throw new GameError('Too many actions. Please wait a moment.'); rooms.canStart(room, playerId);
      galleries.delete(room.code); const game = new Game(room, makeDeps(room)); games.set(room.code, game);
      drawing.reset(room.code); game.start();
    }, ack));
    socket.on('choose_word', (d: any, ack?: Ack) => handle(() => {
      const { room, playerId } = ctx();
      if (!allowAction()) throw new GameError('Too many actions. Please wait a moment.');
      const game = games.get(room.code); if (!game) throw new GameError('No game in progress.');
      game.chooseWord(playerId, d?.word);
    }, ack));
    const onChat = (d: any, ack?: Ack) => handle(() => {
      const { room, playerId } = ctx();
      if (room.phase === 'lobby') { // waiting room: plain chat for everyone in the room (there is no secret word to protect yet)
        if (!allowChat()) throw new GameError('You are sending messages too fast.');
        const me = room.players.find(p => p.id === playerId);
        const text = typeof d?.text === 'string' ? d.text.replace(/\p{C}/gu, '').trim().slice(0, 100) : '';
        if (me && text) io.to(room.code).emit('chat_message', { id: ++msgId, kind: 'chat', playerId: me.id, playerName: me.name, text });
        return;
      }
      const game = games.get(room.code); if (!game || room.phase !== 'playing') throw new GameError('Chat is available during the game.');
      if (!allowChat()) throw new GameError('You are sending messages too fast.');
      game.handleMessage(playerId, d?.text);
    }, ack);
    socket.on('chat', onChat); socket.on('guess', onChat); // one input; the server decides guess vs chat
    socket.on('react', (d: any, ack?: Ack) => handle(() => {
      const { room, playerId } = ctx();
      const game = games.get(room.code); if (!game || room.phase !== 'playing') throw new GameError('No game in progress.');
      if (!allowReact()) throw new GameError('Slow down a little.');
      game.react(playerId, d?.kind);
    }, ack));
    // Doodle Museum: drawings WITH their words. Refused while a game is running so no secret word can leak mid-game.
    socket.on('get_gallery', (_d: any, ack?: Ack) => {
      try {
        const { room } = ctx();
        if (room.phase === 'playing') throw new GameError('The museum opens when the game is over.');
        if (!allowAction()) throw new GameError('Too many actions. Please wait a moment.');
        ack?.({ ok: true, gallery: games.get(room.code)?.getGallery() ?? galleries.get(room.code) ?? [] } as any);
      } catch (e) { ack?.({ ok: false, error: e instanceof GameError ? e.message : 'Something went wrong.' }); }
    });
    socket.on('play_again', (d: any, ack?: Ack) => handle(() => {
      const { room, playerId } = ctx(); if (!allowAction()) throw new GameError('Too many actions. Please wait a moment.'); rooms.resetToLobby(room, playerId);
      const finished = games.get(room.code); if (finished) galleries.set(room.code, finished.getGallery()); // keep the museum after returning to the lobby
      finished?.destroy(); games.delete(room.code); drawing.reset(room.code);
      io.to(room.code).emit('canvas_state', { strokes: [] });
      if (d?.restart === true) { // "Play again": straight into a new game with the same settings (everyone who is online counts as ready)
        room.players.forEach(p => { if (p.socketId !== null) p.ready = true; });
        try { rooms.canStart(room, playerId); } catch (e) { broadcast(room); throw e; } // e.g. only one player left: stay in the lobby and say why
        galleries.delete(room.code); const next = new Game(room, makeDeps(room)); games.set(room.code, next); drawing.reset(room.code); next.start();
        return;
      }
      broadcast(room);
    }, ack));

    socket.on('draw_start', (d: any) => drawEvent(room => { /* relay the SANITIZED stroke, never the raw payload */ const st = drawing.start(room.code, d); const pt = st.points[0]; socket.to(room.code).emit('draw_start', { color: st.color, size: st.size, x: pt.x, y: pt.y }); }));
    socket.on('draw_move', (d: any) => drawEvent(room => { const pts = drawing.move(room.code, d); if (pts.length) socket.to(room.code).emit('draw_move', { points: pts }); }));
    socket.on('draw_end', () => drawEvent(room => { socket.to(room.code).emit('draw_end'); }, null));
    socket.on('draw_fill', (d: any) => drawEvent(room => { /* relay the SANITIZED fill */ const st = drawing.fill(room.code, d); const pt = st.points[0]; socket.to(room.code).emit('draw_fill', { color: st.color, x: pt.x, y: pt.y }); }, allowFill));
    socket.on('draw_undo', () => drawEvent(room => { io.to(room.code).emit('canvas_state', { strokes: drawing.undo(room.code) }); }, allowCanvasOp));
    socket.on('canvas_clear', () => drawEvent(room => { io.to(room.code).emit('canvas_state', { strokes: drawing.clear(room.code) }); }, allowCanvasOp));

    // Clock sync for the countdown: the client measures the round trip and works out how far its clock is from the server's.
    const allowSync = bucket(10, 1000);
    socket.on('time_sync', (_d: unknown, ack?: (r: { ok: boolean; now?: number }) => void) => { if (typeof ack === 'function') ack(allowSync() ? { ok: true, now: Date.now() } : { ok: false }); });

    socket.on('leave_room', (_d: any, ack?: Ack) => handle(() => {
      const { room, playerId } = ctx(); const leaver = room.players.find(p => p.id === playerId); const wasHost = room.hostId === playerId;
      socket.leave(room.code); rooms.removePlayer(room, playerId); current = null;
      if (rooms.get(room.code)) {
        games.get(room.code)?.onLeft(playerId); if (leaver) system(room, `${leaver.name} left the room.`);
        if (wasHost) { const h = room.players.find(p => p.id === room.hostId); if (h) system(room, `${h.name} is now the host.`); }
        broadcast(room);
      } else cleanupIfEmpty(room.code);
    }, ack));
    socket.on('disconnect', () => {
      if (!current) return;
      const { code, playerId } = current;
      const room = rooms.get(code); const p = room?.players.find(x => x.id === playerId);
      if (!room || !p || p.socketId !== socket.id) return;
      p.socketId = null;
      games.get(code)?.onDisconnect(playerId);
      if (room.phase === 'playing') system(room, `${p.name} lost connection.`);
      broadcast(room);
      // After a grace period (so a page refresh can reconnect): lobby players are dropped, a missing host is replaced.
      setTimeout(() => {
        const r = rooms.get(code); const pp = r?.players.find(x => x.id === playerId);
        if (!r || !pp || pp.socketId !== null) return;
        if (r.phase === 'lobby') { rooms.removePlayer(r, playerId); if (rooms.get(code)) broadcast(r); else cleanupIfEmpty(code); }
        else if (r.hostId === playerId) { rooms.migrateHost(r); const h = r.players.find(x => x.id === r.hostId); if (h && h.id !== playerId) system(r, `${h.name} is now the host.`); broadcast(r); }
      }, 15000).unref();
    });
  });

  // Remove abandoned rooms (everyone offline for the TTL) so memory does not grow forever.
  const sweeper = setInterval(() => { for (const code of rooms.sweep(Date.now(), opts.idleRoomTtlMs ?? 5 * 60_000)) cleanupIfEmpty(code); }, opts.sweepIntervalMs ?? 30_000);
  sweeper.unref();

  return {
    httpServer: server, io, rooms,
    close: () => new Promise<void>(resolve => { clearInterval(sweeper); for (const g of games.values()) g.destroy(); io.close(() => resolve()); }),
  };
}
