import Ajv from "ajv";
import type { ErrorObject } from "ajv";
import type { GameData } from "./types";

import materials from "@data/materials.json";
import composites from "@data/composites.json";
import level from "@data/level_yard.json";
import customers from "@data/customers.json";
import missions from "@data/missions.json";
import upgrades from "@data/upgrades.json";
import controls from "@data/controls.json";
import balancing from "@data/balancing.json";
import i18nDe from "@data/i18n/de.json";

import materialsSchema from "@data/schema/materials.schema.json";
import compositesSchema from "@data/schema/composites.schema.json";
import levelSchema from "@data/schema/level.schema.json";
import customersSchema from "@data/schema/customers.schema.json";
import missionsSchema from "@data/schema/missions.schema.json";
import upgradesSchema from "@data/schema/upgrades.schema.json";
import controlsSchema from "@data/schema/controls.schema.json";
import balancingSchema from "@data/schema/balancing.schema.json";
import i18nSchema from "@data/schema/i18n.schema.json";

/**
 * Lädt und validiert alle Datenkataloge (Architektur Kap. 6). Ein Schemafehler bricht mit
 * Klartext ab — lieber ein lauter Start-Fehler als ein Spiel, das „stumm falsch" läuft.
 * Zusätzlich prüfen wir Querbezüge, die ein JSON-Schema nicht sieht (z. B. Material-Id existiert).
 */
export class DataError extends Error {
  constructor(public readonly file: string, public readonly problems: string[]) {
    super(`Datenfehler in ${file}:\n  ${problems.join("\n  ")}`);
    this.name = "DataError";
  }
}

const ajv = new Ajv({ allErrors: true, strict: false });

function validate<T>(file: string, schema: object, data: unknown): T {
  const check = ajv.compile(schema);
  if (!check(data)) {
    const errs = (check.errors ?? []) as ErrorObject[];
    throw new DataError(file, errs.map((e) => `${e.instancePath || "/"} ${e.message ?? ""}`));
  }
  return data as T;
}

/** Querbezüge zwischen den Dateien. Gibt Liste der Probleme zurück (leer = ok). */
export function crossCheck(d: GameData): string[] {
  const problems: string[] = [];
  const matIds = new Set(d.materials.materials.map((m) => m.id));
  const containerIds = new Set(d.level.containers.map((c) => c.id));
  const routeIds = new Set(Object.keys(d.level.routes));
  const compositeIds = new Set(d.composites.composites.map((c) => c.id));
  const vehicleIds = new Set(d.customers.vehicles.map((v) => v.id));

  for (const m of d.materials.materials) {
    if (m.containerId !== null && !containerIds.has(m.containerId)) problems.push(`materials: ${m.id} → containerId ${m.containerId} fehlt in level_yard.containers`);
    if (m.sortsAs && !matIds.has(m.sortsAs)) problems.push(`materials: ${m.id}.sortsAs ${m.sortsAs} unbekannt`);
  }
  for (const s of d.materials.shapes) {
    for (const id of s.materialIds) if (!matIds.has(id)) problems.push(`shapes: ${s.id} → material ${id} unbekannt`);
    for (let i = 0; i < 3; i++) if ((s.sizeMin[i] ?? 0) > (s.sizeMax[i] ?? 0)) problems.push(`shapes: ${s.id} sizeMin > sizeMax an Index ${i}`);
  }
  for (const c of d.level.containers) if (!matIds.has(c.materialId)) problems.push(`level: container ${c.id} → material ${c.materialId} unbekannt`);
  for (const c of d.composites.composites) {
    if (!matIds.has(c.hull.materialId)) problems.push(`composites: ${c.id}.hull material unbekannt`);
    const partIds = new Set(c.parts.map((p) => p.id));
    for (const p of c.parts) {
      if (!matIds.has(p.materialId)) problems.push(`composites: ${c.id}.${p.id} material ${p.materialId} unbekannt`);
      for (const r of p.requires) if (!partIds.has(r)) problems.push(`composites: ${c.id}.${p.id} requires ${r} fehlt`);
    }
  }
  for (const v of d.customers.vehicles) {
    if (!routeIds.has(v.routeIn)) problems.push(`customers: vehicle ${v.id}.routeIn ${v.routeIn} fehlt in level.routes`);
    if (!routeIds.has(v.routeOut)) problems.push(`customers: vehicle ${v.id}.routeOut ${v.routeOut} fehlt in level.routes`);
  }
  for (const c of d.customers.customers) {
    for (const id of c.vehicleIds) if (!vehicleIds.has(id)) problems.push(`customers: ${c.id} → vehicle ${id} unbekannt`);
    for (const lp of c.loadProfile) if (!matIds.has(lp.materialId)) problems.push(`customers: ${c.id} → material ${lp.materialId} unbekannt`);
    const sum = c.loadProfile.reduce((a, b) => a + b.share, 0);
    if (c.loadProfile.length > 0 && Math.abs(sum - 1) > 0.001) problems.push(`customers: ${c.id} loadProfile summiert auf ${sum.toFixed(3)}, nicht 1`);
    if (c.compositeDefId && !compositeIds.has(c.compositeDefId)) problems.push(`customers: ${c.id} → composite ${c.compositeDefId} unbekannt`);
  }
  const upIds = new Set(d.upgrades.upgrades.map((u) => u.id));
  for (const u of d.upgrades.upgrades) if (u.requires && !upIds.has(u.requires)) problems.push(`upgrades: ${u.id} requires ${u.requires} fehlt`);
  const missionTexts = (d.i18n as { missions?: Record<string, string> }).missions ?? {};
  for (const m of d.missions.missions) if (!missionTexts[m.id]) problems.push(`i18n: Text für Auftrag ${m.id} fehlt`);
  const matTexts = (d.i18n as { material?: Record<string, string> }).material ?? {};
  for (const m of d.materials.materials) if (!matTexts[m.id]) problems.push(`i18n: Name für Material ${m.id} fehlt`);
  return problems;
}

/** Synchron, weil alle Daten zur Build-Zeit eingebettet sind (klein, < 100 kB). */
export function loadGameData(): GameData {
  const data: GameData = {
    materials: validate("materials.json", materialsSchema, materials),
    composites: validate("composites.json", compositesSchema, composites),
    level: validate("level_yard.json", levelSchema, level),
    customers: validate("customers.json", customersSchema, customers),
    missions: validate("missions.json", missionsSchema, missions),
    upgrades: validate("upgrades.json", upgradesSchema, upgrades),
    controls: validate("controls.json", controlsSchema, controls),
    balancing: validate("balancing.json", balancingSchema, balancing),
    i18n: validate("i18n/de.json", i18nSchema, i18nDe),
  };
  const problems = crossCheck(data);
  if (problems.length > 0) throw new DataError("Querbezüge", problems);
  return data;
}
