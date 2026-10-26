import { useEffect, useRef, useState } from 'react';
import { socket, emit, getToken } from './socket';
import { ChatMessage, PrivateState, Room } from './types';
import { ClockSample, bestOffset } from './clock';
import { removalMessage, REMOVAL_NOTICE_MS } from './removal';
import Landing from './components/Landing';
import Lobby from './components/Lobby';

export default function App() {
  const [room, setRoom] = useState<Room | null>(null);
  const [connected, setConnected] = useState(socket.connected);
  const [chat, setChat] = useState<ChatMessage[]>([]);
  const [priv, setPriv] = useState<PrivateState>({ wordOptions: null, word: null });
  const [meId, setMeId] = useState('');
  const [hostWords, setHostWords] = useState<string[]>([]);
  const [notice, setNotice] = useState('');
  const everConnected = useRef(false);
  const lastPhase = useRef<string | null>(null); // chat is cleared only when we ENTER the lobby (a new game ended), not on every lobby update
  const leftCode = useRef<string | null>(null); // room we just left: late room_state packets for it are ignored
  const [offset, setOffset] = useState(0); // serverTime - clientTime, for an accurate countdown
  const clockSynced = useRef(false);      // true once a time_sync measurement exists (it is more precise than the timestamp inside room_state)
  const [name, setName] = useState(() => sessionStorage.getItem('playerName') || '');
  const [avatar, setAvatar] = useState(() => sessionStorage.getItem('avatar') || '');

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(''), REMOVAL_NOTICE_MS);
    return () => window.clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    const onState = (r: Room) => {
      if (leftCode.current === r.code) return; // in-flight update from a room this player already left
      setRoom(r);
      if (r.game && !clockSynced.current) setOffset((r.game as any).serverNow - Date.now()); // rough estimate until the first time_sync finishes
      if (r.phase === 'lobby') { if (lastPhase.current !== 'lobby') setChat([]); setPriv({ wordOptions: null, word: null }); }
      lastPhase.current = r.phase;
    };
    const onChat = (m: ChatMessage) => setChat(c => [...c.slice(-99), m]);
    const onPriv = (p: PrivateState) => setPriv(p);
    const onYou = (d: { id: string }) => setMeId(d.id);
    const onHost = (d: { customWords: string[] }) => setHostWords(d.customWords);
    const onKicked = (d: { banned: boolean }) => {
      const code = sessionStorage.getItem('roomCode'); if (code) leftCode.current = code;
      sessionStorage.removeItem('roomCode'); lastPhase.current = null; clockSynced.current = false;
      setRoom(null); setMeId(''); setChat([]); setPriv({ wordOptions: null, word: null }); setHostWords([]); setOffset(0); history.replaceState(null, '', location.pathname);
      setNotice(removalMessage(d.banned));
    };
    // Measure how far this computer's clock is from the server's: 5 quick pings, the one with the shortest round trip wins. Repeated every 30 s.
    const syncClock = async () => {
      const samples: ClockSample[] = [];
      for (let i = 0; i < 5 && socket.connected; i++) {
        const sentAt = Date.now(); const r = await emit<{ ok: boolean; now?: number }>('time_sync'); const receivedAt = Date.now();
        if (r.ok && typeof r.now === 'number') samples.push({ sentAt, receivedAt, serverNow: r.now });
        await new Promise(res => setTimeout(res, 120));
      }
      const o = bestOffset(samples); if (o !== null) { clockSynced.current = true; setOffset(o); }
    };
    const clockTimer = setInterval(() => { if (socket.connected) void syncClock(); }, 30_000);
    const onConnect = async () => {
      setConnected(true); everConnected.current = true; void syncClock();
      // Reconnect: re-attach to the room we were in (server matches by secret token).
      const code = sessionStorage.getItem('roomCode');
      if (code) {
        const res = await emit('join_room', { roomCode: code, token: getToken(), playerName: sessionStorage.getItem('playerName'), avatar: sessionStorage.getItem('avatar') });
        if (res.ok && res.room) setRoom(res.room);
        else { // room is gone (server restart, expired, or game already in progress)
          sessionStorage.removeItem('roomCode'); setRoom(null); history.replaceState(null, '', location.pathname);
          setNotice(res.ok ? '' : `Could not rejoin your room: ${res.error}`);
        }
      }
    };
    socket.on('you', onYou); socket.on('host_settings', onHost); socket.on('kicked', onKicked); socket.on('room_state', onState); socket.on('chat_message', onChat); socket.on('private_state', onPriv); socket.on('connect', onConnect); socket.on('disconnect', () => setConnected(false));
    if (socket.connected) onConnect();
    return () => { socket.off('you', onYou); socket.off('host_settings', onHost); socket.off('kicked', onKicked); socket.off('room_state', onState); socket.off('chat_message', onChat); socket.off('private_state', onPriv); socket.off('connect', onConnect); clearInterval(clockTimer); };
  }, []);

  const enter = (r: Room, playerName: string, av: string) => {
    setNotice('');
    leftCode.current = null;
    sessionStorage.setItem('roomCode', r.code); sessionStorage.setItem('playerName', playerName); sessionStorage.setItem('avatar', av); setName(playerName); setAvatar(av); setRoom(r);
  };
  // Leave = go back to the landing page right away, then tell the server (it migrates the host / ends the turn / deletes an empty room).
  const leave = async () => {
    if (!room) return;
    leftCode.current = room.code;
    sessionStorage.removeItem('roomCode'); // so a reconnect can never silently re-join the room we left
    history.replaceState(null, '', location.pathname);
    lastPhase.current = null; setRoom(null); setChat([]); setPriv({ wordOptions: null, word: null }); setHostWords([]); setNotice('');
    await emit('leave_room'); // best effort: if this fails the server's disconnect handling still cleans the seat up
  };

  return (
    <div className="app">
      {!connected && <div className="banner" role="status">{everConnected.current ? 'Connection lost — reconnecting…' : 'Connecting to server… (it may take up to a minute if the server was asleep)'}</div>}
      {!room || !meId ? <Landing initialName={name} initialAvatar={avatar} connected={connected} notice={notice} onDismissNotice={() => setNotice('')} onEnter={enter} />
             : <Lobby room={room} me={meId} onLeave={leave} chat={chat} priv={priv} offset={offset} hostWords={hostWords} />}
    </div>
  );
}
