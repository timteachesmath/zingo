import { describe, it, expect } from "vitest";
import {
  PAIRS,
  TILES,
  arithmeticFloor,
  decodeBoard,
  encodeMasks,
  overlapSpread,
  overlapTotal,
  oversubscribed,
  reachableAt,
  tileSpreads,
} from "../src/lib/index.js";
import scatter from "../data/scatter.json";

const detail = scatter.detail as Record<string, (number | string)[][]>;
const columns = scatter.columns as Record<string, { x: number; comps: number[][] }>;

describe("the shipped possibility set", () => {
  it("covers the 18 legal columns and never the missing tooth", () => {
    const totals = [...new Set(scatter.points.map((p) => p[2]))].sort((a, b) => a - b);
    expect(totals).toHaveLength(18);
    expect(totals).not.toContain(53);
    expect(totals[0]).toBe(36);
    expect(totals[totals.length - 1]).toBe(54);
  });

  it("obeys the parity law q ≡ t (mod 2)", () => {
    // q = t + 2*sum(C(o,2)), so half of each column's integer range is
    // unreachable for a structural reason rather than a sampling one.
    for (const [, , t, q] of scatter.points) expect((q - t) % 2).toBe(0);
  });

  it("has the exact frontier as its lower edge, column for column", () => {
    const lowest = new Map<number, number>();
    for (const [, y, t] of scatter.points) {
      if (!lowest.has(t) || y < lowest.get(t)!) lowest.set(t, y);
    }
    for (const [t, y] of lowest) expect(y).toBeCloseTo(arithmeticFloor(t), 4);
  });

  it("agrees with the frontier array it ships alongside", () => {
    for (const [x, y] of scatter.frontier) {
      const col = scatter.points.filter((p) => Math.abs(p[0] - x) < 1e-9);
      expect(col.length).toBeGreaterThan(0);
      expect(Math.min(...col.map((p) => p[1]))).toBeCloseTo(y, 4);
    }
  });

  it("is honest about what is proven: floor yes, ceiling no", () => {
    expect(scatter.frontierExact).toBe(true);
    expect(scatter.ceilingExact).toBe(false);
  });
});

describe("the shipped witness boards", () => {
  const entries = Object.entries(detail);

  it("cover a witness for at least one composition at every point", () => {
    expect(entries.length).toBe(scatter.points.length);
    for (const [, found] of entries) expect(found.length).toBeGreaterThan(0);
  });

  it("every witness decodes to a legal six-card set", () => {
    for (const [, found] of entries) {
      for (const [, encoded] of found) {
        const board = decodeBoard(String(encoded));
        expect(board).toHaveLength(6);
        expect(board.every((c) => c.size === 9)).toBe(true);
        expect(Math.max(...tileSpreads(board).values())).toBeLessThanOrEqual(3);
        expect(oversubscribed(board)).toHaveLength(0);
        for (const card of board) for (const tile of card) expect(TILES).toContain(tile);
      }
    }
  });

  it("every witness scores to the exact point it is filed under", () => {
    // This is the assertion the click interaction demonstrates live: load the
    // board the page shows you, and the marker lands on the dot you clicked.
    for (const [key, found] of entries) {
      const [t, q] = key.split(":").map(Number);
      const expected = Math.sqrt(q / PAIRS - (t / PAIRS) ** 2);
      for (const [, encoded] of found) {
        const board = decodeBoard(String(encoded));
        expect(overlapTotal(board)).toBe(t);
        expect(overlapSpread(board)).toBeCloseTo(expected, 9);
      }
    }
  });

  it("every witness realizes the composition it is filed under", () => {
    for (const [key, found] of entries) {
      const t = Number(key.split(":")[0]);
      for (const [index, encoded] of found) {
        const board = decodeBoard(String(encoded));
        const n = [0, 0, 0, 0];
        for (const spread of tileSpreads(board).values()) n[spread]++;
        expect([n[1], n[2], n[3]]).toEqual(columns[String(t)].comps[Number(index)]);
      }
    }
  });

  it("never claims more compositions than exist at that difficulty", () => {
    for (const [key, found] of entries) {
      const t = Number(key.split(":")[0]);
      const available = columns[String(t)].comps.length;
      expect(found.length).toBeLessThanOrEqual(available);
      for (const [index] of found) expect(Number(index)).toBeLessThan(available);
    }
  });
});

describe("composition counts", () => {
  it("match the skeleton enumeration exactly — this half is not a search result", () => {
    // The spec's per-column pattern counts, which the tooltip reports as fact.
    const expected = [1, 1, 1, 2, 2, 2, 3, 3, 3, 4, 3, 2, 3, 2, 1, 2, 1, 1];
    const totals = Object.keys(columns).map(Number).sort((a, b) => a - b);
    expect(totals.map((t) => columns[String(t)].comps.length)).toEqual(expected);
  });

  it("describe every tile in the set: singles + doubles + triples spreads sum to 54", () => {
    for (const t of Object.keys(columns)) {
      for (const [n1, n2, n3] of columns[t].comps) {
        expect(n1 + 2 * n2 + 3 * n3).toBe(54);
        expect(n1 + n2 + n3).toBeLessThanOrEqual(24);
        expect(n2 + 3 * n3).toBe(Number(t)); // the column's overlap total
      }
    }
  });
});

describe("board encoding", () => {
  it("round-trips a board through 24 base64 characters", () => {
    const [, found] = Object.entries(detail)[0];
    const encoded = String(found[0][1]);
    expect(encoded).toHaveLength(24);
    const board = decodeBoard(encoded);
    const index = new Map(TILES.map((t, i) => [t as string, i]));
    const masks = board.map((c) => [...c].reduce((m, t) => m | (1 << index.get(t)!), 0));
    expect(encodeMasks(masks)).toBe(encoded);
  });
});

describe("reachableAt", () => {
  it("is reproducible for a fixed seed", () => {
    const a = reachableAt(36, { restarts: 4, walk: 40, climb: 20, seed: 1 });
    const b = reachableAt(36, { restarts: 4, walk: 40, climb: 20, seed: 1 });
    expect(a.points.map((p) => p.q)).toEqual(b.points.map((p) => p.q));
  });

  it("reaches the proven floor even on a tiny budget, because it seeds the witness", () => {
    const col = reachableAt(45, { restarts: 2, walk: 20, climb: 10, seed: 3 });
    expect(Math.min(...col.points.map((p) => p.unfairness))).toBeCloseTo(0, 9);
  });

  it("refuses a difficulty no legal board has", () => {
    expect(() => reachableAt(53)).toThrow(/No legal board/);
  });
});
