import { useEffect, useRef, useState } from 'react';
import { CATEGORIES, DRAW_TIMES, HINT_COUNTS, MIN_CUSTOM_ONLY, WORD_COUNTS, parseWords } from '../lib';
import { WordMode } from '../types';
import Icon from './Icon';
import PackGrid from './PackGrid';

export interface NewRoomConfig {
  settings: { maxPlayers: number; rounds: number; drawTime: number; isPublic: boolean; wordMode: WordMode; categories: string[]; customOnly: boolean; wordCount: number; hints: number };
  customWords: string[];
}
interface Props { busy: boolean; error: string; onCreate: (cfg: NewRoomConfig) => void; onCancel: () => void; }
const range = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => from + i);

/** "Create room" dialog. Nothing is sent to the server until Create Room is pressed; the server re-validates every value. */
export default function CreateRoomModal({ busy, error, onCreate, onCancel }: Props) {
  const [maxPlayers, setMaxPlayers] = useState(8); const [rounds, setRounds] = useState(3); const [drawTime, setDrawTime] = useState(80);
  const [wordCount, setWordCount] = useState(3); const [hints, setHints] = useState(2);
  const [wordMode, setWordMode] = useState<WordMode>('normal'); const [isPublic, setPublic] = useState(false);
  const [categories, setCategories] = useState<string[]>(CATEGORIES.map(c => c.id));
  const [text, setText] = useState(''); const [customOnly, setCustomOnly] = useState(false); const [local, setLocal] = useState('');
  const first = useRef<HTMLSelectElement>(null); const cancelRef = useRef(onCancel); cancelRef.current = onCancel;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null; first.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') cancelRef.current(); };
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('keydown', onKey); previous?.focus?.(); };
  }, []);

  const words = parseWords(text);
  const toggle = (id: string) => setCategories(c => (c.includes(id) ? c.filter(x => x !== id) : [...c, id]));
  const submit = () => {
    if (categories.length === 0 && !customOnly) { setLocal('Pick at least one word pack.'); return; }
    if (customOnly && words.length < MIN_CUSTOM_ONLY) { setLocal(`Add at least ${MIN_CUSTOM_ONLY} custom words to play with only your words.`); return; }
    setLocal(''); onCreate({ settings: { maxPlayers, rounds, drawTime, isPublic, wordMode, categories: categories.length ? categories : CATEGORIES.map(c => c.id), customOnly, wordCount, hints }, customWords: words });
  };
  const shown = local || error;
  const sel = (label: string, value: number, set: (n: number) => void, options: number[], ref?: React.RefObject<HTMLSelectElement>) =>
    <label>{label}<select ref={ref} value={value} onChange={e => set(Number(e.target.value))}>{options.map(n => <option key={n}>{n}</option>)}</select></label>;

  return (
    <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget && !busy) onCancel(); }}>
      <div className="modal wide" role="dialog" aria-modal="true" aria-labelledby="cr-title">
        <h2 id="cr-title"><Icon name="plus" size={24} /> Create a room</h2>
        <div className="seg" role="radiogroup" aria-label="Room visibility">
          <button type="button" role="radio" aria-checked={!isPublic} className={!isPublic ? 'on' : ''} onClick={() => setPublic(false)}><Icon name="lock" size={18} /> Private <small>invite link only</small></button>
          <button type="button" role="radio" aria-checked={isPublic} className={isPublic ? 'on' : ''} onClick={() => setPublic(true)}><Icon name="globe" size={18} /> Public <small>listed for everyone</small></button>
        </div>
        <div className="grid3">
          {sel('Max players', maxPlayers, setMaxPlayers, range(2, 20), first)}
          {sel('Rounds', rounds, setRounds, range(2, 10))}
          {sel('Draw time (s)', drawTime, setDrawTime, DRAW_TIMES)}
          {sel('Words to choose from', wordCount, setWordCount, WORD_COUNTS)}
          {sel('Hints', hints, setHints, HINT_COUNTS)}
          <label>Word mode<select value={wordMode} onChange={e => setWordMode(e.target.value as WordMode)}><option value="normal">Normal</option><option value="hidden">Hidden</option></select></label>
        </div>
        <span className="label">Word packs <small className="muted-dark">({categories.length} selected)</small></span>
        <PackGrid selected={categories} onToggle={toggle} compact />
        <label>Custom words <small className="muted-dark">(one per line or comma-separated, up to 100 · only you can see this list)</small>
          <textarea value={text} rows={3} onChange={e => setText(e.target.value)} placeholder={'pizza party\nour teacher\nthe canteen'} /></label>
        <label className="check"><input type="checkbox" checked={customOnly} onChange={e => setCustomOnly(e.target.checked)} /> Only use my words <small className="muted-dark">(needs {MIN_CUSTOM_ONLY}+)</small></label>
        {shown && <div className="error" role="alert">{shown}</div>}
        <div className="modal-actions">
          <button type="button" className="secondary" onClick={onCancel} disabled={busy}>Cancel</button>
          <button type="button" className="go" onClick={submit} disabled={busy}>{busy ? <span className="spin" aria-label="Creating room" /> : 'Create Room'}</button>
        </div>
      </div>
    </div>
  );
}
