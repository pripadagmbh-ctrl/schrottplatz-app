import { defineConfig } from "vite";

// base "./" damit der Build später unverändert in Capacitor (Android) läuft.
// Port ueber PORT ueberschreibbar, damit mehrere Worktrees parallel laufen koennen.
const port = Number(process.env.PORT) || 5173;

export default defineConfig({
  base: "./",
  server: {
    port,
    strictPort: true,
  },
});
