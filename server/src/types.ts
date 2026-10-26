export type WordMode = 'normal' | 'hidden';
export interface RoomSettings {
  maxPlayers: number; rounds: number; drawTime: number;
  isPublic: boolean;       // listed in "Browse public rooms" while in the lobby
  wordMode: WordMode;      // hidden = guessers get no blanks/length/hints
  categories: string[];    // word categories in play
  customOnly: boolean;     // use only the host's custom words
  wordCount: number;       // how many words the drawer chooses from (1-5)
  hints: number;           // letters revealed over the turn (0-5); 0 = no hints. Ignored in hidden mode
}
/** `id` is public (broadcast to everyone). `token` is the secret reconnect credential and must NEVER be sent to clients. */
export interface Player { id: string; token: string; name: string; avatar: string; socketId: string | null; ready: boolean; score: number; }
export type Phase = 'lobby' | 'playing' | 'ended';
export type TurnPhase = 'choosing' | 'drawing' | 'turn_end' | 'game_over';
/** Public game state. The secret word must NEVER be stored here (only a masked hint; the word is revealed at turn_end). */
export interface GameView {
  round: number; totalRounds: number; turnPhase: TurnPhase; wordMode: WordMode; hint: string; endsAt: number | null;
  guessed: string[]; revealedWord: string | null; turnScores: Record<string, number> | null;
  likes: number; dislikes: number; voted: string[]; // reactions to the current drawing: counts + WHO has voted (never what they voted)
  leaderboard: { id: string; name: string; score: number }[] | null; winners: string[];
}
/** `customWords` and `banned` are server-only (see view.ts): custom words would hint at the secret word, bans are moderation data. */
export interface Room {
  code: string; hostId: string; settings: RoomSettings; phase: Phase; drawerId: string | null; players: Player[]; game: GameView | null;
  customWords: string[]; banned: Set<string>;
  museumCount?: number; // number of drawings available in the Doodle Museum (the drawings themselves are fetched with get_gallery after the game)
}
export interface Point { x: number; y: number } // normalized 0..1 so any screen size renders the same
/** A drawn line, or (fill: true) a paint-bucket fill at points[0]. Fills live in the same ordered list as lines so undo, clear, late-join and the museum all treat them the same. */
export interface Stroke { id: number; color: string; size: number; points: Point[]; fill?: boolean }
