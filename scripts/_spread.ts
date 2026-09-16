import { spreadPatterns, realize } from "../src/lib/sample.js";
import { tileSpreads, oversubscribed, difficulty } from "../src/lib/index.js";

const pats = spreadPatterns();
console.log(`patterns returned: ${pats.length}`);

// structural rules every skeleton must satisfy
const bad = pats.filter(([n0, n1, n2, n3]) =>
  n0 < 0 || n1 < 0 || n2 < 0 || n3 < 0 ||
  n0 + n1 + n2 + n3 !== 24 || n1 + 2 * n2 + 3 * n3 !== 54);
console.log(`violating sum(ni)=24 or sum(i*ni)=54: ${bad.length}`);
console.log(`duplicates: ${pats.length - new Set(pats.map((p) => p.join(","))).size}`);

// columns
const totals = [...new Set(pats.map(([, , n2, n3]) => n2 + 3 * n3))].sort((a, b) => a - b);
console.log(`distinct overlap totals: ${totals.length}, from ${totals[0]} to ${totals[totals.length-1]}`);
console.log(`53 present? ${totals.includes(53)}`);

// per-column counts vs docs/algorithm-spec.md section 10
const expected = [1,1,1,2,2,2,3,3,3,4,3,2,3,2,1,2,1,1];
const got = totals.map((t) => pats.filter(([, , n2, n3]) => n2 + 3 * n3 === t).length);
console.log(`per-column counts match the spec table: ${JSON.stringify(got) === JSON.stringify(expected)}`);
console.log(`  spec: ${expected.join(",")}`);
console.log(`  got : ${got.join(",")}`);

// the spec also names the unique endpoints
const uniq = (t: number) => pats.filter(([, , n2, n3]) => n2 + 3 * n3 === t);
console.log(`green floor t=36 unique: ${uniq(36).length === 1} ${JSON.stringify(uniq(36))}`);
console.log(`red ceiling t=54 unique: ${uniq(54).length === 1} ${JSON.stringify(uniq(54))}`);

// is every skeleton actually realizable as a legal 6x9 board?
let rng = 12345;
const next = () => ((rng = (rng * 1103515245 + 12345) & 0x7fffffff) / 0x80000000);
const fails: string[] = [];
for (const p of pats) {
  let ok = false;
  for (let a = 0; a < 40 && !ok; a++) {
    const b = realize(p, next);
    if (!b) continue;
    const spreads = [...tileSpreads(b).values()];
    const n = [0, 0, 0, 0];
    for (const s of spreads) n[s]++;
    ok = b.length === 6 && b.every((c) => c.size === 9)
      && Math.max(...spreads) <= 3 && oversubscribed(b).length === 0
      && n[1] === p[1] && n[2] === p[2] && n[3] === p[3]
      && Math.abs(difficulty(b) - (p[2] + 3 * p[3]) / 15) < 1e-9;
  }
  if (!ok) fails.push(p.join(","));
}
console.log(`skeletons no legal board was found for: ${fails.length}${fails.length ? " -> " + fails.join(" | ") : ""}`);
