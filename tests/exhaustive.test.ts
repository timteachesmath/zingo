import { describe, it, expect } from "vitest";
import { TILES, encodeMasks, pairwiseOverlaps, spreadPatterns, tileSpreads } from "../src/lib/index.js";
import scatter from "../data/scatter.json";
import exhaustive from "../data/exhaustive.json";
import { mergeExhaustive, type Exhaustive, type ScatterData } from "../scripts/exhaustive-data.js";

type Entry = {
  n0: number; n1: number; n2: number; n3: number; t: number;
  status: string; method: string; notes: string;
  q: Record<string, number[][]>;
  searchFound: number[];
};
const entries = Object.entries(exhaustive.compositions as Record<string, Entry>);

describe("data/exhaustive.json", () => {
  it("has one entry per spread pattern, keyed n2-n3", () => {
    const keys = spreadPatterns().map(([, , n2, n3]) => `${n2}-${n3}`).sort();
    expect(entries.map(([k]) => k).sort()).toEqual(keys);
    for (const [key, e] of entries) {
      expect(key).toBe(`${e.n2}-${e.n3}`);
      expect(e.t).toBe(e.n2 + 3 * e.n3);
      expect(["open", "partial", "complete"]).toContain(e.status);
    }
  });

  it("is merged into scatter.json (run `npm run exhaustive` if not)", () => {
    const detail = scatter.detail as Record<string, (number | string)[][]>;
    const columns = scatter.columns as Record<string, { comps: number[][]; exact?: number[] }>;
    const points = new Set(scatter.points.map((p) => `${p[2]}:${p[3]}`));
    for (const [key, e] of entries) {
      const ci = columns[e.t].comps.findIndex((c) => c[1] === e.n2 && c[2] === e.n3);
      for (const [q, board] of Object.entries(e.q)) {
        const at = `${e.t}:${q}`;
        expect(points.has(at), `${key}: no point at ${at}`).toBe(true);
        const encoded = encodeMasks(board.map((card) => card.reduce((m, i) => m | (1 << i), 0)));
        expect(detail[at]?.find((f) => f[0] === ci)?.[1], `${key} q=${q}`).toBe(encoded);
      }
      const exact = columns[e.t].exact ?? [];
      expect(exact.includes(ci), `${key}: exact flag`).toBe(e.status === "complete");
      if (e.status === "complete") {
        // No board for this pattern at a value the enumeration rules out.
        const extra = Object.entries(detail)
          .filter(([at, found]) => at.startsWith(`${e.t}:`) && found.some((f) => f[0] === ci))
          .map(([at]) => at.split(":")[1])
          .filter((q) => !(q in e.q));
        expect(extra, key).toEqual([]);
      }
    }
  });

  it("stores only legal boards of the right pattern, each at its stated q", () => {
    for (const [key, e] of entries) {
      for (const [q, board] of Object.entries(e.q)) {
        const where = `${key} q=${q}`;
        expect(board, where).toHaveLength(6);
        for (const card of board) {
          expect(new Set(card).size, where).toBe(9);
          for (const tile of card) expect(tile >= 0 && tile < 24, where).toBe(true);
        }
        const cards = board.map((card) => new Set(card.map((i) => TILES[i])));
        const spreads = [0, 0, 0, 0];
        const seen = tileSpreads(cards);
        for (const s of seen.values()) {
          expect(s, `${where}: a tile is on more than three cards`).toBeLessThanOrEqual(3);
          spreads[s]++;
        }
        spreads[0] = 24 - seen.size;
        expect(spreads, where).toEqual([e.n0, e.n1, e.n2, e.n3]);
        const overlaps = pairwiseOverlaps(cards);
        expect(overlaps.reduce((a, b) => a + b, 0), where).toBe(e.t);
        expect(overlaps.reduce((a, b) => a + b * b, 0), where).toBe(Number(q));
      }
    }
  });

  it("counts every value the search found as reachable in a complete entry", () => {
    // The search only reports values it has a board for, so an exhaustive
    // list that leaves one out is wrong.
    for (const [key, e] of entries) {
      if (e.status !== "complete") continue;
      const missing = e.searchFound.filter((q) => !(String(q) in e.q));
      expect(missing, key).toEqual([]);
    }
  });
});

describe("mergeExhaustive", () => {
  const fresh = () => JSON.parse(JSON.stringify(scatter)) as ScatterData;
  const compositions = exhaustive.compositions as unknown as Exhaustive;

  it("adds a value the search missed, at the right coordinates", () => {
    const data = fresh();
    const original = data.points.find((p) => p[2] === 42 && p[3] === 120)!;
    data.points = data.points.filter((p) => p !== original);
    delete data.detail["42:120"];

    const { added } = mergeExhaustive(data, compositions);
    expect(added).toBe(1);
    expect(data.points.find((p) => p[2] === 42 && p[3] === 120)).toEqual(original);
    // Every mix enumerated at this q is restored, not just the first.
    const expected = data.columns["42"].comps
      .map((c, i) => [i, compositions[`${c[1]}-${c[2]}`]] as const)
      .filter(([, e]) => "120" in e.q)
      .map(([i]) => i);
    expect(expected.length).toBeGreaterThan(0);
    expect(data.detail["42:120"].map(([i]) => i)).toEqual(expected);
    const keys = data.points.map((p) => p[2] * 10000 + p[3]);
    expect(keys).toEqual([...keys].sort((a, b) => a - b));
  });

  it("refuses a complete entry that leaves out a value with a board", () => {
    const data = fresh();
    const broken = JSON.parse(JSON.stringify(compositions)) as Exhaustive;
    delete broken["6-12"].q["342"];
    expect(() => mergeExhaustive(data, broken)).toThrow(/6-12 is marked complete/);
  });
});
