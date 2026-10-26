/** User-facing, one-time notice after the server removes this browser from a room. */
export const REMOVAL_NOTICE_MS = 8000;

export function removalMessage(banned: boolean) {
  return banned ? 'You are banned from this room.' : 'You were removed from the room.';
}
