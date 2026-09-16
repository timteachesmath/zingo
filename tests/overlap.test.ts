import { describe, it, expect } from "vitest";
import { overlap, pairwiseOverlaps, difficulty, tileSpreads } from "../src/lib/index.js";

const S = (...xs: string[]) => new Set(xs);

describe("overlap", () => {
  it("counts shared tiles, is symmetric, and zero for disjoint", () => {
    const a = S("a", "b", "c"), b = S("b", "c", "d");
    expect(overlap(a, b)).toBe(2);
    expect(overlap(b, a)).toBe(2);
    expect(overlap(a, S("x", "y"))).toBe(0);
    expect(overlap(a, a)).toBe(a.size);
  });

  it("difficulty is the mean of the pairwise overlaps", () => {
    const cards = [S("a", "b"), S("a", "b"), S("a", "c")]; // overlaps: 2,1,1
    expect(pairwiseOverlaps(cards).sort()).toEqual([1, 1, 2]);
    expect(difficulty(cards)).toBeCloseTo(4 / 3, 10);
  });

  it("tileSpreads counts cards per tile", () => {
    const s = tileSpreads([S("a", "b"), S("a"), S("a", "c")]);
    expect(s.get("a")).toBe(3);
    expect(s.get("b")).toBe(1);
  });
});
