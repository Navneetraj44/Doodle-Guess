import { GameView, Player, Room, Stroke } from './types.js';
import { GalleryEntry, MAX_GALLERY, compactStrokes } from './gallery.js';
import { GameError } from './RoomManager.js';
import { buildPool, pickFromPool } from './words.js';
import { isCloseGuess } from './closeGuess.js';

export interface PrivateState { wordOptions: string[] | null; word: string | null }
/** like / dislike are the "X liked the drawing!" notices; close is the PRIVATE "Your guess is close!" notice (only ever sent to the guesser). */
export interface OutMessage { kind: 'chat' | 'system' | 'correct' | 'like' | 'dislike' | 'close'; playerId?: string; playerName?: string; text: string; restricted?: boolean }
export interface GameDeps {
  onChange(): void;                                              // broadcast public room state
  sendPrivate(playerId: string, s: PrivateState): void;          // word options / secret word, one player only
  sendMessage(m: OutMessage, recipients: string[] | null): void; // null = everyone in the room
  resetCanvas(): void;
  snapshotCanvas?: () => Stroke[];                               // the drawer's strokes at the end of a turn (for the Doodle Museum)
  pickWords?: (n: number) => string[];
  random?: () => number;
}

export const CHOOSE_MS = 15_000, TURN_END_MS = 5_000, GRACE_MS = 8_000;
const ORDER_BONUS = [50, 30, 15];   // 1st, 2nd, 3rd correct guesser
const DRAWER_PER_GUESS = 30;
const isLetter = (c: string) => /[\p{L}\p{N}]/u.test(c); // letters in any language (custom words may use them)

export const normalizeGuess = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');
export const maskWord = (word: string, revealed: Set<number>) =>
  word.split('').map((c, i) => (isLetter(c) ? (revealed.has(i) ? c : '_') : c)).join(' ');

/** Server-authoritative game engine for ONE room. Holds the secret word privately. */
export class Game {
  private secret: string | null = null;
  private options: string[] = [];
  private guessed = new Set<string>();
  private queue: string[] = [];
  private revealed = new Set<number>();
  private turnScores: Record<string, number> = {};
  private votes = new Map<string, 'like' | 'dislike'>(); // reactions for the current turn (one per player)
  private timers: ReturnType<typeof setTimeout>[] = [];       // turn-scoped
  private graceTimers: ReturnType<typeof setTimeout>[] = [];  // disconnect checks
  private disconnectedAt = new Map<string, number>();
  private rng: () => number;
  private used = new Set<string>();   // words already played in this game (no repeats until the pool runs dry)
  private pool: string[] = [];
  private gallery: GalleryEntry[] = [];                  // one entry per finished drawing; SERVER-ONLY until the game is over
  private currentEntry: GalleryEntry | null = null;
  private drawer: { id: string; name: string; avatar: string } | null = null;

  constructor(private room: Room, private deps: GameDeps) { this.rng = deps.random ?? Math.random; }

  private get g(): GameView { return this.room.game!; }
  private player(id: string | null) { return this.room.players.find(p => p.id === id); }
  /** Timer callbacks run outside any socket handler, so an exception here would crash the whole server. Catch it. */
  private safe(fn: () => void) { return () => { try { fn(); } catch (e) { console.error('Game timer error', e); } }; }
  private later(fn: () => void, ms: number) { this.timers.push(setTimeout(this.safe(fn), ms)); }
  private clearTimers() { this.timers.forEach(clearTimeout); this.timers = []; }
  private isPresent(p: Player) {
    if (p.socketId !== null) return true;
    const t = this.disconnectedAt.get(p.id);
    return t !== undefined && Date.now() - t < GRACE_MS;
  }
  private eligibleGuessers() { return this.room.players.filter(p => p.id !== this.room.drawerId && this.isPresent(p)); }

  start() {
    this.room.phase = 'playing';
    this.room.players.forEach(p => (p.score = 0));
    this.pool = buildPool(this.room.settings.categories, this.room.customWords, this.room.settings.customOnly); this.used.clear();
    this.gallery = []; this.currentEntry = null; this.room.museumCount = 0;
    this.room.game = { round: 0, totalRounds: this.room.settings.rounds, turnPhase: 'choosing', wordMode: this.room.settings.wordMode, hint: '', endsAt: null, guessed: [], revealedWord: null, turnScores: null, likes: 0, dislikes: 0, voted: [], leaderboard: null, winners: [] };
    this.nextTurn();
  }
  destroy() { this.clearTimers(); this.graceTimers.forEach(clearTimeout); this.graceTimers = []; this.secret = null; }

  // ---- turn lifecycle -------------------------------------------------------------------
  private nextTurn() {
    this.clearTimers();
    for (;;) {
      if (this.queue.length === 0) {
        if (this.g.round >= this.g.totalRounds) return this.endGame();
        this.g.round++;
        this.queue = this.room.players.filter(p => this.isPresent(p)).map(p => p.id); // join order = turn order
      }
      const p = this.player(this.queue.shift()!);
      if (p && this.isPresent(p)) return this.startTurn(p);
    }
  }

  private startTurn(drawer: Player) {
    if (this.room.players.filter(p => this.isPresent(p)).length < 2) return this.endGame();
    const g = this.g;
    this.secret = null; this.guessed.clear(); this.revealed.clear(); this.turnScores = {}; this.votes.clear();
    const n = this.room.settings.wordCount ?? 3;
    this.options = this.deps.pickWords ? this.deps.pickWords(n) : pickFromPool(this.pool, this.used, n, this.rng);
    this.drawer = { id: drawer.id, name: drawer.name, avatar: drawer.avatar }; this.currentEntry = null;
    Object.assign(g, { turnPhase: 'choosing', hint: '', guessed: [], revealedWord: null, turnScores: null, likes: 0, dislikes: 0, voted: [], endsAt: Date.now() + CHOOSE_MS });
    this.room.drawerId = drawer.id;
    this.deps.resetCanvas();
    for (const p of this.room.players) this.deps.sendPrivate(p.id, { wordOptions: p.id === drawer.id ? this.options : null, word: null });
    this.deps.sendMessage({ kind: 'system', text: `${drawer.name} is choosing a word…` }, null);
    this.later(() => this.beginDrawing(this.options[Math.floor(this.rng() * this.options.length)]), CHOOSE_MS);
    this.deps.onChange();
  }

  chooseWord(playerId: string, word: unknown) {
    if (this.g.turnPhase !== 'choosing') throw new GameError('You can not choose a word right now.');
    if (playerId !== this.room.drawerId) throw new GameError('Only the drawer can choose the word.');
    if (typeof word !== 'string' || !this.options.includes(word)) throw new GameError('Pick one of the offered words.');
    this.beginDrawing(word);
  }

  private beginDrawing(word: string) {
    if (this.g.turnPhase !== 'choosing') return; // guards double-transition (e.g. manual pick racing the auto-pick timer)
    this.clearTimers();
    const total = this.room.settings.drawTime * 1000;
    this.secret = word; this.used.add(word.toLowerCase());
    const hidden = this.room.settings.wordMode === 'hidden'; // hidden mode: no blanks, no length, no letter hints
    Object.assign(this.g, { turnPhase: 'drawing', endsAt: Date.now() + total, hint: hidden ? '' : maskWord(word, this.revealed) });
    const hints = this.room.settings.hints ?? 2; // hint k of N is revealed at 25% + 50% * k/N of the turn (N=2 -> 50% and 75%)
    if (!hidden && word.split('').filter(isLetter).length >= 4) for (let k = 1; k <= hints; k++) this.later(() => this.revealHint(), total * (0.25 + 0.5 * k / hints));
    this.later(() => this.endTurn(), total);
    this.deps.sendPrivate(this.room.drawerId!, { wordOptions: null, word });
    this.deps.sendMessage({ kind: 'system', text: `${this.player(this.room.drawerId)?.name} is drawing!` }, null);
    this.deps.onChange();
  }

  private revealHint() {
    if (this.g.turnPhase !== 'drawing' || !this.secret) return;
    const s = this.secret;
    const open = s.split('').map((c, i) => i).filter(i => isLetter(s[i]) && !this.revealed.has(i));
    if (open.length <= 2) return; // always keep something to guess
    this.revealed.add(open[Math.floor(this.rng() * open.length)]);
    this.g.hint = maskWord(s, this.revealed);
    this.deps.onChange();
  }

  private endTurn() {
    const g = this.g;
    if (g.turnPhase !== 'drawing' && g.turnPhase !== 'choosing') return; // no duplicate / invalid transitions
    this.clearTimers();
    const word = this.secret; this.secret = null;
    Object.assign(g, { turnPhase: 'turn_end', revealedWord: word, hint: word ? maskWord(word, new Set(word.split('').map((_, i) => i))) : '', turnScores: { ...this.turnScores }, endsAt: Date.now() + TURN_END_MS });
    if (word) this.deps.sendMessage({ kind: 'system', text: `The word was "${word}".` }, null);
    if (word) this.saveDrawing(word);
    this.later(() => this.nextTurn(), TURN_END_MS);
    this.deps.onChange();
  }

  /** Keeps a compact copy of the finished drawing for the Doodle Museum. Skips blank canvases. */
  private saveDrawing(word: string) {
    const strokes = this.deps.snapshotCanvas?.() ?? []; const d = this.drawer;
    if (!d || strokes.length === 0 || this.gallery.length >= MAX_GALLERY) { this.currentEntry = null; return; }
    this.currentEntry = { id: this.gallery.length + 1, round: this.g.round, artistId: d.id, artistName: d.name, artistAvatar: d.avatar, word, strokes: compactStrokes(strokes), likes: this.g.likes, dislikes: this.g.dislikes };
    this.gallery.push(this.currentEntry); this.room.museumCount = this.gallery.length;
  }
  /** The museum's drawings (with their words). Callers must only expose this once the game is over. */
  getGallery(): GalleryEntry[] { return this.gallery; }

  private endGame() {
    this.clearTimers(); this.secret = null;
    const board = [...this.room.players].sort((a, b) => b.score - a.score).map(p => ({ id: p.id, name: p.name, score: p.score }));
    const top = board[0]?.score ?? 0;
    this.room.phase = 'ended'; this.room.drawerId = null;
    Object.assign(this.g, { turnPhase: 'game_over', endsAt: null, leaderboard: board, winners: board.filter(b => b.score === top).map(b => b.id) });
    this.deps.sendMessage({ kind: 'system', text: 'Game over!' }, null);
    this.deps.onChange();
  }

  // ---- reactions ------------------------------------------------------------------------
  /** 👍 / 👎 on the current drawing. One vote per player per turn, never the drawer, only once drawing has started. */
  react(playerId: string, kind: unknown) {
    const g = this.g;
    if (kind !== 'like' && kind !== 'dislike') throw new GameError('Invalid reaction.');
    if (g.turnPhase !== 'drawing' && g.turnPhase !== 'turn_end') throw new GameError('You can react once the drawing has started.');
    if (!this.player(playerId)) throw new GameError('You are not in this room.');
    if (playerId === this.room.drawerId) throw new GameError('You can not rate your own drawing.');
    if (this.votes.has(playerId)) throw new GameError('You already voted on this drawing.');
    this.votes.set(playerId, kind);
    const voter = this.player(playerId)!;
    const all = [...this.votes.values()];
    Object.assign(g, { likes: all.filter(v => v === 'like').length, dislikes: all.filter(v => v === 'dislike').length, voted: [...this.votes.keys()] });
    if (this.currentEntry) { this.currentEntry.likes = g.likes; this.currentEntry.dislikes = g.dislikes; } // votes cast during the turn-end pause still count
    this.deps.sendMessage({ kind, playerId: voter.id, playerName: voter.name, text: `${voter.name} ${kind === 'like' ? 'liked' : 'disliked'} the drawing!` }, null);
    this.deps.onChange();
  }

  // ---- chat & guessing ------------------------------------------------------------------
  handleMessage(playerId: string, raw: unknown) {
    const p = this.player(playerId); const text = typeof raw === 'string' ? raw.replace(/\p{C}/gu, '').trim().slice(0, 100) : '';
    if (!p || !text) return;
    const g = this.g;
    if (g.turnPhase === 'drawing' && this.secret) {
      const isDrawer = p.id === this.room.drawerId;
      if (isDrawer || this.guessed.has(p.id)) { // they know the word: only talk to others who know it
        return this.deps.sendMessage({ kind: 'chat', playerId: p.id, playerName: p.name, text, restricted: true }, [this.room.drawerId!, ...this.guessed]);
      }
      if (normalizeGuess(text) === normalizeGuess(this.secret)) return this.awardGuess(p);
      this.deps.sendMessage({ kind: 'chat', playerId: p.id, playerName: p.name, text }, null);
      // A near miss gets a private nudge. It goes ONLY to this guesser, so nobody else learns how close they were.
      if (isCloseGuess(text, this.secret)) this.deps.sendMessage({ kind: 'close', text: 'Your guess is close!' }, [p.id]);
      return;
    }
    this.deps.sendMessage({ kind: 'chat', playerId: p.id, playerName: p.name, text }, null);
  }

  private awardGuess(p: Player) {
    const g = this.g; const total = this.room.settings.drawTime * 1000;
    const remaining = Math.max(0, (g.endsAt ?? 0) - Date.now());
    const pts = 100 + Math.round(300 * remaining / total) + (ORDER_BONUS[this.guessed.size] ?? 0);
    this.guessed.add(p.id);           // added before anything else: a repeated guess can never score twice
    p.score += pts; this.turnScores[p.id] = pts;
    const drawer = this.player(this.room.drawerId);
    if (drawer) { drawer.score += DRAWER_PER_GUESS; this.turnScores[drawer.id] = (this.turnScores[drawer.id] ?? 0) + DRAWER_PER_GUESS; }
    g.guessed = [...this.guessed];
    this.deps.sendMessage({ kind: 'correct', playerId: p.id, playerName: p.name, text: `${p.name} guessed the word!` }, null);
    if (!this.checkAllGuessed()) this.deps.onChange();
  }

  private checkAllGuessed(): boolean {
    if (this.g.turnPhase !== 'drawing') return false;
    if (this.eligibleGuessers().every(p => this.guessed.has(p.id))) { this.endTurn(); return true; }
    return false;
  }

  // ---- connection events ----------------------------------------------------------------
  onDisconnect(playerId: string) {
    this.disconnectedAt.set(playerId, Date.now());
    this.graceTimers.push(setTimeout(this.safe(() => this.recheck(playerId)), GRACE_MS + 50)); // grace period so a refresh is not fatal
  }
  private recheck(playerId: string) {
    const p = this.player(playerId); if (!p || this.isPresent(p)) return;
    this.handleGone(playerId);
  }
  onReconnect(playerId: string) { this.disconnectedAt.delete(playerId); this.resync(playerId); }
  onLeft(playerId: string) { this.disconnectedAt.delete(playerId); this.handleGone(playerId); }

  private handleGone(playerId: string) {
    const phase = this.g.turnPhase;
    if (phase === 'game_over') return;
    if (this.room.players.filter(p => this.isPresent(p)).length < 2 && phase !== 'turn_end') { this.endTurn(); return; } // next turn ends the game
    if ((phase === 'choosing' || phase === 'drawing') && playerId === this.room.drawerId) this.endTurn();
    else this.checkAllGuessed();
  }

  /** Re-send a player's private info after reconnecting. */
  resync(playerId: string) {
    const g = this.g; const isDrawer = playerId === this.room.drawerId;
    this.deps.sendPrivate(playerId, {
      wordOptions: isDrawer && g.turnPhase === 'choosing' ? this.options : null,
      word: isDrawer && g.turnPhase === 'drawing' ? this.secret : null,
    });
  }
}
