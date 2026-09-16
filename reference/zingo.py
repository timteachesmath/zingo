from itertools import combinations,permutations

g =[["shoe", "clock", "dog", "bat", "ghost", "foot", "house", "cat", "bunny"],
["smile", "cake", "star", "heart", "shoe", "ball", "train", "tree", "ghost"],
["apple", "cat", "heart", "bird", "sun", "foot", "fish", "ball", "worm"],	
["dog", "bird", "star", "heart", "owl", "apple", "bunny", "cake", "smile"],
["apple", "clock", "smile", "house", "foot", "shoe", "cup", "star", "train"],
["sun", "bird", "fish", "ball", "bunny", "house", "ghost", "cat", "kite"]]

r = [["dog", "bird", "smile", "clock", "cat", "cake", "house", "ball", "train"], 
     ["cat", "star", "train", "heart", "dog", "cup", "worm", "shoe", "smile"], 
     ["smile", "bunny", "star", "cake", "ghost", "clock","cat","sun","bird"], 
     ["heart", "cat", "bird", "fish", "star", "sun", "kite", "foot", "ball"],
     ["star", "fish", "ball", "kite", "shoe", "heart", "dog", "bat", "sun"], 
     ["dog", "train", "sun", "ghost", "bunny", "clock", "apple", "ball", "kite"]]


C63 = 20 # C(6,3)
C62 = 15 # C(6,2)




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
        print("r",gg,sum(gg))
        rUniq |= set(i)
    print("red",len(rUniq))

    for i in g:
        gg = []
        for j in g:
            if i == j:
                overlap = 0
            else:
                overlap = len(set(i) & set(j))
            gg.append(overlap)
        print("g",gg,sum(gg))
        gUniq |= set(i)
    print("green",len(gUniq))
    print('\n', gUniq - rUniq)

def calculateMatrix(g):
    q = 0
    t = 0

    for ii,i in enumerate(g[:-1]):
        for j in g[ii+1:]:
            element = len(set(i) & set(j))
            t += element
            q += element**2
    return (t,q)


def nextCombination(n,k,c):
    if not c:
        return list(range(1,k+1))

    i = k-1
    while c[i] == n+i-k+1:
        i -= 1

    if i < 0: 
        return False;

    c[i] += 1
    for j in range(i+1,k):
        c[j] = c[j-1] + 1
    return c


def spreadPatterns(): 
    print("triples","doubles","T","Q count","minQ","maxQ")
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

def howFair(threes,twos):
    points = {}

    # counts is number of C(6,3) triples. Sum is threes.
    for counts in orbit_representatives(threes):

        cards = [0] * 6
        cardPairs = [0]*C62

        for jj,j in enumerate(counts):
            if j > 0: 
                for i in triplePairs[jj]:
                    cardPairs[i] += j
                for i in triples[jj]:
                    cards[i-1] += j

        if max(cards) > 9:
            continue

        # d = False
        # while True:
        #     d = nextCombination(C62 + twos -1 ,C62 - 1, d)
        #     if not d:
        #         break

        #     counts2 = [d[0]-1]
        #     for i in range(1,C62-1):
        #         counts2.append(d[i] - d[i-1] - 1)
        #     counts2.append(C62 + twos - 1 - d[-1])


        #     loads = list(cards)
        #     bad = False
        #     for ii,i in enumerate(counts2):
        #         if i > 0: 
        #             a = doubles[ii][0] - 1
        #             b = doubles[ii][1] - 1
        #             loads[a] += i 
        #             loads[b] += i 
        #             if loads[a] > 9 or loads [b] > 9:
        #                 bad = True
        #                 break
        #     if bad:
        #         continue

        #     cardPairsSum = [first + second for first, second in zip(cardPairs,counts2)]
            
        #     t = sum(cardPairsSum)
        #     q = sum(i**2 for i in cardPairsSum)

        #     if q in points:
        #         continue

        #     points[q] = (threes,twos,counts,counts2)
        #     print(3*threes + twos,q,counts,counts2, len(points))

        counts2 = [0] * C62
        loads = list(cards)

        def place(k, remaining, q):
            if k == C62:
                if remaining == 0 and q not in points:
                    points[q] = (threes, twos, counts, tuple(counts2))
                    #print(3*threes + twos, q, counts, tuple(counts2), len(points))
                return
            a = doubles[k][0] - 1
            b = doubles[k][1] - 1
            for v in ([remaining] if k == C62 - 1 else range(remaining + 1)):
                if loads[a] + v > 9 or loads[b] + v > 9:
                    break
                loads[a] += v
                loads[b] += v
                counts2[k] = v
                place(k + 1, remaining - v, q + 2 * v * cardPairs[k] + v * v)
                loads[a] -= v
                loads[b] -= v
                counts2[k] = 0

        place(0, twos, sum(p * p for p in cardPairs))
    return points


triples = []
doubles = []

c = False
while True:
    c = nextCombination(6,3,c)
    if c:
        triples.append(tuple(c))
    else:
        break

while True:
    c = nextCombination(6,2,c)
    if c:
        doubles.append(tuple(c))
    else:
        break

pairIdx = {tuple(d): ii for ii, d in enumerate(doubles)}
triplePairs = [[pairIdx[(a, b)] for a, b in combinations(tri, 2)] for tri in triples]
tripleIndex = {t:i for i,t in enumerate(triples)}

# SOURCE[j] = the triple that lands on index j
relabel = []
for s in permutations(range(1,7)):
    source = [0] * C63
    for i,t in enumerate(triples):
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
                return 0                      # image[j] needs an entry not assigned yet
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
                    survivors.append(source)  # could still beat a longer prefix
            else:
                yield from extend(remaining - v, survivors)
            counts.pop()

    yield from extend(k, relabel)

if __name__ == "__main__":
    displayMatrix()


