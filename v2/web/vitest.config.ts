import { defineConfig } from "vitest/config";
import { fileURLToPath, URL } from "node:url";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "@data": fileURLToPath(new URL("./data", import.meta.url)),
    },
  },
  test: {
    include: ["test/unit/**/*.test.ts", "test/sim/**/*.test.ts"],
    environment: "node",
    // Die Sim-Tests rechnen echte Physik: "100× greifen" und der Fuzz-Lauf
    // brauchen allein je ~11 s. Laufen alle Dateien parallel, teilen sie sich
    // die Kerne und überschritten das frühere Limit von 20 s — beide Tests
    // waren rot, obwohl sie einzeln durchliefen (09.09.2026).
    //
    // Das Zeitlimit ist hier ausdrücklich KEIN Geschwindigkeitswächter. Der
    // steht in eigenen Zusicherungen: scrap_sleep.test.ts prüft < 0,3 ms je
    // Schritt im Schlaf, rapier_boot.test.ts stepMs < 2. Eine echte
    // Verlangsamung fällt dort auf, nicht hier.
    testTimeout: 90000,
  },
});
