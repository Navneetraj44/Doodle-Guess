import { ReactNode, useEffect, useState } from 'react';
import { emit } from '../socket';
import { ChatMessage, PrivateState, Room } from '../types';
import Canvas, { PAPER } from './Canvas';
import DrawToolbar, { COLORS } from './DrawToolbar';
import Chat from './Chat';
import PlayerList from './PlayerList';
import Timer from './Timer';
import Leaderboard from './Leaderboard';
import ConfirmDialog from './ConfirmDialog';
import Icon from './Icon';

interface Props { room: Room; me: string; chat: ChatMessage[]; priv: PrivateState; offset: number; onLeave: () => void; notices?: ReactNode; }

/** The word as letter slots. `hint` looks like "i c _   _ r e a m": single spaces separate letters, 2+ spaces separate words. */
function WordHint({ hint }: { hint: string }) {
  const letters = hint.split(' ').filter(Boolean).length;
  return (
    <span className="hint-word" aria-label={`Word: ${hint.replace(/_/g, 'blank')}`}>
      {hint.split(/ {2,}/).map((w, wi) => (
        <span key={wi} className="hint-group">{w.split(' ').filter(Boolean).map((c, i) => <span key={i} className={`slot ${c === '_' ? '' : 'letter'}`} aria-hidden="true">{c === '_' ? '' : c}</span>)}</span>))}
      <small className="hint-count" title={`${letters} letters`} aria-hidden="true">{letters}</small>
    </span>
  );
}

export default function Game({ room, me, chat, priv, offset, onLeave, notices }: Props) {
  const [color, setColor] = useState(COLORS[0]); const [size, setSize] = useState(8); const [tool, setTool] = useState<'brush' | 'eraser' | 'fill'>('brush');
  const eraser = tool === 'eraser', fill = tool === 'fill';
  const [err, setErr] = useState('');
  const [confirmLeave, setConfirmLeave] = useState(false); const [leaving, setLeaving] = useState(false);
  const [myVote, setMyVote] = useState<'like' | 'dislike' | null>(null); const [voteBusy, setVoteBusy] = useState(false); const [voteErr, setVoteErr] = useState('');
  const [flash, setFlash] = useState(false); const [banner, setBanner] = useState<number | null>(null);
  const g = room.game;
  // A new turn clears everyone's votes on the server; forget my local choice when the server no longer lists me as having voted.
  const iVoted = !!g?.voted.includes(me);
  useEffect(() => { if (!iVoted) { setMyVote(null); } }, [iVoted]);
  const iGuessed = !!g?.guessed.includes(me); const phase = g?.turnPhase; const round = g?.round ?? 0;
  useEffect(() => { if (iGuessed && phase === 'drawing') { setFlash(true); const t = setTimeout(() => setFlash(false), 2200); return () => clearTimeout(t); } setFlash(false); }, [iGuessed, phase]);
  useEffect(() => { if (round > 0) { setBanner(round); const t = setTimeout(() => setBanner(null), 2200); return () => clearTimeout(t); } }, [round]);
  if (!g) return <main className="card"><p>Loading game…</p></main>;
  if (g.turnPhase === 'game_over') return <Leaderboard room={room} me={me} onLeave={onLeave} />;

  const isDrawer = room.drawerId === me;
  const canDraw = isDrawer && g.turnPhase === 'drawing';
  const drawerName = room.players.find(p => p.id === room.drawerId)?.name ?? 'Someone';

  const hintNode =
    g.turnPhase === 'choosing' ? <span className="hint-text">{isDrawer ? 'Choose a word to draw' : `${drawerName} is choosing a word…`}</span>
    : g.turnPhase === 'drawing' ? (isDrawer ? (priv.word ? <WordHint hint={priv.word.split('').join(' ')} /> : null)
        : g.wordMode === 'hidden' ? <span className="hint-text"><Icon name="eye" size={20} /> Hidden word: just guess!</span> : <WordHint hint={g.hint} />)
    : <span className="hint-text">The word was “{g.revealedWord ?? '…'}”</span>;
  const placeholder = g.turnPhase !== 'drawing' ? 'Chat…' : isDrawer ? 'Chat with guessers…' : iGuessed ? 'You got it! Chat here…' : 'Type your guess…';
  const isHost = room.hostId === me;
  const onlyTwo = room.players.length <= 2;
  const doLeave = () => { if (leaving) return; setLeaving(true); onLeave(); };
  const canReact = !isDrawer && (g.turnPhase === 'drawing' || g.turnPhase === 'turn_end');
  const react = async (kind: 'like' | 'dislike') => {
    if (voteBusy || iVoted || myVote || !canReact) return; // one vote per turn; the server enforces it too
    setVoteBusy(true); const r = await emit('react', { kind }); setVoteBusy(false);
    if (r.ok) { setMyVote(kind); setVoteErr(''); } else setVoteErr(r.error);
  };
  const pick = async (word: string) => { const r = await emit('choose_word', { word }); setErr(r.ok ? '' : r.error); };
  const locked = !canReact || iVoted || !!myVote || voteBusy;

  const reactionButtons = (
    <div className="reactions" role="group" aria-label="Rate this drawing">
      <button type="button" className={`react like ${myVote === 'like' ? 'on' : ''}`} disabled={locked} onClick={() => react('like')} aria-label={`Like (${g.likes})`}><Icon name="thumbUp" size={18} /> <b>{g.likes}</b></button>
      <button type="button" className={`react dislike ${myVote === 'dislike' ? 'on' : ''}`} disabled={locked} onClick={() => react('dislike')} aria-label={`Dislike (${g.dislikes})`}><Icon name="thumbDown" size={18} /> <b>{g.dislikes}</b></button>
    </div>);
  const showReactions = g.turnPhase === 'drawing' || g.turnPhase === 'turn_end';

  return (
    <main className="game">
      <header className="hud sketch">
        <div className="hud-round">
          <span className="round-badge"><Icon name="flag" size={18} /> Round <b className="mono">{g.round}/{g.totalRounds}</b></span>
          <span className="drawer-name"><Icon name="pencil" size={13} /> {isDrawer ? 'You are' : `${drawerName} is`} drawing</span>
        </div>
        <div className="hint" aria-live="polite">{hintNode}</div>
        <div className="hud-actions">
          <Timer endsAt={g.endsAt} offset={offset} />
          <button type="button" className="leave-btn" onClick={() => setConfirmLeave(true)} aria-label="Leave room"><Icon name="door" size={18} /> <span className="leave-text">Leave</span></button>
        </div>
      </header>
      {notices}
      <div className="game-grid">
        <section className="stage" aria-label="Drawing board">
          <div className="board-area"><div className="board-frame">
            <div className="board-wrap">
              <Canvas isDrawer={canDraw} color={eraser ? PAPER : color} size={eraser ? Math.max(size, 12) : size} tool={fill ? 'fill' : 'brush'} />
              {banner !== null && g.turnPhase === 'choosing' && <div className="round-banner" aria-hidden="true">Round {banner} of {g.totalRounds}</div>}
              {flash && <div className="flash-correct" role="status"><Icon name="check" size={22} /> You got it!</div>}
              {g.turnPhase === 'choosing' && (
                <div className="overlay">
                  {isDrawer && priv.wordOptions ? (<>
                    <h2>Pick a word</h2>
                    <div className="row gap word-options">{priv.wordOptions.map(w => <button key={w} className="word-btn" onClick={() => pick(w)}>{w}</button>)}</div>
                    {err && <div className="error small">{err}</div>}</>)
                    : <h2><Icon name="pencil" size={26} /> {drawerName} is choosing a word…</h2>}
                </div>)}
              {g.turnPhase === 'turn_end' && (
                <div className="overlay">
                  <h2>The word was “{g.revealedWord ?? '—'}”</h2>
                  <ul className="turn-scores">{room.players.filter(p => g.turnScores?.[p.id]).map(p => <li key={p.id}>{p.name} <b>+{g.turnScores![p.id]}</b></li>)}</ul>
                  {Object.keys(g.turnScores ?? {}).length === 0 && <p>Nobody guessed it this time.</p>}
                </div>)}
            </div>
          </div></div>
          {canDraw ? (
            <DrawToolbar color={color} size={size} tool={tool} onColor={setColor} onSize={setSize} onTool={setTool} />)
            : showReactions && (
              <div className="board-foot">
                {reactionButtons}
                {voteErr && <div className="error small react-err" role="alert">{voteErr}</div>}
              </div>)}
        </section>
        <aside className="side">
          <PlayerList room={room} me={me} />
          <Chat messages={chat} placeholder={placeholder} />
        </aside>
      </div>
      {confirmLeave && (
        <ConfirmDialog title="Leave this game?" confirmLabel="Leave room" busy={leaving} onConfirm={doLeave} onCancel={() => setConfirmLeave(false)}>
          <p>You'll go back to the home page and your score in this game will be lost.</p>
          {isHost && <p><b>You're the host.</b> Host controls will pass to another player.</p>}
          {isDrawer && g.turnPhase !== 'turn_end' && <p>You're the drawer, so the current turn will end.</p>}
          {onlyTwo && <p>Only two players are in the room, so the game will end for the other player too.</p>}
        </ConfirmDialog>)}
    </main>
  );
}
