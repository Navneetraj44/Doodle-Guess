import { useEffect, useRef } from 'react';
import { socket } from '../socket';
import { Point, Stroke } from '../types';
import { floodFill, hexToRgb } from '../floodFill';

export const W = 800, H = 600;
export const PAPER = '#fffdf7'; // warm white drawing surface; the eraser paints in this exact colour // internal resolution; CSS scales it. Points are sent normalized (0..1).

function drawSegment(ctx: CanvasRenderingContext2D, s: Stroke, from: Point, to?: Point) {
  ctx.strokeStyle = s.color; ctx.fillStyle = s.color; ctx.lineWidth = s.size; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  if (!to) { ctx.beginPath(); ctx.arc(from.x * W, from.y * H, s.size / 2, 0, Math.PI * 2); ctx.fill(); return; } // a tap = a dot
  ctx.beginPath(); ctx.moveTo(from.x * W, from.y * H); ctx.lineTo(to.x * W, to.y * H); ctx.stroke();
}
/** Paint-bucket fill: reads the pixels as they are RIGHT NOW, fills the clicked region, writes them back. Every client replays fills in stroke order. */
function applyFill(ctx: CanvasRenderingContext2D, s: Stroke) {
  const p = s.points[0]; if (!p) return;
  const img = ctx.getImageData(0, 0, W, H);
  if (floodFill(img.data, W, H, Math.min(W - 1, p.x * W), Math.min(H - 1, p.y * H), hexToRgb(s.color)) > 0) ctx.putImageData(img, 0, 0);
}
function drawStroke(ctx: CanvasRenderingContext2D, s: Stroke) {
  if (s.fill) return applyFill(ctx, s);
  drawSegment(ctx, s, s.points[0]); for (let i = 1; i < s.points.length; i++) drawSegment(ctx, s, s.points[i - 1], s.points[i]);
}
export function drawFull(ctx: CanvasRenderingContext2D, strokes: Stroke[]) {
  ctx.fillStyle = PAPER; ctx.fillRect(0, 0, W, H);
  for (const s of strokes) drawStroke(ctx, s); // lines and fills in the order the drawer made them (this is also what makes undo work for fills)
}

interface Props { isDrawer: boolean; color: string; size: number; tool?: 'brush' | 'fill'; }

export default function Canvas({ isDrawer, color, size, tool = 'brush' }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  const strokes = useRef<Stroke[]>([]);       // local mirror of server canvas
  const drawing = useRef(false);
  const pending = useRef<Point[]>([]);        // points waiting to be flushed to the server
  const ctx = () => ref.current!.getContext('2d', { willReadFrequently: true })!; // fills read pixels back

  // Receive remote events (works for guessers; the drawer renders locally for zero latency).
  useEffect(() => {
    drawFull(ctx(), []);
    const onStart = (d: any) => { const s: Stroke = { color: d.color, size: d.size, points: [{ x: d.x, y: d.y }] }; strokes.current.push(s); drawSegment(ctx(), s, s.points[0]); };
    const onFill = (d: { color: string; x: number; y: number }) => { const s: Stroke = { color: d.color, size: 1, points: [{ x: d.x, y: d.y }], fill: true }; strokes.current.push(s); applyFill(ctx(), s); };
    const onMove = (d: { points: Point[] }) => {
      const s = strokes.current.at(-1); if (!s || s.fill) return;
      for (const p of d.points) { drawSegment(ctx(), s, s.points.at(-1)!, p); s.points.push(p); }
    };
    const onState = (d: { strokes: Stroke[] }) => { strokes.current = d.strokes; drawFull(ctx(), strokes.current); };
    socket.on('draw_start', onStart); socket.on('draw_move', onMove); socket.on('draw_fill', onFill); socket.on('canvas_state', onState);
    return () => { socket.off('draw_start', onStart); socket.off('draw_move', onMove); socket.off('draw_fill', onFill); socket.off('canvas_state', onState); };
  }, []);

  // Flush buffered points ~every 30ms instead of one socket message per mouse move.
  useEffect(() => {
    const t = setInterval(() => { if (pending.current.length) { socket.emit('draw_move', { points: pending.current }); pending.current = []; } }, 30);
    return () => clearInterval(t);
  }, []);

  const pos = (e: React.PointerEvent): Point => {
    const r = ref.current!.getBoundingClientRect();
    return { x: Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), y: Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)) };
  };
  const down = (e: React.PointerEvent) => {
    if (!isDrawer) return;
    if (tool === 'fill') { // one click = one fill: drawn here at once, stored on the server as a stroke, and replayed by every other client
      if (e.button !== 0) return;
      const p = pos(e); const s: Stroke = { color, size: 1, points: [p], fill: true };
      strokes.current.push(s); applyFill(ctx(), s); socket.emit('draw_fill', { color, x: p.x, y: p.y }); return;
    }
    ref.current!.setPointerCapture(e.pointerId); drawing.current = true;
    const p = pos(e); const s: Stroke = { color, size, points: [p] };
    strokes.current.push(s); drawSegment(ctx(), s, p);
    socket.emit('draw_start', { color, size, x: p.x, y: p.y });
  };
  const move = (e: React.PointerEvent) => {
    if (!isDrawer || !drawing.current) return;
    const s = strokes.current.at(-1)!; if (s.fill) return; const p = pos(e);
    drawSegment(ctx(), s, s.points.at(-1)!, p); s.points.push(p); pending.current.push(p);
  };
  const up = () => {
    if (!drawing.current) return; drawing.current = false;
    if (pending.current.length) { socket.emit('draw_move', { points: pending.current }); pending.current = []; }
    socket.emit('draw_end');
  };

  return <canvas ref={ref} width={W} height={H} className={`board ${isDrawer ? (tool === 'fill' ? 'can-fill' : 'can-draw') : ''}`}
    onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} />;
}
