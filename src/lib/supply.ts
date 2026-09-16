import type { BoardSet } from "./board.js";
import { tileSpreads } from "./overlap.js";

/** Physical Zingo stocks three copies of every tile. */
export const SUPPLY = 3;

export interface Oversubscribed {
  tile: string;
  spread: number; // cards that print it
  guaranteedLockouts: number; // spread - SUPPLY, if positive
}

/**
 * Tiles printed on more cards than there are copies. With all those cards in play,
 * each such tile locks out (spread - SUPPLY) players by pigeonhole, no matter the
 * draw order.
 */
export function oversubscribed(cards: BoardSet, supply = SUPPLY): Oversubscribed[] {
  const out: Oversubscribed[] = [];
  for (const [tile, spread] of tileSpreads(cards))
    if (spread > supply)
      out.push({ tile, spread, guaranteedLockouts: spread - supply });
  return out.sort((a, b) => b.spread - a.spread || a.tile.localeCompare(b.tile));
}

/** True if every tile fits within supply (a physically playable set). */
export function isPlayable(cards: BoardSet, supply = SUPPLY): boolean {
  return oversubscribed(cards, supply).length === 0;
}
