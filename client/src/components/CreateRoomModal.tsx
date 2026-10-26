import { useEffect, useRef, useState } from 'react';
import { CATEGORIES, MIN_CUSTOM_ONLY, parseWords } from '../lib';
import { WordMode } from '../types';
import Icon from './Icon';
import RoomSettingsFields, { RoomSettingsData } from './RoomSettingsFields';

export interface NewRoomConfig {
  settings: {
    maxPlayers: number;
    rounds: number;
    drawTime: number;
    isPublic: boolean;
    wordMode: WordMode;
    categories: string[];
    customOnly: boolean;
    wordCount: number;
    hints: number;
  };
  customWords: string[];
}

interface Props {
  busy: boolean;
  error: string;
  onCreate: (cfg: NewRoomConfig) => void;
  onCancel: () => void;
}

export default function CreateRoomModal({ busy, error, onCreate, onCancel }: Props) {
  const [settings, setSettings] = useState<RoomSettingsData>({
    maxPlayers: 8,
    rounds: 3,
    drawTime: 80,
    wordCount: 3,
    hints: 2,
    wordMode: 'normal',
    isPublic: false,
    categories: CATEGORIES.map(c => c.id),
    customOnly: false,
  });
  const [text, setText] = useState('');
  const [local, setLocal] = useState('');

  const firstSliderRef = useRef<HTMLInputElement>(null);
  const cancelRef = useRef(onCancel);
  cancelRef.current = onCancel;

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    firstSliderRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') cancelRef.current();
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      previous?.focus?.();
    };
  }, []);

  const handleSettingChange = <K extends keyof RoomSettingsData>(key: K, value: RoomSettingsData[K]) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const submit = () => {
    const words = parseWords(text);
    if (settings.categories.length === 0 && !settings.customOnly) {
      setLocal('Pick at least one word pack.');
      return;
    }
    if (settings.customOnly && words.length < MIN_CUSTOM_ONLY) {
      setLocal(`Add at least ${MIN_CUSTOM_ONLY} custom words to play with only your words.`);
      return;
    }
    setLocal('');
    onCreate({
      settings: {
        maxPlayers: settings.maxPlayers,
        rounds: settings.rounds,
        drawTime: settings.drawTime,
        isPublic: settings.isPublic,
        wordMode: settings.wordMode,
        categories: settings.categories.length ? settings.categories : CATEGORIES.map(c => c.id),
        customOnly: settings.customOnly,
        wordCount: settings.wordCount,
        hints: settings.hints,
      },
      customWords: words,
    });
  };

  const shown = local || error;

  return (
    <div
      className="modal-backdrop"
      onMouseDown={e => {
        if (e.target === e.currentTarget && !busy) onCancel();
      }}
    >
      <div
        className="modal create-room-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cr-title"
      >
        {/* Top-right circular close button */}
        <button
          type="button"
          className="cr-close-btn"
          onClick={onCancel}
          disabled={busy}
          aria-label="Close dialog"
        >
          <Icon name="x" size={18} />
        </button>

        {/* Modal Header */}
        <div className="cr-header">
          <span className="cr-header-icon" aria-hidden="true">
            <Icon name="users" size={30} />
          </span>
          <div className="cr-header-text">
            <h2 id="cr-title">Create Room</h2>
            <p className="cr-subtitle">Set up your game and invite friends!</p>
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
        {shown && (
          <div className="error" role="alert" style={{ margin: '10px 0 4px' }}>
            {shown}
          </div>
        )}

        {/* Modal Actions */}
        <div className="cr-actions">
          <button
            type="button"
            className="cr-btn-cancel"
            onClick={onCancel}
            disabled={busy}
          >
            Cancel
          </button>
          <button
            type="button"
            className="cr-btn-submit"
            onClick={submit}
            disabled={busy}
          >
            {busy ? (
              <span className="spin" aria-label="Creating room" />
            ) : (
              <>
                <Icon name="plus" size={18} /> Create Room
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
