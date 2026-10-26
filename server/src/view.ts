import { Room } from './types.js';

/** The ONLY shape of a room that is ever sent to clients. Strips socket ids, secret tokens, custom words and the ban list; adds server time for countdown sync. */
export const toPublicRoom = (room: Room) => {
  const { customWords, banned, ...rest } = room;
  return {
    ...rest,
    customWordCount: customWords.length,
    players: room.players.map(({ socketId, token, ...p }) => ({ ...p, connected: socketId !== null })),
    game: room.game && { ...room.game, serverNow: Date.now() },
  };
};
