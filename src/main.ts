import { decodeBoard, seededRng } from "./lib/generate.js";
import { score } from "./lib/fairness.js";
import { tileSpreads } from "./lib/overlap.js";
import { oversubscribed } from "./lib/supply.js";
import { parseSheet, type BoardSet } from "./lib/board.js";
import { renderPlane, enablePointing, type PointInfo, type PlaneApi } from "./plane.js";
import scatter from "../data/scatter.json";
// The retail card sheets. The tests and the data generator read the same files.
import RED from "../data/zingo-red.txt?raw";
import GREEN from "../data/zingo-green.txt?raw";

const svg = document.getElementById("plane") as unknown as SVGSVGElement;
renderPlane(svg, scatter);

const tip = document.getElementById("tip") as HTMLDivElement;
const cardBox = document.getElementById("cards") as HTMLDivElement;

/* ---- Highlights ---------------------------------------------------------
   Three highlights (tiles on two cards, tiles on three, the worst pair), each
   previewed on hover and toggled by click or hotkey. They can be combined. */

const stuck = new Set<string>();

function applyLit(preview?: string) {
  for (const cls of ["zg-lit-2", "zg-lit-3", "zg-lit-w"]) {
    cardBox.classList.toggle(cls, stuck.has(cls) || preview === cls);
  }
  for (const node of cardBox.querySelectorAll<HTMLElement>("[data-lit]")) {
    node.classList.toggle("zg-is-lit", stuck.has(node.dataset.lit!));
  }
}

/** A hoverable, clickable, key-bound label that lights one class of thing. */
function control(className: string, text: string, key: string, cls: string): HTMLElement {
  const node = document.createElement("span");
  node.className = className;
  node.dataset.lit = cls;
  node.append(text);
  const badge = document.createElement("kbd");
  badge.className = "zg-chip-key";
  // Leading space so copied or unstyled text reads "shares 6 W", not "shares 6W".
  badge.textContent = ` ${key.toUpperCase()}`;
  badge.setAttribute("aria-label", `shortcut key ${key.toUpperCase()}`);
  node.append(badge);
  node.addEventListener("mouseenter", () => applyLit(cls));
  node.addEventListener("mouseleave", () => applyLit());
  node.addEventListener("click", () => {
    stuck.has(cls) ? stuck.delete(cls) : stuck.add(cls);
    applyLit(cls);
  });
  return node;
}

// The same three keys, toggling the same state the clicks do.
document.addEventListener("keydown", (e) => {
  if (cardBox.hidden || e.metaKey || e.ctrlKey || e.altKey) return;
  const cls = { "2": "zg-lit-2", "3": "zg-lit-3", w: "zg-lit-w" }[e.key.toLowerCase()];
  if (!cls) return;
  e.preventDefault();
  stuck.has(cls) ? stuck.delete(cls) : stuck.add(cls);
  applyLit();
});

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
const describeComp = (c: { singles: number; doubles: number; triples: number }) =>
  [plural(c.singles, "single"), plural(c.doubles, "double"), plural(c.triples, "triple")].join(" · ");

type Composition = { singles: number; doubles: number; triples: number; board: string | null };

function showTip(info: PointInfo | null, pinned: boolean) {
  if (!info) { tip.hidden = true; return; }
  tip.classList.toggle("zg-is-pinned", pinned);

  const withBoard = info.compositions.filter((c) => c.board).length;
  const total = info.compositions.length;

  tip.innerHTML = "";
  const head = document.createElement("div");
  head.className = "zg-tip-head";
  head.textContent = `difficulty ${info.x.toFixed(4).replace(/0+$/, "").replace(/\.$/, ".0")} · unfairness ${info.y.toFixed(3)}`;
  const sub = document.createElement("p");
  sub.className = "zg-tip-sub";
  sub.textContent =
    total === 1
      ? "This point represents one mix of singles, doubles, and triples."
      : `This point represents ${total} tile mixes.`;
  tip.append(head, sub);

  for (const comp of info.compositions) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "zg-tip-comp";
    b.textContent = describeComp(comp);
    if (comp.board && pinned) {
      b.title = "Show a set built this way";
      b.addEventListener("click", () => showDeck(comp));
    } else if (comp.board) {
      b.disabled = true;
    } else {
      b.disabled = true;
      b.textContent += "  — none found";
    }
    tip.append(b);
  }

  if (!pinned) {
    const cue = document.createElement("p");
    cue.className = "zg-tip-note";
    cue.textContent = "Click the plane to keep this open and pick a mix.";
    tip.append(cue);
  }

  // The list of mixes is exact, but which ones reach this point is only what the
  // search found, so don't present a missing one as impossible.
  if (withBoard < total) {
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

/** Render a witness board as six 3x3 cards, tinted by how many cards share each tile. */
function showDeck(comp: Composition) {
  if (!comp.board) return;
  const cards = decodeBoard(comp.board);
  // Re-score the board rather than copying the dot's values, so the title is
  // an independent check that the board belongs to that dot.
  const s = score(cards);
  renderDeck(
    cards,
    `A set at difficulty ${s.difficulty.toFixed(2)}, unfairness ${s.unfairness.toFixed(3)}`,
    `${describeComp(comp)} · worst pair shares ${s.worstPair}`
  );
}

/** Which cards sit in a pair sharing the most tiles. Usually two; more if tied. */
function worstCards(cards: BoardSet): Set<number> {
  let most = -1;
  let winners: number[][] = [];
  for (let i = 0; i < cards.length; i++)
    for (let j = i + 1; j < cards.length; j++) {
      let shared = 0;
      for (const tile of cards[i]) if (cards[j].has(tile)) shared++;
      if (shared > most) { most = shared; winners = [[i, j]]; }
      else if (shared === most) winners.push([i, j]);
    }
  return new Set(winners.flat());
}

/** Render any six-card set, whoever it came from. */
function renderDeck(cards: BoardSet, titleText: string, subtitleText: string, warning?: string, scroll = true) {
  const spreads = tileSpreads(cards);
  const worst = worstCards(cards);

  cardBox.innerHTML = "";
  const head = document.createElement("div");
  head.className = "zg-cards-head";
  const title = document.createElement("div");
  title.className = "zg-cards-title";
  title.textContent = titleText;
  const subtitle = document.createElement("div");
  subtitle.className = "zg-cards-sub";
  // "worst pair shares N" gets its own control because it highlights whole
  // cards, not a kind of tile.
  const [before, sharesN] = subtitleText.split(" · worst pair shares ");
  subtitle.append(before);
  if (sharesN !== undefined) {
    subtitle.append(" · ");
    subtitle.append(control("zg-cards-worst", `worst pair shares ${sharesN}`, "w", "zg-lit-w"));
  }
  head.append(title, subtitle);

  // Shuffle each card's tiles, or they'd sit in alphabetical order and shared
  // tiles would line up across cards. Seeding from the board (FNV-1a over the
  // tile names) keeps a given set's layout stable between openings.
  let seed = 2166136261;
  for (const card of cards)
    for (const tile of [...card].sort())
      for (let c = 0; c < tile.length; c++) {
        seed ^= tile.charCodeAt(c);
        seed = Math.imul(seed, 16777619);
      }
  const rng = seededRng(seed >>> 0);

  const deck = document.createElement("div");
  deck.className = "zg-deck";
  cards.forEach((card, i) => {
    const el = document.createElement("div");
    el.className = "zg-card";
    if (worst.has(i)) el.dataset.worst = "";
    const label = document.createElement("div");
    label.className = "zg-card-label";
    label.textContent = `card ${i + 1}`;
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
      cell.dataset.spread = String(spreads.get(tile) ?? 1);
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
      grid.append(cell);
    }
    el.append(label, grid);
    deck.append(el);
  });

  // Only list the spreads this board uses. "On four" appears only for retail red.
  const present = [...new Set(spreads.values())].sort((a, b) => a - b);
  const label: Record<number, string> = {
    1: "on one card", 2: "on two", 3: "on three", 4: "on four",
  };
  const legend = document.createElement("p");
  legend.className = "zg-cards-legend";
  legend.append("Outlines show how many cards carry a tile: ");
  present.forEach((spread, i) => {
    const text = label[spread] ?? `on ${spread}`;
    // Only the dimmed rings (two and three) can be highlighted.
    const chip = spread === 2 || spread === 3
      ? control("zg-cell zg-chip", text, String(spread), `zg-lit-${spread}`)
      : Object.assign(document.createElement("span"), { className: "zg-cell zg-chip", textContent: text });
    chip.dataset.spread = String(spread);
    legend.append(chip, i < present.length - 1 ? " " : ". ");
  });
  legend.append("That mix is what fixes the difficulty.");

  cardBox.append(head, deck, legend);
  if (warning) {
    const note = document.createElement("p");
    note.className = "zg-cards-warning";
    note.textContent = warning;
    cardBox.append(note);
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
    `the retail ${name} board · worst pair shares ${s.worstPair}`,
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
