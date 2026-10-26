import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { RoomManager, GameError } from './RoomManager.js';
import { Game, GameDeps } from './Game.js';

function setup(n = 3, msgs: any[] = []) {
  const m = new RoomManager(); const room = m.createRoom('p0-aaaaaaaa', 'A', { rounds: 2, drawTime: 60 });
  for (let i = 1; i < n; i++) m.joinRoom(room.code, `p${i}-aaaaaaaa`, 'BCDEF'[i - 1]);
  room.players.forEach((p, i) => (p.socketId = `s${i}`));
  const deps: GameDeps = { onChange() {}, sendPrivate() {}, sendMessage: (m, to) => msgs.push({ ...m, to }), resetCanvas() {}, pickWords: () => ['apple', 'banana', 'cherry'], random: () => 0 };
  const game = new Game(room, deps); game.start();
  const drawer = room.drawerId!; const guessers = room.players.map(p => p.id).filter(id => id !== drawer);
  return { room, game, drawer, guessers };
}

describe('reactions (👍 / 👎)', () => {
  beforeEach(() => vi.useFakeTimers()); afterEach(() => vi.useRealTimers());

  it('rejects reactions before the drawing starts', () => {
    const { game, guessers } = setup();
    expect(() => game.react(guessers[0], 'like')).toThrow(GameError);
  });

  it('counts one vote per player per turn and rejects repeats (no spam)', () => {
    const { room, game, drawer, guessers } = setup();
    game.chooseWord(drawer, 'banana');
    game.react(guessers[0], 'like');
    expect(() => game.react(guessers[0], 'dislike')).toThrow(GameError);
    expect(() => game.react(guessers[0], 'like')).toThrow(GameError);
    game.react(guessers[1], 'dislike');
    expect(room.game).toMatchObject({ likes: 1, dislikes: 1 });
    expect(room.game!.voted.sort()).toEqual([...guessers].sort());
  });

  it('the drawer cannot rate their own drawing and invalid kinds are rejected', () => {
    const { game, drawer, guessers } = setup();
    game.chooseWord(drawer, 'banana');
    expect(() => game.react(drawer, 'like')).toThrow(GameError);
    expect(() => game.react(guessers[0], 'love')).toThrow(GameError);
    expect(() => game.react('not-a-player', 'like')).toThrow(GameError);
  });

  it('public state never reveals who voted what, and votes reset on the next turn', () => {
    const { room, game, drawer, guessers } = setup();
    game.chooseWord(drawer, 'banana');
    game.react(guessers[0], 'like');
    expect(JSON.stringify(room.game)).not.toContain('"like"');
    vi.advanceTimersByTime(60_000 + 5_000 + 100); // turn ends, then the next turn starts
    expect(room.game).toMatchObject({ likes: 0, dislikes: 0, voted: [] });
    expect(room.drawerId).not.toBe(drawer);
  });

  it('announces every vote in the chat: "X liked / disliked the drawing!" to the whole room', () => {
    const msgs: any[] = []; const { room, game, drawer, guessers } = setup(3, msgs);
    game.chooseWord(drawer, 'banana'); msgs.length = 0;
    game.react(guessers[0], 'like'); game.react(guessers[1], 'dislike');
    const name = (id: string) => room.players.find(p => p.id === id)!.name;
    expect(msgs.map(m => [m.kind, m.text, m.to])).toEqual([
      ['like', `${name(guessers[0])} liked the drawing!`, null],
      ['dislike', `${name(guessers[1])} disliked the drawing!`, null],
    ]);
  });
  it('rejected votes (repeat, drawer, invalid) produce no chat notice', () => {
    const msgs: any[] = []; const { game, drawer, guessers } = setup(3, msgs);
    game.chooseWord(drawer, 'banana'); game.react(guessers[0], 'like'); msgs.length = 0;
    for (const [who, kind] of [[guessers[0], 'dislike'], [drawer, 'like'], [guessers[1], 'love']] as const) { try { game.react(who, kind); } catch { /* expected */ } }
    expect(msgs).toEqual([]);
  });
});
