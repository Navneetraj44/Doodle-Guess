/**
 * Skribbl-style cartoon avatars. An avatar is a small code "color-eyes-mouth" (for example "3-5-2"); the browser draws the face from it
 * (client/src/components/Avatar.tsx). Keep the part counts in sync with client/src/lib.ts. The server only ever stores a code that passed
 * validation, so arbitrary text/markup can never end up in a player's avatar.
 */
export const AVATAR_PARTS = { colors: 12, eyes: 10, mouths: 10 } as const;

const part = (n: number, max: number) => Number.isInteger(n) && n >= 0 && n < max;
export function isValidAvatar(a: unknown): a is string {
  if (typeof a !== 'string' || !/^\d{1,2}-\d{1,2}-\d{1,2}$/.test(a)) return false;
  const [c, e, m] = a.split('-').map(Number);
  return part(c, AVATAR_PARTS.colors) && part(e, AVATAR_PARTS.eyes) && part(m, AVATAR_PARTS.mouths);
}
export function randomAvatar(rng: () => number = Math.random): string {
  const pick = (max: number) => Math.min(max - 1, Math.floor(rng() * max));
  return `${pick(AVATAR_PARTS.colors)}-${pick(AVATAR_PARTS.eyes)}-${pick(AVATAR_PARTS.mouths)}`;
}
/** Only valid avatar codes are accepted; anything else (an old emoji, junk, markup) falls back to a random one. */
export function sanitizeAvatar(a: unknown, rng: () => number = Math.random): string {
  return isValidAvatar(a) ? a : randomAvatar(rng);
}
