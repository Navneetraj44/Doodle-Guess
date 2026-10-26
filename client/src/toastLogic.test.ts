import { describe, it, expect } from 'vitest';
import { diffPlayers, createToastTimers } from './toastLogic';

const snap = (...pairs: [string, string][]) => new Map(pairs);

describe('diffPlayers', () => {
  it('announces other players who joined or left, never the current client', () => {
    const r = diffPlayers(snap(['a', 'Raj']), snap(['a', 'Raj'], ['b', 'alex'], ['me', 'Me']), 'me');
    expect(r).toEqual([{ text: 'alex joined', tone: 'join' }]);
    expect(diffPlayers(snap(['a', 'Raj'], ['b', 'alex']), snap(['a', 'Raj']), 'me')).toEqual([{ text: 'alex left', tone: 'leave' }]);
  });
  it('reports nothing when only scores or connection state change (same ids)', () => {
    expect(diffPlayers(snap(['a', 'Raj'], ['b', 'alex']), snap(['a', 'Raj'], ['b', 'alex']), 'a')).toEqual([]);
  });
});

describe('createToastTimers', () => {
  function fake() {
    let now = 0; let n = 0; const q = new Map<number, { at: number; fn: () => void }>();
    return {
      setTimeout: (fn: () => void, ms: number) => { const h = ++n; q.set(h, { at: now + ms, fn }); return h; },
      clearTimeout: (h: unknown) => { q.delete(h as number); },
      advance(ms: number) { now += ms; [...q.entries()].filter(([, v]) => v.at <= now).sort((a, b) => a[1].at - b[1].at).forEach(([h, v]) => { q.delete(h); v.fn(); }); },
    };
  }
  it('expires every toast even when later toasts are scheduled in between', () => {
    const clock = fake(); const gone: number[] = [];
    const timers = createToastTimers(id => gone.push(id), 3000, clock);
    timers.schedule(1); clock.advance(1000); timers.schedule(2); clock.advance(1000); timers.schedule(3);
    clock.advance(1000); expect(gone).toEqual([1]);
    clock.advance(1000); expect(gone).toEqual([1, 2]);
    clock.advance(1000); expect(gone).toEqual([1, 2, 3]);
    expect(timers.pending()).toBe(0);
  });
  it('dispose clears all pending timers (unmount) so nothing fires afterwards', () => {
    const clock = fake(); const gone: number[] = [];
    const timers = createToastTimers(id => gone.push(id), 3000, clock);
    timers.schedule(1); timers.schedule(2); timers.dispose(); clock.advance(10000);
    expect(gone).toEqual([]); expect(timers.pending()).toBe(0);
  });
});
