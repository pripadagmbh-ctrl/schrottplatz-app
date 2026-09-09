import type { Simulation } from "@/sim/Simulation";
import { SaveService, type SaveBlob } from "./SaveService";

/**
 * Verdrahtung Autosave ↔ Simulation (M4b): laedt beim Start, speichert bei `saveRequested` (Tagesende),
 * beim Verstecken der Seite, alle `intervalS` waehrend des Betriebs. Export/Import/Neustart fuer die Sheets.
 * Import und Neustart laufen ueber Neuladen der Seite — ein halb geladener Zustand in einer laufenden Physik
 * waere die fehleranfaelligere Variante.
 */
export class Persistence {
  readonly service: SaveService;
  private timer = 0; private saving = false;

  constructor(private readonly sim: Simulation, version: string, private readonly intervalS = 60) {
    this.service = new SaveService(version);
  }

  /** Spielstand laden; liefert true, wenn ein gueltiger Stand uebernommen wurde. */
  async restore(): Promise<boolean> {
    const blob = await this.service.load();
    if (!blob) return false;
    try { this.sim.load(blob.sim); return true; } catch (err) { console.error("Spielstand unbrauchbar", err); this.service.broken = true; return false; }
  }

  wire(): void {
    this.sim.bus.on("saveRequested", () => void this.saveNow());
    document.addEventListener("visibilitychange", () => { if (document.hidden) void this.saveNow(); });
    window.addEventListener("pagehide", () => void this.saveNow());
  }

  /** Pro Simulationsschritt: Intervall-Speichern nur waehrend des Betriebs. */
  tick(dt: number): void {
    if (this.sim.world.day.phase !== "work") return;
    this.timer += dt; if (this.timer >= this.intervalS) { this.timer = 0; void this.saveNow(); }
  }

  async saveNow(): Promise<boolean> {
    if (this.saving) return false; this.saving = true;
    try { return await this.service.save(this.sim.save()); } finally { this.saving = false; }
  }

  blob(): SaveBlob { return { version: this.service.version, savedAt: new Date().toISOString(), sim: this.sim.save() }; }
  export(): void { this.service.exportFile(this.blob()); }
  async import(file: File): Promise<boolean> {
    const blob = await this.service.importFile(file); if (!blob) return false;
    const ok = await this.service.save(blob.sim); if (ok) location.reload(); return ok;
  }
  async restart(): Promise<void> { await this.service.clear(); location.reload(); }
}
