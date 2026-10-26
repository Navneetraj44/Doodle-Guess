import { describe, it, expect } from 'vitest';
import { editDistance, isCloseGuess } from './closeGuess.js';

describe('editDistance', () => {
  it('counts insert, delete, substitute and swapped neighbours as one edit each', () => {
    expect(editDistance('banana', 'banana')).toBe(0);
    expect(editDistance('banana', 'bananas')).toBe(1);   // extra letter
    expect(editDistance('banana', 'banan')).toBe(1);     // missing letter
    expect(editDistance('banana', 'bananb')).toBe(1);    // wrong letter
    expect(editDistance('banana', 'banaan')).toBe(1);    // swapped letters
    expect(editDistance('banana', 'apple')).toBeGreaterThan(2);
  });
});
describe('isCloseGuess', () => {
  it('is close for one-letter slips, case and spacing ignored', () => {
    expect(isCloseGuess('bananna', 'banana')).toBe(true);
    expect(isCloseGuess('  BANAN ', 'banana')).toBe(true);
    expect(isCloseGuess('bnaana', 'banana')).toBe(true);
  });
  it('is not close for the right answer itself (that is a correct guess), or for unrelated words', () => {
    expect(isCloseGuess('banana', 'banana')).toBe(false); expect(isCloseGuess('  Banana ', 'banana')).toBe(false);
    expect(isCloseGuess('apple', 'banana')).toBe(false); expect(isCloseGuess('', 'banana')).toBe(false);
  });
  it('ignores spaces and punctuation: "icecream" is close to "ice cream", "ice-cream" is close too', () => {
    expect(isCloseGuess('icecream', 'ice cream')).toBe(true); expect(isCloseGuess('ice-cream', 'ice cream')).toBe(true);
  });
  it('short words never give a hint (nearly every 3-letter word is one edit away); long words allow two edits', () => {
    expect(isCloseGuess('bat', 'cat')).toBe(false);
    expect(isCloseGuess('elephent', 'elephant')).toBe(true); expect(isCloseGuess('elefant', 'elephant')).toBe(true); expect(isCloseGuess('elefint', 'elephant')).toBe(false);
  });
  it('works for non-Latin words', () => { expect(isCloseGuess('मिठाइ', 'मिठाई')).toBe(true); });
});
