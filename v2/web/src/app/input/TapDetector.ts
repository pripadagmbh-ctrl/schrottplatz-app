/**
 * Doppeltipp-Erkennung, unabhängig vom DOM (testbar in Vitest mit eigener Uhr).
 * Ein Tipp: kurz (≤ tapMaxMs) und unbewegt (≤ tapMaxMovePx). Doppeltipp: zwei Tipps innerhalb doubleTapMs
 * am selben Ort (≤ doubleTapRadiusPx). Die Ortsprüfung ist der Kern — ohne sie zählen linker und rechter
 * Daumen nacheinander als Doppeltipp (Gerätetest 08.09.2026).
 */
export interface TapConfig { tapMaxMs: number; tapMaxMovePx: number; doubleTapMs: number; doubleTapRadiusPx: number }

export class TapDetector {
  private readonly down = new Map<number, { t: number; x: number; y: number }>();
  private last: { t: number; x: number; y: number } | null = null;
  constructor(private readonly cfg: TapConfig) {}

  pointerDown(id: number, x: number, y: number, t: number): void { this.down.set(id, { t, x, y }); }
  cancel(id: number): void { this.down.delete(id); }

  /** true = Doppeltipp erkannt */
  pointerUp(id: number, x: number, y: number, t: number): boolean {
    const d = this.down.get(id); this.down.delete(id);
    if (!d) return false;
    if (t - d.t > this.cfg.tapMaxMs || Math.hypot(x - d.x, y - d.y) > this.cfg.tapMaxMovePx) { this.last = null; return false; }
    const prev = this.last;
    if (prev && t - prev.t < this.cfg.doubleTapMs && Math.hypot(d.x - prev.x, d.y - prev.y) < this.cfg.doubleTapRadiusPx) { this.last = null; return true; }
    this.last = { t, x: d.x, y: d.y };
    return false;
  }
}
