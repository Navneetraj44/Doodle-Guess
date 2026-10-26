import { useEffect, useRef } from 'react';
import { Room } from '../types';
import HostSettings from './HostSettings';
import Icon from './Icon';

interface Props { room: Room; hostWords: string[]; act: (event: string, data?: object) => Promise<boolean>; onError: (message: string) => void; onClose: () => void; }

/** Host-only dialog for editing room settings after creation. It reuses HostSettings, so every change still goes through the server's `update_settings` event (re-validated and host-checked there). */
export default function RoomSettingsModal({ room, hostWords, act, onError, onClose }: Props) {
  const closeRef = useRef(onClose); closeRef.current = onClose;
  const doneBtn = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null; doneBtn.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); closeRef.current(); } };
    document.addEventListener('keydown', onKey, true);
    return () => { document.removeEventListener('keydown', onKey, true); previous?.focus?.(); };
  }, []);
  return (
    <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal wide" role="dialog" aria-modal="true" aria-labelledby="rs-title">
        <h2 id="rs-title"><Icon name="pencil" size={24} /> Room settings</h2>
        <HostSettings room={room} hostWords={hostWords} act={act} onError={onError} />
        <div className="modal-actions"><button type="button" className="go" ref={doneBtn} onClick={onClose}>Done</button></div>
      </div>
    </div>
  );
}
