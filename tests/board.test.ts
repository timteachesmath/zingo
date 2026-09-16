import { describe, it, expect } from "vitest";
import { parseSheet, duplicateTiles } from "../src/lib/index.js";

describe("parseSheet", () => {
  it("reads columns as cards", () => {
    const cards = parseSheet("a b\nc d\ne f"); // 2 cards of 3
    expect(cards).toHaveLength(2);
    expect([...cards[0]]).toEqual(["a", "c", "e"]);
    expect([...cards[1]]).toEqual(["b", "d", "f"]);
  });

  it("rejects ragged sheets", () => {
    expect(() => parseSheet("a b\nc")).toThrow();
  });

  it("flags a card with a repeated tile", () => {
    expect(duplicateTiles("a b\na d")).toEqual([0]); // column 0 repeats 'a'
    expect(duplicateTiles("a b\nc d")).toEqual([]);
  });
});
