// Build-Skript ohne Shell-Verkettung (&&), damit es unter Windows-PowerShell und Linux gleich läuft.
import { spawnSync } from "node:child_process";
const run = (cmd, args) => {
  const r = spawnSync(cmd, args, { stdio: "inherit", shell: process.platform === "win32" });
  if (r.status !== 0) process.exit(r.status ?? 1);
};
run("npx", ["tsc", "--noEmit", "-p", "tsconfig.json"]);
run("npx", ["vite", "build"]);
