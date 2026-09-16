/*
 * Zeichnet den Funktionskranz mit neun Eintraegen (E-088) in beiden Fassungen
 * — und daneben den Stand von gestern mit acht.
 *
 * WICHTIG: Das sind KEINE Bildschirmfotos. Hier lief kein Browser. Die Kaesten
 * sind aus `v1/index.html` und `v1/src/core/touch.ts` gerechnet — dieselbe
 * Rechnung, die `v1/test/funktionskranz.test.ts` bei jedem Testlauf prueft.
 * Was das Bild NICHT zeigt: wie Safari die Schrift wirklich setzt und wie sich
 * das Ziehen anfuehlt. Dafuer braucht es Patricks Geraet.
 *
 * Aufruf aus v1/:  node docs/messungen/2026-09-16-funktionskranz/bild.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { deflateSync } from "node:zlib";
import { fileURLToPath } from "node:url";

const hier = dirname(fileURLToPath(import.meta.url));
const wurzel = resolve(hier, "../../..");
const seite = readFileSync(resolve(wurzel, "index.html"), "utf8");
const touchTs = readFileSync(resolve(wurzel, "src/core/touch.ts"), "utf8");

const R = Number(/const RADIAL_R = (\d+);/.exec(touchTs)[1]);
const SKALA = Number(/#radial \.sektor\.sel \{[\s\S]*?scale\(([\d.]+)\)/.exec(seite)[1]);

/** Beschriftungen des Kranzes, in der Reihenfolge der Seite. */
const von = seite.indexOf('<div class="hidden-actions">');
const bis = seite.indexOf('<div class="hidden-actions" id="menu-actions">');
const LABELS = [...seite.slice(von, bis).matchAll(/<span id="([\w-]+)">([^<]+)<\/span>/g)].map(
  (m) => ({ id: m[1], text: m[2] })
);

/** Sektormass aus dem CSS: der erste Block gilt, der in der Medienabfrage ist kleiner. */
function sektorMass(klein) {
  const alle = [...seite.matchAll(/#radial \.sektor \{([^}]*)\}/g)].map((m) => m[1]);
  const block = klein ? alle[alle.length - 1] : alle[0];
  const zahl = (prop) => Number(new RegExp(`${prop}:\\s*(\\d+)px`).exec(block)[1]);
  const schrift = klein ? zahl("font-size") : Number(/font:\s*600\s*(\d+)px/.exec(block)[1]);
  return { w: zahl("width"), h: zahl("height"), schrift };
}

const FASSUNGEN = [
  { name: "iPad quer", w: 1024, h: 768, klein: false, datei: "ipad-quer" },
  { name: "iPhone mini quer", w: 812, h: 375, klein: true, datei: "iphone-mini-quer" },
];

/** Die n Kaesten auf dem Ring um (cx, cy). */
function ring(n, cx, cy, mass, gewaehlt) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const x = cx + Math.sin(a) * R;
    const y = cy - Math.cos(a) * R;
    const s = i === gewaehlt ? SKALA : 1;
    const w = mass.w * s;
    const h = mass.h * s;
    out.push({ i, x0: x - w / 2, y0: y - h / 2, x1: x + w / 2, y1: y + h / 2 });
  }
  return out;
}

const luft = (a, b) => Math.max(b.x0 - a.x1, a.x0 - b.x1, b.y0 - a.y1, a.y0 - b.y1);

function engste(kaesten) {
  let min = Infinity;
  for (let i = 0; i < kaesten.length; i++)
    for (let j = i + 1; j < kaesten.length; j++) min = Math.min(min, luft(kaesten[i], kaesten[j]));
  return min;
}

// --- SVG -------------------------------------------------------------------
function svg(f) {
  const mass = sektorMass(f.klein);
  // Daumen dort, wo er sitzt: Mitte der rechten Bildhaelfte, etwas unterhalb.
  const cx = f.w * 0.72;
  const cy = f.h * 0.5;
  const gewaehlt = 0; // der oberste scharfgestellt — dort wird es am engsten
  const k = ring(LABELS.length, cx, cy, mass, gewaehlt);
  const kipp = LABELS.findIndex((l) => l.id === "btn-kipp");
  const teile = [
    `<rect width="${f.w}" height="${f.h}" fill="#2b3136"/>`,
    `<circle cx="${cx}" cy="${cy}" r="13" fill="#f0d060" fill-opacity="0.5" stroke="#fff" stroke-opacity="0.4" stroke-width="2"/>`,
    `<circle cx="${cx}" cy="${cy}" r="${R}" fill="none" stroke="#f0d060" stroke-opacity="0.15" stroke-dasharray="4 6"/>`,
  ];
  for (const kst of k) {
    const sel = kst.i === gewaehlt;
    teile.push(
      `<rect x="${kst.x0}" y="${kst.y0}" width="${kst.x1 - kst.x0}" height="${kst.y1 - kst.y0}" rx="8" ` +
        `fill="${sel ? "#f0b429" : "#141618"}" fill-opacity="0.92" stroke="${sel ? "#f0d060" : "#ffffff"}" stroke-opacity="${sel ? 1 : 0.28}" stroke-width="2"/>`,
      `<text x="${(kst.x0 + kst.x1) / 2}" y="${(kst.y0 + kst.y1) / 2 + 4}" fill="${sel ? "#1a1c1e" : "#e8e8e4"}" ` +
        `font-family="Consolas,monospace" font-weight="600" font-size="${mass.schrift}" text-anchor="middle">${LABELS[kst.i].text}</text>`
    );
    if (kst.i === kipp) {
      // Zustandsbalken: so sieht "eingeschaltet" aus (KIPPEN ist an)
      teile.push(
        `<rect x="${kst.x0 + 7}" y="${kst.y1 - 7}" width="${kst.x1 - kst.x0 - 14}" height="4" rx="2" fill="#f0d060"/>`
      );
    }
  }
  teile.push(
    `<text x="20" y="26" fill="#f0d060" font-family="Consolas,monospace" font-size="14">` +
      `${f.name} · ${f.w} x ${f.h} · ${LABELS.length} Eintraege · R=${R} · Kasten ${mass.w}x${mass.h} · ` +
      `engste Stelle ${engste(k).toFixed(1)} px · GERECHNET, kein Bildschirmfoto</text>`,
    `<text x="20" y="46" fill="#8b949b" font-family="Consolas,monospace" font-size="12">` +
      `KIPPEN mit Balken = eingeschaltet · der helle Kasten ist scharfgestellt</text>`
  );
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${f.w}" height="${f.h}" viewBox="0 0 ${f.w} ${f.h}">${teile.join("")}</svg>`;
}

// --- dasselbe als PNG ------------------------------------------------------
/*
 * Ein SVG kommt beim Agenten als Text an; er kann nicht sehen, ob sich zwei
 * Kaesten beruehren. Darum dieselben Kaesten noch einmal als echtes Bild, mit
 * einem Minimal-PNG-Schreiber (nur zlib aus Node, keine Bibliothek).
 * Uebernommen aus docs/messungen/2026-09-15-greifanzeige/bild.mjs.
 */
function png(breite, hoehe, pixel) {
  const crcTab = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crcTab[n] = c >>> 0;
  }
  const crc = (buf) => {
    let c = 0xffffffff;
    for (const b of buf) c = crcTab[(c ^ b) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (typ, daten) => {
    const laenge = Buffer.alloc(4);
    laenge.writeUInt32BE(daten.length);
    const koerper = Buffer.concat([Buffer.from(typ, "ascii"), daten]);
    const pruef = Buffer.alloc(4);
    pruef.writeUInt32BE(crc(koerper));
    return Buffer.concat([laenge, koerper, pruef]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(breite, 0);
  ihdr.writeUInt32BE(hoehe, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  const roh = Buffer.alloc((breite * 3 + 1) * hoehe);
  for (let y = 0; y < hoehe; y++) {
    roh[y * (breite * 3 + 1)] = 0;
    pixel.copy(roh, y * (breite * 3 + 1) + 1, y * breite * 3, (y + 1) * breite * 3);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(roh)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

/** Ein Bild mit zwei Kraenzen: links der Stand von gestern, rechts der neue. */
function bild(f) {
  const mass = sektorMass(f.klein);
  const alt = f.klein ? { w: 70, h: 30, r: 104, s: 1.15 } : { w: 80, h: 34, r: 104, s: 1.15 };
  const p = Buffer.alloc(f.w * f.h * 3);
  const setz = (x, y, [r, g, b]) => {
    x = Math.round(x);
    y = Math.round(y);
    if (x < 0 || y < 0 || x >= f.w || y >= f.h) return;
    const i = (y * f.w + x) * 3;
    p[i] = r;
    p[i + 1] = g;
    p[i + 2] = b;
  };
  for (let y = 0; y < f.h; y++) for (let x = 0; x < f.w; x++) setz(x, y, [43, 49, 54]);
  const male = (kst, farbe, rahmen) => {
    for (let y = Math.round(kst.y0); y < Math.round(kst.y1); y++)
      for (let x = Math.round(kst.x0); x < Math.round(kst.x1); x++) {
        const amRand =
          y < kst.y0 + 2 || y >= kst.y1 - 2 || x < kst.x0 + 2 || x >= kst.x1 - 2;
        setz(x, y, amRand ? rahmen : farbe);
      }
  };
  // links: acht Eintraege, alte Masse (Rahmen kam auf width obendrauf)
  const cxA = f.w * 0.25;
  const cy = f.h * 0.5;
  const kA = [];
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const x = cxA + Math.sin(a) * alt.r;
    const y = cy - Math.cos(a) * alt.r;
    const s = i === 0 ? alt.s : 1;
    kA.push({ x0: x - (alt.w * s) / 2, y0: y - (alt.h * s) / 2, x1: x + (alt.w * s) / 2, y1: y + (alt.h * s) / 2 });
  }
  for (const kst of kA) male(kst, [26, 28, 30], [200, 80, 70]); // roter Rahmen: alt
  // rechts: neun Eintraege, neue Masse
  const kN = ring(LABELS.length, f.w * 0.72, cy, mass, 0);
  for (const kst of kN) male(kst, [26, 28, 30], [120, 200, 130]); // gruener Rahmen: neu
  return { daten: png(f.w, f.h, p), altLuft: engste(kA), neuLuft: engste(kN) };
}

const zeilen = [];
for (const f of FASSUNGEN) {
  writeFileSync(resolve(hier, `${f.datei}.svg`), svg(f), "utf8");
  const b = bild(f);
  writeFileSync(resolve(hier, `${f.datei}.png`), b.daten);
  const mass = sektorMass(f.klein);
  zeilen.push(
    `${f.name.padEnd(18)} Kasten ${mass.w}x${mass.h}  R=${R}  scharf x${SKALA}  ` +
      `neun Eintraege: ${b.neuLuft.toFixed(1)} px Luft   (alt, acht Eintraege: ${b.altLuft.toFixed(1)} px)`
  );
}
console.log(zeilen.join("\n"));
