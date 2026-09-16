import type { BoardSet } from "./board.js";

/** All 37 spread patterns (n0,n1,n2,n3) for 6 cards of 9 tiles from 24, supply<=3. */
export function spreadPatterns(): [number, number, number, number][] {
  const pats: [number, number, number, number][] = [];
  for (let n3 = 0; n3 <= 24; n3++)
    for (let n2 = 0; n2 <= 24; n2++)
      for (let n1 = 0; n1 <= 24; n1++) {
        const n0 = 24 - n1 - n2 - n3;
        if (n0 >= 0 && n1 + 2 * n2 + 3 * n3 === 54) pats.push([n0, n1, n2, n3]);
      }
  return pats;
}

export const CARDS = 6;
const CELLS = 9;

/** Realize one spread pattern as a legal board via balanced greedy assignment. */
export function realize(
  pattern: [number, number, number, number],
  rng: () => number = Math.random
): BoardSet | null {
  const spreads: number[] = [];
  pattern.forEach((cnt, s) => {
    for (let k = 0; k < cnt; k++) spreads.push(s);
  });
  for (let attempt = 0; attempt < 30; attempt++) {
    const cap = Array(CARDS).fill(CELLS);
    const cards: BoardSet = Array.from({ length: CARDS }, () => new Set<string>());
    const order = spreads.map((_, i) => i).sort(() => rng() - 0.5);
    order.sort((a, b) => spreads[b] - spreads[a]);
    let ok = true;
    for (const i of order) {
      const s = spreads[i];
      if (s === 0) continue;
      const avail = [...Array(CARDS).keys()]
        .filter((j) => cap[j] > 0)
        .sort((a, b) => cap[b] - cap[a] || rng() - 0.5);
      if (avail.length < s) {
        ok = false;
        break;
      }
      for (const j of avail.slice(0, s)) {
        cards[j].add(`t${i}`);
        cap[j]--;
      }
    }
    if (ok && cards.every((c) => c.size === CELLS)) return cards;
  }
  return null;
}
