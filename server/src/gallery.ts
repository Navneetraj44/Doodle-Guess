import { Point, Stroke } from './types.js';

/** One drawing kept for the post-game "Doodle Museum". Built only on the server, served only once the game is over. */
export interface GalleryEntry {
  id: number; round: number; artistId: string; artistName: string; artistAvatar: string;
  word: string; strokes: Stroke[]; likes: number; dislikes: number;
}
export const MAX_GALLERY = 60;          // drawings kept per game (a 20-player, 3-round game fits)
export const MAX_GALLERY_POINTS = 900;  // per drawing, so the whole museum stays a few hundred KB

const round3 = (n: number) => Math.round(n * 1000) / 1000;

/** Copies the strokes, rounds coordinates and thins long drawings (keeping every stroke's first and last point) so a gallery stays small. */
export function compactStrokes(strokes: Stroke[], maxPoints = MAX_GALLERY_POINTS): Stroke[] {
  const total = strokes.reduce((n, s) => n + s.points.length, 0);
  const step = total > maxPoints ? Math.ceil(total / maxPoints) : 1;
  return strokes.map(s => {
    const pts: Point[] = [];
    s.points.forEach((p, i) => { if (step === 1 || i % step === 0 || i === s.points.length - 1) pts.push({ x: round3(p.x), y: round3(p.y) }); });
    return s.fill ? { id: s.id, color: s.color, size: s.size, points: [{ x: round3(s.points[0].x), y: round3(s.points[0].y) }], fill: true } : { id: s.id, color: s.color, size: s.size, points: pts };
  });
}
