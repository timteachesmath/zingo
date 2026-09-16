# Plan: the exact possibility set, and the explorable plane

> **Status: implemented (2026-09-11).** `possibilitySet()` / `reachableAt()` /
> `decodeBoard()` live in `src/lib/generate.ts`; `scripts/sample.ts` writes the
> lattice, `src/plane.ts` plots and points at it, `src/main.ts` renders the
> bubble and the card box, and `tests/possibility.test.ts` enforces the honesty
> contract below. Shipped numbers: **1,713 reachable points** with a witness
> board per point-and-composition, ~165KB of data in total.
>
> Two things landed differently from this plan:
> - A random walk never finds the floor (at t = 45 it is a single board), so
>   `reachableAt` branches at the end of each walk — one copy climbs toward the
>   barrier, one descends — and additionally seeds `fairestAt()`'s proven
>   witness. The lower edge is the exact frontier *by construction*, not by luck.
> - The point set does not converge: a bigger search budget keeps finding a few
>   more points (1,656 at the base budget, 1,724 across every run so far, 1,713
>   shipped). `reachableAt` gained a `passes` option and unions independent runs,
>   because the search is not monotone in budget. Nothing may call this set
>   complete.
> - The paste-and-score panel this plan reused was removed on 2026-09-11. The
>   card box re-scores the board it displays with the same `src/lib`, so the
>   self-verification survives without the textarea.
> - Hover alone could not drive the interaction: reaching a button means dragging
>   the cursor across other dots, which kept re-targeting and rebuilt the bubble
>   under the pointer. Hovering now previews and **clicking pins**; only a pinned
>   bubble takes pointer events. Escape or the × dismisses it.

Two changes that are really one piece of work:

1. Replace `points` in `data/scatter.json` — currently 3,200 Monte-Carlo samples —
   with the **(difficulty, unfairness) pairs a legal board can actually reach**,
   computed by this repo rather than imported from a binary.
2. Make the plane **explorable**: hovering a point reveals the spread
   compositions that live at that difficulty, and clicking loads a real board
   representing that point into the scorer.

They are one workstream because the interaction determines the data shape. The
possibility set alone is 1,700-odd integer pairs; the hover is what makes it
worth storing a witness board per composition alongside them.

This is roadmap item 3, and it absorbs the outstanding UI half of item 2 — see
"What this gets for free" below.

## Why the sampled cloud has to go

The cloud shows *possibility* badly and *frequency* not at all — it is a uniform
sample over spread patterns, which is neither. Since the frontier became exact
(see [frontier-rewrite.md](frontier-rewrite.md)), the mismatch is now visible: at
x = 3.0 the dashed line touches zero while the nearest sampled dot floats about
120px above it. A reader can reasonably take that gap for a rendering bug.

It also blocks the interaction outright. In a sampled cloud many dots collide on
the same `(t, q)` and others are noise, so "hover a dot" has no well-defined
referent. **One dot must equal one lattice point.** The possibility set therefore
has to land before any of the interaction work starts.

## The integer lattice

Work in `(t, q)`, not `(x, y)`:

- `t` = total pairwise overlap = `Σ o_ij` over the 15 pairs. `x = t/15`.
- `q` = **sum of squared overlaps** = `Σ o_ij²`.
- `y = sqrt(q/15 − (t/15)²)`.

So `(t, q)` is an exact integer coordinate for a point on the plane, and `q` is
precisely what `descend()` in `src/lib/generate.ts` already minimizes.

Two facts about this lattice, both worth encoding as tests:

1. **Parity.** `q = t + 2·Σ C(o_ij, 2)`, so **`q ≡ t (mod 2)`**. Half the
   integers in each column's range are unreachable for a structural reason, not
   a sampling one. Verified across all 40,910 boards in the reference DB.
2. **The floor is closed-form and proven.** `min q` per column is the balanced
   split (`arithmeticFloor`), and a witness board reaches it in all 18 columns.

## What is NOT known

**`max q` has no closed form.** Maximizing unfairness means concentrating
overlap, which collides with the supply cap. The key identity is
`q = t + 2·Σ C(oᵢⱼ, 2)` with each `oᵢⱼ ≤ 3`, and the barrier is exact only
where a construction saturates it —
`x = 3.6` via two "clone-triples", `y = 4.409`.

Nor are the columns contiguous runs of the parity-allowed values. Some interior
gaps may be real; others are certainly search misses. **We do not know which**,
and neither the data nor the UI may pretend otherwise.

How unsettled: three exploration runs at different seeds found 1,701 / 1,709 /
1,715 points. The set is stable to about half a percent and is *not* proven
complete.

## Do not ship `reference/boards.db`

The earlier pass's SQLite of 40,910 boards is a useful *cross-check* — its per-column
`MIN(q)` matches our closed-form floor in all 18 columns, independently
confirming the frontier. It is **not** a source of truth for the possibility set:

- **It is incomplete, measurably.** A few seconds of random 2-swap walks plus
  greedy ascents from this repo's own code found **86 `(t,q)` points it never
  recorded**, and raised the top barrier in **6 of 18 columns** — at x = 2.5333
  from y = 3.1595 to 3.3639, at x = 2.8 from 3.6914 to 3.8678. It also holds 6
  points our search missed. Union: 1,715. Neither set is complete.
- **It has no generator.** Nothing in this repo or its history produces it, so it
  can't be regenerated, audited, or extended. That breaks the project's own
  "seed-deterministic ⇒ reproducible" rule.
- **Wrong shape for the target.** 483KB of SQLite needs ~1MB of sql.js WASM to
  query in a browser, to deliver what is really ~13KB of integer pairs.

`reference/possibility-view.html` therefore overclaims: its "Every possible
Zingo set / 1,629 reachable points" is a best-found set, not the possibility
set, and this repo disproves the count in seconds. Fix that wording when the
view is rebuilt.

---

# Part 1 — the data

## What to build

1. **`reachableAt(total, opts)` in `src/lib/generate.ts`** — returns the `q`
   values found in one column, each with the compositions that reached it and a
   witness board per composition. Reuse the existing mask/`moves` machinery:
   random restarts across every spread pattern in the column, random 2-swap
   walks recording each `q` passed through, plus greedy ascent toward the
   barrier (walks alone rarely reach it) and the existing greedy descent.
   Seeded, like `fairestAt()`.
2. **`possibilitySet(opts)`** — `reachableAt` over all 18 columns.
3. **`scripts/sample.ts`** — replace the `points` block. Keep the key name
   `points` and a leading `[x, y, …]` shape so `src/plane.ts` keeps rendering
   without a rewrite, exactly as the frontier rewrite did.
4. **Honesty in the data.** Emit `ceilingExact: false` alongside the existing
   `frontierExact: true`, and label the upper edge "best found" wherever it is
   drawn. The floor may be called exact; the ceiling may not.
5. **Retire `worstPair`** from the point tuples if nothing reads it — a lattice
   point is a class of boards, not one board, so a single `worstPair` no longer
   makes sense there. It belongs on the witness instead.

## Payload

A board packs to **24 base64 characters**: 6 cards × a 24-bit tile mask = 18
bytes. Measured over a full exploration:

| | |
|---|---|
| reachable points | ~1,700 |
| `(point, composition)` pairs needing a witness | ~3,430 |
| naive JSON tile-ids | ~677 KB |
| **packed base64 masks** | **~121 KB** |

121KB inlines comfortably. No lazy-loading, no fetch-detail-on-interaction, no
second request. (Example witness: `RGA9qHAjA4pZdIyCiD3AE8cE`.)

---

# Part 2 — the interaction

## What hover shows, and the one trap

At a given difficulty there are between **1 and 4** spread compositions
(`n1, n2, n3` = tiles on one, two, three cards). That count is **exact** —
`spreadPatterns()` filtered by `t`, no search involved.

Which of them reach a *specific* `(t, q)` is **empirical**. Measured:

| compositions reaching the point | points |
|---|---|
| `1 of 1` — only one exists at that difficulty | 472 |
| `2 of 2`, `3 of 3`, `4 of 4` — all of them | 1,037 |
| **`1 of 2`, `1 of 3`, `2 of 3`, `3 of 4`, …** — only some | **192** |

**The trap:** those 192 partial-coverage points are exactly where a tooltip
would be most tempting to phrase as fact — and exactly where it is least
entitled to. "Reachable 1 of 3 ways" may only mean *our search found one*. Given
the point set itself moves by half a percent between seeds, per-point
composition coverage certainly does too.

Rendering a search miss as a mathematical exclusion is the worst class of bug
this project can ship: invisible, confident, and fatal to the credibility the
whole figure rests on. So the UI must carry the split in its own words:

```
Difficulty 3.00 · 4 compositions exist here
  ✓  9 singles, 0 doubles, 15 triples   — board available
  ✓  6 singles, 3 doubles, 14 triples   — board available
  ○  3 singles, 6 doubles, 13 triples   — none found
  ○  0 singles, 9 doubles, 12 triples   — none found
```

"Exist" is proven. "Found" is empirical and says so. **Never render an absence
as an impossibility.**

## What click does

Load the witness board for the chosen composition into the existing paste-and-
score panel and let the normal scorer run it.

This is self-verifying by construction: the scorer computes `(x, y)` with the
same `src/lib` the data was generated from, so the "your set" marker lands
exactly on the dot that was clicked. The proof is the feature.

Render the 6×9 grid with **real tile names**, not `t0…t23`. The red fixture
yields 22 of the 24 images; the green fixture prints all 24, supplying the last
two (owl and tree). The full list is in `src/lib/tiles.ts`.

## Mechanics

- **Hit-testing:** nearest point in data space by linear scan on `mousemove`.
  ~1,700 distance computations is ~0.1ms; no quadtree, no per-dot handlers, no
  `pointer-events` on 1,700 circles.
- **Keyboard:** the plane is currently `role="img"` with an `aria-label`. Making
  it interactive obliges a keyboard path — arrow keys stepping point to point,
  Enter to load. Do not ship the mouse half alone.
- **Touch:** tap = hover + select in one gesture; the tooltip must not depend on
  a hover state that never ends.

## What this gets for free

Roadmap item 2's outstanding piece is "a UI control that drops a fair set onto
the frontier." That falls out of this work: the frontier is the bottom edge of
the possibility set, so clicking a point on it loads the fairest board at that
difficulty — which is exactly what `fairestAt()` already returns. Item 2 closes
when item 3 does, with no separate control.

## Tests to add

`tests/possibility.test.ts`:

- Every emitted `(t, q)` satisfies `q ≡ t (mod 2)`.
- Every emitted `q ≥ arithmeticFloor`'s `q`, and each column's minimum equals it
  exactly — the possibility set's lower edge *is* the frontier.
- `t = 53` never appears.
- Point count is stable for a fixed seed (reproducibility).
- **Every shipped witness scores to the point it is filed under**:
  `score(decode(witness))` → that exact `(t, q)`. This makes a whole class of
  data-corruption bug impossible, and it is the same assertion the click
  interaction demonstrates live.
- Every witness board is legal: 6 cards, 9 distinct tiles each, supply ≤ 3.
- Each witness actually realizes the composition it is filed under.
- One-off audit (not CI — it needs `boards.db`, which is not committed): every `(t, q)` in
  `reference/boards.db` is reproduced by `possibilitySet()`. Any DB point we
  cannot re-find is a search-coverage bug worth knowing about.

## Build order

1. `possibilitySet()` — emit `(t, q, compositions[], witnesses[])` in one pass.
2. Regenerate `scatter.json`; `plane.ts` renders the lattice instead of the cloud.
3. Nearest-point hover + tooltip with the exists/found split.
4. Click → real tile names → scorer → marker lands on the dot.
5. Tests above.

## Open question worth settling first

Are the interior gaps real? A targeted search — for each parity-allowed `q`
between floor and best-found ceiling, try to construct a board hitting exactly
that `q` — would either close them or establish them as genuine holes. Same
question decides how confidently the hover can speak: if the gaps close, the
`✓ / ○` split narrows to almost nothing and the tooltip gets much stronger. It
is also a genuinely interesting recreational-math result either way.
