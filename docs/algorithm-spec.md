# Zingo Fairness — Algorithm Requirements

The spec the generator and its test suite are written against. Everything here
is settled; the counting bounds double as test oracles.

## 1. Domain (fixed parameters)

- **24 distinct images**, **3 copies each** (72 tiles in the dispenser).
- **Two independent tiers**, never mixed in one game:
  - **Green** = the *luck* game (low overlap, gentle; good for mixed ages).
  - **Red** = the *skill* game (high overlap, contested).
- **6 cards per tier.** One fixed set each — *not* generated per player count.
  It must be fair for any **k players, k ∈ {2..6}**, i.e. for every k-subset of
  the 6 cards.
- **Each card = 9 distinct images** (3×3 grid), **no image repeats on a card**.
  So a card is a plain 9-element subset of the 24 images.

## 2. Counting bounds (derived — these are test oracles)

Let an image's **spread** = how many of the 6 cards in a tier carry it.

- Spreads sum to **54** (6 cards × 9 images).
- Supply cap: only 3 copies exist ⇒ **every spread ≤ 3**.
- Total pairwise overlap (over all 15 card-pairs) = Σ over images of
  `C(spread, 2)`. Mean pairwise overlap = that total / 15.

| Tier | Spread pattern | Mean overlap (x) | Pairwise overlaps |
|------|----------------|------------------|-------------------|
| **Green floor** | 18 images @ spread 2, 6 @ spread 3 | **2.4** | nine 2s, six 3s → **max = 3** |
| **Red ceiling** | 18 images @ spread 3, 6 unused | **3.6** | six 3s, nine 4s |
| Random baseline | — | 3.375 | (9·9 / 24) |

Consequences, both of which the tests assert:

- **Green cannot have all overlaps ≤ 2.** At least six pairs are forced to 3.
  (Your original "green ≤ 2" target is infeasible.)
- **Strict tier separation is impossible.** Best achievable is *weak*
  separation: **max(green) ≤ 3 ≤ min(red)**, with green's mass at 2 and red's
  at 4. The difficulty gap lives in the distribution, not in disjoint ranges.

## 3. The two axes

Orthogonal by construction — *level* vs *inequality* (mean income vs Gini).

### x — overlap LEVEL = luck-vs-skill dial
Mean pairwise overlap of the cards in play. Runs 2.4 (green floor) → 3.6 (red
ceiling), random at 3.375. Low overlap ⇒ players rarely want the same tile ⇒
luck. High overlap ⇒ constant contests ⇒ skill. A property of the set (or of a
k-subset).

### y — FAIRNESS = dispersion of per-card contention load
For a k-subset S in play:
- **Contention load** of card `c` = Σ over other cards `c'` in S of
  `overlap(c, c')`. (Flat count is the first cut. Optional refinement, only if
  ever validating against a sim: weight a shared tile by `1/(sharers+1)`.)
- **Fairness metric** = spread (variance or range) of the k loads.

Report **per k ∈ {2..6}**, split two ways:
- **average case at k** — expected dispersion over a uniform random k-subset.
- **worst case at k** — max dispersion over all `C(6,k)` subsets.

Key property (asserted in tests): **fairness is a 3+ player phenomenon.** At
k = 2 the two cards share the same mutual overlap, so loads are equal and
dispersion is **exactly 0** — a 2-player game is fair at any overlap level.

## 4. The two failures (narrative — kept on separate axes)

- **Green's Zingo flaw is on x, not y.** The real 5-of-9 green pair sits at
  overlap 5 — above the green max of 3, above even a proper red pair. It is
  *too skill-heavy for a luck game*, not "unfair between those two players"
  (by symmetry their game is a coin flip).
- **Fairness (y) is the 3–6 player story.** Reserve the y-axis indictment for
  the k ≥ 3 panels, where load dispersion actually bites. This split also
  explains *why the bias went unnoticed*: it's invisible at 2 players and
  compounds as the table fills.

## 5. Two generation programs (both required)

They answer different questions and the result needs both.

### Forward sampling — "where does Zingo fall"
- Sample constraint-valid 6-card sets (rejection or constructive sampler that
  respects the 72-tile inventory).
- **Two nulls:** (a) all valid sets; (b) **difficulty-matched** — only sets at
  the tier mean (2.4 / 3.6). (b) is the stronger claim: "given they were making
  an easy set, how unfairly did they distribute it?" Report both.
- Zingo's percentile in the null = **empirical p-value**. Report Monte Carlo
  error ≈ `√(p(1−p)/N)`; N must be large enough to support any tail claim.
  **Pre-commit to the metric** — no computing several and quoting the worst.

### Inverse generation — "what's achievable" (+ the printable set)
- **Do not target arbitrary (x, y) points** — the plane has holes; exact
  targeting is over-constrained and often infeasible.
- Instead **fix x to the tier budget** and **optimize y to the frontier**:
  "among sets at green difficulty, minimize unfairness."
- Seed a supply-valid set (reuse the forward sampler), then local
  search / simulated annealing: swap the image contributing most to load
  dispersion; accept swaps that reduce y while preserving the difficulty budget
  and all hard constraints. **Seed-deterministic ⇒ reproducible.**
- Also trace the **achievable-fairness frontier** (best y at each x) to draw on
  the plot, so Zingo's *vertical distance from the frontier* is the visible
  indictment (closes the "overlap-3 sets are just like that" escape).

## 6. Architecture

- **One `(x, y)` scoring function, single source of truth**, shared by the
  Python offline precompute (forward scatter → static JSON backdrop) and the
  browser live path (score a user's set + generate a new one onto the same
  plane). Same one-implementation-two-runtimes pattern as the color-puzzle
  solver.
- If forward and inverse ever score with different code, the constructed dot
  won't sit where the math says and the whole figure loses credibility. Unit-
  test the scoring function hard.

## 7. Hard constraints (a set is invalid if any fails)

1. Exactly 6 cards.
2. Each card holds exactly 9 images, all distinct (no on-card repeats).
3. No image appears on more than 3 cards (supply cap).
4. Images drawn only from the fixed pool of 24.

## 8. Test oracles (the point of the whole project)

- **Sampler properties:** every sample → 6 cards; 9 distinct images per card;
  no image on > 3 cards; spreads sum to 54; images from the pool of 24.
- **Bound oracles:** optimal green → mean == 2.4 and max pairwise ≤ 3; optimal
  red → mean == 3.6 and overlaps ⊆ {3, 4}. The generator's best output must
  meet or provably approach the bound.
- **Fairness invariants:** load dispersion == 0 for every k = 2 subset; ≥ 0
  always.
- **Determinism:** same set → same (x, y); same seed → same generated set.
- **Characterization / regression:** feed the *real* Zingo green cards → the
  metric flags the 5/9 pair (overlap 5 > green max 3). Requires the actual
  Zingo card contents as a committed fixture.
- **Statistics hygiene:** Monte Carlo error reported alongside every p-value.
- **Enumerator oracle (§10):** the spread-pattern enumerator returns exactly
  **37** patterns across **18** x-columns; green floor (T=36) and red ceiling
  (T=54) each come back **unique**; **T=53 (x≈3.533) is absent**.

## 9. Inputs still needed from you

- The **actual Zingo green and red card contents** (from your blog analysis) —
  needed both as the guideposts on the x-axis and as the regression fixture in
  §8.

## 10. Spread-pattern enumeration — the x skeleton

A **spread pattern** is `(n0, n1, n2, n3)` = how many of the 24 images sit at
spread 0, 1, 2, 3, subject to `Σ ni = 24` and `Σ i·ni = 54`. There are exactly
**37**. Total overlap `T = n2 + 3·n3` and `x = T/15` depend *only* on the
pattern — never on how images are assigned to cards. So the 37 patterns are the
**difficulty skeletons**: each fixes x, and *all of fairness (y) is the freedom
within a skeleton*. That is the precise reason the two axes are independent.

By number of used images `s` (spread ≥ 1): s=18→1, 19→2, 20→4, 21→5, 22→7,
23→8, 24→10  (= 37). Unused images (spread 0) are essential — the red-heavy
patterns need the spares.

| x = T/15 | T | #pat | patterns (n0,n1,n2,n3) |
|---------:|--:|-----:|------------------------|
| 2.400 | 36 | 1 | (0,0,18,6) ← **green floor, unique** |
| 2.467 | 37 | 1 | (0,1,16,7) |
| 2.533 | 38 | 1 | (0,2,14,8) |
| 2.600 | 39 | 2 | (0,3,12,9), (1,0,15,8) |
| 2.667 | 40 | 2 | (0,4,10,10), (1,1,13,9) |
| 2.733 | 41 | 2 | (0,5,8,11), (1,2,11,10) |
| 2.800 | 42 | 3 | (0,6,6,12), (1,3,9,11), (2,0,12,10) |
| 2.867 | 43 | 3 | (0,7,4,13), (1,4,7,12), (2,1,10,11) |
| 2.933 | 44 | 3 | (0,8,2,14), (1,5,5,13), (2,2,8,12) |
| 3.000 | 45 | 4 | (0,9,0,15), (1,6,3,14), (2,3,6,13), (3,0,9,12) |
| 3.067 | 46 | 3 | (1,7,1,15), (2,4,4,14), (3,1,7,13) |
| 3.133 | 47 | 2 | (2,5,2,15), (3,2,5,14) |
| 3.200 | 48 | 3 | (2,6,0,16), (3,3,3,15), (4,0,6,14) |
| 3.267 | 49 | 2 | (3,4,1,16), (4,1,4,15) |
| 3.333 | 50 | 1 | (4,2,2,16) |
| 3.400 | 51 | 2 | (4,3,0,17), (5,0,3,16) |
| 3.467 | 52 | 1 | (5,1,1,17) |
| *3.533* | *53* | *0* | **— unreachable (missing tooth) —** |
| 3.600 | 54 | 1 | (6,0,0,18) ← **red ceiling, unique** |

Structural facts (each a usable check or a plotting decision):

- **x is quantized into 18 columns**, not continuous: T = 54 − s + n3 hits every
  integer 36–52, skips 53, then 54. You cannot build a set that sits just below
  the red ceiling.
- **Both extremes are unique**; pattern count swells toward the interior. This
  is the combinatorial root of the **pinched envelope** — at the ends a single
  skeleton leaves almost no room for fairness to vary; the middle has many.
- **The plane is not symmetric.** The green half (2.4→3.0) is a clean staircase
  1,1,1,2,2,2,3,3,3,4; the red half (3.0→3.6) is lumpy — 4,3,2,3,2,1,2,1,1 — and
  ends with the isolated ceiling past the gap. Expect the achievable-fairness
  frontier to be asymmetric; don't assume a mirror around x=3.
- **Peak flexibility is at x = 3.0** (T=45, 4 skeletons) — the modal difficulty
  where fairness has the most structural room.
- **The 3.375 "random baseline" is itself unachievable** — it lands between
  columns 50 (3.333) and 51 (3.400). "Random" as one number is a fiction here;
  realizable means quantize around it. Worth a footnote on the scatter so the
  guidepost isn't mistaken for an attainable set.
