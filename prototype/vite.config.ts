import { resolve } from "node:path";
import { defineConfig } from "vite";

// base "./" damit der Build später unverändert in Capacitor (Android) läuft.
// Port ueber PORT ueberschreibbar, damit mehrere Worktrees parallel laufen koennen.
const port = Number(process.env.PORT) || 5173;

export default defineConfig({
  base: "./",
  /*
   * Zwei Seiten: das Spiel und das Spinnen-Labor (Auftrag 11.09.2026,
   * Phase 1.1). Das Labor laeuft getrennt vom Spiel — die Lehre aus dem
   * letzten Umbau war, die Spinne nicht im laufenden Spiel umzubauen.
   */
  build: {
    rollupOptions: {
      input: {
        index: resolve(__dirname, "index.html"),
        labor: resolve(__dirname, "labor.html"),
      },
    },
  },
  server: {
    port,
    strictPort: true,
  },
});
