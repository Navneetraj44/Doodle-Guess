import { describe, it, expect } from 'vitest';
import { parseRoomCode, AVATAR_PARTS, cycleAvatar, formatAvatar, isValidAvatar, parseAvatar, randomAvatar } from './lib';

describe('parseRoomCode (invite links and typed codes)', () => {
  it('accepts a typed code in any case, with stray spaces or dashes', () => {
    expect(parseRoomCode('abc12')).toBe('ABC12'); expect(parseRoomCode('  ab-c 12 ')).toBe('ABC12');
  });
  it('reads the room from the page query string (what the app prefills from an invite link)', () => {
    expect(parseRoomCode('?room=k7p2m')).toBe('K7P2M'); expect(parseRoomCode('?foo=1&room=k7p2m&x=2')).toBe('K7P2M');
  });
  it('reads the room from a whole pasted invite link', () => {
    expect(parseRoomCode('https://doodle-guess.onrender.com/?room=K7P2M')).toBe('K7P2M');
    expect(parseRoomCode('http://localhost:5173/?room=k7p2m&utm=x')).toBe('K7P2M');
  });
  it('returns an empty string when there is no usable code', () => {
    expect(parseRoomCode('https://doodle-guess.onrender.com/')).toBe(''); expect(parseRoomCode('')).toBe(''); expect(parseRoomCode(null)).toBe(''); expect(parseRoomCode(undefined)).toBe('');
  });
  it('never returns more than 5 characters', () => { expect(parseRoomCode('ABCDEFGH')).toBe('ABCDE'); });
});
describe('cartoon avatars', () => {
  it('has 12 colours x 10 eyes x 10 mouths', () => { expect(AVATAR_PARTS.colors * AVATAR_PARTS.eyes * AVATAR_PARTS.mouths).toBe(1200); });
  it('parses, formats and validates codes (old emoji or junk are rejected)', () => {
    expect(parseAvatar('3-5-2')).toEqual({ color: 3, eyes: 5, mouth: 2 }); expect(formatAvatar({ color: 3, eyes: 5, mouth: 2 })).toBe('3-5-2');
    for (const bad of ['🐶', '12-0-0', '0-10-0', '0-0-10', '', 'a-b-c', null, undefined, 7]) expect(isValidAvatar(bad)).toBe(false);
    expect(isValidAvatar(randomAvatar())).toBe(true); expect(randomAvatar(() => 0.999999)).toBe('11-9-9');
  });
  it('the arrows step one part at a time and wrap around', () => {
    expect(cycleAvatar('0-0-0', 'eyes', 1)).toBe('0-1-0'); expect(cycleAvatar('0-0-0', 'eyes', -1)).toBe('0-9-0');
    expect(cycleAvatar('11-3-3', 'color', 1)).toBe('0-3-3'); expect(cycleAvatar('5-3-9', 'mouth', 1)).toBe('5-3-0');
    expect(isValidAvatar(cycleAvatar('🐶', 'color', 1))).toBe(true);
  });
});
