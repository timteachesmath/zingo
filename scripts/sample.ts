/**
 * Regenerate data/scatter.json (`npm run sample`).
 *
 * - `frontier`: the closed-form fairness floor, with a board that reaches it in
 *   every column.
 * - `points`: every (difficulty, unfairness) the local search reached. The
 *   lower edge is the frontier; the rest is best-found (`ceilingExact: false`).
 *
 * Seeded, so reruns produce the same file.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { exactFrontier, possibilitySet } from "../src/lib/generate.js";
import { parseSheet, score } from "../src/lib/index.js";

const SEED = 20260910;

// Each point stores the tile mixes found to reach it, with an example board for
// each, so the page can look them up instead of searching in the browser.
// Returns flatten around this budget (about two minutes); larger budgets still
// find a few more points. See docs/possibility-set.md.
const columns = possibilitySet({
  seed: SEED,
  passes: 3,
  restarts: 150,
  walk: 600,
  climb: 250,
});

const points: [number, number, number, number][] = [];
const detail: Record<string, [number, string][]> = {};
const columnMeta: Record<string, { x: number; comps: [number, number, number][] }> = {};
for (const col of columns) {
  columnMeta[col.total] = { x: +col.difficulty.toFixed(4), comps: col.compositions };
  for (const pt of col.points) {
    points.push([+col.difficulty.toFixed(4), +pt.unfairness.toFixed(4), col.total, pt.q]);
    detail[`${col.total}:${pt.q}`] = pt.found.map((f) => [f.composition, f.board]);
  }
}

// Score the retail sets from their sheets rather than hard-coding the numbers.
function retail(name: "red" | "green"): [number, number, number] {
  const sheet = readFileSync(new URL(`../data/zingo-${name}.txt`, import.meta.url), "utf8");
  const s = score(parseSheet(sheet));
  return [+s.difficulty.toFixed(4), +s.unfairness.toFixed(4), s.worstPair];
}
const zingoRed = retail("red");
const zingoGreen = retail("green");

const witnesses = exactFrontier({ seed: SEED });
const frontier = witnesses.map((w) => [+w.difficulty.toFixed(4), +w.unfairness.toFixed(4)]);

const out = {
  points,
  // Keyed "t:q": [compositionIndex, encodedBoard] for each mix the search
  // found at that point. Mixes it didn't find may still be possible.
  detail,
  // Every mix at each difficulty. Exact: enumerated, not searched.
  columns: columnMeta,
  ceilingExact: false,
  frontier,
  // True when every column's board meets the closed-form floor.
  frontierExact: witnesses.every((w) => w.exact),
  zingo_red: zingoRed,
  zingo_green: zingoGreen,
  guides: { green_floor: 2.4, random: 3.375, red_ceiling: 3.6, tooth: 53 / 15 },
};
writeFileSync(new URL("../data/scatter.json", import.meta.url), JSON.stringify(out));

const inexact = witnesses.filter((w) => !w.exact);
console.log(
  `wrote ${out.points.length} points and ${frontier.length} exact frontier columns\n` +
    `retail red   x=${zingoRed[0]} y=${zingoRed[1]} worst pair ${zingoRed[2]}
` +
    `retail green x=${zingoGreen[0]} y=${zingoGreen[1]} worst pair ${zingoGreen[2]}
` +
    (inexact.length === 0
      ? "every column's witness meets its arithmetic floor — the frontier is exact"
      : `${inexact.length} column(s) short of the floor: ` +
        inexact.map((w) => `${w.difficulty.toFixed(4)} (+${(w.unfairness - w.floor).toFixed(4)})`).join(", "))
);
