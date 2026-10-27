import { useState } from 'react';
import { emit } from '../socket';
import { ChatMessage, PrivateState, Room } from '../types';
import { MODE_LABEL } from '../lib';
import Game from './Game';
import Logo from './Logo';
import ConfirmDialog from './ConfirmDialog';
import Icon from './Icon';
import Museum from './Museum';
import Toasts, { usePlayerToasts } from './Toasts';
import Chat from './Chat';
import PlayerList from './PlayerList';
import RoomSettingsModal from './RoomSettingsModal';

interface Props { room: Room; me: string; onLeave: () => void; chat: ChatMessage[]; priv: PrivateState; offset: number; hostWords: string[]; }

export default function Lobby({ room, me, onLeave, chat, priv, offset, hostWords }: Props) {
  const [error, setError] = useState(''); const [copied, setCopied] = useState<'' | 'code' | 'link'>('');
  const [confirmLeave, setConfirmLeave] = useState(false); const [leaving, setLeaving] = useState(false); const [museum, setMuseum] = useState(false); const [editing, setEditing] = useState(false);
  const toasts = usePlayerToasts(room.players, me);
  const isHost = room.hostId === me;
  const self = room.players.find(p => p.id === me);
  const link = `${location.origin}${location.pathname}?room=${room.code}`;
  /** Runs a server action; shows the error (if any) and returns whether it worked. */
  const act = async (event: string, data?: object) => {
    const r = await emit(event, data); setError(r.ok ? '' : r.error); return r.ok;
  };
  if (room.phase !== 'lobby') return <Game room={room} me={me} chat={chat} priv={priv} offset={offset} onLeave={onLeave} notices={<Toasts items={toasts} inline />} />;
  if (museum) return <Museum onClose={() => setMuseum(false)} />;
  const s = room.settings;
  const copy = async (what: 'code' | 'link') => { try { await navigator.clipboard.writeText(what === 'code' ? room.code : link); setCopied(what); setTimeout(() => setCopied(''), 1500); } catch { setError('Could not copy. Select the text and copy it manually.'); } };
  const doLeave = () => { if (leaving) return; setLeaving(true); onLeave(); };
  const waitingOn = room.players.filter(p => p.id !== room.hostId && !p.ready);
  const startBlock = room.players.length < 2 ? 'Waiting for at least one more player…' : waitingOn.length ? `Waiting for ${waitingOn.map(p => p.name).join(', ')} to get ready…` : '';
  const status = room.players.length < 2 ? 'Waiting for players…' : waitingOn.length ? 'Waiting for everyone to get ready…' : isHost ? 'Everyone is ready!' : 'Waiting for the host to start…';

  return (
    <main className="game lobby-game">
      <header className="hud sketch">
        <div className="lobby-brand"><Logo small /><span className="lobby-tag" aria-label="You are in the lobby">Lobby</span></div>
        <div className="hint" aria-live="polite"><span className="hint-text">{status}</span></div>
        <div className="hud-actions">
          <span className={`chip lh-vis ${s.isPublic ? 'pub' : ''}`}><Icon name={s.isPublic ? 'globe' : 'lock'} size={14} /> {s.isPublic ? 'Public' : 'Private'}</span>
          <button type="button" className="leave-btn" onClick={() => setConfirmLeave(true)} aria-label="Leave room"><Icon name="door" size={18} /> <span className="leave-text">Leave</span></button>
        </div>
      </header>
      <Toasts items={toasts} inline />
      <div className="game-grid">
        <section className="stage" aria-label="Waiting room">
          <div className="board-area"><div className="board-frame">
            <div className="board-wrap wait-board">
              <div className="wait-panel">
                <h2 className="room-title">Waiting Room</h2>
                <p className="room-sub">{s.isPublic ? 'Public room: anyone can find it, or share the code with friends.' : 'Private room: share the code with friends.'}</p>
                <div className="code-card">
                  <span className="eyebrow">Room code</span>
                  <div className="code-big" aria-label={`Room code ${room.code.split('').join(' ')}`}>{room.code}</div>
                </div>
                <div className="copy-row">
                  <button type="button" className="paper" onClick={() => copy('code')}>{copied === 'code' && <Icon name="check" size={18} />}{copied === 'code' ? 'Copied!' : 'Copy code'}</button>
                  <button type="button" className="blue" onClick={() => copy('link')}><Icon name={copied === 'link' ? 'check' : 'link'} size={18} /> {copied === 'link' ? 'Copied!' : 'Copy invite link'}</button>
                </div>
                <div className="chips setting-badges" aria-label="Room settings">
                  <span className="chip">{s.rounds} rounds</span><span className="chip">{s.drawTime}s draw</span><span className="chip">{s.wordCount} words</span>
                  <span className="chip">{s.wordMode === 'hidden' ? 'no hints' : `${s.hints} hints`}</span><span className="chip">{room.players.length}/{s.maxPlayers} players</span><span className="chip">{MODE_LABEL[s.wordMode]}</span>
                </div>
                {error && <div className="error" role="alert">{error}</div>}
                <div className="start-zone">
                  {isHost
                    ? <><button type="button" className="go big" disabled={!!startBlock} onClick={() => act('start_game')}><Icon name="play" size={22} /> {startBlock ? 'Waiting for players…' : 'Start Game'}</button>{startBlock && <p className="start-hint" role="status">{startBlock}</p>}</>
                    : <><button type="button" className="go big" onClick={() => act('set_ready', { ready: !self?.ready })}>{self?.ready ? 'Not ready' : "I'm ready"}</button><p className="start-hint" role="status">{self?.ready ? 'Waiting for the host to start…' : 'Press ready when you want to play.'}</p></>}
                  {!!room.museumCount && <button type="button" className="paper" onClick={() => setMuseum(true)}><Icon name="frame" size={18} /> Last game’s Doodle Museum ({room.museumCount})</button>}
                </div>
              </div>
            </div>
          </div></div>
        </section>
        <aside className="side">
          <PlayerList room={room} me={me} lobby />
          <Chat messages={chat} title="Chat" placeholder="Say hi to the room…" empty="No messages yet. Say hi while you wait!" />
        </aside>
      </div>
      {editing && isHost && <RoomSettingsModal room={room} hostWords={hostWords} act={act} onError={setError} onClose={() => setEditing(false)} />}
      {confirmLeave && (
        <ConfirmDialog title="Leave this room?" confirmLabel="Leave room" cancelLabel="Stay" busy={leaving} onConfirm={doLeave} onCancel={() => setConfirmLeave(false)}>
          <p>You'll go back to the home page.</p>{isHost && <p><b>You're the host.</b> Host controls will pass to another player.</p>}
        </ConfirmDialog>)}
    </main>
  );
}
