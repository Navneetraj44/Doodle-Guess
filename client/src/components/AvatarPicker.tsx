import { AvatarPart, cycleAvatar, randomAvatar } from '../lib';
import Avatar from './Avatar';
import Icon from './Icon';

const ROWS: { part: AvatarPart; label: string }[] = [{ part: 'eyes', label: 'eyes' }, { part: 'mouth', label: 'mouth' }, { part: 'color', label: 'colour' }];

/** skribbl-style avatar maker: a big face with a "<" and ">" for the eyes, the mouth and the colour, plus a dice button for a random face. */
export default function AvatarPicker({ value, onChange }: { value: string; onChange: (code: string) => void }) {
  return (
    <div className="avatar-picker" role="group" aria-label="Design your avatar">
      <div className="ap-arrows">{ROWS.map(r => <button key={r.part} type="button" className="ap-arrow" aria-label={`Previous ${r.label}`} onClick={() => onChange(cycleAvatar(value, r.part, -1))}><Icon name="left" size={16} /></button>)}</div>
      <Avatar code={value} size="xl" className="ap-face" />
      <div className="ap-arrows">{ROWS.map(r => <button key={r.part} type="button" className="ap-arrow" aria-label={`Next ${r.label}`} onClick={() => onChange(cycleAvatar(value, r.part, 1))}><Icon name="right" size={16} /></button>)}</div>
      <button type="button" className="ap-dice" aria-label="Random avatar" title="Random avatar" onClick={() => onChange(randomAvatar())}><Icon name="dice" size={18} /></button>
    </div>
  );
}
