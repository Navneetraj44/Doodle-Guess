export type WordMode = 'normal' | 'hidden';
export interface RoomSettings { maxPlayers: number; rounds: number; drawTime: number; isPublic: boolean; wordMode: WordMode; categories: string[]; customOnly: boolean; wordCount: number; hints: number; }
export interface Player { id: string; name: string; avatar: string; connected: boolean; ready: boolean; score: number; }
export interface GameView {
  round: number; totalRounds: number; turnPhase: 'choosing' | 'drawing' | 'turn_end' | 'game_over'; wordMode: WordMode;
  hint: string; endsAt: number | null; serverNow: number; guessed: string[]; revealedWord: string | null;
  likes: number; dislikes: number; voted: string[];
  turnScores: Record<string, number> | null; leaderboard: { id: string; name: string; score: number }[] | null; winners: string[];
}
export interface Room { code: string; hostId: string; settings: RoomSettings; phase: 'lobby' | 'playing' | 'ended'; drawerId: string | null; players: Player[]; game: GameView | null; customWordCount: number; museumCount?: number; }
export type Ack = { ok: true; room?: Room } | { ok: false; error: string };
export interface PublicRoomInfo { code: string; hostName: string; hostAvatar: string; players: number; maxPlayers: number; rounds: number; drawTime: number; wordMode: string; }
export type ListAck = { ok: true; rooms: PublicRoomInfo[] } | { ok: false; error: string };
export interface Point { x: number; y: number }
export interface Stroke { id?: number; color: string; size: number; points: Point[]; fill?: boolean } // fill: a paint-bucket fill at points[0]
export interface ChatMessage { id: number; kind: 'chat' | 'system' | 'correct' | 'like' | 'dislike' | 'close'; playerId?: string; playerName?: string; text: string; restricted?: boolean }
export interface PrivateState { wordOptions: string[] | null; word: string | null }
export interface GalleryEntry { id: number; round: number; artistId: string; artistName: string; artistAvatar: string; word: string; strokes: Stroke[]; likes: number; dislikes: number; }
export type GalleryAck = { ok: true; gallery: GalleryEntry[] } | { ok: false; error: string };
