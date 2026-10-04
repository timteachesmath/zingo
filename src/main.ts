import { decodeBoard, seededRng } from "./lib/generate.js";
import { score } from "./lib/fairness.js";
import { tileSpreads, overlapMatrix } from "./lib/overlap.js";
import { oversubscribed } from "./lib/supply.js";
import { parseSheet, type BoardSet } from "./lib/board.js";
import { TILES } from "./lib/tiles.js";
import { renderPlane, enablePointing, type PointInfo, type PlaneApi } from "./plane.js";
import scatter from "../data/scatter.json";
// The retail card sheets. The tests and the data generator read the same files.
import RED from "../data/zingo-red.txt?raw";
import GREEN from "../data/zingo-green.txt?raw";

const svg = document.getElementById("plane") as unknown as SVGSVGElement;
renderPlane(svg, scatter);

const tip = document.getElementById("tip") as HTMLDivElement;
const cardBox = document.getElementById("cards") as HTMLDivElement;
/** The part of the card panel that changes with the set; the note below it doesn't. */
const deckBox = document.getElementById("deck") as HTMLDivElement;

/* ---- Pairs ---------------------------------------------------------------
   Each card's table lists the tiles it shares with every other card. An entry
   outlines those shared tiles on both cards: previewed on hover or keyboard
   focus, kept by click. Any number of pairs can be kept; Clear drops them. */

const keptPairs = new Set<string>();
/** The cards on show, so a pair can find the tiles it shares. */
let shownCards: BoardSet = [];

function applyPair(preview?: string) {
  const lit = new Set(keptPairs);
  if (preview) lit.add(preview);
  // For each card, the tiles it shares with any card it is lit alongside.
  const outlined = new Map<string, Set<string>>();
  for (const pair of lit) {
    const [a, b] = pair.split("-").map(Number);
    for (const [me, other] of [[a, b], [b, a]]) {
      const tiles = outlined.get(String(me)) ?? new Set<string>();
      for (const tile of shownCards[me]) if (shownCards[other].has(tile)) tiles.add(tile);
      outlined.set(String(me), tiles);
    }
  }
  for (const card of cardBox.querySelectorAll<HTMLElement>(".zg-card")) {
    const tiles = outlined.get(card.dataset.card!);
    card.classList.toggle("zg-is-pair", tiles !== undefined);
    for (const cell of card.querySelectorAll<HTMLElement>(".zg-cell")) {
      cell.classList.toggle("zg-is-shared", tiles?.has(cell.dataset.tile!) ?? false);
    }
  }
  for (const entry of cardBox.querySelectorAll<HTMLElement>(".zg-share")) {
    entry.classList.toggle("zg-is-lit", lit.has(entry.dataset.pair!));
    entry.setAttribute("aria-pressed", String(keptPairs.has(entry.dataset.pair!)));
  }
  const clear = cardBox.querySelector<HTMLButtonElement>(".zg-pairs-clear");
  if (clear) clear.hidden = keptPairs.size === 0;
}

/**
 * The small table at a card's top right: the other cards' numbers over the
 * tiles shared with each. The fewest any pair shares gets a subscript
 * asterisk and the most a superscript one, in every table where they appear.
 */
function shareTable(i: number, cards: BoardSet, shared: number[][], fewest: number, most: number): HTMLElement {
  const table = document.createElement("div");
  table.className = "zg-shares";
  table.setAttribute("role", "group");
  table.setAttribute("aria-label", `Images card ${i + 1} shares with each other card`);
  // Visual row labels only; each entry's aria-label already says what it is.
  const head = document.createElement("div");
  head.className = "zg-share-head";
  head.setAttribute("aria-hidden", "true");
  head.append(
    Object.assign(document.createElement("span"), { textContent: "Card" }),
    Object.assign(document.createElement("span"), { textContent: "Shared" }),
  );
  table.append(head);
  shared[i].forEach((n, j) => {
    if (j === i) return;
    const pair = `${Math.min(i, j)}-${Math.max(i, j)}`;
    const entry = document.createElement("button");
    entry.type = "button";
    entry.className = "zg-share";
    entry.dataset.pair = pair;
    if (n === fewest) entry.dataset.fewest = "";
    if (n === most) entry.dataset.most = "";
    const fact = [
      // Naming the images gives a screen reader what the outline shows, and
      // a touch reader what they can't hover for.
      `Cards ${Math.min(i, j) + 1} and ${Math.max(i, j) + 1} share ${plural(n, "image")}` +
        (n ? `: ${[...cards[i]].filter((t) => cards[j].has(t)).sort().join(", ")}.` : "."),
      // "No pair shares fewer" rather than "the fewest", since ties are common.
      ...(n === fewest ? ["No pair shares fewer."] : []),
      ...(n === most ? ["No pair shares more."] : []),
    ].join(" ");
    const what = n === 0 ? "the pair" : n === 1 ? "it" : "them";
    entry.setAttribute("aria-label", fact);
    // The browser's own tooltip: it waits, and doesn't cover the outlined tiles.
    entry.title = `${fact} Click to keep ${what} outlined.`;
    entry.setAttribute("aria-pressed", "false");
    const card = document.createElement("span");
    card.className = "zg-share-card";
    card.textContent = String(j + 1);
    const count = document.createElement("span");
    count.className = "zg-share-n";
    count.textContent = String(n);
    entry.append(card, count);
    entry.addEventListener("mouseenter", () => applyPair(pair));
    entry.addEventListener("mouseleave", () => applyPair());
    // A mouse click also focuses the button, so only keyboard focus previews.
    entry.addEventListener("focus", () => { if (entry.matches(":focus-visible")) applyPair(pair); });
    entry.addEventListener("blur", () => applyPair());
    entry.addEventListener("click", () => {
      keptPairs.has(pair) ? keptPairs.delete(pair) : keptPairs.add(pair);
      applyPair(pair);
    });
    table.append(entry);
  });
  return table;
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

/**
 * A tile mix as "6 singles · 6 doubles [2] · 12 triples [3]", each count
 * followed by the badge its tiles carry. Singles carry none. `mix` maps how
 * many cards a tile is on to how many such tiles there are.
 */
function mixLine(mix: Map<number, number>): (Node | string)[] {
  const words: Record<number, string> = { 1: "single", 2: "double", 3: "triple", 4: "quadruple" };
  const out: (Node | string)[] = [];
  [...mix.keys()].sort((a, b) => a - b).forEach((spread, i) => {
    if (i > 0) out.push(" · ");
    out.push(plural(mix.get(spread)!, words[spread] ?? `on ${spread}`));
    if (spread > 1) {
      const badge = Object.assign(document.createElement("span"), { className: "zg-badge", textContent: String(spread) });
      badge.dataset.spread = String(spread);
      // "5 doubles" already says it; read aloud, the badge would add a stray "2".
      badge.setAttribute("aria-hidden", "true");
      out.push(" ", badge);
    }
  });
  return out;
}

const compMix = (c: { singles: number; doubles: number; triples: number }) =>
  new Map([[1, c.singles], [2, c.doubles], [3, c.triples]]);

type Composition = PointInfo["compositions"][number];

/** 32-bit FNV-1a, used to seed per-board randomness from the board itself. */
function fnv1a(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}

function showTip(info: PointInfo | null, pinned: boolean) {
  if (!info) { tip.hidden = true; return; }
  tip.classList.toggle("zg-is-pinned", pinned);

  /* A mix that was enumerated and cannot reach this point is left out entirely.
     What remains is every mix that reaches it, plus any not yet enumerated. */
  const mixes = info.compositions.filter((c) => c.board || !c.proven);
  const total = mixes.length;

  tip.innerHTML = "";
  const head = document.createElement("div");
  head.className = "zg-tip-head";
  // Each measure stays on one line, so a narrow bubble wraps at the dot.
  const measure = (text: string) =>
    Object.assign(document.createElement("span"), { className: "zg-tip-measure", textContent: text });
  head.append(
    measure(`difficulty ${info.x.toFixed(4).replace(/0+$/, "").replace(/\.$/, ".0")}`),
    " · ",
    measure(`unfairness ${info.y.toFixed(3)}`),
  );
  const sub = document.createElement("p");
  sub.className = "zg-tip-sub";
  sub.textContent =
    total === 1
      ? "This point represents one mix of singles, doubles, and triples."
      : `This point represents ${total} tile mixes.`;
  tip.append(head, sub);

  for (const comp of mixes) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "zg-tip-comp";
    b.append(...mixLine(compMix(comp)));
    if (comp.board && pinned) {
      b.title = "Show a set built this way";
      b.addEventListener("click", (e) => {
        showDeck(comp);
        // A click from Enter or Space has no pointer position (detail 0). The
        // bubble's button is about to be left behind, so take keyboard focus
        // on to the set it opened.
        if (e.detail === 0) focusDeckTitle();
      });
    } else if (comp.board) {
      b.disabled = true;
    } else {
      b.disabled = true;
      b.append("  — none found");
    }
    tip.append(b);
  }

  if (!pinned) {
    const cue = document.createElement("p");
    cue.className = "zg-tip-note";
    cue.textContent = "Click the plane to keep this open and pick a mix.";
    tip.append(cue);
  } else if (svg.matches(":focus-visible")) {
    // Pinned from the keyboard: say how to get into the bubble and out again.
    const cue = document.createElement("p");
    cue.className = "zg-tip-note";
    cue.textContent = mixes.some((c) => c.board)
      ? "Enter: pick a mix · Esc: close"
      : "Esc: close";
    tip.append(cue);
  }

  // Only for a mix still listed without a board, i.e. one not yet enumerated.
  if (mixes.some((c) => !c.board)) {
    const note = document.createElement("p");
    note.className = "zg-tip-note";
    note.textContent = "“none found” means the search did not reach this point that way — not that it is impossible.";
    tip.append(note);
  }

  if (pinned) {
    const close = document.createElement("button");
    close.type = "button";
    close.className = "zg-tip-close";
    close.setAttribute("aria-label", "Dismiss");
    close.textContent = "×";
    close.addEventListener("click", () => {
      (svg as PlaneApi).unpin?.();
      // The button goes with the bubble, so focus would fall to the page.
      svg.focus();
    });
    tip.append(close);
  }

  const r = svg.getBoundingClientRect();
  const x = (info.vx / 1040) * r.width;
  const y = (info.vy / 620) * r.height;
  tip.style.left = `${x}px`;
  tip.style.top = `${y - 12}px`;
  tip.classList.remove("zg-tip--below");
  tip.hidden = false;

  // Keep the bubble on the plane: flip it below the dot if there's no room
  // above, and clamp it horizontally.
  const box = tip.getBoundingClientRect();
  const plane = tip.parentElement!.getBoundingClientRect();
  if (box.top < plane.top) {
    tip.classList.add("zg-tip--below");
    tip.style.top = `${y + 14}px`;
  }
  const half = box.width / 2;
  tip.style.left = `${Math.min(Math.max(x, half + 6), plane.width - half - 6)}px`;
}

/** Drop every kept pair. Focus on the Clear button, which then hides, moves to the set's title. */
function clearPairs() {
  const hadFocus = document.activeElement?.classList.contains("zg-pairs-clear");
  keptPairs.clear();
  applyPair();
  if (hadFocus) focusDeckTitle();
}

/* Esc clears kept pairs, unless a pinned bubble is open: then it closes the
   bubble, as before, and a second Esc clears. Esc rather than a letter key:
   a single-character shortcut fails WCAG 2.1.4, firing by accident for
   speech-input users. This listens in the capture phase so it sees the
   bubble's state before the plane's own Esc handler closes it. */
document.addEventListener("keydown", (e) => {
  if (e.key !== "Escape" || cardBox.hidden || keptPairs.size === 0) return;
  if (!tip.hidden && tip.classList.contains("zg-is-pinned")) return;
  clearPairs();
}, { capture: true });

/* ---- Keyboard paths into and out of the bubble -------------------------
   With a dot pinned from the chart, Enter moves focus to the bubble's first
   mix. In the bubble, Up/Down move between mixes, and Esc or Shift+Tab from
   the top goes back to the chart. Tab order alone would visit the red and
   green markers inside the chart first. */

const tipButtons = () =>
  [...tip.querySelectorAll<HTMLButtonElement>(".zg-tip-comp:not(:disabled), .zg-tip-close")];

svg.addEventListener("keydown", (e) => {
  if (e.key !== "Enter" || e.target !== svg) return;
  if (tip.hidden || !tip.classList.contains("zg-is-pinned")) return;
  e.preventDefault();
  tipButtons()[0]?.focus();
});

tip.addEventListener("keydown", (e) => {
  const buttons = tipButtons().filter((b) => b.classList.contains("zg-tip-comp"));
  const at = buttons.indexOf(document.activeElement as HTMLButtonElement);
  if (e.key === "Escape") {
    // The plane's own Esc handler (on the document) closes the bubble.
    svg.focus();
  } else if ((e.key === "ArrowDown" || e.key === "ArrowUp") && at >= 0) {
    e.preventDefault();
    buttons[(at + (e.key === "ArrowDown" ? 1 : buttons.length - 1)) % buttons.length].focus();
  } else if (e.key === "Tab" && e.shiftKey && document.activeElement === tipButtons()[0]) {
    e.preventDefault();
    svg.focus();
  }
});

/** Move focus to the open set's title, so a keyboard user lands on the cards. */
function focusDeckTitle() {
  const title = deckBox.querySelector<HTMLElement>(".zg-cards-title");
  if (!title) return;
  title.tabIndex = -1;
  // The panel already scrolls itself into view.
  title.focus({ preventScroll: true });
}

/** Render a witness board as six 3x3 cards, badged by how many cards share each tile. */
function showDeck(comp: Composition) {
  if (!comp.board) return;
  const cards = relabel(decodeBoard(comp.board), fnv1a(comp.board));
  // Re-score the board rather than copying the dot's values, so the title is
  // an independent check that the board belongs to that dot.
  const s = score(cards);
  renderDeck(
    cards,
    `A set at difficulty ${s.difficulty.toFixed(2)}, unfairness ${s.unfairness.toFixed(3)}`
  );
}

/**
 * Give a generated board's tiles random names. The generator numbers tiles in
 * the order it placed them (tiles on three cards first), so decoded names track
 * spread: apple is always on three cards. A permutation seeded from the board
 * breaks that and keeps each board's names stable. Only which cards share a
 * tile matters, so scores are unchanged.
 */
function relabel(cards: BoardSet, seed: number): BoardSet {
  const rng = seededRng(seed);
  const names: string[] = [...TILES];
  for (let k = names.length - 1; k > 0; k--) {
    const j = Math.floor(rng() * (k + 1));
    [names[k], names[j]] = [names[j], names[k]];
  }
  const rename = new Map<string, string>(TILES.map((tile, i) => [tile, names[i]]));
  return cards.map((card) => new Set([...card].map((tile) => rename.get(tile)!)));
}

/**
 * Render any six-card set, whoever it came from. `source` leads the subtitle
 * (e.g. "the retail green board"); the tile mix after it is counted here.
 */
function renderDeck(cards: BoardSet, titleText: string, source = "", warning?: string, scroll = true) {
  const spreads = tileSpreads(cards);
  const shared = overlapMatrix(cards);
  const counts = shared.flatMap((row, i) => row.filter((_, j) => j > i));
  const fewest = Math.min(...counts), most = Math.max(...counts);
  shownCards = cards;
  keptPairs.clear();

  deckBox.innerHTML = "";
  const head = document.createElement("div");
  head.className = "zg-cards-head";
  const title = document.createElement("div");
  title.className = "zg-cards-title";
  title.textContent = titleText;
  const subtitle = document.createElement("div");
  subtitle.className = "zg-cards-sub";
  // Singles, doubles and triples always show, even at zero, to match the mixes
  // the bubble lists. Quadruples show only on retail red.
  const mix = new Map<number, number>([[1, 0], [2, 0], [3, 0]]);
  for (const spread of spreads.values()) mix.set(spread, (mix.get(spread) ?? 0) + 1);
  if (source) subtitle.append(source, " · ");
  subtitle.append(...mixLine(mix));
  const clear = document.createElement("button");
  clear.type = "button";
  clear.className = "zg-pairs-clear";
  clear.hidden = true;
  clear.textContent = "Clear";
  // The shortcut shows in the hover tooltip; screen readers get it from
  // aria-keyshortcuts.
  clear.title = "Clear outlined pairs (Esc)";
  clear.setAttribute("aria-keyshortcuts", "Escape");
  clear.addEventListener("click", clearPairs);
  subtitle.append(clear);
  head.append(title, subtitle);

  // Shuffle each card's tiles, or they'd sit in alphabetical order and shared
  // tiles would line up across cards. Seeding from the board (FNV-1a over the
  // tile names) keeps a given set's layout stable between openings.
  const rng = seededRng(fnv1a(cards.map((card) => [...card].sort().join(",")).join("|")));

  const deck = document.createElement("div");
  deck.className = "zg-deck";
  cards.forEach((card, i) => {
    const el = document.createElement("div");
    el.className = "zg-card";
    el.dataset.card = String(i);
    const label = document.createElement("div");
    label.className = "zg-card-label";
    const name = document.createElement("span");
    name.className = "zg-card-name";
    name.textContent = `card ${i + 1}`;
    label.append(name, shareTable(i, cards, shared, fewest, most));
    const grid = document.createElement("div");
    grid.className = "zg-card-grid";
    const laid = [...card];
    for (let k = laid.length - 1; k > 0; k--) {
      const j = Math.floor(rng() * (k + 1));
      [laid[k], laid[j]] = [laid[j], laid[k]];
    }
    for (const tile of laid) {
      const cell = document.createElement("div");
      cell.className = "zg-cell";
      cell.dataset.tile = tile;
      const spread = spreads.get(tile) ?? 1;
      const art = document.createElement("img");
      art.className = "zg-cell-art";
      art.src = `${import.meta.env.BASE_URL}tiles-dark/${tile}.svg`;
      art.alt = "";
      art.loading = "lazy";
      art.width = 64;
      art.height = 64;
      const name = document.createElement("span");
      name.className = "zg-cell-name";
      name.textContent = tile;
      cell.append(art, name);
      // A corner badge counts the cards carrying a tile, when it is more than one.
      if (spread > 1) {
        const badge = document.createElement("span");
        badge.className = "zg-badge";
        badge.dataset.spread = String(spread);
        badge.title = `on ${spread} cards`;
        // A bare digit after the name reads as "cat 4". Screen readers get
        // "cat, on 4 cards" instead; a `title` alone isn't reliably read.
        const digit = Object.assign(document.createElement("span"), { textContent: String(spread) });
        digit.setAttribute("aria-hidden", "true");
        const spoken = Object.assign(document.createElement("span"), { className: "zg-sr", textContent: `, on ${spread} cards` });
        badge.append(digit, spoken);
        cell.append(badge);
      }
      grid.append(cell);
    }
    el.append(label, grid);
    deck.append(el);
  });

  deckBox.append(head, deck);
  if (warning) {
    const note = document.createElement("p");
    note.className = "zg-cards-warning";
    note.textContent = warning;
    deckBox.append(note);
  }
  cardBox.hidden = false;
  // "nearest" scrolls as little as possible, so a pinned bubble may stay in view.
  if (scroll) cardBox.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

/**
 * Open one of the two retail boards, scored from its committed sheet.
 *
 * `initial` is for opening it on page load, which shouldn't scroll or pin a
 * bubble.
 */
function showRetail(name: "red" | "green", { initial = false } = {}) {
  // Reset the plane's selection. A label click never reaches the plane, which
  // would otherwise still think it's showing the last hovered dot and skip
  // redrawing the bubble when that dot is hovered again.
  (svg as PlaneApi).unpin?.();
  const cards = parseSheet(name === "red" ? RED : GREEN);
  const s = score(cards);
  const over = oversubscribed(cards);
  const warning = over.length
    ? `${over.length} tiles are printed on four cards — ${over.map((o) => o.tile).join(", ")} — ` +
      "but only three copies of each exist. At a six-player table at least two players " +
      "can never fill their cards, whatever the draw order."
    : undefined;
  renderDeck(
    cards,
    `Zingo ${name} — difficulty ${s.difficulty.toFixed(4)}, unfairness ${s.unfairness.toFixed(4)}`,
    `the retail ${name} board`,
    warning,
    !initial
  );
  if (initial) return;
  // Green sits on a dot, so also pin that dot's bubble. Red sits where no dot
  // exists, so this does nothing for it.
  (svg as PlaneApi).pinPoint?.(s.difficulty, s.unfairness);
}

enablePointing(svg, scatter, {
  onHover: showTip,
  onMarker: (name) => showRetail(name as "red" | "green"),
});

// Clicks on a marker's label (too far from the dot for the plane's hit test)
// and keyboard activation. Stop propagation so the plane doesn't also select a dot.
for (const name of ["red", "green"] as const) {
  const g = svg.querySelector(`[data-marker="${name}"]`);
  if (!g) continue;
  g.addEventListener("click", (e) => {
    e.stopPropagation();
    showRetail(name);
  });
  g.addEventListener("keydown", (e) => {
    const key = (e as KeyboardEvent).key;
    if (key !== "Enter" && key !== " ") return;
    e.preventDefault();
    e.stopPropagation();
    showRetail(name);
  });
}

// Start with the green set open; it's the first set the page discusses.
showRetail("green", { initial: true });
