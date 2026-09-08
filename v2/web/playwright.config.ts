import { defineConfig } from "@playwright/test";

// Rauchtest gegen den Vite-Dev-Server. Chromium reicht; Safari/iOS wird auf dem Gerät gemessen.
export default defineConfig({
  testDir: "test/e2e",
  timeout: 60_000,
  retries: 0,
  use: { baseURL: "http://localhost:5174", viewport: { width: 1180, height: 820 } },
  webServer: {
    command: "npx vite --port 5174 --strictPort",
    url: "http://localhost:5174",
    reuseExistingServer: true,
    timeout: 60_000,
  },
  // Auf dem Entwicklungs-PC: einmal `npx playwright install chromium`. In Umgebungen mit vorinstalliertem
  // Chromium kann PW_CHROMIUM_PATH auf die ausführbare Datei zeigen.
  projects: [{
    name: "chromium",
    use: { browserName: "chromium", ...(process.env["PW_CHROMIUM_PATH"] ? { launchOptions: { executablePath: process.env["PW_CHROMIUM_PATH"] } } : {}) },
  }],
});
