import { randomInt } from "node:crypto";

// Shared by the lottery and raffle draws. Winners decide prizes people collect
// in person, so the shuffle uses the OS's cryptographic generator rather than
// Math.random, whose sequence is predictable from a few outputs.

/** Returns a uniformly random integer in [0, max). Injected in tests. */
export type RandomInt = (max: number) => number;

const cryptoRandomInt: RandomInt = (max) => randomInt(max);

/** Fisher-Yates shuffle into a new array; the input is left untouched. */
export function secureShuffle<T>(items: readonly T[], rng: RandomInt = cryptoRandomInt): T[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = rng(i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export type PickOptions<T> = {
  /**
   * Entries sharing a key can win only once in this draw (one prize per
   * person). Omit to let every entry win independently.
   */
  holderKey?: (entry: T) => string;
  /**
   * Entries that may not be picked: earlier winners when redrawing a single
   * prize, or tickets ruled ineligible.
   */
  exclude?: (entry: T) => boolean;
  /** Holder keys that have already won, for a redraw of one prize. */
  excludeHolders?: Iterable<string>;
  rng?: RandomInt;
};

/**
 * Picks up to `count` distinct winners from `pool` in draw order. An entry is
 * never picked twice, and with `holderKey` a holder is never picked twice.
 */
export function pickWinners<T>(pool: readonly T[], count: number, options: PickOptions<T> = {}): T[] {
  const { holderKey, exclude, excludeHolders, rng } = options;
  const want = Math.max(0, Math.floor(count));
  if (want === 0) return [];

  const seenHolders = new Set<string>(excludeHolders ?? []);
  const winners: T[] = [];
  for (const entry of secureShuffle(pool, rng)) {
    if (exclude?.(entry)) continue;
    if (holderKey) {
      const key = holderKey(entry);
      if (seenHolders.has(key)) continue;
      seenHolders.add(key);
    }
    winners.push(entry);
    if (winners.length >= want) break;
  }
  return winners;
}
