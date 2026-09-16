# `data/`

Three files: two hand-maintained fixtures and one generated artifact.

| file | source | edit by hand? |
|---|---|---|
| `zingo-red.txt` | the retail red sheet | yes — it is the fixture |
| `zingo-green.txt` | the retail green sheet | yes — it is the fixture |
| `scatter.json` | `npm run sample` | **no** — regenerate instead |

## Why the data looks like this

**Integers, not floats.** The plane's axes are derived quantities:

```
t = Σ oᵢⱼ        (the 15 pairwise overlaps)   ->  x = t / 15
q = Σ oᵢⱼ²                                    ->  y = √(q/15 − (t/15)²)
```

so every point is carried as the exact integer pair `(t, q)` alongside its
rendered `(x, y)`. That is what makes "two boards land on the same point" an
equality test rather than an epsilon comparison, and what lets the frontier
search stop on `q === floor` and call the result *proven* rather than
*approximated*. It also exposes structure that floats hide — every board
satisfies `q ≡ t (mod 2)`, because `q = t + 2·Σ C(oᵢⱼ, 2)`.

**Boards as 24 base64 characters.** A card is a 24-bit mask over the tile pool;
six cards pack to 18 bytes, encoded four base64 characters per card. That keeps
~3,400 witness boards to about 91KB — small enough to inline, so the page needs
no second request and no database. Decoding is `decodeBoard()` in
`src/lib/generate.ts`, which names tiles from the real 24-image pool.

**Proven and found are kept apart.** The frontier is a closed-form bound with a
constructed witness in every column: nothing can beat it. Everything else — the
interior of the possibility set, and its upper edge — is whatever the search
reached. The file records which is which (`frontierExact`, `ceilingExact`) and
**the UI is obliged to respect the distinction**: a composition with no witness
reads "none found", never "impossible".

**One source of truth.** Both retail markers are scored from the `.txt` fixtures
by the same `src/lib` functions the browser uses, rather than written here as
literals, so a dot cannot drift from the board it claims to represent. A test
asserts the two agree.

## `zingo-red.txt`, `zingo-green.txt`

Nine whitespace-separated rows of six tiles. **Columns are cards**, so the file
reads the way a physical Zingo sheet does and column *c* is card *c*.

```
dog   cat   smile heart star  dog
bird  star  bunny cat   fish  train
...
```

Parsed by `parseSheet()`. These are the single copy of each retail board — the
page, `scripts/sample.ts`, and `tests/zingo-regression.test.ts` all read them.

## `scatter.json`

One JSON object, nine keys. Written by `scripts/sample.ts` (~2.5 min), consumed
by `src/plane.ts` via the `Scatter` interface, which is the authoritative type.

### `points` — `[x, y, t, q][]`

Every reachable point, one entry per lattice coordinate. 1,713 of them.

```json
[2.8, 1.1075, 42, 136]
```

A **lower bound**, not a census: each point is backed by a witness board, but
the search is not exhaustive and more points certainly exist. The count moves
with the search budget and is not monotone in it.

### `frontier` — `[x, y][]`

The exact fairness floor, one entry per difficulty column (18). This is the
only part of the plane that is **proven**: `y` is the closed-form minimum for
that column and a constructed board reaches it. Its shape predates the
possibility set and is kept stable so `src/plane.ts` renders it unchanged.

### `frontierExact` — `boolean`

`true` when every column's witness met the arithmetic bound — i.e. the frontier
is a proven optimum everywhere, not merely the best found.

### `ceilingExact` — `boolean`

`false`, and expected to stay so. The top barrier has no closed form; it is
exact only where a construction saturates it (x = 3.60, two "clone-triples",
y = 4.409) and best-found elsewhere. Anything drawn from the upper edge must be
labelled accordingly.

### `columns` — `{ [t]: { x, comps } }`

Keyed by overlap total. `comps` lists **every spread composition at that
difficulty** as `[singles, doubles, triples]` — tiles carried by one, two and
three cards.

```json
"42": { "x": 2.8, "comps": [[0,12,10], [3,9,11], [6,6,12]] }
```

This half is **exact**: it comes from enumerating the 37 skeletons, not from a
search. A composition's position in `comps` is its index, referenced by
`detail`. Counts run 1 to 4 per column.

### `detail` — `{ "t:q": [[compositionIndex, board], …] }`

Keyed `"t:q"`, matching a point. Each entry is a composition that a board was
**actually found for**, paired with that board.

```json
"42:136": [[0, "RGA9qHAjA4pZdIyCiD3AE8cE"], [2, "…"]]
```

`compositionIndex` indexes `columns[t].comps`. `board` is the 24-character
encoding above. An index absent here means the search did not reach this point
that way — **not** that no such board exists.

### `zingo_red`, `zingo_green` — `[x, y, worstPair]`

The two retail sets, scored from the fixtures.

```json
"zingo_red":   [3.5333, 1.0873, 6]
"zingo_green": [2.8,    1.1075, 5]
```

Red sits at t = 53, the "missing tooth" — a difficulty no legal set can reach,
so it has no column in `columns` and no floor.

### `guides` — reference constants

```json
{ "green_floor": 2.4, "random": 3.375, "red_ceiling": 3.6, "tooth": 53/15 }
```

Only `tooth` is currently plotted (the hatched "no legal set exists here"
stripe). The rest are carried for annotation that has not been built yet. Note
that `random` is itself **unachievable** — 3.375 falls between the columns at
3.3333 and 3.4000 — so if it is ever drawn it needs a footnote saying so.

## Regenerating

```bash
npm run sample
```

Seeded throughout, so a run reproduces rather than churning the whole file.
Changing the search budget in `scripts/sample.ts` changes the point count; see
`docs/possibility-set.md` for how that count behaves and why it has not
converged.
