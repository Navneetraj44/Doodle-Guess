import { useState } from 'react';
import { emit, getToken } from '../socket';
import { ListAck, Room } from '../types';
import { isValidAvatar, parseRoomCode, randomAvatar } from '../lib';
import PublicRooms from './PublicRooms';
import Logo from './Logo';
import Mascot from './Mascot';
import Icon from './Icon';
import AvatarPicker from './AvatarPicker';
import CreateRoomModal, { NewRoomConfig } from './CreateRoomModal';

interface Props { initialName: string; initialAvatar: string; connected: boolean; notice?: string; onDismissNotice: () => void; onEnter: (r: Room, name: string, avatar: string) => void; }
type Busy = 'create' | 'join' | 'play' | '';

export default function Landing({ initialName, initialAvatar, connected, notice, onDismissNotice, onEnter }: Props) {
  const [name, setName] = useState(initialName);
  const [avatar, setAvatar] = useState(() => (isValidAvatar(initialAvatar) ? initialAvatar : randomAvatar())); // an old emoji avatar from an earlier session is replaced
  const [code, setCode] = useState(parseRoomCode(location.search)); // prefilled from an invite link (?room=CODE)
  const [error, setError] = useState(''); const [busy, setBusy] = useState<Busy>('');
  const [create, setCreate] = useState(false);

  /** Runs create/join. Returns true when the player entered a room. */
  const run = async (event: 'create_room' | 'join_room', payload: object, kind: Busy = event === 'create_room' ? 'create' : 'join') => {
    onDismissNotice();
    if (!name.trim()) { setError('Please enter a display name first.'); setCreate(false); return false; }
    setError(''); setBusy(kind);
    const res = await emit(event, { ...payload, token: getToken(), playerName: name, avatar });
    setBusy('');
    if (res.ok && res.room) { history.replaceState(null, '', `?room=${res.room.code}`); onEnter(res.room, name.trim(), avatar); return true; }
    if (!res.ok) setError(res.error);
    return false;
  };
  /** Quick Play = join a random open public room, or open a new public one if nobody is waiting. */
  const quickPlay = async () => {
    onDismissNotice();
    if (!name.trim()) { setError('Please enter a display name first.'); return; }
    setBusy('play'); const list = await emit<ListAck>('list_public_rooms');
    if (list.ok && list.rooms.length) { await run('join_room', { roomCode: list.rooms[Math.floor(Math.random() * list.rooms.length)].code }, 'play'); return; }
    await run('create_room', { settings: { isPublic: true } }, 'play');
  };
  const openCreate = () => { onDismissNotice(); if (!name.trim()) { setError('Please enter a display name first.'); return; } setError(''); setCreate(true); };
  const disabled = !!busy || !connected;

  return (
    <main className="landing">
      <section className="hero">
        <div className="hero-copy">
          <Logo />
          <p className="tagline">Draw. Guess. Have fun. <span className="scrawl">just a name, no sign-up</span></p>
          <div className="you-card">
            {error && !create && <div className="error" role="alert">{error}</div>}
            {notice && !create && <div className="landing-notice" role="status"><span>{notice}</span><button type="button" className="notice-dismiss" onClick={onDismissNotice} aria-label="Dismiss notification">×</button></div>}
            <div className="you-row">
              <AvatarPicker value={avatar} onChange={setAvatar} />
              <div className="grow"><label htmlFor="name">Your name</label><input id="name" className="name-input" value={name} maxLength={20} onChange={e => setName(e.target.value)} placeholder="What should we call you?" autoComplete="nickname" /></div>
            </div>
            <div className="cta-row">
              <button className="go big" disabled={disabled} onClick={quickPlay}>{busy === 'play' ? <span className="spin" aria-label="Finding a room" /> : <><Icon name="play" size={22} /> Quick Play</>}</button>
              <button className="pink big" disabled={disabled} onClick={() => openCreate()}><Icon name="plus" size={22} /> Create Room</button>
            </div>
          </div>
        </div>
        <Mascot className="hero-art" />
      </section>

      <div className="landing-grid">
        <section className="card light join-card" aria-label="Join a room">
          <h2><Icon name="users" size={22} /> Join a room</h2>
          <div className="join-row">
            <input value={code} onChange={e => setCode(parseRoomCode(e.target.value))} onPaste={e => { const t = parseRoomCode(e.clipboardData.getData('text')); if (t) { e.preventDefault(); setCode(t); } }} placeholder="Room code or invite link" aria-label="Room code or invite link" />
            <button className="blue" disabled={disabled || code.length < 5} onClick={() => run('join_room', { roomCode: code })}>{busy === 'join' ? <span className="spin" aria-label="Joining room" /> : 'Join Room'}</button>
          </div>
          {!connected && <p className="state-msg"><Icon name="wifiOff" size={18} /> Connecting to the server… it can take a minute if it was asleep.</p>}
        </section>
        <section className="card light"><PublicRooms connected={connected} busy={disabled} onJoin={c => run('join_room', { roomCode: c })} /></section>
      </div>

      {create && <CreateRoomModal busy={busy === 'create'} error={error}
        onCancel={() => { setCreate(false); setError(''); }} onCreate={async (cfg: NewRoomConfig) => { await run('create_room', cfg); }} />}
    </main>
  );
}
