import { useState } from 'react';
import { emit } from '../socket';
import { Player } from '../types';
import ConfirmDialog from './ConfirmDialog';

/** Host-only Kick / Ban buttons. The server re-checks that the caller really is the host. */
export default function ModerationButtons({ player }: { player: Player }) {
  const [action, setAction] = useState<'kick' | 'ban' | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const ban = action === 'ban';
  const run = async () => {
    if (!action) return;
    setBusy(true); setError('');
    const r = await emit(ban ? 'ban_player' : 'kick_player', { playerId: player.id });
    setBusy(false);
    if (r.ok) setAction(null);
    else setError(r.error);
  };
  return (
    <>
      <span className="mod">
        <button className="mini" onClick={() => { setError(''); setAction('kick'); }} aria-label={`Kick ${player.name}`}>Kick</button>
        <button className="mini danger" onClick={() => { setError(''); setAction('ban'); }} aria-label={`Ban ${player.name}`}>Ban</button>
      </span>
      {action && <ConfirmDialog title={`${ban ? 'Ban' : 'Kick'} ${player.name}?`} confirmLabel="Confirm" dialogClass={`moderation-dialog ${ban ? 'is-ban' : 'is-kick'}`} closeLabel="Close confirmation" busy={busy} onConfirm={run} onCancel={() => { if (!busy) { setAction(null); setError(''); } }}>
        {error && <div className="error small" role="alert">{error}</div>}
      </ConfirmDialog>}
    </>
  );
}
