import { defineConfig } from "vite";
import { fileURLToPath, URL } from "node:url";
import { readFileSync } from "node:fs";

const pkg = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8")) as { version: string };

// base "./": der Build läuft unverändert unter GitHub Pages (/schrottplatz-app/v2/)
// und später im Capacitor-Wrapper. Absolute Pfade würden eines von beiden brechen.
export default defineConfig({
  base: "./",
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "@data": fileURLToPath(new URL("./data", import.meta.url)),
    },
  },
  server: { port: 5174, strictPort: true },
  build: {
    target: "es2022",
    sourcemap: true,
    chunkSizeWarningLimit: 3000, // Rapier-WASM (base64 in -compat) ist bewusst ein eigener Chunk
    // Rapier (WASM, ~1,2 MB) und Three getrennt ausliefern: Browser-Cache greift je Datei.
    rollupOptions: {
      output: {
        manualChunks: {
          three: ["three"],
          rapier: ["@dimforge/rapier3d-compat"],
        },
      },
    },
  },
});
