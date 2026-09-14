import { resolve } from "node:path";
import { defineConfig } from "vite";

// base "./" damit der Build später unverändert in Capacitor (Android) läuft.
// Port ueber PORT ueberschreibbar, damit mehrere Worktrees parallel laufen koennen.
const port = Number(process.env.PORT) || 5173;

export default defineConfig({
  base: "./",
  /*
   * Drei Seiten: das Spiel, das Spinnen-Labor (Auftrag 11.09.2026, Phase 1.1)
   * und die Greifer-Vorschau. Labor und Vorschau laufen getrennt vom Spiel —
   * die Lehre aus dem letzten Umbau war, die Spinne nicht im laufenden Spiel
   * umzubauen. Die Vorschau laedt zusaetzlich die exportierte GLB-Datei statt
   * des Modells aus dem Quelltext: Nur so sieht man, was in einer Engine
   * ankommt.
   */
  build: {
    rollupOptions: {
      input: {
        index: resolve(__dirname, "index.html"),
        labor: resolve(__dirname, "labor.html"),
        greifer: resolve(__dirname, "greifer.html"),
      },
    },
  },
  server: {
    port,
    strictPort: true,
  },
  /*
   * Nur `test/` laeuft als Testlauf. Unter `docs/archiv/` liegen die Quellen
   * abgelegter Bauformen samt ihrer Waechter — die gehoeren zum Archiv und
   * sollen nicht gegen den aktuellen Stand gemessen werden. Ohne diese Zeile
   * schlug der Waechter der Fuenfschalenschale fehl, sobald die Sichelkralle
   * wieder eingebaut war.
   */
  test: {
    include: ["test/**/*.test.ts"],
  },
});
