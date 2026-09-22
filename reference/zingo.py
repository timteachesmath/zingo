import re
import os
import json
from itertools import combinations, permutations
from datetime import timedelta
from time import perf_counter

g = [["shoe", "clock", "dog", "bat", "ghost", "foot", "house", "cat", "bunny"],
     ["smile", "cake", "star", "heart", "shoe", "ball", "train", "tree", "ghost"],
     ["apple", "cat", "heart", "bird", "sun", "foot", "fish", "ball", "worm"],
     ["dog", "bird", "star", "heart", "owl", "apple", "bunny", "cake", "smile"],
     ["apple", "clock", "smile", "house", "foot", "shoe", "cup", "star", "train"],
     ["sun", "bird", "fish", "ball", "bunny", "house", "ghost", "cat", "kite"]]

r = [["dog", "bird", "smile", "clock", "cat", "cake", "house", "ball", "train"],
     ["cat", "star", "train", "heart", "dog", "cup", "worm", "shoe", "smile"],
     ["smile", "bunny", "star", "cake", "ghost", "clock", "cat", "sun", "bird"],
     ["heart", "cat", "bird", "fish", "star", "sun", "kite", "foot", "ball"],
     ["star", "fish", "ball", "kite", "shoe", "heart", "dog", "bat", "sun"],
     ["dog", "train", "sun", "ghost", "bunny", "clock", "apple", "ball", "kite"]]


C63 = 20  # C(6,3)
C62 = 15  # C(6,2)


def displayMatrix():
    gUniq = set()
    rUniq = set()
    for i in r:
        gg = []
        for j in r:
            if i == j:
                overlap = 0
            else:
                overlap = len(set(i) & set(j))
            gg.append(overlap)
        print("r", gg, sum(gg))
        rUniq |= set(i)
    print("red", len(rUniq))

    for i in g:
        gg = []
        for j in g:
            if i == j:
                overlap = 0
            else:
                overlap = len(set(i) & set(j))
            gg.append(overlap)
        print("g", gg, sum(gg))
        gUniq |= set(i)
    print("green", len(gUniq))
    print('\n', gUniq - rUniq)


def calculateMatrix(g):
    q = 0
    t = 0

    for ii, i in enumerate(g[:-1]):
        for j in g[ii+1:]:
            element = len(set(i) & set(j))
            t += element
            q += element**2
    return (t, q)


def nextCombination(n, k, c):
    if not c:
        return list(range(1, k+1))

    i = k-1
    while c[i] == n+i-k+1:
        i -= 1

    if i < 0:
        return False

    c[i] += 1
    for j in range(i+1, k):
        c[j] = c[j-1] + 1
    return c


def spreadPatterns():
    print("triples", "doubles", "T", "Q count", "minQ", "maxQ")
    for n3 in range(25):
        for n2 in range(25 - n3):
            n1 = 54 - 2*n2 - 3*n3

            if n1 < 0 or n1 > 24 or n1 + n2 + n3 > 24:
                continue

            points = howFair(n3, n2)
            if points:
                print(n3, n2, n2+3*n3, len(points), min(points), max(points))
            else:
                print(n3, n2, "(none)")


# Enumerate all six-card sets that have the given number of twos and threes.
# Returns (t,q) ordered pairs
#     t: sum of pairwise overlaps, over all C(6,2) pairs of cards
#     q: sum of squares of pairwise overlaps
#     x: t/15
#     y: sqrt( q/15 - (t/15)^2 )

def howFair(threes, twos, verbose=False):
    points = {}

    # counts is number of C(6,3) triples. Sum is threes.
    for counts in orbit_representatives(threes):

        cards = [0] * 6
        cardPairs = [0]*C62

        for jj, j in enumerate(counts):
            if j > 0:
                for i in triplePairs[jj]:
                    cardPairs[i] += j
                for i in triples[jj]:
                    cards[i-1] += j

        if max(cards) > 9:
            continue

        counts2 = [0] * C62
        loads = list(cards)

        def place(k, remaining, q, verbose):
            if k == C62:
                if remaining == 0 and q not in points:
                    points[q] = (threes, twos, counts, tuple(counts2))
                    if verbose:
                        print(3*threes + twos, q, counts,
                              tuple(counts2), len(points))
                return
            a = doubles[k][0] - 1
            b = doubles[k][1] - 1
            for v in ([remaining] if k == C62 - 1 else range(remaining + 1)):
                if loads[a] + v > 9 or loads[b] + v > 9:
                    break
                loads[a] += v
                loads[b] += v
                counts2[k] = v
                place(k + 1, remaining - v, q + 2 *
                      v * cardPairs[k] + v * v, verbose)
                loads[a] -= v
                loads[b] -= v
                counts2[k] = 0

        place(0, twos, sum(p * p for p in cardPairs), verbose)
    return points


triples = []
doubles = []

c = False
while True:
    c = nextCombination(6, 3, c)
    if c:
        triples.append(tuple(c))
    else:
        break

while True:
    c = nextCombination(6, 2, c)
    if c:
        doubles.append(tuple(c))
    else:
        break

pairIdx = {tuple(d): ii for ii, d in enumerate(doubles)}
triplePairs = [[pairIdx[(a, b)] for a, b in combinations(tri, 2)]
               for tri in triples]
tripleIndex = {t: i for i, t in enumerate(triples)}

# SOURCE[j] = the triple that lands on index j
relabel = []
for s in permutations(range(1, 7)):
    source = [0] * C63
    for i, t in enumerate(triples):
        source[tripleIndex[tuple(sorted(s[c-1] for c in t))]] = i
    relabel.append(source)

# reduces possible triples to those unique under permutation of indices


def orbit_representatives(k):
    counts = []

    def compare(source, m):
        # -1: image < counts   +1: image > counts   0: tied, or not decidable yet
        for j in range(m):
            src = source[j]
            if src >= m:
                # image[j] needs an entry not assigned yet
                return 0
            if counts[src] != counts[j]:
                return -1 if counts[src] < counts[j] else 1
        return 0

    def extend(remaining, alive):
        m = len(counts)
        if m == C63:
            if remaining == 0:
                yield tuple(counts)           # STORE
            return
        for v in ([remaining] if m == C63-1 else range(remaining + 1)):
            counts.append(v)
            survivors = []
            for source in alive:
                c = compare(source, m + 1)
                if c < 0:
                    break                     # REJECT: something in the orbit is smaller
                if c == 0:
                    # could still beat a longer prefix
                    survivors.append(source)
            else:
                yield from extend(remaining - v, survivors)
            counts.pop()

    yield from extend(k, relabel)

# --- writing results into data/exhaustive.json -------------------------------


def buildBoard(counts, counts2):
    """A real six-card board from howFair's triple and pair counts.

    Each triple count is that many tiles carried by those three cards, each
    pair count that many tiles on those two, and singles fill every card to 9.
    Returns six cards, each a sorted list of tile numbers 0-23.
    """
    cards = [[] for _ in range(6)]
    tile = 0
    for jj, n in enumerate(counts):
        for _ in range(n):
            for c in triples[jj]:
                cards[c - 1].append(tile)
            tile += 1
    for kk, n in enumerate(counts2):
        for _ in range(n):
            for c in doubles[kk]:
                cards[c - 1].append(tile)
            tile += 1
    for card in cards:
        while len(card) < 9:
            card.append(tile)
            tile += 1
    if tile > 24:
        raise ValueError(f"needs {tile} tiles, only 24 exist")
    return [sorted(card) for card in cards]


def checkBoard(board, threes, twos, q):
    """Independent check: the board really is this mix, at this q."""
    sets = [set(c) for c in board]
    if any(len(c) != 9 for c in sets):
        raise ValueError("a card does not have 9 distinct tiles")
    spread = {}
    for c in sets:
        for t in c:
            spread[t] = spread.get(t, 0) + 1
    n = [0, 0, 0, 0]
    for s in spread.values():
        if s > 3:
            raise ValueError("a tile is on more than three cards")
        n[s] += 1
    if (n[2], n[3]) != (twos, threes):
        raise ValueError(
            f"mix is {n[2]} twos, {n[3]} threes, expected {twos}, {threes}")
    overlaps = [len(a & b) for a, b in combinations(sets, 2)]
    if sum(overlaps) != 3 * threes + twos:
        raise ValueError("wrong overlap total")
    if sum(o * o for o in overlaps) != q:
        raise ValueError(
            f"board scores q={sum(o*o for o in overlaps)}, filed under {q}")


EXHAUSTIVE = os.path.join(os.path.dirname(
    __file__), "..", "data", "exhaustive.json")


def writeExhaustive(threes, twos, status="complete", notes="", path=EXHAUSTIVE):
    """Enumerate one tile mix with howFair and replace its exhaustive.json entry.

    Writes every reachable q with a board that proves it. `searchFound` and the
    other entries are left alone. Afterwards run `npm run exhaustive` to merge
    the result into data/scatter.json.
    """
    points = howFair(threes, twos)
    boards = {}
    for q in sorted(points):
        _, _, counts, counts2 = points[q]
        board = buildBoard(counts, counts2)
        checkBoard(board, threes, twos, q)
        boards[str(q)] = board

    with open(path, encoding="utf-8") as f:
        data = json.load(f)
    key = f"{twos}-{threes}"
    entry = data["compositions"][key]
    entry["status"] = status
    entry["method"] = "reference/zingo.py: writeExhaustive (orbit-reduced enumeration)"
    entry["notes"] = notes
    entry["q"] = boards

    missing = [q for q in entry["searchFound"] if str(q) not in boards]
    if missing:
        raise ValueError(
            f"{key}: the search found q={missing}, which this enumeration missed")

    # Match the formatting the TypeScript writer uses: one line per card.
    body = re.sub(
        r"\[\s+((?:\d+,?\s*)+)\]",
        lambda m: "[" + ", ".join(re.split(r",\s*", m.group(1).strip())) + "]",
        json.dumps(data, indent=2),
    )
    with open(path, "w", encoding="utf-8", newline="") as f:
        f.write(body + "\n")

    print(f"{key}: {len(boards)} values, q {min(points)}..{max(points)}, status {status}")
    return boards


def evaluateSample():
    with open(EXHAUSTIVE, encoding="utf-8") as f:
        e = json.load(f)["compositions"]
        for key in e:
            found = set(e[key]["searchFound"])
            exhaustive = {int(q) for q in e[key]["q"]}
            print(
                f"{key} [{e[key]['status']}] both={len(found & exhaustive)} "f"new={sorted(exhaustive - found)}")
        if e[key]["status"] == "complete" and found - exhaustive:
            print("   PROBLEM: search found", sorted(found - exhaustive))


if __name__ == "__main__":
    evaluateSample()
