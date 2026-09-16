# Article outline — *Dead on Arrival: Supply Shortages and Guaranteed Losers in a Children's Bingo Game*

A recreational-mathematics article on the fairness and feasibility of **Zingo!**
(ThinkFun). Working draft outline with candidate references.

**Candidate venues:** *Math Horizons*, *The College Mathematics Journal*, *The
Mathematical Intelligencer* (recreational section), *Recreational Mathematics
Magazine*, *Journal of Humanistic Mathematics*. (*Math Horizons* is the closest
fit — it already publishes matching-card-game pieces, e.g. Polster's "The
intersection game.")

**Scope note (state up front):** the analysis is of the standard **6
double-sided-card** edition, 9 image cells per card, 24 image types × 3 tiles =
72 tiles. Editions with a different card count exist; all counts below assume
six cards (hence C(6,2)=15 card-pairs).

---

## Abstract (draft)

Zingo! is a bingo variant for ages 4+ in which a dispenser reveals two picture
tiles at a time and players race to claim matches. Its cards come in an "easy"
(green) and "hard" (red) side that differ in how many images they share. We show
that the shared-image count is the single design parameter governing both
difficulty and fairness, derive the achievable range of that parameter under the
game's fixed tile supply, and prove that the retail red set sits at a value that
is *unreachable* without oversubscribing the supply. The consequence is a
pigeonhole theorem: at a full six-player table, two to three players are
mathematically eliminated before the first tile is drawn, the slowest always
among them — regardless of draw order. We close by connecting "slowest" to the
developmental literature on processing and naming speed, which predicts that the
eliminated players are the youngest, pre-reading children the game targets.

---

## 1. Introduction — the surprising claim

- Hook: a game marketed to four-year-olds, sitting on the shelf, that
  guarantees losers before anyone plays.
- Origin story (the author's blog observation: a green pair sharing 5 of 9
  images, "harder than hard mode").
- Thesis preview: overlap is the hidden variable; the red side breaks the tile
  supply; someone is always out.
- Position vs the literature: the *matching* cousin (Spot It!/Dobble) is
  heavily analyzed via projective planes; Zingo's *bingo* mechanics — shared
  supply, fill-the-card, fairness across player counts — are essentially
  unstudied. That gap is the contribution.

## 2. The game and its constants

- Mechanics: Zinger reveals two tiles; first to *call the name* claims a
  contested tile; first to fill the card wins. (Ref: Wikipedia; ThinkFun.)
- Constants: 72 tiles = 24 images × 3 copies; 6 cards; 9 cells; green =
  Beginner, red = Advanced. Manufacturer itself states green sides share *fewer*
  images and red sides share *more* — our difficulty axis, confirmed at source.
- The two design questions bingo raises that matching games don't: *fairness
  across who shows up* (any 2–6 of the cards) and *feasibility under finite
  supply*.

## 3. Overlap as the one design variable

- Define pairwise overlap; the 15 card-pairs; mean overlap.
- Lineage sidebar: Spot It!/Dobble = *exactly-one* overlap (finite projective
  plane, 2-(n,k,1) design); Zingo = *tunable, ideally uniform* overlap — a
  different corner of combinatorial design theory (balanced incomplete block
  / resolvable designs). Cite the Spot It! corpus here.
- Claim: difficulty = overlap **level**; unfairness = overlap **dispersion**.
  Orthogonal (mean-income vs Gini analogy).

## 4. The counting skeleton

- "Spread" of an image = number of cards carrying it; spreads sum to 54; supply
  cap ⇒ spread ≤ 3.
- Total overlap T = (#spread-2) + 3·(#spread-3); mean x = T/15.
- **Green floor x = 2.4** (unique pattern), **red ceiling x = 3.6** (unique),
  random baseline 3.375.
- The 37 valid spread patterns; x is quantized into **18 columns**; the
  **missing tooth** at T = 53 (x ≈ 3.533) — unreachable under the cap.
- Pattern count swells toward the interior ⇒ the achievable-fairness envelope
  *pinches* at the extremes (few skeletons, little room to be fair or unfair).
- (Companion technical spec holds the full 37→x table and proofs.)

## 5. Two axes of "bad"

- x: overlap level = **luck-vs-skill dial** (low overlap → draw luck decides;
  high overlap → speed/skill decides).
- y: **fairness** = dispersion of per-card *contention load* across the k cards
  in play, reported per player count k, worst- and average-case.
- Key structural fact: **fairness is a 3+ player phenomenon** — at k = 2 the two
  cards share one mutual overlap, so the game is symmetric and always fair; the
  bias only appears at k ≥ 3 and grows with the table. (This is *why the bias
  went unnoticed.*)

## 6. Where Zingo actually sits

> **Updated 2026-09-11, now that the real green sheet is in hand**
> (`data/zingo-green.txt`). Green is confirmed at skeleton **(0,6,6,12), x = 2.8**
> exactly as drafted, worst pair **5**, and fully legal. The new fact — and a
> sharper hook than the draft's — is that green's unfairness is **1.1075** against
> red's **1.0873**: *the "easy" side is marginally the more lopsided of the two.*
> Green's sin is not that it is unfair **relative to red**; it is that at its own
> difficulty a board exists at **0.40**, so green is nearly three times less fair
> than it needed to be, while red's sin remains impossibility. Consider reframing
> §6 around that contrast, and §10's "Zingo was beatable" around the 0.40 witness.


- **Green = (0,6,6,12), x = 2.8.** A legal interior pattern — but 0.4 above the
  2.4 floor it could have used. Green's sin is a *choice*: fair was available.
- **Red = (2,6,5,6,5), x = 53/15 ≈ 3.533.** *That is the missing tooth.* Red
  occupies the one coordinate the supply-capped model forbids — reachable only
  by placing five images on **four** cards apiece when only **three** copies
  exist. Red's sin is *impossibility*: it left the achievable region entirely.

## 7. The pigeonhole theorem (the heart)

- Setup: a "quadruple" image (spread 4) sits on four cards; three tiles exist.
- Lemma (draw-order independence): under a strict, transitive speed order, when
  the three copies appear the three fastest holders each take one; the **slowest
  of the four never gets it**, no matter when tiles surface. Frame as a system of
  distinct representatives / Hall-condition failure for that card.
- Precision (necessary vs sufficient): being locked out ⇒ you were beaten by the
  three *co-holders* of your scarce image — i.e. slowest **of that foursome**,
  not merely "slower than some three players." A globally fast player can be
  eliminated by bad company on one image; the globally slowest is *always* out.
- Corollary: at k = 6, every quadruple forces ≥1 elimination.

## 8. The retail red board, exactly

- The five quadruples are the five most kid-obvious words: **ball, cat, dog,
  star, sun**, on card-sets {1,4,5,6}, {1,2,3,4}, {1,2,5,6}, {2,3,4,5},
  {3,4,5,6}.
- Enumerated over all 720 speed orders: **2–3 players eliminated** (2 in 73% of
  orders, 3 in 27%); the slowest is eliminated in **100%**.
- Why never fewer than two: **no single card carries all five** scarce images
  (the most any card holds is four), so the shortages cannot be concentrated
  onto one victim — a second casualty is forced by the incidence structure.
- Worked example (speed = card number): cards 4, 5, 6 eliminated; only 1, 2, 3
  can win. A six-seat game is really a three-horse race.

## 9. The cognitive twist — who is "slow"? (the Ages 4+ payload)

- The claim to make carefully (correlation, not a slur on any child): Zingo's
  contested-tile rule makes outcomes track **speed of recognizing a picture and
  saying its name** — essentially a rapid object-naming race.
- Developmental processing speed rises steeply across early childhood; Miller &
  Vernon measured it directly in **4-, 5-, and 6-year-olds** — Zingo's exact
  band — and found clear age-related gains (Kail's exponential model). So in
  mixed-age play the youngest are systematically the slowest.
- Naming speed specifically: **rapid automatized naming (RAN)** predicts and
  co-develops with reading; it improves with early literacy. Pre-readers name
  slower than emerging readers. (Norton & Wolf; Araújo et al.; the literacy→RAN
  twin study.)
- Synthesis: the "advanced" red side doesn't merely raise difficulty — via the
  pigeonhole result it converts the youngest, pre-reading players (the marketed
  audience) into the *structurally eliminated* ones. Difficulty and
  developmental disadvantage compound. A genuine, evidence-based design critique.

## 10. Fixing it — the constructive half

- Reframe as constrained design: find a 6×9 set on 24 symbols, supply ≤ 3, at a
  target difficulty, minimizing contention-load dispersion (a near-resolvable,
  supply-bounded block-design problem).
- Exhibit a fairer red set at/near the achievable frontier (respecting the cap,
  so *no* forced elimination), as a constructive witness that Zingo was beatable.
- Note the honest limit: the true red-ceiling difficulty (all-spread-3, x = 3.6)
  is *fair by construction* (uniform) but never eliminates anyone — so "hard but
  fair" red is achievable; the retail design traded fairness for a sliver of
  extra difficulty it didn't need.

## 11. Open questions (recreational hooks)

- Existence/optimality of overlap-uniform 6×9 sets on 24 symbols under supply 3.
- Expected eliminations as a functional of the incidence matrix; which incidence
  structures minimize it at fixed difficulty?
- The "missing tooth" phenomenon: for general (cards, cells, symbols, supply),
  which mean-overlap values are unreachable, and when is a retail set forced onto
  one?
- Generalization to k-card editions and to line/shape win conditions (Mini-Zingo,
  pattern variants).

---

## References (verify bibliographic details before submission)

**Matching-game / combinatorial-design lineage**
- Polster, B. (2015). The intersection game. *Math Horizons*, 22(4), 8–11.
- "The mathematics of Spot it!" *Pi Mu Epsilon Journal*, 13(8), 459–467 (2013).
- Dietz, D. A. Spot It!® Solitaire. arXiv:1301.7058.
- Jongsma, C. & Clark, T. (2016). Analyzing unique-matching games using
  elementary mathematics. *Math Teachers' Circle Network*.
- (existence of non-projective-plane Spot It! decks) arXiv:2201.09100.
- Background design theory: a standard text on balanced incomplete block designs
  / finite projective planes (e.g. a combinatorics course text) — add specific
  citation.

**Zingo! — game facts**
- "Zingo!" Wikipedia (mechanics; green fewer / red more shared images).
- ThinkFun / manufacturer product description (72 tiles, 6 double-sided cards,
  two levels, ages 4+, printed words on tiles).

**Developmental processing & naming speed (the Ages 4+ argument)**
- Kail, R. (1991). Developmental change in speed of processing during childhood
  and adolescence. *Psychological Bulletin*, 109(3), 490–501.
- Miller, L. T. & Vernon, P. A. (1997). Developmental changes in speed of
  information processing in young children. *Developmental Psychology*, 33(3),
  549–554. (Measured 4/5/6-year-olds — Zingo's band.)
- Norton, E. S. & Wolf, M. (2012). Rapid automatized naming (RAN) and reading
  fluency. *Annual Review of Psychology* — add vol./pages.
- Araújo, S., Reis, A., Petersson, K. M. & Faísca, L. (2015). RAN–reading
  meta-analysis. *Journal of Educational Psychology* — verify.
- Literacy→RAN longitudinal twin study (2018), *Journal of Experimental Child
  Psychology* (PMC5997458) — confirm authors/citation.
- (Optional lay explainer for a general-audience footnote: Understood.org, "RAN
  tests: what you need to know.")

**Mathematical tools referenced**
- Pigeonhole principle; Hall's marriage theorem / systems of distinct
  representatives — cite a standard combinatorics reference.

---

## Companion artifacts (same project)
- `zingo-algorithm-spec.md` — the formal requirements, the 37-pattern
  enumeration, the two-axis metric definitions, and the test oracles.
- Interactive site: forward-sampled scatter (where Zingo falls) plus a live
  fair-set generator (the constructive frontier witness).
