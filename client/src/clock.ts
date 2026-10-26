/**
 * Countdown maths, kept free of React so it can be unit-tested.
 *
 * The server owns every deadline (`endsAt`, in server time). Each browser keeps `offset = serverTime - localTime`, so
 * `serverNow = Date.now() + offset`, and shows `ceil((endsAt - serverNow) / 1000)`. Every player therefore counts down against the
 * same deadline, even when their computer clock is wrong.
 */
export interface ClockSample { sentAt: number; receivedAt: number; serverNow: number }

/** Offset for one ping: assume the server stamped its clock halfway through the round trip. */
export const offsetOf = (s: ClockSample) => s.serverNow - (s.sentAt + s.receivedAt) / 2;
/** Of several pings the one with the shortest round trip is the most accurate; use it. */
export function bestOffset(samples: ClockSample[]): number | null {
  if (samples.length === 0) return null;
  const best = samples.reduce((a, b) => (b.receivedAt - b.sentAt < a.receivedAt - a.sentAt ? b : a));
  return Math.round(offsetOf(best));
}
/** Whole seconds left (rounded up, never negative); null when there is no deadline. */
export const secondsLeft = (endsAt: number | null, localNow: number, offset: number): number | null =>
  endsAt === null ? null : Math.max(0, Math.ceil((endsAt - (localNow + offset)) / 1000));
/** Milliseconds until the displayed number next changes, so the timer ticks exactly on each second instead of drifting. */
export function msToNextTick(endsAt: number, localNow: number, offset: number): number {
  const left = endsAt - (localNow + offset);
  if (left <= 0) return 0;
  const into = left % 1000;
  return (into === 0 ? 1000 : into) + 5; // +5 ms: land just after the boundary
}
