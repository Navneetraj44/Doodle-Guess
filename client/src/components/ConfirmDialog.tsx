import { ReactNode, useEffect, useRef } from 'react';

interface Props {
  title: string; children?: ReactNode; confirmLabel: string; cancelLabel?: string;
  dialogClass?: string; closeLabel?: string; busy?: boolean; onConfirm: () => void; onCancel: () => void;
}

/** Small accessible modal: Esc / backdrop = cancel, focus starts on the safe (cancel) button, Tab stays inside, focus returns afterwards. */
export default function ConfirmDialog({ title, children, confirmLabel, cancelLabel = 'Stay in game', dialogClass = '', closeLabel, busy, onConfirm, onCancel }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const cancelBtn = useRef<HTMLButtonElement>(null);
  const cancelRef = useRef(onCancel); cancelRef.current = onCancel;

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    cancelBtn.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopPropagation(); cancelRef.current(); return; }
      if (e.key !== 'Tab' || !box.current) return;
      const f = Array.from(box.current.querySelectorAll<HTMLElement>('button:not(:disabled)'));
      if (!f.length) return;
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKey, true);
    return () => { document.removeEventListener('keydown', onKey, true); previous?.focus?.(); };
  }, []);

  return (
    <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget && !busy) onCancel(); }}>
      <div className={`modal ${dialogClass}`} role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" aria-describedby={children ? 'confirm-body' : undefined} ref={box}>
        {closeLabel && <button type="button" className="modal-close" onClick={onCancel} disabled={busy} aria-label={closeLabel}>×</button>}
        <h2 id="confirm-title">{title}</h2>
        {children && <div id="confirm-body" className="modal-body">{children}</div>}
        <div className="modal-actions">
          <button className="secondary" ref={cancelBtn} onClick={onCancel} disabled={busy}>{cancelLabel}</button>
          <button className="danger" onClick={onConfirm} disabled={busy}>{busy ? 'Leaving…' : confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}
