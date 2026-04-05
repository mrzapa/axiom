/**
 * FNV-1a 32-bit hash. Deterministic, fast, good distribution.
 */
export function fnv1a32(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/**
 * Mulberry32 PRNG. Initialised from a seed integer.
 */
export class SeededRNG {
  private s: number;

  constructor(seed: number) {
    this.s = seed >>> 0;
  }

  /** Returns float in [0, 1) */
  next(): number {
    this.s |= 0;
    this.s = (this.s + 0x6d2b79f5) | 0;
    let t = Math.imul(this.s ^ (this.s >>> 15), 1 | this.s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Returns float in [min, max) */
  range(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  /** Returns integer in [0, n) */
  int(n: number): number {
    return Math.floor(this.next() * n);
  }

  /** Picks a random element */
  pick<T>(arr: readonly T[]): T {
    return arr[this.int(arr.length)];
  }

  /** Gaussian approximation ~N(0, 1) using Central Limit Theorem */
  gaussian(): number {
    let s = 0;
    for (let i = 0; i < 6; i++) s += this.next();
    return (s - 3) / Math.sqrt(3);
  }
}
