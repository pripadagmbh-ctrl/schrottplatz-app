/**
 * Seedbarer Zufall (Mulberry32). Tests und Spielstände brauchen Wiederholbarkeit:
 * derselbe Seed → dieselbe Fuhre, derselbe Haufen. `Math.random()` ist in sim/ tabu.
 */
export class Rng {
  private s: number;
  constructor(seed: number) { this.s = seed >>> 0; }
  /** 0 ≤ x < 1 */
  next(): number {
    this.s = (this.s + 0x6d2b79f5) >>> 0;
    let t = this.s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  range(min: number, max: number): number { return min + (max - min) * this.next(); }
  int(minInclusive: number, maxInclusive: number): number {
    return minInclusive + Math.floor(this.next() * (maxInclusive - minInclusive + 1));
  }
  pick<T>(arr: readonly T[]): T {
    if (arr.length === 0) throw new Error("Rng.pick: leeres Array");
    return arr[Math.floor(this.next() * arr.length)] as T;
  }
  /** Gewichtete Auswahl; `weight(x)` > 0. */
  pickWeighted<T>(arr: readonly T[], weight: (x: T) => number): T {
    let total = 0;
    for (const x of arr) total += weight(x);
    let r = this.next() * total;
    for (const x of arr) { r -= weight(x); if (r <= 0) return x; }
    return arr[arr.length - 1] as T;
  }
  state(): number { return this.s; }
}
