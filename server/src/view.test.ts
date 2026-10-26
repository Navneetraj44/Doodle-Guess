import { describe, it, expect } from 'vitest';
import { RoomManager } from './RoomManager.js';
import { toPublicRoom } from './view.js';

describe('toPublicRoom', () => {
  it('never exposes tokens or socket ids', () => {
    const m = new RoomManager(); const r = m.createRoom('super-secret-token', 'Ann'); r.players[0].socketId = 'sock-123';
    const json = JSON.stringify(toPublicRoom(r));
    expect(json).not.toContain('super-secret-token'); expect(json).not.toContain('sock-123'); expect(json).not.toContain('"token"');
    expect(toPublicRoom(r).players[0].connected).toBe(true);
  });
});
