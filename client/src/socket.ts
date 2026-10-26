import { io } from 'socket.io-client';
import { Ack } from './types';

// Dev: the Vite dev server (5173) talks to the game server on 3001. Production: the server also serves this page, so use the same origin.
// Set VITE_SERVER_URL only when the client and server are hosted on different domains.
const SERVER_URL = import.meta.env.VITE_SERVER_URL || (import.meta.env.DEV ? 'http://localhost:3001' : window.location.origin);
export const socket = io(SERVER_URL, { autoConnect: true });

/** Secret per-tab reconnect token (never shown to other players; the server assigns a separate public id). */
export function getToken(): string {
  let t = sessionStorage.getItem('token');
  if (!t) { t = crypto.randomUUID(); sessionStorage.setItem('token', t); }
  return t;
}
/** Promise wrapper around Socket.IO acknowledgements, with a timeout. */
export function emit<T = Ack>(event: string, data?: unknown): Promise<T> {
  return new Promise(resolve => {
    const t = setTimeout(() => resolve({ ok: false, error: 'Server did not respond. Try again.' } as T), 8000);
    socket.emit(event, data, (res: T) => { clearTimeout(t); resolve(res); });
  });
}
