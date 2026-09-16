/** A card is its set of tile names. */
export type Card = Set<string>;
export type BoardSet = Card[];

/**
 * Parse a Zingo sheet. A sheet is written as rows of whitespace-separated tiles;
 * each COLUMN is one card (a 9-row x 6-col sheet => six cards of nine tiles).
 */
export function parseSheet(text: string): BoardSet {
  const rows = text
    .trim()
    .split(/\r?\n/)
    .map((r) => r.trim().split(/\s+/).filter(Boolean));
  if (rows.length === 0) throw new Error("Empty sheet.");
  const width = rows[0].length;
  if (!rows.every((r) => r.length === width))
    throw new Error("Every row must have the same number of tiles.");
  const cards: BoardSet = [];
  for (let c = 0; c < width; c++) cards.push(new Set(rows.map((r) => r[c])));
  return cards;
}

/** A card is well-formed if it has no repeated tile. Returns offending cards. */
export function duplicateTiles(text: string): number[] {
  const rows = text
    .trim()
    .split(/\r?\n/)
    .map((r) => r.trim().split(/\s+/).filter(Boolean));
  const width = rows[0]?.length ?? 0;
  const bad: number[] = [];
  for (let c = 0; c < width; c++) {
    const col = rows.map((r) => r[c]);
    if (new Set(col).size !== col.length) bad.push(c);
  }
  return bad;
}
