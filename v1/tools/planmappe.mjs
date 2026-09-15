/**
 * Baut eine Übersichtsseite über alle Zeichnungen und Messprotokolle.
 *
 * Hintergrund 15.09.2026: Patrick schaut ausschliesslich auf iPhone und iPad.
 * Ich hatte ihm die Adresse einer Zeichnung genannt — und sie war nicht
 * erreichbar, weil der Pages-Auftrag nur `v1/dist` veroeffentlicht. Alles unter
 * `v1/docs` lag nur auf meinem Rechner. Sein Befund: "Ich kann auch nichts
 * aufrufen mit dem Link. Weder Baggerkonzept noch Platzkonzept. 404-Fehler."
 *
 * Seitdem kopiert der Auftrag `v1/docs` nach `site/v1/plaene/` und ruft vorher
 * dieses Skript auf. Es schreibt `docs/index.html` — eine Liste, die man auf
 * dem Telefon antippen kann, statt Dateinamen zu tippen.
 *
 * Aufruf:  node tools/planmappe.mjs
 */
import { readdirSync, statSync, writeFileSync } from "node:fs";
import { join, relative, extname } from "node:path";
import { fileURLToPath } from "node:url";

const DOCS = join(fileURLToPath(new URL("../docs", import.meta.url)));

/**
 * Was der Browser von sich aus anzeigt, und was er nur herunterlaedt.
 * Safari stellt SVG und PNG dar; `.md` landet als Textdatei im Fenster, was
 * zum Nachlesen reicht, aber nicht huebsch ist — darum getrennt ausgewiesen.
 */
const ANSEHEN = new Set([".svg", ".png", ".jpg", ".jpeg", ".webp"]);
const LESEN = new Set([".md", ".txt", ".csv"]);

/** Alle Dateien unterhalb von docs/, ohne das Archiv. */
function sammeln(verzeichnis, gesammelt = []) {
  for (const name of readdirSync(verzeichnis)) {
    if (name === "archiv" || name === "index.html") continue;
    const voll = join(verzeichnis, name);
    if (statSync(voll).isDirectory()) sammeln(voll, gesammelt);
    else gesammelt.push(voll);
  }
  return gesammelt;
}

/**
 * Datum aus dem Dateinamen, wenn eines darinsteht.
 *
 * Die Messprotokolle heissen seit dem 14.09. entweder `2026-09-14_thema` oder
 * `thema-2026-09-14`. Beide Formen kommen vor, also werden beide gelesen —
 * lieber zwei Muster als eine Umbenennung, die Verweise zerreisst.
 */
function datum(pfad) {
  const m = /(\d{4})-(\d{2})-(\d{2})/.exec(pfad);
  return m ? `${m[3]}.${m[2]}.${m[1]}` : "";
}

/** Aus `2026-09-14_hallen-silos.svg` wird "Hallen silos". */
function titel(pfad) {
  const datei = pfad.split(/[\\/]/).pop() ?? pfad;
  const ohne = datei
    .replace(extname(datei), "")
    .replace(/\d{4}-\d{2}-\d{2}/g, "")
    .replace(/[_-]+/g, " ")
    .trim();
  if (!ohne) return datei;
  return ohne.charAt(0).toUpperCase() + ohne.slice(1);
}

const dateien = sammeln(DOCS)
  .map((voll) => ({
    href: relative(DOCS, voll).split(/[\\/]/).join("/"),
    endung: extname(voll).toLowerCase(),
    datum: datum(voll),
    titel: titel(voll),
    groesse: statSync(voll).size,
  }))
  .filter((d) => ANSEHEN.has(d.endung) || LESEN.has(d.endung))
  // Neueste zuerst; bei gleichem Datum alphabetisch, damit die Reihenfolge
  // zwischen zwei Durchlaeufen nicht springt.
  .sort((a, b) => b.datum.localeCompare(a.datum) || a.href.localeCompare(b.href));

const zeile = (d) => `      <li>
        <a href="${d.href}">
          <span class="t">${d.titel}</span>
          <span class="m">${d.datum || "ohne Datum"} · ${d.endung.slice(1).toUpperCase()} · ${Math.round(d.groesse / 1024)} kB</span>
        </a>
      </li>`;

const bilder = dateien.filter((d) => ANSEHEN.has(d.endung));
const texte = dateien.filter((d) => LESEN.has(d.endung));

const seite = `<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
<title>Planmappe — Rust'n'Reibach</title>
<style>
  :root { color-scheme: dark; }
  body {
    margin: 0; padding: 16px max(16px, env(safe-area-inset-right)) 48px max(16px, env(safe-area-inset-left));
    background: #1a1c1e; color: #e8e8e4;
    font: 16px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;
  }
  h1 { font-size: 20px; margin: 8px 0 4px; color: #f0d060; }
  p.hin { margin: 0 0 20px; color: #9aa2a8; font-size: 14px; }
  h2 { font-size: 15px; margin: 28px 0 8px; color: #9aa2a8; font-weight: 600;
       text-transform: uppercase; letter-spacing: 0.06em; }
  ul { list-style: none; margin: 0; padding: 0; }
  li { margin: 0 0 8px; }
  /* Mindestens 44 px hoch — Tippziel auf dem Telefon (Briefing Kap. 20). */
  a { display: block; min-height: 44px; padding: 10px 14px; border-radius: 8px;
      background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.12);
      text-decoration: none; color: inherit; }
  a:active { background: rgba(240,180,41,0.22); }
  .t { display: block; font-weight: 600; }
  .m { display: block; font-size: 13px; color: #9aa2a8; margin-top: 2px; }
  .zurueck { display: inline-block; margin-top: 32px; color: #f0b429; }
</style>
</head>
<body>
  <h1>Planmappe</h1>
  <p class="hin">Zeichnungen und Messprotokolle zu Rust'n'Reibach. Antippen öffnet das Blatt; mit zwei Fingern zoomen.</p>

  <h2>Zeichnungen (${bilder.length})</h2>
  <ul>
${bilder.map(zeile).join("\n")}
  </ul>

  <h2>Zum Nachlesen (${texte.length})</h2>
  <ul>
${texte.map(zeile).join("\n")}
  </ul>

  <a class="zurueck" href="../">&larr; zurück zum Spiel</a>
</body>
</html>
`;

writeFileSync(join(DOCS, "index.html"), seite, "utf8");
console.log(`Planmappe: ${bilder.length} Zeichnungen, ${texte.length} Texte -> docs/index.html`);
