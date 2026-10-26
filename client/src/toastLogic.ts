/** Pure logic behind the join/leave notices, kept free of React so the timer lifecycle can be unit-tested. */
export interface ToastItem { id: number; text: string; tone: 'join' | 'leave' | 'info' }
export const TOAST_MS = 3200;
export const MAX_TOASTS = 4;

/** Compare two player snapshots (id -> name) and describe who joined or left. The current client is never announced. */
export function diffPlayers(before: Map<string, string>, now: Map<string, string>, me: string): { text: string; tone: 'join' | 'leave' }[] {
  const out: { text: string; tone: 'join' | 'leave' }[] = [];
  now.forEach((name, id) => { if (!before.has(id) && id !== me) out.push({ text: `${name} joined`, tone: 'join' }); });
  before.forEach((name, id) => { if (!now.has(id) && id !== me) out.push({ text: `${name} left`, tone: 'leave' }); });
  return out;
}

type Timers = {
  setTimeout: (fn: () => void, ms: number) => unknown;
  clearTimeout: (h: unknown) => void;
};

/**
 * One independent dismissal timer per toast. Timers are owned here, NOT by a React effect, so later room-state
 * updates (which re-run effects) can never cancel an earlier toast's timer. `dispose()` is called on unmount only.
 */
export function createToastTimers(onExpire: (id: number) => void, ms = TOAST_MS, t: Timers = { setTimeout: (f, m) => setTimeout(f, m), clearTimeout: h => clearTimeout(h as ReturnType<typeof setTimeout>) }) {
  const handles = new Map<number, unknown>();
  return {
    schedule(id: number) {
      handles.set(id, t.setTimeout(() => { handles.delete(id); onExpire(id); }, ms));
    },
    cancel(id: number) { if (handles.has(id)) { t.clearTimeout(handles.get(id)); handles.delete(id); } },
    dispose() { handles.forEach(h => t.clearTimeout(h)); handles.clear(); },
    pending: () => handles.size,
  };
}
