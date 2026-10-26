import { describe, it, expect } from 'vitest';
import { RoomManager, GameError, MAX_ROOMS, sanitizeName } from './RoomManager.js';

const join = (m: RoomManager, code: string, token: string, name: string) => { const r = m.joinRoom(code, token, name); return r.players.find(p => p.token === token)!; };

describe('RoomManager', () => {
  it('creates a room with a code; the public host id is not the secret token', () => {
    const r = new RoomManager().createRoom('token-host-1', 'Ann');
    expect(r.code).toHaveLength(5); expect(r.hostId).toBe(r.players[0].id); expect(r.players[0].id).not.toBe('token-host-1');
  });
  it('rejects unknown codes and enforces capacity', () => {
    const m = new RoomManager(); expect(() => m.joinRoom('NOPE1', 'token-bob-12', 'Bob')).toThrow(GameError);
    const r = m.createRoom('token-host-1', 'Ann', { maxPlayers: 2 }); join(m, r.code, 'token-bob-12', 'Bob');
    expect(() => m.joinRoom(r.code, 'token-cy-123', 'Cy')).toThrow('Room is full.');
  });
  it('only the host may start, and only when others are ready', () => {
    const m = new RoomManager(); const r = m.createRoom('token-host-1', 'Ann'); const bob = join(m, r.code, 'token-bob-12', 'Bob');
    expect(() => m.canStart(r, bob.id)).toThrow('Only the host');
    expect(() => m.canStart(r, r.hostId)).toThrow('ready');
    m.setReady(r, bob.id, true); expect(() => m.canStart(r, r.hostId)).not.toThrow();
  });
  it('clamps settings and migrates host on leave', () => {
    const m = new RoomManager(); const r = m.createRoom('token-host-1', 'Ann', { rounds: 99, drawTime: 1 });
    expect(r.settings.rounds).toBe(10); expect(r.settings.drawTime).toBe(15);
    const bob = join(m, r.code, 'token-bob-12', 'Bob'); m.removePlayer(r, r.hostId); expect(r.hostId).toBe(bob.id);
  });
  it('treats a repeated token as a reconnect, not a new player', () => {
    const m = new RoomManager(); const r = m.createRoom('token-host-1', 'Ann'); join(m, r.code, 'token-bob-12', 'Bob'); join(m, r.code, 'token-bob-12', 'Bob');
    expect(r.players).toHaveLength(2);
  });
  it('strips control characters from names', () => {
    expect(sanitizeName('A\u0000B\u202e ')).toBe('AB'); expect(() => sanitizeName('\u0000 ')).toThrow(GameError);
  });
  it('migrates the host to a connected player when the host is offline', () => {
    const m = new RoomManager(); const r = m.createRoom('token-host-1', 'Ann'); const bob = join(m, r.code, 'token-bob-12', 'Bob');
    bob.socketId = 's1'; m.migrateHost(r); expect(r.hostId).toBe(bob.id);
  });
  it('sweeps rooms that have been fully offline past the TTL, but not active rooms', () => {
    const m = new RoomManager(); const idle = m.createRoom('token-host-1', 'Ann'); const live = m.createRoom('token-host-2', 'Zed'); live.players[0].socketId = 's';
    expect(m.sweep(1000, 500)).toEqual([]); expect(m.sweep(1600, 500)).toEqual([idle.code]); expect(m.get(live.code)).toBeDefined();
  });
  it('caps the number of rooms', () => {
    const m = new RoomManager(); for (let i = 0; i < MAX_ROOMS; i++) m.createRoom(`token-${i}-abcd`, 'X');
    expect(() => m.createRoom('token-extra-1', 'X')).toThrow('busy');
  });
});
