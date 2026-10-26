import { describe, it, expect } from 'vitest';
import { floodFill, hexToRgb } from './floodFill';

const W = 20, H = 20;
const canvas = (bg = [255, 253, 247]) => { const d = new Uint8ClampedArray(W * H * 4); for (let i = 0; i < W * H; i++) d.set([...bg, 255], i * 4); return d; };
const px = (d: Uint8ClampedArray, x: number, y: number) => Array.from(d.slice((y * W + x) * 4, (y * W + x) * 4 + 3));
const line = (d: Uint8ClampedArray, x0: number, y0: number, x1: number, y1: number, c = [27, 19, 64]) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) d.set([...c, 255], (y * W + x) * 4); };

describe('hexToRgb', () => { it('parses #rrggbb', () => { expect(hexToRgb('#e03131')).toEqual([224, 49, 49]); expect(hexToRgb('nope')).toEqual([0, 0, 0]); }); });
describe('floodFill', () => {
  it('fills a whole empty canvas', () => {
    const d = canvas(); expect(floodFill(d, W, H, 3, 3, [224, 49, 49])).toBe(W * H);
    expect(px(d, 0, 0)).toEqual([224, 49, 49]); expect(px(d, W - 1, H - 1)).toEqual([224, 49, 49]);
  });
  it('stops at an outline: only the clicked side is filled', () => {
    const d = canvas(); line(d, 10, 0, 10, H - 1);       // vertical wall
    floodFill(d, W, H, 2, 5, [47, 158, 68]);
    expect(px(d, 2, 5)).toEqual([47, 158, 68]); expect(px(d, 9, 19)).toEqual([47, 158, 68]);
    expect(px(d, 10, 7)).toEqual([27, 19, 64]);          // the wall is untouched
    expect(px(d, 15, 5)).toEqual([255, 253, 247]);       // the other side stays empty
  });
  it('fills a closed shape without leaking, and can be filled again with another colour', () => {
    const d = canvas(); line(d, 5, 5, 14, 5); line(d, 5, 14, 14, 14); line(d, 5, 5, 5, 14); line(d, 14, 5, 14, 14);
    floodFill(d, W, H, 9, 9, [25, 113, 194]);
    expect(px(d, 9, 9)).toEqual([25, 113, 194]); expect(px(d, 1, 1)).toEqual([255, 253, 247]); expect(px(d, 5, 9)).toEqual([27, 19, 64]);
    floodFill(d, W, H, 9, 9, [247, 103, 7]); expect(px(d, 6, 6)).toEqual([247, 103, 7]); expect(px(d, 1, 1)).toEqual([255, 253, 247]);
  });
  it('does nothing when the clicked area already has that colour, or the click is off the canvas', () => {
    const d = canvas([224, 49, 49]); expect(floodFill(d, W, H, 3, 3, [224, 49, 49])).toBe(0);
    expect(floodFill(canvas(), W, H, -1, 5, [1, 2, 3])).toBe(0); expect(floodFill(canvas(), W, H, 5, 99, [1, 2, 3])).toBe(0);
  });
  it('swallows the soft anti-aliased edge of an outline (no pale halo) but never eats the solid line', () => {
    const d = canvas(); line(d, 10, 0, 10, H - 1);
    line(d, 9, 0, 9, H - 1, [141, 136, 155]);            // ~50% blend of ink and paper, like the edge of a brush stroke
    floodFill(d, W, H, 2, 5, [47, 158, 68]);
    expect(px(d, 8, 5)).toEqual([47, 158, 68]); expect(px(d, 10, 5)).toEqual([27, 19, 64]);
  });
  it('is deterministic: the same pixels and the same click give the same result on every client', () => {
    const make = () => { const d = canvas(); line(d, 3, 3, 16, 3); line(d, 3, 3, 3, 16); return d; };
    const a = make(), b = make(); floodFill(a, W, H, 10, 10, [124, 92, 255]); floodFill(b, W, H, 10, 10, [124, 92, 255]);
    expect(Array.from(a)).toEqual(Array.from(b));
  });
});
