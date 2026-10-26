import { useEffect, useState } from 'react';
import { Room } from '../types';
import { HINT_COUNTS, WORD_COUNTS } from '../lib';
import PackGrid from './PackGrid';

interface Props { room: Room; hostWords: string[]; act: (event: string, data?: object) => Promise<boolean>; onError: (message: string) => void; }
const opts = (base: number[], current: number) => [...new Set([...base, current])].sort((a, b) => a - b);

/** Everything only the host can change in the lobby. The server re-validates every value and re-checks that the sender is the host. */
export default function HostSettings({ room, hostWords, act, onError }: Props) {
  const s = room.settings;
  const [text, setText] = useState(hostWords.join('\n')); const [dirty, setDirty] = useState(false); const [saved, setSaved] = useState('');
  useEffect(() => { if (!dirty) setText(hostWords.join('\n')); }, [hostWords, dirty]);

  const saveWords = async () => {
    const words = text.split(/[\n,]/).map(w => w.trim()).filter(Boolean);
    if (await act('update_settings', { customWords: words })) { setDirty(false); setSaved(`Saved ${words.length} word${words.length === 1 ? '' : 's'}`); setTimeout(() => setSaved(''), 2000); }
  };
  const togglePack = (id: string) => {
    const has = s.categories.includes(id); const next = has ? s.categories.filter(c => c !== id) : [...s.categories, id];
    if (next.length === 0) { onError('Keep at least one word pack selected.'); return; }
    void act('update_settings', { categories: next });
  };
  type NumKey = 'maxPlayers' | 'rounds' | 'drawTime' | 'wordCount' | 'hints';
  const sel = (key: NumKey, label: string, base: number[]) => (
    <label key={key}>{label}<select value={s[key]} onChange={e => act('update_settings', { [key]: Number(e.target.value) })}>{opts(base, s[key]).map(o => <option key={o}>{o}</option>)}</select></label>);

  return (
    <div className="settings-panel">
      <div className="settings">
        {sel('maxPlayers', 'Max players', Array.from({ length: 19 }, (_, i) => i + 2))}
        {sel('rounds', 'Rounds', Array.from({ length: 9 }, (_, i) => i + 2))}
        {sel('drawTime', 'Draw time (s)', [15, 30, 45, 60, 80, 90, 120, 150, 180, 240])}
        {sel('wordCount', 'Words to choose from', WORD_COUNTS)}
        {sel('hints', 'Hints', HINT_COUNTS)}
        <label>Word mode<select value={s.wordMode} onChange={e => act('update_settings', { wordMode: e.target.value })}>
          <option value="normal">Normal (blanks + hints)</option><option value="hidden">Hidden (no word shown)</option></select></label>
      </div>
      <label className="check"><input type="checkbox" checked={s.isPublic} onChange={e => act('update_settings', { isPublic: e.target.checked })} /> Public room <small className="muted-dark">(listed while in the lobby)</small></label>
      <span className="label">Word packs</span>
      <PackGrid selected={s.categories} onToggle={togglePack} compact />
      <label>Custom words <small className="muted-dark">(one per line or comma-separated, up to 100 · only you see this list)</small>
        <textarea value={text} rows={3} onChange={e => { setText(e.target.value); setDirty(true); }} placeholder={'pizza party\nour teacher\nthe canteen'} /></label>
      <div className="row gap">
        <button className="secondary" onClick={saveWords} disabled={!dirty}>Save custom words</button>
        <label className="check inline"><input type="checkbox" checked={s.customOnly} onChange={e => act('update_settings', { customOnly: e.target.checked })} /> Only use my words <small className="muted-dark">(needs 3+)</small></label>
        {saved && <span className="ok-text" role="status">{saved}</span>}
      </div>
    </div>
  );
}
