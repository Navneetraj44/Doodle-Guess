import { useCallback, useEffect, useRef, useState } from 'react';
import { emit } from '../socket';
import { GalleryAck, GalleryEntry, Stroke } from '../types';
import { H, W, drawFull } from './Canvas';
import Icon from './Icon';
import Logo from './Logo';
import Avatar from './Avatar';

/** Paints saved strokes with the SAME renderer the live canvas uses. */
function Drawing({ strokes, label, className = '' }: { strokes: Stroke[]; label: string; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => { const c = ref.current?.getContext('2d'); if (c) drawFull(c, strokes); }, [strokes]);
  return <canvas ref={ref} width={W} height={H} className={`museum-canvas ${className}`} role="img" aria-label={label} />;
}

/** Doodle Museum: every drawing from the finished game, with its word, artist and reactions. The server only sends it once the game is over. */
export default function Museum({ onClose }: { onClose: () => void }) {
  const [items, setItems] = useState<GalleryEntry[] | null>(null); const [error, setError] = useState('');
  const [open, setOpen] = useState<number | null>(null);
  const load = useCallback(async () => {
    setError(''); setItems(null);
    const r = await emit<GalleryAck>('get_gallery');
    if (r.ok) setItems(r.gallery); else setError(r.error);
  }, []);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { if (open !== null) setOpen(null); else onClose(); }
      else if (open !== null && items) {
        if (e.key === 'ArrowRight') setOpen(o => (o === null ? o : (o + 1) % items.length));
        if (e.key === 'ArrowLeft') setOpen(o => (o === null ? o : (o - 1 + items.length) % items.length));
      }
    };
    document.addEventListener('keydown', onKey); return () => document.removeEventListener('keydown', onKey);
  }, [open, items, onClose]);

  const cur = open !== null && items ? items[open] : null;
  return (
    <main className="museum">
      <div className="museum-head">
        <Logo small />
        <div className="grow"><h2 className="museum-title"><Icon name="frame" size={26} /> Doodle Museum</h2><p className="muted-light">Relive the drawings from this game.</p></div>
        <button className="secondary" onClick={onClose}><Icon name="left" size={18} /> Back</button>
      </div>
      {error && <div className="error" role="alert">{error} <button className="mini" onClick={load}>Try again</button></div>}
      {items === null && !error && <p className="state-msg" role="status">Hanging the drawings…</p>}
      {items?.length === 0 && (
        <div className="empty-state"><Icon name="frame" size={44} /><h3>The walls are bare</h3><p>No drawings were saved this game. Blank canvases are never kept, so draw something next time!</p></div>)}
      {items && items.length > 0 && (
        <ul className="museum-grid">
          {items.map((e, i) => (
            <li key={e.id}>
              <button type="button" className="frame-card" onClick={() => setOpen(i)} aria-label={`Open drawing of ${e.word} by ${e.artistName}`}>
                <Drawing strokes={e.strokes} label={`Drawing of ${e.word}`} />
                <span className="frame-meta"><b className="frame-word">{e.word}</b>
                  <span className="frame-by"><Avatar code={e.artistAvatar} size="sm" />{e.artistName} · R{e.round}</span>
                  <span className="frame-likes"><Icon name="thumbUp" size={14} /> {e.likes}</span></span>
              </button>
            </li>))}
        </ul>)}
      {cur && items && (
        <div className="modal-backdrop" onMouseDown={ev => { if (ev.target === ev.currentTarget) setOpen(null); }}>
          <div className="modal lightbox" role="dialog" aria-modal="true" aria-label={`${cur.word} by ${cur.artistName}`}>
            <Drawing strokes={cur.strokes} label={`Drawing of ${cur.word}`} className="big" />
            <div className="lightbox-meta">
              <div><h2>{cur.word}</h2><p><Avatar code={cur.artistAvatar} size="sm" /> {cur.artistName} · Round {cur.round}</p></div>
              <div className="reaction-tally"><span><Icon name="thumbUp" size={18} /> {cur.likes}</span><span><Icon name="thumbDown" size={18} /> {cur.dislikes}</span></div>
            </div>
            <div className="modal-actions">
              <button className="secondary" onClick={() => setOpen((open! - 1 + items.length) % items.length)} aria-label="Previous drawing"><Icon name="left" size={18} /></button>
              <span className="muted counter">{(open ?? 0) + 1} / {items.length}</span>
              <button className="secondary" onClick={() => setOpen((open! + 1) % items.length)} aria-label="Next drawing"><Icon name="right" size={18} /></button>
              <button onClick={() => setOpen(null)}>Close</button>
            </div>
          </div>
        </div>)}
    </main>
  );
}
