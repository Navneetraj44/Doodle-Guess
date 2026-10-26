import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { RoomManager, GameError, sanitizeSettings } from './RoomManager.js';
import { Game, GameDeps } from './Game.js';
import { WORDS, CATEGORIES, buildPool, pickFromPool, sanitizeCustomWords } from './words.js';
import { AVATAR_PARTS, isValidAvatar, randomAvatar, sanitizeAvatar } from './avatars.js';
import { toPublicRoom } from './view.js';
import { Room } from './types.js';

const online = (room: Room) => room.players.forEach((p, i) => (p.socketId = `s${i}`));

describe('words, categories, custom words', () => {
  it('has several categories with enough words', () => {
    expect(CATEGORIES.length).toBeGreaterThanOrEqual(8); expect(Object.values(WORDS).flat().length).toBeGreaterThanOrEqual(200);
  });
  it('builds a pool from selected categories plus custom words, or custom words only', () => {
    expect(buildPool(['animals'], [], false)).toEqual(WORDS.animals);
    expect(buildPool(['animals'], ['Banana Split'], false)).toContain('banana split');
    expect(buildPool(['animals'], ['one', 'two', 'three'], true).sort()).toEqual(['one', 'three', 'two']);
    expect(buildPool([], [], true).length).toBeGreaterThan(100); // never a pool too small to offer 3 words
  });
  it('validates custom words with readable errors and removes duplicates', () => {
    expect(sanitizeCustomWords(['  Pizza  Party ', 'pizza party', 'Café'])).toEqual(['pizza party', 'café']);
    expect(() => sanitizeCustomWords(['a'])).toThrow('not a valid word');
    expect(() => sanitizeCustomWords(['<script>'])).toThrow(GameError);
    expect(() => sanitizeCustomWords('nope')).toThrow('list');
    expect(() => sanitizeCustomWords(Array.from({ length: 101 }, (_, i) => `word${i}`))).toThrow('at most');
  });
  it('picks distinct unused words and recycles only when the pool runs dry', () => {
    const used = new Set<string>(); const pool = ['a1', 'b2', 'c3', 'd4', 'e5'];
    const first = pickFromPool(pool, used, 3); expect(new Set(first).size).toBe(3);
    first.forEach(w => used.add(w));
    const second = pickFromPool(pool, used, 3); // only 2 unused left -> pool recycles
    expect(new Set(second).size).toBe(3); expect(used.size).toBe(0);
  });
});

describe('settings and avatars', () => {
  it('clamps and defaults the new settings', () => {
    const s = sanitizeSettings({ isPublic: 'yes' as any, wordMode: 'weird' as any, categories: ['animals', 'nope'] as any });
    expect(s.isPublic).toBe(false); expect(s.wordMode).toBe('normal'); expect(s.categories).toEqual(['animals']);
    expect(sanitizeSettings({ categories: [] }).categories).toEqual(CATEGORIES);
  });
  it('only accepts well-formed cartoon avatar codes', () => {
    expect(sanitizeAvatar('3-5-2')).toBe('3-5-2');
    for (const bad of ['<img src=x>', '🐶', '99-0-0', '0-0-10', '-1-0-0', '1-2', '1-2-3-4', '1.5-0-0', 42, null, undefined]) expect(isValidAvatar(bad)).toBe(false);
    expect(isValidAvatar(sanitizeAvatar('<img src=x>'))).toBe(true);
    expect(isValidAvatar(randomAvatar(() => 0.999999))).toBe(true); expect(randomAvatar(() => 0)).toBe('0-0-0');
    expect(AVATAR_PARTS.colors * AVATAR_PARTS.eyes * AVATAR_PARTS.mouths).toBe(1200);
    const m = new RoomManager(); const r = m.createRoom('token-ann-0001', 'Ann', {}, '11-9-9'); expect(r.players[0].avatar).toBe('11-9-9');
    const r2 = m.createRoom('token-bob-0002', 'Bob', {}, 'javascript:alert(1)'); expect(isValidAvatar(r2.players[0].avatar)).toBe(true);
  });
  it('"only my words" needs at least 3 custom words', () => {
    const m = new RoomManager();
    expect(() => m.createRoom('token-ann-0001', 'Ann', { customOnly: true, customWords: ['one', 'two'] })).toThrow('at least 3');
    const r = m.createRoom('token-ann-0001', 'Ann', { customOnly: true, customWords: ['one', 'two', 'three'] });
    expect(() => m.updateSettings(r, r.hostId, { customWords: ['one'] })).toThrow('at least 3');
    expect(r.customWords).toHaveLength(3); // a rejected update changes nothing
  });
  it('only the host can change custom words', () => {
    const m = new RoomManager(); const r = m.createRoom('token-ann-0001', 'Ann'); m.joinRoom(r.code, 'token-bob-0002', 'Bob');
    expect(() => m.updateSettings(r, r.players[1].id, { customWords: ['hello'] })).toThrow('Only the host');
  });
});

describe('public rooms', () => {
  it('lists only public, open, non-full lobbies that have someone connected', () => {
    const m = new RoomManager();
    const pub = m.createRoom('token-a-000001', 'Ann', { isPublic: true, maxPlayers: 2 }); const priv = m.createRoom('token-b-000002', 'Bob');
    const full = m.createRoom('token-c-000003', 'Cy', { isPublic: true, maxPlayers: 2 }); m.joinRoom(full.code, 'token-d-000004', 'Dee');
    const started = m.createRoom('token-e-000005', 'Eve', { isPublic: true }); started.phase = 'playing';
    const ghost = m.createRoom('token-f-000006', 'Fay', { isPublic: true });
    [pub, priv, full, started].forEach(online);
    expect(m.listPublic().map(r => r.code)).toEqual([pub.code]);
    expect(m.listPublic()[0]).toMatchObject({ hostName: 'Ann', players: 1, maxPlayers: 2 }); expect(ghost.code).toBeDefined();
  });
  it('a room stops being listed when the host makes it private', () => {
    const m = new RoomManager(); const r = m.createRoom('token-a-000001', 'Ann', { isPublic: true }); online(r);
    expect(m.listPublic()).toHaveLength(1); m.updateSettings(r, r.hostId, { isPublic: false }); expect(m.listPublic()).toHaveLength(0);
  });
});

describe('host moderation (kick / ban)', () => {
  const mk = () => { const m = new RoomManager(); const r = m.createRoom('token-ann-0001', 'Ann'); m.joinRoom(r.code, 'token-bob-0002', 'Bob'); m.joinRoom(r.code, 'token-cy-0003', 'Cy'); return { m, r, ann: r.players[0], bob: r.players[1], cy: r.players[2] }; };
  it('only the host can kick or ban, never themselves', () => {
    const { m, r, ann, bob, cy } = mk();
    expect(() => m.moderate(r, bob.id, cy.id, false)).toThrow('Only the host');
    expect(() => m.moderate(r, ann.id, ann.id, true)).toThrow('yourself');
    expect(() => m.moderate(r, ann.id, 'nobody', false)).toThrow('no longer');
  });
  it('a kicked player is removed but may rejoin', () => {
    const { m, r, ann, bob } = mk(); m.moderate(r, ann.id, bob.id, false);
    expect(r.players.map(p => p.name)).toEqual(['Ann', 'Cy']); expect(() => m.joinRoom(r.code, 'token-bob-0002', 'Bob')).not.toThrow();
  });
  it('a banned player cannot rejoin with the same session token', () => {
    const { m, r, ann, bob } = mk(); m.moderate(r, ann.id, bob.id, true);
    expect(() => m.joinRoom(r.code, 'token-bob-0002', 'Bob')).toThrow('banned');
  });
});

describe('public view hides private data', () => {
  it('never exposes custom words, the ban list or tokens', () => {
    const m = new RoomManager(); const r = m.createRoom('token-ann-0001', 'Ann', { customWords: ['secretword'] }); r.banned.add('banned-token-xyz');
    const json = JSON.stringify(toPublicRoom(r));
    expect(json).not.toContain('secretword'); expect(json).not.toContain('banned-token-xyz'); expect(json).not.toContain('token-ann-0001');
    expect(toPublicRoom(r).customWordCount).toBe(1);
  });
});

describe('Game: word variety and modes', () => {
  beforeEach(() => vi.useFakeTimers()); afterEach(() => vi.useRealTimers());
  function play(settings: any, customWords?: string[]) {
    const m = new RoomManager(); const room = m.createRoom('p0-aaaaaaaa', 'A', { ...settings, customWords });
    m.joinRoom(room.code, 'p1-aaaaaaaa', 'B'); m.joinRoom(room.code, 'p2-aaaaaaaa', 'C'); online(room);
    const offered: string[][] = []; const priv: any[] = [];
    const deps: GameDeps = { onChange() {}, sendPrivate: (id, s) => { priv.push({ id, s }); if (s.wordOptions) offered.push(s.wordOptions); }, sendMessage() {}, resetCanvas() {}, random: Math.random };
    const game = new Game(room, deps); game.start(); return { room, game, offered, priv };
  }
  it('does not repeat a word within a game while unused words remain', () => {
    const { room, game, offered } = play({ rounds: 3, customOnly: true }, ['w1', 'w2', 'w3', 'w4', 'w5', 'w6', 'w7', 'w8', 'w9']);
    const chosen: string[] = [];
    for (let turn = 0; turn < 7; turn++) {
      const word = offered.at(-1)![0]; chosen.push(word); const d = room.drawerId!; game.chooseWord(d, word);
      room.players.filter(p => p.id !== d).forEach(p => game.handleMessage(p.id, word)); vi.advanceTimersByTime(5000);
    }
    expect(new Set(chosen).size).toBe(7);
  });
  it('only offers words from the selected categories', () => {
    const { offered, game } = play({ categories: ['sports'] }); expect(offered[0].every(w => WORDS.sports.includes(w))).toBe(true); game.destroy();
  });
  it('offers only custom words when "only my words" is on', () => {
    const { offered, game } = play({ customOnly: true }, ['alpha', 'bravo', 'charlie', 'delta']); expect(offered[0].every(w => ['alpha', 'bravo', 'charlie', 'delta'].includes(w))).toBe(true); game.destroy();
  });
  it('hidden mode: guessers get no blanks and no hints, but guessing and scoring still work', () => {
    const { room, game, priv } = play({ wordMode: 'hidden', drawTime: 30 }); const d = room.drawerId!; const word = priv.find(p => p.s.wordOptions).s.wordOptions[0];
    game.chooseWord(d, word); expect(room.game!.wordMode).toBe('hidden'); expect(room.game!.hint).toBe('');
    vi.advanceTimersByTime(25_000); expect(room.game!.hint).toBe(''); expect(JSON.stringify(room)).not.toContain(word);
    expect(priv.find(p => p.id === d && p.s.word)!.s.word).toBe(word); // the drawer still sees it
    const guesser = room.players.find(p => p.id !== d)!; game.handleMessage(guesser.id, word); expect(guesser.score).toBeGreaterThan(0);
  });
  it('normal mode still reveals letter hints over time', () => {
    const { room, game, priv } = play({ drawTime: 30 }); const d = room.drawerId!; const word = priv.find(p => p.s.wordOptions).s.wordOptions[0];
    game.chooseWord(d, word); const before = room.game!.hint; vi.advanceTimersByTime(16_000);
    if (word.replace(/[^\p{L}\p{N}]/gu, '').length >= 4) expect(room.game!.hint).not.toBe(before);
  });
});
