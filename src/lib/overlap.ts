import type { BoardSet } from "./board.js";

/** Tiles shared by two cards. */
export function overlap(a: Set<string>, b: Set<string>): number {
  let n = 0;
  for (const t of a) if (b.has(t)) n++;
  return n;
}

/** The C(n,2) pairwise overlaps, in row-major pair order. */
export function pairwiseOverlaps(cards: BoardSet): number[] {
  const out: number[] = [];
  for (let i = 0; i < cards.length; i++)
    for (let j = i + 1; j < cards.length; j++) out.push(overlap(cards[i], cards[j]));
  return out;
}

/** Symmetric overlap matrix (zero diagonal). */
export function overlapMatrix(cards: BoardSet): number[][] {
  const n = cards.length;
  const m = Array.from({ length: n }, () => Array(n).fill(0));
  for (let i = 0; i < n; i++)
    for (let j = i + 1; j < n; j++) {
      const o = overlap(cards[i], cards[j]);
      m[i][j] = m[j][i] = o;
    }
  return m;
}

/** Difficulty = mean pairwise overlap. */
export function difficulty(cards: BoardSet): number {
  const ov = pairwiseOverlaps(cards);
  return ov.reduce((a, b) => a + b, 0) / ov.length;
}

/** How many cards each tile appears on (its "spread"). */
export function tileSpreads(cards: BoardSet): Map<string, number> {
  const spread = new Map<string, number>();
  for (const card of cards)
    for (const t of card) spread.set(t, (spread.get(t) ?? 0) + 1);
  return spread;
}
