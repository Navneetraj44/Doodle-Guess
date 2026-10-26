import { useEffect, useRef, useState } from 'react';
import { Player } from '../types';
import Icon from './Icon';
import { ToastItem, MAX_TOASTS, createToastTimers, diffPlayers } from '../toastLogic';

export type Toast = ToastItem;
/**
 * Short-lived notices (a player joined / left) derived from room-state changes. Purely cosmetic; the server is the source of truth.
 * Dismissal timers live outside the effect (see createToastTimers), so a later player update never cancels an earlier toast's timer.
 */
export function usePlayerToasts(players: Player[], me: string): Toast[] {
  const prev = useRef<Map<string, string> | null>(null); const next = useRef(1);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timers = useRef<ReturnType<typeof createToastTimers> | null>(null);
  if (!timers.current) timers.current = createToastTimers(id => setToasts(t => t.filter(x => x.id !== id)));
  useEffect(() => { const t = timers.current!; return () => t.dispose(); }, []); // unmount only
  useEffect(() => {
    const now = new Map(players.map(p => [p.id, p.name] as [string, string]));
    const before = prev.current; prev.current = now; if (!before) return;
    const fresh: Toast[] = diffPlayers(before, now, me).map(e => ({ id: next.current++, ...e }));
    if (!fresh.length) return;
    setToasts(t => { const all = [...t, ...fresh]; all.slice(0, Math.max(0, all.length - MAX_TOASTS)).forEach(x => timers.current!.cancel(x.id)); return all.slice(-MAX_TOASTS); });
    fresh.forEach(f => timers.current!.schedule(f.id));
  }, [players, me]);
  return toasts;
}
/** `inline` sits in the page flow (under the game header); otherwise it floats at the top of the screen (lobby). */
export default function Toasts({ items, inline = false }: { items: Toast[]; inline?: boolean }) {
  return (
    <div className={`toasts ${inline ? 'inline' : ''}`} role="status" aria-live="polite">
      {items.map(t => <div key={t.id} className={`toast ${t.tone}`}><Icon name={t.tone === 'join' ? 'users' : 'door'} size={16} /> <span>{t.text}</span></div>)}
    </div>
  );
}
