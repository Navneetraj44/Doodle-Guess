/**
 * Paint-bucket fill on raw RGBA pixels (no DOM, so it is unit-tested). Every browser runs this same function on the same ordered list of
 * strokes, which is how a fill stays identical for all players (and after undo, which simply redraws the list without the last stroke).
 *
 * Matching is by colour distance from the pixel that was clicked (|dr|+|dg|+|db|). The tolerance swallows the soft anti-aliased edge of a line;
 * a one-pixel growth over near-matching pixels then hides the light halo that would otherwise remain next to the line.
 */
export type RGB = [number, number, number];
export const FILL_TOLERANCE = 160, GROW_TOLERANCE = 330, SAME_COLOR = 24;

export function hexToRgb(hex: string): RGB {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return [0, 0, 0];
  const n = parseInt(m[1], 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Fills the region around (sx, sy) in `data` (RGBA, width*height*4). Returns how many pixels changed (0 = nothing to do). */
export function floodFill(data: Uint8ClampedArray, width: number, height: number, sx: number, sy: number, color: RGB, tol = FILL_TOLERANCE): number {
  sx = Math.floor(sx); sy = Math.floor(sy);
  if (sx < 0 || sy < 0 || sx >= width || sy >= height) return 0;
  const at = (x: number, y: number) => (y * width + x) * 4;
  const s = at(sx, sy); const tr = data[s], tg = data[s + 1], tb = data[s + 2];
  const dist = (i: number) => Math.abs(data[i] - tr) + Math.abs(data[i + 1] - tg) + Math.abs(data[i + 2] - tb);
  if (Math.abs(color[0] - tr) + Math.abs(color[1] - tg) + Math.abs(color[2] - tb) <= SAME_COLOR) return 0; // already this colour
  const mask = new Uint8Array(width * height); // 1 = part of the region; decided on the ORIGINAL pixels, so the fill can never loop
  const stack: number[] = [sx, sy]; let count = 0;
  while (stack.length) {
    const y = stack.pop()!; let x = stack.pop()!;
    while (x >= 0 && !mask[y * width + x] && dist(at(x, y)) <= tol) x--;
    x++;
    let up = false, down = false;
    while (x < width && !mask[y * width + x] && dist(at(x, y)) <= tol) {
      mask[y * width + x] = 1; count++;
      if (y > 0) { const m = !mask[(y - 1) * width + x] && dist(at(x, y - 1)) <= tol; if (m && !up) { stack.push(x, y - 1); up = true; } else if (!m) up = false; }
      if (y < height - 1) { const m = !mask[(y + 1) * width + x] && dist(at(x, y + 1)) <= tol; if (m && !down) { stack.push(x, y + 1); down = true; } else if (!m) down = false; }
      x++;
    }
  }
  // grow by one pixel over pixels that are mostly background (the anti-aliased rim of the outline)
  const rim: number[] = [];
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const p = y * width + x; if (mask[p] || dist(p * 4) > GROW_TOLERANCE) continue;
    if ((x > 0 && mask[p - 1] === 1) || (x < width - 1 && mask[p + 1] === 1) || (y > 0 && mask[p - width] === 1) || (y < height - 1 && mask[p + width] === 1)) rim.push(p);
  }
  for (const p of rim) mask[p] = 1;
  for (let p = 0; p < mask.length; p++) if (mask[p]) { const i = p * 4; data[i] = color[0]; data[i + 1] = color[1]; data[i + 2] = color[2]; data[i + 3] = 255; }
  return count + rim.length;
}
