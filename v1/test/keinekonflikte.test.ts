import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve, extname } from "node:path";

/*
 * Kein Konfliktmarker kommt durch — auch nicht in einem Dokument.
 *
 * Befund 15.09.2026: Beim Zusammenführen von vier Paketen an einem Abend sind
 * `<<<<<<< HEAD`, `=======` und `>>>>>>> worktree-agent-…` in
 * `docs/entscheidungen.md` stehen geblieben und mitcommittet worden. Das Log
 * war ab Zeile 1540 doppelt und unlesbar — und **niemand hat es gemerkt**:
 * 774 Tests waren grün, weil kein Test je ein Dokument ansieht.
 *
 * Gefunden hat es ein Agent, dem die Datei beim Nachschlagen aufgefallen ist.
 * Das ist zu viel Zufall für eine Datei, in der die Begründung jeder
 * Entscheidung dieses Projekts steht.
 *
 * Der Wächter kostet nichts und prüft alles, was ein Mensch liest: Quelltext,
 * Tests, Werkzeuge, Dokumente, die Seite selbst. Im Quelltext hätte `tsc` die
 * Marker gefangen; in `docs/` fängt sie sonst gar nichts.
 */

const wurzel = resolve(__dirname, "..");

/** Ordner, die geprüft werden. `node_modules` und `dist` bleiben draußen. */
const ORDNER = ["src", "test", "tools", "docs"];
/** Dateien im Wurzelverzeichnis, die mitgeprüft werden. */
const EINZELN = ["index.html", "README.md", "package.json", "tsconfig.json"];

/**
 * Die drei Marker, die Git hinterlässt.
 *
 * Zusammengesetzt, damit diese Datei sich nicht selbst meldet — sonst wäre der
 * Wächter beim ersten Lauf rot und würde als kaputt abgetan.
 */
const MARKER = [
  "<".repeat(7) + " ",
  "=".repeat(7) + "\n",
  ">".repeat(7) + " ",
];

/** Was ein Mensch liest. Bilder und Schriften interessieren nicht. */
const TEXT = new Set([".ts", ".tsx", ".js", ".mjs", ".md", ".html", ".css", ".json", ".svg"]);

function sammeln(verzeichnis: string, gesammelt: string[] = []): string[] {
  for (const name of readdirSync(verzeichnis)) {
    if (name === "node_modules" || name === "dist" || name === ".git") continue;
    const voll = join(verzeichnis, name);
    if (statSync(voll).isDirectory()) sammeln(voll, gesammelt);
    else if (TEXT.has(extname(name).toLowerCase())) gesammelt.push(voll);
  }
  return gesammelt;
}

describe("Kein Konfliktmarker kommt durch", () => {
  const dateien = [
    ...ORDNER.flatMap((o) => sammeln(resolve(wurzel, o))),
    ...EINZELN.map((f) => resolve(wurzel, f)),
  ].filter((f) => f !== resolve(__dirname, "keinekonflikte.test.ts"));

  it("prüft überhaupt etwas — sonst wäre das hier eine leere Geste", () => {
    /*
     * Ein Wächter, der null Dateien liest, ist grün und wertlos. Genau diese
     * Sorte Selbsttäuschung ist an diesem Tag dreimal aufgefallen.
     */
    expect(dateien.length, "keine Dateien gefunden").toBeGreaterThan(100);
    expect(dateien.some((f) => f.includes("entscheidungen.md")), "das Log fehlt").toBe(true);
    expect(dateien.some((f) => f.endsWith(".ts")), "kein Quelltext dabei").toBe(true);
  });

  it("in keiner Datei stehen Reste eines Zusammenführens", () => {
    const treffer: string[] = [];
    for (const datei of dateien) {
      const text = readFileSync(datei, "utf8");
      for (const m of MARKER) {
        if (!text.includes(m)) continue;
        const zeile = text.slice(0, text.indexOf(m)).split("\n").length;
        treffer.push(`${datei.slice(wurzel.length + 1)}:${zeile}`);
        break;
      }
    }
    expect(treffer, `Konfliktreste in:\n  ${treffer.join("\n  ")}`).toEqual([]);
  });

  it("und keine Entscheidungsnummer kommt zweimal vor", () => {
    /*
     * Die zweite Hälfte desselben Schadens: Beim Auflösen von Hand entstehen
     * leicht Dubletten, und im Log ist die Nummer die Kennung. Zwei Einträge
     * E-029 heisst, dass eine Entscheidung nicht mehr auffindbar ist.
     */
    const log = readFileSync(resolve(wurzel, "docs/entscheidungen.md"), "utf8");
    const nummern = [...log.matchAll(/^### (E-\d+)/gm)].map((m) => m[1]!);
    expect(nummern.length, "keine Einträge gefunden").toBeGreaterThan(20);
    const doppelt = nummern.filter((n, i) => nummern.indexOf(n) !== i);
    expect([...new Set(doppelt)], "doppelte Nummern im Log").toEqual([]);
  });
});
