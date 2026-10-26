import { randomBytes } from 'node:crypto';
import { Player, Room, RoomSettings } from './types.js';
import { GameError } from './errors.js';
import { CATEGORIES, MIN_CUSTOM_ONLY, sanitizeCustomWords } from './words.js';
import { sanitizeAvatar } from './avatars.js';

export { GameError };
export const MAX_ROOMS = 1000;
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no look-alikes (0/O, 1/I)
const newId = () => randomBytes(6).toString('hex');
const clamp = (n: unknown, min: number, max: number, fallback: number) =>
  typeof n === 'number' && Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n))) : fallback;

export const DEFAULT_SETTINGS: RoomSettings = { maxPlayers: 8, rounds: 3, drawTime: 80, isPublic: false, wordMode: 'normal', categories: [...CATEGORIES], customOnly: false, wordCount: 3, hints: 2 };
export type SettingsInput = Partial<RoomSettings> & { customWords?: unknown };

export function sanitizeSettings(s: Partial<RoomSettings> | undefined, base: RoomSettings = DEFAULT_SETTINGS): RoomSettings {
  const cats = Array.isArray(s?.categories) ? [...new Set(s!.categories.filter((c): c is string => typeof c === 'string' && CATEGORIES.includes(c)))] : [];
  return {
    maxPlayers: clamp(s?.maxPlayers, 2, 20, base.maxPlayers), rounds: clamp(s?.rounds, 2, 10, base.rounds), drawTime: clamp(s?.drawTime, 15, 240, base.drawTime),
    isPublic: typeof s?.isPublic === 'boolean' ? s.isPublic : base.isPublic,
    wordMode: s?.wordMode === 'hidden' || s?.wordMode === 'normal' ? s.wordMode : base.wordMode,
    categories: cats.length ? cats : base.categories,
    customOnly: typeof s?.customOnly === 'boolean' ? s.customOnly : base.customOnly,
    wordCount: clamp(s?.wordCount, 1, 5, base.wordCount ?? 3), hints: clamp(s?.hints, 0, 5, base.hints ?? 2),
  };
}
export function sanitizeName(name: unknown): string {
  const n = typeof name === 'string' ? name.replace(/\p{C}/gu, '').trim().replace(/\s+/g, ' ').slice(0, 20) : '';
  if (!n) throw new GameError('Please enter a display name.');
  return n;
}
const assertCustomOnlyOk = (s: RoomSettings, custom: string[]) => {
  if (s.customOnly && custom.length < MIN_CUSTOM_ONLY) throw new GameError(`Add at least ${MIN_CUSTOM_ONLY} custom words to play with only your words.`);
};

export interface PublicRoomInfo { code: string; hostName: string; hostAvatar: string; players: number; maxPlayers: number; rounds: number; drawTime: number; wordMode: string; }

export class RoomManager {
  private rooms = new Map<string, Room>();
  private offlineSince = new Map<string, number>();
  get size() { return this.rooms.size; }

  private newCode(): string {
    for (;;) {
      const code = Array.from({ length: 5 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join('');
      if (!this.rooms.has(code)) return code;
    }
  }
  get(code: string): Room | undefined { return this.rooms.get(String(code).trim().toUpperCase()); }

  createRoom(token: string, name: unknown, settings?: SettingsInput, avatar?: unknown): Room {
    if (this.rooms.size >= MAX_ROOMS) throw new GameError('The server is busy. Please try again later.');
    const custom = sanitizeCustomWords(settings?.customWords);
    const s = sanitizeSettings(settings); assertCustomOnlyOk(s, custom);
    const host: Player = { id: newId(), token, name: sanitizeName(name), avatar: sanitizeAvatar(avatar), socketId: null, ready: true, score: 0 };
    const room: Room = { code: this.newCode(), hostId: host.id, settings: s, phase: 'lobby', drawerId: null, players: [host], game: null, customWords: custom, banned: new Set() };
    this.rooms.set(room.code, room);
    return room;
  }

  /** Joining with a token that is already in the room = reconnect. */
  joinRoom(code: string, token: string, name: unknown, avatar?: unknown): Room {
    const room = this.get(code);
    if (!room) throw new GameError('Room not found. Check the code and try again.');
    if (room.banned.has(token)) throw new GameError('You were banned from this room.');
    if (room.players.some(p => p.token === token)) return room;
    // A game in progress cannot take new players (mid-game joining is not supported). A FINISHED room can: everyone sits on
    // the leaderboard until the host presses "Play again", which returns the room to the lobby.
    if (room.phase === 'playing') throw new GameError('A game is in progress in this room. You can join once it finishes.');
    if (room.players.length >= room.settings.maxPlayers) throw new GameError('Room is full.');
    const n = sanitizeName(name);
    if (room.players.some(p => p.name.toLowerCase() === n.toLowerCase())) throw new GameError('That name is taken in this room.');
    room.players.push({ id: newId(), token, name: n, avatar: sanitizeAvatar(avatar), socketId: null, ready: false, score: 0 });
    return room;
  }

  /** Open lobbies for the "Browse public rooms" list. Private rooms, started games and full rooms are never listed. */
  listPublic(limit = 30): PublicRoomInfo[] {
    const out: PublicRoomInfo[] = [];
    for (const r of this.rooms.values()) {
      if (!r.settings.isPublic || r.phase !== 'lobby' || r.players.length >= r.settings.maxPlayers || !r.players.some(p => p.socketId !== null)) continue;
      const host = r.players.find(p => p.id === r.hostId)!;
      out.push({ code: r.code, hostName: host.name, hostAvatar: host.avatar, players: r.players.length, maxPlayers: r.settings.maxPlayers, rounds: r.settings.rounds, drawTime: r.settings.drawTime, wordMode: r.settings.wordMode });
      if (out.length >= limit) break;
    }
    return out;
  }

  playerByToken(room: Room, token: string): Player | undefined { return room.players.find(p => p.token === token); }

  private assignHost(room: Room, player: Player): void { room.hostId = player.id; player.ready = true; }

  /** If the host is offline, hand the host role to the first connected player. */
  migrateHost(room: Room): void {
    const host = room.players.find(p => p.id === room.hostId);
    if (host && host.socketId !== null) return;
    const next = room.players.find(p => p.socketId !== null);
    if (next) this.assignHost(room, next);
  }

  /** Remove rooms where every player has been offline for `ttlMs`. Returns removed codes. */
  sweep(now: number, ttlMs: number): string[] {
    const removed: string[] = [];
    for (const [code, room] of this.rooms) {
      if (room.players.some(p => p.socketId !== null)) { this.offlineSince.delete(code); continue; }
      const since = this.offlineSince.get(code) ?? now; this.offlineSince.set(code, since);
      if (now - since >= ttlMs) { this.rooms.delete(code); this.offlineSince.delete(code); removed.push(code); }
    }
    return removed;
  }

  removePlayer(room: Room, playerId: string): void {
    room.players = room.players.filter(p => p.id !== playerId);
    if (room.players.length === 0) { this.rooms.delete(room.code); this.offlineSince.delete(room.code); return; }
    if (room.hostId === playerId) this.assignHost(room, room.players.find(p => p.socketId !== null) ?? room.players[0]); // host migration
  }

  /** Host moderation. A ban remembers the player's secret token, so the same browser session cannot rejoin this room. */
  moderate(room: Room, actorId: string, targetId: string, ban: boolean): Player {
    if (actorId !== room.hostId) throw new GameError('Only the host can remove players.');
    if (targetId === actorId) throw new GameError('You cannot remove yourself.');
    const target = room.players.find(p => p.id === targetId);
    if (!target) throw new GameError('That player is no longer in the room.');
    if (ban) room.banned.add(target.token);
    this.removePlayer(room, targetId);
    return target;
  }

  setReady(room: Room, playerId: string, ready: boolean): void {
    const p = room.players.find(x => x.id === playerId);
    if (p && room.phase === 'lobby' && playerId !== room.hostId) p.ready = !!ready;
  }

  updateSettings(room: Room, playerId: string, s: SettingsInput): void {
    if (playerId !== room.hostId) throw new GameError('Only the host can change settings.');
    if (room.phase !== 'lobby') throw new GameError('Settings are locked once the game starts.');
    const custom = s.customWords !== undefined ? sanitizeCustomWords(s.customWords) : room.customWords;
    const next = sanitizeSettings(s, room.settings);
    if (next.maxPlayers < room.players.length) throw new GameError('Max players is below the current player count.');
    assertCustomOnlyOk(next, custom);
    room.settings = next; room.customWords = custom;
  }

  /** Back to the lobby after a finished game (host only). */
  resetToLobby(room: Room, playerId: string): void {
    if (playerId !== room.hostId) throw new GameError('Only the host can restart.');
    if (room.phase !== 'ended') throw new GameError('The game is not finished yet.');
    room.phase = 'lobby'; room.game = null; room.drawerId = null;
    // Offline players (e.g. a host who closed the browser) would otherwise stay as "not ready" ghosts and block canStart().
    // They can still come back: joining a lobby with their token simply adds them again.
    room.players = room.players.filter(p => p.socketId !== null || p.id === room.hostId);
    for (const p of room.players) { p.score = 0; p.ready = p.id === room.hostId; }
  }

  /** Authorization + preconditions for starting. */
  canStart(room: Room, playerId: string): void {
    if (playerId !== room.hostId) throw new GameError('Only the host can start the game.');
    if (room.phase !== 'lobby') throw new GameError('Game already started.');
    if (room.players.length < 2) throw new GameError('Need at least 2 players to start.');
    if (room.players.some(p => p.id !== room.hostId && !p.ready)) throw new GameError('All players must be ready.');
  }
}
