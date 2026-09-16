export interface Scatter {
  /** [difficulty, unfairness, overlapTotal t, sumOfSquares q] per reachable point. */
  points: number[][];
  /** [difficulty, unfairness] per column: the proven fairness floor. */
  frontier: number[][];
  /** True when every column's frontier witness met the closed-form bound. */
  frontierExact: boolean;
  /** Keyed "t:q" -> [compositionIndex, encodedBoard] pairs, for the compositions
   *  a board was actually found for. Typed loosely because that is what a JSON
   *  import infers; `describe()` narrows it. */
  detail: Record<string, (number | string)[][]>;
  /** Keyed t -> every composition at that difficulty. Exact, unlike `detail`. */
  columns: Record<string, { x: number; comps: number[][] }>;
  /** False: the top barrier and interior are best-found, never proven. */
  ceilingExact: boolean;
  /** The retail sets as [difficulty, unfairness, worstPair], scored from the sheets. */
  zingo_red: number[];
  zingo_green: number[];
  guides: { green_floor: number; random: number; red_ceiling: number; tooth: number };
}

/** A point the reader is pointing at, with everything needed to describe it. */
export interface PointInfo {
  x: number;
  y: number;
  t: number;
  q: number;
  /** Screen-space position within the SVG's viewBox, for placing a tooltip. */
  vx: number;
  vy: number;
  /** Every composition at this difficulty, with the witness board if one was found. */
  compositions: { singles: number; doubles: number; triples: number; board: string | null }[];
}

const NS = "http://www.w3.org/2000/svg";
// Wide left margin for the wrapped y-axis label; the plot runs close to the right edge.
const W = 1040, H = 620, m = { t: 96, r: 40, b: 64, l: 168 };
// The y-axis stops at 2.9, where most of the data is. A note above the plot
// gives the highest value found.
const xd = [2.35, 3.66], yd = [0, 2.9];
const px = (x: number) => m.l + ((x - xd[0]) / (xd[1] - xd[0])) * (W - m.l - m.r);
const py = (y: number) => H - m.b - ((y - yd[0]) / (yd[1] - yd[0])) * (H - m.t - m.b);
const lerp = (a: number, b: number, t: number) => Math.round(a + (b - a) * t);

/* SVG presentation attributes can't use var(), so the site palette is read
   from the CSS custom properties once. The fallbacks only apply if site.css
   fails to load. */
interface Palette {
  text: string;
  textSoft: string;
  muted: string;
  accent: string;
  warn: string;
  tierLow: number[];
  tierHigh: number[];
}

let pal: Palette | null = null;

function token(name: string, fallback: string) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}

function rgb(hex: string): number[] {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const n = parseInt(full, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function palette(): Palette {
  return (pal ??= {
    text: token("--text", "#f1f5f9"),
    textSoft: token("--text-soft", "#cbd5e1"),
    muted: token("--muted", "#94a3b8"),
    accent: token("--accent", "#38bdf8"),
    warn: token("--warn", "#fbbf24"),
    tierLow: rgb(token("--success", "#34d399")),
    tierHigh: rgb(token("--danger", "#f87171")),
  });
}

// Dots shade from green (low difficulty, mostly luck) to red (high, mostly speed).
const tier = (x: number) => {
  const p = palette();
  const t = Math.max(0, Math.min(1, (x - 2.4) / 1.2));
  const [r, g, b] = p.tierLow.map((lo, i) => lerp(lo, p.tierHigh[i], t));
  return `rgb(${r},${g},${b})`;
};

// Retail marker centres in viewBox units, for hit-testing in enablePointing().
const markers: { name: string; cx: number; cy: number }[] = [];

let svgEl: SVGSVGElement;
function el(n: string, a: Record<string, string | number>, parent?: Element) {
  const e = document.createElementNS(NS, n);
  for (const k in a) e.setAttribute(k, String(a[k]));
  (parent ?? svgEl).appendChild(e);
  return e;
}

export function renderPlane(svg: SVGSVGElement, d: Scatter) {
  svgEl = svg;
  markers.length = 0;
  const p = palette();
  // Both axes carry the symbol their ticks measure: x is the mean of the 15
  // pairwise overlaps, y their standard deviation.
  for (let y = 0; y <= 2; y += 1) {
    el("line", { x1: m.l, x2: W - m.r, y1: py(y), y2: py(y), stroke: "rgba(255,255,255,.075)" });
    el("text", { x: m.l - 10, y: py(y) + 4, fill: p.muted, "font-size": 12, "text-anchor": "end" })
      .textContent = y === 2 ? `\u03c3 = ${y.toFixed(1)}` : y.toFixed(1);
  }
  ([[2.4, "2.40"], [2.8, "2.80"], [3.0, "3.00"], [3.375, "3.375"], [3.6, "3.60"]] as [number, string][]).forEach(
    ([x, l]) => (el("text", { x: px(x), y: H - m.b + 20, fill: p.muted, "font-size": 12, "text-anchor": "middle" })
      .textContent = x === 2.4 ? `\u03bc = ${l}` : l)
  );

  // Clip dots to the plot area. The data runs well past the top of the axis
  // and would otherwise draw over the title.
  const clip = el("clipPath", { id: "plot" }, el("defs", {}));
  el("rect", { x: m.l, y: m.t, width: W - m.l - m.r, height: H - m.t - m.b }, clip);
  const g = el("g", { "clip-path": "url(#plot)" });
  d.points.forEach(([x, y]) => el("circle", { cx: px(x), cy: py(y), r: 2.1, fill: tier(x), "fill-opacity": 0.5 }, g));

  // The difficulty no legal set reaches (t = 53), hatched in the orange the
  // card viewer uses for a tile on four cards, which is what red needs to sit here.
  const tx0 = px(d.guides.tooth);
  const ringFour = token("--ring-four", "#f97316");
  const defs = el("defs", {});
  const pat = el("pattern", { id: "hatch", width: 6, height: 6, patternUnits: "userSpaceOnUse", patternTransform: "rotate(45)" }, defs);
  el("line", { x1: 0, y1: 0, x2: 0, y2: 6, stroke: ringFour, "stroke-opacity": 0.55, "stroke-width": 2 }, pat);
  el("rect", { x: tx0 - 9, y: m.t, width: 18, height: H - m.t - m.b, fill: "url(#hatch)" });

  // Legend swatch for the hatched stripe.
  const ly = H - m.b + 38;
  el("rect", { x: tx0 - 78, y: ly - 10, width: 13, height: 13, fill: "url(#hatch)", stroke: ringFour, "stroke-opacity": 0.6 });
  el("text", { x: tx0 - 60, y: ly, fill: ringFour, "font-size": 11, "text-anchor": "start", "font-style": "italic" })
    .textContent = "no legal set exists here";

  el("text", { x: (m.l + (W - m.r)) / 2, y: 32, fill: p.text, "font-size": 17, "text-anchor": "middle", "font-weight": 700 })
    .textContent = "Competitiveness / Fairness Distribution";

  // Say how far the data continues above the cut.
  const topY = Math.max(...d.points.map(([, y]) => y));
  el("text", { x: (m.l + (W - m.r)) / 2, y: 58, fill: p.muted, "font-size": 12, "text-anchor": "middle" })
    .textContent = `Unfairness continues to at least \u03c3 \u2248 ${topY.toFixed(2)} above this view . . .`;

  // Unrotated y-axis label, wrapped to fit in the left margin.
  const lines = ["Unfairness", "\u03c3 = spread of", "shared tiles", "across the cards", "(fair \u2192 lopsided)"];
  const yLabel = el("text", { fill: p.textSoft, "font-size": 12, "text-anchor": "start" });
  const top = (m.t + (H - m.b)) / 2 - ((lines.length - 1) * 15) / 2;
  lines.forEach((line, i) => {
    const ts = document.createElementNS(NS, "tspan");
    ts.setAttribute("x", "14");
    ts.setAttribute("y", String(top + i * 15));
    ts.textContent = line;
    yLabel.appendChild(ts);
  });
  el("text", { x: (m.l + (W - m.r)) / 2, y: H - 6, fill: p.textSoft, "font-size": 13, "text-anchor": "middle" })
    .textContent = "Difficulty  \u00b7  \u03bc = mean tiles shared per pair   (luck \u2192 skill)";
  marker("red", d.zingo_red[0], d.zingo_red[1], true, "Zingo red", "in the impossible gap");
  marker("green", d.zingo_green[0], d.zingo_green[1], false, "Zingo green", "legal, yet no fairer than red");
}

/**
 * A retail set, drawn as a labelled gold marker. Each is a `data-marker` group
 * so the page can treat it as a button; these are the only two points with a
 * real card list behind them.
 */
function marker(name: string, x: number, y: number, filled: boolean, label: string, sub: string) {
  const p = palette();
  const cx = px(x), cy = py(y);
  const g = el("g", {}) as SVGGElement;
  markers.push({ name, cx, cy });
  g.dataset.marker = name;
  g.setAttribute("role", "button");
  g.setAttribute("tabindex", "0");
  g.setAttribute("aria-label", `${label}: ${sub}. Show its six cards.`);
  // The drawn shapes ignore the pointer: dots sit under the green marker, and a
  // clickable ring would take their clicks. enablePointing() hit-tests markers
  // by coordinate instead. The label text stays clickable.
  el("circle", { cx, cy, r: 8, fill: filled ? p.warn : "none", stroke: p.warn, "stroke-width": 3, "fill-opacity": filled ? 0.9 : 1, "stroke-dasharray": filled ? "" : "3 3", "pointer-events": "none" }, g);
  el("circle", { cx, cy, r: 2.4, fill: p.warn, "pointer-events": "none" }, g);
  const lx = x > 3.2 ? cx - 14 : cx + 14, anch = x > 3.2 ? "end" : "start";
  el("line", { x1: cx, y1: cy, x2: lx, y2: cy - 26, stroke: p.warn, "stroke-width": 1.2, "pointer-events": "none" }, g);
  el("text", { x: lx, y: cy - 30, fill: p.text, "font-size": 13, "text-anchor": anch, "font-weight": 600 }, g).textContent = label;
  el("text", { x: lx, y: cy - 14, fill: p.muted, "font-size": 11, "text-anchor": anch }, g).textContent = sub;
}

/* ---- Pointing -----------------------------------------------------------

   Instead of giving every dot its own hit target, the pointer selects the
   nearest dot, measured in viewBox units so "nearest" matches what the reader
   sees. A linear scan per mousemove takes well under a millisecond. */

let hoverRing: SVGGElement | null = null;

/** Build the description a tooltip needs: every composition here, witness or not. */
function describe(d: Scatter, pt: number[]): PointInfo {
  const [x, y, t, q] = pt;
  const column = d.columns[String(t)];
  const found = new Map(
    (d.detail[`${t}:${q}`] ?? []).map((e) => [Number(e[0]), String(e[1])] as const)
  );
  return {
    x, y, t, q,
    vx: px(x),
    vy: py(y),
    compositions: column.comps.map((c, i) => ({
      singles: c[0], doubles: c[1], triples: c[2],
      board: found.get(i) ?? null,
    })),
  };
}

/** The plane, with the handful of controls it hands back to the page. */
export type PlaneApi = SVGSVGElement & {
  /** Dismiss a pinned bubble, e.g. from its close button. */
  unpin?: () => void;
  /** Pin the bubble for the point at these data coordinates, if one sits there. */
  pinPoint?: (x: number, y: number) => void;
};

export interface PlaneHandlers {
  onHover?: (info: PointInfo | null, pinned: boolean) => void;
  /** A retail marker was activated by pointer. Keyboard goes through the group. */
  onMarker?: (name: string) => void;
}

/**
 * Make the plane pointable.
 *
 * Hovering previews the nearest point and clicking pins it. While pinned, the
 * pointer can cross other dots to reach the bubble's buttons without
 * retargeting it.
 *
 * With the plane focused, Left/Right step between difficulty columns and
 * Up/Down between unfairness levels in a column. Keyboard selection is always
 * pinned.
 */
export function enablePointing(svg: SVGSVGElement, d: Scatter, handlers: PlaneHandlers) {
  const pts = d.points;
  const screen = pts.map((p) => [px(p[0]), py(p[1])]);
  let current = -1;
  let pinned = false;

  const show = (i: number, pin = pinned) => {
    if (i === current && pin === pinned) return;
    current = i;
    pinned = pin;
    hoverRing?.remove();
    if (i < 0) { hoverRing = null; handlers.onHover?.(null, false); return; }
    // Drawn on top of everything, so it must not intercept clicks.
    const p = palette();
    hoverRing = el("g", { "pointer-events": "none" }) as SVGGElement;
    el("circle", {
      cx: screen[i][0], cy: screen[i][1], r: pinned ? 9 : 7,
      fill: "none", stroke: pinned ? p.accent : p.text,
      "stroke-width": pinned ? 2.5 : 2, "stroke-opacity": 0.9,
    }, hoverRing);
    el("circle", {
      cx: screen[i][0], cy: screen[i][1], r: 2.4, fill: pinned ? p.accent : p.text,
    }, hoverRing);
    handlers.onHover?.(describe(d, pts[i]), pinned);
  };

  /** Nearest point to a viewBox coordinate, with its squared distance. */
  const nearest = (vx: number, vy: number): [number, number] => {
    let best = -1, bestD = Infinity;
    for (let i = 0; i < screen.length; i++) {
      const dx = screen[i][0] - vx, dy = screen[i][1] - vy;
      const dist = dx * dx + dy * dy;
      if (dist < bestD) { bestD = dist; best = i; }
    }
    // Beyond ~40 viewBox units the reader is pointing at nothing in particular.
    return [bestD <= 1600 ? best : -1, bestD];
  };

  const point = (e: MouseEvent): [number, number] => {
    const r = svg.getBoundingClientRect();
    return [((e.clientX - r.left) / r.width) * W, ((e.clientY - r.top) / r.height) * H];
  };

  const at = (e: MouseEvent) => nearest(...point(e))[0];

  // Markers are hit-tested here by coordinate. On touch, Chromium retargets
  // taps on small SVG shapes, so a listener on the marker may never fire. The
  // closer of marker and dot wins, so neither hides the other. Touch gets a
  // larger radius.
  const slop = window.matchMedia("(pointer: coarse)").matches ? 34 : 15;

  const markerNear = (vx: number, vy: number, latticeD: number) => {
    let best = "", bestD = Infinity;
    for (const mk of markers) {
      const dx = mk.cx - vx, dy = mk.cy - vy;
      const dist = dx * dx + dy * dy;
      if (dist < bestD) { bestD = dist; best = mk.name; }
    }
    return bestD <= slop * slop && bestD <= latticeD ? best : "";
  };

  svg.addEventListener("mousemove", (e) => { if (!pinned) show(at(e)); });
  svg.addEventListener("mouseleave", () => { if (!pinned) show(-1); });
  svg.addEventListener("click", (e) => {
    const [vx, vy] = point(e);
    const [i, dist] = nearest(vx, vy);
    const mk = markerNear(vx, vy, dist);
    if (mk) return handlers.onMarker?.(mk);
    if (i < 0) return unpin();
    show(i, true);
  });

  const unpin = () => { pinned = false; show(-1); };
  svg.addEventListener("keydown", (e) => { if (e.key === "Escape") unpin(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && pinned) unpin(); });
  (svg as PlaneApi).unpin = unpin;

  // Lets the page pin the dot under a retail marker. Green sits exactly on a
  // dot, and opening its cards shouldn't make that dot unreachable by mouse.
  (svg as PlaneApi).pinPoint = (x, y) => {
    const [i, dist] = nearest(px(x), py(y));
    if (i >= 0 && dist <= 4) show(i, true);
  };

  svg.setAttribute("tabindex", "0");
  svg.addEventListener("keydown", (e) => {
    const step = { ArrowRight: 1, ArrowLeft: -1, ArrowUp: 1, ArrowDown: -1 }[e.key];
    if (step === undefined) return;
    e.preventDefault();
    if (current < 0) return show(0, true);
    const [, , t, q] = pts[current];
    if (e.key === "ArrowUp" || e.key === "ArrowDown") {
      // Within a column, points are ordered by q, so step to the neighbour.
      const inCol = pts.map((p, i) => [p, i] as const).filter(([p]) => p[2] === t);
      const at = inCol.findIndex(([p]) => p[3] === q);
      const next = inCol[at + step];
      if (next) show(next[1], true);
    } else {
      // Across columns, keep roughly the same height.
      const totals = [...new Set(pts.map((p) => p[2]))].sort((a, b) => a - b);
      const ti = totals.indexOf(t) + step;
      if (ti < 0 || ti >= totals.length) return;
      let best = -1, bestD = Infinity;
      pts.forEach((p, i) => {
        if (p[2] !== totals[ti]) return;
        const dist = Math.abs(p[1] - pts[current][1]);
        if (dist < bestD) { bestD = dist; best = i; }
      });
      if (best >= 0) show(best, true);
    }
  });
}
