# Rewrite: exact fairness frontier

> **Status: implemented (2026-09-10).** Kept for its rationale and its floor
> table. Shipped in `src/lib/generate.ts` (`arithmeticFloor`, `fairestAt`,
> `exactFrontier`), wired up by `scripts/sample.ts`, pinned by
> `tests/frontier.test.ts`, and `src/plane.ts` was left untouched as planned.
>
> One result came out stronger than this document predicted. It anticipated the
> frontier being provably exact only where bound and witness coincide, "verified
> at green". In fact the witness search **meets the arithmetic floor in all 18
> columns**, so the whole line is a proven optimum — including a perfectly fair
> board at x = 3.0, where all 15 pairs share exactly three tiles. The caveats at
> the foot of this file are therefore satisfied, not outstanding; the
> corresponding open question now belongs to the *ceiling*, in
> [possibility-set.md](possibility-set.md).

Replace the sampled dashed line ("fairest a set can be") with the **exact**
achievable frontier, computed rather than estimated — and get the fair-set
generator for free.

## Why

Today `scripts/sample.ts` writes `frontier` into `data/scatter.json` as the
**minimum unfairness among the boards it happened to sample** in each difficulty
column. That's a Monte-Carlo lower envelope, and it's biased *high*: sampling can
miss a rare fair board but never beat the true floor. The looseness is real —

- at green difficulty (x = 2.8) the sampled line sits near **0.54**, but the true
  floor is exactly **0.40**, reached by a real board (three pairs share 2 tiles,
  twelve share 3);
- at x = 2.4667 the sampled line reads ~0.72 against a true floor of ~0.50.

The error is worst in the crowded middle columns and vanishes at the pinched
extremes (few realizations there, so the sampled min already coincides with truth).

## What replaces it

For each difficulty column, the frontier value has a closed-form **lower bound**
plus a **realizable witness** that (where it meets the bound) makes it exact.

### 1. Arithmetic floor (closed form, a provable lower bound)

Difficulty pins the mean overlap at `x = T/15`, so minimizing the spread of the
15 pairwise overlaps means splitting `T` as **equally as possible** across the 15
pairs. With `q, r = divmod(T, 15)`, the floor profile is `r` pairs at `q+1` and
`15 − r` pairs at `q`; its standard deviation is the floor. No search needed.

| x = T/15 | T | floor split | floor stddev |
|---------:|--:|-------------|-------------:|
| 2.400 | 36 | 6×3 + 9×2 | 0.4899 |
| 2.467 | 37 | 7×3 + 8×2 | 0.4989 |
| 2.533 | 38 | 8×3 + 7×2 | 0.4989 |
| 2.600 | 39 | 9×3 + 6×2 | 0.4899 |
| 2.667 | 40 | 10×3 + 5×2 | 0.4714 |
| 2.733 | 41 | 11×3 + 4×2 | 0.4422 |
| **2.800** | **42** | **12×3 + 3×2** | **0.4000** |
| 2.867 | 43 | 13×3 + 2×2 | 0.3399 |
| 2.933 | 44 | 14×3 + 1×2 | 0.2494 |
| 3.000 | 45 | 15×3 | **0.0000** |
| 3.067 | 46 | 1×4 + 14×3 | 0.2494 |
| 3.133 | 47 | 2×4 + 13×3 | 0.3399 |
| 3.200 | 48 | 3×4 + 12×3 | 0.4000 |
| 3.267 | 49 | 4×4 + 11×3 | 0.4422 |
| 3.333 | 50 | 5×4 + 10×3 | 0.4714 |
| 3.400 | 51 | 6×4 + 9×3 | 0.4899 |
| 3.467 | 52 | 7×4 + 8×3 | 0.4989 |
| 3.600 | 54 | 9×4 + 6×3 | 0.4899 |

(x = 3.5333 is absent — the "missing tooth"; no legal set sits there.) The line is
a V bottoming at x = 3.0, where a perfectly uniform all-threes board would be
**exactly fair**.

### 2. Realizable witness (turns the bound into the exact value)

The floor is only a bound until a real board reaches it. For each column, run
local search — spread-preserving 2-swaps (swap image A on card *i* with image B on
card *j*) that reduce overlap-stddev — from a few random realizations, and keep the
best board. Store its stddev as the frontier value:

- where the witness meets the floor, the frontier is **provably exact** (green
  x = 2.8 already verified: local search reaches 0.40 with profile three-2s / twelve-3s);
- where it can't, store the best witness found (a tight *achievable* value) and flag
  the residual gap to the floor.

The witness boards are, by construction, the fairest set at each difficulty — i.e.
this step **is** the fair-set generator.

## Files touched

- **`scripts/sample.ts`** — the only real change. Replace the `min-y-per-column`
  reduction with: enumerate the 18 columns, compute each floor (closed form), run
  the witness local search, write `[x, witnessStddev]` into `frontier`. The point
  cloud (`points`) can stay sampled as-is, or be dropped in favor of the exact line.
- **`data/scatter.json`** — regenerated via `npm run sample`. **Keep the
  `frontier` shape `[[x, y], …]`** so `src/plane.ts` needs *no change* and keeps
  rendering the dashed path.
- **`src/lib/`** — factor the local-search minimizer into `src/lib/generate.ts`
  (`fairestAt(difficulty)` → witness board), so the site's future "generate a fair
  set" button and this script share one implementation.
- **`src/plane.ts`** — unchanged (reads `d.frontier` exactly as now).

### Optional (enables the generator UI)

Add a `frontierWitness` key mapping each x to its witness board, so the page can
plot "here's a fair set at this difficulty" markers on the frontier. Keep it a
*separate* key so `frontier`'s shape stays stable.

## Tests to add (`tests/frontier.test.ts`)

- `fairestAt(2.8)` returns a board with overlap-stddev **0.40** and profile
  {2:3, 3:12} — the exact green floor (regression oracle).
- every stored frontier value is **≥ its closed-form arithmetic floor** (can't beat
  the bound) and **≤ the old sampled value** (exact is at least as fair).
- x = 3.0 witness has stddev **0.0** (all pairs share exactly 3) — or the test flags
  it as an unmet bound if no uniform board exists.
- each witness board is legal (6 cards × 9 distinct tiles, supply ≤ 3) and actually
  realizes the stddev claimed for its column.

## Caveats to keep honest

- The arithmetic floor is a *lower bound*; local search yields a realizable *upper
  bound*. The frontier is provably exact only where the two coincide (they do at
  green). Elsewhere, label the stored value as "best achievable found" and report
  any gap rather than claiming exactness.
- Realizability can differ column to column; don't assume the floor is always met.
  The witness search settles each column empirically.
