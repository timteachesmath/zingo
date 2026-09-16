import { describe, it, expect } from "vitest";
import { loadDispersion, worstPair, overlapSpread } from "../src/lib/index.js";

const S = (...xs: string[]) => new Set(xs);

describe("fairness", () => {
  it("two-card sets are always fair (load dispersion is zero)", () => {
    // Both cards carry the identical mutual overlap, so contention is equal.
    expect(loadDispersion([S("a", "b", "c"), S("a", "b", "x")])).toBe(0);
  });

  it("worstPair is the most-shared pair", () => {
    const cards = [S("a", "b", "c", "d", "e"), S("a", "b", "c", "d", "z"), S("q", "r")];
    expect(worstPair(cards)).toBe(4);
  });

  it("a lopsided set scores more unfair than a balanced one at equal difficulty", () => {
    // both have total overlap 4 over 3 pairs (same difficulty), different spread
    const balanced = [S("a", "b"), S("b", "c"), S("c", "a")]; // overlaps 1,1,1 ... total 3
    const lop = [S("a", "b", "c"), S("a", "b", "c"), S("x", "y")]; // overlaps 3,0,0
    expect(overlapSpread(lop)).toBeGreaterThan(overlapSpread(balanced));
  });
});
