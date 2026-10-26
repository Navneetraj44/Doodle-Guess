import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { RoomManager, sanitizeSettings, GameError } from './RoomManager.js';
import { Game, GameDeps } from './Game.js';
import { WORDS, CATEGORIES } from './words.js';
import { toPublicRoom } from './view.js';
import { compactStrokes, MAX_GALLERY_POINTS } from './gallery.js';
import { Stroke } from './types.js';

const stroke = (n = 3): Stroke => ({ id: 1, color: '#000000', size: 4, points: Array.from({ length: n }, (_, i) => ({ x: i / n, y: 0.5 })) });

function setup(settings: any = {}, players = 3, canvas: () => Stroke[] = () => [stroke()]) {
  const m = new RoomManager(); const room = m.createRoom('p0-aaaaaaaa', 'Ann', { rounds: 2, drawTime: 60, ...settings });
  for (let i = 1; i < players; i++) m.joinRoom(room.code, `p${i}-aaaaaaaa`, ['Bob', 'Cy', 'Di'][i - 1]);
  room.players.forEach((p, i) => (p.socketId = `s${i}`));
  const offered: string[][] = []; const hintLog: string[] = [];
  const deps: GameDeps = { onChange() { if (room.game?.hint) hintLog.push(room.game.hint); }, sendPrivate: (_id, s) => { if (s.wordOptions) offered.push(s.wordOptions); }, sendMessage() {}, resetCanvas() {}, snapshotCanvas: canvas };
  const game = new Game(room, deps); game.start();
  return { m, room, game, offered, hintLog };
}
/** Plays one whole turn: the drawer picks `word`, everyone else guesses it. */
function playTurn(room: any, game: Game, word: string) {
  const d = room.drawerId!; game.chooseWord(d, word);
  room.players.filter((p: any) => p.id !== d).forEach((p: any) => game.handleMessage(p.id, word));
  vi.advanceTimersByTime(5100);
}

describe('settings: word count and hints', () => {
  it('defaults to 3 words and 2 hints and clamps to the assignment ranges (1-5 words, 0-5 hints)', () => {
    expect(sanitizeSettings({})).toMatchObject({ wordCount: 3, hints: 2 });
    expect(sanitizeSettings({ wordCount: 99, hints: 99 })).toMatchObject({ wordCount: 5, hints: 5 });
    expect(sanitizeSettings({ wordCount: 0, hints: -4 })).toMatchObject({ wordCount: 1, hints: 0 });
    expect(sanitizeSettings({ wordCount: 'x' as any, hints: null as any })).toMatchObject({ wordCount: 3, hints: 2 });
  });
  beforeEach(() => vi.useFakeTimers()); afterEach(() => vi.useRealTimers());
  it('offers exactly wordCount words to the drawer', () => {
    for (const n of [1, 2, 5]) { const { offered, game } = setup({ wordCount: n }); expect(offered[0]).toHaveLength(n); game.destroy(); }
  });
  it('reveals exactly `hints` letters over the turn (never the whole word) and none when hints = 0', () => {
    const run = (hints: number) => {
      const { room, game, hintLog } = setup({ hints, drawTime: 100, customOnly: true, customWords: ['sunflower', 'rainbow', 'elephant'] }, 3);
      game.chooseWord(room.drawerId!, (game as any).options[0]); // private field read only to pick a word in this test
      vi.advanceTimersByTime(99_000);
      const revealed = (room.game!.hint.match(/[a-z]/g) ?? []).length; game.destroy(); return { revealed, hintLog };
    };
    expect(run(0).revealed).toBe(0);
    expect(run(1).revealed).toBe(1);
    expect(run(3).revealed).toBe(3);
  });
});

describe('themed word packs', () => {
  it('has the new Movies, Tech and Indian culture packs with plenty of clean, unique words', () => {
    for (const id of ['movies', 'tech', 'indian']) { expect(CATEGORIES).toContain(id); expect(WORDS[id].length).toBeGreaterThanOrEqual(40); expect(new Set(WORDS[id]).size).toBe(WORDS[id].length); }
  });
  beforeEach(() => vi.useFakeTimers()); afterEach(() => vi.useRealTimers());
  it('a selected pack actually decides the words the server offers', () => {
    for (const id of ['tech', 'indian', 'movies']) { const { offered, game } = setup({ categories: [id] }); expect(offered[0].every(w => WORDS[id].includes(w))).toBe(true); game.destroy(); }
  });
});

describe('Doodle Museum', () => {
  beforeEach(() => vi.useFakeTimers()); afterEach(() => vi.useRealTimers());
  it('stores one drawing per finished turn with the right artist, round and word', () => {
    const { room, game, offered } = setup({ rounds: 2 }, 3);
    const artists: string[] = [];
    for (let turn = 0; turn < 6; turn++) { artists.push(room.drawerId!); playTurn(room, game, offered.at(-1)![0]); }
    expect(room.phase).toBe('ended');
    const g = game.getGallery();
    expect(g).toHaveLength(6); expect(room.museumCount).toBe(6);
    g.forEach((e, i) => { expect(e.artistId).toBe(artists[i]); expect(e.round).toBe(i < 3 ? 1 : 2); expect(e.word).toBe(offered[i][0]); expect(e.strokes.length).toBe(1); });
    expect(new Set(g.slice(0, 3).map(e => e.artistId)).size).toBe(3); // everyone drew once per round
  });
  it('skips blank canvases', () => {
    const { room, game, offered } = setup({ rounds: 2 }, 2, () => []);
    for (let i = 0; i < 4; i++) playTurn(room, game, offered.at(-1)![0]);
    expect(game.getGallery()).toHaveLength(0); expect(room.museumCount).toBe(0);
  });
  it('counts reactions, including votes cast during the turn-end pause', () => {
    const { room, game, offered } = setup({ rounds: 2 }, 3);
    const d = room.drawerId!; const [a, b] = room.players.filter(p => p.id !== d).map(p => p.id);
    game.chooseWord(d, offered[0][0]); game.react(a, 'like');
    room.players.filter(p => p.id !== d).forEach(p => game.handleMessage(p.id, offered[0][0])); // turn ends
    game.react(b, 'dislike'); vi.advanceTimersByTime(5100);
    expect(game.getGallery()[0]).toMatchObject({ likes: 1, dislikes: 1 });
  });
  it('NEVER leaks words or strokes through the public room state during the game', () => {
    const { room, game, offered } = setup({ rounds: 2 }, 3);
    playTurn(room, game, offered[0][0]);
    const json = JSON.stringify(toPublicRoom(room));
    expect(json).not.toContain('strokes'); expect(json).not.toContain('"word"'); expect(json).not.toContain('artistName');
    expect(json).toContain('"museumCount":1');
  });
  it('a new game starts with an empty museum', () => {
    const { room, game, offered } = setup({ rounds: 2 }, 2);
    playTurn(room, game, offered.at(-1)![0]); expect(room.museumCount).toBe(1);
    const next = new Game(room, { onChange() {}, sendPrivate() {}, sendMessage() {}, resetCanvas() {}, snapshotCanvas: () => [stroke()] }); room.phase = 'lobby'; next.start();
    expect(room.museumCount).toBe(0); expect(next.getGallery()).toHaveLength(0);
  });
  it('compactStrokes thins huge drawings, keeps stroke ends and rounds coordinates', () => {
    const big: Stroke = { id: 7, color: '#ff0000', size: 8, points: Array.from({ length: 5000 }, (_, i) => ({ x: Math.random(), y: i / 5000 })) };
    const [c] = compactStrokes([big]);
    expect(c.points.length).toBeLessThanOrEqual(MAX_GALLERY_POINTS + 1); expect(c.points.at(-1)).toEqual({ x: Math.round(big.points.at(-1)!.x * 1000) / 1000, y: Math.round(big.points.at(-1)!.y * 1000) / 1000 });
    expect(String(c.points[0].x).length).toBeLessThanOrEqual(5); expect(c.id).toBe(7); expect(big.points).toHaveLength(5000); // original untouched
  });
});

describe('winner is decided by server state', () => {
  beforeEach(() => vi.useFakeTimers()); afterEach(() => vi.useRealTimers());
  it('leaderboard is sorted by score and winners are exactly the top scorers (ties included)', () => {
    const { room, game, offered } = setup({ rounds: 2 }, 3);
    for (let i = 0; i < 6; i++) playTurn(room, game, offered.at(-1)![0]);
    const g = room.game!; expect(g.turnPhase).toBe('game_over');
    const scores = g.leaderboard!.map(b => b.score); expect(scores).toEqual([...scores].sort((a, b) => b - a));
    const top = Math.max(...room.players.map(p => p.score));
    expect(g.winners.sort()).toEqual(room.players.filter(p => p.score === top).map(p => p.id).sort());
    g.leaderboard!.forEach(b => expect(b.score).toBe(room.players.find(p => p.id === b.id)!.score));
  });

  it('keeps paint-bucket fills (and their order) when a drawing is compacted for the museum', () => {
    const line = { id: 1, color: '#000000', size: 5, points: Array.from({ length: 3000 }, (_, i) => ({ x: i / 3000, y: 0.5 })) };
    const fill = { id: 2, color: '#e03131', size: 1, points: [{ x: 0.123456, y: 0.654321 }], fill: true };
    const out = compactStrokes([line, fill]);
    expect(out).toHaveLength(2); expect(out[1]).toEqual({ id: 2, color: '#e03131', size: 1, points: [{ x: 0.123, y: 0.654 }], fill: true });
    expect(out[0].fill).toBeUndefined(); expect(out[0].points.length).toBeLessThan(line.points.length);
  });
});
