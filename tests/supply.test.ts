import { describe, it, expect } from "vitest";
import { oversubscribed, isPlayable } from "../src/lib/index.js";

const S = (...xs: string[]) => new Set(xs);

describe("supply", () => {
  it("detects a tile printed on more cards than there are copies", () => {
    // 'q' appears on 4 cards; supply is 3 -> one guaranteed lockout
    const cards = [S("q", "a"), S("q", "b"), S("q", "c"), S("q", "d")];
    const over = oversubscribed(cards);
    expect(over.map((o) => o.tile)).toEqual(["q"]);
    expect(over[0].spread).toBe(4);
    expect(over[0].guaranteedLockouts).toBe(1);
    expect(isPlayable(cards)).toBe(false);
  });

  it("a set within supply is playable", () => {
    expect(isPlayable([S("a", "b"), S("a", "c"), S("a", "d")])).toBe(true); // spread(a)=3
  });
});
