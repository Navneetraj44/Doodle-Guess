import { PACKS } from '../lib';
import Icon from './Icon';

interface Props { selected: string[]; onToggle: (id: string) => void; compact?: boolean; }
/** Visual word-pack picker. Each tile maps 1:1 to a server word list; what is selected here is exactly what the server draws words from. */
export default function PackGrid({ selected, onToggle, compact = false }: Props) {
  return (
    <div className={`packgrid ${compact ? 'compact' : ''}`} role="group" aria-label="Word packs">
      {PACKS.map(p => {
        const on = selected.includes(p.id);
        return (
          <button key={p.id} type="button" aria-pressed={on} className={`pack ${on ? 'on' : ''}`} onClick={() => onToggle(p.id)}>
            <span className="pack-icon"><Icon name={p.icon} size={compact ? 20 : 26} /></span>
            <span className="pack-name">{p.label}</span>
            {!compact && <span className="pack-blurb">{p.blurb}</span>}
            {on && <span className="pack-tick" aria-hidden="true"><Icon name="check" size={14} /></span>}
          </button>);
      })}
    </div>
  );
}
