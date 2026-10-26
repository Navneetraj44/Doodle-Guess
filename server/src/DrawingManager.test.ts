import { describe, it, expect } from 'vitest';
import { DrawingManager } from './DrawingManager.js';

describe('DrawingManager', () => {
  it('records strokes, clamps coordinates, and undoes the last stroke', () => {
    const d = new DrawingManager();
    d.start('R', { color: '#ff0000', size: 5, x: 2, y: -1 });
    expect(d.get('R')[0].points[0]).toEqual({ x: 1, y: 0 });
    expect(d.move('R', { points: [{ x: 0.5, y: 0.5 }, { x: 'bad', y: 0.2 }] })).toHaveLength(2);
    d.start('R', { color: '#00ff00', size: 5, x: 0, y: 0 });
    expect(d.undo('R')).toHaveLength(1);
    expect(d.clear('R')).toHaveLength(0);
  });
  it('rejects invalid color and size', () => {
    const d = new DrawingManager();
    expect(() => d.start('R', { color: 'red', size: 5, x: 0, y: 0 })).toThrow('Invalid color');
    expect(() => d.start('R', { color: '#000000', size: 999, x: 0, y: 0 })).toThrow('Invalid brush size');
  });
  it('caps points per move batch', () => {
    const d = new DrawingManager(); d.start('R', { color: '#000000', size: 3, x: 0, y: 0 });
    expect(d.move('R', { points: Array(500).fill({ x: 0.1, y: 0.1 }) })).toHaveLength(100);
  });
  it('stores a fill as an ordered stroke, validates it, and undo removes it like any stroke', () => {
    const d = new DrawingManager();
    d.start('R', { color: '#000000', size: 5, x: 0.1, y: 0.1 });
    const f = d.fill('R', { color: '#ff0000', x: 5, y: -2 });
    expect(f).toMatchObject({ color: '#ff0000', fill: true, points: [{ x: 1, y: 0 }] });
    expect(d.get('R').map(s => !!s.fill)).toEqual([false, true]);
    expect(() => d.fill('R', { color: 'red', x: 0, y: 0 })).toThrow('Invalid color');
    expect(d.undo('R')).toHaveLength(1); expect(d.get('R')[0].fill).toBeUndefined();
  });
  it('a stray draw_move can never extend a fill', () => {
    const d = new DrawingManager(); d.fill('R', { color: '#00ff00', x: 0.5, y: 0.5 });
    expect(d.move('R', { points: [{ x: 0.1, y: 0.1 }] })).toEqual([]); expect(d.get('R')[0].points).toHaveLength(1);
  });
});
