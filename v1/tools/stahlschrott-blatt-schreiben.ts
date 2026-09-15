/**
 * Schreibt das Stahlschrott-Blatt nach `docs/stahlschrott-2026-09-15.svg`.
 *
 * Aufruf aus `v1/`:
 *
 *     npx vite-node tools/stahlschrott-blatt-schreiben.ts
 *
 * Landet über `tools/planmappe.mjs` von selbst in der Planmappe unter
 * `/v1/plaene/` — die Mappe liest `docs/` beim Bauen aus.
 */
import { writeFileSync } from "node:fs";
import { zeichneStahlschrottblatt } from "./stahlschrott-blatt";

const ZIEL = "docs/stahlschrott-2026-09-15.svg";
writeFileSync(ZIEL, zeichneStahlschrottblatt());
console.log(`geschrieben: ${ZIEL}`);
