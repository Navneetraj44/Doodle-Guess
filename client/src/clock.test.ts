import { describe, it, expect } from 'vitest';
import { bestOffset, msToNextTick, offsetOf, secondsLeft } from './clock';

describe('clock offset', () => {
  it('assumes the server stamped its clock in the middle of the round trip', () => {
    // client clock 5s behind the server, 100 ms round trip: sent at 1000, answered at 1100, server said 6050
    expect(offsetOf({ sentAt: 1000, receivedAt: 1100, serverNow: 6050 })).toBe(5000);
  });
  it('trusts the ping with the shortest round trip', () => {
    expect(bestOffset([{ sentAt: 0, receivedAt: 800, serverNow: 5400 }, { sentAt: 1000, receivedAt: 1040, serverNow: 6020 }, { sentAt: 2000, receivedAt: 2300, serverNow: 7100 }])).toBe(5000);
    expect(bestOffset([])).toBeNull();
  });
});
describe('secondsLeft', () => {
  it('counts down against the server deadline whatever the local clock says', () => {
    const endsAt = 100_000;                       // server time
    expect(secondsLeft(endsAt, 40_000, 50_000)).toBe(10);   // server now = 90_000
    expect(secondsLeft(endsAt, 40_001, 50_000)).toBe(10);   // 9.999 s -> still shows 10 (rounded up)
    expect(secondsLeft(endsAt, 40_999, 50_000)).toBe(10);  // 9.001 s left
    expect(secondsLeft(endsAt, 41_000, 50_000)).toBe(9);    // exactly 9.000 s left
    expect(secondsLeft(endsAt, 50_000, 50_000)).toBe(0);    // exactly at the deadline
    expect(secondsLeft(endsAt, 99_999, 50_000)).toBe(0);    // past the deadline never goes negative
    expect(secondsLeft(null, 1, 0)).toBeNull();
  });
  it('two players with different local clocks but correct offsets show the same number', () => {
    const serverNow = 90_000; const endsAt = 100_000;
    const a = secondsLeft(endsAt, serverNow - 7_000, 7_000); const b = secondsLeft(endsAt, serverNow + 123_456, -123_456);
    expect(a).toBe(10); expect(b).toBe(10);
  });
});
describe('msToNextTick', () => {
  it('waits until just after the next whole-second boundary', () => {
    expect(msToNextTick(10_000, 7_300, 0)).toBe(700 + 5);
    expect(msToNextTick(10_000, 8_000, 0)).toBe(1000 + 5);   // exactly on a boundary: wait a full second
    expect(msToNextTick(10_000, 10_000, 0)).toBe(0); expect(msToNextTick(10_000, 11_000, 0)).toBe(0);
  });
});
