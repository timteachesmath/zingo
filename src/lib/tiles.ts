/**
 * The 24 images of the physical game, recovered from the two retail sheets:
 * green prints all 24, red prints 22 and spares owl and tree.
 *
 * The analysis only cares how many cards share a tile, not which image it is;
 * generated boards use these names so they read like real Zingo cards.
 */
export const TILES = [
  "apple", "ball", "bat", "bird", "bunny", "cake", "cat", "clock",
  "cup", "dog", "fish", "foot", "ghost", "heart", "house", "kite",
  "owl", "shoe", "smile", "star", "sun", "train", "tree", "worm",
] as const;
