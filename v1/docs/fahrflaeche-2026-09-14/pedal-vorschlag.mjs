/**
 * Nur ein Vorschlagsbild: dieselbe Fahrflaeche, als Pedal gezeichnet.
 * Lage, Groesse und Bedienung bleiben wie gebaut — es aendert sich die Optik.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { resolve, join } from "node:path";

const wurzel = "C:/Users/Patrick/Projekte/Schrottplatz-App/.claude/worktrees/agent-a6ec1909724ad0a2f/v1";
const aus = process.argv[2] ?? "./out";
const chrome = "C:/Users/Patrick/AppData/Local/ms-playwright/chromium_headless_shell-1148/chrome-win/headless_shell.exe";
mkdirSync(aus, { recursive: true });

const roh = readFileSync(join(wurzel, "index.html"), "utf8").replace(
  /<script type="module"[^>]*><\/script>/,
  ""
);

const skript = `
  <style>
    /* VORSCHLAG, nicht gebaut: Riffelblech statt Rahmen */
    #touch #zone-drive {
      background:
        repeating-linear-gradient(180deg, rgba(255,255,255,0.05) 0 3px, rgba(0,0,0,0) 3px 12px),
        linear-gradient(180deg, rgba(58,48,32,0.85), rgba(32,28,22,0.9));
      border: 3px solid rgba(200,150,60,0.55);
      border-left: none; border-bottom: none;
      border-top-right-radius: 22px;
      box-shadow: inset 0 14px 26px rgba(0,0,0,0.45);
    }
    #zone-drive .beschriftung { top: 8px; color: #e0b05c; opacity: 0.9; }
    #zone-drive .beschriftung b { letter-spacing: 4px; }
    .pfeil { position: absolute; color: #e0b05c; font: 600 15px Consolas, monospace; opacity: 0.75; }
  </style>
  <script>
    document.getElementById("touch").style.display = "block";
    document.body.classList.add("touch");
    document.getElementById("loading").style.display = "none";
    document.getElementById("help").style.display = "none";
    document.getElementById("gripinfo").textContent = "Greifer: offen · 0 kg";
    document.getElementById("money").textContent = "Konto: 1.250 €";
    document.getElementById("shift").textContent = "Annahme";
    document.getElementById("tutorial").classList.remove("open");
    const z = document.getElementById("zone-drive");
    const p = (t, css) => { const d = document.createElement("div"); d.className = "pfeil"; d.textContent = t; d.style.cssText += css; z.appendChild(d); };
    p("▲ VOR", "left:50%;transform:translateX(-50%);top:44px");
    p("▼ ZURÜCK", "left:50%;transform:translateX(-50%);bottom:14px");
    p("◀", "left:14px;top:50%");
    p("▶", "right:14px;top:50%");
    const setz = (id, x, y, dx, dy) => {
      const el = document.getElementById(id);
      el.hidden = false; el.style.left = x + "px"; el.style.top = y + "px";
      const k = el.querySelector(".knob");
      const weg = el.offsetWidth / 2 - k.offsetWidth / 2 - 2;
      k.style.transform = "translate(" + dx * weg + "px," + dy * weg + "px)";
    };
    const f = z.getBoundingClientRect();
    setz("touch-drive", Math.round(f.left + f.width * 0.42), Math.round(f.top + f.height * 0.6), 0.15, -0.7);
    z.classList.add("an");
  </script>`;

const datei = resolve(aus, "ipad-quer-pedal-vorschlag.html");
writeFileSync(datei, roh.replace("</body>", skript + "\n  </body>"));
const png = resolve(aus, "ipad-quer-pedal-vorschlag.png");
execFileSync(chrome, [
  "--headless=old", "--no-sandbox", "--disable-gpu", "--hide-scrollbars",
  "--force-device-scale-factor=1",
  "--screenshot=" + png, "--window-size=1180,820",
  "file:///" + datei.replace(/\\/g, "/"),
]);
console.log(png);
