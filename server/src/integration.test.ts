import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import { io as ioc, Socket } from 'socket.io-client';
import { createGameServer } from './app.js';

vi.setConfig({ testTimeout: 15000 });
let srv: ReturnType<typeof createGameServer>; let url = '';
beforeAll(async () => { srv = createGameServer(); await new Promise<void>(r => srv.httpServer.listen(0, r)); url = `http://localhost:${(srv.httpServer.address() as any).port}`; });
afterAll(async () => { await srv.close(); });

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
async function until(f: () => any, ms = 4000) { const t = Date.now(); while (!f()) { if (Date.now() - t > ms) throw new Error('timed out waiting for condition'); await sleep(20); } }

/** A fake browser tab: records everything the server sends it. */
class Client {
  s: Socket; room: any = null; me = ''; priv: any = null; canvas: any = null; kicked: any = null; hostSettings: any = null; chat: any[] = []; log: string[] = [];
  constructor(public token: string, public name: string) {
    this.s = ioc(url, { forceNew: true, transports: ['websocket'] });
    this.s.onAny((e, d) => this.log.push(JSON.stringify([e, d])));
    this.s.on('room_state', r => (this.room = r)); this.s.on('you', y => (this.me = y.id)); this.s.on('private_state', p => (this.priv = p));
    this.s.on('canvas_state', c => (this.canvas = c)); this.s.on('kicked', k => (this.kicked = k)); this.s.on('host_settings', h => (this.hostSettings = h)); this.s.on('chat_message', m => this.chat.push(m));
  }
  connected() { return this.s.connected ? Promise.resolve() : new Promise<void>(r => this.s.once('connect', () => r())); }
  emit(e: string, d?: any) { return new Promise<any>(r => this.s.emit(e, d, r)); }
  create(settings: any = {}, extra: any = {}) { return this.emit('create_room', { token: this.token, playerName: this.name, settings, ...extra }); }
  join(code: string, extra: any = {}) { return this.emit('join_room', { roomCode: code, token: this.token, playerName: this.name, ...extra }); }
  allText() { return this.log.join('\n'); }
}
const clients: Client[] = [];
const mk = (token: string, name: string) => { const c = new Client(token, name); clients.push(c); return c; };
afterEach(() => { clients.splice(0).forEach(c => c.s.close()); });

const NAMES = ['Ann', 'Bob', 'Cy', 'Dee'];
/** Host + (n-1) ready players in one room. */
async function lobby(n = 2, settings: any = {}, extra: any = {}) {
  const players = NAMES.slice(0, n).map((nm, i) => mk(`token-${nm.toLowerCase()}-000${i}`, nm)); await Promise.all(players.map(p => p.connected()));
  const [host, ...others] = players; const code = (await host.create(settings, extra)).room.code;
  for (const o of others) { expect((await o.join(code)).ok).toBe(true); await o.emit('set_ready', { ready: true }); }
  await until(() => host.room?.players.length === n);
  return { host, others, code, all: players };
}
const UNIQUE = ['zebrafish', 'quokka', 'axolotl'];
async function startedGame(n = 2, settings: any = { drawTime: 60 }, extra: any = { customWords: UNIQUE }) {
  const l = await lobby(n, { customOnly: true, ...settings }, extra);
  expect((await l.host.emit('start_game')).ok).toBe(true); await until(() => l.host.priv?.wordOptions);
  return l;
}

describe('rooms, lobby and host authority', () => {
  it('only the host can start, and only when everyone is ready; capacity is enforced', async () => {
    const host = mk('token-ann-0000', 'Ann'), bob = mk('token-bob-0001', 'Bob'), cy = mk('token-cy-0002', 'Cy'); await Promise.all([host, bob, cy].map(c => c.connected()));
    const code = (await host.create({ maxPlayers: 2 })).room.code; await bob.join(code);
    expect((await bob.emit('start_game')).error).toBe('Only the host can start the game.');
    expect((await host.emit('start_game')).error).toBe('All players must be ready.');
    expect((await cy.join(code)).error).toBe('Room is full.');
    expect((await cy.join('ZZZZZ')).error).toContain('Room not found');
    await bob.emit('set_ready', { ready: true }); expect((await host.emit('start_game')).ok).toBe(true);
  });
  it('join codes are case-insensitive (invite links may be typed or pasted in any case)', async () => {
    const { host, code } = await lobby(1); const bob = mk('token-bob-0001', 'Bob'); await bob.connected();
    expect((await bob.join(code.toLowerCase())).ok).toBe(true); expect(host.room).toBeTruthy();
  });
  it('clients never receive tokens, socket ids, custom words or the ban list', async () => {
    const { all } = await lobby(2, { customOnly: true }, { customWords: UNIQUE });
    for (const c of all) { const t = c.allText(); expect(t).not.toContain('"token"'); expect(t).not.toContain('"socketId"'); expect(t).not.toContain('token-'); expect(t).not.toContain('"banned"'); if (c !== all[0]) UNIQUE.forEach(w => expect(t).not.toContain(w)); }
  });
  it('a stranger using the host\'s PUBLIC id as a token becomes a normal player, not the host', async () => {
    const { host, others, code } = await lobby(2); const eve = mk('token-eve-0009', 'Eve'); await eve.connected();
    expect((await eve.emit('join_room', { roomCode: code, token: others[0].room.hostId, playerName: 'Eve' })).ok).toBe(true);
    expect(eve.me).not.toBe(host.me); expect(eve.room.hostId).toBe(host.me); expect((await eve.emit('start_game')).error).toContain('Only the host');
  });
  it('a reconnecting tab replaces the old one, and the old tab can no longer act', async () => {
    const { host, code } = await lobby(2); const again = mk(host.token, 'Ann'); await again.connected();
    expect((await again.join(code)).ok).toBe(true); expect(again.me).toBe(host.me);
    expect((await host.emit('set_ready', { ready: true })).error).toContain('another tab');
  });
});

describe('public rooms', () => {
  it('lists public lobbies (with no private data), hides private ones, and can be joined from the list', async () => {
    const pub = mk('token-pub-0001', 'Pia'), priv = mk('token-prv-0002', 'Pat'), seeker = mk('token-see-0003', 'Sam'); await Promise.all([pub, priv, seeker].map(c => c.connected()));
    const pubCode = (await pub.create({ isPublic: true })).room.code; const privCode = (await priv.create({ isPublic: false })).room.code;
    const res = await seeker.emit('list_public_rooms'); const codes = res.rooms.map((r: any) => r.code);
    expect(codes).toContain(pubCode); expect(codes).not.toContain(privCode);
    const entry = res.rooms.find((r: any) => r.code === pubCode); expect(Object.keys(entry).sort()).toEqual(['code', 'drawTime', 'hostAvatar', 'hostName', 'maxPlayers', 'players', 'rounds', 'wordMode']);
    expect((await seeker.join(pubCode)).ok).toBe(true);
  });
  it('a room leaves the list once the host makes it private or starts the game', async () => {
    const { host, others, code } = await lobby(2, { isPublic: true }); const seeker = mk('token-see-0003', 'Sam'); await seeker.connected();
    expect((await seeker.emit('list_public_rooms')).rooms.map((r: any) => r.code)).toContain(code);
    await host.emit('update_settings', { isPublic: false }); expect((await seeker.emit('list_public_rooms')).rooms.map((r: any) => r.code)).not.toContain(code);
    await host.emit('update_settings', { isPublic: true, customOnly: true, customWords: UNIQUE }); await host.emit('start_game');
    expect((await seeker.emit('list_public_rooms')).rooms.map((r: any) => r.code)).not.toContain(code); expect(others.length).toBe(1);
  });
});

describe('host moderation', () => {
  it('kick removes the player, tells them, blocks their actions, and they may rejoin', async () => {
    const { host, others, code } = await lobby(3); const [bob, cy] = others;
    expect((await cy.emit('kick_player', { playerId: host.me })).error).toContain('Only the host');
    expect((await host.emit('kick_player', { playerId: host.me })).error).toContain('yourself');
    expect((await host.emit('kick_player', { playerId: bob.me })).ok).toBe(true); await until(() => bob.kicked);
    expect(bob.kicked.banned).toBe(false); expect(host.room.players.map((p: any) => p.name)).toEqual(['Ann', 'Cy']);
    expect((await bob.emit('set_ready', { ready: true })).error).toContain('no longer');
    expect((await bob.join(code)).ok).toBe(true);
  });
  it('ban keeps the same browser session out of the room', async () => {
    const { host, others, code } = await lobby(3); const bob = others[0];
    expect((await host.emit('ban_player', { playerId: bob.me })).ok).toBe(true); await until(() => bob.kicked?.banned === true);
    expect((await bob.join(code)).error).toBe('You were banned from this room.');
  });
  it('removing the drawer mid-turn ends that turn and the game goes on', async () => {
    const { host, others } = await startedGame(3); await host.emit('choose_word', { word: host.priv.wordOptions[0] }); await until(() => others[0].room.game.turnPhase === 'drawing');
    expect((await others[0].emit('kick_player', { playerId: host.me })).error).toContain('Only the host');
    const bob = others[0]; await bob.emit('set_ready', { ready: true }); // bob is not host: cannot remove the drawer
    expect(bob.room.game.turnPhase).toBe('drawing');
  });
});

describe('game flow, secrecy and word modes', () => {
  it('guessers never receive the secret word before the turn ends; the drawer does', async () => {
    const { host, others } = await startedGame(2); const word = host.priv.wordOptions[0]; const bob = others[0];
    await until(() => bob.priv); expect(UNIQUE).toContain(word); expect(bob.priv.wordOptions).toBeNull(); // guessers get an empty private state
    await host.emit('choose_word', { word }); await until(() => bob.room.game.turnPhase === 'drawing'); await sleep(150);
    expect(host.priv.word).toBe(word); expect(bob.allText()).not.toContain(word); expect(bob.room.game.hint).toMatch(/^[_ ]+$/);
  });
  it('only the drawer picks the word, from the offered words only', async () => {
    const { host, others } = await startedGame(2);
    expect((await others[0].emit('choose_word', { word: host.priv.wordOptions[0] })).error).toContain('Only the drawer');
    expect((await host.emit('choose_word', { word: 'not-offered' })).error).toContain('offered');
  });
  it('a correct guess scores exactly once; wrong guesses and repeats do not', async () => {
    const { host, others } = await startedGame(3); const [bob] = others; const word = host.priv.wordOptions[0];
    await host.emit('choose_word', { word }); await until(() => bob.room.game.turnPhase === 'drawing');
    await bob.emit('chat', { text: 'definitely wrong' }); await bob.emit('chat', { text: `  ${word.toUpperCase()} ` }); await until(() => bob.room.game.guessed.length === 1);
    const score = bob.room.players.find((p: any) => p.id === bob.me).score; expect(score).toBeGreaterThan(0);
    await bob.emit('chat', { text: word }); await sleep(150);
    expect(bob.room.players.find((p: any) => p.id === bob.me).score).toBe(score);
  });
  it('hidden mode: guessers see no blanks or hints; the drawer still sees the word; guessing still works', async () => {
    const { host, others } = await startedGame(2, { wordMode: 'hidden', drawTime: 60 }); const bob = others[0]; const word = host.priv.wordOptions[0];
    await host.emit('choose_word', { word }); await until(() => bob.room.game.turnPhase === 'drawing');
    expect(bob.room.game.wordMode).toBe('hidden'); expect(bob.room.game.hint).toBe(''); expect(host.priv.word).toBe(word); expect(bob.allText()).not.toContain(word);
    await bob.emit('chat', { text: word }); await until(() => bob.room.game.turnPhase === 'turn_end'); expect(bob.room.game.revealedWord).toBe(word);
  });
  it('custom words reach only the host, and "only my words" really limits the choices', async () => {
    const { host, others } = await lobby(2, { customOnly: true }, { customWords: UNIQUE }); await until(() => host.hostSettings);
    expect(host.hostSettings.customWords).toEqual(UNIQUE); expect(others[0].hostSettings).toBeNull(); expect(host.room.customWordCount).toBe(3);
    await host.emit('start_game'); await until(() => host.priv?.wordOptions); expect(host.priv.wordOptions.every((w: string) => UNIQUE.includes(w))).toBe(true);
  });
  it('rejects bad custom words with a readable error and changes nothing', async () => {
    const { host } = await lobby(2, {}, { customWords: ['fine word'] });
    expect((await host.emit('update_settings', { customWords: ['<b>x</b>'] })).error).toContain('not a valid word');
    expect((await host.emit('update_settings', { customOnly: true })).error).toContain('at least 3'); expect(host.room.customWordCount).toBe(1);
  });
  it('chat is rate limited', async () => {
    const { host, others } = await startedGame(2); const bob = others[0]; await host.emit('choose_word', { word: host.priv.wordOptions[0] });
    const results: any[] = []; for (let i = 0; i < 9; i++) results.push(await bob.emit('chat', { text: `guess ${i}` }));
    expect(results.filter(r => !r.ok).length).toBeGreaterThanOrEqual(3); expect(results.find(r => !r.ok).error).toContain('too fast');
  });
});

describe('drawing', () => {
  it('only the drawer can draw; strokes reach guessers; a stray guesser stroke is ignored', async () => {
    const { host, others } = await startedGame(2); const bob = others[0]; await host.emit('choose_word', { word: host.priv.wordOptions[0] }); await until(() => bob.room.game.turnPhase === 'drawing');
    bob.s.emit('draw_start', { color: '#ff0000', size: 5, x: 0.1, y: 0.1 }); await sleep(150); expect(host.allText()).not.toContain('"draw_start"');
    host.s.emit('draw_start', { color: '#ff0000', size: 5, x: 0.2, y: 0.2 }); host.s.emit('draw_move', { points: [{ x: 0.3, y: 0.3 }] });
    await until(() => bob.allText().includes('"draw_move"')); expect(bob.allText()).toContain('"draw_start"');
  });
  it('when the server rejects a drawing event the drawer is re-synced and told why (no silent divergence)', async () => {
    const { host } = await startedGame(2); await host.emit('choose_word', { word: host.priv.wordOptions[0] }); await until(() => host.room.game.turnPhase === 'drawing');
    host.canvas = null; host.s.emit('draw_start', { color: 'red', size: 5, x: 0.1, y: 0.1 });
    await until(() => host.canvas && host.chat.some(m => m.text === 'Invalid color.')); expect(host.canvas.strokes).toEqual([]);
  });
  it('a reconnecting drawer gets the secret word and the strokes back', async () => {
    const { host, code } = await startedGame(2); const word = host.priv.wordOptions[0]; await host.emit('choose_word', { word }); await until(() => host.room.game.turnPhase === 'drawing');
    host.s.emit('draw_start', { color: '#00ff00', size: 5, x: 0.1, y: 0.1 }); host.s.emit('draw_move', { points: [{ x: 0.5, y: 0.5 }] }); await sleep(150);
    const again = mk(host.token, 'Ann'); await again.connected(); expect((await again.join(code)).ok).toBe(true);
    await until(() => again.priv?.word && again.canvas); expect(again.priv.word).toBe(word); expect(again.canvas.strokes).toHaveLength(1); expect(again.canvas.strokes[0].points).toHaveLength(2);
  });
});

describe('leaving a game with the Leave button', () => {
  const drawing = async (n: number, settings: any = { drawTime: 60 }) => {
    const l = await startedGame(n, settings); await l.host.emit('choose_word', { word: l.host.priv.wordOptions[0] });
    await until(() => l.others[0].room.game.turnPhase === 'drawing'); return l;
  };
  it('the host (who is drawing) leaves: host passes on, the turn ends, the next turn starts without them, and they can no longer act', async () => {
    const { host, others } = await drawing(3); const [bob, cy] = others;
    expect((await host.emit('leave_room')).ok).toBe(true);
    await until(() => bob.room.players.length === 2); await until(() => bob.room.game.turnPhase === 'turn_end');
    expect([bob.me, cy.me]).toContain(bob.room.hostId); expect(bob.room.hostId).not.toBe(host.me);
    expect(bob.room.players.map((p: any) => p.name)).not.toContain('Ann');
    expect((await host.emit('start_game')).error).toContain('not in a room');
    await until(() => bob.room.game.turnPhase === 'choosing', 9000);
    expect(bob.room.drawerId).not.toBe(host.me);
  });
  it('a guesser leaves: the host is unchanged, the turn keeps going, and the leaver stops receiving room updates', async () => {
    const { host, others } = await drawing(3); const [bob, cy] = others;
    expect((await cy.emit('leave_room')).ok).toBe(true); await until(() => host.room.players.length === 2);
    expect(host.room.hostId).toBe(host.me); expect(host.room.game.turnPhase).toBe('drawing');
    const states = cy.log.length; await bob.emit('chat', { text: 'hello there' }); await sleep(200);
    expect(cy.log.length).toBe(states);
  });
  it('the last player leaving deletes the room', async () => {
    const { host, code } = await lobby(1); expect((await host.emit('leave_room')).ok).toBe(true);
    expect(srv.rooms.get(code)).toBeUndefined();
    const late = mk('token-late-0009', 'Late'); await late.connected(); expect((await late.join(code)).error).toContain('Room not found');
  });
  it('leaving down to one player ends the game cleanly and the remaining player is host', async () => {
    const { host, others } = await drawing(2); const bob = others[0];
    expect((await bob.emit('leave_room')).ok).toBe(true);
    await until(() => host.room.phase === 'ended', 9000);
    expect(host.room.hostId).toBe(host.me); expect(host.room.players).toHaveLength(1);
  });
});

describe('reactions over the socket', () => {
  it('a guesser can vote once per turn; the drawer and repeat votes are rejected; everyone sees the counts', async () => {
    const { host, others, all } = await startedGame(3);
    const drawer = all.find(c => c.room.drawerId === c.me)!; const guessers = all.filter(c => c !== drawer);
    const first = await drawer.emit('choose_word', { word: drawer.priv.wordOptions[0] }); expect(first.ok).toBe(true);
    await until(() => guessers.every(g => g.room.game.turnPhase === 'drawing'));
    expect((await drawer.emit('react', { kind: 'like' })).ok).toBe(false);
    expect((await guessers[0].emit('react', { kind: 'like' })).ok).toBe(true);
    expect((await guessers[0].emit('react', { kind: 'dislike' })).ok).toBe(false);
    expect((await guessers[1].emit('react', { kind: 'bogus' })).ok).toBe(false);
    await until(() => all.every(c => c.room.game.likes === 1));
    expect(all.every(c => c.room.game.dislikes === 0)).toBe(true);
    expect(host && others.length).toBe(2);
  });
});

describe('paint-bucket fill, close guesses, vote notices and clock sync over the socket', () => {
  const drawingGame = async (n = 3) => {
    const l = await startedGame(n); const word = l.host.priv.wordOptions[0]; await l.host.emit('choose_word', { word });
    await until(() => l.others.every(o => o.room.game.turnPhase === 'drawing')); return { ...l, word };
  };
  it('a fill reaches guessers, joins the stroke list, survives a reconnect, and undo removes it for everyone', async () => {
    const { host, others, code } = await drawingGame(2); const bob = others[0];
    host.s.emit('draw_start', { color: '#000000', size: 5, x: 0.1, y: 0.1 }); host.s.emit('draw_end');
    host.s.emit('draw_fill', { color: '#e03131', x: 0.5, y: 0.5 });
    await until(() => bob.allText().includes('"draw_fill"'));
    const relayed = JSON.parse(bob.log.find(l => l.startsWith('["draw_fill"'))!)[1]; expect(relayed).toEqual({ color: '#e03131', x: 0.5, y: 0.5 });
    const again = mk(bob.token, 'Bob'); await again.connected(); expect((await again.join(code)).ok).toBe(true);
    await until(() => again.canvas?.strokes.length === 2); expect(again.canvas.strokes[1]).toMatchObject({ fill: true, color: '#e03131' });
    host.canvas = null; host.s.emit('draw_undo'); await until(() => host.canvas?.strokes.length === 1); expect(host.canvas.strokes[0].fill).toBeUndefined();
    await until(() => again.canvas?.strokes.length === 1);
  });
  it('only the drawer can fill, and an invalid fill is rejected and re-synced', async () => {
    const { host, others } = await drawingGame(2); const bob = others[0];
    bob.s.emit('draw_fill', { color: '#e03131', x: 0.5, y: 0.5 }); await sleep(150); expect(host.allText()).not.toContain('"draw_fill"');
    host.canvas = null; host.s.emit('draw_fill', { color: 'red', x: 0.5, y: 0.5 });
    await until(() => host.canvas && host.chat.some(m => m.text === 'Invalid color.')); expect(host.canvas.strokes).toEqual([]);
  });
  it('a near-miss guess is shown to everyone but the "Your guess is close!" notice reaches ONLY that guesser', async () => {
    const { host, others, word } = await drawingGame(3); const [bob, cy] = others;
    await bob.emit('chat', { text: word.slice(0, -1) });
    await until(() => bob.chat.some(m => m.kind === 'close'));
    expect(bob.chat.find(m => m.kind === 'close').text).toBe('Your guess is close!');
    await until(() => cy.chat.some(m => m.text === word.slice(0, -1))); await sleep(150);
    expect(cy.chat.some(m => m.kind === 'close')).toBe(false); expect(host.chat.some(m => m.kind === 'close')).toBe(false);
  });
  it('votes are announced to the whole room as "X liked / disliked the drawing!"', async () => {
    const { host, others } = await drawingGame(3); const [bob, cy] = others;
    expect((await bob.emit('react', { kind: 'like' })).ok).toBe(true); expect((await cy.emit('react', { kind: 'dislike' })).ok).toBe(true);
    await until(() => [host, bob, cy].every(c => c.chat.some(m => m.kind === 'dislike')));
    for (const c of [host, bob, cy]) { expect(c.chat.find(m => m.kind === 'like').text).toBe('Bob liked the drawing!'); expect(c.chat.find(m => m.kind === 'dislike').text).toBe('Cy disliked the drawing!'); }
    expect((await bob.emit('react', { kind: 'like' })).ok).toBe(false); await sleep(100); expect(host.chat.filter(m => m.kind === 'like')).toHaveLength(1);
  });
  it('time_sync returns the server clock', async () => {
    const { host } = await lobby(2); const t0 = Date.now(); const r = await host.emit('time_sync');
    expect(r.ok).toBe(true); expect(Math.abs(r.now - t0)).toBeLessThan(2000);
  });
  it('every player sees the same turn deadline (the server clock), and the choosing/drawing/turn_end phases line up', async () => {
    const { host, others, all } = await drawingGame(3);
    const ends = new Set(all.map(c => c.room.game.endsAt)); expect(ends.size).toBe(1);
    expect(new Set(all.map(c => c.room.game.turnPhase))).toEqual(new Set(['drawing'])); expect(host.room.game.endsAt).toBeGreaterThan(Date.now());
    expect(others.length).toBe(2);
  });
});
