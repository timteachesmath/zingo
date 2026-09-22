/**
 * Build data/scatter.json (`npm run exhaustive`). No search runs here.
 *
 * Two modes, chosen by how much of data/exhaustive.json is done:
 *
 * - While any mix is still open, the dots only the search has reached are kept
 *   from the existing scatter.json, and the enumerated mixes are merged on top.
 * - Once all 37 mixes are complete, the chart is built from exhaustive.json
 *   alone: every dot is then proven and `ceilingExact` becomes true.
 *
 * The frontier, the retail markers and the mix lists are computed here either
 * way. The original search that produced the first version of this file is kept
 * as an artifact in reference/sample-search.ts.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { PAIRS, exactFrontier, overlapTotals } from "../src/lib/generate.js";
import { parseSheet, score, spreadPatterns } from "../src/lib/index.js";
import {
  mergeExhaustive,
  readExhaustive,
  withPatterns,
  writeExhaustive,
  type ScatterData,
} from "./exhaustive-data.js";

const SEED = 20260910;
const scatterPath = new URL("../data/scatter.json", import.meta.url);

const compositions = withPatterns(readExhaustive());
const open = Object.values(compositions).filter((e) => e.status !== "complete").length;

/* Every mix at each difficulty, in the same order the search reported them, so
   a mix's index in `comps` is stable across a rebuild. */
const columns: ScatterData["columns"] = {};
for (const t of overlapTotals()) {
  columns[t] = {
    x: +(t / PAIRS).toFixed(4),
    comps: spreadPatterns()
      .filter(([, , n2, n3]) => n2 + 3 * n3 === t)
      .map(([, n1, n2, n3]) => [n1, n2, n3]),
  };
}

/* Dots the search found for mixes nobody has enumerated yet. They are data at
   this point: the code that produced them no longer runs. */
const previous =
  open > 0 && existsSync(scatterPath)
    ? (JSON.parse(readFileSync(scatterPath, "utf8")) as ScatterData)
    : null;
const kept = new Set(Object.keys(compositions).filter((k) => compositions[k].status === "complete"));
const data: ScatterData = { points: [], detail: {}, columns };
if (previous) {
  for (const [at, found] of Object.entries(previous.detail)) {
    const t = at.split(":")[0];
    // Drop the search's boards for mixes that are now enumerated; the merge
    // below replaces them with proven ones.
    const keep = found.filter(([ci]) => {
      const [, n2, n3] = columns[t].comps[ci];
      return !kept.has(`${n2}-${n3}`);
    });
    if (keep.length) data.detail[at] = keep;
  }
  data.points = previous.points.filter((p) => `${p[2]}:${p[3]}` in data.detail);
}

const merged = mergeExhaustive(data, compositions);
writeExhaustive(compositions);

const witnesses = exactFrontier({ seed: SEED });
const retail = (name: "red" | "green"): number[] => {
  const sheet = readFileSync(new URL(`../data/zingo-${name}.txt`, import.meta.url), "utf8");
  const s = score(parseSheet(sheet));
  return [+s.difficulty.toFixed(4), +s.unfairness.toFixed(4), s.worstPair];
};

const out = {
  points: data.points,
  detail: data.detail,
  columns: data.columns,
  // True only when every mix has been enumerated, so no dot is merely "found".
  ceilingExact: open === 0,
  frontier: witnesses.map((w) => [+w.difficulty.toFixed(4), +w.unfairness.toFixed(4)]),
  frontierExact: witnesses.every((w) => w.exact),
  zingo_red: retail("red"),
  zingo_green: retail("green"),
  guides: { green_floor: 2.4, random: 3.375, red_ceiling: 3.6, tooth: 53 / 15 },
};
writeFileSync(scatterPath, JSON.stringify(out));

console.log(
  `exhaustive.json: ${37 - open} of 37 mixes complete\n` +
    `scatter.json: ${out.points.length} points (${merged.added} added, ${merged.replaced} boards replaced), ` +
    `ceilingExact ${out.ceilingExact}` +
    (open ? `\nStill searching-derived: ${open} mix(es) not yet enumerated.` : ""),
);
