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
    testTimeout: 20000,
  },
});
