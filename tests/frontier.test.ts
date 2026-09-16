import { describe, it, expect } from "vitest";
import {
  PAIRS,
  arithmeticFloor,
  exactFrontier,
  fairestAt,
  overlapTotal,
  overlapTotals,
} from "../src/lib/generate.js";
import {
  difficulty,
  oversubscribed,
  overlapSpread,
  pairwiseOverlaps,
  tileSpreads,
} from "../src/lib/index.js";
import scatter from "../data/scatter.json";

/** The frontier from the earlier Monte-Carlo sampler, as a regression check: the
 *  exact line must be at least as fair as the Monte-Carlo one in every column. */
const SAMPLED: Record<string, number> = {
  "2.4": 0.49, "2.4667": 0.718, "2.5333": 0.618, "2.6": 0.49, "2.6667": 0.596,
  "2.7333": 0.442, "2.8": 0.542, "2.8667": 0.499, "2.9333": 0.574, "3": 0.632,
  "3.0667": 0.442, "3.1333": 0.499, "3.2": 0.542, "3.2667": 0.68, "3.3333": 0.596,
  "3.4": 0.8, "3.4667": 0.618, "3.6": 0.49,
};

describe("difficulty columns", () => {
  it("spans 2.4 to 3.6 with the missing tooth at 53/15 absent", () => {
    const totals = overlapTotals();
    expect(totals[0]).toBe(36); // 2.4, the green floor
    expect(totals[totals.length - 1]).toBe(54); // 3.6, the red ceiling
    expect(totals).not.toContain(53); // no legal set sits here
    expect(totals).toHaveLength(18);
  });
});

describe("arithmetic floor", () => {
  it("is the stddev of the most even split of the total across the 15 pairs", () => {
    expect(arithmeticFloor(42)).toBeCloseTo(0.4, 4); // 12 pairs at 3, 3 at 2
    expect(arithmeticFloor(36)).toBeCloseTo(0.4899, 4);
    expect(arithmeticFloor(54)).toBeCloseTo(0.4899, 4);
  });

  it("is zero only where the total divides the pairs evenly", () => {
    expect(arithmeticFloor(45)).toBe(0); // 15 pairs at exactly 3
    for (const t of overlapTotals()) {
      if (t % PAIRS !== 0) expect(arithmeticFloor(t)).toBeGreaterThan(0);
    }
  });
});

describe("fairestAt", () => {
  it("reaches the exact green floor at 2.8: stddev 0.40, profile three 2s and twelve 3s", () => {
    const w = fairestAt(2.8);
    expect(w.unfairness).toBeCloseTo(0.4, 6);
    expect(w.exact).toBe(true);
    const profile: Record<number, number> = {};
    for (const o of pairwiseOverlaps(w.board)) profile[o] = (profile[o] ?? 0) + 1;
    expect(profile).toEqual({ 2: 3, 3: 12 });
  });

  it("finds a perfectly fair board at 3.0 — every pair shares exactly three", () => {
    const w = fairestAt(3.0);
    expect(w.unfairness).toBe(0);
    expect(w.exact).toBe(true);
    expect(new Set(pairwiseOverlaps(w.board))).toEqual(new Set([3]));
  });

  it("rejects a difficulty no legal board can reach", () => {
    expect(() => fairestAt(53 / 15)).toThrow(/No legal board/);
  });
});

describe("the exact frontier", () => {
  const frontier = exactFrontier();

  it("covers every column and meets its arithmetic floor in all of them", () => {
    expect(frontier).toHaveLength(18);
    for (const w of frontier) {
      // Can't beat the bound...
      expect(w.unfairness).toBeGreaterThanOrEqual(w.floor - 1e-9);
      // ...and here it always reaches it, so the frontier is a proven optimum.
      expect(w.exact).toBe(true);
      expect(w.unfairness).toBeCloseTo(w.floor, 9);
    }
  });

  it("is at least as fair as the sampled line it replaced", () => {
    for (const w of frontier) {
      const sampled = SAMPLED[String(+w.difficulty.toFixed(4))];
      expect(sampled).toBeDefined();
      // The old values were stored to three decimals, so a column whose
      // sampling already happened to find the floor can round a hair below it
      // (2.7333 stored 0.442 against a true 0.4422166…). Compare at the
      // precision the sampled line was actually recorded at.
      expect(w.unfairness).toBeLessThanOrEqual(sampled + 5e-4);
    }
  });

  it("strictly improves on sampling in the crowded middle columns", () => {
    // Where sampling was biased, the exact floor should beat it by a wide margin, not just
    // within rounding of the old line.
    for (const total of [37, 44, 45, 51]) {
      const w = frontier.find((f) => f.total === total)!;
      const sampled = SAMPLED[String(+w.difficulty.toFixed(4))];
      expect(sampled - w.unfairness).toBeGreaterThan(0.1);
    }
  });

  it("every witness board is legal and actually realizes its claimed column", () => {
    for (const w of frontier) {
      expect(w.board).toHaveLength(6);
      expect(w.board.every((c) => c.size === 9)).toBe(true);
      expect(new Set(w.board.flatMap((c) => [...c])).size).toBeLessThanOrEqual(24);
      expect(Math.max(...tileSpreads(w.board).values())).toBeLessThanOrEqual(3);
      expect(oversubscribed(w.board)).toHaveLength(0);
      expect(difficulty(w.board)).toBeCloseTo(w.difficulty, 9);
      expect(overlapSpread(w.board)).toBeCloseTo(w.unfairness, 9);
      expect(overlapTotal(w.board)).toBe(w.total);
    }
  });

  it("is symmetric about the perfectly fair column at 3.0", () => {
    // The floor depends only on how evenly the total splits across 15 pairs,
    // so columns equidistant from 45 share a value.
    const byTotal = new Map(frontier.map((w) => [w.total, w.unfairness]));
    for (let d = 1; d <= 8; d++) {
      const lo = byTotal.get(45 - d);
      const hi = byTotal.get(45 + d);
      if (lo === undefined || hi === undefined) continue;
      expect(lo).toBeCloseTo(hi, 9);
    }
  });
});

describe("data/scatter.json", () => {
  it("ships the exact frontier in the shape plane.ts already reads", () => {
    expect(scatter.frontierExact).toBe(true);
    expect(scatter.frontier).toHaveLength(18);
    for (const point of scatter.frontier) {
      expect(point).toHaveLength(2);
      expect(typeof point[0]).toBe("number");
      expect(typeof point[1]).toBe("number");
    }
  });

  it("matches what fairestAt computes, column for column", () => {
    for (const [x, y] of scatter.frontier) {
      expect(y).toBeCloseTo(arithmeticFloor(Math.round(x * PAIRS)), 4);
    }
  });

  it("bottoms out at exactly zero at difficulty 3.0", () => {
    const perfect = scatter.frontier.filter(([, y]) => y === 0);
    expect(perfect).toHaveLength(1);
    expect(perfect[0][0]).toBe(3);
  });
});
