import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig, type Plugin } from "vite";

/**
 * Bildannahme fuer Vorschauen aus dem laufenden Spiel — NUR im Dev-Server.
 *
 * Anlass (23.09.2026): Patrick wollte die Zerstoerungsmechanik beurteilen und
 * sagte zu einer Textseite: "die seite mit text nuetzt mir nix, dachte an
 * previews". Bilder muessen also aus dem echten Spiel kommen, nicht gezeichnet
 * sein. Das Spiel kann sich mit einem zweiten `WebGLRenderer` selbst
 * fotografieren (`__game` gibt Szene und Objekte her) — nur lag das Bild dann
 * im Browser fest, und ein Datei-Download ist dort nicht zu haben.
 *
 * Deshalb dieser Schalter: Das Spiel schickt ein PNG oder JPEG an
 * `POST /__vorschau/<name>`, und der Dev-Server legt es unter
 * `docs/vorschau/` ab. Er laeuft NICHT im Build (`apply: "serve"`), und der
 * Name wird auf harmlose Zeichen beschnitten, damit nichts aus dem Ordner
 * herausgeschrieben werden kann.
 */
function vorschauAnnahme(): Plugin {
  return {
    name: "vorschau-annahme",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use("/__vorschau", (req, res) => {
        if (req.method !== "POST") {
          res.statusCode = 405;
          res.end("nur POST");
          return;
        }
        const name = (req.url || "").replace(/^\//, "").replace(/[^A-Za-z0-9._-]/g, "");
        if (!name) {
          res.statusCode = 400;
          res.end("kein Name");
          return;
        }
        const stuecke: Buffer[] = [];
        req.on("data", (c: Buffer) => stuecke.push(c));
        req.on("end", () => {
          const ordner = resolve(__dirname, "docs/vorschau");
          mkdirSync(ordner, { recursive: true });
          // Der Koerper ist eine data:-URL; alles vor dem Komma ist Kopfzeug.
          const roh = Buffer.concat(stuecke).toString("utf8");
          const komma = roh.indexOf(",");
          writeFileSync(resolve(ordner, name), Buffer.from(roh.slice(komma + 1), "base64"));
          res.statusCode = 200;
          res.end(name);
        });
      });
    },
  };
}

// base "./" damit der Build später unverändert in Capacitor (Android) läuft.
// Port ueber PORT ueberschreibbar, damit mehrere Worktrees parallel laufen koennen.
const port = Number(process.env.PORT) || 5173;

export default defineConfig({
  base: "./",
  plugins: [vorschauAnnahme()],
  /*
   * Drei Seiten: das Spiel, das Spinnen-Labor (Auftrag 11.09.2026, Phase 1.1)
   * und die Greifer-Vorschau. Labor und Vorschau laufen getrennt vom Spiel —
   * die Lehre aus dem letzten Umbau war, die Spinne nicht im laufenden Spiel
   * umzubauen. Die Vorschau laedt zusaetzlich die exportierte GLB-Datei statt
   * des Modells aus dem Quelltext: Nur so sieht man, was in einer Engine
   * ankommt.
   */
  build: {
    rollupOptions: {
      input: {
        index: resolve(__dirname, "index.html"),
        labor: resolve(__dirname, "labor.html"),
        greifer: resolve(__dirname, "greifer.html"),
      },
    },
  },
  server: {
    port,
    strictPort: true,
  },
  /*
   * Nur `test/` laeuft als Testlauf. Unter `docs/archiv/` liegen die Quellen
   * abgelegter Bauformen samt ihrer Waechter — die gehoeren zum Archiv und
   * sollen nicht gegen den aktuellen Stand gemessen werden. Ohne diese Zeile
   * schlug der Waechter der Fuenfschalenschale fehl, sobald die Sichelkralle
   * wieder eingebaut war.
   */
  test: {
    include: ["test/**/*.test.ts"],
  },
});
