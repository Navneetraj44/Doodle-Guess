import { useEffect, useRef, useState } from 'react';
import {
  DRAW_TIMES,
  MAX_CUSTOM_WORDS,
  MIN_CUSTOM_ONLY,
  PACKS,
  parseWords,
} from '../lib';
import { WordMode } from '../types';
import Icon, { IconName } from './Icon';

export interface RoomSettingsData {
  maxPlayers: number;
  rounds: number;
  drawTime: number;
  wordCount: number;
  hints: number;
  wordMode: WordMode;
  isPublic: boolean;
  categories: string[];
  customOnly: boolean;
}

interface Props {
  settings: RoomSettingsData;
  customWordsText: string;
  onSettingChange: <K extends keyof RoomSettingsData>(key: K, value: RoomSettingsData[K]) => void;
  onCustomWordsChange: (text: string) => void;
  firstSliderRef?: React.RefObject<HTMLInputElement>;
  disabled?: boolean;
}

const getTrackBackground = (pct: number) =>
  `linear-gradient(to right, var(--pink) 0%, var(--pink) ${pct}%, #5A5148 ${pct}%, #5A5148 100%)`;

export default function RoomSettingsFields({
  settings,
  customWordsText,
  onSettingChange,
  onCustomWordsChange,
  firstSliderRef,
  disabled = false,
}: Props) {
  const [wordPackOpen, setWordPackOpen] = useState(false);
  const [customWordsOpen, setCustomWordsOpen] = useState(false);
  const wpDropdownRef = useRef<HTMLDivElement>(null);

  // Close Word Categories popover when clicking outside
  useEffect(() => {
    if (!wordPackOpen) return;
    const onClickOutside = (e: MouseEvent) => {
      if (wpDropdownRef.current && !wpDropdownRef.current.contains(e.target as Node)) {
        setWordPackOpen(false);
      }
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [wordPackOpen]);

  const words = parseWords(customWordsText);

  const toggleCategory = (id: string) => {
    const next = settings.categories.includes(id)
      ? settings.categories.filter(x => x !== id)
      : [...settings.categories, id];
    onSettingChange('categories', next);
  };

  const selectAllPacks = () => onSettingChange('categories', PACKS.map(p => p.id));
  const clearAllPacks = () => onSettingChange('categories', []);

  // Draw time slider mapping
  const drawTimeIndex = Math.max(0, DRAW_TIMES.indexOf(settings.drawTime));
  const drawTimePct = (drawTimeIndex / (DRAW_TIMES.length - 1)) * 100;

  // Linear slider percentages
  const maxPlayersPct = ((settings.maxPlayers - 2) / (20 - 2)) * 100;
  const roundsPct = ((settings.rounds - 2) / (10 - 2)) * 100;
  const wordCountPct = ((settings.wordCount - 1) / (5 - 1)) * 100;
  const hintsPct = (settings.hints / 5) * 100;

  // Word Categories summary label
  let wordPackLabel = 'Mixed';
  if (settings.categories.length === 0) {
    wordPackLabel = 'None';
  } else if (settings.categories.length === 1) {
    wordPackLabel = PACKS.find(p => p.id === settings.categories[0])?.label ?? '1 Selected';
  } else if (settings.categories.length === PACKS.length) {
    wordPackLabel = `Mixed (${PACKS.length})`;
  } else {
    wordPackLabel = `Mixed (${settings.categories.length})`;
  }

  return (
    <div className="cr-settings-fields">
      {/* 1. Room Visibility */}
      <div className="cr-visibility-row">
        <span className="cr-visibility-label">Room Visibility</span>
        <div className="cr-visibility-seg" role="radiogroup" aria-label="Room visibility">
          <button
            type="button"
            role="radio"
            aria-checked={!settings.isPublic}
            className={`cr-vis-btn ${!settings.isPublic ? 'on' : ''}`}
            onClick={() => onSettingChange('isPublic', false)}
            disabled={disabled}
          >
            <span className="cr-vis-icon"><Icon name="lock" size={18} /></span>
            <div className="cr-vis-btn-text">
              <span className="cr-vis-title">Private</span>
              <small className="cr-vis-sub">invite link only</small>
            </div>
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={settings.isPublic}
            className={`cr-vis-btn ${settings.isPublic ? 'on' : ''}`}
            onClick={() => onSettingChange('isPublic', true)}
            disabled={disabled}
          >
            <span className="cr-vis-icon"><Icon name="globe" size={18} /></span>
            <div className="cr-vis-btn-text">
              <span className="cr-vis-title">Public</span>
              <small className="cr-vis-sub">listed for everyone</small>
            </div>
          </button>
        </div>
      </div>

      {/* 2. Word Mode and Word Categories */}
      <div className="cr-dropdowns-row">
        {/* Word Mode */}
        <div className="cr-card-block">
          <label htmlFor="cr-word-mode-select" className="cr-card-title">
            <Icon name="bolt" size={18} /> Word Mode
          </label>
          <div className="cr-select-wrapper">
            <select
              id="cr-word-mode-select"
              className="cr-select-control"
              value={settings.wordMode}
              onChange={e => onSettingChange('wordMode', e.target.value as WordMode)}
              disabled={disabled}
              aria-label="Word Mode"
            >
              <option value="normal">Normal</option>
              <option value="hidden">Hidden</option>
            </select>
            <span className="cr-select-arrow" aria-hidden="true">
              <Icon name="chevronDown" size={16} />
            </span>
          </div>
        </div>

        {/* Word Categories */}
        <div className="cr-card-block" ref={wpDropdownRef}>
          <span id="cr-word-pack-label" className="cr-card-title">
            <Icon name="film" size={18} /> Word Categories
          </span>
          <button
            type="button"
            className="cr-dropdown-trigger"
            onClick={() => setWordPackOpen(o => !o)}
            aria-haspopup="listbox"
            aria-expanded={wordPackOpen}
            aria-labelledby="cr-word-pack-label"
            disabled={disabled}
          >
            <span className="cr-dropdown-trigger-text">{wordPackLabel}</span>
            <Icon name={wordPackOpen ? 'chevronUp' : 'chevronDown'} size={16} />
          </button>

          {/* Word Categories Dropdown Menu (Scrollable: 4 visible at once) */}
          {wordPackOpen && (
            <div
              className="cr-wp-popover"
              role="listbox"
              aria-multiselectable="true"
              aria-label="Word Categories"
            >
              <div className="cr-wp-popover-header">
                <span>{settings.categories.length} of {PACKS.length} selected</span>
                <div className="cr-wp-quick-actions">
                  <button type="button" onClick={selectAllPacks}>All</button>
                  <button type="button" onClick={clearAllPacks}>Clear</button>
                </div>
              </div>
              <div className="cr-wp-list">
                {PACKS.map(p => {
                  const isSelected = settings.categories.includes(p.id);
                  return (
                    <button
                      key={p.id}
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      className={`cr-wp-item ${isSelected ? 'on' : ''}`}
                      onClick={() => toggleCategory(p.id)}
                    >
                      <span className="cr-wp-item-icon">
                        <Icon name={p.icon} size={18} />
                      </span>
                      <span className="cr-wp-item-label">{p.label}</span>
                      <span className={`cr-wp-item-check ${isSelected ? 'checked' : ''}`} aria-hidden="true">
                        {isSelected && <Icon name="check" size={14} />}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 3. Game Settings Sliders (Single-line horizontal rows) */}
      <div className="cr-sliders-group">
        {/* Max Players */}
        <div className="cr-slider-row">
          <div className="cr-slider-left">
            <span className="cr-slider-icon" aria-hidden="true">
              <Icon name="users" size={20} />
            </span>
            <span className="cr-slider-label">Max Players</span>
          </div>
          <div className="cr-slider-middle">
            <span className="cr-endpoint min" aria-hidden="true">2</span>
            <input
              ref={firstSliderRef}
              type="range"
              className="cr-range-slider"
              min={2}
              max={20}
              step={1}
              value={settings.maxPlayers}
              style={{ background: getTrackBackground(maxPlayersPct) }}
              onChange={e => onSettingChange('maxPlayers', Number(e.target.value))}
              disabled={disabled}
              aria-label="Max Players"
              aria-valuemin={2}
              aria-valuemax={20}
              aria-valuenow={settings.maxPlayers}
            />
            <span className="cr-endpoint max" aria-hidden="true">20</span>
          </div>
          <div className="cr-slider-val-badge">{settings.maxPlayers}</div>
        </div>

        {/* Rounds */}
        <div className="cr-slider-row">
          <div className="cr-slider-left">
            <span className="cr-slider-icon" aria-hidden="true">
              <Icon name="flag" size={20} />
            </span>
            <span className="cr-slider-label">Rounds</span>
          </div>
          <div className="cr-slider-middle">
            <span className="cr-endpoint min" aria-hidden="true">2</span>
            <input
              type="range"
              className="cr-range-slider"
              min={2}
              max={10}
              step={1}
              value={settings.rounds}
              style={{ background: getTrackBackground(roundsPct) }}
              onChange={e => onSettingChange('rounds', Number(e.target.value))}
              disabled={disabled}
              aria-label="Rounds"
              aria-valuemin={2}
              aria-valuemax={10}
              aria-valuenow={settings.rounds}
            />
            <span className="cr-endpoint max" aria-hidden="true">10</span>
          </div>
          <div className="cr-slider-val-badge">{settings.rounds}</div>
        </div>

        {/* Draw Time */}
        <div className="cr-slider-row">
          <div className="cr-slider-left">
            <span className="cr-slider-icon" aria-hidden="true">
              <Icon name="clock" size={20} />
            </span>
            <span className="cr-slider-label">Draw Time</span>
          </div>
          <div className="cr-slider-middle">
            <span className="cr-endpoint min" aria-hidden="true">15</span>
            <input
              type="range"
              className="cr-range-slider"
              min={0}
              max={DRAW_TIMES.length - 1}
              step={1}
              value={drawTimeIndex}
              style={{ background: getTrackBackground(drawTimePct) }}
              onChange={e => onSettingChange('drawTime', DRAW_TIMES[Number(e.target.value)])}
              disabled={disabled}
              aria-label="Draw Time"
              aria-valuemin={15}
              aria-valuemax={240}
              aria-valuenow={settings.drawTime}
              aria-valuetext={`${settings.drawTime} seconds`}
            />
            <span className="cr-endpoint max" aria-hidden="true">240</span>
          </div>
          <div className="cr-slider-val-badge">{settings.drawTime} sec</div>
        </div>

        {/* Words to Choose From */}
        <div className="cr-slider-row">
          <div className="cr-slider-left">
            <span className="cr-slider-icon" aria-hidden="true">
              <Icon name="fileText" size={20} />
            </span>
            <span className="cr-slider-label">Words to Choose From</span>
          </div>
          <div className="cr-slider-middle">
            <span className="cr-endpoint min" aria-hidden="true">1</span>
            <input
              type="range"
              className="cr-range-slider"
              min={1}
              max={5}
              step={1}
              value={settings.wordCount}
              style={{ background: getTrackBackground(wordCountPct) }}
              onChange={e => onSettingChange('wordCount', Number(e.target.value))}
              disabled={disabled}
              aria-label="Words to Choose From"
              aria-valuemin={1}
              aria-valuemax={5}
              aria-valuenow={settings.wordCount}
            />
            <span className="cr-endpoint max" aria-hidden="true">5</span>
          </div>
          <div className="cr-slider-val-badge">{settings.wordCount}</div>
        </div>

        {/* Hints */}
        <div className="cr-slider-row">
          <div className="cr-slider-left">
            <span className="cr-slider-icon" aria-hidden="true">
              <Icon name="bulb" size={20} />
            </span>
            <span className="cr-slider-label">Hints</span>
          </div>
          <div className="cr-slider-middle">
            <span className="cr-endpoint min" aria-hidden="true">0</span>
            <input
              type="range"
              className="cr-range-slider"
              min={0}
              max={5}
              step={1}
              value={settings.hints}
              style={{ background: getTrackBackground(hintsPct) }}
              onChange={e => onSettingChange('hints', Number(e.target.value))}
              disabled={disabled}
              aria-label="Hints"
              aria-valuemin={0}
              aria-valuemax={5}
              aria-valuenow={settings.hints}
            />
            <span className="cr-endpoint max" aria-hidden="true">5</span>
          </div>
          <div className="cr-slider-val-badge">{settings.hints}</div>
        </div>
      </div>

      {/* 4. Custom Words (Collapsible Section) */}
      <div className={`cr-custom-card ${customWordsOpen ? 'open' : ''}`}>
        <button
          type="button"
          className="cr-custom-header"
          onClick={() => setCustomWordsOpen(o => !o)}
          aria-expanded={customWordsOpen}
          aria-controls="cr-custom-body"
          disabled={disabled}
        >
          <span className="cr-custom-title">
            <Icon name="leaf" size={20} /> Custom Words (Optional)
          </span>
          <span className={`cr-chevron ${customWordsOpen ? 'rotated' : ''}`} aria-hidden="true">
            <Icon name="chevronDown" size={18} />
          </span>
        </button>

        {customWordsOpen && (
          <div id="cr-custom-body" className="cr-custom-body">
            <div className="cr-textarea-wrap">
              <textarea
                value={customWordsText}
                rows={3}
                onChange={e => onCustomWordsChange(e.target.value)}
                placeholder={'Enter words (one per line)\npizza party\nour teacher\nthe canteen'}
                aria-label="Custom words list"
                disabled={disabled}
              />
              <span className="cr-word-counter">{words.length}/{MAX_CUSTOM_WORDS}</span>
            </div>
            <label className="check">
              <input
                type="checkbox"
                checked={settings.customOnly}
                onChange={e => onSettingChange('customOnly', e.target.checked)}
                disabled={disabled}
              />{' '}
              Only use my words <small className="muted-dark">(needs {MIN_CUSTOM_ONLY}+)</small>
            </label>
          </div>
        )}
      </div>
    </div>
  );
}
