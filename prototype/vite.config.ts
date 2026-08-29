import { defineConfig } from "vite";

// base "./" damit der Build später unverändert in Capacitor (Android) läuft.
export default defineConfig({
  base: "./",
  server: {
    port: 5173,
    strictPort: true,
  },
});
