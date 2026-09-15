/**
 * Wie weit ruecken die Bauten, wenn sie ihren Grundton aus der Fraktion holen?
 *
 *     npx vite-node tools/metallton.ts
 *
 * Gemessen wird der Abstand des bisherigen `STAHL` (0x6f6a63) zu jeder
 * Fraktionsfarbe. Die Zahl entscheidet, ob die Umstellung (E-063) fuer Stahl
 * unsichtbar bleibt — und fuer Kupfer, Messing und VA sichtbar wird.
 */
import { deltaEHex } from "./farbabstand";
import { MATERIALS } from "../src/materials/catalog";

const STAHL = 0x6f6a63;
console.log("Fraktion\tHex\tdE2000 zu STAHL");
for (const m of Object.values(MATERIALS))
  console.log(
    `${m.id}\t#${m.color.toString(16).padStart(6, "0")}\t${deltaEHex(STAHL, m.color).toFixed(2)}`
  );
