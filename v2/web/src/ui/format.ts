import type { GameData, MissionDef } from "@/data/types";
import type { ActiveMission } from "@/sim/systems/MissionSystem";

/** Kleine Textbausteine fuer HUD und Sheets (M4b). `t("day.morning", {day: 3})` ersetzt {day}. */
export function makeT(i18n: Record<string, unknown>) {
  return (key: string, vars: Record<string, string | number> = {}): string => {
    let cur: unknown = i18n;
    for (const k of key.split(".")) { cur = (cur as Record<string, unknown> | undefined)?.[k]; if (cur === undefined) return key; }
    return String(cur).replace(/\{(\w+)\}/g, (_, k: string) => (k in vars ? String(vars[k]) : `{${k}}`));
  };
}
export type T = ReturnType<typeof makeT>;

export function missionText(def: MissionDef, data: GameData, t: T): string {
  const p = def.params;
  const customer = data.customers.customers.find((c) => c.id === p["customerId"])?.displayName ?? "";
  return t(`missions.${def.id}`, { kg: String(p["kg"] ?? p["maxLooseKg"] ?? ""), purity: Math.round(Number(p["minPurity"] ?? 0) * 100), customer, minutes: String(p["maxMinutes"] ?? "") });
}

export function missionProgress(m: ActiveMission): string {
  if (m.done) return "✓";
  if (m.def.type === "deliver") return `${Math.round(m.progress)}/${m.target} kg`;
  if (m.def.type === "clear") return `${Math.round(m.progress)} kg lose (≤ ${m.target})`;
  return "offen";
}

export function eur(x: number): string { return `${x < 0 ? "−" : ""}${Math.abs(x).toLocaleString("de-DE", { minimumFractionDigits: 0, maximumFractionDigits: 0 })} €`; }
