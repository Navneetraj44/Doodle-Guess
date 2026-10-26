import { useState } from 'react';
import { emit } from '../socket';
import { Room } from '../types';
import Logo from './Logo';
import Icon from './Icon';
import Museum from './Museum';
import PlayerName from './PlayerName';
import Avatar from './Avatar';

const CONFETTI = Array.from({ length: 18 }, (_, i) => i);
/** Final results. Winner(s), order and scores all come from the server's game_over state, nothing is computed in the browser. */
export default function Leaderboard({ room, me, onLeave }: { room: Room; me: string; onLeave: () => void }) {
  const g = room.game!; const [err, setErr] = useState(''); const [busy, setBusy] = useState(''); const [museum, setMuseum] = useState(false);
  const board = g.leaderboard ?? [];
  const winners = board.filter(b => g.winners.includes(b.id));
  const byId = (id: string) => room.players.find(p => p.id === id);
  const isHost = room.hostId === me;
  const run = async (kind: 'again' | 'lobby') => {
    setBusy(kind); const r = await emit('play_again', kind === 'again' ? { restart: true } : undefined); setBusy('');
    if (!r.ok) setErr(r.error);
  };
  if (museum) return <Museum onClose={() => setMuseum(false)} />;
  const top = board[0]?.score ?? 0;
  const rankOf = (score: number) => 1 + board.filter(b => b.score > score).length; // ties share a rank

  return (
    <main className="results">
      <Logo small />
      <section className="card winner-card" aria-labelledby="win-h">
        <div className="confetti" aria-hidden="true">{CONFETTI.map(i => <i key={i} style={{ left: `${(i * 37) % 100}%`, animationDelay: `${(i % 6) * 0.35}s`, background: ['#FF4FA3', '#FFD23F', '#1F6FD1', '#24201B', '#FF4FA3'][i % 5] }} />)}</div>
        <Icon name="trophy" size={56} className="trophy" />
        <p className="stamp-label">Game over</p>
        <h1 id="win-h">{winners.length === 0 ? 'Nobody won' : winners.length > 1 ? `It’s a tie!` : `${winners[0].name} wins!`}</h1>
        <div className="winner-avatars">{winners.map(w => <Avatar key={w.id} code={byId(w.id)?.avatar} size="xl" />)}</div>
        {winners.length > 0 && <p className="muted-light">{winners.map(w => w.name).join(' & ')} · {top} points</p>}
      </section>
      <section className="card board-card" aria-label="Final scores">
        <ol className="board-list">
          {board.map(b => { const rank = rankOf(b.score); const p = byId(b.id); return (
            <li key={b.id} className={`${b.id === me ? 'me' : ''} ${g.winners.includes(b.id) ? 'winner' : ''}`}>
              <span className={`rank-badge r${Math.min(rank, 4)}`}>{rank}</span><Avatar code={p?.avatar} size="sm" />
              <span className="grow"><PlayerName name={b.name} isMe={b.id === me} isHost={b.id === room.hostId} /></span>
              <b className="score">{b.score}</b></li>); })}
        </ol>
        {err && <div className="error" role="alert">{err}</div>}
        <div className="result-actions">
          {isHost ? <>
            <button className="go" disabled={!!busy} onClick={() => run('again')}><Icon name="refresh" size={18} /> {busy === 'again' ? 'Starting…' : 'Play Again'}</button>
            <button className="blue" disabled={!!busy} onClick={() => run('lobby')}>Back to Lobby</button></>
            : <p className="muted-dark wait-msg">Waiting for the host to start another game…</p>}
          <button className="paper" onClick={() => setMuseum(true)}><Icon name="frame" size={18} /> Doodle Museum{room.museumCount ? ` (${room.museumCount})` : ''}</button>
          <button className="leave-btn" onClick={onLeave}><Icon name="door" size={18} /> Leave Room</button>
        </div>
      </section>
    </main>
  );
}
