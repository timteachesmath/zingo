# `data/`

Three sources and one file built from them. `exhaustive.json` is where the
result lives; `scatter.json` is what the page reads.

| file | source | edit by hand? |
|---|---|---|
| `zingo-red.txt` | the retail red sheet | yes — it is the fixture |
| `zingo-green.txt` | the retail green sheet | yes — it is the fixture |
| `exhaustive.json` | `reference/zingo.py`, one tile mix at a time | yes, except `searchFound` |
| `scatter.json` | `npm run exhaustive`, from the three above | **no** — rebuild instead |

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
~3,500 witness boards to about 89KB — small enough to inline, so the page needs
no second request and no database. Decoding is `decodeBoard()` in
`src/lib/generate.ts`, which names tiles from the real 24-image pool.

**Proven, not sampled.** The frontier is a closed-form bound with a constructed
witness in every column: nothing can beat it. The rest of the plane is a census
too — every one of the 37 tile mixes has been enumerated in full, so the points
are all the points there are (`frontierExact` and `ceilingExact` both true).
While a mix was still unenumerated its dots came from a local search, and
**the UI was obliged to respect the difference**: a composition with no witness
read "none found", never "impossible". Nothing on the page reads that way now;
a composition that cannot reach a point is simply not listed there.

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
page, the data scripts, and `tests/zingo-regression.test.ts` all read them.

## `scatter.json`

One JSON object, nine keys. Written by `scripts/build-data.ts` (seconds), consumed
by `src/plane.ts` via the `Scatter` interface, which is the authoritative type.

### `points` — `[x, y, t, q][]`

Every reachable point, one entry per lattice coordinate. 1,728 of them.

```json
[2.8, 1.1075, 42, 136]
```

Backed by a witness board each, and complete: every mix is enumerated, so
these are every point a legal set can occupy. A coordinate absent here is
unreachable.

### `frontier` — `[x, y][]`

The exact fairness floor, one entry per difficulty column (18). This is the
only part of the plane that is **proven**: `y` is the closed-form minimum for
that column and a constructed board reaches it. Its shape predates the
possibility set and is kept stable so `src/plane.ts` renders it unchanged.

### `frontierExact` — `boolean`

`true` when every column's witness met the arithmetic bound — i.e. the frontier
is a proven optimum everywhere, not merely the best found.

### `ceilingExact` — `boolean`

`true`: all 37 mixes in `exhaustive.json` are complete, so the top edge is a
proven maximum (σ = 4.4091 at x = 3.60) rather than the best the search reached.
`npm run exhaustive` sets it from the data, so it would return to `false` if a
mix were reopened.

### `columns` — `{ [t]: { x, comps, exact } }`

Keyed by overlap total. `comps` lists **every spread composition at that
difficulty** as `[singles, doubles, triples]` — tiles carried by one, two and
three cards.

```json
"42": { "x": 2.8, "comps": [[0,12,10], [3,9,11], [6,6,12]], "exact": [0,1,2] }
```

This half is **exact**: it comes from enumerating the 37 skeletons, not from a
search. A composition's position in `comps` is its index, referenced by
`detail`. Counts run 1 to 4 per column.

`exact` lists the compositions marked complete in `exhaustive.json` — now all
of them, in every column. For those, `detail` is the full truth, so the page
leaves a composition out of a point's list when it cannot reach that point.

### `detail` — `{ "t:q": [[compositionIndex, board], …] }`

Keyed `"t:q"`, matching a point. Each entry is a composition that can build
that point, paired with a board proving it. Since every mix is enumerated, the
list is exhaustive: a composition missing here cannot reach that point.

```json
"42:136": [[0, "RGA9qHAjA4pZdIyCiD3AE8cE"], [2, "…"]]
```

`compositionIndex` indexes `columns[t].comps`, and `board` is the 24-character
encoding above. The page lists only the compositions named here, so a reader
never sees an option that cannot be built.

The page decodes boards and then gives the tiles random names, seeded from the
board. The encoding numbers tiles in the order the generator placed them, so
without that the names would track how many cards a tile is on.

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

## `exhaustive.json`

Exhaustive results, one spread pattern at a time, and the source the chart is
built from. A search can only say what it *found*; this file records what an
enumeration *proves*. All 37 patterns are complete. The page never reads it:
`npm run exhaustive` turns it into `scatter.json`.

```json
{
  "compositions": {
    "6-12": {
      "n0": 0, "n1": 6, "n2": 6, "n3": 12, "t": 42,
      "status": "complete",
      "method": "reference/zingo.py: orbit-reduced enumeration",
      "notes": "",
      "q": {
        "120": [[3, 4, 7, 9, 12, 14, 16, 18, 20], …six cards…],
        "122": [ … ]
      },
      "searchFound": [120, 122, 124, …]
    }
  }
}
```

- **Key** `"n2-n3"`: the number of tiles on two cards and on three. With 54
  cells and 24 tiles, those fix `n1` and `n0`, so the key names the pattern.
  All 37 patterns are present.
- **`n0`–`n3`, `t`**: the pattern and its overlap total (`t = n2 + 3·n3`).
  Written by the script.
- **`status`**: `"open"` (nothing enumerated yet), `"partial"` (some values
  entered, not yet exhaustive) or `"complete"` (`q` lists every reachable
  value for this pattern). Yours to set.
- **`method`, `notes`**: how the result was produced and anything worth
  knowing. Yours to set.
- **`q`**: each reachable `q` (as a string key) mapped to one example board.
  A board is six cards, each a list of nine tile numbers 0–23. Numbering is
  the order of `TILES` in `src/lib/tiles.ts`, but any consistent 0–23 labelling
  works, because only which cards share a tile matters. For a complete entry,
  every parity-allowed value missing from `q` is unreachable for this pattern.
- **`searchFound`**: the `q` values the local search found with this pattern,
  before any merge. Written by the original search (see Regenerating); don't edit it.

`tests/exhaustive.test.ts` checks every board: six cards of nine distinct
tiles, no tile on more than three cards, the stated pattern, overlap total `t`,
and sum of squares equal to its key. A `"complete"` entry must also include
every value in `searchFound`, since the search only reports values it has a
board for. The test also checks that the file has been merged into
`scatter.json`.

All 37 mixes are complete. The first to be finished, `6-12`, is also the
smallest check on the method: the enumeration returned exactly the 104 values
the search had already found.

## Regenerating

```bash
npm run exhaustive   # rebuild scatter.json from exhaustive.json (seconds)
```

Run it after editing `exhaustive.json`. It recomputes the frontier, the retail
markers and the mix lists, merges every enumerated result, and keeps your
entries. Running it twice produces the same file.

While any mix is still `open`, its dots come from the original local search and
are carried over from the existing `scatter.json` — that search is no longer
part of the build. It is kept as an artifact at `reference/sample-search.ts`
and can still be run with `npm run sample` (about two minutes, seeded) to
rebuild those dots and rewrite `searchFound` from scratch.

Once all 37 mixes are `complete`, `npm run exhaustive` builds the chart from
`exhaustive.json` alone and sets `ceilingExact` to true: every dot proven, none
merely found.

A merge that adds a value makes a new point. Removing a value from
`exhaustive.json` removes its board on the next rebuild.
