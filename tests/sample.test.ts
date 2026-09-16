import { describe, it, expect } from "vitest";
import { spreadPatterns, realize, difficulty } from "../src/lib/index.js";

describe("sampler", () => {
  it("there are exactly 37 spread skeletons", () => {
    expect(spreadPatterns()).toHaveLength(37);
  });

  it("green floor and red ceiling are unique and bound the difficulty range", () => {
    const pats = spreadPatterns();
    const T = (p: number[]) => p[2] + 3 * p[3]; // total overlap
    const floor = pats.filter((p) => T(p) === 36);
    const ceil = pats.filter((p) => T(p) === 54);
    expect(floor).toHaveLength(1); // 2.4 difficulty
    expect(ceil).toHaveLength(1); // 3.6 difficulty
  });

  it("realized boards are legal and sit in [2.4, 3.6]", () => {
    for (const pat of spreadPatterns()) {
      const board = realize(pat, () => 0.5);
      if (!board) continue;
      expect(board).toHaveLength(6);
      expect(board.every((c) => c.size === 9)).toBe(true);
      const d = difficulty(board);
      expect(d).toBeGreaterThanOrEqual(2.4 - 1e-9);
      expect(d).toBeLessThanOrEqual(3.6 + 1e-9);
    }
  });
});
