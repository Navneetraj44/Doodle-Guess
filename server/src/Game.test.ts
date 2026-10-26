import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { RoomManager, GameError } from './RoomManager.js';
import { Game, GameDeps, TURN_END_MS, normalizeGuess, maskWord } from './Game.js';
import { Room } from './types.js';

function setup(opts: { rounds?: number; drawTime?: number; n?: number } = {}) {
  const m = new RoomManager(); const room = m.createRoom('p0-aaaaaaaa', 'A', { rounds: opts.rounds ?? 2, drawTime: opts.drawTime ?? 60 });
  for (let i = 1; i < (opts.n ?? 3); i++) m.joinRoom(room.code, `p${i}-aaaaaaaa`, 'BCDEF'[i - 1]);
  room.players.forEach((p, i) => (p.socketId = `s${i}`));
  const priv: { id: string; s: any }[] = []; const msgs: any[] = [];
  const deps: GameDeps = { onChange() {}, sendPrivate: (id, s) => priv.push({ id, s }), sendMessage: (m) => msgs.push(m), resetCanvas() {}, pickWords: () => ['apple', 'banana', 'cherry'], random: () => 0 };
  const game = new Game(room, deps); game.start();
  return { m, room, game, priv, msgs };
}
const ids = (r: Room) => r.players.map(p => p.id);

describe('Game', () => {
  beforeEach(() => vi.useFakeTimers()); afterEach(() => vi.useRealTimers());

  it('normalizes guesses and masks words', () => {
    expect(normalizeGuess('  Ice   CREAM ')).toBe('ice cream');
    expect(maskWord('ice cream', new Set([0]))).toBe('i _ _   _ _ _ _ _');
  });

  it('gives word options only to the drawer and keeps the secret out of public state', () => {
    const { room, priv, game } = setup();
    expect(room.game!.turnPhase).toBe('choosing');
    expect(priv.filter(p => p.s.wordOptions).map(p => p.id)).toEqual([room.drawerId]);
    game.chooseWord(room.drawerId!, 'banana');
    expect(JSON.stringify(room)).not.toContain('banana');
    expect(room.game!.hint).toBe('_ _ _ _ _ _');
  });

  it('only the drawer can choose, and only from offered words', () => {
    const { room, game } = setup();
    expect(() => game.chooseWord(ids(room)[1], 'apple')).toThrow(GameError);
    expect(() => game.chooseWord(room.drawerId!, 'hacker-word')).toThrow(GameError);
  });

  it('awards a correct guess exactly once; first guesser earns more than the second', () => {
    const { room, game } = setup(); const [d, a, b] = ids(room);
    game.chooseWord(d, 'apple');
    game.handleMessage(a, '  APPLE '); const first = room.players[1].score;
    game.handleMessage(a, 'apple'); game.handleMessage(a, 'apple');
    expect(room.players[1].score).toBe(first);
    game.handleMessage(b, 'apple');
    expect(room.players[2].score).toBeLessThan(first);
    expect(room.players[0].score).toBe(60); // drawer: 30 per correct guesser
  });

  it('ends the turn when all guessers are correct, then rotates the drawer', () => {
    const { room, game } = setup(); const [d, a, b] = ids(room);
    game.chooseWord(d, 'apple'); game.handleMessage(a, 'apple'); game.handleMessage(b, 'apple');
    expect(room.game!.turnPhase).toBe('turn_end'); expect(room.game!.revealedWord).toBe('apple');
    vi.advanceTimersByTime(TURN_END_MS); expect(room.drawerId).toBe(a);
  });

  it('ends the round when time expires and auto-picks a word if the drawer is idle', () => {
    const { room, game } = setup({ drawTime: 30 });
    vi.advanceTimersByTime(15_000); expect(room.game!.turnPhase).toBe('drawing'); // auto-picked
    vi.advanceTimersByTime(30_000); expect(room.game!.turnPhase).toBe('turn_end');
    void game;
  });

  it('chat from the drawer and from players who already guessed is not shown to others', () => {
    const { room, game, msgs } = setup(); const [d, a] = ids(room);
    game.chooseWord(d, 'apple'); game.handleMessage(a, 'apple'); msgs.length = 0;
    game.handleMessage(d, 'it is red');
    expect(msgs[0].restricted).toBe(true);
  });

  it('plays all turns in order and ends with the right leaderboard', () => {
    const { room, game } = setup({ rounds: 2 }); const order: string[] = [];
    while (room.game!.turnPhase !== 'game_over') {
      const d = room.drawerId!; order.push(d); game.chooseWord(d, 'apple');
      ids(room).filter(i => i !== d).forEach(i => game.handleMessage(i, 'apple'));
      vi.advanceTimersByTime(TURN_END_MS);
    }
    expect(order).toEqual([...ids(room), ...ids(room)]);
    const lb = room.game!.leaderboard!; expect(lb[0].score).toBeGreaterThanOrEqual(lb[1].score);
    expect(room.phase).toBe('ended'); expect(room.game!.winners.length).toBeGreaterThan(0);
  });

  it('ends the turn when the drawer leaves and ignores invalid transitions', () => {
    const { room, game } = setup(); const d = room.drawerId!;
    game.chooseWord(d, 'apple'); room.players = room.players.filter(p => p.id !== d); game.onLeft(d);
    expect(room.game!.turnPhase).toBe('turn_end');
    expect(() => game.chooseWord(d, 'apple')).toThrow(GameError);
  });
});

/** The in-game Leave button ends in the server's `leave_room` handler: removePlayer() then game.onLeft(). Same two calls here. */
describe('leaving during an active game (Leave button)', () => {
  beforeEach(() => vi.useFakeTimers()); afterEach(() => vi.useRealTimers());
  type S = ReturnType<typeof setup>;
  const leave = ({ m, room, game }: S, id: string) => { m.removePlayer(room, id); game.onLeft(id); };

  it('host leaves while drawing: host passes to a remaining player, the turn ends, and the game goes on without them', () => {
    const s = setup({ n: 3 }); const { room, game, m } = s; const oldHost = room.hostId;
    expect(room.drawerId).toBe(oldHost); game.chooseWord(oldHost, 'apple');
    leave(s, oldHost);
    expect(room.players.map(p => p.id)).not.toContain(oldHost);
    expect(room.hostId).not.toBe(oldHost); expect(room.players.some(p => p.id === room.hostId)).toBe(true);
    expect(room.game!.turnPhase).toBe('turn_end');
    vi.advanceTimersByTime(TURN_END_MS);
    expect(room.game!.turnPhase).toBe('choosing');
    expect(room.drawerId).not.toBe(oldHost); expect(room.players.some(p => p.id === room.drawerId)).toBe(true);
    expect(() => m.updateSettings(room, oldHost, { rounds: 5 })).toThrow('Only the host');
    game.destroy();
  });

  it('a guesser leaves: host is unchanged and the turn ends once every remaining guesser has it right', () => {
    const s = setup({ n: 3 }); const { room, game } = s; const d = room.drawerId!;
    game.chooseWord(d, 'apple');
    const [g1, g2] = room.players.filter(p => p.id !== d).map(p => p.id);
    game.handleMessage(g1, 'apple'); expect(room.game!.turnPhase).toBe('drawing');
    leave(s, g2);
    expect(room.hostId).toBe(room.players[0].id); expect(room.game!.turnPhase).toBe('turn_end');
    game.destroy();
  });

  it('leaving down to a single player ends the game cleanly and keeps a valid host', () => {
    const s = setup({ n: 2 }); const { room, game } = s; const [a, b] = ids(room);
    game.chooseWord(room.drawerId!, 'apple');
    leave(s, a);
    vi.advanceTimersByTime(TURN_END_MS);
    expect(room.phase).toBe('ended'); expect(room.game!.turnPhase).toBe('game_over');
    expect(room.hostId).toBe(b); expect(ids(room)).toEqual([b]);
    game.destroy();
  });

  it('the last player leaving deletes the room', () => {
    const s = setup({ n: 2 }); const { m, room, game } = s; const code = room.code;
    leave(s, ids(room)[0]); leave(s, ids(room)[0]);
    expect(m.get(code)).toBeUndefined();
    game.destroy();
  });

  describe('"Your guess is close!" feedback', () => {
    const drawing = () => { const c = setup({ n: 3 }); c.game.chooseWord(c.room.drawerId!, 'banana'); c.msgs.length = 0; return c; };
    const guesser = (r: Room) => ids(r).filter(i => i !== r.drawerId)[0];
    // Game.test's sendMessage ignores recipients, so capture them here.
    function capture() {
      const m = new RoomManager(); const room = m.createRoom('p0-aaaaaaaa', 'A', { rounds: 2, drawTime: 60 });
      m.joinRoom(room.code, 'p1-aaaaaaaa', 'B'); m.joinRoom(room.code, 'p2-aaaaaaaa', 'C'); room.players.forEach((p, i) => (p.socketId = `s${i}`));
      const out: { kind: string; text: string; to: string[] | null }[] = [];
      const game = new Game(room, { onChange() {}, sendPrivate() {}, sendMessage: (msg, to) => out.push({ kind: msg.kind, text: msg.text, to }), resetCanvas() {}, pickWords: () => ['apple', 'banana', 'cherry'], random: () => 0 });
      game.start(); game.chooseWord(room.drawerId!, 'banana'); out.length = 0;
      return { room, game, out, g: ids(room).filter(i => i !== room.drawerId) };
    }
    it('a near miss is shown as chat to everyone and gets a PRIVATE close notice for that guesser only', () => {
      const { game, out, g } = capture(); game.handleMessage(g[0], 'bananna');
      expect(out).toEqual([{ kind: 'chat', text: 'bananna', to: null }, { kind: 'close', text: 'Your guess is close!', to: [g[0]] }]);
    });
    it('a wrong guess that is far away gets no close notice, and neither does the exact answer', () => {
      const { game, out, g } = capture(); game.handleMessage(g[0], 'zebra'); game.handleMessage(g[1], 'banana');
      expect(out.some(m => m.kind === 'close')).toBe(false); expect(out.some(m => m.kind === 'correct')).toBe(true);
    });
    it('players who already guessed (or the drawer) never receive close notices, and chat is not a guess outside the drawing phase', () => {
      const { room, game, out, g } = capture(); game.handleMessage(g[0], 'banana'); out.length = 0;
      game.handleMessage(g[0], 'bananaa'); game.handleMessage(room.drawerId!, 'bananaa');
      expect(out.every(m => m.kind === 'chat' && m.to !== null)).toBe(true);
    });
  });
});
