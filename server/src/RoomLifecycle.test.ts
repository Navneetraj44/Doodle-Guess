import { describe, it, expect } from 'vitest';
import { RoomManager, GameError } from './RoomManager.js';
import { Room } from './types.js';

/** Room with Ann (host), Bob, Cy. `online` lists who has a live socket. */
function mkRoom(online: ('ann' | 'bob' | 'cy')[], phase: Room['phase'] = 'lobby') {
  const m = new RoomManager();
  const room = m.createRoom('token-ann-0001', 'Ann', { maxPlayers: 4 });
  m.joinRoom(room.code, 'token-bob-0002', 'Bob'); m.joinRoom(room.code, 'token-cy-0003', 'Cy');
  const [ann, bob, cy] = room.players;
  for (const [k, p] of [['ann', ann], ['bob', bob], ['cy', cy]] as const) p.socketId = online.includes(k) ? `sock-${k}` : null;
  room.phase = phase;
  return { m, room, ann, bob, cy };
}

describe('host migration', () => {
  it('migrateHost hands the host role to a connected player when the host is offline', () => {
    const { m, room, bob } = mkRoom(['bob', 'cy'], 'playing');
    m.migrateHost(room); expect(room.hostId).toBe(bob.id);
  });

  it('migrateHost does nothing while the host is still connected', () => {
    const { m, room, ann } = mkRoom(['ann', 'bob', 'cy']);
    m.migrateHost(room); expect(room.hostId).toBe(ann.id);
  });

  it('removePlayer (host leaves) prefers a CONNECTED player over an offline one that is earlier in the list', () => {
    const { m, room, ann, cy } = mkRoom(['ann', 'cy'], 'playing'); // Bob is offline but listed before Cy
    m.removePlayer(room, ann.id); expect(room.hostId).toBe(cy.id);
  });

  it('removePlayer falls back to the first remaining player when nobody is connected', () => {
    const { m, room, ann, bob } = mkRoom([], 'playing');
    m.removePlayer(room, ann.id); expect(room.hostId).toBe(bob.id);
  });

  it('the new host is shown as ready (host rows must not read "Not ready")', () => {
    const a = mkRoom(['ann', 'bob', 'cy']); a.m.removePlayer(a.room, a.ann.id);
    expect(a.room.players.find(p => p.id === a.room.hostId)!.ready).toBe(true);
    const b = mkRoom(['bob', 'cy'], 'playing'); b.m.migrateHost(b.room);
    expect(b.room.players.find(p => p.id === b.room.hostId)!.ready).toBe(true);
  });

  it('after migration the NEW host can use host-only actions and the OLD host cannot', () => {
    const { m, room, ann, bob, cy } = mkRoom(['bob', 'cy']); // Ann closed her browser (still listed)
    m.migrateHost(room); expect(room.hostId).toBe(bob.id);
    expect(() => m.updateSettings(room, bob.id, { rounds: 5 })).not.toThrow(); expect(room.settings.rounds).toBe(5);
    expect(() => m.updateSettings(room, ann.id, { rounds: 7 })).toThrow('Only the host');
    expect(() => m.canStart(room, ann.id)).toThrow('Only the host');
    m.setReady(room, cy.id, true); ann.ready = true;
    expect(() => m.canStart(room, bob.id)).not.toThrow();
    room.phase = 'ended';
    expect(() => m.resetToLobby(room, ann.id)).toThrow('Only the host');
    expect(() => m.resetToLobby(room, bob.id)).not.toThrow();
  });
});

describe('room lifecycle after a game', () => {
  it('"Play again" drops players who are offline, so a ghost cannot block the next game', () => {
    const { m, room, ann, bob, cy } = mkRoom(['bob', 'cy'], 'ended'); // Ann (old host) is gone
    m.migrateHost(room); expect(room.hostId).toBe(bob.id);
    m.resetToLobby(room, bob.id);
    expect(room.players.map(p => p.id)).toEqual([bob.id, cy.id]); expect(room.players.some(p => p.id === ann.id)).toBe(false);
    m.setReady(room, cy.id, true);
    expect(() => m.canStart(room, bob.id)).not.toThrow();       // regression: used to throw "All players must be ready."
    expect(room.players.every(p => p.score === 0)).toBe(true); expect(room.phase).toBe('lobby');
  });

  it('only the host can restart, and only a finished game can be restarted', () => {
    const { m, room, bob } = mkRoom(['ann', 'bob', 'cy'], 'playing');
    expect(() => m.resetToLobby(room, room.hostId)).toThrow('not finished');
    room.phase = 'ended'; expect(() => m.resetToLobby(room, bob.id)).toThrow('Only the host');
  });

  it('a FINISHED room accepts new players (they wait on the leaderboard until the host starts a new game)', () => {
    const { m, room } = mkRoom(['ann', 'cy'], 'ended'); // Bob left, 2 of 4 seats taken... plus offline Bob entry removed below
    m.removePlayer(room, room.players[1].id);
    const r = m.joinRoom(room.code, 'token-new-0009', 'Dee');
    expect(r.players.some(p => p.name === 'Dee')).toBe(true); expect(r.phase).toBe('ended');
  });

  it('a finished room still enforces capacity and unique names', () => {
    const { m, room } = mkRoom(['ann', 'bob', 'cy'], 'ended'); room.settings.maxPlayers = 3;
    expect(() => m.joinRoom(room.code, 'token-new-0009', 'Dee')).toThrow('Room is full.');
    room.settings.maxPlayers = 4;
    expect(() => m.joinRoom(room.code, 'token-new-0010', 'bob')).toThrow('name is taken');
  });

  it('a game IN PROGRESS rejects new players with an accurate "in progress" message', () => {
    const { m, room } = mkRoom(['ann', 'bob', 'cy'], 'playing');
    let msg = ''; try { m.joinRoom(room.code, 'token-new-0009', 'Dee'); } catch (e) { msg = (e as GameError).message; }
    expect(msg).toContain('in progress'); expect(msg).not.toContain('already started');
  });

  it('a player whose token is still in the room can always reconnect, in any phase', () => {
    for (const phase of ['lobby', 'playing', 'ended'] as const) {
      const { m, room, bob } = mkRoom(['ann', 'cy'], phase);
      const r = m.joinRoom(room.code, 'token-bob-0002', 'Bob'); expect(r.players.filter(p => p.id === bob.id)).toHaveLength(1);
    }
  });
});
