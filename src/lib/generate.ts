import type { BoardSet } from "./board.js";
import { CARDS, spreadPatterns, realize } from "./sample.js";
import { pairwiseOverlaps, tileSpreads } from "./overlap.js";
import { overlapSpread, stddev } from "./fairness.js";
import { TILES } from "./tiles.js";

/** C(6,2) = 15 card pairs. Difficulty and unfairness are both computed over these. */
export const PAIRS = (CARDS * (CARDS - 1)) / 2;

/**
 * A board's total pairwise overlap. Difficulty is this divided by PAIRS; the
 * functions here work with the integer total to keep the arithmetic exact.
 */
export function overlapTotal(cards: BoardSet): number {
  return pairwiseOverlaps(cards).reduce((a, b) => a + b, 0);
}

/**
 * Every overlap total a legal board can reach. A spread pattern's total is
 * fixed by its tile spreads alone (each spread-2 tile contributes one shared
 * pair, each spread-3 tile three), so the columns come straight from the 37
 * skeletons. 53 is absent (the "missing tooth").
 */
export function overlapTotals(): number[] {
  const totals = new Set(spreadPatterns().map(([, , n2, n3]) => n2 + 3 * n3));
  return [...totals].sort((a, b) => a - b);
}

/** The balanced split of `total` across PAIRS pairs: r pairs at q+1, rest at q. */
function floorProfile(total: number): number[] {
  const q = Math.floor(total / PAIRS);
  const r = total % PAIRS;
  return [...Array<number>(r).fill(q + 1), ...Array<number>(PAIRS - r).fill(q)];
}

/**
 * Closed-form lower bound on unfairness for a difficulty column.
 *
 * Difficulty pins the mean overlap at total/PAIRS, so the overlaps are least
 * spread out when `total` is divided as evenly as the integers allow. No legal
 * board can beat this. Whether one *reaches* it is a separate question, and
 * the one fairestAt() answers.
 */
export function arithmeticFloor(total: number): number {
  return stddev(floorProfile(total));
}

/* ---- The witness search -------------------------------------------------

   Within a column the mean overlap is fixed, so minimizing the spread of the
   overlaps is exactly minimizing their sum of squares. That sum is an integer,
   which is what makes "the search reached the floor" a provable claim rather
   than a numerical near-miss.

   Boards are stored as 24-bit masks here (one bit per tile, one mask per
   card), so an overlap is a popcount and a swap is four bit operations. */

const popcount = (n: number): number => {
  n -= (n >> 1) & 0x55555555;
  n = (n & 0x33333333) + ((n >> 2) & 0x33333333);
  return (((n + (n >> 4)) & 0x0f0f0f0f) * 0x01010101) >> 24;
};

/** Seeded PRNG, so regenerating data/scatter.json is reproducible. */
export function seededRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function toMasks(cards: BoardSet): { masks: number[]; tiles: string[] } {
  const tiles = [...new Set(cards.flatMap((c) => [...c]))];
  const index = new Map(tiles.map((t, i) => [t, i]));
  const masks = cards.map((c) => [...c].reduce((m, t) => m | (1 << index.get(t)!), 0));
  return { masks, tiles };
}

function toBoard(masks: number[], tiles: string[]): BoardSet {
  return masks.map((m) => {
    const card = new Set<string>();
    for (let i = 0; i < tiles.length; i++) if (m & (1 << i)) card.add(tiles[i]);
    return card;
  });
}

/**
 * Hill-climb one board toward minimum unfairness with spread-preserving
 * 2-swaps: tile A moves from card i to card j while tile B moves the other
 * way. Both tiles keep their spread and both cards keep their size, so the
 * board never leaves its difficulty column; the search only ever trades
 * fairness, never difficulty.
 *
 * Mutates `masks` and returns the sum of squared overlaps it settled on.
 */
function descend(masks: number[], rng: () => number, sidewaysBudget: number): number {
  const o = Array.from({ length: CARDS }, () => Array<number>(CARDS).fill(0));
  let ss = 0;
  for (let i = 0; i < CARDS; i++)
    for (let j = i + 1; j < CARDS; j++) {
      o[i][j] = o[j][i] = popcount(masks[i] & masks[j]);
      ss += o[i][j] ** 2;
    }

  let sideways = sidewaysBudget;
  for (;;) {
    let bi = -1, bj = -1, bA = 0, bB = 0, bDelta = 0;
    const flat: [number, number, number, number][] = [];

    for (let i = 0; i < CARDS; i++)
      for (let j = i + 1; j < CARDS; j++) {
        let onlyI = masks[i] & ~masks[j];
        while (onlyI) {
          const A = onlyI & -onlyI;
          onlyI ^= A;
          let onlyJ = masks[j] & ~masks[i];
          while (onlyJ) {
            const B = onlyJ & -onlyJ;
            onlyJ ^= B;
            // Card i trades A for B and card j the reverse. Only overlaps with a
            // third card k change; o[i][j] stays the same.
            let delta = 0;
            for (let k = 0; k < CARDS; k++) {
              if (k === i || k === j) continue;
              const d = ((masks[k] & B) !== 0 ? 1 : 0) - ((masks[k] & A) !== 0 ? 1 : 0);
              if (d !== 0) delta += 2 * d * (o[i][k] - o[j][k]) + 2;
            }
            if (delta < bDelta) {
              bi = i; bj = j; bA = A; bB = B; bDelta = delta;
            } else if (delta === 0) {
              flat.push([i, j, A, B]);
            }
          }
        }
      }

    if (bDelta === 0) {
      // No improving move. Sideways moves can open a new descent but can also
      // cycle, so they're capped.
      if (sideways <= 0 || flat.length === 0) return ss;
      sideways--;
      [bi, bj, bA, bB] = flat[Math.floor(rng() * flat.length)];
    }

    masks[bi] = (masks[bi] & ~bA) | bB;
    masks[bj] = (masks[bj] & ~bB) | bA;
    for (let k = 0; k < CARDS; k++) {
      if (k === bi || k === bj) continue;
      o[bi][k] = o[k][bi] = popcount(masks[bi] & masks[k]);
      o[bj][k] = o[k][bj] = popcount(masks[bj] & masks[k]);
    }
    ss += bDelta;
  }
}

export interface Witness {
  /** The difficulty column, as an overlap total and as the x value plotted. */
  total: number;
  difficulty: number;
  /** Unfairness of the best board found (an achievable upper bound). */
  unfairness: number;
  /** The closed-form lower bound for this column. */
  floor: number;
  /** True when the two meet, i.e. the frontier here is provably exact. */
  exact: boolean;
  /** The board realizing `unfairness`: the fairest set known at this difficulty. */
  board: BoardSet;
}

export interface SearchOptions {
  /** Random restarts per column. The search stops early once it hits the floor. */
  restarts?: number;
  /** Plateau moves allowed per restart. */
  sideways?: number;
  seed?: number;
}

/**
 * The fairest legal board at a given difficulty, found by local search from
 * random realizations of every spread pattern in that column.
 *
 * Where `exact` comes back true the returned unfairness *is* the frontier: the
 * closed-form bound says nothing can do better, and this board proves
 * something achieves it. Where it comes back false, treat the value as the
 * best achievable found so far, not as the true floor.
 */
export function fairestAt(difficulty: number, opts: SearchOptions = {}): Witness {
  const { restarts = 80, sideways = 120, seed = 20260910 } = opts;
  const total = Math.round(difficulty * PAIRS);
  if (!overlapTotals().includes(total))
    throw new Error(`No legal board has difficulty ${difficulty} (overlap total ${total}).`);

  const patterns = spreadPatterns().filter(([, , n2, n3]) => n2 + 3 * n3 === total);
  const floorSS = floorProfile(total).reduce((a, b) => a + b * b, 0);
  const rng = seededRng(seed + total);

  let best: { ss: number; board: BoardSet } | null = null;
  for (let r = 0; r < restarts; r++) {
    const start = realize(patterns[r % patterns.length], rng);
    if (!start) continue;
    const { masks, tiles } = toMasks(start);
    const ss = descend(masks, rng, sideways);
    if (!best || ss < best.ss) best = { ss, board: toBoard(masks, tiles) };
    if (best.ss === floorSS) break; // provably optimal; nothing can beat the bound
  }
  if (!best) throw new Error(`Could not realize any board at overlap total ${total}.`);

  return {
    total,
    difficulty: total / PAIRS,
    unfairness: overlapSpread(best.board),
    floor: arithmeticFloor(total),
    exact: best.ss === floorSS,
    board: best.board,
  };
}

/** The fairest board in every difficulty column, left to right. */
export function exactFrontier(opts: SearchOptions = {}): Witness[] {
  return overlapTotals().map((total) => fairestAt(total / PAIRS, opts));
}

/* ---- The possibility set ------------------------------------------------

   Every (difficulty, unfairness) a legal board can reach, as the integer
   lattice (t, q). Unlike the frontier, only the lower edge of this is proven:
   `max q` has no closed form, and the interior is whatever the search finds.
   Treat everything here as "best found", and say so in the UI. */

const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

/** Six 24-bit card masks as 24 base64 characters (four per card, no padding). */
export function encodeMasks(masks: number[]): string {
  return masks
    .map((m) => B64[(m >> 18) & 63] + B64[(m >> 12) & 63] + B64[(m >> 6) & 63] + B64[m & 63])
    .join("");
}

/** Inverse of encodeMasks, naming tiles from the real 24-image pool. */
export function decodeBoard(encoded: string): BoardSet {
  const cards: BoardSet = [];
  for (let c = 0; c < CARDS; c++) {
    let m = 0;
    for (let k = 0; k < 4; k++) m = (m << 6) | B64.indexOf(encoded[c * 4 + k]);
    const card = new Set<string>();
    for (let i = 0; i < TILES.length; i++) if (m & (1 << i)) card.add(TILES[i]);
    cards.push(card);
  }
  return cards;
}

/** Every spread-preserving 2-swap available from a board. */
function swaps(masks: number[]): [number, number, number, number][] {
  const out: [number, number, number, number][] = [];
  for (let i = 0; i < CARDS; i++)
    for (let j = i + 1; j < CARDS; j++) {
      let onlyI = masks[i] & ~masks[j];
      while (onlyI) {
        const A = onlyI & -onlyI;
        onlyI ^= A;
        let onlyJ = masks[j] & ~masks[i];
        while (onlyJ) {
          const B = onlyJ & -onlyJ;
          onlyJ ^= B;
          out.push([i, j, A, B]);
        }
      }
    }
  return out;
}

function swap(masks: number[], [i, j, A, B]: [number, number, number, number]) {
  masks[i] = (masks[i] & ~A) | B;
  masks[j] = (masks[j] & ~B) | A;
}

function sumSquares(masks: number[]): number {
  let q = 0;
  for (let i = 0; i < CARDS; i++)
    for (let j = i + 1; j < CARDS; j++) q += popcount(masks[i] & masks[j]) ** 2;
  return q;
}

/** One composition's witness at a point: which skeleton, and a board proving it. */
export interface Reached {
  /** Index into the column's `compositions`. */
  composition: number;
  /** The board, as 24 base64 characters. */
  board: string;
}

export interface LatticePoint {
  q: number;
  unfairness: number;
  /** Mixes the search found at this point. Others may still reach it. */
  found: Reached[];
}

export interface Column {
  total: number;
  difficulty: number;
  /** Every spread composition at this difficulty, as [singles, doubles, triples].
   *  Exact: enumerated, not searched. */
  compositions: [number, number, number][];
  points: LatticePoint[];
}

export interface ExploreOptions extends SearchOptions {
  /** Random restarts per composition. */
  restarts?: number;
  /** Random 2-swap steps per restart; the walk records every q it passes. */
  walk?: number;
  /** Greedy steps after each walk, toward the top edge and toward the floor. */
  climb?: number;
  /**
   * Independent search passes, unioned. More budget in one pass is not
   * reliably better: a longer walk takes a different path and can miss
   * points a shorter one found, so several passes beat one long one
   * at the same cost.
   */
  passes?: number;
}

/**
 * Explore one difficulty column: random restarts from each of its skeletons,
 * a random 2-swap walk recording every `q` it passes through, then a greedy
 * ascent toward the top barrier. Swaps preserve tile spreads, so the search
 * never leaves the column.
 *
 * The returned `compositions` are exact; which of them `found` a given point
 * is empirical and may under-report.
 */
export function reachableAt(total: number, opts: ExploreOptions = {}): Column {
  const { restarts = 60, walk = 400, climb = 150, passes = 1, seed = 20260910 } = opts;
  const patterns = spreadPatterns().filter(([, , n2, n3]) => n2 + 3 * n3 === total);
  if (patterns.length === 0) throw new Error(`No legal board has overlap total ${total}.`);
  const compositions = patterns.map((p) => [p[1], p[2], p[3]] as [number, number, number]);
  // q -> composition index -> encoded witness
  const hits = new Map<number, Map<number, string>>();
  const note = (masks: number[], ci: number) => {
    const q = sumSquares(masks);
    const at = hits.get(q) ?? hits.set(q, new Map()).get(q)!;
    if (!at.has(ci)) at.set(ci, encodeMasks(masks));
  };

  for (let pass = 0; pass < passes; pass++) {
  const rng = seededRng(seed + total * 7919 + pass * 104729);
  patterns.forEach((pat, ci) => {
    for (let r = 0; r < restarts; r++) {
      const start = realize(pat, rng);
      if (!start) continue;
      const { masks } = toMasks(start);
      note(masks, ci);
      for (let s = 0; s < walk; s++) {
        const mv = swaps(masks);
        swap(masks, mv[Math.floor(rng() * mv.length)]);
        note(masks, ci);
      }
      // From where the walk ended, climb toward the top edge and descend toward
      // the floor. A random walk rarely reaches either; at t = 45 the floor
      // needs a perfectly uniform board (all 15 pairs sharing exactly 3).
      for (const dir of [1, -1]) {
        const m = [...masks];
        for (let s = 0; s < climb; s++) {
          let best: [number, number, number, number] | null = null;
          let bq = sumSquares(m);
          for (const mv of swaps(m)) {
            const trial = [...m];
            swap(trial, mv);
            const q = sumSquares(trial);
            if (dir * (q - bq) > 0) { bq = q; best = mv; }
          }
          if (!best) break;
          swap(m, best);
          note(m, ci);
        }
      }
    }
  });
  }

  // Add the known floor board directly, so the lower edge of the set always
  // matches the proven frontier.
  const floorBoard = fairestAt(total / PAIRS, opts).board;
  const n = [0, 0, 0, 0];
  for (const spread of tileSpreads(floorBoard).values()) n[spread]++;
  const fc = [n[1], n[2], n[3]];
  const fi = compositions.findIndex((c) => c[0] === fc[0] && c[1] === fc[1] && c[2] === fc[2]);
  if (fi >= 0) note(toMasks(floorBoard).masks, fi);

  const mean = total / PAIRS;
  const points: LatticePoint[] = [...hits.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([q, byComp]) => ({
      q,
      unfairness: Math.sqrt(Math.max(0, q / PAIRS - mean * mean)),
      found: [...byComp.entries()]
        .sort((a, b) => a[0] - b[0])
        .map(([composition, board]) => ({ composition, board })),
    }));

  return { total, difficulty: mean, compositions, points };
}

/** The possibility set across all 18 difficulty columns. */
export function possibilitySet(opts: ExploreOptions = {}): Column[] {
  return overlapTotals().map((total) => reachableAt(total, opts));
}
