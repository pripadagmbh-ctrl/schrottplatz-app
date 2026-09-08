import type { AimState } from "@/sim/systems/AimSystem";
import type { MaterialDef } from "@/data/types";
import { euroIndicator } from "@/shared/pricing";

/**
 * Griff-Info-Chip (Briefing Kap. 14.1): unten Mitte, 44 px hoch. Zeigt Fraktion · kg · €-Stufe des Teils unter
 * dem Sensor bzw. der Ladung („gegriffen"). Über einem Container ergänzt ein Symbol das Urteil (✓ / ! / ✗),
 * damit Farbe nie der einzige Kanal ist (Kap. 20). DOM wird nur bei Textänderung geschrieben (< 100 ms).
 */
export class GripChip {
  readonly el: HTMLElement;
  private readonly mats = new Map<string, MaterialDef>();
  private lastText = ""; private lastState = "";

  constructor(parent: HTMLElement, private readonly i18n: Record<string, unknown>, materials: readonly MaterialDef[]) {
    for (const m of materials) this.mats.set(m.id, m);
    this.el = document.createElement("div");
    this.el.id = "grip-chip"; this.el.hidden = true;
    parent.appendChild(this.el);
  }

  private t(path: string): string {
    let cur: unknown = this.i18n;
    for (const k of path.split(".")) cur = (cur as Record<string, unknown> | undefined)?.[k];
    return typeof cur === "string" ? cur : path;
  }
  private nameOf(id: string | null): string { return id === "mixed" ? "gemischt" : id ? this.t(`material.${id}`) : ""; }
  private euro(id: string | null): string {
    const m = id ? this.mats.get(id) : undefined; if (!m) return "";
    const e = euroIndicator(m.sellPricePerKg); return e === "fee" ? this.t("hud.grabInfo.fee") : e;
  }

  update(a: AimState): void {
    let text = "", state = "";
    if (a.heldCount > 0) {
      const sym = a.verdict === "ok" ? " ✓" : a.verdict === "tolerated" ? " !" : a.verdict === "wrong" ? " ✗" : "";
      text = `${this.nameOf(a.heldMaterialId)} · ${Math.round(a.heldKg)} kg · ${this.euro(a.heldMaterialId)} · ${this.t("hud.grabInfo.held")}${sym}`;
      state = a.verdict;
    } else if (a.hoverItemId) {
      text = `${this.nameOf(a.hoverMaterialId)} · ${Math.round(a.hoverKg)} kg · ${this.euro(a.hoverMaterialId)}`;
      state = "item";
    }
    if (text === this.lastText && state === this.lastState) return;
    this.lastText = text; this.lastState = state;
    this.el.hidden = text === "";
    this.el.textContent = text;
    this.el.dataset["state"] = state;
  }

  dispose(): void { this.el.remove(); }
}
