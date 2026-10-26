// Keep AVATAR_PARTS and the CATEGORY ids in sync with server/src/avatars.ts and server/src/words.ts (the server validates both).
/** Cartoon avatars: a code "color-eyes-mouth" such as "3-5-2". The face itself is drawn by components/Avatar.tsx. */
export const AVATAR_PARTS = { colors: 12, eyes: 10, mouths: 10 } as const;
export type AvatarPart = 'color' | 'eyes' | 'mouth';
export interface AvatarSpec { color: number; eyes: number; mouth: number }
export function parseAvatar(code: unknown): AvatarSpec | null {
  if (typeof code !== 'string' || !/^\d{1,2}-\d{1,2}-\d{1,2}$/.test(code)) return null;
  const [color, eyes, mouth] = code.split('-').map(Number);
  return color < AVATAR_PARTS.colors && eyes < AVATAR_PARTS.eyes && mouth < AVATAR_PARTS.mouths ? { color, eyes, mouth } : null;
}
export const formatAvatar = (a: AvatarSpec) => `${a.color}-${a.eyes}-${a.mouth}`;
export const isValidAvatar = (code: unknown): code is string => parseAvatar(code) !== null;
export function randomAvatar(rng: () => number = Math.random): string {
  const pick = (max: number) => Math.min(max - 1, Math.floor(rng() * max));
  return formatAvatar({ color: pick(AVATAR_PARTS.colors), eyes: pick(AVATAR_PARTS.eyes), mouth: pick(AVATAR_PARTS.mouths) });
}
/** Steps one part of an avatar forwards (+1) or backwards (-1), wrapping around. An invalid code starts from a fresh random avatar. */
export function cycleAvatar(code: string, part: AvatarPart, dir: 1 | -1): string {
  const a = parseAvatar(code) ?? parseAvatar(randomAvatar())!;
  const max = part === 'color' ? AVATAR_PARTS.colors : part === 'eyes' ? AVATAR_PARTS.eyes : AVATAR_PARTS.mouths;
  return formatAvatar({ ...a, [part]: (a[part] + dir + max) % max });
}
import type { IconName } from './components/Icon';
/** Themed word packs. `id` must match the server's word lists (server/src/words.ts); `blurb` is just flavour text. */
export const PACKS: { id: string; label: string; blurb: string; icon: IconName }[] = [
  { id: 'animals', label: 'Animals', blurb: 'Wild, wet and fluffy', icon: 'paw' },
  { id: 'food', label: 'Food', blurb: 'Snacks, meals, sweets', icon: 'slice' },
  { id: 'movies', label: 'Movies & Pop', blurb: 'Heroes, monsters, magic', icon: 'film' },
  { id: 'tech', label: 'Tech & Coding', blurb: 'Gadgets and the internet', icon: 'chip' },
  { id: 'indian', label: 'Indian Culture', blurb: 'Festivals, food, music', icon: 'lotus' },
  { id: 'sports', label: 'Sports', blurb: 'Games and gear', icon: 'ball' },
  { id: 'objects', label: 'Everyday Objects', blurb: 'Stuff around the house', icon: 'bulb' },
  { id: 'actions', label: 'Actions', blurb: 'Things people do', icon: 'bolt' },
  { id: 'places', label: 'Places', blurb: 'Buildings and landmarks', icon: 'pin' },
  { id: 'nature', label: 'Nature', blurb: 'Weather, plants, sky', icon: 'leaf' },
  { id: 'transport', label: 'Transport', blurb: 'Things that go', icon: 'wheel' },
];
export const CATEGORIES: { id: string; label: string }[] = PACKS.map(({ id, label }) => ({ id, label }));
/**
 * Turns whatever the user typed or pasted into a room code: "abc12", "?room=abc12", or a whole invite link.
 * Returns '' when nothing usable is found (e.g. a link without ?room=).
 */
export function parseRoomCode(input: string | null | undefined): string {
  const s = (input ?? '').trim();
  const m = s.match(/[?&]room=([A-Za-z0-9]+)/i);
  if (!m && /[/:]/.test(s)) return ''; // a URL with no room parameter
  return (m ? m[1] : s).replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 5);
}
export const MODE_LABEL: Record<string, string> = { normal: 'Normal', hidden: 'Hidden word' };
export const MIN_CUSTOM_ONLY = 3; // keep in sync with server/src/words.ts
export const WORD_COUNTS = [1, 2, 3, 4, 5]; export const HINT_COUNTS = [0, 1, 2, 3, 4, 5];
export const DRAW_TIMES = [15, 30, 45, 60, 80, 90, 120, 150, 180, 240];
/** Parses the custom-word textarea (one per line or comma-separated). */
export const parseWords = (text: string): string[] => text.split(/[\n,]/).map(w => w.trim()).filter(Boolean);
