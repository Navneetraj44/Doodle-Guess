import { Room } from '../types';
import ModerationButtons from './ModerationButtons';
import Icon from './Icon';
import PlayerName from './PlayerName';
import Avatar from './Avatar';

/** Players who are actually in the room (never placeholders). `lobby` adds each player's ready state; the game screen leaves it off. */
export default function PlayerList({ room, me, lobby = false }: { room: Room; me: string; lobby?: boolean }) {
  const guessed = new Set(room.game?.guessed ?? []); const iAmHost = room.hostId === me;
  const sorted = [...room.players].sort((a, b) => b.score - a.score);
  return (
    <ul className={`scores ${lobby ? 'in-lobby' : ''}`} aria-label="Players">
      {sorted.map((p, i) => (
        <li key={p.id} className={`${p.id === me ? 'me' : ''} ${p.connected ? '' : 'off'} ${guessed.has(p.id) ? 'guessed' : ''} ${p.id === room.drawerId ? 'drawing' : ''}`}>
          <span className="who"><span className="rank">{i + 1}</span><Avatar code={p.avatar} size="sm" />
            <PlayerName name={p.name} isMe={p.id === me} isHost={p.id === room.hostId}>
              {p.id === room.drawerId && <span className="state-icon drawing" title="Drawing now"><Icon name="pencil" size={14} label="Drawing now" /></span>}
              {guessed.has(p.id) && <span className="state-icon ok" title="Guessed the word"><Icon name="check" size={14} label="Guessed the word" /></span>}
              {!p.connected && <small className="offline-tag"> · offline</small>}
            </PlayerName></span>
          <span className="right">{lobby && p.id !== room.hostId && <span className={`${p.ready ? 'ready' : 'waiting'} ready-tag`}>{p.ready ? <><Icon name="check" size={14} /> Ready</> : 'Not ready'}</span>}<b className="score">{p.score}</b></span>
          {iAmHost && p.id !== me && <div className="mod-row"><ModerationButtons player={p} /></div>}
        </li>))}
    </ul>
  );
}
