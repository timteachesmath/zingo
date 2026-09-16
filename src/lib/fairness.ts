import type { BoardSet } from "./board.js";
import { pairwiseOverlaps, overlapMatrix, difficulty } from "./overlap.js";

/** Population standard deviation (divides by n). Used for every "spread" here. */
export const stddev = (xs: number[]): number => {
  const m = xs.reduce((a, b) => a + b, 0) / xs.length;
  return Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / xs.length);
};

/** The most-contested pair: max tiles shared by any two cards. */
export function worstPair(cards: BoardSet): number {
  return Math.max(...pairwiseOverlaps(cards));
}

/** Unfairness = spread of the pairwise overlaps (worst-case-aware). */
export function overlapSpread(cards: BoardSet): number {
  return stddev(pairwiseOverlaps(cards));
}

/** Per-card contention load = total overlap a card carries with the others. */
export function contentionLoads(cards: BoardSet): number[] {
  return overlapMatrix(cards).map((row) => row.reduce((a, b) => a + b, 0));
}

/** Card-level unfairness: how unevenly contention falls (0 for two cards). */
export function loadDispersion(cards: BoardSet): number {
  return stddev(contentionLoads(cards));
}

export interface Score {
  difficulty: number;
  unfairness: number;
  worstPair: number;
}

export function score(cards: BoardSet): Score {
  return {
    difficulty: difficulty(cards),
    unfairness: overlapSpread(cards),
    worstPair: worstPair(cards),
  };
}
