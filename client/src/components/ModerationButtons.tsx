import { emit } from '../socket';
import { Player } from '../types';

/** Host-only Kick / Ban buttons. The server re-checks that the caller really is the host. */
export default function ModerationButtons({ player }: { player: Player }) {
  const run = async (event: 'kick_player' | 'ban_player') => {
    const ban = event === 'ban_player';
    if (!window.confirm(`${ban ? 'Ban' : 'Kick'} ${player.name}?${ban ? ' They will not be able to rejoin this room from the same browser session.' : ''}`)) return;
    const r = await emit(event, { playerId: player.id });
    if (!r.ok) window.alert(r.error);
  };
  return (
    <span className="mod">
      <button className="mini" onClick={() => run('kick_player')} aria-label={`Kick ${player.name}`}>Kick</button>
      <button className="mini danger" onClick={() => run('ban_player')} aria-label={`Ban ${player.name}`}>Ban</button>
    </span>
  );
}
