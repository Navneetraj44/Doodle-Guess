import { useCallback, useEffect, useState } from 'react';
import { emit } from '../socket';
import { ListAck, PublicRoomInfo } from '../types';
import { MODE_LABEL } from '../lib';
import Icon from './Icon';
import Avatar from './Avatar';

interface Props { connected: boolean; busy: boolean; onJoin: (code: string) => void; }

/** Browse open public lobbies; refreshes every 5 seconds. Loading, empty and error states are all handled. */
export default function PublicRooms({ connected, busy, onJoin }: Props) {
  const [rooms, setRooms] = useState<PublicRoomInfo[] | null>(null); const [error, setError] = useState(''); const [spinning, setSpinning] = useState(false);
  const load = useCallback(async () => {
    setSpinning(true); const r = await emit<ListAck>('list_public_rooms'); setSpinning(false);
    if (r.ok) { setRooms(r.rooms); setError(''); } else setError(r.error);
  }, []);
  useEffect(() => { if (!connected) return; void load(); const t = setInterval(load, 5000); return () => clearInterval(t); }, [connected, load]);

  return (
    <section className="public" aria-label="Public rooms">
      <div className="row"><h2><Icon name="globe" size={22} /> Public rooms</h2>
        <button className="mini" onClick={load} aria-label="Refresh public rooms"><Icon name="refresh" size={14} className={spinning ? 'turning' : ''} /> Refresh</button></div>
      {!connected && <p className="state-msg"><Icon name="wifiOff" size={18} /> Waiting for the server…</p>}
      {error && <div className="error small" role="alert">{error}</div>}
      {connected && rooms === null && !error && <p className="state-msg" role="status">Looking for rooms…</p>}
      {rooms?.length === 0 && <div className="empty-state small"><p><b>No public rooms right now.</b><br />Be the first: create a room and choose “Public”.</p></div>}
      <ul className="roomlist">
        {rooms?.map(r => (
          <li key={r.code}>
            <Avatar code={r.hostAvatar} />
            <span className="grow"><b>{r.hostName}</b>’s room <span className="code-tag">{r.code}</span><br />
              <small className="muted-dark">{r.rounds} rounds · {r.drawTime}s · {MODE_LABEL[r.wordMode] ?? r.wordMode}</small></span>
            <span className="count-pill" title="Players in the room"><Icon name="users" size={14} /> {r.players}/{r.maxPlayers}</span>
            <button className="mini go" disabled={busy} onClick={() => onJoin(r.code)}>Join</button>
          </li>))}
      </ul>
    </section>
  );
}
