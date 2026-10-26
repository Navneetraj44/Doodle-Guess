import { Point, Stroke } from './types.js';
import { GameError } from './RoomManager.js';

const MAX_STROKES = 500, MAX_POINTS_PER_STROKE = 5000, MAX_BATCH = 100;
const clamp01 = (n: unknown) => (typeof n === 'number' && Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0);
const toPoint = (p: any): Point => ({ x: clamp01(p?.x), y: clamp01(p?.y) });

/** Holds each room's strokes on the server so late joiners / reconnects can recover the canvas. */
export class DrawingManager {
  private canvases = new Map<string, Stroke[]>();
  private nextId = 1;

  get(code: string): Stroke[] { return this.canvases.get(code) ?? []; }
  reset(code: string) { this.canvases.set(code, []); }
  remove(code: string) { this.canvases.delete(code); }

  start(code: string, d: any): Stroke {
    const strokes = this.canvases.get(code) ?? []; this.canvases.set(code, strokes);
    if (typeof d?.color !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(d.color)) throw new GameError('Invalid color.');
    if (typeof d?.size !== 'number' || !(d.size >= 1 && d.size <= 40)) throw new GameError('Invalid brush size.');
    if (strokes.length >= MAX_STROKES) throw new GameError('Canvas is full. Clear it to keep drawing.');
    const stroke: Stroke = { id: this.nextId++, color: d.color, size: d.size, points: [toPoint(d)] };
    strokes.push(stroke);
    return stroke;
  }
  /** Paint-bucket fill. Stored as one more stroke (fill: true) so the order of lines and fills is preserved and undo removes it like any stroke. */
  fill(code: string, d: any): Stroke {
    const strokes = this.canvases.get(code) ?? []; this.canvases.set(code, strokes);
    if (typeof d?.color !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(d.color)) throw new GameError('Invalid color.');
    if (strokes.length >= MAX_STROKES) throw new GameError('Canvas is full. Clear it to keep drawing.');
    const stroke: Stroke = { id: this.nextId++, color: d.color, size: 1, points: [toPoint(d)], fill: true };
    strokes.push(stroke);
    return stroke;
  }
  /** Returns the sanitized points that were actually appended (what we broadcast). */
  move(code: string, d: any): Point[] {
    const stroke = this.get(code).at(-1);
    if (!stroke || stroke.fill || !Array.isArray(d?.points)) return []; // a fill is a single point: never extend it
    const pts = d.points.slice(0, MAX_BATCH).map(toPoint).slice(0, Math.max(0, MAX_POINTS_PER_STROKE - stroke.points.length));
    stroke.points.push(...pts);
    return pts;
  }
  undo(code: string): Stroke[] { this.get(code).pop(); return this.get(code); }
  clear(code: string): Stroke[] { this.reset(code); return []; }
}
