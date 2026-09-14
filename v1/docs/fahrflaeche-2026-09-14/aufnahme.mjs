/**
 * Layout-Aufnahme der Touch-Bedienung ohne Spiel: nimmt die echte index.html,
 * wirft das Spielmodul heraus und schaltet die Touchflaeche von Hand an.
 * So sieht man Groessenverhaeltnisse und Ueberlappungen, ohne Rapier und
 * Three.js in einem Kopflos-Browser starten zu muessen.
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

/** @param {{name:string,w:number,h:number,mass:boolean}} v */
function bauen(v) {
  const skript = `
  <script>
    document.getElementById("touch").style.display = "block";
    document.body.classList.add("touch");
    document.getElementById("loading").style.display = "none";
    document.getElementById("help").style.display = "none"; // main.ts blendet die Tastenliste auf Touch aus
    document.getElementById("gripinfo").textContent = "Greifer: offen · 0 kg";
    document.getElementById("money").textContent = "Konto: 1.250 €";
    document.getElementById("shift").textContent = "Annahme";
    document.getElementById("tut-titel").textContent = "Willkommen auf dem Platz";
    document.getElementById("tut-text").textContent =
      "Linker Stick: Hauptarm und Oberwagen, rechter Stick: Ausleger und Greifer. Gefahren wird auf dem Feld unten links.";
    document.getElementById("tutorial").classList.add("open");
    // Beide Daumen auflegen: Armstick knapp ueber der Fahrflaeche, Fahrstick
    // in deren Mitte, rechter Stick in Daumenhoehe.
    const setz = (id, x, y, dx, dy) => {
      const p = document.getElementById(id);
      p.hidden = false; p.style.left = x + "px"; p.style.top = y + "px";
      const k = p.querySelector(".knob");
      const weg = p.offsetWidth / 2 - k.offsetWidth / 2 - 2;
      k.style.transform = "translate(" + dx * weg + "px," + dy * weg + "px)";
    };
    const W = innerWidth, H = innerHeight;
    const feld = document.getElementById("zone-drive").getBoundingClientRect();
    setz("touch-left", Math.round(W * 0.14), Math.round(feld.top - (H < 430 ? 60 : 110)), 0.35, -0.5);
    setz("touch-drive", Math.round(feld.left + feld.width * 0.34), Math.round(feld.top + feld.height * 0.55), 0.2, -0.75);
    setz("touch-right", Math.round(W * 0.74), Math.round(H * 0.68), -0.4, 0.3);
    document.getElementById("zone-drive").classList.add("an");
    ${v.mass ? masseSkript() : ""}
  </script>`;
  const seite = roh.replace("</body>", skript + "\n  </body>");
  const datei = resolve(aus, v.name + ".html");
  writeFileSync(datei, seite);
  const png = resolve(aus, v.name + ".png");
  execFileSync(chrome, [
    "--headless=old", "--no-sandbox", "--disable-software-rasterizer", "--use-gl=swiftshader",
    "--disable-gpu",
    "--hide-scrollbars",
    "--force-device-scale-factor=1",
    "--screenshot=" + png,
    "--window-size=" + v.w + "," + v.h,
    "file:///" + datei.replace(/\\/g, "/"),
  ]);
  console.log(png);
}

function masseSkript() {
  return `
    const o = document.createElement("div");
    o.style.cssText = "position:fixed;inset:0;z-index:99;pointer-events:none";
    const arc = document.createElement("div");
    const r = 478;
    arc.style.cssText = "position:absolute;left:" + (-r) + "px;bottom:" + (-r) + "px;width:" + (2*r) + "px;height:" + (2*r) + "px;border-radius:50%;border:2px dashed rgba(120,220,150,0.55);background:rgba(120,220,150,0.05)";
    o.appendChild(arc);
    const mark = (t, x, y) => {
      const d = document.createElement("div");
      d.textContent = t;
      d.style.cssText = "position:absolute;left:" + x + "px;top:" + y + "px;color:#8fe6ad;font:12px Consolas,monospace;background:rgba(10,12,14,0.75);padding:2px 5px;border-radius:4px";
      o.appendChild(d);
    };
    const f = document.getElementById("zone-drive").getBoundingClientRect();
    mark("FAHREN " + Math.round(f.width) + " x " + Math.round(f.height) + " px", f.left + 8, f.top - 22);
    mark("Daumenbogen 478 px", 8, innerHeight - r - 26);
    mark("Armstick: " + Math.round(innerWidth/2) + " x " + Math.round(f.top) + " px frei", 8, Math.max(4, f.top - 120));
    document.body.appendChild(o);`;
}

bauen({ name: "ipad-quer", w: 1180, h: 820, mass: false });
bauen({ name: "ipad-quer-masse", w: 1180, h: 820, mass: true });
bauen({ name: "iphone-mini-quer", w: 812, h: 375, mass: false });
bauen({ name: "iphone-mini-quer-masse", w: 812, h: 375, mass: true });
