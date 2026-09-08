// Pflicht vor jedem Commit (CLAUDE.md): check, lint, test — nacheinander, plattformneutral.
import { spawnSync } from "node:child_process";
for (const args of [["run", "check"], ["run", "lint"], ["run", "test"]]) {
  const r = spawnSync("npm", args, { stdio: "inherit", shell: process.platform === "win32" });
  if (r.status !== 0) { console.error(`\n✖ npm ${args.join(" ")} fehlgeschlagen`); process.exit(r.status ?? 1); }
}
console.log("\n✔ check, lint, test grün");
