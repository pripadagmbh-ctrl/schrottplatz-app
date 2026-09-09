/** Typen der Datenkataloge (Briefing Kap. 18). Die JSON-Schemas in data/schema/ spiegeln sie 1:1. */
export type Tier = "MVP" | "V1" | "LATER";

export interface MaterialDef {
  id: string; tier: Tier; densityKgM3: number;
  buyPricePerKg: number; sellPricePerKg: number; pricePerPiece?: boolean;
  color: string; secondaryColor?: string; icon: string;
  containerId: string | null; sortsAs?: string; hazard?: boolean;
  metalness?: number; roughness?: number;
}
export interface ShapeDef {
  id: string; collider: "box" | "cylinder" | "sphere" | "convex";
  sizeMin: [number, number, number]; sizeMax: [number, number, number];
  fill: number; materialIds: string[]; tris: number;
  /** Auswahlgewicht beim zufaelligen Spawnen (Standard 1; 0 = nur gezielt) */
  weight?: number;
}
export interface MaterialsFile { materials: MaterialDef[]; shapes: ShapeDef[]; }

export interface PartDef {
  id: string; materialId: string; massKg: number;
  anchor: [number, number, number]; grabRadius: number; tearSeconds: number;
  tool: "grapple" | "shear"; requires: string[]; blocksPress: boolean; unlockDay: number; tier?: Tier;
  shape: { kind: "box" | "wheel" | "cylinder"; size: number[] }; color: string;
}
export interface CompositeDef {
  id: string; tier: Tier; buyPriceEur: number;
  hull: { materialId: string; massKg: number; collider: "box"; half: [number, number, number]; yOffset: number };
  crushScales: [number, number, number]; glassImpactDv: number; crushImpactDv: number;
  parts: PartDef[];
  windows?: { id: string; anchor: [number, number, number]; size: [number, number]; rotY: number }[];
}
export interface CompositesFile { composites: CompositeDef[]; }

export interface Rect { x: number; z: number; hw: number; hd: number; }
export interface LevelDef {
  id: string; size: { w: number; d: number }; ground: { material: string; color: string };
  walls: { id: string; from: [number, number]; to: [number, number]; height: number; thickness: number; style: "betonlego" | "fence" | "concrete" }[];
  gate: { x: number; z: number; halfWidth: number };
  weighbridge: { x: number; z: number; length: number; width: number };
  buildings: { id: string; stage: 1 | 2 | 3; rect: Rect; height: number; model: string }[];
  containers: { id: string; materialId: string; kind: "pile" | "mulde"; stage: 1 | 2 | 3; rect: Rect; wallHeight: number; openSide: "north" | "south" | "east" | "west" }[];
  zones: { id: string; rect: Rect }[];
  routes: Record<string, [number, number][]>;
  spawns: { excavator: { x: number; z: number; heading: number }; piles?: { zoneId: string; count: number }[] };
  props?: { model: string; at: [number, number][] }[];
  clearanceM: number;
}

export interface VehicleBody { cabLen: number; bedLen: number; bedW: number; wallH: number; floorY: number; wheelR: number; tareKg: number }
export interface VehicleDef {
  id: string; routeIn: string; routeOut: string; speedMs: number; dumpSeconds: number;
  loadKgMin: number; loadKgMax: number; itemsMin: number; itemsMax: number; tier: Tier;
  body: VehicleBody; routeDock?: string; tips: boolean;
}
export interface CustomerDef {
  id: string; displayName: string; kind: "private" | "trade" | "dealer"; hardness: 1 | 2 | 3 | 4 | 5;
  vehicleIds: string[]; loadProfile: { materialId: string; share: number }[]; compositeDefId?: string;
  sortedProbability: number; patienceSeconds: number; fromDay: number; weight: number;
}
export interface CustomersFile { vehicles: VehicleDef[]; customers: CustomerDef[]; privateNames: string[]; }

export interface MissionDef {
  id: string; type: "deliver" | "clear" | "customer" | "dismantle" | "clean"; tier: Tier;
  params: Record<string, number | string>; bonusEur: number; fromDay: number; toDay?: number; weight: number;
}
export interface MissionsFile { missions: MissionDef[]; perDay: number; starsPerMission: number; }

export interface UpgradeDef {
  id: string; tier: Tier; kind: "stage" | "tool" | "station"; stage?: 2 | 3;
  priceEur: number; requiresStars: number; requires?: string; effects: Record<string, number | boolean | string>;
}
export interface UpgradesFile { upgrades: UpgradeDef[]; }

export interface AxisBinding { fn: "boom" | "stick" | "cab" | "grapple" | "rotator" | "none"; invert: boolean; }
export interface ControlsFile {
  axes: Record<"leftX" | "leftY" | "rightX" | "rightY", AxisBinding>;
  deadzone: number;
  keyboard: Record<string, string | { neg: string; pos: string }>;
  gamepad: Record<string, { axis?: number; button?: number; invert?: boolean }>;
  touch: Record<string, number | string>;
}

/** balancing.json — Struktur bewusst offen typisiert je Block; Schema erzwingt Pflichtfelder. */
export interface BalancingFile {
  physics: { stepHz: number; maxCatchUpSteps: number; solverIterations: number; internalPgsIterations: number; contactNaturalFrequency: number; sleepLinearThreshold: number; sleepAngularThreshold: number; spawnGapM: number; presimulateSteps: number };
  excavator: Record<string, number | string>;
  grip: Record<string, number | string>;
  economy: Record<string, number | string>;
  day: { deliveriesPerDay: Record<string, number>; deliveryIntervalS: [number, number]; campaignDays: number; unlockAfterDay: number; premiumPriceEur: number; targetDayMinutes: [number, number] };
  containers: Record<string, number>;
  scrap: Record<string, number | string>;
  customers: Record<string, number | string>;
  budgets: Record<string, number>;
  assist: Record<string, number | boolean | string>;
  vehicles: Record<string, number | boolean | string>;
  /** M4b: Tutorial-Startwerte (E-026) */
  tutorial: Record<string, number | string>;
  /** M5: Zerlegung (Briefing Kap. 8) */
  composites: Record<string, number | string>;
  /** Spinne Schritt 1 (E-043): weicher Zinken-Kontakt */
  clawContact: Record<string, number | string>;
  press: Record<string, number | number[] | string>;
}

export type I18nFile = Record<string, unknown>;

/** Alle validierten Kataloge zusammen — das, was die Simulation bekommt. */
export interface GameData {
  materials: MaterialsFile;
  composites: CompositesFile;
  level: LevelDef;
  customers: CustomersFile;
  missions: MissionsFile;
  upgrades: UpgradesFile;
  controls: ControlsFile;
  balancing: BalancingFile;
  i18n: I18nFile;
}
