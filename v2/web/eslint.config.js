// Lint-Gate (Briefing Kap. 17, Architektur Kap. 8).
// Die eine Regel, die die Architektur trägt: Abhängigkeiten zeigen nur nach unten,
// und die Simulation kennt weder Three.js noch das DOM. Ein Verstoß ist ein Fehler,
// kein Hinweis — `npm run lint` bricht ab.
import tseslint from "typescript-eslint";
import boundaries from "eslint-plugin-boundaries";

export default tseslint.config(
  { ignores: ["dist/**", "node_modules/**", "playwright-report/**", "test-results/**", "tools/**", "*.config.*", "eslint.config.js"] },
  ...tseslint.configs.recommended,
  {
    files: ["src/**/*.ts", "test/**/*.ts"],
    plugins: { boundaries },
    settings: {
      "boundaries/elements": [
        { type: "shared", pattern: "src/shared/**" },
        { type: "data", pattern: "src/data/**" },
        { type: "sim", pattern: "src/sim/**" },
        { type: "view", pattern: "src/view/**" },
        { type: "ui", pattern: "src/ui/**" },
        { type: "audio", pattern: "src/audio/**" },
        { type: "app", pattern: "src/app/**" },
        { type: "test", pattern: "test/**" },
      ],
      "boundaries/ignore": ["**/*.json"],
      // Alias "@/..." aus tsconfig auflösen — sonst sieht das Plugin die Schichtgrenzen nicht.
      "import/resolver": { typescript: { project: "./tsconfig.json" } },
    },
    rules: {
      "boundaries/element-types": [
        "error",
        {
          default: "disallow",
          message: "Schichtenregel: ${file.type} darf nicht aus ${dependency.type} importieren (Briefing Kap. 17.2)",
          rules: [
            { from: "shared", allow: [] },
            { from: "data", allow: ["shared"] },
            { from: "sim", allow: ["shared", "data"] },
            { from: "view", allow: ["shared", "data", "sim"] },
            { from: "ui", allow: ["shared", "data", "sim"] },
            { from: "audio", allow: ["shared", "sim"] },
            { from: "app", allow: ["shared", "data", "sim", "view", "ui", "audio"] },
            { from: "test", allow: ["shared", "data", "sim", "view", "ui", "audio", "app"] },
          ],
        },
      ],
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
      "@typescript-eslint/consistent-type-imports": "error",
    },
  },
  {
    // Simulation und Daten: kein Three, kein DOM, kein Browser-Speicher.
    files: ["src/sim/**/*.ts", "src/data/**/*.ts", "src/shared/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [{ name: "three", message: "Nicht in sim/data/shared — Three.js gehört in view/. Nutze shared/math." }],
          patterns: [{ group: ["three/*"], message: "Nicht in sim/data/shared — Three.js gehört in view/." }],
        },
      ],
      "no-restricted-globals": ["error", "document", "window", "localStorage", "sessionStorage", "navigator", "requestAnimationFrame"],
    },
  },
  {
    // Balancing-Werte gehören in data/*.json, nicht als Literale in Systeme (CLAUDE.md).
    // Hier nur als Hinweis auf Zahlen mit Nachkommastellen in sim/systems — bewusst "warn".
    files: ["src/sim/systems/**/*.ts"],
    rules: {
      "no-restricted-syntax": [
        "warn",
        { selector: "Literal[value=/^\\d+\\.\\d+$/]", message: "Nachkommazahl im System — gehört das nach data/balancing.json?" },
      ],
    },
  },
);
