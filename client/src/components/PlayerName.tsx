import { ReactNode } from 'react';
import Icon from './Icon';

/**
 * Single place that renders a player's identity. The name is always the exact stored `name`;
 * "(you)" and the Host badge are presentation-only siblings, never part of the name string.
 */
export default function PlayerName({ name, isMe = false, isHost = false, children }: { name: string; isMe?: boolean; isHost?: boolean; children?: ReactNode }) {
  return (
    <span className="pname">
      <span className="pname-text" title={name}>{name}</span>
      {isMe && <span className="you-tag">(you)</span>}
      {children}
      {isHost && <span className="badge-host" title="Room host"><Icon name="crown" size={12} /> Host</span>}
    </span>
  );
}
