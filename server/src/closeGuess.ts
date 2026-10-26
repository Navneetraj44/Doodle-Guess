/**
 * "Your guess is close!" detection. Pure functions, so it is easy to test.
 * A guess is close when it is not the right answer but is within a small edit distance of the secret word
 * (one wrong/missing/extra letter or two swapped letters; two edits for long words). Spaces, hyphens and punctuation are ignored,
 * so "icecream" is close to "ice cream" (the answer itself is still matched exactly by the Game).
 */
const normalize = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');
const squash = (s: string) => normalize(s).replace(/[\s\p{P}]/gu, '');

/** Optimal-string-alignment distance: insert, delete, substitute, or swap two neighbouring letters, each costing 1. */
export function editDistance(a: string, b: string): number {
  const x = Array.from(a), y = Array.from(b);
  const d: number[][] = Array.from({ length: x.length + 1 }, (_, i) => [i, ...Array(y.length).fill(0)]);
  for (let j = 1; j <= y.length; j++) d[0][j] = j;
  for (let i = 1; i <= x.length; i++) {
    for (let j = 1; j <= y.length; j++) {
      const cost = x[i - 1] === y[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && x[i - 1] === y[j - 2] && x[i - 2] === y[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
    }
  }
  return d[x.length][y.length];
}

export function isCloseGuess(guess: string, secret: string): boolean {
  if (normalize(guess) === normalize(secret)) return false;      // that is the right answer, not a near miss
  const g = squash(guess), s = squash(secret);
  if (!g || s.length < 4) return false;                          // tiny words: nearly every 3-letter word is "one edit away"
  const max = s.length >= 8 ? 2 : 1;
  if (Math.abs(Array.from(g).length - Array.from(s).length) > max) return false;
  return editDistance(g, s) <= max;
}
