import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import CreateRoomModal from './components/CreateRoomModal';
import RoomSettingsModal from './components/RoomSettingsModal';
import { DRAW_TIMES, MAX_CUSTOM_WORDS, MIN_CUSTOM_ONLY, PACKS, parseWords } from './lib';
import { Room } from './types';

const mockRoom: Room = {
  code: 'TEST1',
  hostId: 'host-1',
  phase: 'lobby',
  drawerId: null,
  players: [
    { id: 'host-1', name: 'Alice', avatar: '0-0-0', connected: true, ready: true, score: 0 },
    { id: 'player-2', name: 'Bob', avatar: '1-1-1', connected: true, ready: true, score: 0 },
  ],
  game: null,
  customWordCount: 3,
  settings: {
    maxPlayers: 10,
    rounds: 4,
    drawTime: 60,
    wordCount: 4,
    hints: 3,
    wordMode: 'hidden',
    isPublic: true,
    categories: ['animals', 'food'],
    customOnly: false,
  },
};

describe('CreateRoomModal component rendering and defaults', () => {
  it('renders with all 5 single-line setting sliders with correct limits, labels, and badges', () => {
    const html = renderToStaticMarkup(
      React.createElement(CreateRoomModal, {
        busy: false,
        error: '',
        onCreate: vi.fn(),
        onCancel: vi.fn(),
      })
    );

    // Header & close button
    expect(html).toContain('Create Room');
    expect(html).toContain('Set up your game and invite friends!');
    expect(html).toContain('cr-close-btn');

    // Room visibility row
    expect(html).toContain('Room Visibility');
    expect(html).toContain('Private');
    expect(html).toContain('invite link only');
    expect(html).toContain('Public');
    expect(html).toContain('listed for everyone');

    // Word Mode & Word Categories above sliders
    expect(html).toContain('Word Mode');
    expect(html).toContain('value="normal"');
    expect(html).toContain('value="hidden"');
    expect(html).toContain('Word Categories');
    expect(html).toContain('Mixed (11)');

    // 5 Sliders & their initial labels and badges
    expect(html).toContain('Max Players');
    expect(html).toContain('min="2" max="20"');
    expect(html).toContain('cr-slider-val-badge">8</div>');

    expect(html).toContain('Rounds');
    expect(html).toContain('min="2" max="10"');
    expect(html).toContain('cr-slider-val-badge">3</div>');

    expect(html).toContain('Draw Time');
    expect(html).toContain(`max="${DRAW_TIMES.length - 1}"`);
    expect(html).toContain('cr-slider-val-badge">80 sec</div>');

    // Words to Choose From should be present and not truncated
    expect(html).toContain('Words to Choose From');
    expect(html).toContain('min="1" max="5"');
    expect(html).toContain('cr-slider-val-badge">3</div>');

    expect(html).toContain('Hints');
    expect(html).toContain('min="0" max="5"');
    expect(html).toContain('cr-slider-val-badge">2</div>');

    // Custom Words section collapsed initially
    expect(html).toContain('Custom Words (Optional)');
    expect(html).toContain('aria-expanded="false"');
    expect(html).not.toContain('cr-word-counter');

    // Action buttons
    expect(html).toContain('Cancel');
    expect(html).toContain('Create Room');
  });

  it('preserves word parsing and custom word limits', () => {
    const parsed = parseWords('pizza party\nour teacher, the canteen');
    expect(parsed).toEqual(['pizza party', 'our teacher', 'the canteen']);
    expect(MIN_CUSTOM_ONLY).toBe(3);
    expect(MAX_CUSTOM_WORDS).toBe(100);
    expect(PACKS.length).toBe(11);
  });
});

describe('RoomSettingsModal component rendering and lobby behavior', () => {
  it('renders with existing room settings without resetting to new-room defaults', () => {
    const html = renderToStaticMarkup(
      React.createElement(RoomSettingsModal, {
        room: mockRoom,
        hostWords: ['apple', 'banana', 'cherry'],
        act: vi.fn(),
        onError: vi.fn(),
        onClose: vi.fn(),
      })
    );

    // Header & close button
    expect(html).toContain('Room Settings');
    expect(html).toContain('Customize the game settings for this room');
    expect(html).toContain('cr-close-btn');

    // Preserved room values: Public, hidden wordMode, 10 players, 4 rounds, 60s drawTime, 4 words, 3 hints
    expect(html).toContain('cr-slider-val-badge">10</div>');
    expect(html).toContain('cr-slider-val-badge">4</div>');
    expect(html).toContain('cr-slider-val-badge">60 sec</div>');
    expect(html).toContain('cr-slider-val-badge">3</div>');
    expect(html).toContain('Mixed (2)'); // animals + food

    // Footer actions
    expect(html).toContain('Cancel');
    expect(html).toContain('Save Settings');
  });
});
