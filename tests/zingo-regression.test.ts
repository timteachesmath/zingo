import { readFileSync } from "node:fs";
import { describe, it, expect } from "vitest";
import {
  PAIRS,
  arithmeticFloor,
  difficulty,
  duplicateTiles,
  oversubscribed,
  overlapSpread,
  overlapTotal,
  parseSheet,
  tileSpreads,
  worstPair,
} from "../src/lib/index.js";
import scatter from "../data/scatter.json";

// The actual retail sheets (columns are cards), read from the committed
// fixtures the page and the data generator also use.
const sheet = (name: string) =>
  readFileSync(new URL(`../data/zingo-${name}.txt`, import.meta.url), "utf8");
const RED = sheet("red");
const GREEN = sheet("green");

/** How many tiles sit at each spread, as the (n0,n1,n2,n3,…) skeleton. */
function spreadPattern(cards: Set<string>[], pool = 24) {
  const counts: number[] = [];
  for (const s of tileSpreads(cards).values()) counts[s] = (counts[s] ?? 0) + 1;
  counts[0] = pool - [...tileSpreads(cards).keys()].length;
  return Array.from({ length: Math.max(counts.length, 4) }, (_, i) => counts[i] ?? 0);
}

describe("Zingo red — characterization", () => {
  const cards = parseSheet(RED);

  it("sits at difficulty 53/15 (the supply-forbidden 'missing tooth')", () => {
    expect(difficulty(cards)).toBeCloseTo(53 / 15, 4);
    expect(overlapTotal(cards)).toBe(53);
  });

  it("its worst pair shares six tiles", () => {
    expect(worstPair(cards)).toBe(6);
  });

  it("oversubscribes exactly five tiles, each forcing one lockout", () => {
    const over = oversubscribed(cards);
    expect(over.map((o) => o.tile).sort()).toEqual(["ball", "cat", "dog", "star", "sun"]);
    expect(over.every((o) => o.spread === 4 && o.guaranteedLockouts === 1)).toBe(true);
  });
});

describe("Zingo green — characterization", () => {
  const cards = parseSheet(GREEN);

  it("is a well-formed six-card sheet with no repeated tile on a card", () => {
    expect(cards).toHaveLength(6);
    expect(cards.every((c) => c.size === 9)).toBe(true);
    expect(duplicateTiles(GREEN)).toEqual([]);
  });

  it("sits at difficulty 2.8 on the skeleton the spec predicted: (0,6,6,12)", () => {
    expect(overlapTotal(cards)).toBe(42);
    expect(difficulty(cards)).toBeCloseTo(2.8, 9);
    expect(spreadPattern(cards).slice(0, 4)).toEqual([0, 6, 6, 12]);
  });

  it("is legal — unlike red, it never exceeds the three-copy supply", () => {
    expect(Math.max(...tileSpreads(cards).values())).toBeLessThanOrEqual(3);
    expect(oversubscribed(cards)).toHaveLength(0);
  });

  it("has a pair sharing five tiles — the observation this project started from", () => {
    expect(worstPair(cards)).toBe(5);
  });

  it("is 0.71 above the fair floor available at its own difficulty", () => {
    const floor = arithmeticFloor(overlapTotal(cards));
    expect(floor).toBeCloseTo(0.4, 9);
    expect(overlapSpread(cards)).toBeCloseTo(1.1075, 4);
    expect(overlapSpread(cards) - floor).toBeGreaterThan(0.7);
  });

  it("is no fairer than red, despite being the legal, 'easy' side", () => {
    // The two retail sides differ in difficulty and legality, not, as the
    // packaging implies, in how evenly they treat the players.
    expect(overlapSpread(cards)).toBeGreaterThan(overlapSpread(parseSheet(RED)));
  });
});

describe("the retail sheets together", () => {
  it("use exactly the 24 tiles of the physical game", () => {
    const pool = new Set([...parseSheet(RED), ...parseSheet(GREEN)].flatMap((c) => [...c]));
    expect(pool.size).toBe(24);
    // Green uses all 24; red leaves owl and tree as its two spares.
    expect(new Set(parseSheet(GREEN).flatMap((c) => [...c])).size).toBe(24);
    expect([...pool].filter((t) => !parseSheet(RED).some((c) => c.has(t))).sort()).toEqual([
      "owl",
      "tree",
    ]);
  });

  it("are plotted from those sheets, so the markers cannot drift from the boards", () => {
    for (const [key, text] of [["zingo_red", RED], ["zingo_green", GREEN]] as const) {
      const cards = parseSheet(text);
      const [x, y, wp] = scatter[key];
      expect(x).toBeCloseTo(difficulty(cards), 4);
      expect(y).toBeCloseTo(overlapSpread(cards), 4);
      expect(wp).toBe(worstPair(cards));
    }
  });

  it("puts green inside the legal columns and red outside them", () => {
    expect(overlapTotal(parseSheet(GREEN)) / PAIRS).toBeCloseTo(2.8, 9);
    expect(overlapTotal(parseSheet(RED))).toBe(53); // the missing tooth
  });
});
