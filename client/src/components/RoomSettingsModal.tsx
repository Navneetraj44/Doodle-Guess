import { useEffect, useRef, useState } from 'react';
import { CATEGORIES, MIN_CUSTOM_ONLY, parseWords } from '../lib';
import { Room } from '../types';
import Icon from './Icon';
import RoomSettingsFields, { RoomSettingsData } from './RoomSettingsFields';

interface Props {
  room: Room;
  hostWords: string[];
  act: (event: string, data?: object) => Promise<boolean>;
  onError: (message: string) => void;
  onClose: () => void;
}

export default function RoomSettingsModal({ room, hostWords, act, onError, onClose }: Props) {
  const s = room.settings;
  const [settings, setSettings] = useState<RoomSettingsData>({
    maxPlayers: s.maxPlayers,
    rounds: s.rounds,
    drawTime: s.drawTime,
    wordCount: s.wordCount ?? 3,
    hints: s.hints ?? 2,
    wordMode: s.wordMode,
    isPublic: s.isPublic,
    categories: [...s.categories],
    customOnly: s.customOnly,
  });
  const [text, setText] = useState(hostWords.join('\n'));
  const [busy, setBusy] = useState(false);
  const [local, setLocal] = useState('');

  const firstSliderRef = useRef<HTMLInputElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    firstSliderRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        closeRef.current();
      }
    };
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('keydown', onKey, true);
      previous?.focus?.();
    };
  }, []);

  const handleSettingChange = <K extends keyof RoomSettingsData>(key: K, value: RoomSettingsData[K]) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    const words = parseWords(text);
    if (settings.categories.length === 0 && !settings.customOnly) {
      setLocal('Pick at least one word pack.');
      return;
    }
    if (settings.customOnly && words.length < MIN_CUSTOM_ONLY) {
      setLocal(`Add at least ${MIN_CUSTOM_ONLY} custom words to play with only your words.`);
      return;
    }
    if (settings.maxPlayers < room.players.length) {
      setLocal(`Max players cannot be below the current player count (${room.players.length}).`);
      return;
    }
    setLocal('');
    setBusy(true);
    const ok = await act('update_settings', {
      maxPlayers: settings.maxPlayers,
      rounds: settings.rounds,
      drawTime: settings.drawTime,
      isPublic: settings.isPublic,
      wordMode: settings.wordMode,
      categories: settings.categories.length ? settings.categories : CATEGORIES.map(c => c.id),
      customOnly: settings.customOnly,
      wordCount: settings.wordCount,
      hints: settings.hints,
      customWords: words,
    });
    setBusy(false);
    if (ok) {
      onClose();
    }
  };

  return (
    <div
      className="modal-backdrop"
      onMouseDown={e => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <div
        className="modal create-room-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="rs-title"
      >
        {/* Top-right circular close button */}
        <button
          type="button"
          className="cr-close-btn"
          onClick={onClose}
          disabled={busy}
          aria-label="Close dialog"
        >
          <Icon name="x" size={18} />
        </button>

        {/* Modal Header */}
        <div className="cr-header">
          <span className="cr-header-icon" aria-hidden="true">
            <Icon name="pencil" size={30} />
          </span>
          <div className="cr-header-text">
            <h2 id="rs-title">Room Settings</h2>
            <p className="cr-subtitle">Customize the game settings for this room</p>
          </div>
        </div>

        {/* Shared settings controls */}
        <RoomSettingsFields
          settings={settings}
          customWordsText={text}
          onSettingChange={handleSettingChange}
          onCustomWordsChange={setText}
          firstSliderRef={firstSliderRef}
          disabled={busy}
        />

        {/* Error notification */}
        {local && (
          <div className="error" role="alert" style={{ margin: '10px 0 4px' }}>
            {local}
          </div>
        )}

        {/* Modal Actions */}
        <div className="cr-actions">
          <button
            type="button"
            className="cr-btn-cancel"
            onClick={onClose}
            disabled={busy}
          >
            Cancel
          </button>
          <button
            type="button"
            className="cr-btn-submit"
            onClick={handleSave}
            disabled={busy}
          >
            {busy ? (
              <span className="spin" aria-label="Saving settings" />
            ) : (
              <>
                <Icon name="check" size={18} /> Save Settings
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
