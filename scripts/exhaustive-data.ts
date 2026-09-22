/**
 * Reading, writing and merging data/exhaustive.json. Used by scripts/sample.ts
 * and scripts/exhaustive.ts; see data/README.md for the format.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { PAIRS, encodeMasks, spreadPatterns } from "../src/lib/index.js";

export interface Entry {
  n0: number;
  n1: number;
  n2: number;
  n3: number;
  t: number;
  status: "open" | "partial" | "complete";
  method: string;
  notes: string;
  /** q -> one board: six cards of tile numbers 0–23. */
  q: Record<string, number[][]>;
  /** q values the local search found with this pattern. Written by `npm run sample`. */
  searchFound: number[];
}
export type Exhaustive = Record<string, Entry>;

export interface ScatterData {
  points: number[][];
  detail: Record<string, [number, string][]>;
  columns: Record<string, { x: number; comps: number[][]; exact?: number[] }>;
}

const FILE = new URL("../data/exhaustive.json", import.meta.url);

export const patternKey = (n2: number, n3: number) => `${n2}-${n3}`;

export function readExhaustive(): Exhaustive {
  return existsSync(FILE) ? JSON.parse(readFileSync(FILE, "utf8")).compositions : {};
}

/**
 * One entry per spread pattern, in difficulty order, with the derived fields
 * rebuilt. Hand-entered fields are kept. `searchFound` is replaced only when
 * new search results are passed in.
 */
export function withPatterns(old: Exhaustive, searchFound?: Record<string, number[]>): Exhaustive {
  const patterns = spreadPatterns().sort(
    (a, b) => a[2] + 3 * a[3] - (b[2] + 3 * b[3]) || a[3] - b[3],
  );
  const out: Exhaustive = {};
  for (const [n0, n1, n2, n3] of patterns) {
    const key = patternKey(n2, n3);
    const mine = old[key];
    out[key] = {
      n0, n1, n2, n3,
      t: n2 + 3 * n3,
      status: mine?.status ?? "open",
      method: mine?.method ?? "",
      notes: mine?.notes ?? "",
      q: mine?.q ?? {},
      searchFound: searchFound?.[key] ?? mine?.searchFound ?? [],
    };
  }
  return out;
}

export function writeExhaustive(compositions: Exhaustive): void {
  // Keep each card and each number list on one line so the file stays readable.
  const body = JSON.stringify({ compositions }, null, 2).replace(
    /\[\s+((?:\d+,?\s*)+)\]/g,
    (_, nums: string) => `[${nums.trim().split(/,\s*/).join(", ")}]`,
  );
  writeFileSync(FILE, body + "\n");
}

const encode = (board: number[][]) =>
  encodeMasks(board.map((card) => card.reduce((m, tile) => m | (1 << tile), 0)));

/**
 * Fold exhaustive results into scatter data, in place. Each board replaces the
 * search's board for the same pattern and q; values the search never reached
 * become new points. Complete patterns are listed in `columns[t].exact`, which
 * lets the page call a missing pattern impossible rather than "not found".
 */
export function mergeExhaustive(scatter: ScatterData, compositions: Exhaustive) {
  let added = 0, replaced = 0;
  for (const column of Object.values(scatter.columns)) column.exact = [];

  for (const [key, e] of Object.entries(compositions)) {
    const column = scatter.columns[e.t];
    const ci = column.comps.findIndex((c) => c[1] === e.n2 && c[2] === e.n3);
    if (ci < 0) throw new Error(`${key}: no such pattern at t=${e.t}`);

    for (const [q, board] of Object.entries(e.q)) {
      const at = `${e.t}:${q}`;
      if (!scatter.detail[at]) {
        scatter.detail[at] = [];
        const x = e.t / PAIRS;
        const y = Math.sqrt(Math.max(0, Number(q) / PAIRS - x * x));
        scatter.points.push([+x.toFixed(4), +y.toFixed(4), e.t, Number(q)]);
        added++;
      }
      const found = scatter.detail[at].filter(([i]) => i !== ci);
      if (found.length < scatter.detail[at].length) replaced++;
      found.push([ci, encode(board)]);
      scatter.detail[at] = found.sort((a, b) => a[0] - b[0]);
    }

    if (e.status === "complete") {
      // The search can't find a board that an exhaustive list rules out.
      for (const [at, found] of Object.entries(scatter.detail)) {
        const [t, q] = at.split(":");
        if (Number(t) === e.t && found.some(([i]) => i === ci) && !(q in e.q))
          throw new Error(
            `${key} is marked complete but scatter.json has a board for it at q=${q}. ` +
              "Check the entry, or run `npm run sample` if that board came from an earlier merge.",
          );
      }
      (column.exact ??= []).push(ci);
    }
  }

  for (const column of Object.values(scatter.columns)) column.exact!.sort((a, b) => a - b);
  scatter.points.sort((a, b) => a[2] - b[2] || a[3] - b[3]);
  return { added, replaced };
}
