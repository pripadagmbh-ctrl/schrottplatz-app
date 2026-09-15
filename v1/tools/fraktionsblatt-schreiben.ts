/**
 * Schreibt das Fraktionsblatt nach `docs/fraktionen-2026-09-15.svg`.
 *
 * Aufruf aus `v1/`:
 *
 *     npx vite-node tools/fraktionsblatt-schreiben.ts
 *
 * `vite-node` liegt als Abhängigkeit von Vitest ohnehin unter
 * `node_modules/.bin/` — derselbe Weg, den `tools/fuenfschalen/export.ts` schon
 * geht (siehe README). Der Umweg über eine Wegwerf-Testdatei, wie ihn ältere
 * Werkzeuge in ihrem Kopf beschreiben, ist dafür nicht nötig.
 */
import { writeFileSync } from "node:fs";
import { zeichneFraktionsblatt } from "./fraktionsblatt";

const ZIEL = "docs/fraktionen-2026-09-15.svg";
writeFileSync(ZIEL, zeichneFraktionsblatt());
console.log(`geschrieben: ${ZIEL}`);
