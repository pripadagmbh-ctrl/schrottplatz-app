import type { ItemId, ContainerId, CompositeId, DeliveryId } from "@/shared/ids";
import type { Vec3, Quat } from "@/shared/math";

/**
 * Der gesamte Simulationszustand als reine Daten (Briefing Kap. 18). Keine Klassen mit
 * Verhalten, keine Three-Objekte — Systeme lesen und schreiben hier, Ansichten lesen Snapshots.
 * M0: Strukturen angelegt, noch leer befüllt. Systeme kommen ab M1.
 */
export type ItemState = "loose" | "held" | "settling" | "booked" | "onVehicle";

export interface ScrapItem {
  id: ItemId; materialId: string; shapeId: string;
  size: [number, number, number]; massKg: number;
  pos: Vec3; rot: Quat;
  /** Pose des vorherigen Physikschritts — für die Render-Interpolation */
  prevPos: Vec3; prevRot: Quat;
  sleeping: boolean;
  bodyHandle?: number;
  state: ItemState;
  compositeId?: CompositeId;
  origin: "delivery" | "torn" | "tutorial";
}
export interface ContainerState {
  id: ContainerId; contentKg: number; contaminationKg: number; pendingItemIds: ItemId[];
}
export interface CompositeState {
  id: CompositeId; defId: string; pos: Vec3; rot: Quat; crushStage: 0 | 1 | 2;
  remainingParts: string[]; hullMassKg: number; bodyHandle?: number;
  /** M5: der Rumpf ist ein normales Schrottteil (Form hull_*) */
  hullItemId: ItemId;
}
export interface ExcavatorState {
  pos: Vec3; heading: number; cab: number; boom: number; stick: number; rotator: number;
  grapple: number; cabLift: number; driveMode: boolean;
}
export interface DeliveryState {
  id: DeliveryId; customerId: string; vehicleId: string;
  phase: "approach" | "weighIn" | "inspect" | "toDump" | "dumping" | "weighOut" | "leave" | "done";
  grossKg: number; tareKg: number; priceEur: number; tStart: number;
  /** sortenrein deklariert (Fraktionspreis) oder Mischfuhre (Pauschale) */
  sorted: boolean; materialId: string | null;
  /** M5: Wrack-Lieferung (Pauschalpreis) */
  compositeDefId?: string;
}
export interface DayState {
  day: number; phase: "morning" | "work" | "evening" | "ended"; secondsInPhase: number;
  deliveriesToday: number; deliveriesDone: number;
  /** M4b: Tagesbilanz — wird am Morgen genullt, am Abend angezeigt */
  report: DayReport;
}
export interface DayReport {
  salesEur: number; purchasesEur: number; fixedEur: number; interestEur: number; missionBonusEur: number;
  points: number; correctSorts: number; wrongSorts: number; missionsDone: number; moneyStartEur: number;
}
export function emptyDayReport(moneyStartEur: number): DayReport {
  return { salesEur: 0, purchasesEur: 0, fixedEur: 0, interestEur: 0, missionBonusEur: 0, points: 0, correctSorts: 0, wrongSorts: 0, missionsDone: 0, moneyStartEur };
}
export interface EconomyState {
  moneyEur: number; starsTotal: number; premiumUnlocked: boolean; upgrades: string[];
  stats: { turnoverKg: number; correctSorts: number; wrongSorts: number; daysPlayed: number };
  /** Sortierpunkte (M4a): richtiges Einsortieren gibt Punkte, kein Geld */
  sortPoints: number;
}

export interface WorldState {
  items: Map<ItemId, ScrapItem>;
  containers: Map<ContainerId, ContainerState>;
  composites: Map<CompositeId, CompositeState>;
  deliveries: Map<DeliveryId, DeliveryState>;
  excavator: ExcavatorState;
  day: DayState;
  economy: EconomyState;
  /** Physik-Step-Zähler, fortlaufend */
  step: number;
}

export function createWorldState(startMoneyEur: number, spawn: { x: number; z: number; heading: number }): WorldState {
  return {
    items: new Map(), containers: new Map(), composites: new Map(), deliveries: new Map(),
    excavator: { pos: { x: spawn.x, y: 0, z: spawn.z }, heading: spawn.heading, cab: 0, boom: 35 * Math.PI / 180, stick: -70 * Math.PI / 180, rotator: 0, grapple: 0, cabLift: 0, driveMode: false },
    day: { day: 0, phase: "morning", secondsInPhase: 0, deliveriesToday: 0, deliveriesDone: 0, report: emptyDayReport(startMoneyEur) },
    economy: { moneyEur: startMoneyEur, starsTotal: 0, premiumUnlocked: false, upgrades: [], stats: { turnoverKg: 0, correctSorts: 0, wrongSorts: 0, daysPlayed: 0 }, sortPoints: 0 },
    step: 0,
  };
}
